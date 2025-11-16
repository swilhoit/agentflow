import WebSocket from 'ws';
import { logger } from './logger';
import { EventEmitter } from 'events';

export interface RealtimeVoiceConfig {
  apiKey: string;
  model?: 'gpt-4o-realtime-preview' | 'gpt-4o-mini-realtime-preview';
  voice?: 'alloy' | 'echo' | 'shimmer' | 'nova' | 'ash' | 'coral' | 'sage';
  instructions?: string;
  modalities?: ('text' | 'audio')[];
  temperature?: number;
  maxResponseOutputTokens?: number;
  tools?: any[];
}

interface FunctionCallHandler {
  (name: string, args: any): Promise<any>;
}

/**
 * OpenAI Realtime API WebSocket Service
 * Handles bidirectional audio streaming with GPT-4o Realtime API
 */
export class RealtimeVoiceService extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: RealtimeVoiceConfig;
  private conversationId: string | null = null;
  private responseInProgress: boolean = false;
  private functionCallHandler: FunctionCallHandler | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isIntentionallyClosed: boolean = false;

  constructor(config: RealtimeVoiceConfig) {
    super();
    this.config = {
      model: 'gpt-4o-realtime-preview',
      voice: 'alloy',
      modalities: ['text', 'audio'],
      temperature: 0.8,
      maxResponseOutputTokens: 4096,
      ...config
    };
  }

  /**
   * Connect to OpenAI Realtime API via WebSocket
   */
  async connect(): Promise<void> {
    this.isIntentionallyClosed = false; // Reset flag when connecting

    return new Promise((resolve, reject) => {
      const url = 'wss://api.openai.com/v1/realtime?model=' + this.config.model;

      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.ws.on('open', () => {
        logger.info('Connected to OpenAI Realtime API');
        this.sendSessionUpdate();
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const event = JSON.parse(data.toString());
          this.handleServerEvent(event);
        } catch (error) {
          logger.error('Failed to parse server event', error);
        }
      });

      this.ws.on('error', (error) => {
        logger.error('WebSocket error', error);
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        logger.info(`Disconnected from OpenAI Realtime API (code: ${code}, reason: ${reason.toString()})`);
        this.emit('disconnected');

        // Attempt reconnection if not intentionally closed
        if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          logger.error('Max reconnection attempts reached');
          this.emit('max_reconnect_attempts_reached');
        }
      });
    });
  }

  /**
   * Send session configuration to the API
   */
  private sendSessionUpdate(): void {
    if (!this.ws) return;

    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: this.config.modalities,
        instructions: this.config.instructions || this.getDefaultInstructions(),
        voice: this.config.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,         // Balanced sensitivity
          prefix_padding_ms: 300, // Capture context before speech
          silence_duration_ms: 200 // Fast response - only 200ms silence needed
        },
        tools: this.config.tools || [],
        temperature: this.config.temperature,
        max_response_output_tokens: this.config.maxResponseOutputTokens
      }
    };

    this.send(sessionConfig);
    logger.info('Sent session configuration');
  }

  /**
   * Default instructions for the voice assistant
   */
  private getDefaultInstructions(): string {
    return `You are a helpful voice assistant integrated with a Discord bot. You can:

1. Have natural conversations with users
2. Execute complex tasks by calling specialized functions
3. Provide clear, concise voice responses (keep answers brief for voice)
4. When users ask you to perform tasks like deploying code, running commands, or analyzing data, use the available functions

Keep your responses conversational and concise since this is voice chat. When you need to perform complex tasks, call the appropriate function and then explain what you're doing in simple terms.`;
  }

  /**
   * Send audio data to the API
   * @param audioData - PCM16 audio buffer
   */
  sendAudio(audioData: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('[Realtime API] WebSocket not ready, dropping audio');
      return;
    }

    const event = {
      type: 'input_audio_buffer.append',
      audio: audioData.toString('base64')
    };

    this.send(event);
    logger.info(`[Realtime API] Sent ${audioData.length} bytes of audio`);
  }

  /**
   * Commit the audio buffer and request a response
   */
  commitAudio(): void {
    if (!this.ws) return;

    this.send({
      type: 'input_audio_buffer.commit'
    });

    this.send({
      type: 'response.create'
    });

    logger.info('Committed audio and requested response');
  }

  /**
   * Cancel the current response
   */
  cancelResponse(): void {
    if (!this.ws || !this.responseInProgress) return;

    this.send({
      type: 'response.cancel'
    });

    logger.info('Cancelled response');
  }

  /**
   * Send a text message (for hybrid mode)
   */
  sendText(text: string): void {
    if (!this.ws) return;

    // Add a user message to the conversation
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text
          }
        ]
      }
    });

    // Request a response
    this.send({
      type: 'response.create'
    });
  }

  /**
   * Register a function call handler
   */
  onFunctionCall(handler: FunctionCallHandler): void {
    this.functionCallHandler = handler;
  }

  /**
   * Handle server events
   */
  private handleServerEvent(event: any): void {
    logger.info(`[Realtime API] Received event: ${event.type}`);

    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        this.conversationId = event.session?.id;
        this.emit('session', event.session);
        break;

      case 'input_audio_buffer.speech_started':
        logger.info('User started speaking');
        this.emit('speech_started');
        break;

      case 'input_audio_buffer.speech_stopped':
        logger.info('User stopped speaking');
        this.emit('speech_stopped');
        break;

      case 'input_audio_buffer.committed':
        this.emit('audio_committed');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        logger.info(`Transcription: ${event.transcript}`);
        this.emit('transcription', event.transcript);
        break;

      case 'response.created':
        this.responseInProgress = true;
        this.emit('response_started');
        break;

      case 'response.output_item.added':
        // New output item (audio or text)
        break;

      case 'response.audio.delta':
        // Audio chunk from the assistant
        const audioBuffer = Buffer.from(event.delta, 'base64');
        this.emit('audio', audioBuffer);
        break;

      case 'response.audio_transcript.delta':
        // Transcript of what the assistant is saying
        this.emit('assistant_transcript_delta', event.delta);
        break;

      case 'response.audio.done':
        // Audio response complete
        this.emit('audio_done');
        break;

      case 'response.function_call_arguments.delta':
        // Function call in progress
        this.emit('function_call_delta', event);
        break;

      case 'response.function_call_arguments.done':
        // Function call complete
        this.handleFunctionCall(event);
        break;

      case 'response.done':
        this.responseInProgress = false;
        this.emit('response_done', event.response);
        break;

      case 'error':
        logger.error('Realtime API error', event.error);
        this.emit('error', event.error);
        break;

      case 'rate_limits.updated':
        // Rate limit info
        break;

      default:
        logger.info(`[Realtime API] Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle function call from the assistant
   */
  private async handleFunctionCall(event: any): Promise<void> {
    const callId = event.call_id;
    const name = event.name;
    const args = JSON.parse(event.arguments);

    logger.info(`Function call: ${name}`, args);
    this.emit('function_call', { name, args });

    if (!this.functionCallHandler) {
      logger.warn('No function call handler registered');
      return;
    }

    try {
      // Execute the function
      const result = await this.functionCallHandler(name, args);

      // Send the result back to the API
      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(result)
        }
      });

      // Request a new response with the function result
      this.send({
        type: 'response.create'
      });

      logger.info('Function call result sent');
    } catch (error) {
      logger.error('Function call failed', error);

      // Send error back to the API
      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      });
    }
  }

  /**
   * Send an event to the API
   */
  private send(event: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send event, WebSocket not ready');
      return;
    }

    this.ws.send(JSON.stringify(event));
  }

  /**
   * Attempt to reconnect to the API with exponential backoff
   */
  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000); // Max 10 seconds

    logger.info(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
        this.reconnectAttempts = 0; // Reset on successful connection
        logger.info('Successfully reconnected to Realtime API');
        this.emit('reconnected');
      } catch (error) {
        logger.error(`Reconnection attempt ${this.reconnectAttempts} failed`, error);
      }
    }, delay);
  }

  /**
   * Disconnect from the API
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
