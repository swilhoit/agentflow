import {
  Client,
  GatewayIntentBits,
  VoiceState,
  Message
} from 'discord.js';
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection
} from '@discordjs/voice';
import { BotConfig } from '../types';
import { logger } from '../utils/logger';
import { RealtimeVoiceReceiver } from './realtimeVoiceReceiver';
import { CloudDeploymentService } from '../services/cloudDeployment';
import { SubAgentManager } from '../agents/subAgentManager';

/**
 * Discord Bot with OpenAI Realtime API Integration
 * Provides natural voice conversations with sub-second latency
 */
export class DiscordBotRealtime {
  private client: Client;
  private config: BotConfig;
  private realtimeReceivers: Map<string, RealtimeVoiceReceiver> = new Map();
  private orchestratorUrl: string;
  private orchestratorApiKey: string;
  private cloudDeployment: CloudDeploymentService;
  private subAgentManager: SubAgentManager;

  constructor(config: BotConfig) {
    this.config = config;
    this.orchestratorUrl = config.orchestratorUrl;
    this.orchestratorApiKey = config.orchestratorApiKey;

    // Initialize Cloud Deployment Service
    const gcpProjectId = process.env.GCP_PROJECT_ID || 'agentflow-discord-bot';
    const gcpRegion = process.env.GCP_REGION || 'us-central1';
    this.cloudDeployment = new CloudDeploymentService(gcpProjectId, gcpRegion);

    // Initialize Sub-Agent Manager
    this.subAgentManager = new SubAgentManager(config);

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
      ]
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      logger.info(`Bot logged in as ${this.client.user?.tag} (Realtime API Mode)`);
    });

    this.client.on('messageCreate', async (message: Message) => {
      logger.info(`Message received: "${message.content}" from ${message.author.tag}`);
      if (message.author.bot) return;

      // Check if user is authorized
      logger.info(`Checking auth: allowedUserIds.length=${this.config.allowedUserIds.length}, userId=${message.author.id}`);
      if (
        this.config.allowedUserIds.length > 0 &&
        !this.config.allowedUserIds.includes(message.author.id)
      ) {
        logger.info('User not authorized');
        return;
      }
      logger.info('User authorized, checking commands...');

      // Handle text commands
      if (message.content.startsWith('!join')) {
        logger.info('!join command detected, calling handler');
        await this.handleJoinCommand(message);
      } else if (message.content.startsWith('!leave')) {
        await this.handleLeaveCommand(message);
      } else if (message.content.startsWith('!status')) {
        await this.handleStatusCommand(message);
      }
    });

    this.client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
      // Auto-leave when bot is alone in voice channel
      const connection = getVoiceConnection(newState.guild.id);
      if (!connection) return;

      const channel = oldState.channel || newState.channel;
      if (!channel) return;

      const members = channel.members.filter(m => !m.user.bot);
      if (members.size === 0) {
        logger.info(`No users left in voice channel, leaving guild ${newState.guild.id}`);
        connection.destroy();

        // Clean up receiver
        const receiver = this.realtimeReceivers.get(newState.guild.id);
        if (receiver) {
          receiver.stopListening();
          this.realtimeReceivers.delete(newState.guild.id);
        }
      }
    });
  }

  private async handleJoinCommand(message: Message): Promise<void> {
    logger.info('handleJoinCommand called');
    const member = message.member;
    if (!member?.voice.channel) {
      logger.info('User not in voice channel');
      await message.reply('You need to be in a voice channel first!');
      return;
    }

    logger.info(`Member voice channel: ${member.voice.channel.name}`);

    try {
      logger.info('Attempting to join voice channel...');
      const connection = joinVoiceChannel({
        channelId: member.voice.channel.id,
        guildId: message.guild!.id,
        adapterCreator: message.guild!.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      logger.info(`Joined voice channel ${member.voice.channel.name}`);

      // Create Realtime Voice Receiver
      const receiver = new RealtimeVoiceReceiver(this.config.openaiApiKey);
      this.realtimeReceivers.set(message.guild!.id, receiver);

      // Set up function calling to integrate with Claude orchestrator
      receiver.onFunctionCall(async (name: string, args: any) => {
        return await this.handleFunctionCall(name, args, message.author.id, message.guild!.id, message.channel.id);
      });

      // Start listening (pass bot user ID to filter out bot's own audio)
      await receiver.startListening(connection, message.author.id, this.client.user!.id);

      await message.reply('Joined voice channel and started listening! (Realtime API Mode - Natural Conversations)');
    } catch (error) {
      logger.error('Failed to join voice channel', error);
      await message.reply('Failed to join voice channel: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async handleLeaveCommand(message: Message): Promise<void> {
    const connection = getVoiceConnection(message.guild!.id);
    if (!connection) {
      await message.reply('Not in a voice channel!');
      return;
    }

    // Clean up receiver
    const receiver = this.realtimeReceivers.get(message.guild!.id);
    if (receiver) {
      receiver.stopListening();
      this.realtimeReceivers.delete(message.guild!.id);
    }

    connection.destroy();
    logger.info(`Left voice channel in guild ${message.guild!.id}`);
    await message.reply('Left voice channel!');
  }

  private async handleStatusCommand(message: Message): Promise<void> {
    const connection = getVoiceConnection(message.guild!.id);
    const receiver = this.realtimeReceivers.get(message.guild!.id);

    let status = 'Bot Status:\n';
    status += `- Discord: ${this.client.user?.tag}\n`;
    status += `- Voice: ${connection ? 'Connected' : 'Not connected'}\n`;
    status += `- Realtime API: ${receiver?.isConnected() ? 'Connected' : 'Not connected'}\n`;
    status += `- Mode: OpenAI Realtime API (Natural Conversations)\n`;

    await message.reply(status);
  }

  /**
   * Handle function calls from Realtime API
   * This bridges the conversational AI with the Claude orchestrator
   */
  private async handleFunctionCall(
    name: string,
    args: any,
    userId: string,
    guildId: string,
    channelId: string
  ): Promise<any> {
    logger.info(`Handling function call: ${name}`, args);

    // Handle cloud deployment functions
    if (name === 'deploy_to_cloud_run') {
      try {
        const result = await this.cloudDeployment.deployToCloudRun({
          projectId: process.env.GCP_PROJECT_ID || 'agentflow-discord-bot',
          region: process.env.GCP_REGION || 'us-central1',
          serviceName: args.service_name,
          imageName: args.image_name,
          buildContext: args.build_context || '.',
          envVars: args.env_vars || {},
          claudeApiKey: process.env.ANTHROPIC_API_KEY
        });

        if (result.success) {
          return {
            success: true,
            message: `Successfully deployed to Cloud Run! Service URL: ${result.serviceUrl}`,
            serviceUrl: result.serviceUrl,
            logs: result.logs
          };
        } else {
          return {
            success: false,
            error: result.error || 'Deployment failed'
          };
        }
      } catch (error) {
        logger.error('Cloud deployment failed', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    if (name === 'list_cloud_services') {
      try {
        const services = await this.cloudDeployment.listServices();
        return {
          success: true,
          message: services.length > 0
            ? `Found ${services.length} service(s): ${services.join(', ')}`
            : 'No services found',
          services
        };
      } catch (error) {
        logger.error('Failed to list services', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    if (name === 'get_service_logs') {
      try {
        const logs = await this.cloudDeployment.getServiceLogs(
          args.service_name,
          args.limit || 50
        );
        return {
          success: true,
          message: `Retrieved ${logs.length} log entries`,
          logs
        };
      } catch (error) {
        logger.error('Failed to get service logs', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    if (name === 'delete_cloud_service') {
      try {
        const success = await this.cloudDeployment.deleteService(args.service_name);
        if (success) {
          return {
            success: true,
            message: `Successfully deleted service: ${args.service_name}`
          };
        } else {
          return {
            success: false,
            error: `Failed to delete service: ${args.service_name}`
          };
        }
      } catch (error) {
        logger.error('Failed to delete service', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Handle autonomous agent functions
    if (name === 'spawn_autonomous_agent') {
      try {
        logger.info(`🤖 Spawning autonomous agent for task: ${args.task_description}`);

        const { sessionId, agent } = await this.subAgentManager.spawnClaudeCodeAgent(
          `voice_${guildId}_${Date.now()}`,
          args.task_description,
          {
            contextFiles: args.context_files,
            requirements: args.requirements,
            maxIterations: args.max_iterations || 20,
            workingDirectory: args.working_directory || process.cwd()
          }
        );

        // Stream agent output back to voice
        const receiver = this.realtimeReceivers.get(guildId);
        if (receiver) {
          this.subAgentManager.streamAgentOutput(sessionId, (data) => {
            logger.info(`[Agent ${sessionId}] ${data}`);
            // Optionally send progress updates via voice
          });
        }

        return {
          success: true,
          message: `Autonomous agent spawned successfully. Agent ID: ${sessionId}. The agent is working on your task with full autonomy.`,
          agentId: sessionId
        };
      } catch (error) {
        logger.error('Failed to spawn autonomous agent', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    if (name === 'get_agent_status') {
      try {
        const status = this.subAgentManager.getAgentStatus(args.agent_id);

        if (!status) {
          return {
            success: false,
            error: `Agent not found: ${args.agent_id}`
          };
        }

        return {
          success: true,
          message: `Agent ${args.agent_id} is ${status.isRunning ? 'running' : 'idle'}. Step ${status.currentStep}/${status.totalSteps}`,
          status
        };
      } catch (error) {
        logger.error('Failed to get agent status', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    if (name === 'get_agent_result') {
      try {
        const result = await this.subAgentManager.getAgentResult(args.agent_id);

        if (!result) {
          return {
            success: false,
            error: `No result available for agent: ${args.agent_id}. The agent may still be running.`
          };
        }

        let summary = `Agent completed ${result.success ? 'successfully' : 'with errors'}. ` +
                       `Executed ${result.steps.length} steps in ${(result.duration / 1000).toFixed(2)} seconds.`;

        if (result.testResults && result.testResults.length > 0) {
          const passedTests = result.testResults.filter(t => t.passed).length;
          summary += ` Tests: ${passedTests}/${result.testResults.length} passed.`;
        }

        return {
          success: true,
          message: summary,
          result
        };
      } catch (error) {
        logger.error('Failed to get agent result', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    if (name === 'execute_task') {
      try {
        // Send to Claude orchestrator
        const response = await fetch(`${this.orchestratorUrl}/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.orchestratorApiKey
          },
          body: JSON.stringify({
            command: args.task_description,
            context: {
              userId,
              guildId,
              channelId,
              timestamp: new Date(),
              taskType: args.task_type,
              parameters: args.parameters || {}
            },
            priority: 'high',
            requiresSubAgents: true
          })
        });

        const result = await response.json() as any;
        logger.info('Orchestrator response:', result);

        if (result.success) {
          return {
            success: true,
            message: result.message || 'Task executed successfully',
            taskId: result.taskId,
            details: result.executionPlan
          };
        } else {
          return {
            success: false,
            error: result.error || 'Task execution failed'
          };
        }
      } catch (error) {
        logger.error('Failed to execute task via orchestrator', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return {
      success: false,
      error: `Unknown function: ${name}`
    };
  }

  async start(): Promise<void> {
    await this.client.login(this.config.discordToken);
    logger.info('Discord bot started (Realtime API Mode)');
  }

  async stop(): Promise<void> {
    // Clean up all receivers
    for (const [guildId, receiver] of this.realtimeReceivers.entries()) {
      receiver.stopListening();
      const connection = getVoiceConnection(guildId);
      if (connection) {
        connection.destroy();
      }
    }
    this.realtimeReceivers.clear();

    await this.client.destroy();
    logger.info('Discord bot stopped');
  }
}
