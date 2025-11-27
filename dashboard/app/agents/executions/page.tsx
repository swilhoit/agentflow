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
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ExecutionsPage() {
  const recentExecutions = await db_queries_agents.getRecentExecutions(100);
  const failedExecutions = await db_queries_agents.getFailedExecutions(20);
  const activityTimeline = await db_queries_agents.getActivityTimeline(24);
  const stats = await db_queries_agents.getAgentStats();

  const last24hTotal = activityTimeline.reduce((sum: number, hour: any) => sum + hour.total, 0);
  const last24hSuccessful = activityTimeline.reduce((sum: number, hour: any) => sum + hour.successful, 0);

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
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Task Execution History</h1>
              <p className="text-sm text-muted-foreground mt-1">
                View execution logs and performance metrics
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-medium">Total Executions</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{stats.totalExecutions}</div>
              <div className="text-xs text-muted-foreground mt-1">All-time</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-xs font-medium">Successful</span>
              </div>
              <div className="text-2xl font-semibold text-success tabular-nums">{stats.successfulExecutions}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.totalExecutions > 0
                  ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
                  : 0}% success rate
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <XCircle className="w-4 h-4 text-destructive" />
                <span className="text-xs font-medium">Failed</span>
              </div>
              <div className="text-2xl font-semibold text-destructive tabular-nums">{stats.failedExecutions}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.totalExecutions > 0
                  ? Math.round((stats.failedExecutions / stats.totalExecutions) * 100)
                  : 0}% failure rate
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">Last 24h</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{last24hTotal}</div>
              <div className="text-xs text-muted-foreground mt-1">{last24hSuccessful} successful</div>
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
                  const successRate = hour.total > 0 ? Math.round((hour.successful / hour.total) * 100) : 0;
                  const maxTotal = Math.max(...activityTimeline.map((h: any) => h.total));
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
                          className="bg-success h-6 rounded-l flex items-center justify-center text-xs text-white"
                          style={{ width: `${(hour.successful / maxTotal) * 100}%` }}
                        >
                          {hour.successful > 0 && hour.successful}
                        </div>
                        {hour.failed > 0 && (
                          <div
                            className="bg-destructive h-6 rounded-r flex items-center justify-center text-xs text-white"
                            style={{ width: `${(hour.failed / maxTotal) * 100}%` }}
                          >
                            {hour.failed}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground w-24 text-right tabular-nums">
                        {hour.total} runs ({successRate}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">No activity in the last 24 hours</div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Failed Executions */}
          {failedExecutions.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <XCircle className="w-4 h-4" />
                  Recent Failures
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
                {failedExecutions.map((exec: any) => (
                  <div key={exec.id} className="p-4 rounded-lg border border-destructive/30 bg-background">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{exec.task_name}</div>
                        <div className="text-xs text-muted-foreground">{exec.agent_name}</div>
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {exec.duration ? `${(exec.duration / 1000).toFixed(1)}s` : 'N/A'}
                      </div>
                    </div>
                    <div className="text-sm text-destructive mb-2 line-clamp-2">{exec.error || 'Unknown error'}</div>
                    <div className="text-xs text-muted-foreground">{new Date(exec.started_at).toLocaleString()}</div>
                  </div>
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
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
              {recentExecutions.map((exec: any) => (
                <div key={exec.id} className="p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{exec.task_name}</div>
                      <div className="text-xs text-muted-foreground">{exec.agent_name}</div>
                    </div>
                    <div className="flex gap-2 items-center">
                      {exec.duration && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {(exec.duration / 1000).toFixed(1)}s
                        </span>
                      )}
                      <Badge
                        variant={exec.status === 'success' ? 'success' : exec.status === 'failed' ? 'destructive' : 'secondary'}
                      >
                        {exec.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(exec.started_at).toLocaleString()}</div>
                  {exec.error && (
                    <div className="text-xs text-destructive mt-2 line-clamp-1">{exec.error}</div>
                  )}
                </div>
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
