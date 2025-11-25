import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration - personal-finance project
// These are public keys (safe to commit) - service role key should be in env
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ymxhsdtagnalxebnskst.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteGhzZHRhZ25hbHhlYm5za3N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzQyOTUsImV4cCI6MjA3MDQ1MDI5NX0.eO8Tq7P-y-WWoMDBxWz7DvVFR2mmPm3_WIx04RABkTE';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// For server-side API routes, use service role key if available
let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    // Use service role key for server-side operations if available
    const key = typeof window === 'undefined' && supabaseServiceKey 
      ? supabaseServiceKey 
      : SUPABASE_ANON_KEY;
    
    supabaseInstance = createClient(SUPABASE_URL, key);
  }
  return supabaseInstance;
}

// Database types matching Supabase schema
export interface FinancialTransaction {
  id?: string;
  user_id: string;
  account_id: string;
  transaction_id: string;
  name?: string;
  merchant_name?: string;
  amount: number;
  iso_currency_code?: string;
  category?: string;
  date: string;
  pending?: boolean;
  created_at?: string;
  source?: 'plaid' | 'teller' | 'manual';
  teller_account_id?: string;
  teller_transaction_id?: string;
}

export interface DailyGoal {
  id?: string;
  user_id: string;
  date: string;
  goals: string;
  status?: string;
  metadata?: any;
  created_at?: string;
}

export interface AgentTask {
  id?: string;
  user_id: string;
  task_id: string;
  guild_id?: string;
  channel_id?: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority?: string;
  started_at: string;
  completed_at?: string;
  result?: any;
  error?: string;
  iterations?: number;
  tool_calls?: number;
  tokens_used?: number;
}

export interface MarketData {
  id?: number;
  symbol: string;
  name: string;
  price: number;
  change_amount?: number;
  change_percent?: number;
  volume?: number;
  market_cap?: number;
  performance_30d?: number;
  performance_90d?: number;
  performance_365d?: number;
  date: string;
  timestamp?: string;
}

export interface WeeklyAnalysis {
  id?: number;
  user_id?: string;
  week_start: string;
  week_end: string;
  analysis_type: 'thesis' | 'performance' | 'news' | 'portfolio';
  title: string;
  executive_summary: string;
  detailed_analysis: any;
  top_performers?: any;
  worst_performers?: any;
  recommendations?: any;
  key_metrics?: any;
  metadata?: any;
  created_at?: string;
}

export interface MarketNews {
  id?: number;
  article_id: number;
  symbol: string;
  headline: string;
  summary?: string;
  source: string;
  url: string;
  image_url?: string;
  published_at: string;
  category?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  is_significant?: boolean;
  created_at?: string;
}

export interface Loan {
  id?: string;
  user_id: string;
  name: string;
  original_amount: number;
  current_balance: number;
  interest_rate: number;
  monthly_payment: number;
  start_date: string;
  payoff_date?: string;
  loan_type: 'personal' | 'student' | 'auto' | 'mortgage' | 'credit' | 'other';
  status: 'active' | 'paid_off' | 'deferred';
  created_at?: string;
  updated_at?: string;
}

export interface UserHolding {
  id?: string;
  user_id: string;
  symbol: string;
  shares: number;
  cost_basis?: number;
  purchase_date?: string;
  account_name?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Query helper functions using Supabase
export const db_queries = {
  // Financial queries
  getRecentTransactions: async (userId: string, limit: number = 50) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  getTransactionsByDateRange: async (userId: string, startDate: string, endDate: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  getSpendingSummary: async (userId: string, startDate: string, endDate: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .lt('amount', 0);

    if (error) throw error;

    // Group by category
    const grouped = (data || []).reduce((acc: any, tx: any) => {
      const cat = tx.category || 'Uncategorized';
      if (!acc[cat]) {
        acc[cat] = { category: cat, transaction_count: 0, total_spent: 0 };
      }
      acc[cat].transaction_count++;
      acc[cat].total_spent += Math.abs(tx.amount);
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => b.total_spent - a.total_spent);
  },

  getIncomeSummary: async (userId: string, startDate: string, endDate: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .gt('amount', 0);

    if (error) throw error;

    const transactions = data || [];
    const total = transactions.reduce((sum: number, tx: any) => sum + tx.amount, 0);
    return {
      total_income: total,
      transaction_count: transactions.length,
      avg_amount: transactions.length > 0 ? total / transactions.length : 0
    };
  },

  // Goals queries
  getDailyGoals: async (userId: string, limit: number = 30) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('financial_goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // Agent queries
  getActiveAgentTasks: async (userId?: string) => {
    const supabase = getSupabase();
    let query = supabase
      .from('agent_tasks')
      .select('*')
      .in('status', ['pending', 'running'])
      .order('started_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  getRecentAgentTasks: async (limit: number = 10, userId?: string) => {
    const supabase = getSupabase();
    let query = supabase
      .from('agent_tasks')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Market queries
  getLatestMarketData: async () => {
    const supabase = getSupabase();
    
    // First get the latest date
    const { data: dateData, error: dateError } = await supabase
      .from('market_data')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    if (dateError) throw dateError;
    if (!dateData || dateData.length === 0) return [];

    const latestDate = dateData[0].date;

    const { data, error } = await supabase
      .from('market_data')
      .select('*')
      .eq('date', latestDate)
      .order('symbol');

    if (error) throw error;
    return data || [];
  },

  getMarketDataBySymbol: async (symbol: string, days: number = 30) => {
    const supabase = getSupabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const startDate = cutoffDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('market_data')
      .select('*')
      .eq('symbol', symbol)
      .gte('date', startDate)
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  getMarketDataBySymbols: async (symbols: string[], latestDate?: string) => {
    const supabase = getSupabase();
    
    // If no latestDate provided, get it
    if (!latestDate) {
      const { data: dateData } = await supabase
        .from('market_data')
        .select('date')
        .order('date', { ascending: false })
        .limit(1);
      
      latestDate = dateData?.[0]?.date;
    }

    if (!latestDate) return [];

    const { data, error } = await supabase
      .from('market_data')
      .select('*')
      .eq('date', latestDate)
      .in('symbol', symbols)
      .order('symbol');

    if (error) throw error;
    return data || [];
  },

  // Weekly analysis queries
  getLatestWeeklyAnalysis: async (analysisType?: string) => {
    const supabase = getSupabase();
    let query = supabase
      .from('weekly_analysis')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(1);

    if (analysisType) {
      query = query.eq('analysis_type', analysisType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data?.[0] || null;
  },

  getRecentWeeklyAnalysis: async (limit: number = 5) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('weekly_analysis')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // Market news queries
  getSignificantNews: async (limit: number = 10) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('market_news')
      .select('*')
      .eq('is_significant', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // Loans queries
  getActiveLoans: async (userId: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('current_balance', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  createLoan: async (loan: Omit<Loan, 'id' | 'created_at' | 'updated_at'>) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('loans')
      .insert(loan)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteLoan: async (loanId: string) => {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('loans')
      .delete()
      .eq('id', loanId);

    if (error) throw error;
    return true;
  },

  // User holdings queries
  getUserHoldings: async (userId: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('user_holdings')
      .select('*')
      .eq('user_id', userId)
      .order('symbol');

    if (error) throw error;
    return data || [];
  },

  // Teller accounts queries
  getTellerAccounts: async (userId: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('teller_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('institution_name');

    if (error) throw error;
    return data || [];
  },

  // Account balances
  getAccountBalances: async (userId: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('teller_accounts')
      .select('account_id, name, type, subtype, institution_name, current_balance, available_balance, last_synced_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('current_balance', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};

export default getSupabase;

