import dotenv from 'dotenv';
import { BotConfig } from '../types';

dotenv.config();

export function loadConfig(): BotConfig {
  const requiredEnvVars = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'ORCHESTRATOR_URL',
    'ORCHESTRATOR_API_KEY'
  ];

  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }

  return {
    discordToken: process.env.DISCORD_TOKEN!,
    discordClientId: process.env.DISCORD_CLIENT_ID!,
    openaiApiKey: process.env.OPENAI_API_KEY!,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    groqApiKey: process.env.GROQ_API_KEY,
    orchestratorUrl: process.env.ORCHESTRATOR_URL!,
    orchestratorApiKey: process.env.ORCHESTRATOR_API_KEY!,
    allowedUserIds: process.env.ALLOWED_USER_IDS?.split(',').filter(id => id.trim().length > 0) || [],
    maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '5', 10),
    useRealtimeApi: process.env.USE_REALTIME_API === 'true',
    systemNotificationGuildId: process.env.SYSTEM_NOTIFICATION_GUILD_ID,
    systemNotificationChannelId: process.env.SYSTEM_NOTIFICATION_CHANNEL_ID
  };
}

export function validateConfig(config: BotConfig): void {
  if (config.maxConcurrentAgents < 1 || config.maxConcurrentAgents > 20) {
    throw new Error('MAX_CONCURRENT_AGENTS must be between 1 and 20');
  }

  if (!config.orchestratorUrl.startsWith('http')) {
    throw new Error('ORCHESTRATOR_URL must be a valid HTTP/HTTPS URL');
  }
}
