import {
  VoiceConnection,
  AudioPlayer,
  createAudioPlayer,
  createAudioResource,
  StreamType
} from '@discordjs/voice';
import { logger } from '../utils/logger';
import { RealtimeVoiceService } from '../utils/realtimeVoice';
import { Readable, Transform } from 'stream';
import * as prism from 'prism-media';

/**
 * Realtime Voice Receiver
 * Bridges Discord voice with OpenAI Realtime API
 */
export class RealtimeVoiceReceiver {
  private realtimeService: RealtimeVoiceService;
  private audioPlayer: AudioPlayer;
  private currentAudioStream: Readable | null = null;
  private isProcessingAudio: boolean = false;
  private isListening: boolean = false;
  private botUserId: string | null = null;
  private currentConnection: VoiceConnection | null = null;

  // Track active streams for cleanup
  private activeInputStreams: Set<any> = new Set();
  private activeOutputStreams: Set<any> = new Set();

  // Track if we already have an active audio subscription for the user
  private hasActiveUserStream: boolean = false;

  // Callbacks and context
  private onMessageCallback: ((userId: string, username: string, message: string, isBot: boolean) => void) | null = null;
  private guildId: string | null = null;
  private channelId: string | null = null;
  private currentUserId: string | null = null;
  private currentUsername: string = 'Unknown User';

  constructor(apiKey: string) {
    this.audioPlayer = createAudioPlayer();

    // Initialize Realtime API service with function calling enabled
    this.realtimeService = new RealtimeVoiceService({
      apiKey,
      voice: 'alloy',
      instructions: this.getSystemInstructions(),
      tools: this.getFunctionDefinitions()
    });

    // Increase max listeners for the Realtime service to prevent warnings
    this.realtimeService.setMaxListeners(20);

    this.setupEventHandlers();
  }

  /**
   * System instructions for the voice assistant
   */
  private getSystemInstructions(): string {
    return `You are an AI assistant integrated with a Discord voice bot called AgentFlow.

IMPORTANT: You MUST respond in English at all times, regardless of the language you detect or hear.

You can have natural conversations AND execute complex tasks. When users ask you to:
- Deploy code or applications
- Run terminal commands
- Analyze data or files
- Make API calls
- Perform multi-step operations

Use the "execute_task" function to delegate these to the specialized orchestrator.

For simple questions and conversation, respond directly with brief, natural voice responses. Keep answers concise since this is voice chat - aim for 1-3 sentences unless more detail is requested.

Be friendly, helpful, and conversational!`;
  }

  /**
   * Function definitions for Claude orchestrator integration
   */
  private getFunctionDefinitions(): any[] {
    return [
      {
        type: 'function',
        name: 'execute_task',
        description: 'Execute complex tasks like deployments, terminal commands, API calls, or multi-step operations using the Claude orchestrator',
        parameters: {
          type: 'object',
          properties: {
            task_description: {
              type: 'string',
              description: 'Clear description of the task to execute'
            },
            task_type: {
              type: 'string',
              enum: ['terminal', 'deployment', 'api_call', 'analysis', 'general'],
              description: 'The type of task to execute'
            },
            parameters: {
              type: 'object',
              description: 'Any additional parameters needed for the task',
              additionalProperties: true
            }
          },
          required: ['task_description', 'task_type']
        }
      },
      {
        type: 'function',
        name: 'deploy_to_cloud_run',
        description: 'Deploy a Docker container to Google Cloud Run with Claude Code CLI pre-installed',
        parameters: {
          type: 'object',
          properties: {
            service_name: {
              type: 'string',
              description: 'Name for the Cloud Run service (e.g., "my-api-server")'
            },
            image_name: {
              type: 'string',
              description: 'Name for the Docker image (e.g., "my-app")'
            },
            build_context: {
              type: 'string',
              description: 'Path to the build context directory (defaults to ".")'
            },
            env_vars: {
              type: 'object',
              description: 'Environment variables to set in the container',
              additionalProperties: { type: 'string' }
            }
          },
          required: ['service_name', 'image_name']
        }
      },
      {
        type: 'function',
        name: 'list_cloud_services',
        description: 'List all running Cloud Run services in the project'
      },
      {
        type: 'function',
        name: 'get_service_logs',
        description: 'Get recent logs from a Cloud Run service',
        parameters: {
          type: 'object',
          properties: {
            service_name: {
              type: 'string',
              description: 'Name of the service to get logs from'
            },
            limit: {
              type: 'number',
              description: 'Number of log entries to retrieve (default: 50)'
            }
          },
          required: ['service_name']
        }
      },
      {
        type: 'function',
        name: 'delete_cloud_service',
        description: 'Delete a Cloud Run service',
        parameters: {
          type: 'object',
          properties: {
            service_name: {
              type: 'string',
              description: 'Name of the service to delete'
            }
          },
          required: ['service_name']
        }
      },
      {
        type: 'function',
        name: 'spawn_autonomous_agent',
        description: 'Spawn an advanced autonomous AI coding agent with full Claude Code capabilities, terminal monitoring, multi-step reasoning, testing, and debugging. Use this for complex coding tasks that require autonomy.',
        parameters: {
          type: 'object',
          properties: {
            task_description: {
              type: 'string',
              description: 'Detailed description of what the agent should accomplish'
            },
            context_files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional list of files to provide as context'
            },
            requirements: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional list of specific requirements or constraints'
            },
            max_iterations: {
              type: 'number',
              description: 'Maximum number of execution iterations (default: 20)'
            },
            working_directory: {
              type: 'string',
              description: 'Working directory for the agent (defaults to current directory)'
            }
          },
          required: ['task_description']
        }
      },
      {
        type: 'function',
        name: 'get_agent_status',
        description: 'Get the current status of a running autonomous agent',
        parameters: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'The session ID of the agent to check'
            }
          },
          required: ['agent_id']
        }
      },
      {
        type: 'function',
        name: 'get_agent_result',
        description: 'Get the final result of a completed autonomous agent task',
        parameters: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'The session ID of the agent'
            }
          },
          required: ['agent_id']
        }
      }
    ];
  }

  /**
   * Set up event handlers for Realtime API
   */
  private setupEventHandlers(): void {
    // When user starts speaking
    this.realtimeService.on('speech_started', () => {
      logger.info('User started speaking (VAD detected)');

      // Cancel any ongoing response
      if (this.currentAudioStream) {
        this.audioPlayer.stop();
        this.realtimeService.cancelResponse();
      }
    });

    // When user stops speaking
    this.realtimeService.on('speech_stopped', () => {
      logger.info('User stopped speaking (VAD detected)');
    });

    // When transcription is available
    this.realtimeService.on('transcription', (text: string) => {
      logger.info(`User said: ${text}`);

      // Invoke callback to save user message
      if (this.onMessageCallback && this.currentUserId) {
        this.onMessageCallback(this.currentUserId, this.currentUsername, text, false);
      }
    });

    // When assistant starts responding
    this.realtimeService.on('response_started', () => {
      logger.info('Assistant started responding');
      this.isProcessingAudio = true;
    });

    // When audio chunks arrive from assistant
    this.realtimeService.on('audio', (audioBuffer: Buffer) => {
      // Stream audio to Discord
      this.streamAudioToDiscord(audioBuffer);
    });

    // When assistant finishes responding
    this.realtimeService.on('response_done', (response: any) => {
      logger.info('Assistant finished responding');
      this.isProcessingAudio = false;

      // Invoke callback to save bot response
      if (this.onMessageCallback && this.botUserId && response?.output) {
        const responseText = Array.isArray(response.output)
          ? response.output.map((item: any) => item.content || item.text || '').join(' ')
          : (response.output.content || response.output.text || '');

        if (responseText) {
          this.onMessageCallback(this.botUserId, 'AgentFlow Bot', responseText, true);
        }
      }

      // End the audio stream
      if (this.currentAudioStream) {
        this.currentAudioStream.push(null);
        this.currentAudioStream = null;
      }
    });

    // When function is called
    this.realtimeService.on('function_call', async ({ name, args }) => {
      logger.info(`Function called: ${name}`, args);
    });

    // Errors
    this.realtimeService.on('error', (error: any) => {
      logger.error('Realtime API error', error);
    });
  }

  /**
   * Start listening to Discord voice and streaming to Realtime API
   */
  async startListening(connection: VoiceConnection, userId: string, botUserId: string, username?: string): Promise<void> {
    if (this.isListening) {
      logger.warn('Already listening, ignoring duplicate request');
      return;
    }

    this.botUserId = botUserId;
    this.currentUserId = userId;
    this.currentUsername = username || 'Unknown User';
    this.isListening = true;
    this.currentConnection = connection;

    // Connect to Realtime API
    if (!this.realtimeService.isConnected()) {
      await this.realtimeService.connect();
    }

    // Subscribe the audio player to the connection
    connection.subscribe(this.audioPlayer);

    const receiver = connection.receiver;

    // Remove any existing listeners first to prevent duplicates
    receiver.speaking.removeAllListeners('start');

    // Listen for user speaking
    const speakingHandler = (speakingUserId: string) => {
      // Ignore if not the target user OR if it's the bot itself
      if (speakingUserId !== userId || speakingUserId === this.botUserId) {
        logger.info(`Ignoring audio from user ${speakingUserId} (target: ${userId}, bot: ${this.botUserId})`);
        return;
      }

      // Only create ONE audio stream per user session - don't create duplicates
      if (this.hasActiveUserStream) {
        logger.info(`Already have active audio stream for user ${userId}, skipping duplicate`);
        return;
      }

      // Allow user audio even during bot playback - Realtime API VAD will handle interruptions
      if (this.isProcessingAudio) {
        logger.info(`Bot is speaking but allowing user ${userId} audio for natural interruptions`);
      }

      logger.info(`Started streaming audio from user ${userId}`);
      this.hasActiveUserStream = true;

      const audioStream = receiver.subscribe(speakingUserId);

      // Discord provides Opus at 48kHz stereo
      // We need PCM16 at 24kHz mono for Realtime API

      // Step 1: Decode Opus to PCM 48kHz stereo
      const opusDecoder = new prism.opus.Decoder({
        frameSize: 960,
        channels: 2, // Stereo from Discord
        rate: 48000  // Discord's rate
      });

      // Track these streams for cleanup
      this.activeInputStreams.add(audioStream);
      this.activeInputStreams.add(opusDecoder);

      audioStream
        .pipe(opusDecoder);

      // Manual resampling: 48kHz stereo -> 24kHz mono with anti-aliasing
      // Each opus frame is 3840 bytes = 960 stereo samples (960 * 2 channels * 2 bytes)
      // We need to downsample by 2x and convert stereo to mono
      opusDecoder.on('data', (pcmData: Buffer) => {
        try {
          // pcmData is 48kHz stereo PCM16
          // 3840 bytes = 960 stereo samples
          // Output: 480 mono samples @ 24kHz = 960 bytes

          const numStereoSamples = pcmData.length / 4; // 3840/4 = 960 stereo samples
          const outputSamples = numStereoSamples / 2; // Downsample by 2x = 480 samples
          const outputBuffer = Buffer.alloc(outputSamples * 2); // 480 * 2 = 960 bytes

          let outIndex = 0;
          // Downsample with basic low-pass filter (average consecutive samples for anti-aliasing)
          for (let i = 0; i < pcmData.length - 8; i += 8) { // Step by 2 stereo samples (8 bytes)
            // Read two consecutive stereo samples for averaging (anti-aliasing filter)
            const left1 = pcmData.readInt16LE(i);
            const right1 = pcmData.readInt16LE(i + 2);
            const left2 = pcmData.readInt16LE(i + 4);
            const right2 = pcmData.readInt16LE(i + 6);

            // Average both samples and both channels (basic low-pass + stereo-to-mono)
            const mono = Math.floor((left1 + right1 + left2 + right2) / 4);
            outputBuffer.writeInt16LE(mono, outIndex);
            outIndex += 2;
          }

          logger.info(`[Audio Pipeline] Resampled: ${pcmData.length} bytes -> ${outputBuffer.length} bytes`);

          if (this.isListening) {
            this.realtimeService.sendAudio(outputBuffer);
          }
        } catch (error) {
          logger.error('[Audio Pipeline] Resampling error', error);
        }
      });

      opusDecoder.on('error', (error) => {
        logger.error('[Audio Pipeline] Opus decoder error', error);
      });

      audioStream.on('end', () => {
        logger.info('Audio stream ended');
        this.activeInputStreams.delete(audioStream);
        this.activeInputStreams.delete(opusDecoder);
        this.hasActiveUserStream = false;
      });
    };

    // Register the speaking handler
    receiver.speaking.on('start', speakingHandler);
  }

  /**
   * Clean up input stream and remove from tracking
   */
  private cleanupInputStream(...streams: any[]): void {
    streams.forEach(stream => {
      if (stream && typeof stream.destroy === 'function') {
        stream.destroy();
      }
      this.activeInputStreams.delete(stream);
    });
  }

  /**
   * Clean up output stream and remove from tracking
   */
  private cleanupOutputStream(...streams: any[]): void {
    streams.forEach(stream => {
      if (stream && typeof stream.destroy === 'function') {
        stream.destroy();
      }
      this.activeOutputStreams.delete(stream);
    });
  }

  /**
   * Stream audio from Realtime API back to Discord
   */
  private streamAudioToDiscord(audioBuffer: Buffer): void {
    // Create or continue the audio stream
    if (!this.currentAudioStream) {
      this.currentAudioStream = new Readable({
        read() {}
      });

      // Realtime API provides PCM16 at 24kHz mono
      // Discord needs 48kHz stereo
      // Manual upsampling: duplicate each sample (24kHz -> 48kHz) and duplicate to stereo

      const upsamplerTransform = new Transform({
        transform(chunk: Buffer, encoding, callback) {
          try {
            // chunk is 24kHz mono PCM16
            // We need to upsample by 2x and convert to stereo with linear interpolation
            const inputSamples = chunk.length / 2; // Number of mono samples
            const outputBuffer = Buffer.alloc(inputSamples * 2 * 2 * 2); // 2x samples, 2 channels, 2 bytes

            let outIndex = 0;
            for (let i = 0; i < chunk.length; i += 2) {
              const sample1 = chunk.readInt16LE(i);
              const sample2 = i + 2 < chunk.length ? chunk.readInt16LE(i + 2) : sample1;

              // Linear interpolation between samples for smoother upsampling
              const interpolated = Math.floor((sample1 + sample2) / 2);

              // Write original sample to both channels (stereo)
              outputBuffer.writeInt16LE(sample1, outIndex);     // Left original
              outputBuffer.writeInt16LE(sample1, outIndex + 2); // Right original

              // Write interpolated sample to both channels (stereo)
              outputBuffer.writeInt16LE(interpolated, outIndex + 4); // Left interpolated
              outputBuffer.writeInt16LE(interpolated, outIndex + 6); // Right interpolated
              outIndex += 8;
            }

            logger.info(`[Output Pipeline] Upsampled: ${chunk.length} bytes -> ${outputBuffer.length} bytes`);
            this.push(outputBuffer);
            callback();
          } catch (error) {
            logger.error('[Output Pipeline] Upsampling error', error);
            callback(error as Error);
          }
        }
      });

      // Encode upsampled PCM to Opus for Discord
      const opusEncoder = new prism.opus.Encoder({
        frameSize: 960,
        channels: 2,
        rate: 48000
      });

      // Track these streams for cleanup
      this.activeOutputStreams.add(this.currentAudioStream);
      this.activeOutputStreams.add(upsamplerTransform);
      this.activeOutputStreams.add(opusEncoder);

      this.currentAudioStream.pipe(upsamplerTransform);
      upsamplerTransform.pipe(opusEncoder);

      // Error handling
      upsamplerTransform.on('error', (error) => {
        logger.error('Upsampler error', error);
        this.cleanupOutputStream(this.currentAudioStream, upsamplerTransform, opusEncoder);
        this.currentAudioStream = null;
      });

      opusEncoder.on('error', (error) => {
        logger.error('Opus encoder error', error);
        this.cleanupOutputStream(this.currentAudioStream, upsamplerTransform, opusEncoder);
        this.currentAudioStream = null;
      });

      // Create audio resource from the encoded stream
      const resource = createAudioResource(opusEncoder, {
        inputType: StreamType.Opus,
        inlineVolume: true
      });

      resource.volume?.setVolume(1.0);

      // Play it
      this.audioPlayer.play(resource);
      logger.info('Started playing assistant audio');
    }

    // Push audio data to the stream
    this.currentAudioStream.push(audioBuffer);
  }

  /**
   * Register handler for function calls (to integrate with Claude orchestrator)
   */
  onFunctionCall(handler: (name: string, args: any) => Promise<any>): void {
    this.realtimeService.onFunctionCall(handler);
  }

  /**
   * Stop listening and disconnect
   */
  stopListening(): void {
    this.isListening = false;
    this.hasActiveUserStream = false;
    this.audioPlayer.stop();
    this.realtimeService.disconnect();

    if (this.currentAudioStream) {
      this.currentAudioStream.push(null);
      this.currentAudioStream = null;
    }

    // Clean up all active streams
    logger.info(`Cleaning up ${this.activeInputStreams.size} input streams and ${this.activeOutputStreams.size} output streams`);

    this.activeInputStreams.forEach(stream => {
      if (stream && typeof stream.destroy === 'function') {
        try {
          stream.destroy();
        } catch (error) {
          logger.error('Error destroying input stream', error);
        }
      }
    });
    this.activeInputStreams.clear();

    this.activeOutputStreams.forEach(stream => {
      if (stream && typeof stream.destroy === 'function') {
        try {
          stream.destroy();
        } catch (error) {
          logger.error('Error destroying output stream', error);
        }
      }
    });
    this.activeOutputStreams.clear();

    // Clean up event listeners to prevent memory leaks
    if (this.currentConnection) {
      const receiver = this.currentConnection.receiver;
      receiver.speaking.removeAllListeners('start');
      this.currentConnection = null;
    }

    logger.info('Stopped listening and cleaned up all resources');
  }

  /**
   * Check if connected to Realtime API
   */
  isConnected(): boolean {
    return this.realtimeService.isConnected();
  }

  /**
   * Send a text message (for hybrid interactions)
   */
  sendText(text: string): void {
    this.realtimeService.sendText(text);
  }

  /**
   * Set callback for message transcriptions
   */
  onMessage(callback: (userId: string, username: string, message: string, isBot: boolean) => void): void {
    this.onMessageCallback = callback;
  }

  /**
   * Set guild and channel context for message logging
   */
  setContext(guildId: string, channelId: string): void {
    this.guildId = guildId;
    this.channelId = channelId;
  }
}
