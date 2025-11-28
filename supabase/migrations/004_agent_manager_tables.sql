-- ============================================
-- AGENT MANAGER TABLES
-- ============================================

-- Agent Configurations
CREATE TABLE IF NOT EXISTS public.agent_configs (
  id SERIAL PRIMARY KEY,
  agent_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK(agent_type IN ('discord-bot', 'scheduler', 'service')),
  status TEXT NOT NULL CHECK(status IN ('active', 'inactive', 'error')) DEFAULT 'active',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  channel_ids TEXT, -- Comma separated or JSON string
  config TEXT, -- JSON config string
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_configs_status ON public.agent_configs(status, is_enabled);

-- Recurring Tasks
CREATE TABLE IF NOT EXISTS public.recurring_tasks (
  id SERIAL PRIMARY KEY,
  task_name TEXT UNIQUE NOT NULL,
  agent_name TEXT NOT NULL REFERENCES public.agent_configs(agent_name) ON DELETE CASCADE,
  description TEXT NOT NULL,
  cron_schedule TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  total_runs INTEGER NOT NULL DEFAULT 0,
  successful_runs INTEGER NOT NULL DEFAULT 0,
  failed_runs INTEGER NOT NULL DEFAULT 0,
  config TEXT, -- JSON config string
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_tasks_agent ON public.recurring_tasks(agent_name, is_enabled);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_schedule ON public.recurring_tasks(next_run_at, is_enabled);

-- Task Executions (Extension of agent_tasks but for recurring ones)
CREATE TABLE IF NOT EXISTS public.task_executions (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES public.recurring_tasks(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'skipped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration INTEGER, -- milliseconds
  result TEXT, -- JSON result
  error TEXT,
  metadata TEXT -- JSON metadata
);

CREATE INDEX IF NOT EXISTS idx_task_executions_task ON public.task_executions(task_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_executions_status ON public.task_executions(status, started_at DESC);

-- RLS Policies (if RLS is enabled)
ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_executions ENABLE ROW LEVEL SECURITY;

-- Allow everything for service role (which the bot uses)
CREATE POLICY "Service role full access agent_configs" ON public.agent_configs FOR ALL USING (true);
CREATE POLICY "Service role full access recurring_tasks" ON public.recurring_tasks FOR ALL USING (true);
CREATE POLICY "Service role full access task_executions" ON public.task_executions FOR ALL USING (true);


