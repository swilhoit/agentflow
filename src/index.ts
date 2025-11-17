import { loadConfig, validateConfig } from './utils/config';
import { logger, LogLevel } from './utils/logger';
import { DiscordBot } from './bot/discordBot';
import { DiscordBotRealtime } from './bot/discordBotRealtime';
import { OrchestratorServer } from './orchestrator/orchestratorServer';
import { VoiceCommand, OrchestratorRequest } from './types';
import { getDatabase } from './services/database';
import { TrelloService } from './services/trello';
import * as fs from 'fs';
import * as path from 'path';

// Process lock file management
const LOCK_FILE = path.join(process.cwd(), 'data', '.agentflow.lock');

function checkAndCreateLock(): boolean {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(LOCK_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Check if lock file exists
    if (fs.existsSync(LOCK_FILE)) {
      const pidStr = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
      const oldPid = parseInt(pidStr, 10);

      // Check if the process is still running
      try {
        process.kill(oldPid, 0); // Signal 0 checks if process exists
        logger.error(`❌ CRITICAL: Another instance (PID: ${oldPid}) is already running!`);
        logger.error('Please stop the other instance first or remove the lock file if it\'s stale.');
        logger.error(`Lock file: ${LOCK_FILE}`);
        return false;
      } catch (e) {
        // Process doesn't exist, lock file is stale
        logger.warn(`Removing stale lock file from PID ${oldPid}`);
        fs.unlinkSync(LOCK_FILE);
      }
    }

    // Create new lock file with current PID
    fs.writeFileSync(LOCK_FILE, process.pid.toString());
    logger.info(`Created process lock file: ${LOCK_FILE} (PID: ${process.pid})`);
    return true;
  } catch (error) {
    logger.error('Failed to create process lock', error);
    return false;
  }
}

function removeLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
      logger.info('Removed process lock file');
    }
  } catch (error) {
    logger.error('Failed to remove lock file', error);
  }
}

async function main() {
  try {
    // Set log level from environment
    const logLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    logger.setLevel(LogLevel[logLevel as keyof typeof LogLevel] || LogLevel.INFO);

    logger.info('Starting AgentFlow...');

    // Check for existing instance
    if (!checkAndCreateLock()) {
      process.exit(1);
    }

    // Load and validate configuration
    const config = loadConfig();
    validateConfig(config);

    logger.info('Configuration loaded successfully');

    // Initialize Trello service if credentials are provided
    let trelloService: TrelloService | undefined;
    if (config.trelloApiKey && config.trelloApiToken) {
      try {
        trelloService = new TrelloService(config.trelloApiKey, config.trelloApiToken);
        logger.info('✅ Trello service initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize Trello service:', error);
        logger.warn('Continuing without Trello integration');
      }
    } else {
      logger.info('Trello credentials not configured - Trello integration disabled');
    }

    // Start orchestrator server with Trello service
    const orchestratorServer = new OrchestratorServer(config, 3001, trelloService);
    await orchestratorServer.start();

    logger.info('Orchestrator server started');

    // Initialize bot first to get message handler
    let bot: DiscordBot | DiscordBotRealtime;

    // Choose bot mode based on configuration
    if (config.useRealtimeApi) {
      logger.info('Using OpenAI Realtime API mode (natural conversations)');

      // Start Realtime API bot (no voice command handler needed - integrated)
      bot = new DiscordBotRealtime(config);
      await bot.start();

      logger.info('AgentFlow started successfully (Realtime API Mode)');

      // Graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('Shutting down gracefully...');
        await bot.stop();
        await orchestratorServer.stop();
        getDatabase().close();
        removeLock();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        logger.info('Shutting down gracefully...');
        await bot.stop();
        await orchestratorServer.stop();
        getDatabase().close();
        removeLock();
        process.exit(0);
      });

      return; // Exit early, don't run old bot code
    }

    // Legacy mode: Use original bot with Whisper + Claude + TTS
    logger.info('Using legacy mode (Whisper + Claude + TTS)');
    bot = new DiscordBot(config);

    // Wire up the Discord message handler to the orchestrator
    if (config.systemNotificationChannelId) {
      orchestratorServer.setDiscordMessageHandler(async (channelId: string, message: string) => {
        await (bot as DiscordBot).sendTextMessage(channelId, message);
      });
      logger.info(`Agent notifications will be sent to channel: ${config.systemNotificationChannelId}`);
    } else {
      logger.warn('No systemNotificationChannelId configured - agent notifications disabled');
    }

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
      await orchestratorServer.stop();
      getDatabase().close();
      removeLock();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down gracefully...');
      await bot.stop();
      await orchestratorServer.stop();
      getDatabase().close();
      removeLock();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start AgentFlow', error);
    process.exit(1);
  }
}

main();
