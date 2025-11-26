import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

/**
 * Supabase Database Service
 * Replaces Cloud SQL for all bot database operations
 */
export class SupabaseDatabaseService {
  private supabase: SupabaseClient;

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
    logger.info(`Supabase database initialized: ${config.url}`);
  }

  /**
   * Save market data
   */
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
      throw error;
    }

    return result?.id || 0;
  }

  /**
   * Save market news
   */
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
        // Ignore duplicate key errors
        if (error.code === '23505') {
          return 0;
        }
        logger.warn(`Failed to save news article ${news.articleId}:`, error);
        return 0;
      }

      return result?.id || 0;
    } catch (error) {
      logger.warn(`Failed to save news article ${news.articleId}:`, error);
      return 0;
    }
  }

  /**
   * Save weekly analysis
   */
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
        key_events: analysis.keyEvents,
        recommendations: analysis.recommendations,
        metadata: analysis.metadata,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to save weekly analysis:', error);
      throw error;
    }

    return result?.id || 0;
  }

  /**
   * Get market data by date range
   */
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

  /**
   * Get market news by date range
   */
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

  /**
   * Get latest weekly analysis
   */
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

  /**
   * Get all active agent tasks (synchronous stub - returns empty for compatibility)
   */
  getAllActiveAgentTasks(): any[] {
    logger.warn('getAllActiveAgentTasks: Use async getActiveAgentTasksAsync instead');
    return [];
  }

  /**
   * Get all active agent tasks (async version)
   */
  async getActiveAgentTasksAsync(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .select('*')
      .in('status', ['pending', 'running'])
      .order('started_at', { ascending: false });

    if (error) {
      logger.error('Failed to get active agent tasks:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get failed tasks within hours (synchronous stub - returns empty for compatibility)
   */
  getFailedTasks(hours: number): any[] {
    logger.warn('getFailedTasks: Use async getFailedTasksAsync instead');
    return [];
  }

  /**
   * Get failed tasks within hours (async version)
   */
  async getFailedTasksAsync(hours: number): Promise<any[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);

    const { data, error } = await this.supabase
      .from('agent_tasks')
      .select('*')
      .eq('status', 'failed')
      .gte('completed_at', cutoffTime.toISOString())
      .order('completed_at', { ascending: false });

    if (error) {
      logger.error('Failed to get failed tasks:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Close the database connection (no-op for Supabase)
   */
  async close(): Promise<void> {
    logger.info('Supabase connection closed');
  }
}

// Singleton instance
let supabaseDbInstance: SupabaseDatabaseService | null = null;

export function getSupabaseDatabase(): SupabaseDatabaseService {
  if (!supabaseDbInstance) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    supabaseDbInstance = new SupabaseDatabaseService({
      url,
      serviceRoleKey,
    });
  }

  return supabaseDbInstance;
}
