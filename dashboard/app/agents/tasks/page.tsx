import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { db_queries_agents } from '@/lib/database-agents';

export const dynamic = 'force-dynamic';

// Helper to format cron schedule to human readable
function formatCronSchedule(cron: string): string {
  const patterns: Record<string, string> = {
    '0 9 * * 1-5': 'Weekdays at 9:00 AM',
    '5 16 * * 1-5': 'Weekdays at 4:05 PM',
    '0 9-16 * * 1-5': 'Hourly 9 AM-4 PM (Weekdays)',
    '0 18 * * 0': 'Sundays at 6:00 PM',
    '0 9 * * *': 'Daily at 9:00 AM',
    '0 18 * * *': 'Daily at 6:00 PM',
    '0 * * * *': 'Every hour',
    '0 8 * * *': 'Daily at 8:00 AM'
  };

  return patterns[cron] || cron;
}

export default async function RecurringTasksPage() {
  const allTasks = await db_queries_agents.getAllRecurringTasks();
  const stats = await db_queries_agents.getAgentStats();
  const tasksNeedingAttention = await db_queries_agents.getTasksNeedingAttention();

  // Group tasks by agent
  const tasksByAgent = allTasks.reduce((acc, task) => {
    if (!acc[task.agent_name]) {
      acc[task.agent_name] = [];
    }
    acc[task.agent_name].push(task);
    return acc;
  }, {} as Record<string, any[]>);

  // Pre-fetch all agent stats
  const agentNames = Object.keys(tasksByAgent);
  const agentStatsArray = await Promise.all(
    agentNames.map(name => db_queries_agents.getAgentTaskStats(name))
  );
  const agentStatsMap = new Map(agentNames.map((name, i) => [name, agentStatsArray[i]]));

  // Pre-fetch all task execution stats
  const taskStatsArray = await Promise.all(
    allTasks.map(task => db_queries_agents.getTaskExecutionStats(task.id))
  );
  const taskStatsMap = new Map(allTasks.map((task, i) => [task.id, taskStatsArray[i]]));

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to Agents
            </Link>
            <h1 className="text-3xl font-bold mt-2">📅 Recurring Tasks</h1>
            <p className="text-muted-foreground mt-1">
              Manage scheduled tasks and automation
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">TOTAL TASKS</div>
            <div className="text-3xl font-bold">{stats.totalTasks}</div>
            <div className="text-xs text-primary mt-1">
              {stats.enabledTasks} enabled
            </div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">TOTAL EXECUTIONS</div>
            <div className="text-3xl font-bold">{stats.totalExecutions}</div>
            <div className="text-xs text-muted-foreground mt-1">
              All-time runs
            </div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">SUCCESS RATE</div>
            <div className="text-3xl font-bold text-primary">
              {stats.totalExecutions > 0
                ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
                : 0}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.successfulExecutions} successful
            </div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">NEEDS ATTENTION</div>
            <div className={`text-3xl font-bold ${tasksNeedingAttention.length > 0 ? 'text-destructive' : 'text-primary'}`}>
              {tasksNeedingAttention.length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Failed or stale
            </div>
          </div>
        </div>

        {/* Tasks Needing Attention */}
        {tasksNeedingAttention.length > 0 && (
          <div className="border border-destructive bg-card p-6 mb-8">
            <h2 className="text-xl font-bold mb-4 text-destructive">⚠️ Tasks Needing Attention</h2>
            <div className="space-y-3">
              {tasksNeedingAttention.map((task) => (
                <div key={task.id} className="border border-destructive p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold">{task.task_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {task.agent_name} • {formatCronSchedule(task.cron_schedule)}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 border border-destructive text-destructive">
                      {task.last_status || 'never run'}
                    </span>
                  </div>
                  {task.last_error && (
                    <div className="text-sm text-destructive mb-2">
                      Error: {task.last_error}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Last run: {task.last_run_at ? new Date(task.last_run_at).toLocaleString() : 'Never'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks by Agent */}
        <div className="space-y-8">
          {Object.entries(tasksByAgent).map(([agentName, tasks]: [string, any]) => {
            const agentStats = agentStatsMap.get(agentName) || { totalRuns: 0, successfulRuns: 0, failedRuns: 0, totalTasks: 0, enabledTasks: 0 };
            const successRate = agentStats.totalRuns > 0
              ? Math.round((agentStats.successfulRuns / agentStats.totalRuns) * 100)
              : 0;

            return (
              <div key={agentName} className="border border-border bg-card p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold">{agentName}</h2>
                    <div className="text-sm text-muted-foreground mt-1">
                      {tasks.length} task{tasks.length !== 1 ? 's' : ''} •{' '}
                      {agentStats.totalRuns} total runs •{' '}
                      <span className={successRate >= 90 ? 'text-primary' : successRate >= 70 ? 'text-accent' : 'text-destructive'}>
                        {successRate}% success rate
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/agents/tasks/${agentName}`}
                    className="text-sm text-primary hover:underline"
                  >
                    View Details →
                  </Link>
                </div>

                <div className="space-y-3">
                  {tasks.map((task: any) => {
                    const taskStats = taskStatsMap.get(task.id) || { totalExecutions: 0, successfulExecutions: 0, failedExecutions: 0, avgDuration: 0, maxDuration: 0, minDuration: 0 };
                    const taskSuccessRate = taskStats.totalExecutions > 0
                      ? Math.round((taskStats.successfulExecutions / taskStats.totalExecutions) * 100)
                      : 0;

                    return (
                      <div key={task.id} className="border border-border p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-bold">{task.task_name}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {task.description}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <span className={`text-xs px-2 py-1 border ${
                              task.is_enabled ? 'border-primary text-primary' : 'border-border text-muted-foreground'
                            }`}>
                              {task.is_enabled ? 'enabled' : 'disabled'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-xs">
                          <div>
                            <div className="text-muted-foreground">Schedule</div>
                            <div className="font-medium">{formatCronSchedule(task.cron_schedule)}</div>
                            <div className="text-muted-foreground text-[10px]">{task.timezone}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Last Run</div>
                            <div className="font-medium">
                              {task.last_run_at
                                ? new Date(task.last_run_at).toLocaleString()
                                : 'Never'}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Total Runs</div>
                            <div className="font-medium">
                              {task.total_runs} ({task.successful_runs} ✓ / {task.failed_runs} ✗)
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Success Rate</div>
                            <div className={`font-medium ${
                              taskSuccessRate >= 90 ? 'text-primary' :
                              taskSuccessRate >= 70 ? 'text-accent' :
                              'text-destructive'
                            }`}>
                              {taskSuccessRate}%
                            </div>
                          </div>
                        </div>

                        {taskStats.avgDuration > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Avg duration: {(taskStats.avgDuration / 1000).toFixed(1)}s
                            {taskStats.maxDuration > 0 && ` • Max: ${(taskStats.maxDuration / 1000).toFixed(1)}s`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 border border-border bg-card p-6">
          <h2 className="text-xl font-bold mb-4">⚙️ Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href="/agents/executions"
              className="border border-border p-4 hover:bg-muted transition-colors text-center"
            >
              <div className="text-2xl mb-2">⚡</div>
              <div className="text-sm font-medium">View All Executions</div>
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
