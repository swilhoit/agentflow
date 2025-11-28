import { NextRequest, NextResponse } from 'next/server';
import { db_queries_agents } from '@/lib/database-agents';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

// GET /api/diagnostics - Get comprehensive system diagnostics
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Run all diagnostic checks in parallel
    const [
      agentHealth,
      agentStats,
      recentExecutions,
      failedExecutions,
      tasksNeedingAttention,
      activityTimeline,
      errorLogs,
      toolStats,
      dbHealth,
      serviceHealth
    ] = await Promise.all([
      db_queries_agents.getAgentHealthSummary(),
      db_queries_agents.getAgentStats(),
      db_queries_agents.getRecentExecutions(20),
      db_queries_agents.getFailedExecutions(10),
      db_queries_agents.getTasksNeedingAttention(),
      db_queries_agents.getActivityTimeline(24),
      db_queries_agents.getErrorLogs(10),
      db_queries_agents.getToolUsageStats(),
      checkDatabaseHealth(),
      checkServiceHealth()
    ]);

    // Calculate overall system health
    const totalAgents = agentHealth.length;
    const healthyAgents = agentHealth.filter((a: any) => a.status === 'active' && a.successRate >= 80).length;
    const criticalAgents = agentHealth.filter((a: any) => a.status === 'error' || a.successRate < 50).length;

    const overallSuccessRate = agentStats.totalExecutions > 0
      ? Math.round((agentStats.successfulExecutions / agentStats.totalExecutions) * 100)
      : 100;

    // Calculate system health score (0-100)
    let healthScore = 100;

    // Deduct points for various issues
    if (criticalAgents > 0) healthScore -= criticalAgents * 15;
    if (overallSuccessRate < 95) healthScore -= (95 - overallSuccessRate);
    if (tasksNeedingAttention.length > 0) healthScore -= tasksNeedingAttention.length * 5;
    if (errorLogs.length > 5) healthScore -= (errorLogs.length - 5) * 2;
    if (!dbHealth.connected) healthScore -= 30;

    healthScore = Math.max(0, Math.min(100, healthScore));

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      responseTime,

      // Overall System Health
      systemHealth: {
        score: healthScore,
        status: healthScore >= 90 ? 'healthy' : healthScore >= 70 ? 'degraded' : 'critical',
        overallSuccessRate,
        totalAgents,
        healthyAgents,
        criticalAgents,
        tasksNeedingAttention: tasksNeedingAttention.length
      },

      // Agent Statistics
      agentStats: {
        ...agentStats,
        agents: agentHealth
      },

      // Service Connectivity
      services: {
        database: dbHealth,
        ...serviceHealth
      },

      // Recent Activity
      activity: {
        timeline: activityTimeline,
        recentExecutions,
        failedExecutions,
        tasksNeedingAttention
      },

      // Error Tracking
      errors: {
        recent: errorLogs,
        count24h: errorLogs.length
      },

      // Tool Performance
      toolStats
    });
  } catch (error: any) {
    console.error('Diagnostics error:', error);
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      systemHealth: {
        score: 0,
        status: 'critical',
        error: error.message
      },
      error: 'Failed to fetch diagnostics',
      details: error.message
    }, { status: 500 });
  }
}

// Check database health
async function checkDatabaseHealth() {
  try {
    const start = Date.now();
    const result = await query('SELECT 1 as health_check, NOW() as server_time');
    const latency = Date.now() - start;

    // Get table counts
    const tableCounts = await query(`
      SELECT
        (SELECT COUNT(*) FROM agent_configs) as agents,
        (SELECT COUNT(*) FROM recurring_tasks) as tasks,
        (SELECT COUNT(*) FROM task_executions) as executions,
        (SELECT COUNT(*) FROM conversations) as conversations,
        (SELECT COUNT(*) FROM agent_logs) as logs
    `);

    const counts = tableCounts.rows[0] || {};

    return {
      connected: true,
      latency,
      serverTime: result.rows[0]?.server_time,
      tables: {
        agents: parseInt(counts.agents) || 0,
        tasks: parseInt(counts.tasks) || 0,
        executions: parseInt(counts.executions) || 0,
        conversations: parseInt(counts.conversations) || 0,
        logs: parseInt(counts.logs) || 0
      }
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message,
      latency: null,
      tables: null
    };
  }
}

// Check external service health
async function checkServiceHealth() {
  const services: Record<string, any> = {};

  // Check Discord API (via environment variable presence)
  services.discord = {
    configured: !!process.env.DISCORD_TOKEN || !!process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID,
    status: 'configured'
  };

  // Check Supabase
  services.supabase = {
    configured: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY,
    status: process.env.SUPABASE_URL ? 'configured' : 'not_configured'
  };

  // Check OpenAI
  services.openai = {
    configured: !!process.env.OPENAI_API_KEY,
    status: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured'
  };

  // Check Anthropic
  services.anthropic = {
    configured: !!process.env.ANTHROPIC_API_KEY,
    status: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured'
  };

  // Check Vercel
  services.vercel = {
    configured: !!process.env.VERCEL_TOKEN,
    status: process.env.VERCEL_TOKEN ? 'configured' : 'not_configured'
  };

  // Check Alpaca Trading
  services.alpaca = {
    configured: !!process.env.ALPACA_API_KEY && !!process.env.ALPACA_SECRET_KEY,
    status: (process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY) ? 'configured' : 'not_configured'
  };

  // Check Teller (Banking)
  services.teller = {
    configured: !!process.env.TELLER_APPLICATION_ID,
    status: process.env.TELLER_APPLICATION_ID ? 'configured' : 'not_configured'
  };

  return services;
}
