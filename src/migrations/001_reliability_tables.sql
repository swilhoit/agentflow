-- Migration: Reliability Enhancement Tables
-- Date: 2025-11-28
-- Purpose: Add checkpointing, workspace registry, and task recovery support

-- Task execution checkpoints for recovery
CREATE TABLE IF NOT EXISTS task_checkpoints (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(100) NOT NULL,
  checkpoint_number INT NOT NULL,
  phase_id VARCHAR(100),
  phase_name VARCHAR(200),
  iteration INT NOT NULL DEFAULT 0,
  tool_calls_count INT NOT NULL DEFAULT 0,
  conversation_context JSONB,
  workspace_path VARCHAR(500),
  discoveries TEXT[] DEFAULT '{}',
  artifacts JSONB DEFAULT '{"files_created": [], "urls_deployed": [], "repos_created": []}',
  memory_state JSONB,  -- SelfMonitor memory snapshot
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, checkpoint_number)
);

-- Index for fast checkpoint lookups
CREATE INDEX IF NOT EXISTS idx_task_checkpoints_task_id ON task_checkpoints(task_id);
CREATE INDEX IF NOT EXISTS idx_task_checkpoints_created_at ON task_checkpoints(created_at DESC);

-- Task workspace assignments (one primary workspace per task)
CREATE TABLE IF NOT EXISTS task_workspaces (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(100) NOT NULL,
  workspace_path VARCHAR(500) NOT NULL,
  workspace_name VARCHAR(200) NOT NULL,
  github_repo_url VARCHAR(500),
  github_repo_name VARCHAR(200),
  is_primary BOOLEAN DEFAULT TRUE,
  status VARCHAR(50) DEFAULT 'active',  -- active, archived, deleted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, workspace_path)
);

-- Index for fast workspace lookups
CREATE INDEX IF NOT EXISTS idx_task_workspaces_task_id ON task_workspaces(task_id);
CREATE INDEX IF NOT EXISTS idx_task_workspaces_status ON task_workspaces(status);

-- Task interruption records (for resume tracking)
CREATE TABLE IF NOT EXISTS task_interruptions (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(100) NOT NULL,
  interrupt_reason VARCHAR(500) NOT NULL,
  interrupt_signal VARCHAR(50),  -- SIGTERM, SIGINT, etc.
  checkpoint_id INT REFERENCES task_checkpoints(id),
  is_resumable BOOLEAN DEFAULT FALSE,
  resume_attempted BOOLEAN DEFAULT FALSE,
  resume_succeeded BOOLEAN,
  resumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for interruption lookups
CREATE INDEX IF NOT EXISTS idx_task_interruptions_task_id ON task_interruptions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_interruptions_resumable ON task_interruptions(is_resumable) WHERE is_resumable = TRUE;

-- Outcome verification records
CREATE TABLE IF NOT EXISTS task_verifications (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(100) NOT NULL,
  verification_type VARCHAR(50) NOT NULL,  -- completion, deployment, test
  verified BOOLEAN NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,  -- 0.00 to 1.00
  evidence JSONB NOT NULL DEFAULT '[]',
  suggestions TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for verification lookups
CREATE INDEX IF NOT EXISTS idx_task_verifications_task_id ON task_verifications(task_id);

-- Add new columns to agent_tasks if they don't exist
DO $$
BEGIN
  -- Add is_resumable column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'agent_tasks' AND column_name = 'is_resumable') THEN
    ALTER TABLE agent_tasks ADD COLUMN is_resumable BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add last_checkpoint_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'agent_tasks' AND column_name = 'last_checkpoint_id') THEN
    ALTER TABLE agent_tasks ADD COLUMN last_checkpoint_id INT;
  END IF;

  -- Add workspace_path column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'agent_tasks' AND column_name = 'workspace_path') THEN
    ALTER TABLE agent_tasks ADD COLUMN workspace_path VARCHAR(500);
  END IF;

  -- Add artifacts column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'agent_tasks' AND column_name = 'artifacts') THEN
    ALTER TABLE agent_tasks ADD COLUMN artifacts JSONB DEFAULT '{}';
  END IF;
END $$;

-- Function to cleanup old checkpoints (keep last 5 per task)
CREATE OR REPLACE FUNCTION cleanup_old_checkpoints() RETURNS void AS $$
BEGIN
  DELETE FROM task_checkpoints
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY checkpoint_number DESC) as rn
      FROM task_checkpoints
    ) ranked
    WHERE rn <= 5
  );
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup orphaned workspaces (failed tasks > 24h old)
CREATE OR REPLACE FUNCTION get_orphaned_workspaces() RETURNS TABLE (
  workspace_id INT,
  workspace_path VARCHAR,
  task_id VARCHAR,
  task_status VARCHAR,
  completed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tw.id as workspace_id,
    tw.workspace_path,
    tw.task_id,
    at.status as task_status,
    at.completed_at
  FROM task_workspaces tw
  LEFT JOIN agent_tasks at ON tw.task_id = at.agent_id
  WHERE at.status = 'failed'
    AND at.completed_at < NOW() - INTERVAL '24 hours'
    AND tw.status = 'active';
END;
$$ LANGUAGE plpgsql;
