import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { getSQLiteDatabase, getDatabaseType } from './databaseFactory';
import { getPostgresDatabase, PostgresDatabaseService } from './postgresDatabaseService';
import { FinancialTransaction } from './database';
import type { DatabaseService } from './database';
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
 * Automatically syncs transactions from Teller API to the database
 * Runs daily to keep transaction history up to date
 * Supports both SQLite (local) and PostgreSQL (cloud) databases
 */
export class TransactionSyncService {
  private sqliteDb?: DatabaseService;
  private postgresDb?: PostgresDatabaseService;
  private usePostgres: boolean;
  private advisorTools: AdvisorTools;
  private scheduledTask: any = null;
  private config: TransactionSyncConfig;
  private isSyncing: boolean = false;

  constructor(config: TransactionSyncConfig) {
    const dbType = getDatabaseType();
    this.usePostgres = dbType === 'postgres' || dbType === 'supabase';

    if (this.usePostgres) {
      this.postgresDb = getPostgresDatabase();
    } else {
      this.sqliteDb = getSQLiteDatabase();
    }

    this.config = {
      enabled: config.enabled,
      cronExpression: config.cronExpression || '0 2 * * *', // 2:00 AM daily
      timezone: config.timezone || 'America/Los_Angeles',
      daysToSync: config.daysToSync || 90
    };

    this.advisorTools = new AdvisorTools();

    logger.info(`🔄 Transaction Sync Service initialized (${this.usePostgres ? 'PostgreSQL' : 'SQLite'} mode)`);

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
      // Get accounts from BOTH tokens (AmEx + Truist)
      const allAccounts: any[] = [];
      
      // Token 1: Primary (Truist)
      const accountsResult1 = await this.advisorTools.executeTool('get_accounts', {});
      if (!accountsResult1.error && accountsResult1.accounts) {
        allAccounts.push(...accountsResult1.accounts.map((a: any) => ({ ...a, tokenSource: 'primary' })));
      }
      
      // Token 2: AmEx (if available)
      const amexToken = process.env.TELLER_API_TOKEN_AMEX;
      if (amexToken) {
        const amexTools = new AdvisorTools();
        // Temporarily override token
        const originalToken = (amexTools as any).tellerToken;
        (amexTools as any).tellerToken = amexToken;
        
        const accountsResult2 = await amexTools.executeTool('get_accounts', {});
        if (!accountsResult2.error && accountsResult2.accounts) {
          allAccounts.push(...accountsResult2.accounts.map((a: any) => ({ ...a, tokenSource: 'amex' })));
        }
        
        // Restore original token
        (amexTools as any).tellerToken = originalToken;
      }

      const accounts = allAccounts;
      logger.info(`Found ${accounts.length} account(s) to sync across all tokens`);

      let totalSynced = 0;
      let totalNew = 0;
      let totalUpdated = 0;
      const accountStats: any[] = [];

      // Sync transactions for each account
      for (const account of accounts) {
        logger.info(`Syncing account: ${account.name} (${account.id}) [${account.tokenSource}]`);

        try {
          // Use the correct token for this account
          let toolsToUse = this.advisorTools;
          if (account.tokenSource === 'amex') {
            const amexToken = process.env.TELLER_API_TOKEN_AMEX;
            if (amexToken) {
              toolsToUse = new AdvisorTools();
              (toolsToUse as any).tellerToken = amexToken;
            }
          }
          
          // Fetch transactions (up to 500 for the past period)
          const txnResult = await toolsToUse.executeTool('get_transactions', {
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
          let existingTransactions: any[];
          if (this.usePostgres && this.postgresDb) {
            existingTransactions = await this.postgresDb.getTransactionsByAccount(account.id, 1000);
          } else if (this.sqliteDb) {
            existingTransactions = this.sqliteDb.getTransactionsByAccount(account.id, 1000);
          } else {
            existingTransactions = [];
          }
          const existingIds = new Set(existingTransactions.map(t => t.transactionId || t.transaction_id));

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
            if (this.usePostgres && this.postgresDb) {
              await this.postgresDb.saveTransactionsBatch(transactionsToSave);
            } else if (this.sqliteDb) {
              this.sqliteDb.saveTransactionsBatch(transactionsToSave);
            }
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
  async getStatus(): Promise<any> {
    let lastSync: Date | null = null;
    let recentTransactions: any[] = [];

    if (this.usePostgres && this.postgresDb) {
      lastSync = await this.postgresDb.getLastTransactionSync();
      recentTransactions = await this.postgresDb.getRecentTransactions(7);
    } else if (this.sqliteDb) {
      lastSync = this.sqliteDb.getLastTransactionSync();
      recentTransactions = this.sqliteDb.getRecentTransactions(7);
    }

    return {
      enabled: this.config.enabled,
      running: this.scheduledTask !== null,
      syncing: this.isSyncing,
      schedule: this.config.cronExpression,
      timezone: this.config.timezone,
      lastSync: lastSync?.toISOString() || 'Never',
      recentTransactionCount: recentTransactions.length,
      totalTransactions: await this.getTotalTransactionCount()
    };
  }

  /**
   * Get total transaction count from database
   */
  private async getTotalTransactionCount(): Promise<number> {
    try {
      if (this.usePostgres && this.postgresDb) {
        const result = await this.postgresDb.query('SELECT COUNT(*) as count FROM financial_transactions');
        return parseInt(result.rows[0]?.count) || 0;
      } else if (this.sqliteDb) {
        const stmt = (this.sqliteDb as any).prepare('SELECT COUNT(*) as count FROM financial_transactions');
        const result: any = stmt.get();
        return result?.count || 0;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get sync history/stats
   */
  async getSyncStats(days: number = 30): Promise<any> {
    let recentTransactions: any[] = [];
    let categories: string[] = [];
    let spendingSummary: any[] = [];
    let lastSync: Date | null = null;

    const today = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    if (this.usePostgres && this.postgresDb) {
      recentTransactions = await this.postgresDb.getRecentTransactions(days);
      categories = await this.postgresDb.getTransactionCategories();
      spendingSummary = await this.postgresDb.getSpendingSummary(startDateStr, today);
      lastSync = await this.postgresDb.getLastTransactionSync();
    } else if (this.sqliteDb) {
      recentTransactions = this.sqliteDb.getRecentTransactions(days);
      categories = this.sqliteDb.getTransactionCategories();
      spendingSummary = this.sqliteDb.getSpendingSummary(startDateStr, today);
      lastSync = this.sqliteDb.getLastTransactionSync();
    }

    return {
      period: `${days} days`,
      transactionCount: recentTransactions.length,
      uniqueCategories: categories.length,
      spendingByCategory: spendingSummary,
      lastSync: lastSync?.toISOString() || 'Never'
    };
  }

  /**
   * Clean up old transactions
   */
  async cleanupOldTransactions(daysToKeep: number = 365): Promise<number> {
    logger.info(`Cleaning up transactions older than ${daysToKeep} days...`);
    let deleted = 0;

    if (this.usePostgres && this.postgresDb) {
      deleted = await this.postgresDb.deleteOldTransactions(daysToKeep);
    } else if (this.sqliteDb) {
      deleted = this.sqliteDb.deleteOldTransactions(daysToKeep);
    }

    logger.info(`✅ Deleted ${deleted} old transaction(s)`);
    return deleted;
  }
}

