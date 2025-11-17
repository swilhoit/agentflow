import { EventEmitter } from 'events';
import { logger } from './logger';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { Conversation } from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/Conversation';
import { AudioInterface } from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/AudioInterface';
import { ClientTools } from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/ClientTools';

export interface ElevenLabsVoiceConfig {
  apiKey: string;
  agentId?: string; // Optional: use existing agent or we can configure it
  voice?: string;
  instructions?: string;
  tools?: any[];
}

interface FunctionCallHandler {
  (name: string, args: any): Promise<any>;
}

/**
 * Custom Audio Interface for Discord <-> ElevenLabs Audio Bridge
 */
class DiscordAudioInterface extends AudioInterface {
  private inputCallback: ((audio: Buffer) => void) | null = null;
  private outputCallback: ((audio: Buffer) => void) | null = null;
  private isActive: boolean = false;

  start(inputCallback: (audio: Buffer) => void): void {
    logger.info('[ElevenLabs Audio] Starting audio interface');
    this.inputCallback = inputCallback;
    this.isActive = true;
  }

  stop(): void {
    logger.info('[ElevenLabs Audio] Stopping audio interface');
    this.isActive = false;
    this.inputCallback = null;
    this.outputCallback = null;
  }

  output(audio: Buffer): void {
    // Receive audio from ElevenLabs and send to Discord
    if (this.outputCallback && this.isActive) {
      this.outputCallback(audio);
    }
  }

  interrupt(): void {
    logger.info('[ElevenLabs Audio] Interrupting audio output');
    // Stop local audio playback immediately
    // The Conversation's turn-taking model will handle the rest
    this.isActive = false;
  }

  /**
   * Resume audio output after interruption
   */
  resume(): void {
    logger.info('[ElevenLabs Audio] Resuming audio output');
    this.isActive = true;
  }

  /**
   * Send user audio from Discord to ElevenLabs
   */
  sendUserAudio(audio: Buffer): void {
    if (this.inputCallback && this.isActive) {
      this.inputCallback(audio);
    }
  }

  /**
   * Register callback for receiving agent audio
   */
  onAgentAudio(callback: (audio: Buffer) => void): void {
    this.outputCallback = callback;
  }

  isAudioActive(): boolean {
    return this.isActive;
  }
}

/**
 * ElevenLabs Conversational AI Service
 * Handles bidirectional audio streaming with ElevenLabs Conversational AI API
 */
export class ElevenLabsVoiceService extends EventEmitter {
  private client: ElevenLabsClient;
  private conversation: Conversation | null = null;
  private config: ElevenLabsVoiceConfig;
  private audioInterface: DiscordAudioInterface;
  private clientTools: ClientTools;
  private functionCallHandler: FunctionCallHandler | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private isIntentionallyClosed: boolean = false;

  constructor(config: ElevenLabsVoiceConfig) {
    super();
    this.config = config;

    // Initialize ElevenLabs client
    this.client = new ElevenLabsClient({
      apiKey: this.config.apiKey
    });

    // Initialize audio interface
    this.audioInterface = new DiscordAudioInterface();

    // Initialize client tools for function calling
    this.clientTools = new ClientTools();

    // Set up audio output handler
    this.audioInterface.onAgentAudio((audio: Buffer) => {
      this.emit('audio', audio);
    });

    logger.info('ElevenLabs Voice Service initialized');
  }

  /**
   * Connect to ElevenLabs Conversational AI
   */
  async connect(): Promise<void> {
    this.isIntentionallyClosed = false;

    try {
      logger.info('[ElevenLabs] Connecting to Conversational AI...');

      // If no agentId provided, we need to create an agent first
      if (!this.config.agentId) {
        throw new Error('Agent ID is required. Please create an agent in the ElevenLabs dashboard and provide its ID.');
      }

      // Note: System instructions are now set directly in the ElevenLabs agent configuration
      // via the API or dashboard. No need to override at connection time.
      
      // Create conversation instance
      this.conversation = new Conversation({
        client: this.client,
        agentId: this.config.agentId,
        requiresAuth: false,  // Changed from true - auth is handled by API key
        audioInterface: this.audioInterface,
        clientTools: this.clientTools,
        callbackAgentResponse: (response: string) => {
          logger.info(`[ElevenLabs] Agent response: ${response}`);
          this.emit('assistant_transcript_delta', response);
        },
        callbackUserTranscript: (transcript: string) => {
          logger.info(`[ElevenLabs] User transcript: ${transcript}`);
          this.emit('transcription', transcript);
        },
        callbackLatencyMeasurement: (latencyMs: number) => {
          logger.debug(`[ElevenLabs] Latency: ${latencyMs}ms`);
        },
        callbackAgentResponseCorrection: (correction: string) => {
          logger.info(`[ElevenLabs] Agent response correction: ${correction}`);
        }
      });

      // Start the conversation session
      await this.conversation.startSession();

      logger.info('[ElevenLabs] Connected successfully - using agent prompt from API configuration');
      this.emit('connected');
      this.reconnectAttempts = 0;

    } catch (error) {
      logger.error('[ElevenLabs] Connection failed', error);
      this.emit('error', error);

      // Attempt reconnection if not intentionally closed
      if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnect();
      }
      throw error;
    }
  }

  /**
   * Send audio data to ElevenLabs
   * @param audioData - PCM16 audio buffer at 16kHz mono
   */
  private audioChunksSent = 0;

  sendAudio(audioData: Buffer): void {
    if (!this.conversation) {
      logger.warn('[ElevenLabs] Cannot send audio - conversation not active');
      return;
    }

    // If audio interface is not active after interruption, resume it
    if (!this.audioInterface.isAudioActive()) {
      logger.info('[ElevenLabs] Audio interface inactive - auto-resuming after interruption');
      this.audioInterface.resume();
    }

    // ElevenLabs expects 16-bit PCM mono at 16kHz
    // Our Discord audio is at 24kHz after resampling, so we need to downsample
    const downsampledAudio = this.downsampleAudio(audioData, 24000, 16000);
    this.audioInterface.sendUserAudio(downsampledAudio);
    
    // Log every 100th chunk to avoid spam
    this.audioChunksSent++;
    if (this.audioChunksSent % 100 === 0) {
      logger.info(`[ElevenLabs] Sent ${this.audioChunksSent} audio chunks to ElevenLabs (latest: ${downsampledAudio.length} bytes)`);
    }
  }

  /**
   * Downsample audio from one sample rate to another
   */
  private downsampleAudio(buffer: Buffer, fromRate: number, toRate: number): Buffer {
    const ratio = fromRate / toRate;
    const inputSamples = Math.floor(buffer.length / 2);
    const outputSamples = Math.floor(inputSamples / ratio);
    const outputBuffer = Buffer.alloc(outputSamples * 2);

    for (let i = 0; i < outputSamples; i++) {
      const sourceIndex = Math.floor(i * ratio);
      const sample = buffer.readInt16LE(sourceIndex * 2);
      outputBuffer.writeInt16LE(sample, i * 2);
    }

    return outputBuffer;
  }

  /**
   * Send a text message (for hybrid mode)
   */
  sendText(text: string): void {
    if (!this.conversation) {
      logger.warn('[ElevenLabs] Cannot send text - conversation not active');
      return;
    }

    this.conversation.sendUserMessage(text);
    logger.info(`[ElevenLabs] Sent text message: ${text}`);
  }

  /**
   * Interrupt the agent's current response
   * 
   * Note: ElevenLabs Conversational AI handles interruptions automatically via its 
   * turn-taking model. When the user starts speaking, the agent will automatically
   * stop and listen. This method provides a manual way to trigger the same behavior.
   */
  interrupt(): void {
    if (!this.conversation) {
      return;
    }

    // Signal to the audio interface that we want to interrupt
    // This stops local audio playback immediately
    this.audioInterface.interrupt();
    
    // The conversation will naturally handle the interruption through its turn-taking model
    // No need to send explicit cancel messages - ElevenLabs manages this automatically
    logger.info('[ElevenLabs] Agent interrupted - turn-taking will handle cleanup');
  }

  /**
   * Resume audio output after interruption
   */
  resumeAudio(): void {
    this.audioInterface.resume();
  }

  /**
   * Check if audio interface is active
   */
  isAudioActive(): boolean {
    return this.audioInterface.isAudioActive();
  }

  /**
   * Register a function call handler
   */
  onFunctionCall(handler: FunctionCallHandler): void {
    this.functionCallHandler = handler;
    logger.info('[ElevenLabs] Function call handler registered');
  }

  /**
   * Register tools with the conversation
   */
  registerTool(toolName: string, handler: (parameters: Record<string, any>) => any | Promise<any>): void {
    this.clientTools.register(toolName, async (parameters: Record<string, any>) => {
      if (this.functionCallHandler) {
        try {
          const result = await this.functionCallHandler(toolName, parameters);
          logger.info(`[ElevenLabs] Tool ${toolName} executed successfully`);
          return result;
        } catch (error) {
          logger.error(`[ElevenLabs] Tool ${toolName} execution failed`, error);
          throw error;
        }
      }
      throw new Error('No function call handler registered');
    });

    logger.info(`[ElevenLabs] Tool registered: ${toolName}`);
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);

    logger.info(`[ElevenLabs] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      try {
        await this.connect();
        logger.info('[ElevenLabs] Successfully reconnected');
        this.emit('reconnected');
      } catch (error) {
        logger.error(`[ElevenLabs] Reconnection attempt ${this.reconnectAttempts} failed`, error);
      }
    }, delay);
  }

  /**
   * Disconnect from ElevenLabs
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;

    if (this.conversation) {
      this.conversation.endSession();
      this.conversation = null;
    }

    this.audioInterface.stop();
    this.reconnectAttempts = 0;

    logger.info('[ElevenLabs] Disconnected');
    this.emit('disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.conversation !== null && this.conversation.isSessionActive();
  }

  /**
   * Get conversation ID
   */
  getConversationId(): string | undefined {
    return this.conversation?.getConversationId();
  }

  /**
   * Send contextual update to the agent
   * This provides additional context without interrupting the conversation
   */
  sendContextualUpdate(context: string): void {
    if (!this.conversation) {
      logger.error('[ElevenLabs] Cannot send contextual update - not connected');
      return;
    }

    logger.info(`[ElevenLabs] 📤 Sending contextual update (${context.length} characters)`);
    this.conversation.sendContextualUpdate(context);
    logger.info('[ElevenLabs] ✅ Contextual update sent successfully to agent');
  }
}

