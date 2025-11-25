/**
 * Multi-Tenant Database Service
 * 
 * Wraps all database operations with tenant context.
 * Uses Supabase with Row Level Security for data isolation.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getTenantResolver, TenantInfo } from './tenantResolver';
import { logger } from '../utils/logger';

// Re-export types from original database for compatibility
export interface ConversationMessage {
  id?: number;
  userId: string;
  guildId: string;
  channelId: string;
  username: string;
  message: string;
  messageType: 'voice' | 'text' | 'agent_response';
  timestamp: Date;
  metadata?: string;
}

export interface AgentTask {
  id?: number;
  userId: string;
  taskId: string;
  guildId?: string;
  channelId?: string;
  taskDescription: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority?: string;
  startedAt: Date;
  completedAt?: Date;
  result?: string;
  error?: string;
  iterations?: number;
  toolCalls?: number;
  tokensUsed?: number;
}

export interface FinancialTransaction {
  id?: number;
  userId: string;
  transactionId: string;
  accountId: string;
  accountName?: string;
  accountType?: string;
  institution?: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category?: string;
  merchant?: string;
  details?: string;
  syncedAt?: Date;
}

export interface DailyGoal {
  id?: number;
  userId: string;
  date: string;
  goals: string;
  status?: string;
  metadata?: string;
  createdAt?: Date;
}

export interface MarketData {
  id?: number;
  symbol: string;
  name: string;
  price: number;
  changeAmount: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  date: string;
  timestamp?: Date;
}

/**
 * Tenant-scoped database operations
 */
export class TenantDatabase {
  private supabase: SupabaseClient;
  private tenant: TenantInfo;

  constructor(tenant: TenantInfo) {
    this.tenant = tenant;
    this.supabase = getTenantResolver().getSupabaseClient();
  }

  /**
   * Get the user ID for this tenant (all queries are scoped to this)
   */
  get userId(): string {
    return this.tenant.userId;
  }

  // ============================================
  // CONVERSATIONS
  // ============================================

  async saveMessage(message: Omit<ConversationMessage, 'userId'>): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('conversations')
      .insert({
        user_id: this.userId,
        guild_id: message.guildId,
        channel_id: message.channelId,
        username: message.username,
        message: message.message,
        message_type: message.messageType,
        timestamp: message.timestamp.toISOString(),
        metadata: message.metadata,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('[TenantDB] Failed to save message:', error);
      return null;
    }

    return data?.id;
  }

  async getConversationHistory(
    channelId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ConversationMessage[]> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('user_id', this.userId)
      .eq('channel_id', channelId)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('[TenantDB] Failed to get conversation history:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      username: row.username,
      message: row.message,
      messageType: row.message_type,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata,
    }));
  }

  async getConversationContext(channelId: string, messageCount: number = 20): Promise<string> {
    const messages = await this.getConversationHistory(channelId, messageCount);
    messages.reverse();

    return messages
      .map(msg => {
        const time = msg.timestamp.toLocaleTimeString();
        return `[${time}] ${msg.username}: ${msg.message}`;
      })
      .join('\n');
  }

  // ============================================
  // AGENT TASKS
  // ============================================

  async createAgentTask(task: Omit<AgentTask, 'userId' | 'id'>): Promise<string | null> {
    // Check usage limits
    if (this.tenant.features.maxAgentTasks !== -1) {
      const { count } = await this.supabase
        .from('agent_tasks')
        .select('id', { count: 'exact' })
        .eq('user_id', this.userId)
        .gte('started_at', this.getStartOfMonth());

      if ((count || 0) >= this.tenant.features.maxAgentTasks) {
        logger.warn(`[TenantDB] User ${this.userId} has reached agent task limit`);
        return null;
      }
    }

    const { data, error } = await this.supabase
      .from('agent_tasks')
      .insert({
        user_id: this.userId,
        task_id: task.taskId,
        guild_id: task.guildId,
        channel_id: task.channelId,
        description: task.taskDescription,
        status: task.status,
        priority: task.priority || 'normal',
        started_at: task.startedAt.toISOString(),
      })
      .select('task_id')
      .single();

    if (error) {
      logger.error('[TenantDB] Failed to create agent task:', error);
      return null;
    }

    // Track usage
    await getTenantResolver().trackUsage(this.userId, 'agent_execution', 1, {
      taskId: task.taskId,
    });

    return data?.task_id;
  }

  async updateAgentTask(taskId: string, updates: Partial<AgentTask>): Promise<boolean> {
    const updateData: Record<string, any> = {};

    if (updates.status) updateData.status = updates.status;
    if (updates.completedAt) updateData.completed_at = updates.completedAt.toISOString();
    if (updates.result !== undefined) updateData.result = updates.result;
    if (updates.error !== undefined) updateData.error = updates.error;
    if (updates.iterations !== undefined) updateData.iterations = updates.iterations;
    if (updates.toolCalls !== undefined) updateData.tool_calls = updates.toolCalls;
    if (updates.tokensUsed !== undefined) updateData.tokens_used = updates.tokensUsed;

    const { error } = await this.supabase
      .from('agent_tasks')
      .update(updateData)
      .eq('user_id', this.userId)
      .eq('task_id', taskId);

    if (error) {
      logger.error('[TenantDB] Failed to update agent task:', error);
      return false;
    }

    // Track token usage if provided
    if (updates.tokensUsed) {
      await getTenantResolver().trackUsage(this.userId, 'claude_tokens', updates.tokensUsed, {
        taskId,
      });
    }

    return true;
  }

  async getAgentTask(taskId: string): Promise<AgentTask | null> {
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .select('*')
      .eq('user_id', this.userId)
      .eq('task_id', taskId)
      .single();

    if (error || !data) return null;

    return this.mapAgentTask(data);
  }

  async getActiveAgentTasks(): Promise<AgentTask[]> {
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .select('*')
      .eq('user_id', this.userId)
      .in('status', ['pending', 'running'])
      .order('started_at', { ascending: false });

    if (error) {
      logger.error('[TenantDB] Failed to get active tasks:', error);
      return [];
    }

    return (data || []).map(this.mapAgentTask);
  }

  async getRecentAgentTasks(limit: number = 20): Promise<AgentTask[]> {
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .select('*')
      .eq('user_id', this.userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[TenantDB] Failed to get recent tasks:', error);
      return [];
    }

    return (data || []).map(this.mapAgentTask);
  }

  private mapAgentTask(row: any): AgentTask {
    return {
      id: row.id,
      userId: row.user_id,
      taskId: row.task_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      taskDescription: row.description,
      status: row.status,
      priority: row.priority,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      result: row.result,
      error: row.error,
      iterations: row.iterations,
      toolCalls: row.tool_calls,
      tokensUsed: row.tokens_used,
    };
  }

  // ============================================
  // FINANCIAL TRANSACTIONS
  // ============================================

  async saveTransaction(transaction: Omit<FinancialTransaction, 'userId'>): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('financial_transactions')
      .upsert({
        user_id: this.userId,
        transaction_id: transaction.transactionId,
        account_id: transaction.accountId,
        account_name: transaction.accountName,
        account_type: transaction.accountType,
        institution: transaction.institution,
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type,
        category: transaction.category,
        merchant: transaction.merchant,
        details: transaction.details,
        synced_at: (transaction.syncedAt || new Date()).toISOString(),
      }, {
        onConflict: 'user_id,transaction_id',
      })
      .select('id')
      .single();

    if (error) {
      logger.error('[TenantDB] Failed to save transaction:', error);
      return null;
    }

    return data?.id;
  }

  async saveTransactionsBatch(transactions: Omit<FinancialTransaction, 'userId'>[]): Promise<number> {
    const rows = transactions.map(tx => ({
      user_id: this.userId,
      transaction_id: tx.transactionId,
      account_id: tx.accountId,
      account_name: tx.accountName,
      account_type: tx.accountType,
      institution: tx.institution,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      merchant: tx.merchant,
      details: tx.details,
      synced_at: (tx.syncedAt || new Date()).toISOString(),
    }));

    const { error } = await this.supabase
      .from('financial_transactions')
      .upsert(rows, { onConflict: 'user_id,transaction_id' });

    if (error) {
      logger.error('[TenantDB] Failed to save transactions batch:', error);
      return 0;
    }

    return transactions.length;
  }

  async getTransactionsByDateRange(
    startDate: string,
    endDate: string,
    accountId?: string
  ): Promise<FinancialTransaction[]> {
    let query = this.supabase
      .from('financial_transactions')
      .select('*')
      .eq('user_id', this.userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('[TenantDB] Failed to get transactions:', error);
      return [];
    }

    return (data || []).map(this.mapTransaction);
  }

  async getRecentTransactions(days: number = 30, limit: number = 100): Promise<FinancialTransaction[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const startDate = cutoffDate.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('financial_transactions')
      .select('*')
      .eq('user_id', this.userId)
      .gte('date', startDate)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[TenantDB] Failed to get recent transactions:', error);
      return [];
    }

    return (data || []).map(this.mapTransaction);
  }

  async getSpendingSummary(startDate: string, endDate: string): Promise<any[]> {
    const { data, error } = await this.supabase.rpc('get_spending_summary', {
      p_user_id: this.userId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      logger.error('[TenantDB] Failed to get spending summary:', error);
      return [];
    }

    return data || [];
  }

  private mapTransaction(row: any): FinancialTransaction {
    return {
      id: row.id,
      userId: row.user_id,
      transactionId: row.transaction_id,
      accountId: row.account_id,
      accountName: row.account_name,
      accountType: row.account_type,
      institution: row.institution,
      date: row.date,
      description: row.description,
      amount: row.amount,
      type: row.type,
      category: row.category,
      merchant: row.merchant,
      details: row.details,
      syncedAt: row.synced_at ? new Date(row.synced_at) : undefined,
    };
  }

  // ============================================
  // DAILY GOALS
  // ============================================

  async saveDailyGoal(goal: Omit<DailyGoal, 'userId'>): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('daily_goals')
      .upsert({
        user_id: this.userId,
        date: goal.date,
        goals: goal.goals,
        status: goal.status || 'active',
        metadata: goal.metadata,
      }, {
        onConflict: 'user_id,date',
      })
      .select('id')
      .single();

    if (error) {
      logger.error('[TenantDB] Failed to save daily goal:', error);
      return null;
    }

    return data?.id;
  }

  async getDailyGoal(date: string): Promise<DailyGoal | null> {
    const { data, error } = await this.supabase
      .from('daily_goals')
      .select('*')
      .eq('user_id', this.userId)
      .eq('date', date)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      date: data.date,
      goals: data.goals,
      status: data.status,
      metadata: data.metadata,
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
    };
  }

  async getGoalsHistory(limit: number = 30): Promise<DailyGoal[]> {
    const { data, error } = await this.supabase
      .from('daily_goals')
      .select('*')
      .eq('user_id', this.userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[TenantDB] Failed to get goals history:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      date: row.date,
      goals: row.goals,
      status: row.status,
      metadata: row.metadata,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
    }));
  }

  // ============================================
  // MARKET DATA (Shared, but watchlist is per-user)
  // ============================================

  async getWatchlist(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('user_watchlists')
      .select('symbol')
      .eq('user_id', this.userId)
      .order('added_at', { ascending: true });

    if (error) {
      logger.error('[TenantDB] Failed to get watchlist:', error);
      return [];
    }

    return (data || []).map(row => row.symbol);
  }

  async addToWatchlist(symbol: string, notes?: string): Promise<boolean> {
    // Check limit
    if (this.tenant.features.maxWatchlistSymbols !== -1) {
      const watchlist = await this.getWatchlist();
      if (watchlist.length >= this.tenant.features.maxWatchlistSymbols) {
        logger.warn(`[TenantDB] User ${this.userId} has reached watchlist limit`);
        return false;
      }
    }

    const { error } = await this.supabase
      .from('user_watchlists')
      .upsert({
        user_id: this.userId,
        symbol: symbol.toUpperCase(),
        notes,
        added_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,symbol',
      });

    if (error) {
      logger.error('[TenantDB] Failed to add to watchlist:', error);
      return false;
    }

    return true;
  }

  async removeFromWatchlist(symbol: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('user_watchlists')
      .delete()
      .eq('user_id', this.userId)
      .eq('symbol', symbol.toUpperCase());

    if (error) {
      logger.error('[TenantDB] Failed to remove from watchlist:', error);
      return false;
    }

    return true;
  }

  async getMarketDataForWatchlist(days: number = 30): Promise<MarketData[]> {
    const watchlist = await this.getWatchlist();
    if (watchlist.length === 0) return [];

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const startDate = cutoffDate.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('market_data')
      .select('*')
      .in('symbol', watchlist)
      .gte('date', startDate)
      .order('date', { ascending: false });

    if (error) {
      logger.error('[TenantDB] Failed to get market data:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      price: row.price,
      changeAmount: row.change_amount,
      changePercent: row.change_percent,
      volume: row.volume,
      marketCap: row.market_cap,
      date: row.date,
      timestamp: row.timestamp ? new Date(row.timestamp) : undefined,
    }));
  }

  // ============================================
  // STATISTICS
  // ============================================

  async getStatistics(): Promise<{
    totalMessages: number;
    totalAgentTasks: number;
    activeAgentTasks: number;
    completedAgentTasks: number;
    failedAgentTasks: number;
    monthlyAgentUsage: number;
  }> {
    const [
      { count: totalMessages },
      { count: totalTasks },
      { count: activeTasks },
      { count: completedTasks },
      { count: failedTasks },
      { count: monthlyUsage },
    ] = await Promise.all([
      this.supabase.from('conversations').select('id', { count: 'exact' }).eq('user_id', this.userId),
      this.supabase.from('agent_tasks').select('id', { count: 'exact' }).eq('user_id', this.userId),
      this.supabase.from('agent_tasks').select('id', { count: 'exact' }).eq('user_id', this.userId).in('status', ['pending', 'running']),
      this.supabase.from('agent_tasks').select('id', { count: 'exact' }).eq('user_id', this.userId).eq('status', 'completed'),
      this.supabase.from('agent_tasks').select('id', { count: 'exact' }).eq('user_id', this.userId).eq('status', 'failed'),
      this.supabase.from('agent_tasks').select('id', { count: 'exact' }).eq('user_id', this.userId).gte('started_at', this.getStartOfMonth()),
    ]);

    return {
      totalMessages: totalMessages || 0,
      totalAgentTasks: totalTasks || 0,
      activeAgentTasks: activeTasks || 0,
      completedAgentTasks: completedTasks || 0,
      failedAgentTasks: failedTasks || 0,
      monthlyAgentUsage: monthlyUsage || 0,
    };
  }

  private getStartOfMonth(): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
}

/**
 * Factory function to get a tenant-scoped database
 */
export async function getTenantDatabase(guildId: string): Promise<TenantDatabase | null> {
  const tenant = await getTenantResolver().resolveTenant(guildId);
  
  if (!tenant) {
    logger.warn(`[MultiTenantDB] No tenant found for guild ${guildId}`);
    return null;
  }

  if (!tenant.isActive) {
    logger.warn(`[MultiTenantDB] Tenant for guild ${guildId} is inactive`);
    return null;
  }

  return new TenantDatabase(tenant);
}

