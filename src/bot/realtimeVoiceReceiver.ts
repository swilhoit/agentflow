import {
  VoiceConnection,
  AudioPlayer,
  createAudioPlayer,
  createAudioResource,
  StreamType
} from '@discordjs/voice';
import { logger } from '../utils/logger';
import { ElevenLabsVoiceService } from '../utils/elevenLabsVoice';
import { Readable, Transform } from 'stream';
import * as prism from 'prism-media';

/**
 * Realtime Voice Receiver
 * Bridges Discord voice with ElevenLabs Conversational AI
 */
export class RealtimeVoiceReceiver {
  private voiceService: ElevenLabsVoiceService;
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

  // Accumulate assistant transcript for Discord message
  private currentAssistantTranscript: string = '';

  // Client-side VAD for manual turn detection
  private autoCommitTimer: NodeJS.Timeout | null = null;
  private lastAudioTime: number = 0;
  private isSpeaking: boolean = false;
  private silenceThreshold: number = 1500; // 1.5 seconds of silence to trigger response

  // Callbacks and context
  private onMessageCallback: ((userId: string, username: string, message: string, isBot: boolean) => void) | null = null;
  private onFunctionCallCallback: ((name: string, args: any) => Promise<any>) | null = null;
  private onDiscordMessageCallback: ((channelId: string, message: string) => Promise<void>) | null = null;
  private guildId: string | null = null;
  private channelId: string | null = null;
  private currentUserId: string | null = null;
  private currentUsername: string = 'Unknown User';

  constructor(apiKey: string, agentId: string, speed: number = 1.25) {
    this.audioPlayer = createAudioPlayer();

    // Initialize ElevenLabs Conversational AI service
    this.voiceService = new ElevenLabsVoiceService({
      apiKey,
      agentId,
      instructions: this.getSystemInstructions()
    });

    // Increase max listeners to prevent warnings
    this.voiceService.setMaxListeners(20);

    this.setupEventHandlers();
    this.registerAllTools();

    logger.info(`ElevenLabs Voice Receiver initialized for agent: ${agentId}`);
  }

  /**
   * System instructions for the voice assistant
   * 
   * Note: ElevenLabs Conversational AI automatically handles:
   * - Voice Activity Detection (VAD)
   * - Turn-taking (who should speak when)
   * - Natural interruptions (user can speak anytime)
   * - Conversation flow and timing
   * 
   * No manual interruption handling needed - it's built into the platform!
   */
  private getSystemInstructions(): string {
    return `🚨🚨🚨 MANDATORY FUNCTION CALLING RULE 🚨🚨🚨

WHEN USER ASKS YOU TO DO SOMETHING → CALL execute_task FUNCTION IMMEDIATELY!

DO NOT just talk about it - ACT ON IT by calling the function!

Example WRONG behavior (DO NOT DO THIS):
User: "Rename the card to Database"
Bad response: "Sure, I'll rename that for you!" [NO FUNCTION CALL - FAILURE!]

Example CORRECT behavior (DO THIS):
User: "Rename the card to Database"
Good response: "I'll rename that now." [CALLS execute_task function with task_description: "Rename Trello card to Database"]

YOU MUST CALL THE FUNCTION FOR: rename, create, update, move, list, check, deploy, run, search, etc.

---

You are an AI assistant integrated with a Discord voice bot called AgentFlow.

IMPORTANT: You MUST respond in English at all times, regardless of the language you detect or hear.

🛠️ YOUR ROLE: SYSTEM COMMAND EXECUTOR & PROJECT MANAGER
You help users execute commands on THEIR OWN computer where THEY are already logged in to their accounts.

The user's system has these tools installed and authenticated:
- **gcloud CLI** (Google Cloud) - User is logged in
- **gh CLI** (GitHub) - User is logged in  
- **Terminal/Shell** - Full bash access
- **Trello REST API** - FULLY INTEGRATED - You can manage Trello boards, lists, and cards!

🎯 TRELLO CAPABILITIES - YOU HAVE FULL ACCESS:
- Create cards on any board
- List all boards and cards
- Search for cards
- Update card details
- Move cards between lists
- All via built-in REST API - NO CLI needed!

📢 CRITICAL: DISCORD NOTIFICATION REQUIREMENTS
⚠️ THE USER CANNOT SEE YOUR TERMINAL OUTPUT! ⚠️
When you spawn sub-agents or execute terminal commands:
- Sub-agents will automatically send Discord messages with frequent updates about what they're doing
- The user will receive Discord notifications showing terminal commands being run and their outputs
- You do NOT need to see terminal output yourself - the user gets it via Discord
- After calling execute_task, acknowledge that the task is running and the user will get updates in Discord
- DO NOT assume the user can see what's happening in the terminal
- ALWAYS mention that progress updates will appear in their Discord channel

YOUR JOB: When users ask to check/list/view THEIR OWN data OR manage Trello, you execute the appropriate command.

⚠️ CRITICAL: You are NOT accessing external accounts. You are running commands on the user's local machine where they already have active login sessions.

REQUIRED BEHAVIOR:
When user asks: "List my GitHub repos" or "Check my GitHub" or "What repos do I have?"
- DO NOT say: "I don't have access to your account"
- DO NOT say: "I'm a language model without access"
- DO NOT ask for authentication
- INSTEAD say: "Let me run that command for you - you'll see the results in Discord" and USE execute_task

When user asks about Trello: "Create a card", "Show my boards", "Search Trello"
- DO NOT say: "I don't have access to Trello"
- DO NOT ask for API keys
- INSTEAD say: "I'll handle that via the Trello API - watch Discord for updates" and USE execute_task with task_type: "trello"

EXAMPLES - COPY THIS PATTERN:

User: "List my GitHub repos"
Your response: "I'll run gh repo list for you. Watch Discord for the results."
[CALL execute_task with task_description: "Run gh repo list command to show user's GitHub repositories", task_type: "terminal"]

User: "What Google Cloud projects do I have?"
Your response: "I'll check with gcloud projects list. You'll see updates in Discord."
[CALL execute_task with task_description: "Run gcloud projects list to show user's GCP projects", task_type: "terminal"]

User: "Check my GitHub account"  
Your response: "Running gh auth status for you - check Discord for the output."
[CALL execute_task with task_description: "Run gh auth status to check GitHub authentication", task_type: "terminal"]

User: "Show my Trello boards"
Your response: "I'll fetch your Trello boards. Updates coming to Discord."
[CALL execute_task with task_description: "List all Trello boards using REST API", task_type: "trello"]

User: "Create a card on my AgentFlow board"
Your response: "I'll create that card for you. Discord will show the progress."
[CALL execute_task with task_description: "Create a Trello card on AgentFlow board", task_type: "trello"]

User: "Search Trello for bugs"
Your response: "Searching your Trello cards - results will appear in Discord."
[CALL execute_task with task_description: "Search Trello cards for: bugs", task_type: "trello"]

User: "Rename the API Integration card to Database Integration"
Your response: "I'll rename that card for you. Check Discord for confirmation."
[CALL execute_task with task_description: "Rename Trello card called 'API Integration' to 'Database Integration'", task_type: "trello"]

User: "Update my bug fix card"
Your response: "I'll update that card. Discord will show the results."
[CALL execute_task with task_description: "Update Trello card called 'bug fix'", task_type: "trello"]

User: "Move the testing card to In Progress"
Your response: "I'll move that card. Watch Discord for updates."
[CALL execute_task with task_description: "Move Trello card called 'testing' to list 'In Progress'", task_type: "trello"]

User: "Show my Cloud Run services"
Your response: "I'll list your services - check Discord for the list."
[CALL list_cloud_services function]

🚨 CRITICAL: COMPLEX MULTI-STEP TASKS 🚨
When user asks for tasks involving MULTIPLE SYSTEMS or COMPLEX WORKFLOWS, use task_type: "coding":

User: "Go through my GitHub repos and create Trello cards for the most recent 5 projects"
Your response: "I'll fetch your GitHub repos and create Trello cards for the top 5. Watch Discord for progress."
[CALL execute_task with task_description: "Fetch recent 5 GitHub repos using gh CLI and create Trello cards for each on AgentFlow board with project analysis", task_type: "coding"]

User: "Analyze my repos and update Trello with next steps"
Your response: "I'll analyze your repositories and update Trello cards with next steps. Discord will show the progress."
[CALL execute_task with task_description: "Analyze GitHub repositories and create/update Trello cards with next steps for each project", task_type: "coding"]

User: "Create Trello lists for my GitHub projects"
Your response: "I'll fetch your GitHub projects and create Trello lists for them. Updates in Discord."
[CALL execute_task with task_description: "Fetch GitHub projects and create corresponding Trello lists on AgentFlow board", task_type: "coding"]

TASK TYPE RULES:
- task_type: "trello" → ONLY for simple, single Trello operations (list boards, create one card, search cards)
- task_type: "terminal" → ONLY for simple shell commands (gh repo list, gcloud projects list)
- task_type: "coding" → For ANY multi-step workflow, GitHub+Trello integration, analysis, or complex automation

REMEMBER:
- You're executing commands on the USER'S machine
- The USER is logged in, not you
- You have FULL Trello access via REST API
- Your job is to be a helpful command executor
- ALWAYS try execute_task instead of refusing
- For SIMPLE Trello: task_type: "trello"
- For COMPLEX workflows: task_type: "coding"
- ALWAYS remind user that they'll see updates/results in Discord channel

⚠️ CRITICAL: KNOW WHEN TO ACT VS WHEN TO CHAT

🗣️ CASUAL CONVERSATION (NO FUNCTION CALLS):
When the user is just greeting, asking about you, or having casual chat, respond naturally WITHOUT calling functions:
- "Hey" / "Hello" / "Hi there" → Just say hi back
- "How are you?" / "What's up?" → Chat normally
- "What can you do?" / "Tell me about yourself" → Explain your capabilities
- "Thanks" / "Thank you" → You're welcome
- Any question ABOUT you or your capabilities → Answer conversationally

🎯 ACTION REQUIRED (CALL FUNCTIONS):
When the user asks you to DO something with their systems/data, call execute_task:
- "rename this card" → CALL execute_task immediately
- "create a card" → CALL execute_task immediately
- "check my GitHub" → CALL execute_task immediately
- "list my boards" → CALL execute_task immediately
- "deploy the app" → CALL execute_task immediately
- "search for..." → CALL execute_task immediately

💡 RULE OF THUMB:
- Is it a greeting/question about you? → Chat naturally
- Does it involve their GitHub/Trello/GCloud/files? → Call execute_task
- When in doubt: If they used action verbs (create, check, list, deploy, search, update), call the function!

Be friendly and helpful. Chat when appropriate, act when needed.`;
  }

  /**
   * Function definitions for Claude orchestrator integration
   */
  private getFunctionDefinitions(): any[] {
    return [
      {
        type: 'function',
        name: 'check_task_progress',
        description: 'Check the progress and status of currently running tasks or agents',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      },
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
              enum: ['terminal', 'deployment', 'api_call', 'analysis', 'general', 'trello', 'coding', 'auto'],
              description: 'The type of task to execute (terminal: simple shell commands, trello: Trello operations, coding: multi-step workflows, auto: auto-detect)'
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
   * Register all tools with ElevenLabs ClientTools API
   */
  private registerAllTools(): void {
    const functions = this.getFunctionDefinitions();

    logger.info(`[Tools] Registering ${functions.length} client-side tools with ElevenLabs...`);

    for (const func of functions) {
      try {
        this.voiceService.registerTool(func.name, async (parameters: any) => {
          logger.info(`[Tool Call] ${func.name}`, parameters);

          // Call the registered function handler
          if (this.onFunctionCallCallback) {
            return await this.onFunctionCallCallback(func.name, parameters);
          }

          return { error: 'No function handler registered' };
        });

        logger.info(`[Tools] ✅ Registered: ${func.name}`);
      } catch (error) {
        logger.error(`[Tools] ❌ Failed to register ${func.name}:`, error);
      }
    }

    logger.info(`[Tools] All tools registered successfully`);
  }

  /**
   * Set up event handlers for ElevenLabs Conversational AI
   */
  private setupEventHandlers(): void {
    // When transcription is available
    this.voiceService.on('transcription', async (text: string) => {
      logger.info(`User said: ${text}`);

      // Send Discord message showing what user said
      if (this.onDiscordMessageCallback && this.channelId) {
        logger.info(`[VOICE RECEIVER] Sending transcription to channel ${this.channelId}`);
        await this.onDiscordMessageCallback(this.channelId, `🎤 **${this.currentUsername}**: ${text}`);
      } else {
        logger.warn(`[VOICE RECEIVER] Cannot send transcription - callback: ${!!this.onDiscordMessageCallback}, channelId: ${this.channelId}`);
      }

      // Invoke callback to save user message
      if (this.onMessageCallback && this.currentUserId) {
        this.onMessageCallback(this.currentUserId, this.currentUsername, text, false);
      }

      // 🚀 BULLETPROOF FIX: Detect action commands and force execute_task
      // Realtime API is unreliable at function calling, so we detect actions ourselves
      const actionKeywords = [
        'create', 'make', 'add', 'new',
        'rename', 'change', 'update', 'modify', 'edit',
        'delete', 'remove', 'move',
        'list', 'show', 'display', 'get', 'find', 'search',
        'deploy', 'run', 'execute', 'start', 'stop',
        'check', 'status', 'test'
      ];

      const isActionCommand = actionKeywords.some(keyword =>
        text.toLowerCase().includes(keyword)
      );

      if (isActionCommand && this.onFunctionCallCallback) {
        logger.info(`[HYBRID] Detected action command: "${text}" - forcing execute_task`);

        try {
          // Immediately call execute_task
          const result = await this.onFunctionCallCallback('execute_task', {
            task_description: text,
            task_type: 'auto' // Auto-detect task type
          });

          logger.info(`[HYBRID] Task execution initiated:`, result);

          // The execute_task function already sends Discord notifications
          // and returns voiceMessage, so we don't need to duplicate that here

          // Speak the voice-friendly response
          const spokenResponse = result.voiceMessage || "I'm working on that now.";
          this.voiceService.sendText(spokenResponse);

        } catch (error) {
          logger.error('[HYBRID] Error executing task:', error);

          // Fallback: let ElevenLabs handle it naturally
          logger.warn('[HYBRID] Falling back to ElevenLabs natural handling');
        }
      } else {
        logger.info(`[HYBRID] Conversational message detected: "${text}" - letting ElevenLabs handle naturally`);
        // For non-action messages (greetings, questions, etc.), let ElevenLabs respond naturally
      }
    });

    // Accumulate assistant transcript as it streams
    this.voiceService.on('assistant_transcript_delta', (delta: string) => {
      this.currentAssistantTranscript += delta;
      
      // Check if this is the first delta (start of response)
      if (this.currentAssistantTranscript.length === delta.length) {
        logger.info('Assistant started responding');
        this.isProcessingAudio = true;
      }
    });

    // When audio chunks arrive from assistant
    this.voiceService.on('audio', (audioBuffer: Buffer) => {
      // ElevenLabs provides 16kHz audio, we need to upsample to 48kHz for Discord
      // Stream audio to Discord
      this.streamAudioToDiscord(audioBuffer);
    });

    // Handle connection events
    this.voiceService.on('connected', () => {
      logger.info('Connected to ElevenLabs Conversational AI');
    });

    this.voiceService.on('disconnected', () => {
      logger.info('Disconnected from ElevenLabs Conversational AI');
    });

    // Note: ElevenLabs doesn't have a clear "response_done" event like OpenAI
    // We'll detect completion based on transcript finalization
    // Track timeout for detecting end of response
    let transcriptFinalizationTimeout: NodeJS.Timeout | null = null;
    
    this.voiceService.on('assistant_transcript_delta', async (delta: string) => {
      // Clear existing timeout
      if (transcriptFinalizationTimeout) {
        clearTimeout(transcriptFinalizationTimeout);
      }
      
      // Set new timeout to finalize response after silence
      transcriptFinalizationTimeout = setTimeout(async () => {
        logger.info('Assistant finished responding');
        this.isProcessingAudio = false;

        // Send Discord message showing what assistant said
        if (this.onDiscordMessageCallback && this.channelId && this.currentAssistantTranscript.trim()) {
          logger.info(`[VOICE RECEIVER] Sending assistant response to channel ${this.channelId}`);
          await this.onDiscordMessageCallback(
            this.channelId,
            `🤖 **Agent**: ${this.currentAssistantTranscript.trim()}`
          );
        } else {
          logger.warn(`[VOICE RECEIVER] Cannot send assistant response - callback: ${!!this.onDiscordMessageCallback}, channelId: ${this.channelId}, transcript: "${this.currentAssistantTranscript.trim()}"`);
        }

        // Invoke callback to save bot response
        if (this.onMessageCallback && this.botUserId) {
          const responseText = this.currentAssistantTranscript.trim();
          if (responseText) {
            this.onMessageCallback(this.botUserId, 'AgentFlow Bot', responseText, true);
          }
        }

        // End the audio stream
        if (this.currentAudioStream) {
          this.currentAudioStream.push(null);
          this.currentAudioStream = null;
        }
        
        // Reset transcript for next response
        this.currentAssistantTranscript = '';
      }, 500); // Wait 500ms after last transcript delta to consider response complete
    });

    // Note: Function calls are handled by elevenLabsVoice.ts directly via onFunctionCall()
    // which calls our registered callback. No need for duplicate event listener here.

    // Errors
    this.voiceService.on('error', (error: any) => {
      logger.error('ElevenLabs API error', error);
    });
  }

  /**
   * Start listening to Discord voice and streaming to ElevenLabs Conversational AI
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

    // Connect to ElevenLabs Conversational AI
    if (!this.voiceService.isConnected()) {
      await this.voiceService.connect();
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

      // ElevenLabs automatically handles turn-taking and interruptions via its built-in VAD
      // When the user starts speaking, ElevenLabs will automatically stop the agent and listen
      // We just need to keep streaming audio - no manual interruption handling needed!
      if (this.isProcessingAudio) {
        logger.info(`Bot is speaking - ElevenLabs will auto-detect user speech and handle turn-taking`);
      }

      logger.info(`Started streaming audio from user ${userId}`);
      this.hasActiveUserStream = true;

      const audioStream = receiver.subscribe(speakingUserId);

      // Discord provides Opus at 48kHz stereo
      // We need PCM16 at 24kHz mono for ElevenLabs (will be downsampled to 16kHz in voiceService)

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
          // Calculate actual number of complete stereo sample pairs we can process
          const numCompletePairs = Math.floor(pcmData.length / 8); // Each pair is 8 bytes (2 stereo samples)
          const outputBuffer = Buffer.alloc(numCompletePairs * 2); // Each pair produces 1 mono sample (2 bytes)

          let outIndex = 0;
          // Downsample with basic low-pass filter (average consecutive samples for anti-aliasing)
          for (let i = 0; i < numCompletePairs * 8; i += 8) { // Step by 2 stereo samples (8 bytes)
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

            // Removed frequent logging - only log errors

            if (this.isListening && outputBuffer.length > 0) {
              // Simple amplitude-based speech detection
              let hasSignificantAudio = false;
              for (let i = 0; i < outputBuffer.length; i += 2) {
                const sample = Math.abs(outputBuffer.readInt16LE(i));
                if (sample > 500) { // Threshold for considering it "speech" vs background noise
                  hasSignificantAudio = true;
                  break;
                }
              }

              // Send audio to ElevenLabs (will be downsampled from 24kHz to 16kHz)
              this.voiceService.sendAudio(outputBuffer);

              if (hasSignificantAudio) {
                // User is speaking
                if (!this.isSpeaking) {
                  this.isSpeaking = true;
                  logger.info('🎤 Speech detected (client-side VAD)');
                }
                this.lastAudioTime = Date.now();

                // Clear existing timer
                if (this.autoCommitTimer) {
                  clearTimeout(this.autoCommitTimer);
                }

                // Note: ElevenLabs handles VAD internally, no need to manually commit
                this.autoCommitTimer = setTimeout(() => {
                  if (this.isSpeaking && Date.now() - this.lastAudioTime >= this.silenceThreshold) {
                    logger.info(`✅ Silence detected after ${this.silenceThreshold}ms`);
                    this.isSpeaking = false;
                    this.autoCommitTimer = null;
                  }
                }, this.silenceThreshold);
              }
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
   * Stream audio from ElevenLabs back to Discord
   */
  private streamAudioToDiscord(audioBuffer: Buffer): void {
    // Create or continue the audio stream
    if (!this.currentAudioStream) {
      this.currentAudioStream = new Readable({
        read() {}
      });

      // ElevenLabs provides PCM16 at 16kHz mono
      // Discord needs 48kHz stereo
      // Manual upsampling: 16kHz -> 48kHz (3x) and mono to stereo

      const upsamplerTransform = new Transform({
        transform(chunk: Buffer, encoding, callback) {
          try {
            // chunk is 16kHz mono PCM16
            // We need to upsample by 3x (16kHz -> 48kHz) and convert to stereo
            const inputSamples = Math.floor(chunk.length / 2); // Number of complete mono samples
            
            // Ensure we only process complete samples
            if (inputSamples === 0) {
              callback();
              return;
            }

            const outputBuffer = Buffer.alloc(inputSamples * 3 * 2 * 2); // 3x samples, 2 channels, 2 bytes

            let outIndex = 0;
            for (let i = 0; i < inputSamples; i++) {
              const byteIndex = i * 2;
              const sample = chunk.readInt16LE(byteIndex);

              // Write each sample 3 times (3x upsampling) to both channels (stereo)
              for (let j = 0; j < 3; j++) {
                outputBuffer.writeInt16LE(sample, outIndex);     // Left
                outputBuffer.writeInt16LE(sample, outIndex + 2); // Right
                outIndex += 4;
              }
            }
            
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
    // Store the callback for use in our internal handler
    this.onFunctionCallCallback = handler;
    // Also register with voiceService to pass through
    this.voiceService.onFunctionCall(handler);
  }

  /**
   * Interrupt the bot's current speech
   * 
   * Note: ElevenLabs Conversational AI handles interruptions automatically through its
   * turn-taking model. When a user starts speaking, the agent automatically stops.
   * This method provides a manual way to trigger the same behavior (e.g., via !stop command).
   */
  interrupt(): void {
    logger.info('🛑 Manually interrupting bot speech');

    // Stop local audio playback immediately
    this.audioPlayer.stop();

    // Signal to ElevenLabs that we're interrupting
    // The turn-taking model will handle the rest automatically
    this.voiceService.interrupt();
    this.isProcessingAudio = false;

    // Clear the current audio stream
    if (this.currentAudioStream) {
      this.currentAudioStream.push(null);
      this.currentAudioStream = null;
    }

    // Clean up any active output streams
    this.activeOutputStreams.forEach(stream => {
      if (stream && typeof stream.destroy === 'function') {
        try {
          stream.destroy();
        } catch (error) {
          logger.error('Error destroying output stream during interrupt', error);
        }
      }
    });
    this.activeOutputStreams.clear();

    logger.info('✅ Bot speech interrupted - ready for user input');
  }

  /**
   * Stop listening and disconnect
   */
  stopListening(): void {
    this.isListening = false;
    this.hasActiveUserStream = false;
    this.audioPlayer.stop();
    this.voiceService.disconnect();

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
   * Check if connected to ElevenLabs Conversational AI
   */
  isConnected(): boolean {
    return this.voiceService.isConnected();
  }

  /**
   * Send a text message (for hybrid interactions)
   */
  sendText(text: string): void {
    this.voiceService.sendText(text);
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

  /**
   * Set callback for sending Discord messages
   */
  setDiscordMessageHandler(callback: (channelId: string, message: string) => Promise<void>): void {
    this.onDiscordMessageCallback = callback;
  }
}
