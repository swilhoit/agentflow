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
import { BotConfig, VoiceCommand } from '../types';
import { logger } from '../utils/logger';
import { WhisperService } from '../utils/whisper';
import { TextToSpeechService } from '../utils/tts';
import { VoiceReceiver } from './voiceReceiver';
import { VoicePlayer } from './voicePlayer';
import { TrelloService } from '../services/trello';
import { GoalsScheduler } from '../services/goalsScheduler';

export class DiscordBot {
  private client: Client;
  private config: BotConfig;
  private whisperService: WhisperService;
  private ttsService: TextToSpeechService;
  private voiceReceiver: VoiceReceiver;
  private voicePlayer: VoicePlayer;
  private commandCallback?: (command: VoiceCommand) => Promise<void>;
  private trelloService?: TrelloService;
  private goalsScheduler?: GoalsScheduler;

  constructor(config: BotConfig) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
      ]
    });

    this.whisperService = new WhisperService(config.openaiApiKey);
    this.ttsService = new TextToSpeechService(config.openaiApiKey, config.ttsSpeed || 1.0);
    this.voiceReceiver = new VoiceReceiver(this.whisperService);
    this.voicePlayer = new VoicePlayer();

    // Initialize Trello service if credentials are provided
    if (config.trelloApiKey && config.trelloApiToken) {
      this.trelloService = new TrelloService(config.trelloApiKey, config.trelloApiToken);
      logger.info('Trello service initialized');
    } else {
      logger.warn('Trello credentials not provided, Trello commands will be disabled');
    }

    // Initialize Goals Scheduler (will be initialized after client is ready)
    // Defer initialization until after the Discord client is ready
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      logger.info(`Bot logged in as ${this.client.user?.tag}`);
      
      // Initialize Goals Scheduler after client is ready
      this.goalsScheduler = new GoalsScheduler(this.client);
      logger.info('Goals Scheduler initialized');
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
      } else if (message.content.startsWith('!resources')) {
        await this.handleResourcesCommand(message);
      } else if (message.content.startsWith('!cleanup')) {
        await this.handleCleanupCommand(message);
      } else if (message.content.startsWith('!notify-test')) {
        await this.handleNotifyTestCommand(message);
      } else if (message.content.startsWith('!trello-boards')) {
        await this.handleTrelloBoardsCommand(message);
      } else if (message.content.startsWith('!trello-lists')) {
        await this.handleTrelloListsCommand(message);
      } else if (message.content.startsWith('!trello-cards')) {
        await this.handleTrelloCardsCommand(message);
      } else if (message.content.startsWith('!trello-create')) {
        await this.handleTrelloCreateCommand(message);
      } else if (message.content.startsWith('!trello-update')) {
        await this.handleTrelloUpdateCommand(message);
      } else if (message.content.startsWith('!trello-search')) {
        await this.handleTrelloSearchCommand(message);
      } else if (message.content.startsWith('!trello-help')) {
        await this.handleTrelloHelpCommand(message);
      } else if (message.content.startsWith('!goals-setup')) {
        await this.handleGoalsSetupCommand(message);
      } else if (message.content.startsWith('!goals-test')) {
        await this.handleGoalsTestCommand(message);
      } else if (message.content.startsWith('!goals-history')) {
        await this.handleGoalsHistoryCommand(message);
      } else if (message.content.startsWith('!goals-cancel')) {
        await this.handleGoalsCancelCommand(message);
      } else if (message.content.startsWith('!goals-help')) {
        await this.handleGoalsHelpCommand(message);
      }
    });

    this.client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
      // Auto-leave when bot is alone in voice channel
      if (oldState.member?.user.bot) return;

      const connection = getVoiceConnection(oldState.guild.id);
      if (!connection) return;

      const channel = oldState.guild.channels.cache.get(connection.joinConfig.channelId!);
      if (!channel || channel.type !== 2) return; // 2 = GUILD_VOICE

      const voiceChannel = channel as any; // Type assertion for voice channel

      // If only the bot is left in the channel
      if (voiceChannel.members && voiceChannel.members.size === 1 && voiceChannel.members.has(this.client.user!.id)) {
        logger.info('Bot is alone in voice channel, leaving...');
        connection.destroy();
        this.voiceReceiver.stopListening(oldState.guild.id);
      }
    });
  }

  private async handleJoinCommand(message: Message): Promise<void> {
    logger.info('handleJoinCommand called');
    const member = message.member;
    logger.info(`Member voice channel: ${member?.voice?.channel?.name || 'none'}`);
    if (!member?.voice.channel) {
      logger.info('User not in voice channel, sending reply');
      await message.reply('You need to be in a voice channel first!');
      return;
    }

    try {
      logger.info('Attempting to join voice channel...');
      const connection = joinVoiceChannel({
        channelId: member.voice.channel.id,
        guildId: message.guild!.id,
        adapterCreator: message.guild!.voiceAdapterCreator as any,
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

        // Start listening to voice
        this.voiceReceiver.startListening(connection, message.guild!.id);

        await message.reply('Joined voice channel and started listening!');
      } catch (stateError) {
        logger.error('Failed to reach Ready state', stateError);
        connection.destroy();
        throw new Error('Voice connection timed out or was rejected. Please ensure the bot has proper permissions and try again.');
      }
    } catch (error) {
      logger.error('Failed to join voice channel', error);
      
      // Provide more helpful error messages
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

  private async handleLeaveCommand(message: Message): Promise<void> {
    const connection = getVoiceConnection(message.guild!.id);

    if (!connection) {
      await message.reply('Not in a voice channel!');
      return;
    }

    this.voiceReceiver.stopListening(message.guild!.id);
    connection.destroy();

    await message.reply('Left voice channel!');
  }

  private async handleStatusCommand(message: Message): Promise<void> {
    const connection = getVoiceConnection(message.guild!.id);

    const status = connection
      ? `Connected to voice channel\nStatus: ${connection.state.status}`
      : 'Not connected to any voice channel';

    await message.reply(status);
  }

  private async handleResourcesCommand(message: Message): Promise<void> {
    const { getCleanupManager } = require('../utils/cleanupManager');
    const cleanupManager = getCleanupManager();

    try {
      await message.reply('🔍 Checking resource status...');
      
      const status = await cleanupManager.getResourceStatus();
      
      const response = `📊 **AgentFlow Resource Status**\n\n` +
        `🔹 Running Processes: ${status.runningProcesses}\n` +
        `🔹 Active Agents: ${status.activeAgents}\n` +
        `🔹 Running Tasks (DB): ${status.runningTasks}\n` +
        `🔹 Temp File Size: ${(status.tempFileSize / 1024).toFixed(2)} MB\n\n` +
        `_Last checked: ${new Date().toLocaleTimeString()}_`;
      
      await message.reply(response);
    } catch (error) {
      logger.error('Failed to get resource status', error);
      await message.reply(`❌ Failed to get resource status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleCleanupCommand(message: Message): Promise<void> {
    // Only allow admin users to run cleanup
    if (!message.member?.permissions.has('Administrator')) {
      await message.reply('❌ This command requires Administrator permission.');
      return;
    }

    const { getCleanupManager } = require('../utils/cleanupManager');
    const cleanupManager = getCleanupManager();

    try {
      await message.reply('🧹 Starting cleanup...');
      
      const report = await cleanupManager.performCleanup();
      
      const response = `✅ **Cleanup Complete**\n\n` +
        `🔹 Orphaned Processes: ${report.orphanedProcesses}\n` +
        `🔹 Orphaned Agents: ${report.orphanedAgents}\n` +
        `🔹 Stale DB Tasks: ${report.staleTasksInDB}\n` +
        `🔹 Temp Files Deleted: ${report.tempFilesDeleted}\n\n` +
        `**Total Cleaned:** ${report.totalCleaned} items`;
      
      await message.reply(response);
    } catch (error) {
      logger.error('Failed to run cleanup', error);
      await message.reply(`❌ Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleNotifyTestCommand(message: Message): Promise<void> {
    const notificationChannelId = this.config.systemNotificationChannelId;
    
    if (!notificationChannelId) {
      await message.reply('❌ No notification channel configured. Set SYSTEM_NOTIFICATION_CHANNEL_ID in your .env file.');
      return;
    }

    try {
      await this.sendTextMessage(
        notificationChannelId,
        '🧪 **Notification Test**\n```\nThis is a test notification from the agent system.\nIf you see this, notifications are working!\n```'
      );
      await message.reply(`✅ Test notification sent to channel <#${notificationChannelId}>`);
    } catch (error) {
      logger.error('Failed to send test notification', error);
      await message.reply(`❌ Failed to send test notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  onVoiceCommand(callback: (command: VoiceCommand) => Promise<void>): void {
    this.commandCallback = callback;
    this.voiceReceiver.setCommandCallback(callback);
  }

  async sendVoiceResponse(guildId: string, text: string): Promise<void> {
    try {
      logger.info(`Sending voice response to guild ${guildId}: ${text.substring(0, 50)}...`);

      // Generate speech from text
      const audioPath = await this.ttsService.generateSpeech(text);

      // Play audio in voice channel
      await this.voicePlayer.playAudio(guildId, audioPath);

      logger.info('Voice response sent successfully');
    } catch (error) {
      logger.error('Failed to send voice response', error);
    }
  }

  async sendTextMessage(channelId: string, message: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel && channel.isTextBased() && 'send' in channel) {
        await channel.send(message);
        logger.info(`Sent text message to channel ${channelId}`);
      } else {
        logger.warn(`Channel ${channelId} is not text-based`);
      }
    } catch (error) {
      logger.error(`Failed to send text message to channel ${channelId}`, error);
    }
  }

  getClient(): Client {
    return this.client;
  }

  async start(): Promise<void> {
    try {
      await this.client.login(this.config.discordToken);
      logger.info('Discord bot started successfully');

      // Setup periodic cleanup of temp files (non-blocking now)
      setInterval(() => {
        this.whisperService.cleanupTempFiles();
      }, 3600000); // Every hour
    } catch (error) {
      logger.error('Failed to start Discord bot', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.client.destroy();
    logger.info('Discord bot stopped');
  }

  // ==================== TRELLO COMMANDS ====================

  private async handleTrelloBoardsCommand(message: Message): Promise<void> {
    if (!this.trelloService) {
      await message.reply('❌ Trello service is not configured. Please set TRELLO_API_KEY and TRELLO_API_TOKEN in your .env file.');
      return;
    }

    try {
      await message.reply('📋 Fetching your Trello boards...');
      const boards = await this.trelloService.getBoards();
      
      if (boards.length === 0) {
        await message.reply('No boards found!');
        return;
      }

      let response = '📋 **Your Trello Boards:**\n\n';
      boards.slice(0, 10).forEach((board, index) => {
        response += `${index + 1}. **${board.name}**\n`;
        response += `   ID: \`${board.id}\`\n`;
        response += `   URL: ${board.shortUrl}\n\n`;
      });

      if (boards.length > 10) {
        response += `\n_...and ${boards.length - 10} more boards_`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error('Error fetching Trello boards:', error);
      await message.reply(`❌ Failed to fetch boards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleTrelloListsCommand(message: Message): Promise<void> {
    if (!this.trelloService) {
      await message.reply('❌ Trello service is not configured.');
      return;
    }

    const args = message.content.split(' ').slice(1);
    if (args.length === 0) {
      await message.reply('❌ Please provide a board ID or name.\nUsage: `!trello-lists <board-id-or-name>`');
      return;
    }

    try {
      await message.reply('📝 Fetching lists...');
      const boardIdentifier = args.join(' ');
      
      // Try to find board by name first, then by ID
      let board = await this.trelloService.findBoardByName(boardIdentifier);
      if (!board) {
        board = await this.trelloService.getBoard(boardIdentifier);
      }

      const lists = await this.trelloService.getLists(board.id);
      
      if (lists.length === 0) {
        await message.reply('No lists found on this board!');
        return;
      }

      let response = `📝 **Lists on "${board.name}":**\n\n`;
      lists.forEach((list, index) => {
        response += `${index + 1}. **${list.name}**\n`;
        response += `   ID: \`${list.id}\`\n\n`;
      });

      await message.reply(response);
    } catch (error) {
      logger.error('Error fetching Trello lists:', error);
      await message.reply(`❌ Failed to fetch lists: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleTrelloCardsCommand(message: Message): Promise<void> {
    if (!this.trelloService) {
      await message.reply('❌ Trello service is not configured.');
      return;
    }

    const args = message.content.split(' ').slice(1);
    if (args.length === 0) {
      await message.reply('❌ Please provide a list ID.\nUsage: `!trello-cards <list-id>`');
      return;
    }

    try {
      await message.reply('🎴 Fetching cards...');
      const listId = args[0];
      const cards = await this.trelloService.getCardsOnList(listId);
      
      if (cards.length === 0) {
        await message.reply('No cards found on this list!');
        return;
      }

      let response = '🎴 **Cards:**\n\n';
      cards.slice(0, 10).forEach((card, index) => {
        response += `${index + 1}. **${card.name}**\n`;
        if (card.desc) {
          response += `   Description: ${card.desc.substring(0, 100)}${card.desc.length > 100 ? '...' : ''}\n`;
        }
        response += `   ID: \`${card.id}\`\n`;
        response += `   URL: ${card.shortUrl}\n\n`;
      });

      if (cards.length > 10) {
        response += `\n_...and ${cards.length - 10} more cards_`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error('Error fetching Trello cards:', error);
      await message.reply(`❌ Failed to fetch cards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleTrelloCreateCommand(message: Message): Promise<void> {
    if (!this.trelloService) {
      await message.reply('❌ Trello service is not configured.');
      return;
    }

    const content = message.content.substring('!trello-create'.length).trim();
    const lines = content.split('\n');
    
    if (lines.length < 2) {
      await message.reply(
        '❌ Invalid format. Usage:\n' +
        '```\n' +
        '!trello-create\n' +
        'list: <list-id>\n' +
        'name: <card-name>\n' +
        'desc: <description> (optional)\n' +
        'due: <date> (optional, format: YYYY-MM-DD)\n' +
        '```'
      );
      return;
    }

    try {
      const params: any = {};
      for (const line of lines) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          params[match[1]] = match[2].trim();
        }
      }

      if (!params.list || !params.name) {
        await message.reply('❌ Both "list" and "name" fields are required!');
        return;
      }

      await message.reply('✨ Creating card...');

      const cardOptions: any = {
        idList: params.list,
        name: params.name,
        pos: 'top'
      };

      if (params.desc) cardOptions.desc = params.desc;
      if (params.due) cardOptions.due = new Date(params.due).toISOString();

      const card = await this.trelloService.createCard(cardOptions);
      
      await message.reply(
        `✅ **Card created successfully!**\n\n` +
        `**Name:** ${card.name}\n` +
        `**ID:** \`${card.id}\`\n` +
        `**URL:** ${card.shortUrl}`
      );
    } catch (error) {
      logger.error('Error creating Trello card:', error);
      await message.reply(`❌ Failed to create card: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleTrelloUpdateCommand(message: Message): Promise<void> {
    if (!this.trelloService) {
      await message.reply('❌ Trello service is not configured.');
      return;
    }

    const content = message.content.substring('!trello-update'.length).trim();
    const lines = content.split('\n');
    
    if (lines.length < 2) {
      await message.reply(
        '❌ Invalid format. Usage:\n' +
        '```\n' +
        '!trello-update\n' +
        'id: <card-id>\n' +
        'name: <new-name> (optional)\n' +
        'desc: <new-description> (optional)\n' +
        'due: <new-date> (optional, format: YYYY-MM-DD)\n' +
        '```'
      );
      return;
    }

    try {
      const params: any = {};
      for (const line of lines) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          params[match[1]] = match[2].trim();
        }
      }

      if (!params.id) {
        await message.reply('❌ Card ID is required!');
        return;
      }

      await message.reply('✏️ Updating card...');

      const updateOptions: any = {};
      if (params.name) updateOptions.name = params.name;
      if (params.desc) updateOptions.desc = params.desc;
      if (params.due) updateOptions.due = new Date(params.due).toISOString();

      const card = await this.trelloService.updateCard(params.id, updateOptions);
      
      await message.reply(
        `✅ **Card updated successfully!**\n\n` +
        `**Name:** ${card.name}\n` +
        `**URL:** ${card.shortUrl}`
      );
    } catch (error) {
      logger.error('Error updating Trello card:', error);
      await message.reply(`❌ Failed to update card: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleTrelloSearchCommand(message: Message): Promise<void> {
    if (!this.trelloService) {
      await message.reply('❌ Trello service is not configured.');
      return;
    }

    const query = message.content.substring('!trello-search'.length).trim();
    
    if (!query) {
      await message.reply('❌ Please provide a search query.\nUsage: `!trello-search <query>`');
      return;
    }

    try {
      await message.reply('🔍 Searching...');
      const cards = await this.trelloService.searchCards({ query });
      
      if (cards.length === 0) {
        await message.reply(`No cards found matching "${query}"`);
        return;
      }

      let response = `🔍 **Search results for "${query}":**\n\n`;
      cards.slice(0, 10).forEach((card, index) => {
        response += `${index + 1}. **${card.name}**\n`;
        if (card.desc) {
          response += `   ${card.desc.substring(0, 80)}${card.desc.length > 80 ? '...' : ''}\n`;
        }
        response += `   URL: ${card.shortUrl}\n\n`;
      });

      if (cards.length > 10) {
        response += `\n_...and ${cards.length - 10} more results_`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error('Error searching Trello cards:', error);
      await message.reply(`❌ Failed to search cards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleTrelloHelpCommand(message: Message): Promise<void> {
    const help = `
📋 **Trello Commands:**

**View Information:**
\`!trello-boards\` - List all your boards
\`!trello-lists <board-id-or-name>\` - List all lists on a board
\`!trello-cards <list-id>\` - List all cards on a list

**Create & Update:**
\`!trello-create\` - Create a new card (see format below)
\`!trello-update\` - Update an existing card (see format below)

**Search:**
\`!trello-search <query>\` - Search for cards

**Create Format:**
\`\`\`
!trello-create
list: <list-id>
name: <card-name>
desc: <description> (optional)
due: YYYY-MM-DD (optional)
\`\`\`

**Update Format:**
\`\`\`
!trello-update
id: <card-id>
name: <new-name> (optional)
desc: <new-description> (optional)
due: YYYY-MM-DD (optional)
\`\`\`

**Examples:**
\`!trello-boards\` - Show all boards
\`!trello-lists AgentFlow\` - Show lists on "AgentFlow" board
\`!trello-search bug fix\` - Search for cards containing "bug fix"
`;
    await message.reply(help);
  }

  getTrelloService(): TrelloService | undefined {
    return this.trelloService;
  }

  // ==================== GOALS COMMANDS ====================

  private async handleGoalsSetupCommand(message: Message): Promise<void> {
    if (!this.goalsScheduler) {
      await message.reply('❌ Goals Scheduler is not initialized yet. Please try again in a few seconds.');
      return;
    }

    try {
      // Parse command format: !goals-setup <channel-id> <user-id> [time] [timezone]
      const args = message.content.split(/\s+/);
      
      if (args.length < 3) {
        await message.reply(
          '❌ **Invalid format!**\n\n' +
          '**Usage:** `!goals-setup <channel-id> <user-id> [time] [timezone]`\n\n' +
          '**Examples:**\n' +
          '• `!goals-setup 1234567890 0987654321` - Setup with defaults (8:00 AM PST)\n' +
          '• `!goals-setup 1234567890 0987654321 09:30` - Setup for 9:30 AM PST\n' +
          '• `!goals-setup 1234567890 0987654321 08:00 America/New_York` - Setup for 8:00 AM EST\n' +
          '• `!goals-setup goals @user` - Use channel name and mention\n\n' +
          '**Quick Setup:** `!goals-setup this @me` - Use this channel and your account'
        );
        return;
      }

      // Handle "this" and current channel
      let channelId = args[1];
      if (channelId === 'this' || channelId === 'here') {
        channelId = message.channelId;
      } else if (channelId.match(/^<#(\d+)>$/)) {
        // Extract channel ID from mention <#123456>
        channelId = channelId.match(/^<#(\d+)>$/)![1];
      } else if (!channelId.match(/^\d+$/)) {
        // Try to find channel by name
        const channel = message.guild?.channels.cache.find(c => c.name === channelId);
        if (channel) {
          channelId = channel.id;
        } else {
          await message.reply(`❌ Could not find channel: ${channelId}`);
          return;
        }
      }

      // Handle "@me" or user mentions
      let userId = args[2];
      if (userId === '@me' || userId === 'me') {
        userId = message.author.id;
      } else if (userId.match(/^<@!?(\d+)>$/)) {
        // Extract user ID from mention <@123456> or <@!123456>
        userId = userId.match(/^<@!?(\d+)>$/)![1];
      }

      // Parse time if provided (format: HH:MM)
      let cronExpression = '0 8 * * *'; // Default: 8:00 AM
      if (args[3]) {
        const timeMatch = args[3].match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const hour = parseInt(timeMatch[1]);
          const minute = parseInt(timeMatch[2]);
          if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
            cronExpression = `${minute} ${hour} * * *`;
          } else {
            await message.reply('❌ Invalid time format. Use HH:MM (e.g., 08:00 or 14:30)');
            return;
          }
        }
      }

      // Parse timezone if provided
      const timezone = args[4] || 'America/Los_Angeles';

      // Schedule the reminder
      this.goalsScheduler.scheduleGoalsReminder(message.guild!.id, {
        goalsChannelId: channelId,
        targetUserId: userId,
        cronExpression,
        timezone
      });

      // Fetch user to display username
      const user = await this.client.users.fetch(userId);
      const channel = await this.client.channels.fetch(channelId);

      await message.reply(
        `✅ **Goals reminder scheduled!**\n\n` +
        `📍 **Channel:** <#${channelId}>\n` +
        `👤 **User:** ${user.username} (<@${userId}>)\n` +
        `⏰ **Time:** ${args[3] || '08:00'} (${timezone})\n` +
        `🔔 **Cron:** \`${cronExpression}\`\n\n` +
        `The agent will tag <@${userId}> every day at the specified time with the question: **"What are your goals for today?"**\n\n` +
        `Use \`!goals-test <user-id>\` to trigger a test reminder now.`
      );

      logger.info(`Goals reminder setup for user ${userId} in channel ${channelId}`);
    } catch (error) {
      logger.error('Error setting up goals reminder:', error);
      await message.reply(`❌ Failed to setup goals reminder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleGoalsTestCommand(message: Message): Promise<void> {
    if (!this.goalsScheduler) {
      await message.reply('❌ Goals Scheduler is not initialized yet.');
      return;
    }

    try {
      // Parse command: !goals-test [@user or user-id]
      const args = message.content.split(/\s+/);
      let userId = message.author.id; // Default to command sender

      if (args.length > 1) {
        if (args[1].match(/^<@!?(\d+)>$/)) {
          userId = args[1].match(/^<@!?(\d+)>$/)![1];
        } else if (args[1].match(/^\d+$/)) {
          userId = args[1];
        }
      }

      // Trigger the reminder
      await this.goalsScheduler.triggerGoalsReminder(
        message.guild!.id,
        message.channelId,
        userId
      );

      await message.reply(`✅ Test goals reminder triggered for <@${userId}>`);
    } catch (error) {
      logger.error('Error triggering test goals reminder:', error);
      await message.reply(`❌ Failed to trigger test reminder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleGoalsHistoryCommand(message: Message): Promise<void> {
    if (!this.goalsScheduler) {
      await message.reply('❌ Goals Scheduler is not initialized yet.');
      return;
    }

    try {
      // Parse command: !goals-history [@user or user-id] [limit]
      const args = message.content.split(/\s+/);
      let userId = message.author.id; // Default to command sender
      let limit = 7; // Default to last 7 days

      if (args.length > 1) {
        if (args[1].match(/^<@!?(\d+)>$/)) {
          userId = args[1].match(/^<@!?(\d+)>$/)![1];
        } else if (args[1].match(/^\d+$/)) {
          userId = args[1];
        }
      }

      if (args.length > 2) {
        const parsedLimit = parseInt(args[2]);
        if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 30) {
          limit = parsedLimit;
        }
      }

      const goals = await this.goalsScheduler.getUserGoals(userId, limit);

      if (goals.length === 0) {
        await message.reply(`📋 No goals history found for <@${userId}>`);
        return;
      }

      const user = await this.client.users.fetch(userId);
      let response = `📋 **Goals History for ${user.username}** (Last ${limit} days)\n\n`;

      goals.forEach((goal, index) => {
        const date = new Date(goal.date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        response += `**${date}**\n`;
        response += `${goal.goals.length > 200 ? goal.goals.slice(0, 200) + '...' : goal.goals}\n\n`;
      });

      // Discord message limit is 2000 characters
      if (response.length > 1900) {
        response = response.slice(0, 1900) + '\n\n_...truncated_';
      }

      await message.reply(response);
    } catch (error) {
      logger.error('Error fetching goals history:', error);
      await message.reply(`❌ Failed to fetch goals history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleGoalsCancelCommand(message: Message): Promise<void> {
    if (!this.goalsScheduler) {
      await message.reply('❌ Goals Scheduler is not initialized yet.');
      return;
    }

    try {
      // Parse command: !goals-cancel <user-id>
      const args = message.content.split(/\s+/);

      if (args.length < 2) {
        await message.reply(
          '❌ **Invalid format!**\n\n' +
          '**Usage:** `!goals-cancel <user-id>`\n' +
          '**Example:** `!goals-cancel 1234567890` or `!goals-cancel @user`'
        );
        return;
      }

      let userId = args[1];
      if (userId.match(/^<@!?(\d+)>$/)) {
        userId = userId.match(/^<@!?(\d+)>$/)![1];
      }

      this.goalsScheduler.cancelScheduledReminder(message.guild!.id, userId);

      await message.reply(`✅ Cancelled scheduled goals reminder for <@${userId}>`);
    } catch (error) {
      logger.error('Error cancelling goals reminder:', error);
      await message.reply(`❌ Failed to cancel goals reminder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleGoalsHelpCommand(message: Message): Promise<void> {
    const help = `
🎯 **Daily Goals Commands:**

**Setup & Management:**
\`!goals-setup <channel> <user> [time] [timezone]\` - Schedule daily goals reminder
  • Examples:
    - \`!goals-setup this @me\` - Use this channel, current user, 8:00 AM PST
    - \`!goals-setup goals @user 09:00\` - Channel named "goals", 9:00 AM PST
    - \`!goals-setup 1234567890 9876543210 08:00 America/New_York\` - Full format

\`!goals-test [@user]\` - Trigger a test reminder now
\`!goals-cancel <user-id>\` - Cancel scheduled reminder
\`!goals-history [@user] [limit]\` - View goals history (default: 7 days)

**How it works:**
1. Setup a daily reminder with \`!goals-setup\`
2. The agent will tag the specified user every day at the scheduled time
3. When the user replies, their goals are automatically saved to the database
4. View past goals with \`!goals-history\`

**Timezones:**
Common timezones: \`America/Los_Angeles\` (PST), \`America/New_York\` (EST), \`America/Chicago\` (CST), \`Europe/London\` (GMT), etc.

**Quick Start:**
\`!goals-setup this @me\` - Set up for yourself in this channel at 8:00 AM PST
\`!goals-test\` - Test it now to see how it works
`;
    await message.reply(help);
  }
}
