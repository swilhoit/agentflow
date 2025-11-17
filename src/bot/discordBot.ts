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

export class DiscordBot {
  private client: Client;
  private config: BotConfig;
  private whisperService: WhisperService;
  private ttsService: TextToSpeechService;
  private voiceReceiver: VoiceReceiver;
  private voicePlayer: VoicePlayer;
  private commandCallback?: (command: VoiceCommand) => Promise<void>;

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
    this.ttsService = new TextToSpeechService(config.openaiApiKey);
    this.voiceReceiver = new VoiceReceiver(this.whisperService);
    this.voicePlayer = new VoicePlayer();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      logger.info(`Bot logged in as ${this.client.user?.tag}`);
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

      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

      logger.info(`Joined voice channel ${member.voice.channel.name}`);

      // Start listening to voice
      this.voiceReceiver.startListening(connection, message.guild!.id);

      await message.reply('Joined voice channel and started listening!');
    } catch (error) {
      logger.error('Failed to join voice channel', error);
      await message.reply('Failed to join voice channel!');
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

      // Setup periodic cleanup of temp files
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
}
