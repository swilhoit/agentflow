/**
 * Setup Agent Manager
 *
 * This script initializes the Agent Manager and registers all existing recurring tasks
 * from the existing schedulers (MarketUpdateScheduler, GoalsScheduler, SupervisorService)
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { AgentManagerService } from '../src/services/agentManager';
import { logger } from '../src/utils/logger';

async function setup() {
  try {
    logger.info('🚀 Setting up Agent Manager...');

    // Create a dummy Discord client (needed for AgentManagerService constructor)
    const client = new Client({
      intents: [GatewayIntentBits.Guilds]
    });

    // Initialize Agent Manager
    const agentManager = new AgentManagerService(client);

    logger.info('✅ Agent Manager database initialized');

    // Register recurring tasks for existing schedulers
    logger.info('📝 Registering recurring tasks...');

    // Market Update Scheduler Tasks
    const marketTasks = [
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
      }
    ];

    for (const task of marketTasks) {
      try {
        agentManager.registerRecurringTask(task);
        logger.info(`  ✓ Registered: ${task.taskName}`);
      } catch (error: any) {
        if (error.message?.includes('UNIQUE')) {
          logger.info(`  ℹ️  Already exists: ${task.taskName}`);
        } else {
          logger.error(`  ✗ Failed to register ${task.taskName}:`, error);
        }
      }
    }

    // Supervisor Service Tasks
    const supervisorTasks = [
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

    for (const task of supervisorTasks) {
      try {
        agentManager.registerRecurringTask(task);
        logger.info(`  ✓ Registered: ${task.taskName}`);
      } catch (error: any) {
        if (error.message?.includes('UNIQUE')) {
          logger.info(`  ℹ️  Already exists: ${task.taskName}`);
        } else {
          logger.error(`  ✗ Failed to register ${task.taskName}:`, error);
        }
      }
    }

    // Goals Scheduler Tasks
    // Note: Goals scheduler is user-specific and set up dynamically
    // We'll create a template task that can be enabled per user
    const goalsTask = {
      taskName: 'Daily Goals Check-in',
      agentName: 'goals-scheduler',
      description: 'Daily morning check-in for user goals (8:00 AM PST)',
      cronSchedule: '0 8 * * *',
      timezone: 'America/Los_Angeles',
      isEnabled: false, // Disabled by default, enabled per-user
      config: JSON.stringify({ type: 'goals_checkin', note: 'Enable per-user via config' })
    };

    try {
      agentManager.registerRecurringTask(goalsTask);
      logger.info(`  ✓ Registered: ${goalsTask.taskName} (template)`);
    } catch (error: any) {
      if (error.message?.includes('UNIQUE')) {
        logger.info(`  ℹ️  Already exists: ${goalsTask.taskName}`);
      } else {
        logger.error(`  ✗ Failed to register ${goalsTask.taskName}:`, error);
      }
    }

    logger.info('');
    logger.info('✅ Agent Manager setup complete!');
    logger.info('');

    // Display summary
    const allTasks = agentManager.getAllRecurringTasks();
    const stats = agentManager.getTaskStats();

    logger.info('📊 Summary:');
    logger.info(`   • Total Tasks: ${stats.totalTasks}`);
    logger.info(`   • Enabled Tasks: ${stats.enabledTasks}`);
    logger.info(`   • Total Executions: ${stats.totalExecutions}`);
    logger.info(`   • Success Rate: ${stats.totalExecutions > 0 ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100) : 0}%`);
    logger.info('');

    logger.info('🎯 Registered Tasks:');
    for (const task of allTasks) {
      logger.info(`   • ${task.taskName} (${task.agentName}) - ${task.isEnabled ? '✓ enabled' : '✗ disabled'}`);
    }
    logger.info('');

    logger.info('🌐 View in dashboard at: http://localhost:3000/agents');
    logger.info('');

    process.exit(0);
  } catch (error) {
    logger.error('Failed to setup Agent Manager:', error);
    process.exit(1);
  }
}

setup();
