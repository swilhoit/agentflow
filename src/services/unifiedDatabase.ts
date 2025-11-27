import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

/**
 * Unified Database Service
 * Works with both Supabase (cloud) and provides SQLite-compatible interface
 * This allows the same code to work in both local dev and Cloud Run production
 */
export class UnifiedDatabaseService {
  private supabase: SupabaseClient;
  private isSupabase: boolean = true;

  constructor(config: {
    url: string;
    serviceRoleKey: string;
  }) {
    this.supabase = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    logger.info(`Unified database initialized (Supabase): ${config.url}`);
  }

  // ==========================================
  // Agent Config Methods
  // ==========================================

  async getAgentConfig(agentName: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('agent_configs')
      .select('*')
      .eq('agent_name', agentName)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error(`Failed to get agent config for ${agentName}:`, error);
      return null;
    }

    return data;
  }

  async getAllAgentConfigs(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('agent_configs')
      .select('*')
      .order('display_name');

    if (error) {
      logger.error('Failed to get agent configs:', error);
      return [];
    }

    return data || [];
  }

  async upsertAgentConfig(config: {
    agentName: string;
    displayName: string;
    description: string;
    agentType: 'discord-bot' | 'scheduler' | 'service';
    status?: 'active' | 'inactive' | 'error';
    isEnabled?: boolean;
    channelIds?: string;
    config?: string;
  }): Promise<number> {
    const { data, error } = await this.supabase
      .from('agent_configs')
      .upsert({
        agent_name: config.agentName,
        display_name: config.displayName,
        description: config.description,
        agent_type: config.agentType,
        status: config.status || 'active',
        is_enabled: config.isEnabled !== false,
        channel_ids: config.channelIds,
        config: config.config,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'agent_name',
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to upsert agent config:', error);
      return 0;
    }

    return data?.id || 0;
  }

  async updateAgentStatus(agentName: string, status: 'active' | 'inactive' | 'error'): Promise<void> {
    const { error } = await this.supabase
      .from('agent_configs')
      .update({
        status,
        last_active_at: status === 'active' ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('agent_name', agentName);

    if (error) {
      logger.error(`Failed to update agent status for ${agentName}:`, error);
    }
  }

  // ==========================================
  // Recurring Task Methods
  // ==========================================

  async getRecurringTask(taskName: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('recurring_tasks')
      .select('*')
      .eq('task_name', taskName)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error(`Failed to get recurring task ${taskName}:`, error);
      return null;
    }

    return data;
  }

  async getAllRecurringTasks(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('recurring_tasks')
      .select('*')
      .order('agent_name')
      .order('task_name');

    if (error) {
      logger.error('Failed to get recurring tasks:', error);
      return [];
    }

    return data || [];
  }

  async getEnabledRecurringTasks(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('recurring_tasks')
      .select('*')
      .eq('is_enabled', true)
      .order('agent_name')
      .order('task_name');

    if (error) {
      logger.error('Failed to get enabled recurring tasks:', error);
      return [];
    }

    return data || [];
  }

  async upsertRecurringTask(task: {
    taskName: string;
    agentName: string;
    description: string;
    cronSchedule: string;
    timezone?: string;
    isEnabled?: boolean;
    config?: string;
  }): Promise<number> {
    const { data, error } = await this.supabase
      .from('recurring_tasks')
      .upsert({
        task_name: task.taskName,
        agent_name: task.agentName,
        description: task.description,
        cron_schedule: task.cronSchedule,
        timezone: task.timezone || 'America/New_York',
        is_enabled: task.isEnabled !== false,
        config: task.config,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'task_name',
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to upsert recurring task:', error);
      return 0;
    }

    return data?.id || 0;
  }

  async updateTaskLastRun(taskId: number, success: boolean): Promise<void> {
    // First get current stats
    const { data: current } = await this.supabase
      .from('recurring_tasks')
      .select('total_runs, successful_runs, failed_runs')
      .eq('id', taskId)
      .single();

    const totalRuns = (current?.total_runs || 0) + 1;
    const successfulRuns = (current?.successful_runs || 0) + (success ? 1 : 0);
    const failedRuns = (current?.failed_runs || 0) + (success ? 0 : 1);

    const { error } = await this.supabase
      .from('recurring_tasks')
      .update({
        last_run_at: new Date().toISOString(),
        total_runs: totalRuns,
        successful_runs: successfulRuns,
        failed_runs: failedRuns,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (error) {
      logger.error(`Failed to update task last run for ${taskId}:`, error);
    }
  }

  // ==========================================
  // Task Execution Methods
  // ==========================================

  async logTaskExecution(execution: {
    taskId: number;
    taskName: string;
    agentName: string;
    status: 'success' | 'failed' | 'skipped';
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
    result?: string;
    error?: string;
    metadata?: string;
  }): Promise<number> {
    const { data, error } = await this.supabase
      .from('task_executions')
      .insert({
        task_id: execution.taskId,
        task_name: execution.taskName,
        agent_name: execution.agentName,
        status: execution.status,
        started_at: execution.startedAt.toISOString(),
        completed_at: execution.completedAt?.toISOString(),
        duration: execution.duration,
        result: execution.result,
        error: execution.error,
        metadata: execution.metadata,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to log task execution:', error);
      return 0;
    }

    return data?.id || 0;
  }

  async getRecentTaskExecutions(hours: number = 24): Promise<any[]> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    const { data, error } = await this.supabase
      .from('task_executions')
      .select('*')
      .gte('started_at', cutoff.toISOString())
      .order('started_at', { ascending: false });

    if (error) {
      logger.error('Failed to get recent task executions:', error);
      return [];
    }

    return data || [];
  }

  async getFailedTaskExecutions(hours: number = 24): Promise<any[]> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    const { data, error } = await this.supabase
      .from('task_executions')
      .select('*')
      .eq('status', 'failed')
      .gte('started_at', cutoff.toISOString())
      .order('started_at', { ascending: false });

    if (error) {
      logger.error('Failed to get failed task executions:', error);
      return [];
    }

    return data || [];
  }

  // ==========================================
  // Agent Logs Methods
  // ==========================================

  async logAgentActivity(log: {
    agentId: string;
    taskId: string;
    guildId: string;
    channelId: string;
    logType: 'info' | 'warning' | 'error' | 'success' | 'step';
    message: string;
    details?: any;
  }): Promise<number> {
    const { data, error } = await this.supabase
      .from('agent_logs')
      .insert({
        agent_id: log.agentId,
        task_id: log.taskId,
        guild_id: log.guildId,
        channel_id: log.channelId,
        log_type: log.logType,
        message: log.message,
        details: log.details,
        timestamp: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to log agent activity:', error);
      return 0;
    }

    return data?.id || 0;
  }

  // ==========================================
  // Startup Logs Methods
  // ==========================================

  async logStartup(log: {
    eventType: string;
    message: string;
    details?: any;
    stackTrace?: string;
  }): Promise<number> {
    const { data, error } = await this.supabase
      .from('startup_logs')
      .insert({
        event_type: log.eventType,
        message: log.message,
        details: log.details,
        stack_trace: log.stackTrace,
        timestamp: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to log startup event:', error);
      return 0;
    }

    return data?.id || 0;
  }

  async getRecentStartupLogs(limit: number = 50): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('startup_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to get startup logs:', error);
      return [];
    }

    return data || [];
  }

  // ==========================================
  // Market Data Methods (from SupabaseDatabaseService)
  // ==========================================

  async saveMarketData(data: {
    symbol: string;
    name: string;
    price: number;
    changeAmount: number;
    changePercent: number;
    volume?: number;
    marketCap?: number;
    performance30d?: number;
    performance90d?: number;
    performance365d?: number;
    date: string;
  }): Promise<number> {
    const { data: result, error } = await this.supabase
      .from('market_data')
      .upsert({
        symbol: data.symbol,
        name: data.name,
        price: data.price,
        change_amount: data.changeAmount,
        change_percent: data.changePercent,
        volume: data.volume,
        market_cap: data.marketCap,
        performance_30d: data.performance30d,
        performance_90d: data.performance90d,
        performance_365d: data.performance365d,
        date: data.date,
        timestamp: new Date().toISOString(),
      }, {
        onConflict: 'symbol,date',
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to save market data:', error);
      return 0;
    }

    return result?.id || 0;
  }

  async saveMarketNews(news: {
    articleId: number;
    symbol: string;
    headline: string;
    summary: string;
    source: string;
    url: string;
    publishedAt: Date;
    category?: string;
    sentiment?: string;
    isSignificant?: boolean;
  }): Promise<number> {
    try {
      const { data: result, error } = await this.supabase
        .from('market_news')
        .upsert({
          article_id: news.articleId,
          symbol: news.symbol,
          headline: news.headline,
          summary: news.summary,
          source: news.source,
          url: news.url,
          published_at: news.publishedAt.toISOString(),
          category: news.category,
          sentiment: news.sentiment,
          is_significant: news.isSignificant || false,
        }, {
          onConflict: 'article_id',
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') return 0;
        logger.warn(`Failed to save news article ${news.articleId}:`, error);
        return 0;
      }

      return result?.id || 0;
    } catch (error) {
      logger.warn(`Failed to save news article:`, error);
      return 0;
    }
  }

  async saveWeeklyAnalysis(analysis: {
    weekStart: string;
    weekEnd: string;
    analysisType: 'thesis' | 'performance' | 'news';
    title: string;
    summary: string;
    detailedAnalysis: string;
    keyEvents?: string;
    recommendations?: string;
    metadata?: string;
  }): Promise<number> {
    const { data: result, error } = await this.supabase
      .from('weekly_analysis')
      .insert({
        week_start: analysis.weekStart,
        week_end: analysis.weekEnd,
        analysis_type: analysis.analysisType,
        title: analysis.title,
        executive_summary: analysis.summary,
        detailed_analysis: analysis.detailedAnalysis,
        recommendations: analysis.recommendations,
        metadata: analysis.metadata,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to save weekly analysis:', error);
      return 0;
    }

    return result?.id || 0;
  }

  async getMarketDataByDateRange(startDate: string, endDate: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('market_data')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('symbol', { ascending: true });

    if (error) {
      logger.error('Failed to get market data:', error);
      return [];
    }

    return data || [];
  }

  async getMarketNewsByDateRange(startDate: string, endDate: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('market_news')
      .select('*')
      .gte('published_at', `${startDate}T00:00:00`)
      .lte('published_at', `${endDate}T23:59:59`)
      .order('published_at', { ascending: false });

    if (error) {
      logger.error('Failed to get market news:', error);
      return [];
    }

    return data || [];
  }

  async getLatestWeeklyAnalysis(analysisType?: 'thesis' | 'performance' | 'news'): Promise<any | null> {
    let query = this.supabase
      .from('weekly_analysis')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(1);

    if (analysisType) {
      query = query.eq('analysis_type', analysisType);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to get weekly analysis:', error);
      return null;
    }

    return data?.[0] || null;
  }

  // ==========================================
  // Compatibility Methods (for SQLite interface)
  // ==========================================

  getAllActiveAgentTasks(): any[] {
    // Sync stub - use async version in new code
    return [];
  }

  getFailedTasks(hours: number): any[] {
    // Sync stub - use async version in new code
    return [];
  }

  close(): void {
    logger.info('Database connection closed');
  }

  // Get raw Supabase client for custom queries
  getClient(): SupabaseClient {
    return this.supabase;
  }
}

// Singleton instance
let unifiedDbInstance: UnifiedDatabaseService | null = null;

export function getUnifiedDatabase(): UnifiedDatabaseService {
  if (!unifiedDbInstance) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    unifiedDbInstance = new UnifiedDatabaseService({
      url,
      serviceRoleKey,
    });
  }

  return unifiedDbInstance;
}

export function resetUnifiedDatabase(): void {
  if (unifiedDbInstance) {
    unifiedDbInstance.close();
    unifiedDbInstance = null;
  }
}



