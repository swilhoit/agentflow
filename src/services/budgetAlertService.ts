import { logger } from '../utils/logger';
import { getSQLiteDatabase } from './databaseFactory';
import type { DatabaseService } from './database';
import { Client, TextChannel } from 'discord.js';
import * as cron from 'node-cron';

/**
 * Budget Alert Service
 * 
 * Monitors spending against weekly budget and sends alerts
 */
export class BudgetAlertService {
  private db: DatabaseService;
  private discordClient?: Client;
  private channelId: string;
  private weeklyBudget: number;
  private dailyUpdateCron?: cron.ScheduledTask;
  private enabled: boolean;
  
  // Alert thresholds
  private readonly ALERT_THRESHOLDS = [0.5, 0.75, 0.9, 1.0]; // 50%, 75%, 90%, 100%
  private alertsSent: Set<number> = new Set(); // Track which thresholds we've alerted on this week
  
  // Categories to include/exclude
  private discretionaryCategories: string[];
  private workCategories: string[];

  constructor(config: {
    weeklyBudget: number;
    channelId: string;
    enabled?: boolean;
    dailyUpdateTime?: string; // Cron format, default "0 9 * * *" (9 AM daily)
    discretionaryCategories?: string[]; // Categories that count toward budget
    workCategories?: string[]; // Categories to track separately (work-related)
  }) {
    this.db = getSQLiteDatabase();
    this.weeklyBudget = config.weeklyBudget;
    this.channelId = config.channelId;
    this.enabled = config.enabled !== false;
    
    // Default discretionary categories (lifestyle spending)
    this.discretionaryCategories = config.discretionaryCategories || [
      'dining', 'food', 'groceries', 'restaurant',
      'entertainment', 'bar', 'alcohol',
      'transportation', 'uber', 'lyft', 'waymo', 'parking', 'gas', 'fuel',
      'shopping', 'retail', 'clothing', 'general',
      'travel', 'hotel', 'airbnb',
      'sport', 'fitness', 'gym',
      'uncategorized'
    ];
    
    // Work-related categories to track separately
    this.workCategories = config.workCategories || [
      'software', 'subscription', 'saas',
      'office', 'utilities', 'internet', 'phone'
    ];
    
    if (this.enabled) {
      this.setupDailyUpdates(config.dailyUpdateTime || '0 9 * * *');
    }
    
    logger.info(`💰 Budget Alert Service initialized`);
    logger.info(`   Weekly discretionary budget: $${this.weeklyBudget.toLocaleString()}`);
    logger.info(`   Tracking: Food, bars, transportation, entertainment, shopping`);
    logger.info(`   Work expenses tracked separately: Tech, software, phone`);
    logger.info(`   Alert channel: ${this.channelId}`);
    logger.info(`   Status: ${this.enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Set the Discord client for sending messages
   */
  setDiscordClient(client: Client): void {
    this.discordClient = client;
    logger.info('✅ Discord client registered with Budget Alert Service');
  }

  /**
   * Check if transaction is in a category list
   */
  private isInCategories(transaction: any, categories: string[]): boolean {
    const cat = (transaction.category || '').toLowerCase();
    const desc = transaction.description.toLowerCase();
    const merchant = (transaction.merchant || '').toLowerCase();
    
    return categories.some(c => 
      cat.includes(c.toLowerCase()) || 
      desc.includes(c.toLowerCase()) ||
      merchant.includes(c.toLowerCase())
    );
  }

  /**
   * Get current week's spending (discretionary only)
   */
  private getCurrentWeekSpending(): { 
    discretionary: number; 
    work: number; 
    discretionaryTxns: any[];
    workTxns: any[];
    startDate: string; 
    endDate: string;
  } {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate start of week (Monday)
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startDate = startOfWeek.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    
    // Get transactions for current week
    const transactions = this.db.getTransactionsByDateRange(startDate, endDate);
    
    // Filter to actual spending (negative amounts, exclude transfers/payments)
    const excludeKeywords = [
      'PAYMENT', 'ONLINE PAYMENT', 'AUTOPAY', 'ACH PMT', 'EPAYMENT',
      'WIRE REF', 'TRANSFER', 'INST XFER', 'ROBINHOOD', 'INVESTMENT'
    ];
    
    const allSpending = transactions.filter(t => {
      if (t.amount >= 0) return false; // Not a debit
      const upper = t.description.toUpperCase();
      return !excludeKeywords.some(kw => upper.includes(kw));
    });
    
    // Separate discretionary vs work spending
    const discretionaryTxns = allSpending.filter(t => 
      this.isInCategories(t, this.discretionaryCategories)
    );
    
    const workTxns = allSpending.filter(t => 
      this.isInCategories(t, this.workCategories)
    );
    
    const discretionary = Math.abs(discretionaryTxns.reduce((sum, t) => sum + t.amount, 0));
    const work = Math.abs(workTxns.reduce((sum, t) => sum + t.amount, 0));
    
    return { discretionary, work, discretionaryTxns, workTxns, startDate, endDate };
  }

  /**
   * Calculate budget status
   */
  getBudgetStatus(): {
    weeklyBudget: number;
    spent: number;
    workSpending: number;
    remaining: number;
    percentUsed: number;
    isOverBudget: boolean;
    daysIntoWeek: number;
    startDate: string;
    endDate: string;
  } {
    const { discretionary, work, startDate, endDate } = this.getCurrentWeekSpending();
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysIntoWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // Sunday = 7
    
    return {
      weeklyBudget: this.weeklyBudget,
      spent: discretionary,
      workSpending: work,
      remaining: this.weeklyBudget - discretionary,
      percentUsed: (discretionary / this.weeklyBudget) * 100,
      isOverBudget: discretionary > this.weeklyBudget,
      daysIntoWeek,
      startDate,
      endDate
    };
  }

  /**
   * Check if we should send a threshold alert
   */
  private async checkThresholdAlerts(): Promise<void> {
    const status = this.getBudgetStatus();
    
    for (const threshold of this.ALERT_THRESHOLDS) {
      const thresholdAmount = this.weeklyBudget * threshold;
      
      // Check if we've crossed this threshold and haven't alerted yet
      if (status.spent >= thresholdAmount && !this.alertsSent.has(threshold)) {
        await this.sendThresholdAlert(status, threshold);
        this.alertsSent.add(threshold);
      }
    }
  }

  /**
   * Send threshold alert
   */
  private async sendThresholdAlert(status: any, threshold: number): Promise<void> {
    if (!this.discordClient) return;
    
    try {
      const channel = await this.discordClient.channels.fetch(this.channelId) as TextChannel;
      if (!channel || !channel.isTextBased()) return;
      
      const percentage = Math.round(threshold * 100);
      let emoji = '💰';
      let urgency = '';
      
      if (threshold === 1.0) {
        emoji = '🚨';
        urgency = '**BUDGET LIMIT REACHED!**';
      } else if (threshold >= 0.9) {
        emoji = '⚠️';
        urgency = '**Warning: Near budget limit**';
      } else if (threshold >= 0.75) {
        emoji = '⚠️';
        urgency = '**Approaching budget limit**';
      } else {
        emoji = '💡';
        urgency = 'Budget update';
      }
      
      const message = [
        `${emoji} **${urgency}**`,
        '',
        `You've used **${percentage}%** of your weekly budget`,
        `Spent: **$${status.spent.toFixed(2)}** of $${status.weeklyBudget.toFixed(2)}`,
        `Remaining: **$${status.remaining.toFixed(2)}**`,
        '',
        `Day ${status.daysIntoWeek} of 7 (${Math.round((status.daysIntoWeek / 7) * 100)}% through the week)`
      ];
      
      if (status.isOverBudget) {
        message.push('', '🚫 **You are over budget!** Consider reducing spending for the rest of the week.');
      } else if (threshold >= 0.9) {
        message.push('', '💡 **Tip:** You have limited budget left. Prioritize essential purchases only.');
      }
      
      await channel.send(message.join('\n'));
      logger.info(`📊 Sent ${percentage}% budget threshold alert`);
      
    } catch (error) {
      logger.error('Failed to send threshold alert:', error);
    }
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
      const { discretionaryTxns, workTxns } = this.getCurrentWeekSpending();
      
      // Get discretionary spending by category
      const byCategory: Record<string, number> = {};
      discretionaryTxns.forEach(t => {
        const cat = t.category || 'Uncategorized';
        byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
      });
      
      const topCategories = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, amt]) => `  • ${cat}: $${amt.toFixed(2)}`)
        .join('\n');
      
      // Get work spending by category
      const workByCategory: Record<string, number> = {};
      workTxns.forEach(t => {
        const cat = t.category || t.merchant || 'Work Expense';
        workByCategory[cat] = (workByCategory[cat] || 0) + Math.abs(t.amount);
      });
      
      const topWorkExpenses = Object.entries(workByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, amt]) => `  • ${cat}: $${amt.toFixed(2)}`)
        .join('\n');
      
      // Calculate daily average and projections
      const dailyAverage = status.spent / status.daysIntoWeek;
      const projectedWeekly = dailyAverage * 7;
      const daysRemaining = 7 - status.daysIntoWeek;
      const budgetPerDayRemaining = daysRemaining > 0 ? status.remaining / daysRemaining : 0;
      
      // Status emoji
      let statusEmoji = '✅';
      if (status.isOverBudget) {
        statusEmoji = '🚨';
      } else if (status.percentUsed >= 90) {
        statusEmoji = '⚠️';
      } else if (status.percentUsed >= 75) {
        statusEmoji = '💛';
      }
      
      const message = [
        `${statusEmoji} **Weekly Discretionary Budget Update** - Day ${status.daysIntoWeek} of 7`,
        '',
        '💰 **Lifestyle Spending (Food, Bars, Ubers, etc.):**',
        `Budget: $${status.weeklyBudget.toFixed(2)}`,
        `Spent: **$${status.spent.toFixed(2)}** (${status.percentUsed.toFixed(1)}%)`,
        `Remaining: **$${status.remaining.toFixed(2)}**`,
        '',
        '📈 **Progress Bar:**',
        this.generateProgressBar(status.percentUsed),
        '',
        '📅 **Spending Analysis:**',
        `Daily average: $${dailyAverage.toFixed(2)}/day`,
        `Projected weekly: $${projectedWeekly.toFixed(2)}`,
      ];
      
      if (!status.isOverBudget && daysRemaining > 0) {
        message.push(`Budget/day remaining: $${budgetPerDayRemaining.toFixed(2)}/day`);
      }
      
      if (status.isOverBudget) {
        message.push(
          '',
          '🚨 **Over Budget!**',
          `You're $${Math.abs(status.remaining).toFixed(2)} over your weekly limit.`
        );
      } else if (projectedWeekly > status.weeklyBudget) {
        const overage = projectedWeekly - status.weeklyBudget;
        message.push(
          '',
          '⚠️ **On Track to Exceed Budget**',
          `At current rate, you'll be $${overage.toFixed(2)} over budget by week's end.`,
          `💡 Reduce spending to $${budgetPerDayRemaining.toFixed(2)}/day to stay on track.`
        );
      } else {
        message.push(
          '',
          '✅ **On Track!**',
          `Keep up the good work. You can spend up to $${budgetPerDayRemaining.toFixed(2)}/day.`
        );
      }
      
      message.push(
        '',
        '🍽️ **Top Discretionary Categories:**',
        topCategories || '  No spending yet'
      );
      
      // Add work spending section
      if (status.workSpending > 0) {
        message.push(
          '',
          '💼 **Work-Related Expenses (Not counted in budget):**',
          `Tech/Software/Phone: $${status.workSpending.toFixed(2)}`,
          topWorkExpenses || '  No work expenses'
        );
      }
      
      await channel.send(message.join('\n'));
      logger.info('📊 Sent daily budget update');
      
      // Check if we should send threshold alerts
      await this.checkThresholdAlerts();
      
    } catch (error) {
      logger.error('Failed to send daily update:', error);
    }
  }

  /**
   * Generate visual progress bar
   */
  private generateProgressBar(percentUsed: number): string {
    const barLength = 20;
    const filled = Math.min(Math.round((percentUsed / 100) * barLength), barLength);
    const empty = Math.max(barLength - filled, 0);
    
    let fillChar = '█';
    if (percentUsed >= 100) {
      fillChar = '🔴';
    } else if (percentUsed >= 90) {
      fillChar = '🟡';
    } else if (percentUsed >= 75) {
      fillChar = '🟡';
    } else {
      fillChar = '🟢';
    }
    
    const bar = fillChar.repeat(filled) + '░'.repeat(empty);
    return `[${bar}] ${percentUsed.toFixed(1)}%`;
  }

  /**
   * Setup daily budget update schedule
   */
  private setupDailyUpdates(cronExpression: string): void {
    this.dailyUpdateCron = cron.schedule(cronExpression, async () => {
      logger.info('⏰ Running scheduled daily budget update...');
      await this.sendDailyUpdate();
    }, {
      timezone: 'America/Los_Angeles'
    });
    
    logger.info(`⏰ Daily budget updates scheduled: ${cronExpression} PST`);
  }

  /**
   * Manually trigger a budget check (for testing or on-demand)
   */
  async checkBudget(): Promise<void> {
    await this.sendDailyUpdate();
  }

  /**
   * Update weekly budget
   */
  setWeeklyBudget(amount: number): void {
    this.weeklyBudget = amount;
    logger.info(`💰 Weekly budget updated to $${amount.toLocaleString()}`);
  }

  /**
   * Reset alerts for new week (called Monday morning)
   */
  resetWeeklyAlerts(): void {
    this.alertsSent.clear();
    logger.info('🔄 Weekly budget alerts reset');
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (this.dailyUpdateCron) {
      this.dailyUpdateCron.stop();
      logger.info('⏹️  Budget Alert Service stopped');
    }
  }

  /**
   * Start the service
   */
  start(): void {
    if (!this.enabled) {
      logger.warn('Budget Alert Service is disabled');
      return;
    }
    
    logger.info('✅ Budget Alert Service started');
  }
}

