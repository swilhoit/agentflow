import { loadConfig, validateConfig } from './utils/config';
import { logger, LogLevel } from './utils/logger';
import { DiscordBot } from './bot/discordBot';
import { DiscordBotRealtime } from './bot/discordBotRealtime';
import { OrchestratorServer } from './orchestrator/orchestratorServer';
import { VoiceCommand, OrchestratorRequest } from './types';

async function main() {
  try {
    // Set log level from environment
    const logLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    logger.setLevel(LogLevel[logLevel as keyof typeof LogLevel] || LogLevel.INFO);

    logger.info('Starting AgentFlow...');

    // Load and validate configuration
    const config = loadConfig();
    validateConfig(config);

    logger.info('Configuration loaded successfully');

    // Start orchestrator server
    const orchestratorServer = new OrchestratorServer(config);
    await orchestratorServer.start();

    logger.info('Orchestrator server started');

    // Choose bot mode based on configuration
    if (config.useRealtimeApi) {
      logger.info('Using OpenAI Realtime API mode (natural conversations)');

      // Start Realtime API bot (no voice command handler needed - integrated)
      const bot = new DiscordBotRealtime(config);
      await bot.start();

      logger.info('AgentFlow started successfully (Realtime API Mode)');

      // Graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('Shutting down gracefully...');
        await bot.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        logger.info('Shutting down gracefully...');
        await bot.stop();
        process.exit(0);
      });

      return; // Exit early, don't run old bot code
    }

    // Legacy mode: Use original bot with Whisper + Claude + TTS
    logger.info('Using legacy mode (Whisper + Claude + TTS)');
    const bot = new DiscordBot(config);

    // Set up voice command handler
    bot.onVoiceCommand(async (command: VoiceCommand) => {
      logger.info(`Received voice command: ${command.transcript}`);

      // Send to orchestrator
      const request: OrchestratorRequest = {
        command: command.transcript,
        context: {
          userId: command.userId,
          guildId: command.guildId,
          channelId: command.channelId,
          timestamp: command.timestamp
        },
        priority: 'normal',
        requiresSubAgents: false
      };

      try {
        const response = await fetch(`${config.orchestratorUrl}/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': config.orchestratorApiKey
          },
          body: JSON.stringify(request)
        });

        const result = await response.json() as { success: boolean; response?: string; error?: string };
        logger.info(`Orchestrator response: ${JSON.stringify(result)}`);

        // Send voice response back to Discord
        if (result.success && result.response) {
          await bot.sendVoiceResponse(command.guildId, result.response);
        } else if (!result.success) {
          await bot.sendVoiceResponse(command.guildId, "I'm sorry, I encountered an error processing your request.");
        }
      } catch (error) {
        logger.error('Failed to process voice command', error);
        // Send error response
        try {
          await bot.sendVoiceResponse(command.guildId, "I'm sorry, I'm having trouble connecting right now.");
        } catch (e) {
          logger.error('Failed to send error voice response', e);
        }
      }
    });

    await bot.start();

    logger.info('AgentFlow started successfully');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start AgentFlow', error);
    process.exit(1);
  }
}

main();
