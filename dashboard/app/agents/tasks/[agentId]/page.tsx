import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { db_queries_agents } from '@/lib/database-agents';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Zap,
  Bot,
  Activity,
  Timer,
  TrendingUp,
  Play
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

interface PageProps {
  params: Promise<{ agentId: string }>;
}

export default async function AgentTasksDetailPage({ params }: PageProps) {
  const { agentId } = await params;
  const agentName = decodeURIComponent(agentId);

  // Fetch agent data
  const agent = await db_queries_agents.getAgent(agentName);
  const tasks = await db_queries_agents.getAgentRecurringTasks(agentName);
  const agentStats = await db_queries_agents.getAgentTaskStats(agentName);

  // If no tasks found for this agent, show not found
  if (tasks.length === 0 && !agent) {
    notFound();
  }

  // Fetch execution history for each task
  const taskExecutionsArray = await Promise.all(
    tasks.map((task: any) => db_queries_agents.getTaskExecutions(task.id, 20))
  );
  const taskExecutionsMap = new Map<string, any[]>(tasks.map((task: any, i: number) => [task.id, taskExecutionsArray[i]]));

  // Fetch execution stats for each task
  const taskStatsArray = await Promise.all(
    tasks.map((task: any) => db_queries_agents.getTaskExecutionStats(task.id))
  );
  const taskStatsMap = new Map<string, any>(tasks.map((task: any, i: number) => [task.id, taskStatsArray[i]]));

  const successRate = agentStats.totalRuns > 0
    ? Math.round((agentStats.successfulRuns / agentStats.totalRuns) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <Link href="/agents/tasks" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" />
            Back to All Tasks
          </Link>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{agentName}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {agent?.description || `${tasks.length} recurring task${tasks.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>

        {/* Agent Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">Tasks</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{agentStats.totalTasks}</div>
              <div className="text-xs text-primary mt-1">{agentStats.enabledTasks} enabled</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-medium">Total Runs</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{agentStats.totalRuns}</div>
              <div className="text-xs text-muted-foreground mt-1">All-time</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-xs font-medium">Successful</span>
              </div>
              <div className="text-2xl font-semibold text-success tabular-nums">{agentStats.successfulRuns}</div>
              <div className="text-xs text-muted-foreground mt-1">Completed</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <XCircle className="w-4 h-4 text-destructive" />
                <span className="text-xs font-medium">Failed</span>
              </div>
              <div className="text-2xl font-semibold text-destructive tabular-nums">{agentStats.failedRuns}</div>
              <div className="text-xs text-muted-foreground mt-1">Errors</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium">Success Rate</span>
              </div>
              <div className={cn(
                "text-2xl font-semibold tabular-nums",
                successRate >= 90 ? 'text-success' : successRate >= 70 ? 'text-warning' : 'text-destructive'
              )}>
                {successRate}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Overall</div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks with Execution History */}
        <div className="space-y-6">
          {tasks.map((task: any) => {
            const executions: any[] = taskExecutionsMap.get(task.id) || [];
            const taskStats: any = taskStatsMap.get(task.id) || {
              totalExecutions: 0,
              successfulExecutions: 0,
              failedExecutions: 0,
              avgDuration: 0
            };
            const taskSuccessRate = taskStats.totalExecutions > 0
              ? Math.round((taskStats.successfulExecutions / taskStats.totalExecutions) * 100)
              : 0;

            return (
              <Card key={task.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Play className="w-4 h-4 text-primary" />
                        {task.task_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                    </div>
                    <Badge variant={task.is_enabled ? 'default' : 'secondary'}>
                      {task.is_enabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Task Info */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs">Schedule</span>
                      </div>
                      <div className="font-medium">{formatCronSchedule(task.cron_schedule)}</div>
                      <div className="text-xs text-muted-foreground">{task.timezone}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Activity className="w-3.5 h-3.5" />
                        <span className="text-xs">Last Run</span>
                      </div>
                      <div className="font-medium">
                        {task.last_run_at ? formatTimeAgo(task.last_run_at) : 'Never'}
                      </div>
                      {task.last_run_at && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(task.last_run_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Zap className="w-3.5 h-3.5" />
                        <span className="text-xs">Total Runs</span>
                      </div>
                      <div className="font-medium tabular-nums">{task.total_runs}</div>
                      <div className="text-xs text-muted-foreground">
                        {task.successful_runs} success / {task.failed_runs} failed
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Timer className="w-3.5 h-3.5" />
                        <span className="text-xs">Avg Duration</span>
                      </div>
                      <div className="font-medium tabular-nums">
                        {taskStats.avgDuration > 0 ? formatDuration(taskStats.avgDuration) : 'N/A'}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="text-xs">Success Rate</span>
                      </div>
                      <div className={cn(
                        "font-medium tabular-nums",
                        taskSuccessRate >= 90 ? 'text-success' : taskSuccessRate >= 70 ? 'text-warning' : 'text-destructive'
                      )}>
                        {taskSuccessRate}%
                      </div>
                    </div>
                  </div>

                  {/* Execution History */}
                  {executions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Recent Executions
                      </h4>
                      <div className="space-y-2">
                        {executions.slice(0, 10).map((execution: any) => (
                          <div
                            key={execution.id}
                            className={cn(
                              "p-3 rounded-lg border text-sm",
                              execution.status === 'success'
                                ? 'border-success/30 bg-success/5'
                                : execution.status === 'failed'
                                ? 'border-destructive/30 bg-destructive/5'
                                : 'border-border bg-muted/30'
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {execution.status === 'success' ? (
                                  <CheckCircle className="w-4 h-4 text-success" />
                                ) : execution.status === 'failed' ? (
                                  <XCircle className="w-4 h-4 text-destructive" />
                                ) : (
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                )}
                                <Badge
                                  variant={execution.status === 'success' ? 'default' : execution.status === 'failed' ? 'destructive' : 'secondary'}
                                  className="text-xs"
                                >
                                  {execution.status}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatTimeAgo(execution.started_at)}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                              <span>Started: {new Date(execution.started_at).toLocaleString()}</span>
                              {execution.duration && (
                                <span>Duration: {formatDuration(execution.duration)}</span>
                              )}
                            </div>
                            {execution.error_message && (
                              <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
                                {execution.error_message}
                              </div>
                            )}
                            {execution.result && (
                              <div className="mt-2 p-2 rounded bg-muted text-xs font-mono overflow-x-auto">
                                <pre className="whitespace-pre-wrap break-words">
                                  {typeof execution.result === 'string'
                                    ? execution.result.substring(0, 500)
                                    : JSON.stringify(execution.result, null, 2).substring(0, 500)}
                                  {(typeof execution.result === 'string' ? execution.result.length : JSON.stringify(execution.result).length) > 500 && '...'}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {executions.length > 10 && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Showing 10 of {executions.length} recent executions
                        </p>
                      )}
                    </div>
                  )}

                  {executions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No executions recorded yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {tasks.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No tasks found for this agent</p>
              <Link href="/agents/tasks" className="text-primary hover:underline text-sm mt-2 inline-block">
                View all tasks
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
