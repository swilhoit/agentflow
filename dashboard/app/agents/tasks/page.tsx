import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { db_queries_agents } from '@/lib/database-agents';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Zap,
  Bot,
  Activity,
  LayoutDashboard,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

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

  const tasksByAgent = allTasks.reduce((acc: Record<string, any[]>, task: any) => {
    if (!acc[task.agent_name]) {
      acc[task.agent_name] = [];
    }
    acc[task.agent_name].push(task);
    return acc;
  }, {} as Record<string, any[]>);

  const agentNames = Object.keys(tasksByAgent);
  const agentStatsArray = await Promise.all(
    agentNames.map(name => db_queries_agents.getAgentTaskStats(name))
  );
  const agentStatsMap = new Map(agentNames.map((name, i) => [name, agentStatsArray[i]]));

  const taskStatsArray = await Promise.all(
    allTasks.map(task => db_queries_agents.getTaskExecutionStats(task.id))
  );
  const taskStatsMap = new Map(allTasks.map((task, i) => [task.id, taskStatsArray[i]]));

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" />
            Back to Agents
          </Link>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Recurring Tasks</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage scheduled tasks and automation
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">Total Tasks</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{stats.totalTasks}</div>
              <div className="text-xs text-primary mt-1">{stats.enabledTasks} enabled</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-medium">Total Executions</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{stats.totalExecutions}</div>
              <div className="text-xs text-muted-foreground mt-1">All-time runs</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-xs font-medium">Success Rate</span>
              </div>
              <div className="text-2xl font-semibold text-success tabular-nums">
                {stats.totalExecutions > 0
                  ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
                  : 0}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">{stats.successfulExecutions} successful</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <AlertTriangle className={cn("w-4 h-4", tasksNeedingAttention.length > 0 ? 'text-destructive' : '')} />
                <span className="text-xs font-medium">Needs Attention</span>
              </div>
              <div className={cn(
                "text-2xl font-semibold tabular-nums",
                tasksNeedingAttention.length > 0 ? 'text-destructive' : 'text-success'
              )}>
                {tasksNeedingAttention.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Failed or stale</div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks Needing Attention */}
        {tasksNeedingAttention.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" />
                Tasks Needing Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasksNeedingAttention.map((task) => (
                <div key={task.id} className="p-4 rounded-lg border border-destructive/30 bg-background">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-sm">{task.task_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {task.agent_name} · {formatCronSchedule(task.cron_schedule)}
                      </div>
                    </div>
                    <Badge variant="destructive">{task.last_status || 'never run'}</Badge>
                  </div>
                  {task.last_error && (
                    <div className="text-sm text-destructive mb-2">Error: {task.last_error}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Last run: {task.last_run_at ? new Date(task.last_run_at).toLocaleString() : 'Never'}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tasks by Agent */}
        <div className="space-y-6">
          {Object.entries(tasksByAgent).map(([agentName, tasks]: [string, any]) => {
            const agentStats = agentStatsMap.get(agentName) || { totalRuns: 0, successfulRuns: 0, failedRuns: 0, totalTasks: 0, enabledTasks: 0 };
            const successRate = agentStats.totalRuns > 0
              ? Math.round((agentStats.successfulRuns / agentStats.totalRuns) * 100)
              : 0;

            return (
              <Card key={agentName}>
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">{agentName}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {agentStats.totalRuns} total runs ·{' '}
                      <span className={cn(
                        successRate >= 90 ? 'text-success' : successRate >= 70 ? 'text-warning' : 'text-destructive'
                      )}>
                        {successRate}% success rate
                      </span>
                    </p>
                  </div>
                  <Link href={`/agents/tasks/${agentName}`} className="text-xs text-primary hover:underline">
                    View Details →
                  </Link>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tasks.map((task: any) => {
                    const taskStats = taskStatsMap.get(task.id) || { totalExecutions: 0, successfulExecutions: 0, failedExecutions: 0, avgDuration: 0, maxDuration: 0, minDuration: 0 };
                    const taskSuccessRate = taskStats.totalExecutions > 0
                      ? Math.round((taskStats.successfulExecutions / taskStats.totalExecutions) * 100)
                      : 0;

                    return (
                      <div key={task.id} className="p-4 rounded-lg border border-border">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{task.task_name}</div>
                            <div className="text-xs text-muted-foreground mt-1">{task.description}</div>
                          </div>
                          <Badge variant={task.is_enabled ? 'default' : 'secondary'}>
                            {task.is_enabled ? 'enabled' : 'disabled'}
                          </Badge>
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
                              {task.last_run_at ? new Date(task.last_run_at).toLocaleString() : 'Never'}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Total Runs</div>
                            <div className="font-medium tabular-nums">
                              {task.total_runs} ({task.successful_runs} ✓ / {task.failed_runs} ✗)
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Success Rate</div>
                            <div className={cn(
                              "font-medium tabular-nums",
                              taskSuccessRate >= 90 ? 'text-success' : taskSuccessRate >= 70 ? 'text-warning' : 'text-destructive'
                            )}>
                              {taskSuccessRate}%
                            </div>
                          </div>
                        </div>

                        {taskStats.avgDuration > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Avg duration: {(taskStats.avgDuration / 1000).toFixed(1)}s
                            {taskStats.maxDuration > 0 && ` · Max: ${(taskStats.maxDuration / 1000).toFixed(1)}s`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <QuickAction href="/agents/executions" icon={<Zap className="w-5 h-5" />} label="View All Executions" />
              <QuickAction href="/agents" icon={<Bot className="w-5 h-5" />} label="Back to Agents" />
              <QuickAction href="/agents/logs" icon={<Activity className="w-5 h-5" />} label="Agent Logs" />
              <QuickAction href="/" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-center group">
      <div className="flex justify-center mb-2 text-muted-foreground group-hover:text-primary transition-colors">{icon}</div>
      <p className="text-sm font-medium">{label}</p>
    </Link>
  );
}
