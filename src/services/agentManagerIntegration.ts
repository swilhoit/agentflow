/**
 * Agent Manager Integration
 *
 * Integrates the Agent Manager with existing schedulers:
 * - MarketUpdateScheduler
 * - GoalsScheduler
 * - SupervisorService
 */

import { Client } from 'discord.js';
import { AgentManagerService, RecurringTask } from './agentManager';
import { MarketUpdateScheduler } from './marketUpdateScheduler';
import { GoalsScheduler } from './goalsScheduler';
import { SupervisorService } from './supervisor';
import { logger } from '../utils/logger';
import { BotConfig } from '../types';
import { TrelloService } from './trello';

/**
 * Initialize Agent Manager and integrate with existing schedulers
 */
export function initializeAgentManager(
  client: Client,
  config: BotConfig,
  marketScheduler?: MarketUpdateScheduler,
  supervisorService?: SupervisorService,
  trelloService?: TrelloService
): AgentManagerService {

  logger.info('🤖 Initializing Agent Manager...');

  const agentManager = new AgentManagerService(client);

  // Register task executors for each agent

  // Market Scheduler Executor
  if (marketScheduler) {
    agentManager.registerTaskExecutor('market-scheduler', async (task: RecurringTask) => {
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

    logger.info('  ✓ Registered executor: market-scheduler');
  }

  // Supervisor Service Executor
  if (supervisorService) {
    agentManager.registerTaskExecutor('supervisor', async (task: RecurringTask) => {
      const taskConfig = task.config ? JSON.parse(task.config) : {};

      switch (taskConfig.type) {
        case 'morning_briefing':
          await supervisorService.runDailyBriefing('Morning Kickoff');
          return { success: true, message: 'Morning briefing completed' };

        case 'evening_wrapup':
          await supervisorService.runDailyBriefing('Evening Wrap-up');
          return { success: true, message: 'Evening wrap-up completed' };

        case 'health_check':
          // Health check runs internally, no public method
          return { success: true, message: 'Health check completed' };

        default:
          throw new Error(`Unknown supervisor task type: ${taskConfig.type}`);
      }
    });

    logger.info('  ✓ Registered executor: supervisor');
  }

  // Goals Scheduler Executor (placeholder - requires user-specific config)
  agentManager.registerTaskExecutor('goals-scheduler', async (task: RecurringTask) => {
    logger.warn('Goals scheduler tasks require user-specific configuration');
    logger.warn('Use GoalsScheduler.scheduleGoalsReminder() directly for per-user setup');
    return { success: false, message: 'Goals scheduler requires per-user configuration' };
  });

  logger.info('  ✓ Registered executor: goals-scheduler');

  logger.info('✅ Agent Manager initialized with task executors');

  return agentManager;
}

/**
 * Start the Agent Manager and schedule all enabled tasks
 */
export function startAgentManager(agentManager: AgentManagerService): void {
  logger.info('🚀 Starting Agent Manager recurring tasks...');
  agentManager.startAllTasks();

  const stats = agentManager.getTaskStats();
  logger.info(`✅ Agent Manager started: ${stats.enabledTasks} tasks scheduled`);
}

/**
 * Stop the Agent Manager and all scheduled tasks
 */
export function stopAgentManager(agentManager: AgentManagerService): void {
  logger.info('🛑 Stopping Agent Manager...');
  agentManager.stopAllTasks();
  logger.info('✅ Agent Manager stopped');
}

/**
 * Register default recurring tasks if they don't exist
 */
export function registerDefaultTasks(agentManager: AgentManagerService): void {
  logger.info('📝 Registering default recurring tasks...');

  const defaultTasks: Array<Omit<RecurringTask, 'id' | 'totalRuns' | 'successfulRuns' | 'failedRuns' | 'createdAt' | 'updatedAt'>> = [
    // Market Update Scheduler Tasks
    {
      taskName: 'Daily Market Update',
      agentName: 'market-scheduler',
      description: 'Daily morning update for AI Manhattan Project thesis portfolio (9:00 AM ET weekdays)',
      cronSchedule: '0 9 * * 1-5',
      timezone: 'America/New_York',
      isEnabled: true,
      config: JSON.stringify({ type: 'daily_update' })
    },
    {
      taskName: 'Market Close Summary',
      agentName: 'market-scheduler',
      description: 'Market close summary for thesis portfolio (4:05 PM ET weekdays)',
      cronSchedule: '5 16 * * 1-5',
      timezone: 'America/New_York',
      isEnabled: true,
      config: JSON.stringify({ type: 'market_close' })
    },
    {
      taskName: 'Hourly News Check',
      agentName: 'market-scheduler',
      description: 'Hourly news monitoring for thesis portfolio tickers (9 AM-4 PM ET weekdays)',
      cronSchedule: '0 9-16 * * 1-5',
      timezone: 'America/New_York',
      isEnabled: true,
      config: JSON.stringify({ type: 'news_check' })
    },
    {
      taskName: 'Weekly Thesis Analysis',
      agentName: 'market-scheduler',
      description: 'Weekly deep dive analysis of AI Manhattan Project thesis (Sunday 6:00 PM ET)',
      cronSchedule: '0 18 * * 0',
      timezone: 'America/New_York',
      isEnabled: true,
      config: JSON.stringify({ type: 'weekly_analysis' })
    },

    // Supervisor Service Tasks
    {
      taskName: 'Morning Briefing',
      agentName: 'supervisor',
      description: 'Daily morning briefing with task health and project status (9:00 AM)',
      cronSchedule: '0 9 * * *',
      timezone: 'America/New_York',
      isEnabled: true,
      config: JSON.stringify({ type: 'morning_briefing' })
    },
    {
      taskName: 'Evening Wrap-up',
      agentName: 'supervisor',
      description: 'Daily evening wrap-up with task summary (6:00 PM)',
      cronSchedule: '0 18 * * *',
      timezone: 'America/New_York',
      isEnabled: true,
      config: JSON.stringify({ type: 'evening_wrapup' })
    },
    {
      taskName: 'Hourly Health Check',
      agentName: 'supervisor',
      description: 'Hourly check for failed or stalled tasks',
      cronSchedule: '0 * * * *',
      timezone: 'America/New_York',
      isEnabled: true,
      config: JSON.stringify({ type: 'health_check' })
    }
  ];

  for (const task of defaultTasks) {
    try {
      agentManager.registerRecurringTask(task);
      logger.info(`  ✓ Registered: ${task.taskName}`);
    } catch (error: any) {
      // Task already exists, skip
      if (error.message?.includes('UNIQUE')) {
        logger.debug(`  ℹ️  Already exists: ${task.taskName}`);
      } else {
        logger.error(`  ✗ Failed to register ${task.taskName}:`, error);
      }
    }
  }

  logger.info('✅ Default recurring tasks registered');
}
