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
import { getDatabase, DatabaseService } from '../services/database';
import { ChannelNotifier } from '../services/channelNotifier';
import { DirectCommandExecutor } from '../services/directCommandExecutor';

/**
 * Discord Bot with ElevenLabs Conversational AI Integration
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
  private db: DatabaseService;
  private channelNotifier: ChannelNotifier;

  // Rate limiting for text messages (user -> last message timestamp)
  private messageRateLimits: Map<string, number> = new Map();
  private readonly RATE_LIMIT_MS = 3000; // 3 seconds between messages

  // Agent event listener cleanup tracking
  private agentEventListeners: Map<string, {
    stepStarted: (step: any) => void;
    taskCompleted: (result: any) => Promise<void>;
    warning: (warning: any) => void;
    error: (error: any) => void;
  }> = new Map();

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

    // Initialize database
    this.db = getDatabase();

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
      ]
    });

    // Initialize channel notifier (needs client) with system notification channel
    this.channelNotifier = new ChannelNotifier(
      this.client,
      config.systemNotificationChannelId
    );

    this.setupEventHandlers();
  }

  private setupSubAgentNotifications(): void {
    // Wire up SubAgentManager to send Discord notifications
    if (this.config.systemNotificationChannelId) {
      this.subAgentManager.setDiscordMessageHandler(async (channelId: string, message: string) => {
        try {
          const channel = await this.client.channels.fetch(channelId);
          if (channel && channel.isTextBased() && 'send' in channel) {
            await channel.send(message);
            logger.info(`Sent agent notification to channel ${channelId}`);
          }
        } catch (error) {
          logger.error(`Failed to send agent notification to channel ${channelId}`, error);
        }
      });
      logger.info(`SubAgentManager notifications enabled for channel: ${this.config.systemNotificationChannelId}`);
    } else {
      logger.warn('No systemNotificationChannelId configured - SubAgentManager notifications disabled');
    }
  }

  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      logger.info(`Bot logged in as ${this.client.user?.tag} (ElevenLabs Conversational AI Mode)`);
      // Setup notifications after client is ready
      this.setupSubAgentNotifications();
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

      // Save text message to database
      if (message.guild) {
        this.db.saveMessage({
          guildId: message.guild.id,
          channelId: message.channel.id,
          userId: message.author.id,
          username: message.author.tag,
          message: message.content,
          messageType: 'text',
          timestamp: message.createdAt
        });
      }

      // Handle text commands
      if (message.content.startsWith('!join')) {
        logger.info('!join command detected, calling handler');
        await this.handleJoinCommand(message);
      } else if (message.content.startsWith('!leave')) {
        await this.handleLeaveCommand(message);
      } else if (message.content.startsWith('!status')) {
        await this.handleStatusCommand(message);
      } else if (message.content.startsWith('!resources')) {
        await this.handleResourcesCommand(message);
      } else if (message.content.startsWith('!cleanup')) {
        await this.handleCleanupCommand(message);
      } else if (message.content.startsWith('!notify-test')) {
        await this.handleNotifyTestCommand(message);
      } else if (message.content.startsWith('!stop') || message.content.startsWith('!interrupt')) {
        await this.handleStopCommand(message);
      } else if (message.content.startsWith('!agents') || message.content.startsWith('!tasks')) {
        await this.handleAgentsCommand(message);
      } else if (message.content.startsWith('!task-status')) {
        await this.handleTaskStatusCommand(message);
      } else if (message.content.startsWith('!cancel-task')) {
        await this.handleCancelTaskCommand(message);
      } else if (message.content.startsWith('!help')) {
        await this.handleHelpCommand(message);
      } else if (!message.content.startsWith('!')) {
        // Handle general text messages (not commands)
        await this.handleTextMessage(message);
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

  private async handleHelpCommand(message: Message): Promise<void> {
    const helpText = `
**AgentFlow Bot Commands**

**Voice Commands:**
\`!join\` - Join your voice channel and start voice AI
\`!leave\` - Leave voice channel
\`!stop\` / \`!interrupt\` - Interrupt bot's speech

**Agent Management:**
\`!agents\` / \`!tasks\` - List all running tasks (all channels or current channel)
\`!task-status <taskId>\` - Get detailed status of a specific task
\`!cancel-task <taskId>\` - Cancel a running task

**System:**
\`!status\` - Show bot connection status
\`!notify-test\` - Test notification system
\`!help\` - Show this help message

**Natural Language:**
Just type your request without \`!\` and the AI will help you!

**Multi-Agent Support:**
You can have multiple agents working on different tasks across different channels simultaneously. Each task is fully isolated with its own agent.
    `.trim();

    await message.reply(helpText);
  }

  private async handleAgentsCommand(message: Message): Promise<void> {
    if (!message.guild) {
      await message.reply('This command only works in a guild!');
      return;
    }

    try {
      // Check if user wants all tasks or just current channel
      const showAll = message.content.includes('--all') || message.content.includes('-a');

      const response = await fetch(`${this.orchestratorUrl}/tasks?${showAll ? '' : `channelId=${message.channel.id}`}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.orchestratorApiKey
        }
      });

      const data = await response.json() as any;

      if (!data.tasks || data.tasks.length === 0) {
        await message.reply(showAll ? 'No tasks found across all channels.' : 'No tasks found in this channel.');
        return;
      }

      // Group by status
      const running = data.tasks.filter((t: any) => t.status === 'running');
      const completed = data.tasks.filter((t: any) => t.status === 'completed');
      const failed = data.tasks.filter((t: any) => t.status === 'failed');
      const pending = data.tasks.filter((t: any) => t.status === 'pending');

      let taskList = `**${showAll ? 'All Tasks' : 'Tasks in This Channel'}**\n\n`;
      taskList += `**Stats:** ${data.stats.running} running, ${data.stats.completed} completed, ${data.stats.failed} failed\n\n`;

      if (running.length > 0) {
        taskList += `**🏃 Running (${running.length}):**\n`;
        running.slice(0, 5).forEach((t: any) => {
          const duration = Math.floor((Date.now() - new Date(t.startedAt).getTime()) / 1000);
          taskList += `• \`${t.taskId}\` - ${t.description.substring(0, 50)}... (${duration}s)\n`;
        });
        if (running.length > 5) {
          taskList += `_...and ${running.length - 5} more_\n`;
        }
        taskList += '\n';
      }

      if (pending.length > 0) {
        taskList += `**⏳ Pending (${pending.length}):**\n`;
        pending.slice(0, 3).forEach((t: any) => {
          taskList += `• \`${t.taskId}\` - ${t.description.substring(0, 50)}...\n`;
        });
        taskList += '\n';
      }

      if (completed.length > 0) {
        taskList += `**✅ Recently Completed (${completed.length}):**\n`;
        completed.slice(0, 3).forEach((t: any) => {
          const duration = t.duration ? `${(t.duration / 1000).toFixed(1)}s` : 'N/A';
          taskList += `• \`${t.taskId}\` - ${t.description.substring(0, 50)}... (${duration})\n`;
        });
        taskList += '\n';
      }

      if (failed.length > 0) {
        taskList += `**❌ Failed (${failed.length}):**\n`;
        failed.slice(0, 3).forEach((t: any) => {
          taskList += `• \`${t.taskId}\` - ${t.description.substring(0, 50)}...\n`;
        });
        taskList += '\n';
      }

      taskList += `\n_Use \`!task-status <taskId>\` for details_`;
      taskList += `\n_Use \`!agents --all\` to see tasks from all channels_`;

      await message.reply(taskList);
    } catch (error) {
      logger.error('Failed to fetch agents', error);
      await message.reply(`❌ Failed to fetch task list: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleTaskStatusCommand(message: Message): Promise<void> {
    const parts = message.content.split(' ');
    if (parts.length < 2) {
      await message.reply('Usage: `!task-status <taskId>`');
      return;
    }

    const taskId = parts[1];

    try {
      const response = await fetch(`${this.orchestratorUrl}/task/${taskId}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.orchestratorApiKey
        }
      });

      if (!response.ok) {
        await message.reply(`❌ Task \`${taskId}\` not found.`);
        return;
      }

      const task = await response.json() as any;

      const duration = task.duration ? `${(task.duration / 1000).toFixed(2)}s` : `${Math.floor((Date.now() - new Date(task.startedAt).getTime()) / 1000)}s (running)`;
      const statusEmoji = task.status === 'completed' ? '✅' : task.status === 'running' ? '🏃' : task.status === 'failed' ? '❌' : '⏳';

      let statusMsg = `
${statusEmoji} **Task Status**

**ID:** \`${task.taskId}\`
**Status:** ${task.status}
**Description:** ${task.description}
**Duration:** ${duration}
**Started:** ${new Date(task.startedAt).toLocaleString()}
`;

      if (task.result) {
        statusMsg += `
**Iterations:** ${task.result.iterations}
**Tool Calls:** ${task.result.toolCalls}
**Result:** ${task.result.message.substring(0, 200)}${task.result.message.length > 200 ? '...' : ''}
`;
      }

      if (task.error) {
        statusMsg += `\n**Error:** \`${task.error}\``;
      }

      await message.reply(statusMsg.trim());
    } catch (error) {
      logger.error('Failed to fetch task status', error);
      await message.reply(`❌ Failed to get task status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleCancelTaskCommand(message: Message): Promise<void> {
    const parts = message.content.split(' ');
    if (parts.length < 2) {
      await message.reply('Usage: `!cancel-task <taskId>`');
      return;
    }

    const taskId = parts[1];

    try {
      const response = await fetch(`${this.orchestratorUrl}/task/${taskId}/cancel`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.orchestratorApiKey
        }
      });

      const result = await response.json() as any;

      if (result.success) {
        await message.reply(`🛑 Task \`${taskId}\` cancelled successfully.`);
      } else {
        await message.reply(`❌ ${result.error || 'Failed to cancel task'}`);
      }
    } catch (error) {
      logger.error('Failed to cancel task', error);
      await message.reply(`❌ Failed to cancel task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

    // Send initial status message
    const statusMsg = await message.reply('🔄 **Starting voice agent...**');

    try {
      logger.info('Attempting to join voice channel...');
      await statusMsg.edit('🔄 **Step 1/4:** Joining voice channel...');

      const connection = joinVoiceChannel({
        channelId: member.voice.channel.id,
        guildId: message.guild!.id,
        adapterCreator: message.guild!.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });

      // Add connection status logging
      connection.on('stateChange', (oldState, newState) => {
        logger.info(`Voice connection state changed: ${oldState.status} -> ${newState.status}`);
      });

      connection.on('error', (error) => {
        logger.error('Voice connection error:', error);
      });

      logger.info(`Current connection status: ${connection.state.status}`);

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        logger.info(`Joined voice channel ${member.voice.channel.name}`);
        await statusMsg.edit('✅ **Step 1/4:** Voice channel joined\n🔄 **Step 2/4:** Initializing audio receiver...');
      } catch (stateError) {
        // Failed to reach Ready state within timeout
        logger.error('Failed to reach Ready state', stateError);
        connection.destroy();
        await statusMsg.edit('❌ **Step 1/4 Failed:** Voice connection timed out\n\nPlease check bot permissions and try again.');
        throw new Error('Voice connection timed out or was rejected. Please ensure the bot has proper permissions and try again.');
      }

      // Create ElevenLabs Voice Receiver
      const speechSpeed = this.config.ttsSpeed || 1.25; // Default to 1.25x speed (25% faster)
      const receiver = new RealtimeVoiceReceiver(
        this.config.elevenLabsApiKey, 
        this.config.elevenLabsAgentId,
        speechSpeed
      );
      this.realtimeReceivers.set(message.guild!.id, receiver);

      await statusMsg.edit('✅ **Step 1/4:** Voice channel joined\n✅ **Step 2/4:** Audio receiver ready\n🔄 **Step 3/4:** Connecting to ElevenLabs Conversational AI...');

      // Capture channel ID and guild ID in closure-safe variables
      const channelId = member.voice.channel.id;
      const guildId = message.guild!.id;

      // Set context for message logging
      receiver.setContext(guildId, channelId);

      // Set up message callback to save to database
      receiver.onMessage((userId: string, username: string, msg: string, isBot: boolean) => {
        this.db.saveMessage({
          guildId,
          channelId,
          userId,
          username,
          message: msg,
          messageType: isBot ? 'agent_response' : 'voice',
          timestamp: new Date()
        });
      });

      // Set up Discord message handler for transcription/response notifications
      receiver.setDiscordMessageHandler(async (targetChannelId: string, msg: string) => {
        try {
          logger.info(`[VOICE MSG] Attempting to send to channel ${targetChannelId}: ${msg.substring(0, 50)}...`);
          const channel = await this.client.channels.fetch(targetChannelId);

          if (!channel) {
            logger.error(`[VOICE MSG] Channel ${targetChannelId} not found!`);
            return;
          }

          if (!channel.isTextBased()) {
            logger.error(`[VOICE MSG] Channel ${targetChannelId} is not text-based (type: ${channel.type})`);
            return;
          }

          if (!('send' in channel)) {
            logger.error(`[VOICE MSG] Channel ${targetChannelId} does not have send method`);
            return;
          }

          const sentMessage = await channel.send(msg);
          const channelName = 'name' in channel ? channel.name : 'DM';
          logger.info(`[VOICE MSG] ✅ Message sent successfully to #${channelName} (${targetChannelId}) - Message ID: ${sentMessage.id}`);
        } catch (error) {
          logger.error(`[VOICE MSG] ❌ Failed to send voice notification to channel ${targetChannelId}`, error);
        }
      });

      // Set up function calling to integrate with Claude orchestrator
      receiver.onFunctionCall(async (name: string, args: any) => {
        return await this.handleFunctionCall(name, args, message.author.id, guildId, channelId);
      });

      // Start listening (pass bot user ID to filter out bot's own audio)
      await statusMsg.edit('✅ **Step 1/4:** Voice channel joined\n✅ **Step 2/4:** Audio receiver ready\n✅ **Step 3/4:** Connected to ElevenLabs AI\n🔄 **Step 4/4:** Starting audio streams...');

      await receiver.startListening(connection, message.author.id, this.client.user!.id, message.author.tag);

      await statusMsg.edit('✅ **All systems ready!**\n\n🎤 Voice agent is now listening in **' + member.voice.channel.name + '**\n\n_Mode: ElevenLabs Conversational AI with natural interruptions_');
    } catch (error) {
      logger.error('Failed to join voice channel', error);

      // Update status message with error
      try {
        if (error instanceof Error) {
          if (error.message.includes('timeout') || error.message.includes('aborted')) {
            await statusMsg.edit('❌ **Connection Failed**\n\nConnection timed out. Possible causes:\n• Missing bot permissions (Connect, Speak, Use Voice Activity)\n• Network connectivity issues\n• Discord voice server issues\n\nPlease verify permissions and try again.');
          } else if (error.message.includes('ElevenLabs') || error.message.includes('API') || error.message.includes('Agent')) {
            await statusMsg.edit('❌ **Step 3/4 Failed:** Could not connect to ElevenLabs Conversational AI\n\n' + error.message);
          } else {
            await statusMsg.edit('❌ **Startup Failed**\n\n' + error.message);
          }
        }
      } catch (editError) {
        // If we can't edit the status message, send a new reply
        let errorMessage = 'Failed to join voice channel';
        if (error instanceof Error) {
          if (error.message.includes('timeout') || error.message.includes('aborted')) {
            errorMessage += ': Connection timed out. This may be due to:\n' +
                           '• Missing bot permissions (Connect, Speak, Use Voice Activity)\n' +
                           '• Network connectivity issues\n' +
                           '• Discord voice server issues\n\n' +
                           'Please verify bot permissions and try again.';
          } else {
            errorMessage += ': ' + error.message;
          }
        }

        await message.reply(errorMessage);
      }
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
    status += `- ElevenLabs AI: ${receiver?.isConnected() ? 'Connected' : 'Not connected'}\n`;
    status += `- Mode: ElevenLabs Conversational AI (Natural Conversations)\n`;

    await message.reply(status);
  }

  private async handleNotifyTestCommand(message: Message): Promise<void> {
    const notificationChannelId = this.config.systemNotificationChannelId;
    
    if (!notificationChannelId) {
      await message.reply('❌ No notification channel configured. Set SYSTEM_NOTIFICATION_CHANNEL_ID in your .env file.');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(notificationChannelId);
      if (channel && channel.isTextBased() && 'send' in channel) {
        await channel.send('🧪 **Notification Test**\n```\nThis is a test notification from the agent system.\nIf you see this, notifications are working!\n```');
        await message.reply(`✅ Test notification sent to channel <#${notificationChannelId}>`);
        logger.info(`Test notification sent to channel ${notificationChannelId}`);
      } else {
        await message.reply(`❌ Channel ${notificationChannelId} is not a text channel or bot doesn't have access.`);
      }
    } catch (error) {
      logger.error('Failed to send test notification', error);
      await message.reply(`❌ Failed to send test notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleStopCommand(message: Message): Promise<void> {
    if (!message.guild) {
      await message.reply('This command only works in a guild!');
      return;
    }

    const receiver = this.realtimeReceivers.get(message.guild.id);
    if (!receiver) {
      await message.reply('❌ Bot is not currently in a voice channel or not actively speaking.');
      return;
    }

    try {
      // Interrupt the bot's current speech
      receiver.interrupt();
      await message.reply('🛑 Bot speech interrupted.');
      logger.info(`User ${message.author.tag} interrupted bot in guild ${message.guild.id}`);
    } catch (error) {
      logger.error('Failed to interrupt bot', error);
      await message.reply(`❌ Failed to interrupt bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle general text messages (for AI responses)
   */
  private async handleTextMessage(message: Message): Promise<void> {
    let thinkingMessage: Message | undefined;
    
    try {
      if (!message.guild) return;

      // Rate limiting: Check if user is sending messages too quickly
      const userId = message.author.id;
      const now = Date.now();
      const lastMessageTime = this.messageRateLimits.get(userId) || 0;

      if (now - lastMessageTime < this.RATE_LIMIT_MS) {
        const remainingTime = Math.ceil((this.RATE_LIMIT_MS - (now - lastMessageTime)) / 1000);
        await message.react('⏱️');
        logger.info(`Rate limit: User ${message.author.tag} must wait ${remainingTime}s`);
        return;
      }

      // Update last message time
      this.messageRateLimits.set(userId, now);

      // FAST PATH: Check if this is a simple command that can be executed directly
      const directResult = await DirectCommandExecutor.handleMessage(message.content);
      if (directResult.handled) {
        logger.info(`✅ Handled via direct execution: ${message.content}`);
        await message.reply(directResult.response!);

        // Save to database
        this.db.saveMessage({
          guildId: message.guild.id,
          channelId: message.channel.id,
          userId: this.client.user!.id,
          username: this.client.user!.tag,
          message: directResult.response!,
          messageType: 'agent_response',
          timestamp: new Date()
        });
        return;
      }

      // Send immediate acknowledgment
      thinkingMessage = await message.reply('⚙️ Working on it...');

      // Show typing indicator for orchestrator path
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      // Get conversation context from database for continuity
      const conversationContext = this.db.getConversationContext(
        message.guild.id,
        message.channel.id,
        20 // Last 20 messages
      );

      // Use SAME orchestrator as voice commands for consistency
      const response = await fetch(`${this.orchestratorUrl}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.orchestratorApiKey
        },
        body: JSON.stringify({
          command: message.content,
          context: {
            userId: message.author.id,
            guildId: message.guild.id,
            channelId: message.channel.id,
            timestamp: new Date(),
            conversationHistory: conversationContext // Add conversation history!
          },
          priority: 'normal',
          requiresSubAgents: true // Enable command execution
        })
      });

      const result = await response.json() as any;

      // Delete thinking message
      try {
        await thinkingMessage.delete();
      } catch (e) {
        // Ignore if we can't delete (might be too old)
      }

      if (result.success && result.message) {
        await message.reply(result.message);

        logger.info(`Response from orchestrator for text message`);

        // Save bot response to database
        this.db.saveMessage({
          guildId: message.guild.id,
          channelId: message.channel.id,
          userId: this.client.user!.id,
          username: this.client.user!.tag,
          message: result.message,
          messageType: 'agent_response',
          timestamp: new Date()
        });
      } else if (!result.success) {
        const errorMsg = result.error 
          ? `❌ Error: ${result.error}\n\nPlease try again or rephrase your request.`
          : '❌ Sorry, I encountered an error processing your request.';
        await message.reply(errorMsg);
        logger.error('Orchestrator returned error:', result.error);
      }
    } catch (error) {
      logger.error('Failed to handle text message', error);
      
      // Delete thinking message if it exists
      if (thinkingMessage) {
        try {
          await thinkingMessage.delete();
        } catch (e) {
          // Ignore
        }
      }
      
      // Send error message to user
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await message.reply(`❌ Error: ${errorMessage}\n\nPlease try again later.`);
    }
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

    // Handle progress checking
    if (name === 'check_task_progress') {
      try {
        const response = await fetch(`${this.orchestratorUrl}/agents`, {
          method: 'GET',
          headers: {
            'X-API-Key': this.orchestratorApiKey
          }
        });

        const agents = await response.json() as any;
        
        if (agents.agents && agents.agents.length > 0) {
          const agentSummaries = agents.agents.map((agent: any) => 
            `- Task ${agent.taskId}: ${agent.status}`
          ).join('\n');
          
          return {
            success: true,
            message: `I'm currently working on ${agents.agents.length} task(s):\n${agentSummaries}`,
            agentCount: agents.agents.length,
            agents: agents.agents
          };
        } else {
          return {
            success: true,
            message: "I'm not currently working on any tasks. Everything is idle!",
            agentCount: 0
          };
        }
      } catch (error) {
        logger.error('Failed to check task progress', error);
        return {
          success: false,
          error: 'Failed to retrieve task status',
          message: "Sorry, I couldn't check my task progress right now."
        };
      }
    }

    // Handle cloud deployment functions
    if (name === 'deploy_to_cloud_run') {
      try {
        // Set up deployment notification callback
        this.cloudDeployment.setNotificationCallback(async (event) => {
          await this.channelNotifier.notifyDeployment(guildId, channelId, event);
        });

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

        // Get conversation context from database
        const conversationContext = this.db.getConversationContext(guildId, channelId, 20);

        // Enhance task description with context
        let enhancedTaskDescription = args.task_description;
        if (conversationContext) {
          enhancedTaskDescription += `\n\nRecent conversation context:\n${conversationContext}`;
        }

        const { sessionId, agent } = await this.subAgentManager.spawnClaudeCodeAgent(
          `voice_${guildId}_${Date.now()}`,
          enhancedTaskDescription,
          {
            contextFiles: args.context_files,
            requirements: args.requirements,
            maxIterations: args.max_iterations || 20,
            workingDirectory: args.working_directory || process.cwd(),
            channelId: channelId // Pass the channel ID so notifications go to the right place
          }
        );

        // Post agent start notification to channel
        await this.channelNotifier.notifyAgentStart(
          guildId,
          channelId,
          sessionId,
          args.task_description,
          userId
        );

        // Create agent task in database
        this.db.createAgentTask({
          agentId: sessionId,
          guildId,
          channelId,
          userId,
          taskDescription: args.task_description,
          status: 'running',
          startedAt: new Date()
        });

        // Stream agent output to channel
        const receiver = this.realtimeReceivers.get(guildId);
        if (receiver) {
          this.subAgentManager.streamAgentOutput(sessionId, (data) => {
            logger.info(`[Agent ${sessionId}] ${data}`);
          });
        }

        // Listen to agent events - track listeners for cleanup
        const stepStartedHandler = (step: any) => {
          // Only notify on every 5th step or important milestones to reduce spam
          if (step.step % 5 === 0 || step.step === 1 || step.step === step.totalSteps) {
            this.channelNotifier.notifyAgentProgress(guildId, channelId, {
              agentId: sessionId,
              step: step.step,
              totalSteps: step.totalSteps || 20,
              action: step.action,
              status: 'running'
            }).catch((err) => logger.error('Failed to notify agent progress', err));
          }
        };

        const taskCompletedHandler = async (result: any) => {
          try {
            // Update database
            this.db.updateAgentTask(sessionId, {
              status: result.success ? 'completed' : 'failed',
              completedAt: new Date(),
              result: JSON.stringify(result),
              error: result.success ? undefined : result.error?.message
            });

            // Post completion notification
            await this.channelNotifier.notifyAgentComplete(
              guildId,
              channelId,
              sessionId,
              result.success,
              result.success
                ? `Task completed successfully in ${(result.duration / 1000).toFixed(2)}s`
                : `Task failed: ${result.error?.message || 'Unknown error'}`,
              {
                duration: result.duration,
                steps: result.steps.length,
                testResults: result.testResults
              }
            );

            // Clean up event listeners to prevent memory leak
            this.removeAgentListeners(sessionId, agent);
          } catch (error) {
            logger.error('Error in task completion handler', error);
          }
        };

        const warningHandler = (warning: any) => {
          // Only log critical warnings to reduce spam
          if (warning.type === 'critical' || warning.type === 'security') {
            this.channelNotifier.notifyAgentLog(guildId, channelId, {
              agentId: sessionId,
              logType: 'warning',
              message: warning.message,
              details: warning.type
            }).catch((err) => logger.error('Failed to notify warning', err));
          } else {
            // Just log to console for non-critical warnings
            logger.warn(`Agent ${sessionId} warning: ${warning.message}`);
          }
        };

        const errorHandler = (error: any) => {
          this.channelNotifier.notifyAgentLog(guildId, channelId, {
            agentId: sessionId,
            logType: 'error',
            message: error.message,
            details: error.stack
          }).catch((err) => logger.error('Failed to notify error', err));

          // Clean up on error
          this.removeAgentListeners(sessionId, agent);
        };

        // Store listener references for cleanup
        this.agentEventListeners.set(sessionId, {
          stepStarted: stepStartedHandler,
          taskCompleted: taskCompletedHandler,
          warning: warningHandler,
          error: errorHandler
        });

        // Attach event listeners
        agent.on('step:started', stepStartedHandler);
        agent.on('task:completed', taskCompletedHandler);
        agent.on('warning', warningHandler);
        agent.on('error', errorHandler);

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
        // Log that we're starting the task
        logger.info(`🚀 Starting task: ${args.task_description}`);

        // Send initial notification to Discord channel
        try {
          const channel = await this.client.channels.fetch(channelId);
          if (channel && channel.isTextBased() && 'send' in channel) {
            await channel.send(`🤖 **Task Started**\n\`\`\`\n${args.task_description}\n\`\`\``);
          }
        } catch (err) {
          logger.error('Failed to send task start notification', err);
        }

        // IMPORTANT: Return immediate acknowledgment to voice so user doesn't wait in silence
        // This allows OpenAI to speak "I'm working on that" while the task executes
        const immediateVoiceResponse = {
          success: true,
          voiceMessage: `I'm working on that now. I'll send updates to the Discord channel.`,
          isProcessing: true // Flag to indicate task is still running
        };

        // Execute task asynchronously and send results to Discord
        (async () => {
          try {
            // Get conversation context from database for continuity
            const conversationContext = this.db.getConversationContext(guildId, channelId, 20);

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
                  parameters: args.parameters || {},
                  conversationHistory: conversationContext // Add conversation history!
                },
                priority: 'high',
                requiresSubAgents: true
              })
            });

            const result = await response.json() as any;
            logger.info('Orchestrator response:', result);

            if (result.success) {
              logger.info(`✅ Task completed: ${args.task_description}`);

              // Send completion notification to Discord channel
              try {
                const channel = await this.client.channels.fetch(channelId);
                if (channel && channel.isTextBased() && 'send' in channel) {
                  await channel.send(`✅ **Task Completed**\n${result.message || 'Task executed successfully'}`);
                }
              } catch (err) {
                logger.error('Failed to send task completion notification', err);
              }
            } else {
              logger.error(`❌ Task failed: ${args.task_description}`);

              // Send failure notification to Discord channel
              try {
                const channel = await this.client.channels.fetch(channelId);
                if (channel && channel.isTextBased() && 'send' in channel) {
                  await channel.send(`❌ **Task Failed**\n${result.error || 'Task execution failed'}`);
                }
              } catch (err) {
                logger.error('Failed to send task failure notification', err);
              }
            }
          } catch (error) {
            logger.error('Failed to execute task via orchestrator', error);

            // Send error notification to Discord channel
            try {
              const channel = await this.client.channels.fetch(channelId);
              if (channel && channel.isTextBased() && 'send' in channel) {
                await channel.send(`❌ **Error**\n${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            } catch (err) {
              logger.error('Failed to send task error notification', err);
            }
          }
        })();

        // Return immediate voice response
        return immediateVoiceResponse;
      } catch (error) {
        logger.error('Failed to execute task via orchestrator', error);

        // Send error notification to Discord channel
        try {
          const channel = await this.client.channels.fetch(channelId);
          if (channel && channel.isTextBased() && 'send' in channel) {
            await channel.send(`❌ **Error**\n${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } catch (err) {
          logger.error('Failed to send task error notification', err);
        }

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
    logger.info('Discord bot started (ElevenLabs Conversational AI Mode)');

    // Send system startup notification if configured
    if (this.config.systemNotificationGuildId && this.config.systemNotificationChannelId) {
      await this.sendSystemNotification({
        type: 'startup',
        component: 'AgentFlow Bot',
        message: 'AgentFlow system started successfully',
        details: `Mode: ElevenLabs Conversational AI\nMax Concurrent Agents: ${this.config.maxConcurrentAgents}`,
        metrics: {
          'Node Version': process.version,
          'Platform': process.platform,
          'Memory': `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
        }
      });
    }
  }

  /**
   * Send system notification to configured channel
   */
  private async sendSystemNotification(event: {
    type: 'startup' | 'shutdown' | 'error' | 'warning' | 'info';
    component: string;
    message: string;
    details?: string;
    metrics?: Record<string, string | number>;
  }): Promise<void> {
    try {
      if (this.config.systemNotificationGuildId && this.config.systemNotificationChannelId) {
        await this.channelNotifier.notifySystemEvent(
          this.config.systemNotificationGuildId,
          this.config.systemNotificationChannelId,
          event
        );
      }
    } catch (error) {
      logger.error('Failed to send system notification', error);
    }
  }

  /**
   * Remove event listeners from an agent to prevent memory leaks
   */
  private removeAgentListeners(sessionId: string, agent: any): void {
    const listeners = this.agentEventListeners.get(sessionId);
    if (listeners) {
      agent.off('step:started', listeners.stepStarted);
      agent.off('task:completed', listeners.taskCompleted);
      agent.off('warning', listeners.warning);
      agent.off('error', listeners.error);
      this.agentEventListeners.delete(sessionId);
      logger.info(`Cleaned up event listeners for agent ${sessionId}`);
    }
  }

  /**
   * Public method to send text message to any channel
   * Used by orchestrator for agent notifications
   */
  async sendTextMessage(channelId: string, message: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel && channel.isTextBased() && 'send' in channel) {
        await channel.send(message);
        logger.info(`Sent message to channel ${channelId}`);
      } else {
        logger.error(`Channel ${channelId} is not a text-based channel`);
      }
    } catch (error) {
      logger.error(`Failed to send message to channel ${channelId}`, error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    // Send shutdown notification if configured
    if (this.config.systemNotificationGuildId && this.config.systemNotificationChannelId) {
      await this.sendSystemNotification({
        type: 'shutdown',
        component: 'AgentFlow Bot',
        message: 'AgentFlow system shutting down',
        details: 'Graceful shutdown initiated'
      });
    }

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
