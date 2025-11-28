import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { db_queries_agents } from '@/lib/database-agents';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  ArrowLeft,
  Settings,
  Power,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Zap,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ManageAgentsPage() {
  const agents = await db_queries_agents.getAllAgents();
  const recurringTasks = await db_queries_agents.getAllRecurringTasks();
  const stats = await db_queries_agents.getAgentStats();

  // Group tasks by agent
  const tasksByAgent = recurringTasks.reduce((acc: Record<string, any[]>, task: any) => {
    const agentName = task.agent_name || 'unassigned';
    if (!acc[agentName]) acc[agentName] = [];
    acc[agentName].push(task);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <Link
            href="/agents"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Agents
          </Link>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Manage Agents</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Configure and manage your agent configurations
              </p>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Bot className="w-4 h-4" />
                <span className="text-xs font-medium">Total Agents</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{agents.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Power className="w-4 h-4 text-success" />
                <span className="text-xs font-medium">Active</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums text-success">
                {agents.filter((a: any) => a.is_enabled && a.status === 'active').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">Recurring Tasks</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{stats.totalTasks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-medium">Total Runs</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{stats.totalExecutions}</div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Configurations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Agent Configurations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No agents configured</p>
                <p className="text-sm mt-1">
                  Agents will appear here once they are registered in the system.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {agents.map((agent: any) => {
                  const agentTasks = tasksByAgent[agent.agent_name] || [];
                  const enabledTasks = agentTasks.filter((t: any) => t.is_enabled).length;

                  return (
                    <div
                      key={agent.id}
                      className="p-4 rounded-lg border border-border bg-background"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            agent.is_enabled && agent.status === 'active'
                              ? 'bg-success/10'
                              : 'bg-muted'
                          )}>
                            <Bot className={cn(
                              "w-5 h-5",
                              agent.is_enabled && agent.status === 'active'
                                ? 'text-success'
                                : 'text-muted-foreground'
                            )} />
                          </div>
                          <div>
                            <h3 className="font-medium">{agent.display_name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {agent.agent_type} · {agent.agent_name}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge
                            variant={
                              agent.status === 'active' ? 'success' :
                              agent.status === 'error' ? 'destructive' : 'secondary'
                            }
                          >
                            {agent.status || 'unknown'}
                          </Badge>
                          <Badge variant={agent.is_enabled ? 'default' : 'secondary'}>
                            {agent.is_enabled ? 'enabled' : 'disabled'}
                          </Badge>
                        </div>
                      </div>

                      {agent.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {agent.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="p-2 rounded bg-muted/50">
                          <span className="text-muted-foreground">Tasks</span>
                          <p className="font-medium">{agentTasks.length} total</p>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <span className="text-muted-foreground">Enabled</span>
                          <p className="font-medium text-success">{enabledTasks} tasks</p>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <span className="text-muted-foreground">Last Active</span>
                          <p className="font-medium">
                            {agent.last_active_at
                              ? new Date(agent.last_active_at).toLocaleDateString()
                              : 'Never'}
                          </p>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <span className="text-muted-foreground">Created</span>
                          <p className="font-medium">
                            {agent.created_at
                              ? new Date(agent.created_at).toLocaleDateString()
                              : 'Unknown'}
                          </p>
                        </div>
                      </div>

                      {agentTasks.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <p className="text-xs text-muted-foreground mb-2">Recurring Tasks:</p>
                          <div className="flex flex-wrap gap-2">
                            {agentTasks.slice(0, 5).map((task: any) => (
                              <Badge
                                key={task.id}
                                variant={task.is_enabled ? 'outline' : 'secondary'}
                                className="text-xs"
                              >
                                {task.task_name}
                              </Badge>
                            ))}
                            {agentTasks.length > 5 && (
                              <Badge variant="secondary" className="text-xs">
                                +{agentTasks.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
              <Link
                href="/agents/tasks"
                className="p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-center group"
              >
                <div className="flex justify-center mb-2 text-muted-foreground group-hover:text-primary transition-colors">
                  <Calendar className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium">Recurring Tasks</p>
                <p className="text-xs text-muted-foreground">{stats.totalTasks} tasks</p>
              </Link>

              <Link
                href="/agents/executions"
                className="p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-center group"
              >
                <div className="flex justify-center mb-2 text-muted-foreground group-hover:text-primary transition-colors">
                  <Zap className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium">Executions</p>
                <p className="text-xs text-muted-foreground">{stats.totalExecutions} runs</p>
              </Link>

              <Link
                href="/agents/logs"
                className="p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-center group"
              >
                <div className="flex justify-center mb-2 text-muted-foreground group-hover:text-primary transition-colors">
                  <Activity className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium">Agent Logs</p>
                <p className="text-xs text-muted-foreground">View activity</p>
              </Link>

              <Link
                href="/agents"
                className="p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-center group"
              >
                <div className="flex justify-center mb-2 text-muted-foreground group-hover:text-primary transition-colors">
                  <Bot className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium">Agent Overview</p>
                <p className="text-xs text-muted-foreground">Dashboard</p>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Info Banner */}
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Agent Management</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            This page shows all configured agents and their tasks. Agent configurations are managed
            through the bot's Discord commands or programmatically via the API.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
