import dotenv from 'dotenv';
import { BotConfig } from '../types';

dotenv.config();

export function loadConfig(): BotConfig {
  const requiredEnvVars = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_AGENT_ID',
    'ANTHROPIC_API_KEY',
    'ORCHESTRATOR_URL',
    'ORCHESTRATOR_API_KEY'
  ];

  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }

  const ttsSpeed = parseFloat(process.env.TTS_SPEED || '1.0');

  return {
    discordToken: process.env.DISCORD_TOKEN!,
    discordClientId: process.env.DISCORD_CLIENT_ID!,
    openaiApiKey: process.env.OPENAI_API_KEY || '', // Now optional since we use ElevenLabs
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY!,
    elevenLabsAgentId: process.env.ELEVENLABS_AGENT_ID!,
    groqApiKey: process.env.GROQ_API_KEY,
    orchestratorUrl: process.env.ORCHESTRATOR_URL!,
    orchestratorApiKey: process.env.ORCHESTRATOR_API_KEY!,
    allowedUserIds: process.env.ALLOWED_USER_IDS?.split(',').filter(id => id.trim().length > 0) || [],
    maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '5', 10),
    useRealtimeApi: process.env.USE_REALTIME_API === 'true',
    systemNotificationGuildId: process.env.SYSTEM_NOTIFICATION_GUILD_ID,
    systemNotificationChannelId: process.env.SYSTEM_NOTIFICATION_CHANNEL_ID,
    ttsSpeed: Math.max(0.25, Math.min(4.0, ttsSpeed)),
    trelloApiKey: process.env.TRELLO_API_KEY,
    trelloApiToken: process.env.TRELLO_API_TOKEN,
    // Market updates configuration
    marketUpdatesEnabled: process.env.MARKET_UPDATES_ENABLED === 'true',
    marketUpdatesGuildId: process.env.MARKET_UPDATES_GUILD_ID,
    marketUpdatesDailyCron: process.env.MARKET_UPDATES_DAILY_CRON || '0 9 * * 1-5',
    marketUpdatesCloseCron: process.env.MARKET_UPDATES_CLOSE_CRON || '5 16 * * 1-5',
    marketUpdatesNewsCron: process.env.MARKET_UPDATES_NEWS_CRON || '0 9-16 * * 1-5',
    marketUpdatesWeeklyCron: process.env.MARKET_UPDATES_WEEKLY_CRON || '0 18 * * 0',
    marketUpdatesTimezone: process.env.MARKET_UPDATES_TIMEZONE || 'America/New_York',
    // News monitoring
    finnhubApiKey: process.env.FINNHUB_API_KEY,
    finnhubWebhookSecret: process.env.FINNHUB_WEBHOOK_SECRET,
    // Database configuration
    databaseType: (process.env.DATABASE_TYPE as 'sqlite' | 'cloudsql') || 'sqlite',
    cloudSqlInstanceConnectionName: process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME,
    cloudSqlDatabase: process.env.CLOUDSQL_DATABASE,
    cloudSqlUser: process.env.CLOUDSQL_USER,
    cloudSqlPassword: process.env.CLOUDSQL_PASSWORD
  };
}

export function validateConfig(config: BotConfig): void {
  if (config.maxConcurrentAgents < 1 || config.maxConcurrentAgents > 20) {
    throw new Error('MAX_CONCURRENT_AGENTS must be between 1 and 20');
  }

  if (!config.orchestratorUrl.startsWith('http')) {
    throw new Error('ORCHESTRATOR_URL must be a valid HTTP/HTTPS URL');
  }

  if (config.ttsSpeed !== undefined && (config.ttsSpeed < 0.25 || config.ttsSpeed > 4.0)) {
    throw new Error('TTS_SPEED must be between 0.25 and 4.0');
  }
}
