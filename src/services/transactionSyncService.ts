import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { getSQLiteDatabase } from './databaseFactory';
import { FinancialTransaction } from './database';
import { AdvisorTools } from '../advisor/advisorTools';

export interface TransactionSyncConfig {
  enabled: boolean;
  cronExpression?: string; // Default: '0 2 * * *' (2:00 AM daily)
  timezone?: string; // Default: 'America/Los_Angeles'
  daysToSync?: number; // Default: 90 days
}

/**
 * Transaction Sync Service
 * 
 * Automatically syncs transactions from Teller API to the local database
 * Runs daily to keep transaction history up to date
 */
export class TransactionSyncService {
  private db = getSQLiteDatabase();
  private advisorTools: AdvisorTools;
  private scheduledTask: any = null;
  private config: TransactionSyncConfig;
  private isSyncing: boolean = false;

  constructor(config: TransactionSyncConfig) {
    this.config = {
      enabled: config.enabled,
      cronExpression: config.cronExpression || '0 2 * * *', // 2:00 AM daily
      timezone: config.timezone || 'America/Los_Angeles',
      daysToSync: config.daysToSync || 90
    };

    this.advisorTools = new AdvisorTools();

    if (this.config.enabled) {
      this.start();
    }
  }

  /**
   * Start the scheduled sync
   */
  start(): void {
    if (this.scheduledTask) {
      logger.warn('Transaction sync is already running');
      return;
    }

    logger.info('Starting transaction sync service...');
    logger.info(`Schedule: ${this.config.cronExpression} (${this.config.timezone})`);

    this.scheduledTask = cron.schedule(
      this.config.cronExpression!,
      async () => {
        await this.sync();
      },
      {
        timezone: this.config.timezone as any
      }
    );

    logger.info('✅ Transaction sync service started');
  }

  /**
   * Stop the scheduled sync
   */
  stop(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
      logger.info('Transaction sync service stopped');
    }
  }

  /**
   * Manually trigger a sync
   */
  async triggerSync(): Promise<{ success: boolean; message: string; stats?: any }> {
    if (this.isSyncing) {
      return {
        success: false,
        message: 'Sync already in progress'
      };
    }

    try {
      const stats = await this.sync();
      return {
        success: true,
        message: 'Sync completed successfully',
        stats
      };
    } catch (error) {
      logger.error('Manual sync failed:', error);
      return {
        success: false,
        message: `Sync failed: ${error}`
      };
    }
  }

  /**
   * Perform the actual sync
   */
  private async sync(): Promise<any> {
    if (this.isSyncing) {
      logger.warn('Sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    const startTime = Date.now();

    logger.info('🔄 Starting transaction sync...');

    try {
      // Get all connected accounts
      const accountsResult = await this.advisorTools.executeTool('get_accounts', {});

      if (accountsResult.error) {
        throw new Error(`Failed to fetch accounts: ${accountsResult.error}`);
      }

      const accounts = accountsResult.accounts || [];
      logger.info(`Found ${accounts.length} account(s) to sync`);

      let totalSynced = 0;
      let totalNew = 0;
      let totalUpdated = 0;
      const accountStats: any[] = [];

      // Sync transactions for each account
      for (const account of accounts) {
        logger.info(`Syncing account: ${account.name} (${account.id})`);

        try {
          // Fetch transactions (up to 500 for the past period)
          const txnResult = await this.advisorTools.executeTool('get_transactions', {
            account_id: account.id,
            count: 500
          });

          if (txnResult.error) {
            logger.error(`Failed to fetch transactions for ${account.name}:`, txnResult.error);
            continue;
          }

          const transactions = txnResult.transactions || [];
          logger.info(`  Retrieved ${transactions.length} transaction(s)`);

          // Get existing transaction IDs to check for duplicates
          const existingTransactions = this.db.getTransactionsByAccount(account.id, 1000);
          const existingIds = new Set(existingTransactions.map(t => t.transactionId));

          // Prepare transactions for database
          const transactionsToSave: FinancialTransaction[] = transactions.map((txn: any) => ({
            transactionId: txn.id,
            accountId: account.id,
            accountName: account.name,
            accountType: account.type,
            institution: account.institution,
            date: txn.date,
            description: txn.description,
            amount: parseFloat(txn.amount),
            type: txn.type,
            category: txn.category || null,
            merchant: txn.merchant || null,
            details: JSON.stringify(txn),
            syncedAt: new Date(),
            metadata: null
          }));

          // Count new vs updated
          let newCount = 0;
          let updatedCount = 0;

          for (const txn of transactionsToSave) {
            if (existingIds.has(txn.transactionId)) {
              updatedCount++;
            } else {
              newCount++;
            }
          }

          // Save in batch
          if (transactionsToSave.length > 0) {
            this.db.saveTransactionsBatch(transactionsToSave);
            totalSynced += transactionsToSave.length;
            totalNew += newCount;
            totalUpdated += updatedCount;
          }

          accountStats.push({
            account: account.name,
            synced: transactionsToSave.length,
            new: newCount,
            updated: updatedCount
          });

          logger.info(`  ✅ Synced ${transactionsToSave.length} transactions (${newCount} new, ${updatedCount} updated)`);

        } catch (error) {
          logger.error(`Error syncing account ${account.name}:`, error);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const lastSync = new Date().toISOString();

      const stats = {
        success: true,
        lastSync,
        duration: `${duration}s`,
        accounts: accounts.length,
        totalTransactions: totalSynced,
        newTransactions: totalNew,
        updatedTransactions: totalUpdated,
        accountStats
      };

      logger.info('✅ Transaction sync completed successfully');
      logger.info(`   Total synced: ${totalSynced} (${totalNew} new, ${totalUpdated} updated)`);
      logger.info(`   Duration: ${duration}s`);

      return stats;

    } catch (error) {
      logger.error('❌ Transaction sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get sync status
   */
  getStatus(): any {
    const lastSync = this.db.getLastTransactionSync();
    const recentTransactions = this.db.getRecentTransactions(7);

    return {
      enabled: this.config.enabled,
      running: this.scheduledTask !== null,
      syncing: this.isSyncing,
      schedule: this.config.cronExpression,
      timezone: this.config.timezone,
      lastSync: lastSync?.toISOString() || 'Never',
      recentTransactionCount: recentTransactions.length,
      totalTransactions: this.getTotalTransactionCount()
    };
  }

  /**
   * Get total transaction count from database
   */
  private getTotalTransactionCount(): number {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM financial_transactions');
      const result: any = stmt.get();
      return result?.count || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get sync history/stats
   */
  async getSyncStats(days: number = 30): Promise<any> {
    const recentTransactions = this.db.getRecentTransactions(days);
    const categories = this.db.getTransactionCategories();
    
    const today = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const spendingSummary = this.db.getSpendingSummary(startDateStr, today);

    return {
      period: `${days} days`,
      transactionCount: recentTransactions.length,
      uniqueCategories: categories.length,
      spendingByCategory: spendingSummary,
      lastSync: this.db.getLastTransactionSync()?.toISOString() || 'Never'
    };
  }

  /**
   * Clean up old transactions
   */
  async cleanupOldTransactions(daysToKeep: number = 365): Promise<number> {
    logger.info(`Cleaning up transactions older than ${daysToKeep} days...`);
    const deleted = this.db.deleteOldTransactions(daysToKeep);
    logger.info(`✅ Deleted ${deleted} old transaction(s)`);
    return deleted;
  }
}

