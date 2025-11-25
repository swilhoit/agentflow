import { loadConfig, validateConfig } from './utils/config';
import { logger, LogLevel } from './utils/logger';
import { DiscordBot } from './bot/discordBot';
import { DiscordBotRealtime } from './bot/discordBotRealtime';
import { OrchestratorServer } from './orchestrator/orchestratorServer';
import { VoiceCommand, OrchestratorRequest } from './types';
import { getDatabase } from './services/databaseFactory';
import { TrelloService } from './services/trello';
import { getCleanupManager } from './utils/cleanupManager';
import { MarketUpdateScheduler, DEFAULT_SCHEDULE_CONFIG } from './services/marketUpdateScheduler';
import { startCacheCleanup, globalCache } from './utils/smartCache';
import { SupervisorService } from './services/supervisor';
import { VercelIntegration } from './services/vercelIntegration';
import { AgentManagerService } from './services/agentManager';
import { DeploymentTracker, createDeploymentTrackerFromEnv } from './services/deploymentTracker';
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

    // Auto-detect GitHub token from gh CLI if not already set
    if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
      try {
        const { execSync } = require('child_process');
        const token = execSync('gh auth token 2>/dev/null', { encoding: 'utf-8' }).trim();
        if (token && token.startsWith('gho_') || token.startsWith('ghp_')) {
          process.env.GITHUB_TOKEN = token;
          process.env.GH_TOKEN = token;
          logger.info('✅ Auto-detected GitHub token from gh CLI');
        }
      } catch (error) {
        logger.warn('⚠️ Could not auto-detect GitHub token from gh CLI (this is OK if gh is authenticated via keyring)');
      }
    } else {
      logger.info('✅ GitHub token found in environment');
    }

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

      // Wire up the Discord message handler BEFORE starting the bot
      orchestratorServer.setDiscordMessageHandler(async (channelId: string, message: string) => {
        await (bot as DiscordBotRealtime).sendTextMessage(channelId, message);
      });

      if (config.systemNotificationChannelId) {
        logger.info(`Agent notifications will be sent to channel: ${config.systemNotificationChannelId}`);
      } else {
        logger.warn('⚠️⚠️⚠️ WARNING ⚠️⚠️⚠️');
        logger.warn('SYSTEM_NOTIFICATION_CHANNEL_ID is not configured in .env!');
        logger.warn('Agent progress updates will be sent to the channel where commands are issued (fallback mode)');
        logger.warn('For better organization, set SYSTEM_NOTIFICATION_CHANNEL_ID to a dedicated notifications channel');
        logger.warn('Get it by: Discord Settings → Advanced → Enable Developer Mode → Right-click channel → Copy Channel ID');
      }

      await bot.start();

      // Register Discord client with webhook service for real-time notifications
      orchestratorServer.setDiscordClient((bot as DiscordBotRealtime).getClient());

      logger.info('AgentFlow started successfully (Realtime API Mode)');

      // Start cache cleanup system
      startCacheCleanup(60000); // Clean every minute
      logger.info('⚡ Smart cache system initialized (auto-cleanup every 60s)');

      // Initialize market update scheduler if enabled
      let marketScheduler: MarketUpdateScheduler | undefined;
      if (config.marketUpdatesEnabled && config.marketUpdatesGuildId) {
        try {
          marketScheduler = new MarketUpdateScheduler(
            (bot as DiscordBotRealtime).getClient(),
            {
              ...DEFAULT_SCHEDULE_CONFIG,
              guildId: config.marketUpdatesGuildId,
              dailyUpdateCron: config.marketUpdatesDailyCron!,
              marketCloseCron: config.marketUpdatesCloseCron!,
              newsCheckCron: config.marketUpdatesNewsCron!,
              weeklyAnalysisCron: config.marketUpdatesWeeklyCron!,
              timezone: config.marketUpdatesTimezone!,
              enabled: true,
              finnhubApiKey: config.finnhubApiKey,
              anthropicApiKey: config.anthropicApiKey
            },
            config.systemNotificationChannelId
          );
          marketScheduler.start();
          logger.info('📈 Market update scheduler started');
        } catch (error) {
          logger.error('Failed to start market update scheduler:', error);
          logger.warn('Continuing without market updates');
        }
      } else {
        logger.info('Market updates disabled or not configured');
      }

      // Initialize Supervisor Service
      const supervisorService = new SupervisorService(
        (bot as DiscordBotRealtime).getClient(),
        config,
        trelloService
      );
      supervisorService.start();

      // Initialize Agent Manager
      const agentManager = new AgentManagerService((bot as DiscordBotRealtime).getClient());

      // Register task executors for market scheduler and supervisor
      if (marketScheduler) {
        agentManager.registerTaskExecutor('market-scheduler', async (task) => {
          const taskConfig = task.config ? JSON.parse(task.config) : {};
          switch (taskConfig.type) {
            case 'daily_update':
              await marketScheduler.triggerDailyUpdate();
              return { success: true, message: 'Daily market update completed' };
            case 'market_close':
              await marketScheduler.triggerMarketCloseSummary();
              return { success: true, message: 'Market close summary completed' };
            case 'news_check':
              await marketScheduler.triggerNewsCheck();
              return { success: true, message: 'News check completed' };
            case 'weekly_analysis':
              await marketScheduler.triggerWeeklyAnalysis();
              return { success: true, message: 'Weekly analysis completed' };
            default:
              throw new Error(`Unknown market scheduler task type: ${taskConfig.type}`);
          }
        });
      }

      agentManager.registerTaskExecutor('supervisor', async (task) => {
        const taskConfig = task.config ? JSON.parse(task.config) : {};
        switch (taskConfig.type) {
          case 'morning_briefing':
            await supervisorService.runDailyBriefing('Morning Kickoff');
            return { success: true, message: 'Morning briefing completed' };
          case 'evening_wrapup':
            await supervisorService.runDailyBriefing('Evening Wrap-up');
            return { success: true, message: 'Evening wrap-up completed' };
          case 'health_check':
            return { success: true, message: 'Health check completed' };
          default:
            throw new Error(`Unknown supervisor task type: ${taskConfig.type}`);
        }
      });

      // Start all enabled recurring tasks
      agentManager.startAllTasks();
      logger.info('✅ Agent Manager recurring tasks started');

      // Initialize Vercel Integration (legacy - for VERCEL_ALERT_CHANNEL_ID)
      let vercelIntegration: VercelIntegration | undefined;
      if (process.env.VERCEL_API_TOKEN && process.env.VERCEL_ALERT_CHANNEL_ID) {
        try {
          vercelIntegration = new VercelIntegration(
            (bot as DiscordBotRealtime).getClient(),
            agentManager
          );
          await vercelIntegration.initialize();
          logger.info('✅ Vercel monitoring integration initialized');
        } catch (error) {
          logger.error('Failed to initialize Vercel monitoring:', error);
          logger.warn('Continuing without Vercel monitoring');
        }
      } else {
        logger.info('Vercel alert channel not configured - legacy Vercel monitoring disabled');
      }

      // Initialize Deployment Tracker (unified Vercel + GitHub tracking)
      let deploymentTracker: DeploymentTracker | null = null;
      if (process.env.DEPLOYMENTS_CHANNEL_ID) {
        try {
          deploymentTracker = createDeploymentTrackerFromEnv();
          if (deploymentTracker) {
            deploymentTracker.setDiscordClient((bot as DiscordBotRealtime).getClient());
            deploymentTracker.start();
            logger.info('✅ Deployment Tracker initialized (Vercel + GitHub)');
            
            // Register with agent manager
            agentManager.registerTaskExecutor('deployment-check', async () => {
              if (!deploymentTracker) return;
              await deploymentTracker.triggerCheck();
            });
            
            agentManager.registerTaskExecutor('deployment-health', async () => {
              if (!deploymentTracker) return;
              await deploymentTracker.sendHealthSummary();
            });
          }
        } catch (error) {
          logger.error('Failed to initialize Deployment Tracker:', error);
          logger.warn('Continuing without Deployment Tracker');
        }
      } else {
        logger.info('DEPLOYMENTS_CHANNEL_ID not configured - unified deployment tracking disabled');
      }

      // Graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('Shutting down gracefully...');
        if (marketScheduler) marketScheduler.stop();
        if (vercelIntegration) vercelIntegration.stop();
        if (deploymentTracker) deploymentTracker.stop();
        agentManager.stopAllTasks(); // Stop agent manager tasks
        supervisorService.stop(); // Stop supervisor
        await bot.stop();
        await orchestratorServer.stop();
        getDatabase().close();
        removeLock();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        logger.info('Shutting down gracefully...');
        if (marketScheduler) marketScheduler.stop();
        if (vercelIntegration) vercelIntegration.stop();
        if (deploymentTracker) deploymentTracker.stop();
        agentManager.stopAllTasks(); // Stop agent manager tasks
        supervisorService.stop(); // Stop supervisor
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

    // Initialize Supervisor Service (also for Legacy Mode)
    const supervisorService = new SupervisorService(
      (bot as DiscordBot).getClient(),
      config,
      trelloService
    );
    supervisorService.start();

    // Wire up the Discord message handler to the orchestrator
    orchestratorServer.setDiscordMessageHandler(async (channelId: string, message: string) => {
      await (bot as DiscordBot).sendTextMessage(channelId, message);
    });

    if (config.systemNotificationChannelId) {
      logger.info(`Agent notifications will be sent to channel: ${config.systemNotificationChannelId}`);
    } else {
      logger.warn('⚠️⚠️⚠️ WARNING ⚠️⚠️⚠️');
      logger.warn('SYSTEM_NOTIFICATION_CHANNEL_ID is not configured in .env!');
      logger.warn('Agent progress updates will be sent to the channel where commands are issued (fallback mode)');
      logger.warn('For better organization, set SYSTEM_NOTIFICATION_CHANNEL_ID to a dedicated notifications channel');
      logger.warn('Get it by: Discord Settings → Advanced → Enable Developer Mode → Right-click channel → Copy Channel ID');
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

    // Start automatic cleanup (every 30 minutes)
    const cleanupManager = getCleanupManager();
    cleanupManager.startAutoCleanup(30);
    logger.info('🧹 Auto-cleanup enabled (runs every 30 minutes)');

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      
      // Stop auto-cleanup
      cleanupManager.stopAutoCleanup();

      // Stop supervisor
      supervisorService.stop();
      
      // Cleanup agents
      const subAgentManager = orchestratorServer.getSubAgentManager();
      await subAgentManager.cleanup();
      
      // Stop services
      await bot.stop();
      await orchestratorServer.stop();
      
      // Close database
      getDatabase().close();
      
      // Remove lock file
      removeLock();
      
      logger.info('✅ Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    logger.error('Failed to start AgentFlow', error);
    process.exit(1);
  }
}

main();
