import * as cron from 'node-cron';
import { Client } from 'discord.js';
import { logger } from '../utils/logger';
import { TradingAgent, getTradingAgent } from './tradingAgent';

// ============================================================================
// Trading Scheduler Service
// ============================================================================

export class TradingScheduler {
  private tradingAgent: TradingAgent;
  private discordClient?: Client;
  private tradingChannelId?: string;
  private timezone: string;
  private jobs: cron.ScheduledTask[] = [];

  // Schedule configuration
  private morningAnalysisCron: string; // Before market open
  private middayCheckCron: string; // Mid-day check
  private closeReviewCron: string; // After market close

  constructor(config?: {
    morningAnalysisCron?: string;
    middayCheckCron?: string;
    closeReviewCron?: string;
    timezone?: string;
    tradingChannelId?: string;
    autoExecute?: boolean;
  }) {
    this.tradingAgent = getTradingAgent();
    this.timezone = config?.timezone || 'America/New_York';
    this.tradingChannelId = config?.tradingChannelId;

    // Default schedules (all in Eastern Time, weekdays only)
    // Morning: 9:00 AM ET - 30 mins before market open
    this.morningAnalysisCron = config?.morningAnalysisCron || '0 9 * * 1-5';
    // Midday: 12:30 PM ET - Check for opportunities
    this.middayCheckCron = config?.middayCheckCron || '30 12 * * 1-5';
    // Close: 4:30 PM ET - Review the day
    this.closeReviewCron = config?.closeReviewCron || '30 16 * * 1-5';

    if (config?.autoExecute !== undefined) {
      this.tradingAgent.setAutoExecute(config.autoExecute);
    }

    logger.info('📅 TradingScheduler initialized');
    logger.info(`   Morning Analysis: ${this.morningAnalysisCron}`);
    logger.info(`   Midday Check: ${this.middayCheckCron}`);
    logger.info(`   Close Review: ${this.closeReviewCron}`);
    logger.info(`   Timezone: ${this.timezone}`);
  }

  setDiscordClient(client: Client, channelId?: string): void {
    this.discordClient = client;
    this.tradingChannelId = channelId || this.tradingChannelId;

    if (this.tradingChannelId) {
      this.tradingAgent.setDiscordClient(client, this.tradingChannelId);
    }
  }

  // ==========================================================================
  // Scheduled Jobs
  // ==========================================================================

  start(): void {
    logger.info('🚀 Starting Trading Scheduler...');

    // Morning Analysis - Main daily trading plan
    const morningJob = cron.schedule(this.morningAnalysisCron, async () => {
      logger.info('⏰ Running morning trading analysis...');
      try {
        await this.runMorningAnalysis();
      } catch (error) {
        logger.error('Morning analysis failed:', error);
      }
    }, {
      timezone: this.timezone
    });
    this.jobs.push(morningJob);

    // Midday Check - Quick opportunity scan
    const middayJob = cron.schedule(this.middayCheckCron, async () => {
      logger.info('⏰ Running midday check...');
      try {
        await this.runMiddayCheck();
      } catch (error) {
        logger.error('Midday check failed:', error);
      }
    }, {
      timezone: this.timezone
    });
    this.jobs.push(middayJob);

    // Close Review - End of day summary
    const closeJob = cron.schedule(this.closeReviewCron, async () => {
      logger.info('⏰ Running close review...');
      try {
        await this.runCloseReview();
      } catch (error) {
        logger.error('Close review failed:', error);
      }
    }, {
      timezone: this.timezone
    });
    this.jobs.push(closeJob);

    logger.info('✅ Trading Scheduler started with 3 daily jobs');
  }

  stop(): void {
    logger.info('🛑 Stopping Trading Scheduler...');
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    logger.info('✅ Trading Scheduler stopped');
  }

  // ==========================================================================
  // Analysis Methods
  // ==========================================================================

  async runMorningAnalysis(): Promise<void> {
    logger.info('🌅 Morning Trading Analysis starting...');

    try {
      const result = await this.tradingAgent.runDailyAnalysis({
        execute: false, // Morning = plan only, don't auto-execute
        notify: true
      });

      logger.info(`📋 Morning analysis complete:`);
      logger.info(`   - ${result.plan.recommendations.length} recommendations`);
      logger.info(`   - Market sentiment: ${result.intelligence.portfolioData.overallSentiment}`);
      logger.info(`   - Summary: ${result.plan.summary.substring(0, 100)}...`);
    } catch (error) {
      logger.error('Morning analysis error:', error);
      throw error;
    }
  }

  async runMiddayCheck(): Promise<void> {
    logger.info('☀️ Midday Trading Check starting...');

    try {
      // Quick intelligence gather without full analysis
      const intelligence = await this.tradingAgent.gatherMarketIntelligence();

      // Check if market is open
      if (!intelligence.marketStatus.isOpen) {
        logger.info('Market is closed, skipping midday check');
        return;
      }

      // Log key metrics
      logger.info(`📊 Midday Check:`);
      logger.info(`   - Portfolio Value: $${intelligence.accountStatus.portfolioValue.toLocaleString()}`);
      logger.info(`   - Cash: $${intelligence.accountStatus.cash.toLocaleString()}`);
      logger.info(`   - Positions: ${intelligence.accountStatus.positions.length}`);
      logger.info(`   - Open Orders: ${intelligence.accountStatus.openOrders.length}`);

      // Check for significant changes
      const bigMovers = [
        ...intelligence.portfolioData.topGainers.filter(t => Math.abs(t.changePercent) > 5),
        ...intelligence.portfolioData.topLosers.filter(t => Math.abs(t.changePercent) > 5)
      ];

      if (bigMovers.length > 0) {
        logger.info(`🚨 Significant moves detected:`);
        for (const mover of bigMovers) {
          logger.info(`   - ${mover.symbol}: ${mover.changePercent >= 0 ? '+' : ''}${mover.changePercent.toFixed(2)}%`);
        }

        // Could trigger a full re-analysis if needed
        // await this.tradingAgent.runDailyAnalysis({ execute: false, notify: true });
      }
    } catch (error) {
      logger.error('Midday check error:', error);
      throw error;
    }
  }

  async runCloseReview(): Promise<void> {
    logger.info('🌆 Close Review starting...');

    try {
      const intelligence = await this.tradingAgent.gatherMarketIntelligence();

      // Calculate daily P/L
      let dailyPL = 0;
      let dailyPLPercent = 0;

      for (const pos of intelligence.accountStatus.positions) {
        dailyPL += pos.currentPrice * pos.qty * (pos.changeToday / 100);
      }

      if (intelligence.accountStatus.portfolioValue > 0) {
        dailyPLPercent = (dailyPL / intelligence.accountStatus.portfolioValue) * 100;
      }

      logger.info(`📊 End of Day Summary:`);
      logger.info(`   - Portfolio Value: $${intelligence.accountStatus.portfolioValue.toLocaleString()}`);
      logger.info(`   - Daily P/L: $${dailyPL >= 0 ? '+' : ''}${dailyPL.toFixed(2)} (${dailyPLPercent >= 0 ? '+' : ''}${dailyPLPercent.toFixed(2)}%)`);
      logger.info(`   - Positions: ${intelligence.accountStatus.positions.length}`);

      // Notify Discord with daily summary
      if (this.discordClient && this.tradingChannelId) {
        await this.notifyDailySummary(intelligence, dailyPL, dailyPLPercent);
      }
    } catch (error) {
      logger.error('Close review error:', error);
      throw error;
    }
  }

  private async notifyDailySummary(
    intelligence: any,
    dailyPL: number,
    dailyPLPercent: number
  ): Promise<void> {
    if (!this.discordClient || !this.tradingChannelId) return;

    try {
      const channel = await this.discordClient.channels.fetch(this.tradingChannelId);
      if (!channel || !channel.isTextBased()) return;

      const { EmbedBuilder, Colors } = await import('discord.js');
      const textChannel = channel as any;

      const plEmoji = dailyPL >= 0 ? '📈' : '📉';
      const color = dailyPL >= 0 ? Colors.Green : Colors.Red;

      const embed = new EmbedBuilder()
        .setTitle(`${plEmoji} Daily Trading Summary`)
        .setColor(color)
        .addFields(
          {
            name: '💼 Portfolio Value',
            value: `$${intelligence.accountStatus.portfolioValue.toLocaleString()}`,
            inline: true
          },
          {
            name: '📊 Daily P/L',
            value: `$${dailyPL >= 0 ? '+' : ''}${dailyPL.toFixed(2)} (${dailyPLPercent >= 0 ? '+' : ''}${dailyPLPercent.toFixed(2)}%)`,
            inline: true
          },
          {
            name: '💵 Cash',
            value: `$${intelligence.accountStatus.cash.toLocaleString()}`,
            inline: true
          },
          {
            name: '📈 Positions',
            value: `${intelligence.accountStatus.positions.length}`,
            inline: true
          },
          {
            name: '📋 Open Orders',
            value: `${intelligence.accountStatus.openOrders.length}`,
            inline: true
          },
          {
            name: '🎯 Market Sentiment',
            value: intelligence.portfolioData.overallSentiment.toUpperCase(),
            inline: true
          }
        )
        .setTimestamp();

      // Add top movers
      if (intelligence.portfolioData.topGainers.length > 0) {
        const gainers = intelligence.portfolioData.topGainers.slice(0, 3)
          .map((t: any) => `${t.symbol}: +${t.changePercent.toFixed(2)}%`)
          .join('\n');
        embed.addFields({ name: '🟢 Top Gainers', value: gainers, inline: true });
      }

      if (intelligence.portfolioData.topLosers.length > 0) {
        const losers = intelligence.portfolioData.topLosers.slice(0, 3)
          .map((t: any) => `${t.symbol}: ${t.changePercent.toFixed(2)}%`)
          .join('\n');
        embed.addFields({ name: '🔴 Top Losers', value: losers, inline: true });
      }

      await textChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to send daily summary:', error);
    }
  }

  // ==========================================================================
  // Manual Triggers
  // ==========================================================================

  async triggerAnalysis(options?: { execute?: boolean }): Promise<void> {
    logger.info('🔄 Manual trading analysis triggered');
    await this.tradingAgent.runDailyAnalysis({
      execute: options?.execute ?? false,
      notify: true
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let tradingSchedulerInstance: TradingScheduler | null = null;

export function getTradingScheduler(config?: any): TradingScheduler {
  if (!tradingSchedulerInstance) {
    tradingSchedulerInstance = new TradingScheduler(config);
  }
  return tradingSchedulerInstance;
}

export function startTradingScheduler(
  discordClient: Client,
  config?: {
    tradingChannelId?: string;
    autoExecute?: boolean;
  }
): TradingScheduler {
  const scheduler = getTradingScheduler({
    tradingChannelId: config?.tradingChannelId,
    autoExecute: config?.autoExecute ?? false
  });

  scheduler.setDiscordClient(discordClient, config?.tradingChannelId);
  scheduler.start();

  return scheduler;
}

export default TradingScheduler;
