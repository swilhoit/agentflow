/**
 * Multi-Tenant Discord Bot
 * 
 * A single bot instance that serves multiple users across their own Discord servers.
 * Each guild is linked to a registered user with isolated data and credentials.
 */

import {
  Client,
  GatewayIntentBits,
  Events,
  Message,
  Guild,
  VoiceState,
  Interaction,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getTenantResolver, TenantInfo, UserCredentials } from '../services/tenantResolver';
import { getTenantDatabase, TenantDatabase } from '../services/multiTenantDatabase';
import { logger } from '../utils/logger';

// Command prefix
const PREFIX = '!';

// Bot registration URL template
const REGISTRATION_URL = process.env.APP_URL || 'https://app.agentflow.ai';

interface GuildContext {
  tenant: TenantInfo;
  db: TenantDatabase;
  credentials: UserCredentials;
}

export class MultiTenantDiscordBot {
  private client: Client;
  private tenantResolver = getTenantResolver();
  
  // Cache active guild contexts
  private guildContexts: Map<string, GuildContext> = new Map();

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Bot ready
    this.client.on(Events.ClientReady, () => {
      logger.info(`[MultiTenantBot] Logged in as ${this.client.user?.tag}`);
      logger.info(`[MultiTenantBot] Serving ${this.client.guilds.cache.size} guilds`);
      
      // Set bot status
      this.client.user?.setActivity('!help | app.agentflow.ai', { type: 3 }); // "Watching"
    });

    // Guild join - bot added to a new server
    this.client.on(Events.GuildCreate, async (guild) => {
      await this.handleGuildJoin(guild);
    });

    // Guild leave - bot removed from server
    this.client.on(Events.GuildDelete, async (guild) => {
      await this.handleGuildLeave(guild);
    });

    // Message handler
    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      await this.handleMessage(message);
    });

    // Interaction handler (slash commands, buttons)
    this.client.on(Events.InteractionCreate, async (interaction) => {
      await this.handleInteraction(interaction);
    });

    // Voice state changes
    this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      await this.handleVoiceStateUpdate(oldState, newState);
    });

    // Error handling
    this.client.on(Events.Error, (error) => {
      logger.error('[MultiTenantBot] Client error:', error);
    });
  }

  /**
   * Handle bot being added to a new server
   */
  private async handleGuildJoin(guild: Guild): Promise<void> {
    logger.info(`[MultiTenantBot] Joined guild: ${guild.name} (${guild.id})`);

    // Check if guild is already registered
    const tenant = await this.tenantResolver.resolveTenant(guild.id);

    // Find a suitable channel to send welcome message
    const channel = guild.systemChannel || 
      guild.channels.cache.find(ch => 
        ch.type === ChannelType.GuildText && 
        ch.permissionsFor(guild.members.me!)?.has('SendMessages')
      );

    if (!channel || channel.type !== ChannelType.GuildText) {
      logger.warn(`[MultiTenantBot] No suitable channel found in ${guild.name}`);
      return;
    }

    if (tenant) {
      // Guild already registered - welcome back
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🤖 AgentFlow Connected!')
        .setDescription(`This server is linked to your AgentFlow account.`)
        .addFields(
          { name: 'Subscription', value: tenant.subscriptionTier.toUpperCase(), inline: true },
          { name: 'Status', value: tenant.isActive ? '✅ Active' : '❌ Inactive', inline: true },
        )
        .setFooter({ text: 'Type !help to see available commands' });

      await channel.send({ embeds: [embed] });
    } else {
      // New guild - needs registration
      const embed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle('👋 Welcome to AgentFlow!')
        .setDescription(
          `Thanks for adding AgentFlow! To activate the bot, you need to connect this server to your account.`
        )
        .addFields(
          { 
            name: '🔗 Connect Your Server', 
            value: `Visit [${REGISTRATION_URL}/connect](${REGISTRATION_URL}/connect?guild=${guild.id}) to link this server.` 
          },
          { 
            name: '📚 What is AgentFlow?', 
            value: 'Voice-driven AI assistant for coding, finances, project management, and more.' 
          },
        )
        .setFooter({ text: 'After connecting, type !help to see available commands' });

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Connect Server')
            .setURL(`${REGISTRATION_URL}/connect?guild=${guild.id}`)
            .setStyle(ButtonStyle.Link),
          new ButtonBuilder()
            .setLabel('Learn More')
            .setURL(`${REGISTRATION_URL}/features`)
            .setStyle(ButtonStyle.Link),
        );

      await channel.send({ embeds: [embed], components: [row] });
    }
  }

  /**
   * Handle bot being removed from a server
   */
  private async handleGuildLeave(guild: Guild): Promise<void> {
    logger.info(`[MultiTenantBot] Left guild: ${guild.name} (${guild.id})`);
    
    // Clear cached context
    this.guildContexts.delete(guild.id);
    
    // Note: We don't automatically unregister - user might re-add the bot
    // They can manually disconnect from the web app
  }

  /**
   * Get or create guild context (tenant, db, credentials)
   */
  private async getGuildContext(guildId: string): Promise<GuildContext | null> {
    // Check cache
    const cached = this.guildContexts.get(guildId);
    if (cached) return cached;

    // Resolve tenant
    const tenant = await this.tenantResolver.resolveTenant(guildId);
    if (!tenant || !tenant.isActive) {
      return null;
    }

    // Get database and credentials
    const db = await getTenantDatabase(guildId);
    if (!db) return null;

    const credentials = await this.tenantResolver.getUserCredentials(tenant.userId);

    const context: GuildContext = { tenant, db, credentials };
    this.guildContexts.set(guildId, context);

    return context;
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(message: Message): Promise<void> {
    // Ignore DMs for now (could be used for registration)
    if (!message.guild) {
      await this.handleDirectMessage(message);
      return;
    }

    const guildId = message.guild.id;

    // Check if message starts with prefix
    if (!message.content.startsWith(PREFIX)) {
      return;
    }

    // Get guild context
    const context = await this.getGuildContext(guildId);

    if (!context) {
      // Guild not registered
      await this.sendNotRegisteredMessage(message);
      return;
    }

    // Parse command
    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    // Log the message
    await context.db.saveMessage({
      guildId,
      channelId: message.channel.id,
      username: message.author.username,
      message: message.content,
      messageType: 'text',
      timestamp: new Date(),
    });

    // Route to command handler
    try {
      await this.handleCommand(command, args, message, context);
    } catch (error) {
      logger.error(`[MultiTenantBot] Command error:`, error);
      await message.reply('❌ An error occurred while processing your command.');
    }
  }

  /**
   * Handle DMs - used for registration and support
   */
  private async handleDirectMessage(message: Message): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('AgentFlow Bot')
      .setDescription(
        `To use AgentFlow, add the bot to your Discord server and connect it to your account.`
      )
      .addFields(
        { name: 'Add to Server', value: `[Click here](${REGISTRATION_URL}/invite)` },
        { name: 'Support', value: `[Help Center](${REGISTRATION_URL}/help)` },
      );

    await message.reply({ embeds: [embed] });
  }

  /**
   * Send "not registered" message
   */
  private async sendNotRegisteredMessage(message: Message): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('⚠️ Server Not Connected')
      .setDescription(
        `This server isn't connected to an AgentFlow account yet.`
      )
      .addFields({
        name: 'Connect Now',
        value: `Visit [${REGISTRATION_URL}/connect](${REGISTRATION_URL}/connect?guild=${message.guild?.id}) to link this server.`,
      });

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Connect Server')
          .setURL(`${REGISTRATION_URL}/connect?guild=${message.guild?.id}`)
          .setStyle(ButtonStyle.Link),
      );

    await message.reply({ embeds: [embed], components: [row] });
  }

  /**
   * Command router
   */
  private async handleCommand(
    command: string,
    args: string[],
    message: Message,
    context: GuildContext
  ): Promise<void> {
    switch (command) {
      case 'help':
        await this.cmdHelp(message, context);
        break;
      
      case 'status':
        await this.cmdStatus(message, context);
        break;

      case 'agents':
        await this.cmdAgents(message, args, context);
        break;

      case 'task':
        await this.cmdTask(message, args, context);
        break;

      case 'goals':
        await this.cmdGoals(message, args, context);
        break;

      case 'finances':
        await this.cmdFinances(message, args, context);
        break;

      case 'watchlist':
        await this.cmdWatchlist(message, args, context);
        break;

      case 'join':
        await this.cmdJoinVoice(message, context);
        break;

      case 'leave':
        await this.cmdLeaveVoice(message, context);
        break;

      default:
        // Treat as agent command
        await this.cmdAgent(command, args, message, context);
    }
  }

  /**
   * !help - Show available commands
   */
  private async cmdHelp(message: Message, context: GuildContext): Promise<void> {
    const { tenant } = context;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('AgentFlow Commands')
      .setDescription(`Your plan: **${tenant.subscriptionTier.toUpperCase()}**`)
      .addFields(
        { name: '🤖 Agent Commands', value: 
          '`!status` - Check bot and account status\n' +
          '`!agents` - List active agent tasks\n' +
          '`!task <description>` - Create a new agent task\n' +
          '`!task-status <id>` - Check task status\n' +
          '`!cancel-task <id>` - Cancel a running task'
        },
        { name: '📊 Finance Commands', value:
          '`!finances` - View spending summary\n' +
          '`!finances sync` - Sync bank transactions\n' +
          '`!watchlist` - View stock watchlist\n' +
          '`!watchlist add <symbol>` - Add to watchlist'
        },
        { name: '🎯 Goals Commands', value:
          '`!goals` - View today\'s goals\n' +
          '`!goals set <goals>` - Set daily goals\n' +
          '`!goals history` - View past goals'
        },
      );

    if (tenant.features.voiceEnabled) {
      embed.addFields({
        name: '🎙️ Voice Commands',
        value:
          '`!join` - Join your voice channel\n' +
          '`!leave` - Leave voice channel\n' +
          '*Then just talk to the bot!*',
      });
    } else {
      embed.addFields({
        name: '🎙️ Voice Commands',
        value: `*Voice features require Pro plan.* [Upgrade](${REGISTRATION_URL}/upgrade)`,
      });
    }

    await message.reply({ embeds: [embed] });
  }

  /**
   * !status - Show account status
   */
  private async cmdStatus(message: Message, context: GuildContext): Promise<void> {
    const { tenant, db } = context;
    const stats = await db.getStatistics();

    const embed = new EmbedBuilder()
      .setColor(tenant.isActive ? 0x00FF00 : 0xFF0000)
      .setTitle('AgentFlow Status')
      .addFields(
        { name: 'Plan', value: tenant.subscriptionTier.toUpperCase(), inline: true },
        { name: 'Status', value: tenant.isActive ? '✅ Active' : '❌ Inactive', inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'Agent Tasks', value: `${stats.activeAgentTasks} active / ${stats.totalAgentTasks} total`, inline: true },
        { name: 'Monthly Usage', value: 
          tenant.features.maxAgentTasks === -1 
            ? `${stats.monthlyAgentUsage} tasks` 
            : `${stats.monthlyAgentUsage} / ${tenant.features.maxAgentTasks}`,
          inline: true 
        },
        { name: 'Messages', value: stats.totalMessages.toString(), inline: true },
      )
      .setFooter({ text: `Guild: ${message.guild?.name}` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  /**
   * !agents - List active agent tasks
   */
  private async cmdAgents(message: Message, args: string[], context: GuildContext): Promise<void> {
    const { db } = context;
    const showAll = args.includes('--all');
    
    const tasks = showAll 
      ? await db.getRecentAgentTasks(20)
      : await db.getActiveAgentTasks();

    if (tasks.length === 0) {
      await message.reply('No active agent tasks. Use `!task <description>` to create one.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(showAll ? 'Recent Agent Tasks' : 'Active Agent Tasks')
      .setDescription(
        tasks.map(task => {
          const statusEmoji = {
            pending: '⏳',
            running: '🔄',
            completed: '✅',
            failed: '❌',
            cancelled: '🚫',
          }[task.status] || '❓';
          
          const desc = task.taskDescription.length > 50 
            ? task.taskDescription.slice(0, 50) + '...' 
            : task.taskDescription;
          
          return `${statusEmoji} \`${task.taskId.slice(0, 8)}\` ${desc}`;
        }).join('\n')
      );

    await message.reply({ embeds: [embed] });
  }

  /**
   * !task <description> - Create agent task
   */
  private async cmdTask(message: Message, args: string[], context: GuildContext): Promise<void> {
    const { tenant, db, credentials } = context;
    const description = args.join(' ');

    if (!description) {
      await message.reply('Usage: `!task <description>`\nExample: `!task List all my GitHub repositories`');
      return;
    }

    // Check feature access
    const access = await this.tenantResolver.checkFeatureAccess(message.guild!.id, 'maxAgentTasks');
    if (!access.allowed) {
      await message.reply(`❌ ${access.reason}`);
      return;
    }

    // Check if we have AI credentials
    if (!credentials.anthropicApiKey) {
      await message.reply('❌ AI provider not configured. Visit the dashboard to add your API key.');
      return;
    }

    // Create task
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const created = await db.createAgentTask({
      taskId,
      guildId: message.guild!.id,
      channelId: message.channel.id,
      taskDescription: description,
      status: 'pending',
      startedAt: new Date(),
    });

    if (!created) {
      const stats = await db.getStatistics();
      await message.reply(
        `❌ Unable to create task. You've used ${stats.monthlyAgentUsage}/${tenant.features.maxAgentTasks} tasks this month.`
      );
      return;
    }

    await message.reply(`✅ Task created: \`${taskId}\`\nDescription: ${description}\n\n*Processing...*`);

    // Execute the task (this would integrate with your existing agent system)
    // For now, just mark it as running
    await this.executeAgentTask(taskId, description, message, context);
  }

  /**
   * Execute an agent task
   */
  private async executeAgentTask(
    taskId: string,
    description: string,
    message: Message,
    context: GuildContext
  ): Promise<void> {
    const { db, credentials } = context;

    try {
      // Update to running
      await db.updateAgentTask(taskId, { status: 'running' });

      // TODO: Integrate with your existing ToolBasedAgent
      // This is where you'd create an instance with the user's credentials
      
      // For demonstration, we'll just simulate
      logger.info(`[MultiTenantBot] Executing task ${taskId}: ${description}`);

      // Placeholder: In production, this connects to your agent system
      // const agent = new ToolBasedAgent(credentials.anthropicApiKey!);
      // const result = await agent.execute(description);

      // Simulate completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      await db.updateAgentTask(taskId, {
        status: 'completed',
        completedAt: new Date(),
        result: JSON.stringify({ success: true, message: 'Task completed successfully' }),
        iterations: 1,
        toolCalls: 0,
        tokensUsed: 100,
      });

      await message.channel.send(`✅ Task \`${taskId.slice(0, 8)}\` completed!`);

    } catch (error: any) {
      await db.updateAgentTask(taskId, {
        status: 'failed',
        completedAt: new Date(),
        error: error.message,
      });

      await message.channel.send(`❌ Task \`${taskId.slice(0, 8)}\` failed: ${error.message}`);
    }
  }

  /**
   * !goals - Goals commands
   */
  private async cmdGoals(message: Message, args: string[], context: GuildContext): Promise<void> {
    const { db } = context;
    const subCommand = args[0]?.toLowerCase();
    const today = new Date().toISOString().split('T')[0];

    if (subCommand === 'set') {
      const goals = args.slice(1).join(' ');
      if (!goals) {
        await message.reply('Usage: `!goals set <your goals for today>`');
        return;
      }

      await db.saveDailyGoal({ date: today, goals });
      await message.reply(`✅ Goals set for ${today}:\n${goals}`);

    } else if (subCommand === 'history') {
      const history = await db.getGoalsHistory(7);
      
      if (history.length === 0) {
        await message.reply('No goals history found. Use `!goals set <goals>` to start tracking.');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Goals History')
        .setDescription(
          history.map(g => `**${g.date}**\n${g.goals}`).join('\n\n')
        );

      await message.reply({ embeds: [embed] });

    } else {
      // Show today's goals
      const goal = await db.getDailyGoal(today);

      if (!goal) {
        await message.reply(`No goals set for today. Use \`!goals set <goals>\` to set them.`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Goals for ${today}`)
        .setDescription(goal.goals);

      await message.reply({ embeds: [embed] });
    }
  }

  /**
   * !finances - Finance commands
   */
  private async cmdFinances(message: Message, args: string[], context: GuildContext): Promise<void> {
    const { db, credentials } = context;

    if (args[0] === 'sync') {
      if (!credentials.tellerAccessToken) {
        await message.reply('❌ No bank accounts connected. Visit the dashboard to connect your bank.');
        return;
      }

      await message.reply('🔄 Syncing transactions... (This would trigger a Teller sync)');
      // TODO: Implement actual Teller sync with user's token
      return;
    }

    // Show spending summary
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const transactions = await db.getRecentTransactions(30, 10);

    if (transactions.length === 0) {
      await message.reply('No transactions found. Connect your bank at the dashboard to sync transactions.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Recent Transactions')
      .setDescription(
        transactions.map(tx => {
          const amount = tx.amount < 0 ? `📉 $${Math.abs(tx.amount).toFixed(2)}` : `📈 $${tx.amount.toFixed(2)}`;
          return `${tx.date} | ${amount} | ${tx.description.slice(0, 30)}`;
        }).join('\n')
      )
      .setFooter({ text: 'View full details at app.agentflow.ai/finances' });

    await message.reply({ embeds: [embed] });
  }

  /**
   * !watchlist - Stock watchlist commands
   */
  private async cmdWatchlist(message: Message, args: string[], context: GuildContext): Promise<void> {
    const { db } = context;

    if (args[0] === 'add' && args[1]) {
      const symbol = args[1].toUpperCase();
      const success = await db.addToWatchlist(symbol);
      
      if (success) {
        await message.reply(`✅ Added **${symbol}** to your watchlist.`);
      } else {
        await message.reply(`❌ Unable to add ${symbol}. You may have reached your watchlist limit.`);
      }
      return;
    }

    if (args[0] === 'remove' && args[1]) {
      const symbol = args[1].toUpperCase();
      await db.removeFromWatchlist(symbol);
      await message.reply(`✅ Removed **${symbol}** from your watchlist.`);
      return;
    }

    // Show watchlist
    const watchlist = await db.getWatchlist();

    if (watchlist.length === 0) {
      await message.reply('Your watchlist is empty. Use `!watchlist add <symbol>` to add stocks.');
      return;
    }

    const marketData = await db.getMarketDataForWatchlist(1);
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📊 Your Watchlist')
      .setDescription(
        watchlist.map(symbol => {
          const data = marketData.find(d => d.symbol === symbol);
          if (data) {
            const change = data.changePercent >= 0 ? `📈 +${data.changePercent.toFixed(2)}%` : `📉 ${data.changePercent.toFixed(2)}%`;
            return `**${symbol}** $${data.price.toFixed(2)} ${change}`;
          }
          return `**${symbol}** (no data)`;
        }).join('\n')
      );

    await message.reply({ embeds: [embed] });
  }

  /**
   * !join - Join voice channel
   */
  private async cmdJoinVoice(message: Message, context: GuildContext): Promise<void> {
    const { tenant } = context;

    if (!tenant.features.voiceEnabled) {
      await message.reply(`🎙️ Voice features require Pro plan. [Upgrade](${REGISTRATION_URL}/upgrade)`);
      return;
    }

    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
      await message.reply('❌ You need to be in a voice channel first.');
      return;
    }

    // TODO: Implement voice connection with user's ElevenLabs credentials
    // This would integrate with your existing realtimeVoiceReceiver
    await message.reply(`🎙️ Voice joining is being set up... (Integration pending)`);
  }

  /**
   * !leave - Leave voice channel
   */
  private async cmdLeaveVoice(message: Message, context: GuildContext): Promise<void> {
    // TODO: Disconnect from voice
    await message.reply('👋 Left voice channel.');
  }

  /**
   * Handle generic agent command (anything not matching other commands)
   */
  private async cmdAgent(
    command: string,
    args: string[],
    message: Message,
    context: GuildContext
  ): Promise<void> {
    // Treat the whole message as a task
    const description = `${command} ${args.join(' ')}`.trim();
    await this.cmdTask(message, [description], context);
  }

  /**
   * Handle interactions (buttons, slash commands)
   */
  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (interaction.isButton()) {
      // Handle button clicks
      logger.info(`[MultiTenantBot] Button clicked: ${interaction.customId}`);
    }
  }

  /**
   * Handle voice state changes
   */
  private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    // Handle user joining/leaving voice channels
    // Used for auto-disconnect when alone, etc.
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      throw new Error('DISCORD_TOKEN is required');
    }

    await this.client.login(token);
    logger.info('[MultiTenantBot] Bot started');
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    this.client.destroy();
    logger.info('[MultiTenantBot] Bot stopped');
  }

  /**
   * Get the Discord client
   */
  getClient(): Client {
    return this.client;
  }
}

// Export a factory function
export function createMultiTenantBot(): MultiTenantDiscordBot {
  return new MultiTenantDiscordBot();
}

