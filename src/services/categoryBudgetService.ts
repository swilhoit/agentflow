import { logger } from '../utils/logger';
import { getSQLiteDatabase } from './databaseFactory';
import type { DatabaseService } from './database';
import { Client, TextChannel } from 'discord.js';
import * as cron from 'node-cron';

/**
 * Category Budget Service
 * 
 * Tracks separate budgets for different spending categories
 */
export class CategoryBudgetService {
  private db: DatabaseService;
  private discordClient?: Client;
  private channelId: string;
  private dailyUpdateCron?: cron.ScheduledTask;
  private enabled: boolean;
  
  // Category budgets
  private budgets: {
    groceries: number;
    dining: number;
    other: number;
  };
  
  // Alert thresholds
  private readonly ALERT_THRESHOLDS = [0.75, 0.9, 1.0]; // 75%, 90%, 100%
  private alertsSent: Map<string, Set<number>> = new Map(); // Track alerts per category

  constructor(config: {
    groceriesBudget: number;
    diningBudget: number;
    otherBudget: number;
    channelId: string;
    enabled?: boolean;
    dailyUpdateTime?: string;
  }) {
    this.db = getSQLiteDatabase();
    this.budgets = {
      groceries: config.groceriesBudget,
      dining: config.diningBudget,
      other: config.otherBudget
    };
    this.channelId = config.channelId;
    this.enabled = config.enabled !== false;
    
    // Initialize alert tracking
    this.alertsSent.set('groceries', new Set());
    this.alertsSent.set('dining', new Set());
    this.alertsSent.set('other', new Set());
    
    if (this.enabled) {
      this.setupDailyUpdates(config.dailyUpdateTime || '0 9 * * *');
    }
    
    logger.info(`💰 Category Budget Service initialized`);
    logger.info(`   🛒 Groceries: $${this.budgets.groceries}/week`);
    logger.info(`   🍽️  Dining Out: $${this.budgets.dining}/week`);
    logger.info(`   💵 Other: $${this.budgets.other}/week`);
    logger.info(`   📊 Total: $${this.budgets.groceries + this.budgets.dining + this.budgets.other}/week`);
    logger.info(`   Alert channel: ${this.channelId}`);
    logger.info(`   Status: ${this.enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Set the Discord client for sending messages
   */
  setDiscordClient(client: Client): void {
    this.discordClient = client;
    logger.info('✅ Discord client registered with Category Budget Service');
  }

  /**
   * Categorize a transaction
   */
  private categorizeTransaction(t: any): 'groceries' | 'dining' | 'other' | 'work' | null {
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
    
    // Work expenses (tracked separately)
    const workKeywords = [
      'software', 'saas', 'subscription', 'cursor', 'claude', 'anthropic',
      'openai', 'vercel', 'figma', 'heroku', 'github', 'google cloud',
      'phone', 'at&t', 'office', 'utilities'
    ];
    if (workKeywords.some(kw => desc.includes(kw) || merchant.includes(kw) || cat.includes('software') || cat.includes('phone'))) {
      return 'work';
    }
    
    // Other discretionary
    return 'other';
  }

  /**
   * Get current week's spending by category
   */
  private getCurrentWeekSpending(): {
    groceries: { total: number; transactions: any[] };
    dining: { total: number; transactions: any[] };
    other: { total: number; transactions: any[] };
    work: { total: number; transactions: any[] };
    startDate: string;
    endDate: string;
  } {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startDate = startOfWeek.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    
    const transactions = this.db.getTransactionsByDateRange(startDate, endDate);
    
    // Filter to actual spending
    const excludeKeywords = [
      'PAYMENT', 'ONLINE PAYMENT', 'AUTOPAY', 'ACH PMT', 'EPAYMENT',
      'WIRE REF', 'TRANSFER', 'INST XFER', 'ROBINHOOD', 'INVESTMENT'
    ];
    
    const allSpending = transactions.filter(t => {
      if (t.amount >= 0) return false;
      const upper = t.description.toUpperCase();
      return !excludeKeywords.some(kw => upper.includes(kw));
    });
    
    // Categorize transactions
    const result = {
      groceries: { total: 0, transactions: [] as any[] },
      dining: { total: 0, transactions: [] as any[] },
      other: { total: 0, transactions: [] as any[] },
      work: { total: 0, transactions: [] as any[] },
      startDate,
      endDate
    };
    
    allSpending.forEach(t => {
      const category = this.categorizeTransaction(t);
      if (category && category !== 'work') {
        result[category].transactions.push(t);
        result[category].total += Math.abs(t.amount);
      } else if (category === 'work') {
        result.work.transactions.push(t);
        result.work.total += Math.abs(t.amount);
      }
    });
    
    return result;
  }

  /**
   * Get budget status for all categories
   */
  getBudgetStatus() {
    const spending = this.getCurrentWeekSpending();
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysIntoWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
    
    return {
      groceries: {
        budget: this.budgets.groceries,
        spent: spending.groceries.total,
        remaining: this.budgets.groceries - spending.groceries.total,
        percentUsed: (spending.groceries.total / this.budgets.groceries) * 100,
        isOverBudget: spending.groceries.total > this.budgets.groceries
      },
      dining: {
        budget: this.budgets.dining,
        spent: spending.dining.total,
        remaining: this.budgets.dining - spending.dining.total,
        percentUsed: (spending.dining.total / this.budgets.dining) * 100,
        isOverBudget: spending.dining.total > this.budgets.dining
      },
      other: {
        budget: this.budgets.other,
        spent: spending.other.total,
        remaining: this.budgets.other - spending.other.total,
        percentUsed: (spending.other.total / this.budgets.other) * 100,
        isOverBudget: spending.other.total > this.budgets.other
      },
      work: {
        spent: spending.work.total
      },
      daysIntoWeek,
      startDate: spending.startDate,
      endDate: spending.endDate
    };
  }

  /**
   * Check and send threshold alerts for all categories
   */
  private async checkThresholdAlerts(): Promise<void> {
    const status = this.getBudgetStatus();
    
    // Check each category
    for (const [category, data] of Object.entries(status)) {
      if (category === 'work' || category === 'daysIntoWeek' || category === 'startDate' || category === 'endDate') continue;
      
      const categoryData = data as any;
      const alerts = this.alertsSent.get(category)!;
      
      for (const threshold of this.ALERT_THRESHOLDS) {
        const thresholdAmount = categoryData.budget * threshold;
        
        if (categoryData.spent >= thresholdAmount && !alerts.has(threshold)) {
          await this.sendCategoryAlert(category, categoryData, threshold);
          alerts.add(threshold);
        }
      }
    }
  }

  /**
   * Send alert for specific category
   */
  private async sendCategoryAlert(category: string, data: any, threshold: number): Promise<void> {
    if (!this.discordClient) return;
    
    try {
      const channel = await this.discordClient.channels.fetch(this.channelId) as TextChannel;
      if (!channel || !channel.isTextBased()) return;
      
      const percentage = Math.round(threshold * 100);
      const categoryEmojis: Record<string, string> = {
        groceries: '🛒',
        dining: '🍽️',
        other: '💵'
      };
      
      const categoryNames: Record<string, string> = {
        groceries: 'Groceries',
        dining: 'Dining Out',
        other: 'Other Spending'
      };
      
      let emoji = '⚠️';
      let urgency = '';
      
      if (threshold === 1.0) {
        emoji = '🚨';
        urgency = '**BUDGET LIMIT REACHED!**';
      } else if (threshold >= 0.9) {
        emoji = '⚠️';
        urgency = '**Warning: Near limit**';
      } else {
        emoji = '⚠️';
        urgency = '**Approaching limit**';
      }
      
      const message = [
        `${categoryEmojis[category]} ${emoji} **${categoryNames[category]}: ${urgency}**`,
        '',
        `You've used **${percentage}%** of your ${categoryNames[category].toLowerCase()} budget`,
        `Spent: **$${data.spent.toFixed(2)}** of $${data.budget.toFixed(2)}`,
        `Remaining: **$${data.remaining.toFixed(2)}**`
      ];
      
      if (data.isOverBudget) {
        message.push('', '🚫 **Over budget!** Try to reduce spending in this category.');
      }
      
      await channel.send(message.join('\n'));
      logger.info(`📊 Sent ${percentage}% alert for ${category}`);
      
    } catch (error) {
      logger.error(`Failed to send ${category} alert:`, error);
    }
  }

  /**
   * Generate progress bar
   */
  private generateProgressBar(percentUsed: number, budget: number, spent: number): string {
    const barLength = 15;
    const filled = Math.min(Math.round((percentUsed / 100) * barLength), barLength);
    const empty = Math.max(barLength - filled, 0);
    
    let fillChar = '🟢';
    if (percentUsed >= 100) {
      fillChar = '🔴';
    } else if (percentUsed >= 90) {
      fillChar = '🟡';
    }
    
    const bar = fillChar.repeat(filled) + '░'.repeat(empty);
    return `[${bar}] ${percentUsed.toFixed(0)}% ($${spent.toFixed(0)}/$${budget})`;
  }

  /**
   * Send daily budget update
   */
  async sendDailyUpdate(): Promise<void> {
    if (!this.discordClient) {
      logger.warn('Cannot send daily update - Discord client not set');
      return;
    }
    
    try {
      const channel = await this.discordClient.channels.fetch(this.channelId) as TextChannel;
      if (!channel || !channel.isTextBased()) return;
      
      const status = this.getBudgetStatus();
      
      // Overall status
      const totalBudget = this.budgets.groceries + this.budgets.dining + this.budgets.other;
      const totalSpent = status.groceries.spent + status.dining.spent + status.other.spent;
      const totalRemaining = totalBudget - totalSpent;
      const overallPercent = (totalSpent / totalBudget) * 100;
      
      let statusEmoji = '✅';
      if (overallPercent >= 100) statusEmoji = '🚨';
      else if (overallPercent >= 90) statusEmoji = '⚠️';
      else if (overallPercent >= 75) statusEmoji = '💛';
      
      const message = [
        `${statusEmoji} **Weekly Budget Update** - Day ${status.daysIntoWeek} of 7`,
        '',
        '📊 **Overall Progress:**',
        `Total Budget: $${totalBudget}`,
        `Total Spent: **$${totalSpent.toFixed(2)}** (${overallPercent.toFixed(1)}%)`,
        `Remaining: **$${totalRemaining.toFixed(2)}**`,
        '',
        '🛒 **Groceries:**',
        this.generateProgressBar(status.groceries.percentUsed, status.groceries.budget, status.groceries.spent),
        status.groceries.isOverBudget ? '❌ Over budget!' : `✅ $${status.groceries.remaining.toFixed(2)} left`,
        '',
        '🍽️ **Dining Out (Restaurants, Bars, Delivery):**',
        this.generateProgressBar(status.dining.percentUsed, status.dining.budget, status.dining.spent),
        status.dining.isOverBudget ? '❌ Over budget!' : `✅ $${status.dining.remaining.toFixed(2)} left`,
        '',
        '💵 **Other (Shopping, Uber, Entertainment):**',
        this.generateProgressBar(status.other.percentUsed, status.other.budget, status.other.spent),
        status.other.isOverBudget ? '❌ Over budget!' : `✅ $${status.other.remaining.toFixed(2)} left`,
      ];
      
      // Work expenses
      if (status.work.spent > 0) {
        message.push(
          '',
          '💼 **Work Expenses (Not in budget):**',
          `Tech/Software/Phone: $${status.work.spent.toFixed(2)}`
        );
      }
      
      // Recommendations
      const daysRemaining = 7 - status.daysIntoWeek;
      if (daysRemaining > 0) {
        message.push(
          '',
          '💡 **Budget per day remaining:**',
          `  🛒 Groceries: $${(status.groceries.remaining / daysRemaining).toFixed(2)}/day`,
          `  🍽️  Dining: $${(status.dining.remaining / daysRemaining).toFixed(2)}/day`,
          `  💵 Other: $${(status.other.remaining / daysRemaining).toFixed(2)}/day`
        );
      }
      
      await channel.send(message.join('\n'));
      logger.info('📊 Sent daily category budget update');
      
      // Check threshold alerts
      await this.checkThresholdAlerts();
      
    } catch (error) {
      logger.error('Failed to send daily update:', error);
    }
  }

  /**
   * Setup daily updates
   */
  private setupDailyUpdates(cronExpression: string): void {
    this.dailyUpdateCron = cron.schedule(cronExpression, async () => {
      logger.info('⏰ Running scheduled category budget update...');
      await this.sendDailyUpdate();
    }, {
      timezone: 'America/Los_Angeles'
    });
    
    logger.info(`⏰ Daily category budget updates scheduled: ${cronExpression} PST`);
  }

  /**
   * Manually trigger update
   */
  async checkBudget(): Promise<void> {
    await this.sendDailyUpdate();
  }

  /**
   * Reset weekly alerts
   */
  resetWeeklyAlerts(): void {
    this.alertsSent.forEach(set => set.clear());
    logger.info('🔄 Weekly category budget alerts reset');
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (this.dailyUpdateCron) {
      this.dailyUpdateCron.stop();
      logger.info('⏹️  Category Budget Service stopped');
    }
  }

  /**
   * Start the service
   */
  start(): void {
    if (!this.enabled) {
      logger.warn('Category Budget Service is disabled');
      return;
    }
    
    logger.info('✅ Category Budget Service started');
  }
}

