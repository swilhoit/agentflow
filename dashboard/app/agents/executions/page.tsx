import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { db_queries_agents } from '@/lib/database-agents';

export const dynamic = 'force-dynamic';

export default async function ExecutionsPage() {
  const recentExecutions = await db_queries_agents.getRecentExecutions(100);
  const failedExecutions = await db_queries_agents.getFailedExecutions(20);
  const activityTimeline = await db_queries_agents.getActivityTimeline(24);
  const stats = await db_queries_agents.getAgentStats();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to Agents
            </Link>
            <h1 className="text-3xl font-bold mt-2">⚡ Task Execution History</h1>
            <p className="text-muted-foreground mt-1">
              View execution logs and performance metrics
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">TOTAL EXECUTIONS</div>
            <div className="text-3xl font-bold">{stats.totalExecutions}</div>
            <div className="text-xs text-muted-foreground mt-1">All-time</div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">SUCCESSFUL</div>
            <div className="text-3xl font-bold text-primary">{stats.successfulExecutions}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.totalExecutions > 0
                ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
                : 0}% success rate
            </div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">FAILED</div>
            <div className="text-3xl font-bold text-destructive">{stats.failedExecutions}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.totalExecutions > 0
                ? Math.round((stats.failedExecutions / stats.totalExecutions) * 100)
                : 0}% failure rate
            </div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">LAST 24H</div>
            <div className="text-3xl font-bold">
              {activityTimeline.reduce((sum: number, hour: any) => sum + hour.total, 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {activityTimeline.reduce((sum: number, hour: any) => sum + hour.successful, 0)} successful
            </div>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="border border-border bg-card p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">📊 Activity Timeline (Last 24 Hours)</h2>
          <div className="space-y-2">
            {activityTimeline.length > 0 ? (
              activityTimeline.map((hour: any) => {
                const successRate = hour.total > 0 ? Math.round((hour.successful / hour.total) * 100) : 0;
                return (
                  <div key={hour.hour} className="flex items-center gap-4">
                    <div className="text-xs text-muted-foreground w-32">
                      {new Date(hour.hour).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        hour12: true
                      })}
                    </div>
                    <div className="flex-1 flex gap-1">
                      <div
                        className="bg-primary h-6 flex items-center justify-center text-xs text-primary-foreground"
                        style={{ width: `${(hour.successful / Math.max(...activityTimeline.map((h: any) => h.total))) * 100}%` }}
                      >
                        {hour.successful > 0 && hour.successful}
                      </div>
                      {hour.failed > 0 && (
                        <div
                          className="bg-destructive h-6 flex items-center justify-center text-xs text-destructive-foreground"
                          style={{ width: `${(hour.failed / Math.max(...activityTimeline.map((h: any) => h.total))) * 100}%` }}
                        >
                          {hour.failed}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground w-20 text-right">
                      {hour.total} runs ({successRate}%)
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No activity in the last 24 hours
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Failed Executions */}
          {failedExecutions.length > 0 && (
            <div className="border border-destructive bg-card p-6">
              <h2 className="text-xl font-bold mb-4 text-destructive">❌ Recent Failures</h2>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {failedExecutions.map((exec: any) => (
                  <div key={exec.id} className="border border-destructive p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-bold">{exec.task_name}</div>
                        <div className="text-xs text-muted-foreground">{exec.agent_name}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {exec.duration ? `${(exec.duration / 1000).toFixed(1)}s` : 'N/A'}
                      </div>
                    </div>
                    <div className="text-sm text-destructive mb-2 line-clamp-2">
                      {exec.error || 'Unknown error'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(exec.started_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Recent Executions */}
          <div className="border border-border bg-card p-6">
            <h2 className="text-xl font-bold mb-4">⚡ All Recent Executions</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {recentExecutions.map((exec: any) => (
                <div key={exec.id} className="border border-border p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{exec.task_name}</div>
                      <div className="text-xs text-muted-foreground">{exec.agent_name}</div>
                    </div>
                    <div className="flex gap-2 items-center">
                      {exec.duration && (
                        <span className="text-xs text-muted-foreground">
                          {(exec.duration / 1000).toFixed(1)}s
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 border ${
                        exec.status === 'success' ? 'border-primary text-primary' :
                        exec.status === 'failed' ? 'border-destructive text-destructive' :
                        'border-border text-muted-foreground'
                      }`}>
                        {exec.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(exec.started_at).toLocaleString()}
                  </div>
                  {exec.error && (
                    <div className="text-xs text-destructive mt-2 line-clamp-1">
                      {exec.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 border border-border bg-card p-6">
          <h2 className="text-xl font-bold mb-4">⚙️ Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href="/agents/tasks"
              className="border border-border p-4 hover:bg-muted transition-colors text-center"
            >
              <div className="text-2xl mb-2">📅</div>
              <div className="text-sm font-medium">Recurring Tasks</div>
            </Link>
            <Link
              href="/agents"
              className="border border-border p-4 hover:bg-muted transition-colors text-center"
            >
              <div className="text-2xl mb-2">🤖</div>
              <div className="text-sm font-medium">Back to Agents</div>
            </Link>
            <Link
              href="/agents/logs"
              className="border border-border p-4 hover:bg-muted transition-colors text-center"
            >
              <div className="text-2xl mb-2">📋</div>
              <div className="text-sm font-medium">Agent Logs</div>
            </Link>
            <Link
              href="/dashboard"
              className="border border-border p-4 hover:bg-muted transition-colors text-center"
            >
              <div className="text-2xl mb-2">📊</div>
              <div className="text-sm font-medium">Dashboard</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
