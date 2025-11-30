import { loadConfig, validateConfig } from './utils/config';
import { logger, LogLevel } from './utils/logger';
import { DiscordBotRealtime } from './bot/discordBotRealtime';
import { OrchestratorServer } from './orchestrator/orchestratorServer';
import { getDatabase } from './services/databaseFactory';
import { TrelloService } from './services/trello';
import { getCleanupManager } from './utils/cleanupManager';
import { MarketUpdateScheduler, DEFAULT_SCHEDULE_CONFIG } from './services/marketUpdateScheduler';
import { startCacheCleanup } from './utils/smartCache';
import { SupervisorService } from './services/supervisor';
import { VercelIntegration } from './services/vercelIntegration';
import { AgentManagerService } from './services/agentManager';
import { registerDefaultTasks } from './services/agentManagerIntegration';
import { DeploymentTracker, createDeploymentTrackerFromEnv } from './services/deploymentTracker';
import { getStartupLogger } from './services/startupLogger';
import { getServerMonitor, ServerMonitorService } from './services/serverMonitor';
import { CategoryBudgetService } from './services/categoryBudgetService';
import { WeeklyBudgetService } from './services/weeklyBudgetService';
import { TransactionSyncService } from './services/transactionSyncService';
import { getWatchdog } from './services/watchdog';
import { startTradingScheduler, TradingScheduler } from './services/tradingScheduler';
import { EventBus, EventType } from './services/eventBus';
// Reliability Services
import { initializeGracefulShutdown, installShutdownHandlers, getGracefulShutdownHandler } from './services/gracefulShutdown';
import { initializeTaskLifecycleManager, getTaskLifecycleManager } from './services/taskLifecycleManager';
import { initializeWorkspaceRegistry, getWorkspaceRegistry } from './services/workspaceRegistry';
// Calendar & VIX Trading Services
import { getEconomicCalendarService } from './services/economicCalendarService';
import { getVIXTradingBot } from './services/vixTradingBot';

import { AtlasBot } from './atlas/atlasBot';
import { AdvisorBot } from './advisor/advisorBot';
import * as fs from 'fs';
import * as path from 'path';

// Initialize startup logger early
const startupLogger = getStartupLogger();

// Global error handlers
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception:', error);
  await startupLogger.logCrash(error);
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Unhandled Rejection:', error);
  await startupLogger.logCrash(error);
});

// Lock file management
const LOCK_FILE = path.join(process.cwd(), 'data', '.agentflow.lock');

function checkAndCreateLock(): boolean {
  try {
    if (process.pid === 1 || process.env.NODE_ENV === 'production') return true;
    
    const dataDir = path.dirname(LOCK_FILE);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    if (fs.existsSync(LOCK_FILE)) {
      const pidStr = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
      const oldPid = parseInt(pidStr, 10);
      try {
        process.kill(oldPid, 0);
        logger.error(`❌ CRITICAL: Instance (PID: ${oldPid}) is already running!`);
        return false;
      } catch (e) {
        fs.unlinkSync(LOCK_FILE);
      }
    }
    fs.writeFileSync(LOCK_FILE, process.pid.toString());
    return true;
  } catch (error) {
    logger.error('Failed to create process lock', error);
    return false;
  }
}

function removeLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch (error) {}
}

async function main() {
  const servicesInitialized: string[] = [];
  
  try {
    await startupLogger.logStartupBegin();
    
    const logLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    logger.setLevel(LogLevel[logLevel as keyof typeof LogLevel] || LogLevel.INFO);

    logger.info('🚀 Starting AgentFlow Unified System...');

    // Auto-detect GitHub token
    if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
      try {
        const { execSync } = require('child_process');
        const token = execSync('gh auth token 2>/dev/null', { encoding: 'utf-8' }).trim();
        if (token && (token.startsWith('gho_') || token.startsWith('ghp_'))) {
          process.env.GITHUB_TOKEN = token;
          process.env.GH_TOKEN = token;
          logger.info('✅ Auto-detected GitHub token');
        }
      } catch (e) {}
    }

    if (!checkAndCreateLock()) process.exit(1);

    // Load Config
    const config = loadConfig();
    validateConfig(config);

    // Initialize Reliability Services (before any services that create tasks)
    logger.info('🛡️ Initializing reliability services...');
    const lifecycleManager = initializeTaskLifecycleManager({
      checkpointIntervalIterations: parseInt(process.env.CHECKPOINT_INTERVAL_ITERATIONS || '10'),
      maxCheckpointAge: parseInt(process.env.MAX_CHECKPOINT_AGE_MS || '3600000'),
      maxCheckpointsPerTask: 5
    });
    await lifecycleManager.initialize();

    const workspaceRegistry = initializeWorkspaceRegistry({
      basePath: process.env.WORKSPACE_BASE_PATH || '/opt/agentflow/workspaces',
      orphanCleanupHours: parseInt(process.env.ORPHAN_WORKSPACE_CLEANUP_HOURS || '24'),
      maxWorkspacesPerTask: 3,
      hetznerServerIp: process.env.HETZNER_SERVER_IP
    });

    const gracefulShutdownHandler = initializeGracefulShutdown({
      timeoutMs: parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000'),
      notifyUsers: true,
      forceKillAfterTimeout: true
    });
    servicesInitialized.push('Reliability Services');

    // Initialize DB & Trello
    let trelloService: TrelloService | undefined;
    if (config.trelloApiKey && config.trelloApiToken) {
        trelloService = new TrelloService(config.trelloApiKey, config.trelloApiToken);
    }

    // Orchestrator
    const orchestratorServer = new OrchestratorServer(config, 3001, trelloService);
    await orchestratorServer.start();
    servicesInitialized.push('Orchestrator');

    // 1. Main Bot (Realtime API)
    logger.info('🎙️ Starting Main Bot (Realtime API)...');
    const mainBot = new DiscordBotRealtime(config);

    // Wire up Orchestrator -> Main Bot
      orchestratorServer.setDiscordMessageHandler(async (channelId: string, message: string) => {
      await mainBot.sendTextMessage(channelId, message);
      });
    orchestratorServer.setDiscordClient(mainBot.getClient());

    await mainBot.start();
    servicesInitialized.push('Main Bot (Voice/Realtime)');

    // 2. Atlas Bot (Markets)
    let atlasBot: AtlasBot | undefined;
    if (process.env.ATLAS_DISCORD_TOKEN && process.env.GLOBAL_MARKETS_CHANNELS) {
      logger.info('🌏 Starting Atlas Bot (Global Markets)...');
      atlasBot = new AtlasBot(
        process.env.ATLAS_DISCORD_TOKEN,
        process.env.ANTHROPIC_API_KEY!,
        process.env.GLOBAL_MARKETS_CHANNELS.split(',').map(ch => ch.trim())
      );
      await atlasBot.start();
      servicesInitialized.push('Atlas Bot');
    }

    // 3. Advisor Bot (Finance) OR Integrated Services
    let advisorBot: AdvisorBot | undefined;
    let categoryBudgetService: CategoryBudgetService | undefined;
    let weeklyBudgetService: WeeklyBudgetService | undefined;
    let transactionSyncService: TransactionSyncService | undefined;

    if (process.env.ADVISOR_DISCORD_TOKEN && process.env.FINANCIAL_ADVISOR_CHANNELS) {
      logger.info('💰 Starting Advisor Bot (Mr. Krabs - Separate Identity)...');
      advisorBot = new AdvisorBot(
        process.env.ADVISOR_DISCORD_TOKEN,
        process.env.ANTHROPIC_API_KEY!,
        process.env.FINANCIAL_ADVISOR_CHANNELS.split(',').map(ch => ch.trim())
      );
      await advisorBot.start();
      servicesInitialized.push('Advisor Bot');
      
      // Initialize budget services on the ADVISOR client
      // Note: AdvisorBot internally initializes these in its constructor if we look at its code, 
      // but let's assume we might need to attach them manually or the bot handles it.
      // Looking at previous file read of `src/advisor/index.ts`, it init services externally.
      // `src/advisor/advisorBot.ts` probably just handles chat.
      // So we should init services here but attach to `advisorBot.getClient()`.
      
      const financialChannels = process.env.FINANCIAL_ADVISOR_CHANNELS.split(',').map(ch => ch.trim());
      const groceriesBudget = parseFloat(process.env.GROCERIES_BUDGET || '200');
      const diningBudget = parseFloat(process.env.DINING_BUDGET || '100');
      const otherBudget = parseFloat(process.env.OTHER_BUDGET || '170');
      const monthlyBusinessBudget = parseFloat(process.env.MONTHLY_BUSINESS_BUDGET || '500');

      categoryBudgetService = new CategoryBudgetService({
        groceriesBudget, diningBudget, otherBudget,
        channelId: financialChannels[0],
        enabled: false, // Schedule via AgentManager
        dailyUpdateTime: '0 9 * * *'
      });
      categoryBudgetService.setDiscordClient(advisorBot.getClient());

      weeklyBudgetService = new WeeklyBudgetService({
        groceriesBudget, diningBudget, otherBudget, monthlyBusinessBudget,
        channelId: financialChannels[0],
        enabled: false,
        weeklyUpdateTime: '0 20 * * 0'
      });
      weeklyBudgetService.setDiscordClient(advisorBot.getClient());

      transactionSyncService = new TransactionSyncService({
        enabled: false,
        cronExpression: '0 2 * * *',
        timezone: 'America/Los_Angeles',
        daysToSync: 90
      });

      servicesInitialized.push('Financial Services (Advisor)');

    } else if (process.env.FINANCIAL_ADVISOR_CHANNELS) {
      // Fallback: Run on Main Bot
      logger.info('💰 Starting Financial Services (Integrated on Main Bot)...');
      const financialChannels = process.env.FINANCIAL_ADVISOR_CHANNELS.split(',').map(ch => ch.trim());
      const groceriesBudget = parseFloat(process.env.GROCERIES_BUDGET || '200');
      const diningBudget = parseFloat(process.env.DINING_BUDGET || '100');
      const otherBudget = parseFloat(process.env.OTHER_BUDGET || '170');
      const monthlyBusinessBudget = parseFloat(process.env.MONTHLY_BUSINESS_BUDGET || '500');

      categoryBudgetService = new CategoryBudgetService({
        groceriesBudget, diningBudget, otherBudget,
        channelId: financialChannels[0],
        enabled: false,
        dailyUpdateTime: '0 9 * * *'
      });
      categoryBudgetService.setDiscordClient(mainBot.getClient());

      weeklyBudgetService = new WeeklyBudgetService({
        groceriesBudget, diningBudget, otherBudget, monthlyBusinessBudget,
        channelId: financialChannels[0],
        enabled: false,
        weeklyUpdateTime: '0 20 * * 0'
      });
      weeklyBudgetService.setDiscordClient(mainBot.getClient());

      transactionSyncService = new TransactionSyncService({
        enabled: false,
        cronExpression: '0 2 * * *',
        timezone: 'America/Los_Angeles',
        daysToSync: 90
      });
      
      servicesInitialized.push('Financial Services (Main)');
    }

    // 4. Supervisor & Agent Manager
    const supervisorService = new SupervisorService(mainBot.getClient(), config, trelloService);
    supervisorService.start();
    servicesInitialized.push('Supervisor');

    const agentManager = new AgentManagerService(mainBot.getClient());

    // Register Task Executors
    // Market Scheduler
      let marketScheduler: MarketUpdateScheduler | undefined;
      if (config.marketUpdatesEnabled && config.marketUpdatesGuildId) {
      // Use Atlas client if available, otherwise Main
      const marketClient = atlasBot ? atlasBot.getClient() : mainBot.getClient();
          marketScheduler = new MarketUpdateScheduler(
        marketClient,
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
              anthropicApiKey: config.anthropicApiKey,
              perplexityApiKey: config.perplexityApiKey
            },
            config.systemNotificationChannelId,
            process.env.MARKET_UPDATES_CHANNEL_ID
          );
          marketScheduler.start();
      
        agentManager.registerTaskExecutor('market-scheduler', async (task) => {
          const taskConfig = task.config ? JSON.parse(task.config) : {};
          switch (taskConfig.type) {
          case 'daily_update': await marketScheduler!.triggerDailyUpdate(); return { success: true };
          case 'market_close': await marketScheduler!.triggerMarketCloseSummary(); return { success: true };
          case 'news_check': await marketScheduler!.triggerNewsCheck(); return { success: true };
          case 'weekly_analysis': await marketScheduler!.triggerWeeklyAnalysis(); return { success: true };
          default: throw new Error(`Unknown market task: ${taskConfig.type}`);
          }
        });
      servicesInitialized.push('Market Scheduler');
      }

    // Supervisor Tasks
      agentManager.registerTaskExecutor('supervisor', async (task) => {
        const taskConfig = task.config ? JSON.parse(task.config) : {};
        switch (taskConfig.type) {
        case 'morning_briefing': await supervisorService.runDailyBriefing('Morning Kickoff'); return { success: true };
        case 'evening_wrapup': await supervisorService.runDailyBriefing('Evening Wrap-up'); return { success: true };
        case 'health_check': return { success: true }; // Health check runs internally via serverMonitor
        default: throw new Error(`Unknown supervisor task: ${taskConfig.type}`);
        }
      });

    // Mr. Krabs Tasks
    if (transactionSyncService) {
          agentManager.registerTaskExecutor('mr-krabs', async (task) => {
            const taskConfig = task.config ? JSON.parse(task.config) : {};
            switch (taskConfig.type) {
              case 'daily_budget':
            if (categoryBudgetService) await categoryBudgetService.sendDailyUpdate(); 
            return { success: true };
              case 'weekly_summary':
            if (weeklyBudgetService) await weeklyBudgetService.sendWeeklySummary(); 
            return { success: true };
              case 'transaction_sync':
            const result = await transactionSyncService!.triggerSync(); 
            return { success: result.success, stats: result.stats };
          default: throw new Error(`Unknown mr-krabs task: ${taskConfig.type}`);
            }
          });
    }

    // 5. Deployment Tracker
      if (process.env.DEPLOYMENTS_CHANNEL_ID) {
      const deploymentTracker = createDeploymentTrackerFromEnv();
          if (deploymentTracker) {
        deploymentTracker.setDiscordClient(mainBot.getClient());
            deploymentTracker.start();
            
            agentManager.registerTaskExecutor('deployment-check', async () => {
              await deploymentTracker.triggerCheck();
            });
        servicesInitialized.push('Deployment Tracker');
        }
      }

    // 6. Server Monitor
      let serverMonitor: ServerMonitorService | null = null;
      if (process.env.HETZNER_SERVER_IP) {
          serverMonitor = getServerMonitor({
            serverIp: process.env.HETZNER_SERVER_IP,
            sshUser: process.env.HETZNER_SSH_USER || 'root',
        checkIntervalMs: 5 * 60 * 1000,
            discordChannelId: process.env.SERVER_MONITOR_CHANNEL_ID || process.env.SYSTEM_NOTIFICATION_CHANNEL_ID,
        autoCleanup: { enabled: true, diskThresholdPercent: 80, dockerCacheThresholdGb: 15 }
          });
      serverMonitor.setDiscordClient(mainBot.getClient());
          serverMonitor.start();
      
      agentManager.registerTaskExecutor('server-health-check', async () => await serverMonitor!.forceCheck());
      agentManager.registerTaskExecutor('server-cleanup', async () => await serverMonitor!.cleanupDocker());

      servicesInitialized.push('Server Monitor');
      }

    // 7. Trading Scheduler
    if (process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY) {
      const paperTradingChannelId = '1443627673501962300';
      const tradingScheduler = startTradingScheduler(mainBot.getClient(), {
              tradingChannelId: paperTradingChannelId,
        autoExecute: true
      });
      servicesInitialized.push('Trading Scheduler');
      }

    // 8. Economic Calendar & VIX Trading Bot
    let calendarService: ReturnType<typeof getEconomicCalendarService> | undefined;
    let vixTradingBot: ReturnType<typeof getVIXTradingBot> | undefined;

    if (process.env.FINNHUB_API_KEY) {
      logger.info('📅 Starting Economic Calendar Service...');
      calendarService = getEconomicCalendarService();
      calendarService.setDiscordClient(mainBot.getClient());
      calendarService.startAutoSync(6); // Sync every 6 hours
      servicesInitialized.push('Economic Calendar');

      // Register calendar task executors
      agentManager.registerTaskExecutor('calendar', async (task) => {
        const taskConfig = task.config ? JSON.parse(task.config) : {};
        switch (taskConfig.type) {
          case 'sync':
            await calendarService!.syncAllCalendars();
            return { success: true };
          case 'notify':
            await calendarService!.checkAndNotifyUpcomingEvents();
            return { success: true };
          default:
            throw new Error(`Unknown calendar task: ${taskConfig.type}`);
        }
      });
    }

    if (process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY) {
      logger.info('📊 Starting VIX Trading Bot...');
      vixTradingBot = getVIXTradingBot();
      vixTradingBot.setDiscordClient(mainBot.getClient());
      vixTradingBot.startAutoAnalysis(30); // Analyze every 30 minutes
      servicesInitialized.push('VIX Trading Bot');

      // Register VIX trading task executors
      agentManager.registerTaskExecutor('vix-trading', async (task) => {
        const taskConfig = task.config ? JSON.parse(task.config) : {};
        switch (taskConfig.type) {
          case 'analyze':
            const analysis = await vixTradingBot!.runAnalysis();
            return { success: true, analysis };
          case 'execute_signal':
            if (!taskConfig.signalId) throw new Error('signalId required');
            const position = await vixTradingBot!.executeSignal(taskConfig.signalId);
            return { success: true, position };
          default:
            throw new Error(`Unknown vix-trading task: ${taskConfig.type}`);
        }
      });
    }

    // 9. Watchdog (was 8)
      const watchdog = getWatchdog({
      checkIntervalMs: 60000,
      memoryTrendWindowMs: 5 * 60 * 1000,
      memoryGrowthThreshold: 25,
        botName: 'AgentFlow',
        alertChannelId: config.systemNotificationChannelId,
        alertWebhookUrl: process.env.WATCHDOG_WEBHOOK_URL,
      onCritical: async (reason) => logger.error(`[Watchdog] Critical: ${reason}`)
      });
    watchdog.setDiscordClient(mainBot.getClient());
      watchdog.start();
    servicesInitialized.push('Watchdog');

    // 10. Event Bus Wiring (The Boardroom)
    EventBus.getInstance().subscribeAll((event) => {
      logger.info(`🧠 [Boardroom] Detected ${event.type} from ${event.source} (${event.severity})`);

      // Intelligent Reaction: High Impact Market News -> Trigger Portfolio Check
      if (event.type === EventType.MARKET_UPDATE && event.severity === 'high') {
        logger.info('⚡ High impact market news detected! Triggering automatic portfolio health check...');
        // Future: trigger financial analysis task
        // agentManager.executeTask('portfolio-health-check');
      }
    });

    // 11. Periodic Workspace Cleanup (clean orphaned workspaces from failed tasks)
    const WORKSPACE_CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
    setInterval(async () => {
      try {
        const result = await workspaceRegistry.cleanupOrphanedWorkspaces();
        if (result.cleaned > 0 || result.errors > 0) {
          logger.info(`🧹 Workspace cleanup: ${result.cleaned} cleaned, ${result.errors} errors`);
        }
      } catch (error) {
        logger.error('Workspace cleanup failed:', error);
      }
    }, WORKSPACE_CLEANUP_INTERVAL);
    servicesInitialized.push('Workspace Cleanup');

    // Start all tasks
    registerDefaultTasks(agentManager);
    await agentManager.startAllTasks();

    // Log success
    startupLogger.setDiscordClient(mainBot.getClient());
    await startupLogger.logStartupSuccess(servicesInitialized);
    logger.info('🎉 System Startup Complete!');

    // Start Cache Cleanup
    startCacheCleanup(60000);

    // Graceful Shutdown with Task Checkpointing
    // Register cleanup callbacks with the graceful shutdown handler
    gracefulShutdownHandler.onShutdown(async () => {
      watchdog.stop();
      if (serverMonitor) serverMonitor.stop();
      if (marketScheduler) marketScheduler.stop();
      if (calendarService) calendarService.stopAutoSync();
      if (vixTradingBot) vixTradingBot.stopAutoAnalysis();
      agentManager.stopAllTasks();
      supervisorService.stop();
    });

    gracefulShutdownHandler.onShutdown(async () => {
      await mainBot.stop();
      if (atlasBot) await atlasBot.stop();
      if (advisorBot) await advisorBot.stop();
    });

    gracefulShutdownHandler.onShutdown(async () => {
      await orchestratorServer.stop();
      getDatabase().close();
      removeLock();
    });

    // Install the graceful shutdown handlers (handles SIGINT/SIGTERM)
    installShutdownHandlers(gracefulShutdownHandler, true);

  } catch (error) {
    logger.error('Failed to start AgentFlow', error);
    await startupLogger.logStartupFailure(error as Error);
    process.exit(1);
  }
}

main();
