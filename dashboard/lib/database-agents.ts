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
  },

  // ============================================
  // DETAILED LOGS & CONVERSATIONS
  // ============================================

  // Get all agent tasks (interactive tasks, not recurring)
  getAllAgentTasks: async (limit: number = 100) => {
    try {
      const result = await query(`
        SELECT * FROM agent_tasks
        ORDER BY started_at DESC
        LIMIT $1
      `, [limit]);
      return result.rows || [];
    } catch (e) {
      console.warn('Agent tasks query failed:', e);
      return [];
    }
  },

  // Get agent tasks by agent name
  getAgentTasksByAgent: async (agentId: string, limit: number = 50) => {
    try {
      const result = await query(`
        SELECT * FROM agent_tasks
        WHERE agent_id = $1
        ORDER BY started_at DESC
        LIMIT $2
      `, [agentId, limit]);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get single agent task with full details
  getAgentTask: async (taskId: string) => {
    try {
      const result = await query(`
        SELECT * FROM agent_tasks WHERE id = $1
      `, [taskId]);
      return result.rows[0] || null;
    } catch (e) {
      return null;
    }
  },

  // Get agent logs for a specific task
  getAgentLogs: async (taskId: string) => {
    try {
      const result = await query(`
        SELECT * FROM agent_logs
        WHERE task_id = $1
        ORDER BY timestamp ASC
      `, [taskId]);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get recent agent logs across all tasks
  getRecentAgentLogs: async (limit: number = 200) => {
    try {
      const result = await query(`
        SELECT * FROM agent_logs
        ORDER BY timestamp DESC
        LIMIT $1
      `, [limit]);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get agent logs by type
  getAgentLogsByType: async (logType: string, limit: number = 100) => {
    try {
      const result = await query(`
        SELECT * FROM agent_logs
        WHERE log_type = $1
        ORDER BY timestamp DESC
        LIMIT $2
      `, [logType, limit]);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get tool executions for a task
  getToolExecutions: async (taskId: string) => {
    try {
      const result = await query(`
        SELECT * FROM tool_executions
        WHERE task_id = $1
        ORDER BY timestamp ASC
      `, [taskId]);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get recent tool executions across all tasks
  getRecentToolExecutions: async (limit: number = 100) => {
    try {
      const result = await query(`
        SELECT * FROM tool_executions
        ORDER BY timestamp DESC
        LIMIT $1
      `, [limit]);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get all conversations
  getAllConversations: async (limit: number = 100) => {
    try {
      const result = await query(`
        SELECT * FROM conversations
        ORDER BY timestamp DESC
        LIMIT $1
      `, [limit]);
      return result.rows || [];
    } catch (e) {
      console.warn('Conversations query failed:', e);
      return [];
    }
  },

  // Get conversations by channel
  getConversationsByChannel: async (channelId: string, limit: number = 100) => {
    try {
      const result = await query(`
        SELECT * FROM conversations
        WHERE channel_id = $1
        ORDER BY timestamp DESC
        LIMIT $2
      `, [channelId, limit]);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get conversation thread (messages grouped by context)
  getConversationThread: async (channelId: string, startTime: Date, endTime: Date) => {
    try {
      const result = await query(`
        SELECT * FROM conversations
        WHERE channel_id = $1
        AND timestamp BETWEEN $2 AND $3
        ORDER BY timestamp ASC
      `, [channelId, startTime, endTime]);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get agent health summary (combines multiple data sources)
  getAgentHealthSummary: async () => {
    try {
      const agentsResult = await query(`
        SELECT
          ac.agent_name,
          ac.display_name,
          ac.status,
          ac.is_enabled,
          ac.last_active_at,
          ac.agent_type,
          COUNT(DISTINCT rt.id) as task_count,
          COALESCE(SUM(rt.total_runs), 0) as total_runs,
          COALESCE(SUM(rt.successful_runs), 0) as successful_runs,
          COALESCE(SUM(rt.failed_runs), 0) as failed_runs
        FROM agent_configs ac
        LEFT JOIN recurring_tasks rt ON ac.agent_name = rt.agent_name
        GROUP BY ac.id, ac.agent_name, ac.display_name, ac.status, ac.is_enabled, ac.last_active_at, ac.agent_type
        ORDER BY ac.agent_type, ac.display_name
      `);

      return agentsResult.rows.map((row: any) => ({
        agentName: row.agent_name,
        displayName: row.display_name,
        status: row.status,
        isEnabled: row.is_enabled,
        lastActiveAt: row.last_active_at,
        agentType: row.agent_type,
        taskCount: parseInt(row.task_count) || 0,
        totalRuns: parseInt(row.total_runs) || 0,
        successfulRuns: parseInt(row.successful_runs) || 0,
        failedRuns: parseInt(row.failed_runs) || 0,
        successRate: row.total_runs > 0
          ? Math.round((parseInt(row.successful_runs) / parseInt(row.total_runs)) * 100)
          : 0
      }));
    } catch (e) {
      console.warn('Agent health summary query failed:', e);
      return [];
    }
  },

  // Get execution by ID with full details
  getExecutionById: async (executionId: string) => {
    try {
      const result = await query(`
        SELECT * FROM task_executions WHERE id = $1
      `, [executionId]);
      return result.rows[0] || null;
    } catch (e) {
      return null;
    }
  },

  // Get agent activity summary (last 24h)
  getAgentActivitySummary: async (agentName: string) => {
    try {
      const result = await query(`
        SELECT
          COUNT(*) as total_executions,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          AVG(duration) as avg_duration,
          MAX(started_at) as last_execution
        FROM task_executions
        WHERE agent_name = $1
        AND started_at >= NOW() - INTERVAL '24 hours'
      `, [agentName]);

      const stats = result.rows[0];
      return {
        totalExecutions: parseInt(stats.total_executions) || 0,
        successful: parseInt(stats.successful) || 0,
        failed: parseInt(stats.failed) || 0,
        avgDuration: parseFloat(stats.avg_duration) || 0,
        lastExecution: stats.last_execution
      };
    } catch (e) {
      return {
        totalExecutions: 0,
        successful: 0,
        failed: 0,
        avgDuration: 0,
        lastExecution: null
      };
    }
  },

  // Get error logs (for debugging)
  getErrorLogs: async (limit: number = 50) => {
    try {
      const result = await query(`
        SELECT * FROM agent_logs
        WHERE log_type IN ('error', 'warning')
        ORDER BY timestamp DESC
        LIMIT $1
      `, [limit]);
      return result.rows || [];
    } catch (e) {
      return [];
    }
  },

  // Get tool usage statistics
  getToolUsageStats: async () => {
    try {
      const result = await query(`
        SELECT
          tool_name,
          COUNT(*) as total_calls,
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_calls,
          SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed_calls,
          AVG(duration_ms) as avg_duration
        FROM tool_executions
        GROUP BY tool_name
        ORDER BY total_calls DESC
      `);

      return result.rows.map((row: any) => ({
        toolName: row.tool_name,
        totalCalls: parseInt(row.total_calls) || 0,
        successfulCalls: parseInt(row.successful_calls) || 0,
        failedCalls: parseInt(row.failed_calls) || 0,
        avgDuration: parseFloat(row.avg_duration) || 0,
        successRate: row.total_calls > 0
          ? Math.round((parseInt(row.successful_calls) / parseInt(row.total_calls)) * 100)
          : 0
      }));
    } catch (e) {
      return [];
    }
  }
};
