import { query } from './postgres';

/**
 * Database queries for Agent Manager (Hetzner Postgres)
 */
export const db_queries_agents = {
  // Get all agents
  getAllAgents: async () => {
    try {
      const result = await query(`
        SELECT * FROM agent_configs 
        ORDER BY agent_type, display_name
      `);
      return result.rows || [];
    } catch (e) {
      console.warn('Agent configs table query failed:', e);
      return [];
    }
  },

  // Get agent by name
  getAgent: async (agentName: string) => {
    try {
      const result = await query(`
        SELECT * FROM agent_configs 
        WHERE agent_name = $1
      `, [agentName]);
      return result.rows[0] || null;
    } catch (e) {
      return null;
    }
  },

  // Get all recurring tasks
  getAllRecurringTasks: async () => {
    try {
      const result = await query(`
        SELECT * FROM recurring_tasks 
        ORDER BY agent_name, task_name
      `);
      return result.rows || [];
    } catch (e) {
      console.warn('Recurring tasks table query failed:', e);
      return [];
    }
  },

  // Get recurring tasks by agent
  getAgentRecurringTasks: async (agentName: string) => {
    try {
      const result = await query(`
        SELECT * FROM recurring_tasks 
        WHERE agent_name = $1 
        ORDER BY task_name
      `, [agentName]);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get task execution history
  getTaskExecutions: async (taskId: string, limit: number = 50) => {
    try {
      const result = await query(`
        SELECT * FROM task_executions 
        WHERE task_id = $1 
        ORDER BY started_at DESC 
        LIMIT $2
      `, [taskId, limit]);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get recent executions across all tasks
  getRecentExecutions: async (limit: number = 50) => {
    try {
      const result = await query(`
        SELECT * FROM task_executions 
        ORDER BY started_at DESC 
        LIMIT $1
      `, [limit]);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get failed executions
  getFailedExecutions: async (limit: number = 50) => {
    try {
      const result = await query(`
        SELECT * FROM task_executions 
        WHERE status = 'failed' 
        ORDER BY started_at DESC 
        LIMIT $1
      `, [limit]);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get agent statistics
  getAgentStats: async () => {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN is_enabled = true THEN 1 ELSE 0 END) as enabled_tasks,
          SUM(CASE WHEN is_enabled = false THEN 1 ELSE 0 END) as disabled_tasks,
          SUM(total_runs) as total_executions,
          SUM(successful_runs) as successful_executions,
          SUM(failed_runs) as failed_executions
        FROM recurring_tasks
      `);
      
      const stats = result.rows[0];
      return {
        totalTasks: parseInt(stats.total_tasks) || 0,
        enabledTasks: parseInt(stats.enabled_tasks) || 0,
        disabledTasks: parseInt(stats.disabled_tasks) || 0,
        totalExecutions: parseInt(stats.total_executions) || 0,
        successfulExecutions: parseInt(stats.successful_executions) || 0,
        failedExecutions: parseInt(stats.failed_executions) || 0
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
      const result = await query(`
        SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN is_enabled = true THEN 1 ELSE 0 END) as enabled_tasks,
          SUM(total_runs) as total_runs,
          SUM(successful_runs) as successful_runs,
          SUM(failed_runs) as failed_runs
        FROM recurring_tasks
        WHERE agent_name = $1
      `, [agentName]);
      
      const stats = result.rows[0];
      return {
        totalTasks: parseInt(stats.total_tasks) || 0,
        enabledTasks: parseInt(stats.enabled_tasks) || 0,
        totalRuns: parseInt(stats.total_runs) || 0,
        successfulRuns: parseInt(stats.successful_runs) || 0,
        failedRuns: parseInt(stats.failed_runs) || 0
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
      const result = await query(`
        SELECT 
          COUNT(*) as total_executions,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_executions,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_executions,
          AVG(duration) as avg_duration,
          MAX(duration) as max_duration,
          MIN(duration) as min_duration
        FROM task_executions
        WHERE task_id = $1
      `, [taskId]);
      
      const stats = result.rows[0];
      return {
        totalExecutions: parseInt(stats.total_executions) || 0,
        successfulExecutions: parseInt(stats.successful_executions) || 0,
        failedExecutions: parseInt(stats.failed_executions) || 0,
        avgDuration: parseFloat(stats.avg_duration) || 0,
        maxDuration: parseInt(stats.max_duration) || 0,
        minDuration: parseInt(stats.min_duration) || 0
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
      const result = await query(`
        SELECT 
          DATE_TRUNC('hour', started_at) as hour,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM task_executions
        WHERE started_at >= NOW() - INTERVAL '${hours} hours'
        GROUP BY hour
        ORDER BY hour DESC
      `);
      
      return result.rows.map((row: any) => ({
        hour: row.hour, // Postgres returns Date object or string depending on config
        total: parseInt(row.total) || 0,
        successful: parseInt(row.successful) || 0,
        failed: parseInt(row.failed) || 0
      }));
    } catch (e) {
      return [];
    }
  },

  // Get tasks that need attention
  getTasksNeedingAttention: async () => {
    try {
      const result = await query(`
        SELECT * FROM recurring_tasks
        WHERE is_enabled = true
        AND (
          (last_run_at IS NULL AND created_at < NOW() - INTERVAL '24 hours')
          OR
          (last_run_at < NOW() - INTERVAL '48 hours')
        )
      `);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  }
};
