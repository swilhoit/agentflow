import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { db_queries_agents } from '@/lib/database-agents';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Calendar,
  Bot,
  Activity,
  LayoutDashboard,
  Settings,
  BarChart3,
  AlertTriangle,
  ChevronRight,
  Timer,
  TrendingUp,
  Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return 'Unknown';
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

function getSuccessRateColor(rate: number) {
  if (rate >= 95) return 'text-emerald-500';
  if (rate >= 80) return 'text-amber-500';
  if (rate >= 50) return 'text-orange-500';
  return 'text-red-500';
}

export default async function ExecutionsPage() {
  const recentExecutions = await db_queries_agents.getRecentExecutions(100);
  const failedExecutions = await db_queries_agents.getFailedExecutions(20);
  const activityTimeline = await db_queries_agents.getActivityTimeline(24);
  const stats = await db_queries_agents.getAgentStats();

  const last24hTotal = activityTimeline.reduce((sum: number, hour: any) => sum + hour.total, 0);
  const last24hSuccessful = activityTimeline.reduce((sum: number, hour: any) => sum + hour.successful, 0);
  const last24hFailed = activityTimeline.reduce((sum: number, hour: any) => sum + hour.failed, 0);
  const last24hSuccessRate = last24hTotal > 0 ? Math.round((last24hSuccessful / last24hTotal) * 100) : 100;
  const overallSuccessRate = stats.totalExecutions > 0
    ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
    : 100;

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
            <div className={cn(
              "p-2 rounded-lg",
              overallSuccessRate >= 90 ? "bg-emerald-500/10" : overallSuccessRate >= 70 ? "bg-amber-500/10" : "bg-red-500/10"
            )}>
              <Zap className={cn(
                "w-6 h-6",
                overallSuccessRate >= 90 ? "text-emerald-500" : overallSuccessRate >= 70 ? "text-amber-500" : "text-red-500"
              )} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Execution History</h1>
              <p className="text-sm text-muted-foreground mt-1">
                View execution logs, performance metrics, and drill-down details
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className={cn(
            "border-l-4",
            overallSuccessRate >= 90 ? "border-l-emerald-500" : overallSuccessRate >= 70 ? "border-l-amber-500" : "border-l-red-500"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium">Success Rate</span>
              </div>
              <div className={cn("text-3xl font-bold tabular-nums", getSuccessRateColor(overallSuccessRate))}>
                {overallSuccessRate}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">All-time</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-medium">Total Executions</span>
              </div>
              <div className="text-3xl font-bold tabular-nums">{stats.totalExecutions}</div>
              <div className="text-xs text-muted-foreground mt-1">All-time</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium">Successful</span>
              </div>
              <div className="text-3xl font-bold text-emerald-500 tabular-nums">{stats.successfulExecutions}</div>
              <div className="text-xs text-muted-foreground mt-1">Completed successfully</div>
            </CardContent>
          </Card>

          <Card className={stats.failedExecutions > 0 ? "border-l-4 border-l-red-500" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <XCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Failed</span>
              </div>
              <div className={cn(
                "text-3xl font-bold tabular-nums",
                stats.failedExecutions > 0 ? "text-red-500" : "text-emerald-500"
              )}>
                {stats.failedExecutions}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.totalExecutions > 0
                  ? Math.round((stats.failedExecutions / stats.totalExecutions) * 100)
                  : 0}% failure rate
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "border-l-4",
            last24hSuccessRate >= 90 ? "border-l-emerald-500" : last24hSuccessRate >= 70 ? "border-l-amber-500" : "border-l-red-500"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">Last 24h</span>
              </div>
              <div className="text-3xl font-bold tabular-nums">{last24hTotal}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-emerald-500 tabular-nums">{last24hSuccessful} ok</span>
                {last24hFailed > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">/</span>
                    <span className="text-xs text-red-500 tabular-nums">{last24hFailed} failed</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Activity Timeline (Last 24 Hours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityTimeline.length > 0 ? (
              <div className="space-y-2">
                {activityTimeline.map((hour: any) => {
                  const successRate = hour.total > 0 ? Math.round((hour.successful / hour.total) * 100) : 100;
                  const maxTotal = Math.max(...activityTimeline.map((h: any) => h.total), 1);
                  const barWidth = Math.max((hour.total / maxTotal) * 100, hour.total > 0 ? 5 : 0);

                  return (
                    <div key={hour.hour} className="flex items-center gap-4">
                      <div className="text-xs text-muted-foreground w-32 tabular-nums">
                        {new Date(hour.hour).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          hour12: true
                        })}
                      </div>
                      <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden">
                        <div className="flex h-full" style={{ width: `${barWidth}%` }}>
                          {hour.successful > 0 && (
                            <div
                              className="bg-emerald-500 h-full flex items-center justify-center text-xs text-white font-medium"
                              style={{ width: `${(hour.successful / hour.total) * 100}%` }}
                            >
                              {hour.successful > 2 && hour.successful}
                            </div>
                          )}
                          {hour.failed > 0 && (
                            <div
                              className="bg-red-500 h-full flex items-center justify-center text-xs text-white font-medium"
                              style={{ width: `${(hour.failed / hour.total) * 100}%` }}
                            >
                              {hour.failed > 2 && hour.failed}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={cn(
                        "text-xs w-20 text-right tabular-nums font-medium px-2 py-0.5 rounded",
                        hour.total === 0 ? "text-muted-foreground" :
                        successRate >= 90 ? "text-emerald-600 bg-emerald-500/10" :
                        successRate >= 70 ? "text-amber-600 bg-amber-500/10" :
                        "text-red-600 bg-red-500/10"
                      )}>
                        {hour.total > 0 ? `${successRate}%` : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No activity in the last 24 hours</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Failed Executions */}
          {failedExecutions.length > 0 && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-red-500">
                  <AlertTriangle className="w-4 h-4" />
                  Recent Failures
                  <Badge variant="destructive" className="ml-2">{failedExecutions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                {failedExecutions.map((exec: any) => (
                  <Link
                    key={exec.id}
                    href={`/agents/executions/${exec.id}`}
                    className="block p-4 rounded-lg border border-red-500/30 bg-background hover:bg-red-500/5 transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Circle className="w-2 h-2 fill-red-500 text-red-500" />
                          <span className="font-medium text-sm">{exec.task_name}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{exec.agent_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {exec.duration ? formatDuration(exec.duration) : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimeAgo(exec.started_at)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-red-600 line-clamp-2 mt-2 p-2 bg-red-500/10 rounded">
                      {exec.error || 'Unknown error'}
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* All Recent Executions */}
          <Card className={failedExecutions.length === 0 ? 'lg:col-span-2' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4" />
                All Recent Executions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
              {recentExecutions.map((exec: any) => (
                <Link
                  key={exec.id}
                  href={`/agents/executions/${exec.id}`}
                  className={cn(
                    "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors hover:bg-muted/50 group",
                    exec.status === 'failed' && "bg-red-500/5"
                  )}
                >
                  <Circle className={cn(
                    "w-2 h-2 shrink-0",
                    exec.status === 'success' ? "fill-emerald-500 text-emerald-500" :
                    exec.status === 'failed' ? "fill-red-500 text-red-500" :
                    "fill-gray-400 text-gray-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{exec.task_name}</span>
                      {exec.status === 'failed' && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{exec.agent_name}</span>
                      <span>·</span>
                      <span>{formatTimeAgo(exec.started_at)}</span>
                      {exec.duration && (
                        <>
                          <span>·</span>
                          <span className="tabular-nums">{formatDuration(exec.duration)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={exec.status === 'success' ? 'success' : exec.status === 'failed' ? 'destructive' : 'secondary'}
                    >
                      {exec.status}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
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
              <QuickAction href="/agents/tasks" icon={<Calendar className="w-5 h-5" />} label="Recurring Tasks" />
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
