import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { db_queries_agents } from '@/lib/database-agents';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Calendar,
  Activity,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  Timer,
  Wrench,
  ChevronRight,
  Circle,
  Play,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function getHealthColor(successRate: number) {
  if (successRate >= 95) return 'text-emerald-500 bg-emerald-500/10';
  if (successRate >= 80) return 'text-amber-500 bg-amber-500/10';
  if (successRate >= 50) return 'text-orange-500 bg-orange-500/10';
  return 'text-red-500 bg-red-500/10';
}

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return 'Never';
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

interface PageProps {
  params: Promise<{ agentId: string }>;
}

export default async function AgentDetailPage({ params }: PageProps) {
  const { agentId } = await params;
  const agentName = decodeURIComponent(agentId);

  // Fetch all agent data in parallel
  const [agent, tasks, agentStats, activitySummary, agentTasks, recentLogs] = await Promise.all([
    db_queries_agents.getAgent(agentName),
    db_queries_agents.getAgentRecurringTasks(agentName),
    db_queries_agents.getAgentTaskStats(agentName),
    db_queries_agents.getAgentActivitySummary(agentName),
    db_queries_agents.getAgentTasksByAgent(agentName, 20),
    db_queries_agents.getRecentAgentLogs(50)
  ]);

  // Filter logs for this agent
  const agentLogs = recentLogs.filter((log: any) => log.agent_id === agentName);

  if (!agent && tasks.length === 0) {
    notFound();
  }

  const successRate = agentStats.totalRuns > 0
    ? Math.round((agentStats.successfulRuns / agentStats.totalRuns) * 100)
    : 100;

  // Get task execution stats for each task
  const taskStatsArray = await Promise.all(
    tasks.map((task: any) => db_queries_agents.getTaskExecutionStats(task.id))
  );
  const taskStatsMap = new Map(tasks.map((task: any, i: number) => [task.id, taskStatsArray[i]]));

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="w-3 h-3" />
            Back to Agents
          </Link>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                agent?.status === 'active' ? "bg-emerald-500/10" :
                agent?.status === 'error' ? "bg-red-500/10" : "bg-gray-500/10"
              )}>
                <Bot className={cn(
                  "w-6 h-6",
                  agent?.status === 'active' ? "text-emerald-500" :
                  agent?.status === 'error' ? "text-red-500" : "text-gray-500"
                )} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold text-foreground">
                    {agent?.display_name || agentName}
                  </h1>
                  <Badge variant={agent?.status === 'active' ? 'success' : agent?.status === 'error' ? 'destructive' : 'secondary'}>
                    {agent?.status || 'unknown'}
                  </Badge>
                  <Badge variant={agent?.is_enabled ? 'default' : 'secondary'}>
                    {agent?.is_enabled ? 'enabled' : 'disabled'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {agent?.description || `${agent?.agent_type || 'Agent'} · ${agentName}`}
                </p>
              </div>
            </div>
            <Link
              href={`/agents/tasks/${agentName}`}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View Tasks <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className={cn(
            "border-l-4",
            successRate >= 90 ? "border-l-emerald-500" : successRate >= 70 ? "border-l-amber-500" : "border-l-red-500"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium">Success Rate</span>
              </div>
              <div className={cn(
                "text-3xl font-bold tabular-nums",
                successRate >= 90 ? "text-emerald-500" : successRate >= 70 ? "text-amber-500" : "text-red-500"
              )}>
                {successRate}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {agentStats.successfulRuns} / {agentStats.totalRuns} runs
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">Tasks</span>
              </div>
              <div className="text-3xl font-bold tabular-nums">{agentStats.totalTasks}</div>
              <div className="text-xs text-muted-foreground mt-1">{agentStats.enabledTasks} enabled</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium">Successful</span>
              </div>
              <div className="text-3xl font-bold tabular-nums text-emerald-500">{agentStats.successfulRuns}</div>
              <div className="text-xs text-muted-foreground mt-1">Total runs</div>
            </CardContent>
          </Card>

          <Card className={agentStats.failedRuns > 0 ? "border-l-4 border-l-red-500" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <XCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Failed</span>
              </div>
              <div className={cn(
                "text-3xl font-bold tabular-nums",
                agentStats.failedRuns > 0 ? "text-red-500" : "text-emerald-500"
              )}>
                {agentStats.failedRuns}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Errors</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-xs font-medium">24h Activity</span>
              </div>
              <div className="text-3xl font-bold tabular-nums">{activitySummary.totalExecutions}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {activitySummary.successful} ok / {activitySummary.failed} failed
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recurring Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Recurring Tasks
            </CardTitle>
            <Link href={`/agents/tasks/${agentName}`} className="text-xs text-primary hover:underline">
              View All Details
            </Link>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recurring tasks configured</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task: any) => {
                  const taskStats: any = taskStatsMap.get(task.id) || {
                    totalExecutions: 0,
                    successfulExecutions: 0,
                    failedExecutions: 0,
                    avgDuration: 0
                  };
                  const taskSuccessRate = taskStats.totalExecutions > 0
                    ? Math.round((taskStats.successfulExecutions / taskStats.totalExecutions) * 100)
                    : 100;

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "p-4 rounded-lg border border-border bg-background",
                        !task.is_enabled && "opacity-60"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Circle className={cn(
                            "w-2 h-2",
                            task.is_enabled ? "fill-emerald-500 text-emerald-500" : "fill-gray-400 text-gray-400"
                          )} />
                          <span className="font-medium text-sm">{task.task_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-semibold tabular-nums px-2 py-0.5 rounded",
                            getHealthColor(taskSuccessRate)
                          )}>
                            {taskSuccessRate}%
                          </span>
                          <Badge variant={task.is_enabled ? 'default' : 'secondary'}>
                            {task.is_enabled ? 'enabled' : 'disabled'}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{task.description}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Schedule</span>
                          <p className="font-medium">{task.cron_schedule}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Run</span>
                          <p className="font-medium">{formatTimeAgo(task.last_run_at)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Runs</span>
                          <p className="font-medium tabular-nums">
                            <span className="text-emerald-500">{task.successful_runs}</span>
                            {' / '}
                            <span className={task.failed_runs > 0 ? "text-red-500" : ""}>{task.failed_runs} failed</span>
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Duration</span>
                          <p className="font-medium tabular-nums">
                            {taskStats.avgDuration > 0 ? formatDuration(taskStats.avgDuration) : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Interactive Tasks / Conversations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Interactive Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agentTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No interactive tasks recorded</p>
              ) : (
                <div className="space-y-2">
                  {agentTasks.slice(0, 10).map((task: any, i: number) => (
                    <div
                      key={task.id || i}
                      className={cn(
                        "p-3 rounded-lg border border-border",
                        task.status === 'failed' && "bg-red-500/5 border-red-500/30",
                        task.status === 'completed' && "bg-emerald-500/5 border-emerald-500/30"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Circle className={cn(
                            "w-2 h-2",
                            task.status === 'completed' ? "fill-emerald-500 text-emerald-500" :
                            task.status === 'failed' ? "fill-red-500 text-red-500" :
                            task.status === 'running' ? "fill-amber-500 text-amber-500" :
                            "fill-gray-400 text-gray-400"
                          )} />
                          <Badge variant={
                            task.status === 'completed' ? 'success' :
                            task.status === 'failed' ? 'destructive' :
                            'secondary'
                          }>
                            {task.status}
                          </Badge>
                          {task.username && (
                            <span className="text-xs text-muted-foreground">by {task.username}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatTimeAgo(task.started_at)}</span>
                      </div>
                      <p className="text-sm line-clamp-2">{task.task_description || 'No description'}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {task.iterations && <span>{task.iterations} iterations</span>}
                        {task.tool_calls && <span>{task.tool_calls} tool calls</span>}
                      </div>
                      {task.error && (
                        <p className="text-xs text-red-500 mt-2 line-clamp-2">Error: {task.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agent Logs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Activity Logs
              </CardTitle>
              <Link href="/agents/logs" className="text-xs text-primary hover:underline">
                View All Logs
              </Link>
            </CardHeader>
            <CardContent>
              {agentLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No logs recorded for this agent</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {agentLogs.slice(0, 20).map((log: any, i: number) => (
                    <div
                      key={log.id || i}
                      className={cn(
                        "p-2 rounded text-sm",
                        log.log_type === 'error' && "bg-red-500/10 text-red-600",
                        log.log_type === 'warning' && "bg-amber-500/10 text-amber-600",
                        log.log_type === 'success' && "bg-emerald-500/10 text-emerald-600",
                        log.log_type === 'info' && "bg-blue-500/10 text-blue-600",
                        log.log_type === 'step' && "bg-purple-500/10 text-purple-600",
                        log.log_type === 'tool_call' && "bg-cyan-500/10 text-cyan-600",
                        log.log_type === 'tool_result' && "bg-teal-500/10 text-teal-600"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">
                          {log.log_type}
                        </Badge>
                        <span className="text-xs opacity-70">{formatTimeAgo(log.timestamp)}</span>
                      </div>
                      <p className="text-xs line-clamp-2">{log.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Agent Config (if available) */}
        {agent?.config && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(agent.config, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
