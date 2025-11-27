-- ============================================
-- MARKET NEWS TABLE
-- ============================================
-- Stores financial news articles from Finnhub and other sources

CREATE TABLE IF NOT EXISTS public.market_news (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT UNIQUE NOT NULL,
  symbol TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  image_url TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  category TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  is_significant BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_news_symbol ON public.market_news(symbol);
CREATE INDEX IF NOT EXISTS idx_market_news_published ON public.market_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_news_significant ON public.market_news(is_significant, published_at DESC);

-- Market news is public (read-only for users, write for service role)
ALTER TABLE public.market_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read market news" ON public.market_news
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage market news" ON public.market_news
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- WEEKLY ANALYSIS TABLE
-- ============================================
-- Stores AI-generated weekly market analysis

CREATE TABLE IF NOT EXISTS public.weekly_analysis (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('thesis', 'performance', 'news', 'portfolio')),
  title TEXT NOT NULL,
  executive_summary TEXT NOT NULL,
  detailed_analysis JSONB,
  top_performers JSONB,
  worst_performers JSONB,
  key_events TEXT,
  recommendations JSONB,
  key_metrics JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_analysis_week ON public.weekly_analysis(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_analysis_type ON public.weekly_analysis(analysis_type, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_analysis_user ON public.weekly_analysis(user_id, week_start DESC);

-- Weekly analysis can be public or user-specific
ALTER TABLE public.weekly_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public analysis" ON public.weekly_analysis
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can manage own analysis" ON public.weekly_analysis
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all analysis" ON public.weekly_analysis
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- ADD PERFORMANCE COLUMNS TO MARKET_DATA
-- ============================================
-- Add columns for 30/90/365 day performance if they don't exist

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_data' AND column_name = 'performance_30d') THEN
    ALTER TABLE public.market_data ADD COLUMN performance_30d NUMERIC(8,4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_data' AND column_name = 'performance_90d') THEN
    ALTER TABLE public.market_data ADD COLUMN performance_90d NUMERIC(8,4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_data' AND column_name = 'performance_365d') THEN
    ALTER TABLE public.market_data ADD COLUMN performance_365d NUMERIC(8,4);
  END IF;
END $$;
