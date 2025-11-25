import { getSupabase } from './supabase';

/**
 * Database queries for Agent Manager (Cloud-based with Supabase)
 * Note: These tables may need to be created in Supabase if they don't exist
 */
export const db_queries_agents = {
  // Get all agents
  getAllAgents: async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('agent_configs')
        .select('*')
        .order('agent_type')
        .order('display_name');
      
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Agent configs table may not exist:', e);
      return [];
    }
  },

  // Get agent by name
  getAgent: async (agentName: string) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('agent_name', agentName)
        .single();
      
      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  },

  // Get all recurring tasks
  getAllRecurringTasks: async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('recurring_tasks')
        .select('*')
        .order('agent_name')
        .order('task_name');
      
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Recurring tasks table may not exist:', e);
      return [];
    }
  },

  // Get recurring tasks by agent
  getAgentRecurringTasks: async (agentName: string) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('recurring_tasks')
        .select('*')
        .eq('agent_name', agentName)
        .order('task_name');
      
      if (error) throw error;
      return data || [];
    } catch (e) {
      return [];
    }
  },

  // Get task execution history
  getTaskExecutions: async (taskId: string, limit: number = 50) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('task_executions')
        .select('*')
        .eq('task_id', taskId)
        .order('started_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (e) {
      return [];
    }
  },

  // Get recent executions across all tasks
  getRecentExecutions: async (limit: number = 50) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('task_executions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (e) {
      return [];
    }
  },

  // Get failed executions
  getFailedExecutions: async (limit: number = 50) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('task_executions')
        .select('*')
        .eq('status', 'failed')
        .order('started_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (e) {
      return [];
    }
  },

  // Get agent statistics
  getAgentStats: async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('recurring_tasks')
        .select('is_enabled, total_runs, successful_runs, failed_runs');
      
      if (error) throw error;
      
      const tasks = data || [];
      return {
        totalTasks: tasks.length,
        enabledTasks: tasks.filter(t => t.is_enabled).length,
        disabledTasks: tasks.filter(t => !t.is_enabled).length,
        totalExecutions: tasks.reduce((sum, t) => sum + (t.total_runs || 0), 0),
        successfulExecutions: tasks.reduce((sum, t) => sum + (t.successful_runs || 0), 0),
        failedExecutions: tasks.reduce((sum, t) => sum + (t.failed_runs || 0), 0)
      };
    } catch (e) {
      return {
        totalTasks: 0,
        enabledTasks: 0,
        disabledTasks: 0,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0
      };
    }
  },

  // Get task statistics by agent
  getAgentTaskStats: async (agentName: string) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('recurring_tasks')
        .select('is_enabled, total_runs, successful_runs, failed_runs')
        .eq('agent_name', agentName);
      
      if (error) throw error;
      
      const tasks = data || [];
      return {
        totalTasks: tasks.length,
        enabledTasks: tasks.filter(t => t.is_enabled).length,
        totalRuns: tasks.reduce((sum, t) => sum + (t.total_runs || 0), 0),
        successfulRuns: tasks.reduce((sum, t) => sum + (t.successful_runs || 0), 0),
        failedRuns: tasks.reduce((sum, t) => sum + (t.failed_runs || 0), 0)
      };
    } catch (e) {
      return {
        totalTasks: 0,
        enabledTasks: 0,
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0
      };
    }
  },

  // Get execution statistics for a specific task
  getTaskExecutionStats: async (taskId: string) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('task_executions')
        .select('status, duration')
        .eq('task_id', taskId);
      
      if (error) throw error;
      
      const executions = data || [];
      const durations = executions.map(e => e.duration || 0).filter(d => d > 0);
      
      return {
        totalExecutions: executions.length,
        successfulExecutions: executions.filter(e => e.status === 'success').length,
        failedExecutions: executions.filter(e => e.status === 'failed').length,
        avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
        minDuration: durations.length > 0 ? Math.min(...durations) : 0
      };
    } catch (e) {
      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgDuration: 0,
        maxDuration: 0,
        minDuration: 0
      };
    }
  },

  // Get recent activity timeline
  getActivityTimeline: async (hours: number = 24) => {
    try {
      const supabase = getSupabase();
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hours);

      const { data, error } = await supabase
        .from('task_executions')
        .select('started_at, status')
        .gte('started_at', cutoffDate.toISOString());
      
      if (error) throw error;
      
      // Group by hour
      const hourlyMap = new Map<string, { total: number; successful: number; failed: number }>();
      (data || []).forEach(exec => {
        const hour = exec.started_at.substring(0, 13) + ':00:00';
        const entry = hourlyMap.get(hour) || { total: 0, successful: 0, failed: 0 };
        entry.total++;
        if (exec.status === 'success') entry.successful++;
        if (exec.status === 'failed') entry.failed++;
        hourlyMap.set(hour, entry);
      });

      return Array.from(hourlyMap.entries())
        .map(([hour, stats]) => ({ hour, ...stats }))
        .sort((a, b) => b.hour.localeCompare(a.hour));
    } catch (e) {
      return [];
    }
  },

  // Get tasks that need attention
  getTasksNeedingAttention: async () => {
    try {
      const supabase = getSupabase();
      
      // Get enabled tasks with their last execution
      const { data: tasks, error } = await supabase
        .from('recurring_tasks')
        .select('*')
        .eq('is_enabled', true);
      
      if (error) throw error;
      
      // Filter to tasks needing attention
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      return (tasks || []).filter(task => {
        if (!task.last_run_at) {
          // Never run and created more than a day ago
          return new Date(task.created_at) < oneDayAgo;
        }
        // Not run in 2 days
        return new Date(task.last_run_at) < twoDaysAgo;
      });
    } catch (e) {
      return [];
    }
  }
};
