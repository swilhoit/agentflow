-- AgentFlow PostgreSQL Database Schema
-- Self-hosted on Hetzner VPS

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AGENT TASKS: Track all agent task executions
-- ============================================
CREATE TABLE IF NOT EXISTS agent_tasks (
    id SERIAL PRIMARY KEY,
    agent_id TEXT NOT NULL UNIQUE,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT,
    task_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    result TEXT,
    error TEXT,
    iterations INTEGER DEFAULT 0,
    tool_calls INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_guild_channel ON agent_tasks(guild_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_user ON agent_tasks(user_id, started_at DESC);

-- ============================================
-- AGENT LOGS: Detailed logs for each agent task
-- ============================================
CREATE TABLE IF NOT EXISTS agent_logs (
    id SERIAL PRIMARY KEY,
    agent_id TEXT NOT NULL,
    task_id TEXT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    log_type TEXT NOT NULL CHECK (log_type IN ('info', 'warning', 'error', 'success', 'step', 'tool_call', 'tool_result')),
    message TEXT NOT NULL,
    details JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_logs(agent_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_task ON agent_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_guild_channel ON agent_logs(guild_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_type ON agent_logs(log_type, timestamp DESC);

-- ============================================
-- STARTUP LOGS: System startup/shutdown events
-- ============================================
CREATE TABLE IF NOT EXISTS startup_logs (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN ('startup_begin', 'startup_success', 'startup_failure', 'shutdown', 'crash', 'health_check', 'service_error')),
    message TEXT NOT NULL,
    details TEXT,
    stack_trace TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_startup_logs_type ON startup_logs(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_startup_logs_time ON startup_logs(timestamp DESC);

-- ============================================
-- CONVERSATIONS: Store Discord conversation history
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT,
    message TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'voice_transcript', 'agent_response', 'system')),
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(guild_id, channel_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, timestamp DESC);

-- ============================================
-- SYSTEM LOGS: General application logs
-- ============================================
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
    service TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_service ON system_logs(service, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_time ON system_logs(timestamp DESC);

-- ============================================
-- TOOL EXECUTIONS: Track all tool calls
-- ============================================
CREATE TABLE IF NOT EXISTS tool_executions (
    id SERIAL PRIMARY KEY,
    task_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    tool_input JSONB,
    tool_output TEXT,
    success BOOLEAN DEFAULT true,
    error TEXT,
    duration_ms INTEGER,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_executions_task ON tool_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_agent ON tool_executions(agent_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON tool_executions(tool_name, timestamp DESC);

-- ============================================
-- DAILY GOALS: Track daily task goals
-- ============================================
CREATE TABLE IF NOT EXISTS daily_goals (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    date DATE NOT NULL,
    goals JSONB NOT NULL DEFAULT '[]'::jsonb,
    completed_goals JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(guild_id, channel_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_goals_guild ON daily_goals(guild_id, date DESC);

-- ============================================
-- HEALTH CHECKS: Track system health over time
-- ============================================
CREATE TABLE IF NOT EXISTS health_checks (
    id SERIAL PRIMARY KEY,
    healthy BOOLEAN NOT NULL,
    uptime_seconds INTEGER,
    active_agents INTEGER,
    pending_tasks INTEGER,
    completed_tasks_24h INTEGER,
    failed_tasks_24h INTEGER,
    memory_mb INTEGER,
    cpu_percent NUMERIC(5,2),
    disk_percent NUMERIC(5,2),
    details JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_checks_time ON health_checks(timestamp DESC);

-- ============================================
-- Grant permissions (for safety)
-- ============================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agentflow;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO agentflow;

-- Log successful initialization
INSERT INTO startup_logs (event_type, message, details, timestamp)
VALUES ('startup_success', 'AgentFlow PostgreSQL database initialized', 'All tables and indexes created successfully', NOW());




