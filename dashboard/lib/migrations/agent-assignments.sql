-- Agent Assignments and Activity Tracking for Project Cards
-- Run this in your PostgreSQL database to add agent tracking to projects

-- Add agent assignment fields to project_cards
ALTER TABLE project_cards ADD COLUMN IF NOT EXISTS assigned_agent TEXT;
ALTER TABLE project_cards ADD COLUMN IF NOT EXISTS completed_by_agent TEXT;

-- Create card activity table to track agent actions
CREATE TABLE IF NOT EXISTS card_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES project_cards(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_name TEXT, -- NULL for user actions
  user_id TEXT,    -- NULL for agent actions
  action_type TEXT NOT NULL CHECK (action_type IN (
    'created',
    'updated',
    'moved',
    'completed',
    'reopened',
    'assigned',
    'unassigned',
    'commented',
    'priority_changed',
    'due_date_changed'
  )),
  action_details JSONB DEFAULT '{}',
  from_value TEXT,
  to_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_card_activity_card_id ON card_activity(card_id);
CREATE INDEX IF NOT EXISTS idx_card_activity_project_id ON card_activity(project_id);
CREATE INDEX IF NOT EXISTS idx_card_activity_agent_name ON card_activity(agent_name);
CREATE INDEX IF NOT EXISTS idx_card_activity_created_at ON card_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_cards_assigned_agent ON project_cards(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_project_cards_completed_by_agent ON project_cards(completed_by_agent);

-- Enable RLS
ALTER TABLE card_activity ENABLE ROW LEVEL SECURITY;

-- Policy for card activity
CREATE POLICY "Users can view card activity" ON card_activity
  FOR ALL USING (true);

-- View to get agent activity summary per project
CREATE OR REPLACE VIEW agent_project_activity AS
SELECT
  ca.project_id,
  ca.agent_name,
  COUNT(*) as total_actions,
  COUNT(*) FILTER (WHERE ca.action_type = 'completed') as tasks_completed,
  COUNT(*) FILTER (WHERE ca.action_type = 'created') as tasks_created,
  COUNT(*) FILTER (WHERE ca.action_type = 'moved') as tasks_moved,
  MAX(ca.created_at) as last_activity
FROM card_activity ca
WHERE ca.agent_name IS NOT NULL
GROUP BY ca.project_id, ca.agent_name;

-- View to get agent workload (assigned cards)
CREATE OR REPLACE VIEW agent_workload AS
SELECT
  pc.assigned_agent,
  pc.project_id,
  COUNT(*) as assigned_cards,
  COUNT(*) FILTER (WHERE pc.is_completed = false) as pending_cards,
  COUNT(*) FILTER (WHERE pc.is_completed = true) as completed_cards,
  COUNT(*) FILTER (WHERE pc.priority IN ('high', 'urgent')) as high_priority_cards
FROM project_cards pc
WHERE pc.assigned_agent IS NOT NULL
GROUP BY pc.assigned_agent, pc.project_id;
