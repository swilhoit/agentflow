-- ============================================
-- ECONOMIC CALENDAR TABLE
-- ============================================
-- Stores upcoming economic events (earnings, CPI, FOMC, etc.)

CREATE TABLE IF NOT EXISTS public.economic_calendar (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  event_name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'earnings',       -- Company earnings reports
    'fomc',           -- Federal Reserve meetings
    'cpi',            -- Consumer Price Index
    'ppi',            -- Producer Price Index
    'gdp',            -- GDP releases
    'employment',     -- Non-farm payrolls, unemployment
    'fed_speech',     -- Fed chair/governor speeches
    'ism',            -- ISM manufacturing/services
    'retail_sales',   -- Retail sales data
    'housing',        -- Housing starts, sales data
    'trade_balance',  -- Trade balance data
    'consumer_conf',  -- Consumer confidence
    'opec',           -- OPEC meetings
    'other'           -- Other market-moving events
  )),
  country TEXT DEFAULT 'US',
  impact_level TEXT NOT NULL CHECK (impact_level IN ('high', 'medium', 'low')),
  scheduled_time TIMESTAMPTZ NOT NULL,
  actual_release_time TIMESTAMPTZ,

  -- For economic data releases
  previous_value TEXT,
  forecast_value TEXT,
  actual_value TEXT,
  unit TEXT,

  -- For earnings
  symbol TEXT,
  company_name TEXT,
  earnings_estimate NUMERIC(12,4),
  earnings_actual NUMERIC(12,4),
  revenue_estimate BIGINT,
  revenue_actual BIGINT,
  earnings_surprise_pct NUMERIC(8,4),

  -- Trading signals
  market_reaction TEXT CHECK (market_reaction IN ('bullish', 'bearish', 'neutral', null)),
  affected_sectors JSONB,
  trading_notes TEXT,

  -- Metadata
  source TEXT DEFAULT 'finnhub',
  is_released BOOLEAN DEFAULT false,
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_economic_calendar_time ON public.economic_calendar(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_economic_calendar_type ON public.economic_calendar(event_type, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_economic_calendar_impact ON public.economic_calendar(impact_level, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_economic_calendar_symbol ON public.economic_calendar(symbol) WHERE symbol IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_economic_calendar_unreleased ON public.economic_calendar(is_released, scheduled_time) WHERE is_released = false;

-- RLS policies
ALTER TABLE public.economic_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read economic calendar" ON public.economic_calendar
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage economic calendar" ON public.economic_calendar
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- VIX TRADING SIGNALS TABLE
-- ============================================
-- Stores VIX analysis and trading signals

CREATE TABLE IF NOT EXISTS public.vix_signals (
  id BIGSERIAL PRIMARY KEY,
  signal_id TEXT UNIQUE NOT NULL,
  signal_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- VIX data at signal time
  vix_level NUMERIC(8,4) NOT NULL,
  vix_change_pct NUMERIC(8,4),
  vix_term_structure TEXT CHECK (vix_term_structure IN ('contango', 'backwardation', 'flat')),
  vix_percentile_30d NUMERIC(8,4),
  vix_percentile_90d NUMERIC(8,4),

  -- S&P 500 context
  spy_level NUMERIC(10,2),
  spy_change_pct NUMERIC(8,4),
  spy_rsi_14 NUMERIC(8,4),

  -- Signal details
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'oversold',           -- VIX < 15, complacent market
    'overbought',         -- VIX > 30, fearful market
    'spike',              -- Large VIX move (>20% in a day)
    'term_structure',     -- Contango/backwardation extreme
    'mean_reversion',     -- VIX moving back to mean
    'divergence',         -- VIX/SPY divergence
    'event_based'         -- Tied to economic event
  )),
  signal_strength INTEGER CHECK (signal_strength BETWEEN 1 AND 10),
  confidence_pct NUMERIC(5,2),

  -- Recommendation
  recommendation TEXT CHECK (recommendation IN (
    'BUY_VIX_CALLS',      -- Long volatility via calls
    'BUY_VIX_PUTS',       -- Short volatility via puts
    'BUY_SPY_PUTS',       -- Hedge with SPY puts
    'BUY_SPY_CALLS',      -- Long SPY via calls
    'SELL_VIX_CALLS',     -- Short vol via selling calls
    'SELL_VIX_PUTS',      -- Short vol via selling puts
    'CALENDAR_SPREAD',    -- VIX calendar spread
    'HEDGE_PORTFOLIO',    -- General portfolio hedge
    'NO_ACTION'           -- No clear trade
  )),

  -- Trade parameters
  suggested_symbol TEXT,      -- UVXY, VXX, SVXY, SPY, etc.
  suggested_expiration DATE,
  suggested_strike NUMERIC(10,2),
  position_size_pct NUMERIC(5,2),  -- % of portfolio
  stop_loss_pct NUMERIC(5,2),
  target_pct NUMERIC(5,2),
  max_days_to_hold INTEGER,

  -- Event context (if signal is event-based)
  related_event_id BIGINT REFERENCES public.economic_calendar(id),

  -- AI analysis
  analysis_reasoning TEXT,
  risk_factors JSONB,

  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'executed', 'invalidated')),
  expires_at TIMESTAMPTZ,
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vix_signals_time ON public.vix_signals(signal_time DESC);
CREATE INDEX IF NOT EXISTS idx_vix_signals_type ON public.vix_signals(signal_type, signal_time DESC);
CREATE INDEX IF NOT EXISTS idx_vix_signals_status ON public.vix_signals(status, signal_time DESC);
CREATE INDEX IF NOT EXISTS idx_vix_signals_active ON public.vix_signals(status, expires_at) WHERE status = 'active';

ALTER TABLE public.vix_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vix signals" ON public.vix_signals
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage vix signals" ON public.vix_signals
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- VIX POSITIONS TABLE
-- ============================================
-- Tracks VIX-related trades and positions

CREATE TABLE IF NOT EXISTS public.vix_positions (
  id BIGSERIAL PRIMARY KEY,
  position_id TEXT UNIQUE NOT NULL,
  signal_id TEXT REFERENCES public.vix_signals(signal_id),

  -- Position details
  symbol TEXT NOT NULL,
  contract_type TEXT CHECK (contract_type IN ('stock', 'call', 'put')),
  strike_price NUMERIC(10,2),
  expiration_date DATE,

  -- Entry
  entry_price NUMERIC(10,4) NOT NULL,
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quantity INTEGER NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  cost_basis NUMERIC(12,4),

  -- Exit (when closed)
  exit_price NUMERIC(10,4),
  exit_time TIMESTAMPTZ,
  exit_reason TEXT CHECK (exit_reason IN (
    'target_hit',
    'stop_loss',
    'expiration',
    'signal_invalidated',
    'manual_close',
    'time_decay'
  )),

  -- P&L
  realized_pnl NUMERIC(12,4),
  realized_pnl_pct NUMERIC(8,4),
  max_gain_pct NUMERIC(8,4),
  max_drawdown_pct NUMERIC(8,4),

  -- Context
  vix_at_entry NUMERIC(8,4),
  vix_at_exit NUMERIC(8,4),
  spy_at_entry NUMERIC(10,2),
  spy_at_exit NUMERIC(10,2),

  -- Strategy
  strategy_type TEXT CHECK (strategy_type IN (
    'mean_reversion',
    'spike_fade',
    'hedging',
    'directional',
    'calendar_spread'
  )),

  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vix_positions_symbol ON public.vix_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_vix_positions_status ON public.vix_positions(status, entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_vix_positions_signal ON public.vix_positions(signal_id);
CREATE INDEX IF NOT EXISTS idx_vix_positions_open ON public.vix_positions(status, expiration_date) WHERE status = 'open';

ALTER TABLE public.vix_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vix positions" ON public.vix_positions
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage vix positions" ON public.vix_positions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- VIX HISTORICAL DATA TABLE
-- ============================================
-- Stores historical VIX data for analysis

CREATE TABLE IF NOT EXISTS public.vix_history (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  vix_open NUMERIC(8,4),
  vix_high NUMERIC(8,4),
  vix_low NUMERIC(8,4),
  vix_close NUMERIC(8,4) NOT NULL,
  vix3m_close NUMERIC(8,4),  -- 3-month VIX
  vix6m_close NUMERIC(8,4),  -- 6-month VIX
  vix_volume BIGINT,

  -- Derived metrics
  term_structure_ratio NUMERIC(8,4),  -- VIX/VIX3M
  daily_change_pct NUMERIC(8,4),
  percentile_30d NUMERIC(8,4),
  percentile_90d NUMERIC(8,4),

  -- SPY context
  spy_close NUMERIC(10,2),
  spy_change_pct NUMERIC(8,4),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(timestamp)
);

CREATE INDEX IF NOT EXISTS idx_vix_history_time ON public.vix_history(timestamp DESC);

ALTER TABLE public.vix_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vix history" ON public.vix_history
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage vix history" ON public.vix_history
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TRADING PERFORMANCE METRICS TABLE
-- ============================================
-- Aggregate trading performance for strategies

CREATE TABLE IF NOT EXISTS public.vix_strategy_performance (
  id BIGSERIAL PRIMARY KEY,
  strategy_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Performance metrics
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  win_rate NUMERIC(5,2),

  -- P&L
  total_pnl NUMERIC(12,4) DEFAULT 0,
  avg_win NUMERIC(12,4),
  avg_loss NUMERIC(12,4),
  largest_win NUMERIC(12,4),
  largest_loss NUMERIC(12,4),
  profit_factor NUMERIC(8,4),

  -- Risk metrics
  max_drawdown_pct NUMERIC(8,4),
  sharpe_ratio NUMERIC(8,4),
  avg_days_held NUMERIC(8,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(strategy_type, period_start, period_end)
);

ALTER TABLE public.vix_strategy_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read strategy performance" ON public.vix_strategy_performance
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage strategy performance" ON public.vix_strategy_performance
  FOR ALL USING (auth.role() = 'service_role');
