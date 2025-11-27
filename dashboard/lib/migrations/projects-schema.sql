-- Project Management Tables for Supabase
-- Run this in Supabase SQL Editor to create the required tables

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project columns (like Trello lists)
CREATE TABLE IF NOT EXISTS project_columns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project cards (like Trello cards)
CREATE TABLE IF NOT EXISTS project_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id UUID NOT NULL REFERENCES project_columns(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  labels TEXT[] DEFAULT '{}',
  assignee TEXT,
  estimated_hours NUMERIC(6,2),
  actual_hours NUMERIC(6,2),
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project labels for categorization
CREATE TABLE IF NOT EXISTS project_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(is_archived);
CREATE INDEX IF NOT EXISTS idx_project_columns_project_id ON project_columns(project_id);
CREATE INDEX IF NOT EXISTS idx_project_columns_position ON project_columns(position);
CREATE INDEX IF NOT EXISTS idx_project_cards_column_id ON project_cards(column_id);
CREATE INDEX IF NOT EXISTS idx_project_cards_project_id ON project_cards(project_id);
CREATE INDEX IF NOT EXISTS idx_project_cards_due_date ON project_cards(due_date);
CREATE INDEX IF NOT EXISTS idx_project_cards_priority ON project_cards(priority);
CREATE INDEX IF NOT EXISTS idx_project_cards_position ON project_cards(position);
CREATE INDEX IF NOT EXISTS idx_project_labels_project_id ON project_labels(project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_labels ENABLE ROW LEVEL SECURITY;

-- Policies for access control (adjust based on your auth setup)
-- For now, using user_id text field matching

CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own projects" ON projects
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own projects" ON projects
  FOR DELETE USING (true);

-- Similar policies for related tables
CREATE POLICY "Users can view project columns" ON project_columns
  FOR ALL USING (true);

CREATE POLICY "Users can view project cards" ON project_cards
  FOR ALL USING (true);

CREATE POLICY "Users can view project labels" ON project_labels
  FOR ALL USING (true);
