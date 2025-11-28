import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { db_queries_agents } from '@/lib/database-agents';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Calendar,
  Zap,
  Bot,
  LayoutDashboard,
  Settings,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AgentLogsPage() {
  const recentAgents = await db_queries_agents.getRecentExecutions(50);
  const activeAgents: any[] = [];

  const completedCount = recentAgents.filter((a: any) => a.status === 'completed' || a.status === 'success').length;
  const failedCount = recentAgents.filter((a: any) => a.status === 'failed').length;

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
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Agent Logs</h1>
              <p className="text-sm text-muted-foreground mt-1">
                View activity logs from all agent tasks
              </p>
            </div>
          </div>
        </div>

        {/* Active Agents */}
        {activeAgents.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-primary">
                <Play className="w-4 h-4" />
                Currently Running
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeAgents.map((agent: any) => {
                const startedAt = new Date(agent.started_at);
                const now = new Date();
                const durationMinutes = Math.floor((now.getTime() - startedAt.getTime()) / 1000 / 60);

                return (
                  <div key={agent.id} className="p-4 rounded-lg border border-primary/30 bg-background">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{agent.task_description}</div>
                        <div className="text-xs text-muted-foreground mt-1">Agent ID: {agent.agent_id}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="default">{agent.status}</Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {durationMinutes > 0 ? `${durationMinutes}m` : 'Just started'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Started: {startedAt.toLocaleString()} · Channel: {agent.channel_id}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Recent Agent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Recent Agent Activity
            </CardTitle>
            <span className="text-xs text-muted-foreground">Showing {recentAgents.length} most recent tasks</span>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAgents.map((agent: any) => {
              const startedAt = new Date(agent.started_at);
              const completedAt = agent.completed_at ? new Date(agent.completed_at) : null;
              const duration = completedAt
                ? Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
                : null;

              return (
                <div key={agent.id} className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{agent.task_description || agent.task_name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Agent: {agent.agent_id || agent.agent_name}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={
                          agent.status === 'completed' || agent.status === 'success' ? 'success' :
                          agent.status === 'failed' ? 'destructive' :
                          agent.status === 'running' ? 'default' : 'secondary'
                        }
                      >
                        {agent.status}
                      </Badge>
                      {duration !== null && (
                        <span className="text-xs text-muted-foreground tabular-nums">{duration}s</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-2">
                    <div>
                      <span className="font-medium">Started:</span> {startedAt.toLocaleString()}
                    </div>
                    {completedAt && (
                      <div>
                        <span className="font-medium">Completed:</span> {completedAt.toLocaleString()}
                      </div>
                    )}
                    {agent.channel_id && (
                      <div>
                        <span className="font-medium">Channel:</span> {agent.channel_id}
                      </div>
                    )}
                    {agent.user_id && (
                      <div>
                        <span className="font-medium">User:</span> {agent.user_id}
                      </div>
                    )}
                  </div>

                  {agent.error && (
                    <div className="mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/30">
                      <div className="text-xs font-medium text-destructive mb-1">Error:</div>
                      <div className="text-xs text-destructive">{agent.error}</div>
                    </div>
                  )}

                  {agent.result && (agent.status === 'completed' || agent.status === 'success') && (
                    <div className="mt-2 p-2 rounded-lg bg-success/10 border border-success/30">
                      <div className="text-xs font-medium text-success mb-1">Result:</div>
                      <div className="text-xs text-foreground line-clamp-3">
                        {typeof agent.result === 'string' ? agent.result : JSON.stringify(agent.result, null, 2)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">Total Tasks</div>
                <div className="text-2xl font-semibold tabular-nums">{recentAgents.length}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">Completed</div>
                <div className="text-2xl font-semibold text-success tabular-nums">{completedCount}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">Failed</div>
                <div className="text-2xl font-semibold text-destructive tabular-nums">{failedCount}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">Running</div>
                <div className="text-2xl font-semibold tabular-nums">{activeAgents.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

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
              <QuickAction href="/agents/executions" icon={<Zap className="w-5 h-5" />} label="Task Executions" />
              <QuickAction href="/agents" icon={<Bot className="w-5 h-5" />} label="Back to Agents" />
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
