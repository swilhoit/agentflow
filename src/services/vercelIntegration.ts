import { Client } from 'discord.js';
import { VercelAlertService } from './vercelAlertService';
import { AgentManagerService } from './agentManager';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Vercel Integration
 * Connects Vercel monitoring to the Agent Manager system
 */
export class VercelIntegration {
  private alertService?: VercelAlertService;
  private agentManager: AgentManagerService;
  private discordClient: Client;

  constructor(discordClient: Client, agentManager: AgentManagerService) {
    this.discordClient = discordClient;
    this.agentManager = agentManager;
  }

  /**
   * Initialize Vercel monitoring integration
   */
  async initialize(): Promise<void> {
    const vercelToken = process.env.VERCEL_API_TOKEN;
    const channelId = process.env.VERCEL_ALERT_CHANNEL_ID;

    if (!vercelToken) {
      logger.warn('⚠️  VERCEL_API_TOKEN not configured - Vercel monitoring disabled');
      return;
    }

    if (!channelId) {
      logger.warn('⚠️  VERCEL_ALERT_CHANNEL_ID not configured - Vercel monitoring disabled');
      return;
    }

    const enabled = process.env.VERCEL_MONITORING_ENABLED !== 'false';
    const teamId = process.env.VERCEL_TEAM_ID;
    const checkInterval = process.env.VERCEL_CHECK_INTERVAL || '*/10 * * * *';
    const alertOnCancel = process.env.VERCEL_ALERT_ON_CANCEL === 'true';
    const projectFilter = process.env.VERCEL_PROJECT_FILTER 
      ? process.env.VERCEL_PROJECT_FILTER.split(',').map(p => p.trim())
      : undefined;

    this.alertService = new VercelAlertService({
      enabled,
      channelId,
      vercelToken,
      vercelTeamId: teamId,
      checkInterval,
      alertOnCancel,
      projectFilter,
    });

    this.alertService.setDiscordClient(this.discordClient);

    // Register task executor with Agent Manager
    this.agentManager.registerTaskExecutor(
      'vercel-deployment-check',
      async () => {
        if (!this.alertService) return;
        await this.alertService.triggerCheck();
      }
    );

    this.agentManager.registerTaskExecutor(
      'vercel-health-summary',
      async () => {
        if (!this.alertService) return;
        await this.alertService.sendHealthSummary();
      }
    );

    // Start monitoring
    if (enabled) {
      this.alertService.start();
      logger.info('✅ Vercel monitoring integration initialized and started');
      
      // Update agent status
      try {
        await this.agentManager.updateAgentStatus('vercel-monitor', 'active');
      } catch (error: any) {
        logger.error('Failed to update vercel-monitor agent status:', error.message);
      }
    } else {
      logger.info('⏸️  Vercel monitoring integration initialized but disabled');
    }
  }

  /**
   * Manually trigger a deployment check
   */
  async triggerCheck(): Promise<void> {
    if (!this.alertService) {
      logger.warn('⚠️  Vercel monitoring not initialized');
      return;
    }

    await this.alertService.triggerCheck();
  }

  /**
   * Send a health summary
   */
  async sendHealthSummary(): Promise<void> {
    if (!this.alertService) {
      logger.warn('⚠️  Vercel monitoring not initialized');
      return;
    }

    await this.alertService.sendHealthSummary();
  }

  /**
   * Get monitoring statistics
   */
  getStats(): any {
    if (!this.alertService) {
      return {
        initialized: false,
      };
    }

    return {
      initialized: true,
      ...this.alertService.getStats(),
    };
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.alertService) {
      this.alertService.stop();
      logger.info('⏹️  Vercel monitoring stopped');
    }
  }
}

/**
 * Setup recurring tasks for Vercel monitoring
 */
export async function setupVercelTasks(agentManager: AgentManagerService): Promise<void> {
  const enabled = process.env.VERCEL_MONITORING_ENABLED !== 'false';
  
  if (!enabled) {
    logger.info('⏸️  Vercel tasks setup skipped - monitoring disabled');
    return;
  }

  // Weekly health summary (Mondays at 9 AM)
  agentManager.registerRecurringTask({
    taskName: 'vercel-weekly-health',
    agentName: 'vercel-monitor',
    description: 'Weekly Vercel deployment health summary',
    cronSchedule: '0 9 * * 1', // Every Monday at 9 AM
    timezone: 'America/New_York',
    isEnabled: true
  });

  logger.info('✅ Vercel recurring tasks registered');
}

