import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { db_queries_agents } from '@/lib/database-agents';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Calendar,
  Activity,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const agents = await db_queries_agents.getAllAgents();
  const stats = await db_queries_agents.getAgentStats();
  const recentExecutions = await db_queries_agents.getRecentExecutions(10);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Agent Manager</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage all agents and recurring tasks in your system
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Bot className="w-4 h-4" />
                <span className="text-xs font-medium">Total Agents</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{agents.length}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {agents.filter((a: any) => a.is_enabled).length} active
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">Total Tasks</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{stats.totalTasks}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.enabledTasks} enabled
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-xs font-medium">Success Rate</span>
              </div>
              <div className={cn(
                "text-2xl font-semibold tabular-nums",
                stats.successfulExecutions / stats.totalExecutions > 0.9 ? 'text-success' : ''
              )}>
                {stats.totalExecutions > 0
                  ? `${Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)}%`
                  : '0%'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.successfulExecutions}/{stats.totalExecutions} runs
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <XCircle className="w-4 h-4 text-destructive" />
                <span className="text-xs font-medium">Failed Runs</span>
              </div>
              <div className={cn(
                "text-2xl font-semibold tabular-nums",
                stats.failedExecutions > 0 ? 'text-destructive' : ''
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agents List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Agents
              </CardTitle>
              <Link href="/agents/manage" className="text-xs text-primary hover:underline flex items-center gap-1">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {agents.map((agent: any) => (
                <div key={agent.id} className="p-4 rounded-lg border border-border bg-background">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-sm">{agent.display_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {agent.agent_type} · {agent.agent_name}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge
                        variant={agent.status === 'active' ? 'success' : agent.status === 'error' ? 'destructive' : 'secondary'}
                      >
                        {agent.status}
                      </Badge>
                      <Badge variant={agent.is_enabled ? 'default' : 'secondary'}>
                        {agent.is_enabled ? 'enabled' : 'disabled'}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {agent.description}
                  </p>
                  {agent.last_active_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Last active: {new Date(agent.last_active_at).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Executions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Recent Executions
              </CardTitle>
              <Link href="/agents/executions" className="text-xs text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentExecutions.map((exec: any) => (
                <div key={exec.id} className="py-3 border-b border-border/50 last:border-0">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{exec.task_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {exec.agent_name} · {exec.duration ? `${(exec.duration / 1000).toFixed(1)}s` : 'N/A'}
                      </p>
                    </div>
                    <Badge
                      variant={exec.status === 'success' ? 'success' : exec.status === 'failed' ? 'destructive' : 'secondary'}
                    >
                      {exec.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(exec.started_at).toLocaleString()}
                  </p>
                  {exec.error && (
                    <p className="text-xs text-destructive mt-1 truncate">
                      Error: {exec.error}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Agent Types Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Agents by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['discord-bot', 'scheduler', 'service'].map((type) => {
                const typeAgents = agents.filter((a: any) => a.agent_type === type);
                const activeCount = typeAgents.filter((a: any) => a.is_enabled && a.status === 'active').length;

                return (
                  <div key={type} className="p-4 rounded-lg border border-border bg-background">
                    <p className="text-xs text-muted-foreground mb-1">{type}</p>
                    <p className="text-2xl font-semibold tabular-nums mb-1">{typeAgents.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {activeCount} active · {typeAgents.length - activeCount} inactive
                    </p>
                    <div className="mt-3 space-y-1">
                      {typeAgents.map((agent: any) => (
                        <p
                          key={agent.id}
                          className={cn(
                            "text-xs",
                            agent.is_enabled && agent.status === 'active' ? 'text-success' : 'text-muted-foreground'
                          )}
                        >
                          · {agent.display_name}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
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
              <QuickAction
                href="/agents/tasks"
                icon={<Calendar className="w-5 h-5" />}
                label="Recurring Tasks"
                sublabel={`${stats.totalTasks} tasks`}
              />
              <QuickAction
                href="/agents/executions"
                icon={<Zap className="w-5 h-5" />}
                label="Execution History"
                sublabel={`${stats.totalExecutions} runs`}
              />
              <QuickAction
                href="/agents/logs"
                icon={<Activity className="w-5 h-5" />}
                label="Agent Logs"
                sublabel="View logs"
              />
              <QuickAction
                href="/agents/manage"
                icon={<Settings className="w-5 h-5" />}
                label="Manage Agents"
                sublabel="Configure"
              />
            </div>
          </CardContent>
        </Card>

        {/* Status Banner */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Agent Manager Active</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tracking {agents.length} agents, {stats.totalTasks} recurring tasks, {stats.totalExecutions} total executions
            {' · '}
            Success rate: {stats.totalExecutions > 0
              ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
              : 0}%
            {stats.failedExecutions > 0 && ` · ${stats.failedExecutions} failed runs`}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

function QuickAction({
  href,
  icon,
  label,
  sublabel,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
}) {
  return (
    <Link
      href={href}
      className="p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-center group"
    >
      <div className="flex justify-center mb-2 text-muted-foreground group-hover:text-primary transition-colors">
        {icon}
      </div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </Link>
  );
}
