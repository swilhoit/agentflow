import { logger } from '../utils/logger';
import { getSQLiteDatabase, getDatabaseType } from './databaseFactory';
import { getPostgresDatabase, PostgresDatabaseService } from './postgresDatabaseService';
import type { DatabaseService } from './database';
import { Client, TextChannel } from 'discord.js';
import * as cron from 'node-cron';

/**
 * Weekly Budget Summary Service
 *
 * Sends comprehensive weekly budget reports covering:
 * - Personal spending (groceries, dining, other)
 * - Business/work expenses
 * - Week-over-week trends
 * - Monthly projections
 *
 * Supports both SQLite (local) and PostgreSQL (cloud) databases
 */
export class WeeklyBudgetService {
  private sqliteDb?: DatabaseService;
  private postgresDb?: PostgresDatabaseService;
  private usePostgres: boolean;
  private discordClient?: Client;
  private channelId: string;
  private weeklyUpdateCron?: cron.ScheduledTask;
  private enabled: boolean;

  // Budget configurations
  private personalBudgets: {
    groceries: number;
    dining: number;
    other: number;
  };

  private monthlyBusinessBudget: number;

  constructor(config: {
    groceriesBudget: number;
    diningBudget: number;
    otherBudget: number;
    monthlyBusinessBudget: number;
    channelId: string;
    enabled?: boolean;
    weeklyUpdateTime?: string; // Cron format, default "0 20 * * 0" (8 PM Sunday)
  }) {
    const dbType = getDatabaseType();
    this.usePostgres = dbType === 'postgres' || dbType === 'supabase';

    if (this.usePostgres) {
      this.postgresDb = getPostgresDatabase();
    } else {
      this.sqliteDb = getSQLiteDatabase();
    }

    this.personalBudgets = {
      groceries: config.groceriesBudget,
      dining: config.diningBudget,
      other: config.otherBudget
    };
    this.monthlyBusinessBudget = config.monthlyBusinessBudget;
    this.channelId = config.channelId;
    this.enabled = config.enabled !== false;

    if (this.enabled) {
      this.setupWeeklyUpdates(config.weeklyUpdateTime || '0 20 * * 0');
    }

    logger.info(`📅 Weekly Budget Service initialized (${this.usePostgres ? 'PostgreSQL' : 'SQLite'} mode)`);
    logger.info(`   Personal Weekly Budget: $${this.getTotalWeeklyPersonalBudget()}`);
    logger.info(`   Monthly Business Budget: $${this.monthlyBusinessBudget}`);
    logger.info(`   Alert channel: ${this.channelId}`);
    logger.info(`   Status: ${this.enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Set the Discord client for sending messages
   */
  setDiscordClient(client: Client): void {
    this.discordClient = client;
    logger.info('✅ Discord client registered with Weekly Budget Service');
  }

  /**
   * Get total weekly personal budget
   */
  private getTotalWeeklyPersonalBudget(): number {
    return this.personalBudgets.groceries + this.personalBudgets.dining + this.personalBudgets.other;
  }

  /**
   * Categorize a transaction
   */
  private categorizeTransaction(t: any): 'groceries' | 'dining' | 'other' | 'business' | null {
    const desc = t.description.toLowerCase();
    const cat = (t.category || '').toLowerCase();
    const merchant = (t.merchant || '').toLowerCase();

    // Groceries
    const groceryKeywords = [
      'whole foods', 'wholefds', 'trader joe', 'safeway', 'target', 'walmart',
      'costco', 'sprouts', 'lassens', 'market', 'grocery', 'supermarket',
      'h mart', 'ralphs', 'vons', 'albertsons'
    ];
    if (groceryKeywords.some(kw => desc.includes(kw) || merchant.includes(kw) || cat.includes('grocer'))) {
      return 'groceries';
    }

    // Dining out
    const diningKeywords = [
      'restaurant', 'dining', 'bar', 'cafe', 'coffee', 'pizza', 'burger',
      'sushi', 'kitchen', 'grill', 'bistro', 'tavern', 'pub', 'eatery',
      'food', 'taco', 'deli', 'bakery', 'doordash', 'uber eats', 'grubhub',
      'postmates', 'delivery', 'dominos', 'mcdonald', 'chipotle', 'starbucks',
      'tst*', 'aplpay tst', 'little doms', 'mun korean', 'shadowbrook'
    ];
    if (diningKeywords.some(kw => desc.includes(kw) || merchant.includes(kw) || cat.includes('dining') || cat.includes('food'))) {
      return 'dining';
    }

    // Business expenses
    const businessKeywords = [
      'software', 'saas', 'subscription', 'cursor', 'claude', 'anthropic',
      'openai', 'vercel', 'figma', 'heroku', 'github', 'google cloud',
      'phone', 'at&t', 'office', 'utilities', 'aws', 'azure', 'digital ocean',
      'stripe', 'paypal', 'quickbooks', 'zoom', 'slack', 'notion', 'airtable',
      'domain', 'hosting', 'server', 'api', 'cloud'
    ];
    if (businessKeywords.some(kw => desc.includes(kw) || merchant.includes(kw) || cat.includes('software') || cat.includes('phone'))) {
      return 'business';
    }

    // Other personal discretionary
    return 'other';
  }

  /**
   * Get spending for a specific week
   */
  private async getWeekSpending(startDate: string, endDate: string): Promise<{
    groceries: { total: number; transactions: any[] };
    dining: { total: number; transactions: any[] };
    other: { total: number; transactions: any[] };
    business: { total: number; transactions: any[] };
    totalPersonal: number;
  }> {
    // Get transactions from appropriate database
    let transactions: any[];
    if (this.usePostgres && this.postgresDb) {
      transactions = await this.postgresDb.getTransactionsByDateRange(startDate, endDate);
    } else if (this.sqliteDb) {
      transactions = this.sqliteDb.getTransactionsByDateRange(startDate, endDate);
    } else {
      transactions = [];
    }

    // Filter to actual spending
    const excludeKeywords = [
      'PAYMENT', 'ONLINE PAYMENT', 'AUTOPAY', 'ACH PMT', 'EPAYMENT',
      'WIRE REF', 'TRANSFER', 'INST XFER', 'ROBINHOOD', 'INVESTMENT', 'CREDIT'
    ];

    const allSpending = transactions.filter(t => {
      const upper = t.description.toUpperCase();

      // Skip transfers, payments, income deposits, etc
      if (excludeKeywords.some(kw => upper.includes(kw))) return false;

      // Skip income/deposits
      if (upper.includes('FROM ****') || upper.includes('DEPOSIT') || upper.includes('INTERCEPT SALES')) return false;

      // For checking accounts: purchases are negative amounts
      // For credit cards: purchases are positive amounts
      const isChecking = (t.accountName?.includes('Checking') || t.accountType === 'depository');
      const isPurchase = isChecking ? t.amount < 0 : t.amount > 0;

      return isPurchase;
    });

    // Categorize transactions
    const result = {
      groceries: { total: 0, transactions: [] as any[] },
      dining: { total: 0, transactions: [] as any[] },
      other: { total: 0, transactions: [] as any[] },
      business: { total: 0, transactions: [] as any[] },
      totalPersonal: 0
    };

    allSpending.forEach(t => {
      const category = this.categorizeTransaction(t);
      if (category && category !== 'business') {
        result[category].transactions.push(t);
        result[category].total += Math.abs(t.amount);
      } else if (category === 'business') {
        result.business.transactions.push(t);
        result.business.total += Math.abs(t.amount);
      }
    });

    result.totalPersonal = result.groceries.total + result.dining.total + result.other.total;

    return result;
  }

  /**
   * Get current week date range (Monday - Sunday)
   */
  private getCurrentWeekRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return {
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: endOfWeek.toISOString().split('T')[0]
    };
  }

  /**
   * Get previous week date range
   */
  private getPreviousWeekRange(): { startDate: string; endDate: string } {
    const current = this.getCurrentWeekRange();
    const startOfPrevWeek = new Date(current.startDate);
    startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7);

    const endOfPrevWeek = new Date(startOfPrevWeek);
    endOfPrevWeek.setDate(startOfPrevWeek.getDate() + 6);

    return {
      startDate: startOfPrevWeek.toISOString().split('T')[0],
      endDate: endOfPrevWeek.toISOString().split('T')[0]
    };
  }

  /**
   * Get current month date range
   */
  private getCurrentMonthRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      startDate: startOfMonth.toISOString().split('T')[0],
      endDate: endOfMonth.toISOString().split('T')[0]
    };
  }

  /**
   * Generate comparison text with emoji
   */
  private generateComparison(current: number, previous: number): string {
    if (previous === 0) return '(first week)';

    const diff = current - previous;
    const percentChange = (diff / previous) * 100;

    if (Math.abs(percentChange) < 5) {
      return `(≈ same as last week)`;
    } else if (diff > 0) {
      return `(↑ $${Math.abs(diff).toFixed(0)} vs last week, +${percentChange.toFixed(0)}%)`;
    } else {
      return `(↓ $${Math.abs(diff).toFixed(0)} vs last week, ${percentChange.toFixed(0)}%)`;
    }
  }

  /**
   * Generate progress bar
   */
  private generateProgressBar(percentUsed: number): string {
    const barLength = 20;
    const filled = Math.min(Math.round((percentUsed / 100) * barLength), barLength);
    const empty = Math.max(barLength - filled, 0);

    let fillChar = '🟢';
    if (percentUsed >= 100) {
      fillChar = '🔴';
    } else if (percentUsed >= 90) {
      fillChar = '🟡';
    }

    const bar = fillChar.repeat(filled) + '░'.repeat(empty);
    return `[${bar}] ${percentUsed.toFixed(0)}%`;
  }

  /**
   * Send weekly budget summary
   */
  async sendWeeklySummary(): Promise<void> {
    if (!this.discordClient) {
      logger.warn('Cannot send weekly summary - Discord client not set');
      return;
    }

    try {
      const channel = await this.discordClient.channels.fetch(this.channelId) as TextChannel;
      if (!channel || !channel.isTextBased()) return;

      // Get current and previous week data
      const currentWeekRange = this.getCurrentWeekRange();
      const previousWeekRange = this.getPreviousWeekRange();
      const monthRange = this.getCurrentMonthRange();

      const currentWeek = await this.getWeekSpending(currentWeekRange.startDate, currentWeekRange.endDate);
      const previousWeek = await this.getWeekSpending(previousWeekRange.startDate, previousWeekRange.endDate);
      const monthToDate = await this.getWeekSpending(monthRange.startDate, monthRange.endDate);

      const totalWeeklyBudget = this.getTotalWeeklyPersonalBudget();
      const personalPercentUsed = (currentWeek.totalPersonal / totalWeeklyBudget) * 100;

      // Calculate monthly business spending
      const monthlyBusinessPercentUsed = (monthToDate.business.total / this.monthlyBusinessBudget) * 100;

      // Status emoji
      let statusEmoji = '✅';
      if (personalPercentUsed >= 100) statusEmoji = '🚨';
      else if (personalPercentUsed >= 90) statusEmoji = '⚠️';
      else if (personalPercentUsed >= 75) statusEmoji = '💛';

      // Format dates
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };

      const message = [
        `${statusEmoji} **📊 WEEKLY BUDGET SUMMARY**`,
        `Week of ${formatDate(currentWeekRange.startDate)} - ${formatDate(currentWeekRange.endDate)}`,
        '',
        '═══════════════════════════════════',
        '**💳 PERSONAL SPENDING**',
        '═══════════════════════════════════',
        '',
        `**Total Personal Budget:** $${totalWeeklyBudget.toFixed(2)}/week`,
        `**Total Spent:** $${currentWeek.totalPersonal.toFixed(2)}`,
        `**Remaining:** $${(totalWeeklyBudget - currentWeek.totalPersonal).toFixed(2)}`,
        '',
        this.generateProgressBar(personalPercentUsed),
        '',
        '**📈 Category Breakdown:**',
        '',
        `🛒 **Groceries:** $${currentWeek.groceries.total.toFixed(2)} / $${this.personalBudgets.groceries}`,
        `   ${this.generateProgressBar((currentWeek.groceries.total / this.personalBudgets.groceries) * 100)}`,
        `   ${this.generateComparison(currentWeek.groceries.total, previousWeek.groceries.total)}`,
        '',
        `🍽️ **Dining Out:** $${currentWeek.dining.total.toFixed(2)} / $${this.personalBudgets.dining}`,
        `   ${this.generateProgressBar((currentWeek.dining.total / this.personalBudgets.dining) * 100)}`,
        `   ${this.generateComparison(currentWeek.dining.total, previousWeek.dining.total)}`,
        '',
        `💵 **Other (Shopping, Transport, Entertainment):** $${currentWeek.other.total.toFixed(2)} / $${this.personalBudgets.other}`,
        `   ${this.generateProgressBar((currentWeek.other.total / this.personalBudgets.other) * 100)}`,
        `   ${this.generateComparison(currentWeek.other.total, previousWeek.other.total)}`,
        '',
        '═══════════════════════════════════',
        '**💼 BUSINESS EXPENSES**',
        '═══════════════════════════════════',
        '',
        `**Monthly Business Budget:** $${this.monthlyBusinessBudget.toFixed(2)}/month`,
        `**Month-to-Date Spent:** $${monthToDate.business.total.toFixed(2)}`,
        `**Remaining:** $${(this.monthlyBusinessBudget - monthToDate.business.total).toFixed(2)}`,
        '',
        this.generateProgressBar(monthlyBusinessPercentUsed),
        '',
        `**This Week's Business Spending:** $${currentWeek.business.total.toFixed(2)}`,
        `${this.generateComparison(currentWeek.business.total, previousWeek.business.total)}`,
        '',
      ];

      // Week-over-week comparison
      const totalPersonalChange = currentWeek.totalPersonal - previousWeek.totalPersonal;
      const totalBusinessChange = currentWeek.business.total - previousWeek.business.total;

      message.push(
        '═══════════════════════════════════',
        '**📊 WEEK-OVER-WEEK COMPARISON**',
        '═══════════════════════════════════',
        '',
        `**Personal Spending:** ${totalPersonalChange >= 0 ? '↑' : '↓'} $${Math.abs(totalPersonalChange).toFixed(2)} ${totalPersonalChange >= 0 ? 'increase' : 'decrease'}`,
        `**Business Spending:** ${totalBusinessChange >= 0 ? '↑' : '↓'} $${Math.abs(totalBusinessChange).toFixed(2)} ${totalBusinessChange >= 0 ? 'increase' : 'decrease'}`,
        ''
      );

      // Insights and recommendations
      message.push(
        '═══════════════════════════════════',
        '**💡 INSIGHTS & RECOMMENDATIONS**',
        '═══════════════════════════════════',
        ''
      );

      if (currentWeek.totalPersonal > totalWeeklyBudget) {
        message.push('🚨 **Over personal budget!** Consider reviewing spending habits.');
      } else if (personalPercentUsed >= 90) {
        message.push('⚠️ **Near personal budget limit.** Be mindful of remaining budget.');
      } else if (personalPercentUsed < 75) {
        message.push('✅ **Good job staying within budget!** Keep it up.');
      }

      if (monthToDate.business.total > this.monthlyBusinessBudget) {
        message.push('🚨 **Over monthly business budget!** Review business expenses.');
      } else if (monthlyBusinessPercentUsed >= 90) {
        message.push('⚠️ **Approaching monthly business budget limit.**');
      }

      // Monthly projection
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      const projectedMonthlyPersonal = (monthToDate.totalPersonal / dayOfMonth) * daysInMonth;
      const projectedMonthlyBusiness = (monthToDate.business.total / dayOfMonth) * daysInMonth;

      message.push(
        '',
        '**📅 Monthly Projections:**',
        `Personal: $${projectedMonthlyPersonal.toFixed(2)} (${(projectedMonthlyPersonal / (totalWeeklyBudget * 4.33)).toFixed(1)}x monthly budget)`,
        `Business: $${projectedMonthlyBusiness.toFixed(2)} (${(projectedMonthlyBusiness / this.monthlyBusinessBudget * 100).toFixed(0)}% of budget)`
      );

      await channel.send(message.join('\n'));
      logger.info('📊 Sent weekly budget summary');

    } catch (error) {
      logger.error('Failed to send weekly summary:', error);
    }
  }

  /**
   * Setup weekly updates
   */
  private setupWeeklyUpdates(cronExpression: string): void {
    this.weeklyUpdateCron = cron.schedule(cronExpression, async () => {
      logger.info('⏰ Running scheduled weekly budget summary...');
      await this.sendWeeklySummary();
    }, {
      timezone: 'America/Los_Angeles'
    });

    logger.info(`⏰ Weekly budget summaries scheduled: ${cronExpression} PST`);
  }

  /**
   * Manually trigger weekly summary
   */
  async triggerSummary(): Promise<void> {
    await this.sendWeeklySummary();
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (this.weeklyUpdateCron) {
      this.weeklyUpdateCron.stop();
      logger.info('⏹️  Weekly Budget Service stopped');
    }
  }

  /**
   * Start the service
   */
  start(): void {
    if (!this.enabled) {
      logger.warn('Weekly Budget Service is disabled');
      return;
    }

    logger.info('✅ Weekly Budget Service started');
  }
}
