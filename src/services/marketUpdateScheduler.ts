import * as cron from 'node-cron';
import { Client } from 'discord.js';
import { logger } from '../utils/logger';
import { TickerMonitor, THESIS_PORTFOLIO } from './tickerMonitor';
import { IntelligentChannelNotifier } from './intelligentChannelNotifier';
import { NewsMonitor } from './newsMonitor';
import { WeeklyThesisAnalyzer } from './weeklyThesisAnalyzer';

export interface ScheduleConfig {
  // Cron expression for daily updates (default: 9:00 AM ET weekdays)
  dailyUpdateCron: string;
  // Cron expression for market close summary (default: 4:00 PM ET weekdays)
  marketCloseCron: string;
  // Cron expression for news checks (default: every hour during market hours)
  newsCheckCron: string;
  // Cron expression for weekly thesis analysis (default: Sunday 6 PM ET)
  weeklyAnalysisCron: string;
  // Guild ID to post updates to
  guildId: string;
  // Enable/disable scheduler
  enabled: boolean;
  // Timezone (default: America/New_York)
  timezone: string;
  // Finnhub API key for news
  finnhubApiKey?: string;
  // Anthropic API key for weekly analysis
  anthropicApiKey?: string;
}

/**
 * Market Update Scheduler
 * Automatically posts daily ticker updates to Discord
 */
export class MarketUpdateScheduler {
  private client: Client;
  private tickerMonitor: TickerMonitor;
  private newsMonitor: NewsMonitor | null = null;
  private weeklyAnalyzer: WeeklyThesisAnalyzer | null = null;
  private notifier: IntelligentChannelNotifier;
  private config: ScheduleConfig;
  private dailyTask: cron.ScheduledTask | null = null;
  private closeTask: cron.ScheduledTask | null = null;
  private newsTask: cron.ScheduledTask | null = null;
  private weeklyTask: cron.ScheduledTask | null = null;

  constructor(
    client: Client,
    config: ScheduleConfig,
    systemNotificationChannelId?: string
  ) {
    this.client = client;
    this.tickerMonitor = new TickerMonitor();
    this.notifier = new IntelligentChannelNotifier(client, systemNotificationChannelId);
    this.config = config;

    // Initialize news monitor if API key provided
    if (config.finnhubApiKey) {
      this.newsMonitor = new NewsMonitor(config.finnhubApiKey);
      logger.info('✅ News monitoring enabled with Finnhub');
    } else {
      logger.info('ℹ️  News monitoring disabled (no Finnhub API key)');
    }

    // Initialize weekly analyzer if API key provided
    if (config.anthropicApiKey) {
      this.weeklyAnalyzer = new WeeklyThesisAnalyzer(config.anthropicApiKey);
      logger.info('✅ Weekly thesis analysis enabled with Claude');
    } else {
      logger.info('ℹ️  Weekly thesis analysis disabled (no Anthropic API key)');
    }
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('Market update scheduler is disabled in config');
      return;
    }

    try {
      // Daily morning update (market open)
      this.dailyTask = cron.schedule(
        this.config.dailyUpdateCron,
        () => this.runDailyUpdate(),
        {
          timezone: this.config.timezone
        }
      );

      // Market close summary
      this.closeTask = cron.schedule(
        this.config.marketCloseCron,
        () => this.runMarketCloseSummary(),
        {
          timezone: this.config.timezone
        }
      );

      // Hourly news check (if news monitor enabled)
      if (this.newsMonitor) {
        this.newsTask = cron.schedule(
          this.config.newsCheckCron,
          () => this.runNewsCheck(),
          {
            timezone: this.config.timezone
          }
        );
      }

      // Weekly thesis analysis (if analyzer enabled)
      if (this.weeklyAnalyzer) {
        this.weeklyTask = cron.schedule(
          this.config.weeklyAnalysisCron,
          () => this.runWeeklyAnalysis(),
          {
            timezone: this.config.timezone
          }
        );
      }

      logger.info(`📅 Market update scheduler started:`);
      logger.info(`   • Daily update: ${this.config.dailyUpdateCron} (${this.config.timezone})`);
      logger.info(`   • Market close: ${this.config.marketCloseCron} (${this.config.timezone})`);
      if (this.newsMonitor) {
        logger.info(`   • News checks: ${this.config.newsCheckCron} (${this.config.timezone})`);
      }
      if (this.weeklyAnalyzer) {
        logger.info(`   • Weekly analysis: ${this.config.weeklyAnalysisCron} (${this.config.timezone})`);
      }
    } catch (error) {
      logger.error('Failed to start market update scheduler', error);
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.dailyTask) {
      this.dailyTask.stop();
      logger.info('Daily update task stopped');
    }

    if (this.closeTask) {
      this.closeTask.stop();
      logger.info('Market close task stopped');
    }

    if (this.newsTask) {
      this.newsTask.stop();
      logger.info('News check task stopped');
    }

    if (this.weeklyTask) {
      this.weeklyTask.stop();
      logger.info('Weekly analysis task stopped');
    }
  }

  /**
   * Run daily morning update
   */
  private async runDailyUpdate(): Promise<void> {
    try {
      logger.info('🌅 Running daily market update...');

      // Check if it's a weekday (markets are closed on weekends)
      const today = new Date();
      const dayOfWeek = today.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        logger.info('📅 Weekend - skipping market update');
        return;
      }

      // Send "fetching data" message
      await this.notifier.sendIntelligentMessage(
        this.config.guildId,
        '⏳ Fetching AI Manhattan Project thesis updates...',
        'finance'
      );

      // Fetch portfolio data
      const categoryData = await this.tickerMonitor.fetchThesisPortfolio();

      // Find the finance/AI channel
      const channelId = await this.notifier.getChannelAwareness().findBestChannel(
        this.config.guildId,
        'finance',
        'AI Manhattan Project market update'
      );

      if (!channelId) {
        logger.error('Could not find appropriate channel for market updates');
        return;
      }

      // Generate and send embeds
      const embeds = this.tickerMonitor.generateDailySummaryEmbed(categoryData);

      // Send embeds in batches (Discord limit: 10 embeds per message)
      for (let i = 0; i < embeds.length; i += 10) {
        const batch = embeds.slice(i, i + 10);
        await this.notifier.sendMessage(this.config.guildId, channelId, '', false);

        // Send embeds through Discord.js
        const guild = await this.client.guilds.fetch(this.config.guildId);
        const channel = await guild.channels.fetch(channelId);

        if (channel && channel.isTextBased()) {
          await channel.send({ embeds: batch });
        }

        // Small delay between batches to avoid rate limits
        if (i + 10 < embeds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info('✅ Daily market update posted successfully');

      // Post thesis reminder
      await this.postThesisReminder(channelId);

    } catch (error) {
      logger.error('Failed to run daily update', error);

      await this.notifier.sendIntelligentMessage(
        this.config.guildId,
        '❌ Failed to fetch market data. Will retry at market close.',
        'finance'
      );
    }
  }

  /**
   * Run market close summary
   */
  private async runMarketCloseSummary(): Promise<void> {
    try {
      logger.info('🔔 Running market close summary...');

      // Check if it's a weekday
      const today = new Date();
      const dayOfWeek = today.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        logger.info('📅 Weekend - skipping market close summary');
        return;
      }

      // Fetch portfolio data
      const categoryData = await this.tickerMonitor.fetchThesisPortfolio();

      // Generate compact summary
      const summary = this.tickerMonitor.generateCompactSummary(categoryData);

      // Post to finance channel
      await this.notifier.sendIntelligentMessage(
        this.config.guildId,
        `🔔 **Market Close Summary**\n\n${summary}`,
        'finance'
      );

      logger.info('✅ Market close summary posted successfully');

    } catch (error) {
      logger.error('Failed to run market close summary', error);
    }
  }

  /**
   * Post thesis reminder (educational)
   */
  private async postThesisReminder(channelId: string): Promise<void> {
    const reminder = `
💡 **Thesis Recap: AI Manhattan Project + China/ROW**

The portfolio tracks the energy revolution powering AI with exposure to:
• 🇺🇸 **US policy leverage**: Next-gen nuclear, uranium, grid modernization
• 🌏 **Global competition**: China/ROW nuclear buildout & critical minerals
• ⚡ **AI infrastructure**: Data center REITs, power utilities
• 📊 **Risk management**: Diversified across uranium ETFs, physical trusts

*This is a high-conviction, asymmetric bet on AI × energy as a mega-trend.*
    `.trim();

    const guild = await this.client.guilds.fetch(this.config.guildId);
    const channel = await guild.channels.fetch(channelId);

    if (channel && channel.isTextBased()) {
      await channel.send(reminder);
    }
  }

  /**
   * Manually trigger daily update (for testing)
   */
  async triggerDailyUpdate(): Promise<void> {
    logger.info('🔧 Manually triggering daily update...');
    await this.runDailyUpdate();
  }

  /**
   * Manually trigger market close summary (for testing)
   */
  async triggerMarketCloseSummary(): Promise<void> {
    logger.info('🔧 Manually triggering market close summary...');
    await this.runMarketCloseSummary();
  }

  /**
   * Run hourly news check
   */
  private async runNewsCheck(): Promise<void> {
    if (!this.newsMonitor) {
      return;
    }

    try {
      logger.info('📰 Running hourly news check...');

      // Check if it's a weekday
      const today = new Date();
      const dayOfWeek = today.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        logger.info('📅 Weekend - skipping news check');
        return;
      }

      // Get all tickers from the thesis portfolio
      const allTickers = THESIS_PORTFOLIO.flatMap(category => category.tickers);

      // Check for new news
      const newsBySymbol = await this.newsMonitor.checkForNewNews(allTickers);

      if (newsBySymbol.size === 0) {
        logger.info('No new news articles found');
        return;
      }

      // Find the finance channel
      const channelId = await this.notifier.getChannelAwareness().findBestChannel(
        this.config.guildId,
        'finance',
        'AI Manhattan Project news update'
      );

      if (!channelId) {
        logger.error('Could not find appropriate channel for news updates');
        return;
      }

      const guild = await this.client.guilds.fetch(this.config.guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        logger.error('Channel is not text-based');
        return;
      }

      // Send news summary
      const summaryEmbed = this.newsMonitor.generateNewsSummary(newsBySymbol);
      await channel.send({ embeds: [summaryEmbed] });

      // Send individual embeds for significant news
      let significantNewsCount = 0;
      for (const [symbol, articles] of newsBySymbol) {
        for (const article of articles) {
          if (this.newsMonitor.isSignificantNews(article)) {
            const embed = this.newsMonitor.generateNewsEmbed(article);
            await channel.send({ embeds: [embed] });
            significantNewsCount++;

            // Limit to 5 significant news per hour to avoid spam
            if (significantNewsCount >= 5) {
              break;
            }

            // Small delay between messages
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        if (significantNewsCount >= 5) {
          break;
        }
      }

      logger.info(`✅ Posted ${newsBySymbol.size} news summaries, ${significantNewsCount} significant alerts`);

    } catch (error) {
      logger.error('Failed to run news check', error);
    }
  }

  /**
   * Manually trigger news check (for testing)
   */
  async triggerNewsCheck(): Promise<void> {
    logger.info('🔧 Manually triggering news check...');
    await this.runNewsCheck();
  }

  /**
   * Run weekly thesis analysis
   */
  private async runWeeklyAnalysis(): Promise<void> {
    if (!this.weeklyAnalyzer) {
      return;
    }

    try {
      logger.info('📊 Running weekly thesis analysis...');

      // Send "analyzing" message
      await this.notifier.sendIntelligentMessage(
        this.config.guildId,
        '🤖 Analyzing AI Manhattan Project thesis progress for the week...\n_This will take 30-60 seconds as Claude reviews all market data and news._',
        'finance'
      );

      // Generate analysis
      const analysis = await this.weeklyAnalyzer.generateWeeklyAnalysis();

      // Find the finance channel
      const channelId = await this.notifier.getChannelAwareness().findBestChannel(
        this.config.guildId,
        'finance',
        'AI Manhattan Project weekly analysis'
      );

      if (!channelId) {
        logger.error('Could not find appropriate channel for weekly analysis');
        return;
      }

      const guild = await this.client.guilds.fetch(this.config.guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        logger.error('Channel is not text-based');
        return;
      }

      // Generate and send embeds
      const embeds = this.weeklyAnalyzer.generateAnalysisEmbeds(analysis);

      // Send header message
      await channel.send(`## 📊 AI Manhattan Project - Weekly Thesis Analysis\n**Week of ${analysis.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${analysis.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}**`);

      // Send all embeds (in batches if needed)
      for (let i = 0; i < embeds.length; i += 10) {
        const batch = embeds.slice(i, i + 10);
        await channel.send({ embeds: batch });

        // Small delay between batches
        if (i + 10 < embeds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info(`✅ Weekly analysis posted successfully (${analysis.keyMetrics.totalDataPoints} data points analyzed)`);

    } catch (error: any) {
      logger.error('Failed to run weekly analysis:', error);

      await this.notifier.sendIntelligentMessage(
        this.config.guildId,
        `❌ Weekly analysis failed: ${error.message}\n_Will retry next Sunday._`,
        'finance'
      );
    }
  }

  /**
   * Manually trigger weekly analysis (for testing)
   */
  async triggerWeeklyAnalysis(): Promise<void> {
    logger.info('🔧 Manually triggering weekly analysis...');
    await this.runWeeklyAnalysis();
  }

  /**
   * Get ticker monitor instance
   */
  getTickerMonitor(): TickerMonitor {
    return this.tickerMonitor;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ScheduleConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart scheduler if it was running
    if (this.dailyTask || this.closeTask) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ScheduleConfig {
    return { ...this.config };
  }
}

/**
 * Default schedule configuration
 */
export const DEFAULT_SCHEDULE_CONFIG: Omit<ScheduleConfig, 'guildId'> = {
  // 9:00 AM ET, Monday-Friday
  dailyUpdateCron: '0 9 * * 1-5',
  // 4:05 PM ET, Monday-Friday (5 mins after market close)
  marketCloseCron: '5 16 * * 1-5',
  // Every hour from 9 AM to 4 PM ET, Monday-Friday (market hours)
  newsCheckCron: '0 9-16 * * 1-5',
  // 6:00 PM ET, Sunday
  weeklyAnalysisCron: '0 18 * * 0',
  enabled: true,
  timezone: 'America/New_York'
};
