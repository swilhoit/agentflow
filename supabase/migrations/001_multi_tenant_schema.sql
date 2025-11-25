-- ============================================
-- AGENTFLOW MULTI-TENANT SCHEMA
-- ============================================
-- This migration creates all tables needed for
-- multi-tenant Discord bot operation.
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- GUILD REGISTRATIONS (Discord Server → User)
-- ============================================
CREATE TABLE IF NOT EXISTS public.guild_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL UNIQUE, -- Discord guild/server ID
  guild_name TEXT,
  is_active BOOLEAN DEFAULT true,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}', -- Guild-specific settings
  UNIQUE(user_id, guild_id)
);

CREATE INDEX idx_guild_registrations_guild ON public.guild_registrations(guild_id);
CREATE INDEX idx_guild_registrations_user ON public.guild_registrations(user_id);

-- RLS for guild_registrations
ALTER TABLE public.guild_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own guild registrations" ON public.guild_registrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own guild registrations" ON public.guild_registrations
  FOR ALL USING (auth.uid() = user_id);

-- Service role can read all (for bot operations)
CREATE POLICY "Service role can read all guild registrations" ON public.guild_registrations
  FOR SELECT USING (auth.role() = 'service_role');

-- ============================================
-- USER CREDENTIALS (Encrypted API Keys)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL, -- 'anthropic', 'elevenlabs', 'teller', 'finnhub', etc.
  encrypted_credentials TEXT NOT NULL, -- Encrypted with AES-256
  is_valid BOOLEAN DEFAULT true,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, service_name)
);

CREATE INDEX idx_user_credentials_user ON public.user_credentials(user_id);

-- RLS for user_credentials
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own credentials" ON public.user_credentials
  FOR ALL USING (auth.uid() = user_id);

-- Service role can read all (for bot operations)
CREATE POLICY "Service role can read all credentials" ON public.user_credentials
  FOR SELECT USING (auth.role() = 'service_role');

-- ============================================
-- CONVERSATIONS (Chat History)
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('voice', 'text', 'agent_response')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_conversations_user_channel ON public.conversations(user_id, channel_id, timestamp DESC);
CREATE INDEX idx_conversations_timestamp ON public.conversations(timestamp DESC);

-- RLS for conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations" ON public.conversations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all conversations" ON public.conversations
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- AGENT TASKS
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id TEXT UNIQUE NOT NULL,
  guild_id TEXT,
  channel_id TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  priority TEXT DEFAULT 'normal',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  iterations INTEGER DEFAULT 0,
  tool_calls INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0
);

CREATE INDEX idx_agent_tasks_user_status ON public.agent_tasks(user_id, status, started_at DESC);
CREATE INDEX idx_agent_tasks_task_id ON public.agent_tasks(task_id);

-- RLS for agent_tasks
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agent tasks" ON public.agent_tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all agent tasks" ON public.agent_tasks
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- AGENT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES public.agent_tasks(task_id) ON DELETE CASCADE,
  log_type TEXT NOT NULL CHECK (log_type IN ('info', 'warning', 'error', 'success', 'step', 'tool_call')),
  message TEXT NOT NULL,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_logs_task ON public.agent_logs(task_id, timestamp ASC);

-- RLS for agent_logs
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent logs" ON public.agent_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all agent logs" ON public.agent_logs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- FINANCIAL TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT,
  account_type TEXT,
  institution TEXT,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  merchant TEXT,
  details JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, transaction_id)
);

CREATE INDEX idx_financial_transactions_user_date ON public.financial_transactions(user_id, date DESC);
CREATE INDEX idx_financial_transactions_category ON public.financial_transactions(user_id, category, date DESC);
CREATE INDEX idx_financial_transactions_account ON public.financial_transactions(user_id, account_id, date DESC);

-- RLS for financial_transactions
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions" ON public.financial_transactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all transactions" ON public.financial_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- BANK ACCOUNTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL, -- External account ID (from Teller)
  institution TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL, -- checking, savings, credit
  last_four TEXT,
  balance NUMERIC(12,2),
  available_balance NUMERIC(12,2),
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, account_id)
);

CREATE INDEX idx_bank_accounts_user ON public.bank_accounts(user_id);

-- RLS for bank_accounts
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bank accounts" ON public.bank_accounts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all bank accounts" ON public.bank_accounts
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- DAILY GOALS
-- ============================================
CREATE TABLE IF NOT EXISTS public.daily_goals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  goals TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_goals_user_date ON public.daily_goals(user_id, date DESC);

-- RLS for daily_goals
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own goals" ON public.daily_goals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all goals" ON public.daily_goals
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- MARKET DATA (Shared across all users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.market_data (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(12,4) NOT NULL,
  change_amount NUMERIC(12,4),
  change_percent NUMERIC(8,4),
  volume BIGINT,
  market_cap BIGINT,
  date DATE NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, date)
);

CREATE INDEX idx_market_data_symbol_date ON public.market_data(symbol, date DESC);
CREATE INDEX idx_market_data_date ON public.market_data(date DESC);

-- Market data is public (read-only for users, write for service role)
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read market data" ON public.market_data
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage market data" ON public.market_data
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- USER WATCHLISTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_watchlists (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  notes TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

CREATE INDEX idx_user_watchlists_user ON public.user_watchlists(user_id);

-- RLS for user_watchlists
ALTER TABLE public.user_watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own watchlist" ON public.user_watchlists
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all watchlists" ON public.user_watchlists
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- USAGE LOGS (for billing)
-- ============================================
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usage_type TEXT NOT NULL, -- 'claude_tokens', 'tts_characters', 'agent_execution', 'api_call'
  quantity INTEGER NOT NULL,
  cost_estimate NUMERIC(10,6),
  metadata JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_user_date ON public.usage_logs(user_id, recorded_at DESC);
CREATE INDEX idx_usage_logs_type ON public.usage_logs(usage_type, recorded_at DESC);

-- RLS for usage_logs
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON public.usage_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all usage" ON public.usage_logs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get spending summary by category
CREATE OR REPLACE FUNCTION public.get_spending_summary(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  category TEXT,
  transaction_count BIGINT,
  total_spent NUMERIC,
  avg_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ft.category,
    COUNT(*)::BIGINT as transaction_count,
    SUM(ABS(ft.amount)) as total_spent,
    AVG(ABS(ft.amount)) as avg_amount
  FROM public.financial_transactions ft
  WHERE ft.user_id = p_user_id
    AND ft.date BETWEEN p_start_date AND p_end_date
    AND ft.amount < 0
  GROUP BY ft.category
  ORDER BY total_spent DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get monthly usage stats
CREATE OR REPLACE FUNCTION public.get_monthly_usage(
  p_user_id UUID
)
RETURNS TABLE (
  usage_type TEXT,
  total_quantity BIGINT,
  total_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ul.usage_type,
    SUM(ul.quantity)::BIGINT as total_quantity,
    SUM(ul.cost_estimate) as total_cost
  FROM public.usage_logs ul
  WHERE ul.user_id = p_user_id
    AND ul.recorded_at >= DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY ul.usage_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_credentials_updated_at
  BEFORE UPDATE ON public.user_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- ENABLE REALTIME
-- ============================================
-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

