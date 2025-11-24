import { logger } from '../utils/logger';
import * as https from 'https';
import * as fs from 'fs';
import { getSQLiteDatabase } from '../services/databaseFactory';
import type { DatabaseService } from '../services/database';

/**
 * Financial Advisor Tools
 *
 * Uses Teller API for real bank account data and personal finance management
 * Now with database caching for faster responses and offline access
 */
export class AdvisorTools {
  private tellerToken: string;
  private tellerTokenAmex: string;
  private certPath: string;
  private keyPath: string;
  private httpsAgent: https.Agent;
  private db: DatabaseService;
  private useCache: boolean;

  constructor(useCache: boolean = true) {
    this.tellerToken = process.env.TELLER_API_TOKEN || '';
    this.tellerTokenAmex = process.env.TELLER_API_TOKEN_AMEX || '';
    this.certPath = process.env.TELLER_CERT_PATH || '';
    this.keyPath = process.env.TELLER_KEY_PATH || '';
    this.useCache = useCache;
    this.db = getSQLiteDatabase();

    if (!this.tellerToken) {
      logger.warn('TELLER_API_TOKEN not configured - Financial Advisor will have limited functionality');
    }

    // Create HTTPS agent with certificate authentication
    if (this.certPath && this.keyPath && fs.existsSync(this.certPath) && fs.existsSync(this.keyPath)) {
      this.httpsAgent = new https.Agent({
        cert: fs.readFileSync(this.certPath),
        key: fs.readFileSync(this.keyPath)
      });
      logger.info('✅ Teller API certificates loaded');
    } else {
      this.httpsAgent = new https.Agent({});
      logger.warn('⚠️  Teller certificates not found - using basic auth only');
    }
  }

  /**
   * Get all available tool definitions for Claude
   */
  getToolDefinitions(): any[] {
    return [
      // ===== CACHED DATABASE TOOLS (FAST - USE THESE FIRST!) =====
      {
        name: 'get_cached_transactions',
        description: '⚡ FAST - Get recent transactions from local database. Use this for ANY transaction query - spending analysis, reviewing purchases, etc. Database is synced daily.',
        input_schema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: 'Number of days to retrieve (default: 30, supports up to 365)'
            }
          },
          required: []
        }
      },
      {
        name: 'get_spending_by_category',
        description: '⚡ FAST - Get spending breakdown by category from database. Perfect for "how much did I spend on X" questions.',
        input_schema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: 'Number of days to analyze (default: 30)'
            }
          },
          required: []
        }
      },
      {
        name: 'search_transactions',
        description: '⚡ FAST - Search transactions by merchant name or description in cached database. Use this to find specific purchases.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search term (merchant name or description)'
            },
            days: {
              type: 'number',
              description: 'Number of days to search (default: 90)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_transaction_history',
        description: '⚡ FAST - Get full transaction history from database with all details. Use for comprehensive spending reviews.',
        input_schema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: 'Number of days of history (default: 90, supports up to 365)'
            }
          },
          required: []
        }
      },
      
      // ===== UTILITY TOOLS =====
      {
        name: 'savings_goal',
        description: 'Calculate how to reach a savings goal. Provides timeline and monthly savings needed.',
        input_schema: {
          type: 'object',
          properties: {
            goal_amount: {
              type: 'number',
              description: 'Target amount to save'
            },
            months: {
              type: 'number',
              description: 'Number of months to reach goal'
            }
          },
          required: ['goal_amount', 'months']
        }
      },
      {
        name: 'budget_check',
        description: 'Check spending against a budget. Helps track if spending is on target.',
        input_schema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Spending category (e.g., "dining", "groceries", "entertainment")'
            },
            budget_amount: {
              type: 'number',
              description: 'Monthly budget amount in dollars'
            }
          },
          required: ['category', 'budget_amount']
        }
      }

      // ===== DISABLED: REAL-TIME API TOOLS =====
      // Removed because some accounts have MFA issues and cached data is always up-to-date
      // Database is synced daily at 2 AM with latest transactions
    ];
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName: string, input: Record<string, any>): Promise<any> {
    try {
      switch (toolName) {
        case 'get_accounts':
          return await this.getAccounts();

        case 'get_account_details':
          return await this.getAccountDetails(input.account_id);

        case 'get_transactions':
          return await this.getTransactions(input.account_id, input.count || 30);

        case 'analyze_spending':
          return await this.analyzeSpending(input.account_id, input.days || 30);

        case 'get_balance_summary':
          return await this.getBalanceSummary();

        case 'budget_check':
          return await this.budgetCheck(input.category, input.budget_amount);

        case 'savings_goal':
          return await this.savingsGoal(input.goal_amount, input.months);

        // Database-cached transaction tools (FAST!)
        case 'get_cached_transactions':
          return this.getCachedTransactions('', input.days || 30);

        case 'search_transactions':
          return this.searchTransactions(input.query, input.days || 90);

        case 'get_spending_by_category':
          return this.getCachedSpendingAnalysis(input.days || 30);

        case 'get_transaction_history':
          return this.getTransactionHistory(input.days || 90);

        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      logger.error(`Error executing tool ${toolName}:`, error);
      return { error: String(error) };
    }
  }

  /**
   * Get all connected accounts
   */
  private async getAccounts(): Promise<any> {
    try {
      const response = await this.tellerRequest('/accounts');

      if (response.error) {
        return response;
      }

      const accounts = response as any[];

      return {
        accounts: accounts.map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype,
          balance: acc.balance,
          currency: acc.currency,
          institution: acc.institution?.name,
          last_four: acc.last_four,
          status: acc.status
        })),
        total_accounts: accounts.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error fetching accounts:', error);
      return { error: 'Failed to fetch accounts' };
    }
  }

  /**
   * Get account details
   */
  private async getAccountDetails(accountId: string): Promise<any> {
    try {
      const response = await this.tellerRequest(`/accounts/${accountId}`);
      return response;
    } catch (error) {
      logger.error(`Error fetching account ${accountId}:`, error);
      return { error: 'Failed to fetch account details' };
    }
  }

  /**
   * Get transactions for an account
   */
  private async getTransactions(accountId: string, count: number = 30): Promise<any> {
    try {
      const response = await this.tellerRequest(`/accounts/${accountId}/transactions?count=${count}`);

      if (response.error) {
        return response;
      }

      const transactions = response as any[];

      return {
        account_id: accountId,
        transactions: transactions.map((txn: any) => ({
          id: txn.id,
          date: txn.date,
          description: txn.description,
          amount: txn.amount,
          type: txn.type,
          category: txn.category,
          merchant: txn.details?.counterparty?.name
        })),
        count: transactions.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error fetching transactions for ${accountId}:`, error);
      return { error: 'Failed to fetch transactions' };
    }
  }

  /**
   * Analyze spending patterns
   */
  private async analyzeSpending(accountId: string, days: number = 30): Promise<any> {
    try {
      const txnResponse = await this.getTransactions(accountId, 100);

      if (txnResponse.error) {
        return txnResponse;
      }

      const transactions = txnResponse.transactions;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Filter recent transactions
      const recentTxns = transactions.filter((txn: any) =>
        new Date(txn.date) >= cutoffDate && parseFloat(txn.amount) < 0
      );

      // Group by category
      const byCategory: Record<string, number> = {};
      let totalSpent = 0;

      recentTxns.forEach((txn: any) => {
        const amount = Math.abs(parseFloat(txn.amount));
        const category = txn.category || 'uncategorized';

        byCategory[category] = (byCategory[category] || 0) + amount;
        totalSpent += amount;
      });

      // Sort categories by amount
      const sortedCategories = Object.entries(byCategory)
        .sort(([, a], [, b]) => b - a)
        .map(([category, amount]) => ({
          category,
          amount: amount.toFixed(2),
          percentage: ((amount / totalSpent) * 100).toFixed(1)
        }));

      return {
        period_days: days,
        total_spent: totalSpent.toFixed(2),
        transaction_count: recentTxns.length,
        categories: sortedCategories,
        daily_average: (totalSpent / days).toFixed(2),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error analyzing spending:', error);
      return { error: 'Failed to analyze spending' };
    }
  }

  /**
   * Get balance summary across all accounts
   */
  private async getBalanceSummary(): Promise<any> {
    try {
      const accountsResponse = await this.getAccounts();

      if (accountsResponse.error) {
        return accountsResponse;
      }

      const accounts = accountsResponse.accounts;
      let totalAssets = 0;
      let totalLiabilities = 0;

      accounts.forEach((acc: any) => {
        const balance = parseFloat(acc.balance);

        // Credit cards and loans are liabilities (negative balances)
        if (acc.type === 'credit' || balance < 0) {
          totalLiabilities += Math.abs(balance);
        } else {
          totalAssets += balance;
        }
      });

      const netWorth = totalAssets - totalLiabilities;

      return {
        total_assets: totalAssets.toFixed(2),
        total_liabilities: totalLiabilities.toFixed(2),
        net_worth: netWorth.toFixed(2),
        accounts_breakdown: accounts.map((acc: any) => ({
          name: acc.name,
          type: acc.type,
          balance: acc.balance
        })),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting balance summary:', error);
      return { error: 'Failed to get balance summary' };
    }
  }

  /**
   * Check spending against budget (using cached data only)
   */
  private async budgetCheck(category: string, budgetAmount: number): Promise<any> {
    try {
      // Use cached spending analysis instead of API
      const analysis = this.getCachedSpendingAnalysis(30);

      if (analysis.error) return analysis;

      // Find the category in spending data
      const categoryNormalized = category.toLowerCase();
      let totalSpent = 0;

      if (analysis.categories) {
        const categoryData = analysis.categories.find((c: any) =>
          c.category.toLowerCase().includes(categoryNormalized)
        );

        if (categoryData) {
          totalSpent = parseFloat(categoryData.amount);
        }
      }

      const remaining = budgetAmount - totalSpent;
      const percentUsed = (totalSpent / budgetAmount) * 100;

      return {
        category,
        budget: budgetAmount.toFixed(2),
        spent: totalSpent.toFixed(2),
        remaining: remaining.toFixed(2),
        percent_used: percentUsed.toFixed(1),
        status: percentUsed > 100 ? 'over_budget' : percentUsed > 80 ? 'warning' : 'on_track',
        source: 'database_cache',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error checking budget:', error);
      return { error: 'Failed to check budget' };
    }
  }

  /**
   * Calculate savings goal (using cached data only)
   */
  private async savingsGoal(goalAmount: number, months: number): Promise<any> {
    try {
      const monthlyRequired = goalAmount / months;

      // Simplified calculation without API call
      // User can provide current savings if needed
      return {
        goal_amount: goalAmount.toFixed(2),
        months,
        monthly_savings_needed: monthlyRequired.toFixed(2),
        target_date: new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        weekly_savings: (monthlyRequired / 4).toFixed(2),
        daily_savings: (monthlyRequired / 30).toFixed(2),
        per_paycheck: (monthlyRequired / 2).toFixed(2), // Assuming bi-weekly pay
        source: 'calculation',
        timestamp: new Date().toISOString(),
        note: 'Based on goal amount and timeline. Add your current savings to see how much additional saving is needed.'
      };
    } catch (error) {
      logger.error('Error calculating savings goal:', error);
      return { error: 'Failed to calculate savings goal' };
    }
  }

  /**
   * Make authenticated request to Teller API
   */
  private async tellerRequest(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.teller.io',
        port: 443,
        path,
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(this.tellerToken + ':').toString('base64')}`,
          'Content-Type': 'application/json'
        },
        agent: this.httpsAgent
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              logger.error(`Teller API error: ${res.statusCode} ${data}`);
              resolve({ error: `API error: ${res.statusCode}` });
            }
          } catch (error) {
            resolve({ error: 'Failed to parse response' });
          }
        });
      });

      req.on('error', (error) => {
        logger.error('Teller request error:', error);
        reject(error);
      });

      req.end();
    });
  }

  /**
   * Get cached transactions from database (faster than API)
   */
  getCachedTransactions(accountId: string, days: number = 30): any {
    try {
      const transactions = this.db.getRecentTransactions(days, 100)
        .filter(t => !accountId || t.accountId === accountId);

      return {
        account_id: accountId,
        source: 'database_cache',
        transactions: transactions.map(txn => ({
          id: txn.transactionId,
          date: txn.date,
          description: txn.description,
          amount: txn.amount.toString(),
          type: txn.type,
          category: txn.category,
          merchant: txn.merchant
        })),
        count: transactions.length,
        timestamp: new Date().toISOString(),
        last_sync: this.db.getLastTransactionSync()?.toISOString() || 'Never'
      };
    } catch (error) {
      logger.error('Error getting cached transactions:', error);
      return { error: 'Failed to get cached transactions' };
    }
  }

  /**
   * Get spending analysis from cached data (much faster)
   */
  getCachedSpendingAnalysis(days: number = 30): any {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];

      const spendingSummary = this.db.getSpendingSummary(startDateStr, today);
      const transactions = this.db.getTransactionsByDateRange(startDateStr, today);

      // Calculate total spent
      const totalSpent = transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      return {
        source: 'database_cache',
        period_days: days,
        total_spent: totalSpent.toFixed(2),
        transaction_count: transactions.filter(t => t.amount < 0).length,
        categories: spendingSummary.map(cat => ({
          category: cat.category || 'uncategorized',
          amount: cat.total_spent.toFixed(2),
          percentage: ((cat.total_spent / totalSpent) * 100).toFixed(1),
          transaction_count: cat.transaction_count
        })),
        daily_average: (totalSpent / days).toFixed(2),
        timestamp: new Date().toISOString(),
        last_sync: this.db.getLastTransactionSync()?.toISOString() || 'Never'
      };
    } catch (error) {
      logger.error('Error getting cached spending analysis:', error);
      return { error: 'Failed to analyze cached spending' };
    }
  }

  /**
   * Get transaction history from database
   */
  getTransactionHistory(days: number = 90, accountId?: string): any {
    try {
      const transactions = accountId
        ? this.db.getTransactionsByAccount(accountId, 500)
        : this.db.getRecentTransactions(days, 500);

      const categories = this.db.getTransactionCategories();

      return {
        source: 'database_cache',
        period_days: days,
        total_transactions: transactions.length,
        unique_categories: categories.length,
        transactions: transactions.slice(0, 100).map(txn => ({
          id: txn.transactionId,
          account: txn.accountName,
          date: txn.date,
          description: txn.description,
          amount: txn.amount,
          type: txn.type,
          category: txn.category,
          merchant: txn.merchant
        })),
        last_sync: this.db.getLastTransactionSync()?.toISOString() || 'Never'
      };
    } catch (error) {
      logger.error('Error getting transaction history:', error);
      return { error: 'Failed to get transaction history' };
    }
  }

  /**
   * Search transactions by merchant or description
   */
  searchTransactions(query: string, days: number = 90): any {
    try {
      const allTransactions = this.db.getRecentTransactions(days, 1000);
      const searchTerm = query.toLowerCase();

      const matches = allTransactions.filter(txn => 
        txn.description.toLowerCase().includes(searchTerm) ||
        (txn.merchant && txn.merchant.toLowerCase().includes(searchTerm))
      );

      return {
        source: 'database_cache',
        query,
        matches: matches.length,
        transactions: matches.slice(0, 50).map(txn => ({
          date: txn.date,
          description: txn.description,
          merchant: txn.merchant,
          amount: txn.amount,
          category: txn.category,
          account: txn.accountName
        }))
      };
    } catch (error) {
      logger.error('Error searching transactions:', error);
      return { error: 'Failed to search transactions' };
    }
  }

  /**
   * Get database sync status
   */
  getSyncStatus(): any {
    try {
      const lastSync = this.db.getLastTransactionSync();
      const recentCount = this.db.getRecentTransactions(30).length;
      const categories = this.db.getTransactionCategories();

      return {
        last_sync: lastSync?.toISOString() || 'Never',
        transactions_last_30_days: recentCount,
        unique_categories: categories.length,
        cache_enabled: this.useCache
      };
    } catch (error) {
      return { error: 'Failed to get sync status' };
    }
  }
}
