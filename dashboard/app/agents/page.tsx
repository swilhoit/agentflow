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
  Settings,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  Timer,
  Wrench,
  ChevronRight,
  Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Status color utilities
function getStatusColor(status: string) {
  switch (status) {
    case 'active': return 'text-emerald-500';
    case 'error': return 'text-red-500';
    case 'inactive': return 'text-gray-400';
    default: return 'text-gray-400';
  }
}

function getHealthColor(successRate: number) {
  if (successRate >= 95) return 'text-emerald-500 bg-emerald-500/10';
  if (successRate >= 80) return 'text-amber-500 bg-amber-500/10';
  if (successRate >= 50) return 'text-orange-500 bg-orange-500/10';
  return 'text-red-500 bg-red-500/10';
}

function getHealthBadge(successRate: number) {
  if (successRate >= 95) return { label: 'Healthy', variant: 'success' as const };
  if (successRate >= 80) return { label: 'Warning', variant: 'warning' as const };
  if (successRate >= 50) return { label: 'Degraded', variant: 'destructive' as const };
  return { label: 'Critical', variant: 'destructive' as const };
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

export default async function AgentsPage() {
  // Fetch comprehensive data
  const [agentHealth, stats, recentExecutions, conversations, errorLogs, toolStats] = await Promise.all([
    db_queries_agents.getAgentHealthSummary(),
    db_queries_agents.getAgentStats(),
    db_queries_agents.getRecentExecutions(15),
    db_queries_agents.getAllConversations(10),
    db_queries_agents.getErrorLogs(5),
    db_queries_agents.getToolUsageStats()
  ]);

  const overallSuccessRate = stats.totalExecutions > 0
    ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
    : 100;

  const activeAgents = agentHealth.filter((a: any) => a.isEnabled && a.status === 'active').length;
  const agentsWithIssues = agentHealth.filter((a: any) => a.successRate < 80 || a.status === 'error').length;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header with Health Overview */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              overallSuccessRate >= 90 ? "bg-emerald-500/10" : overallSuccessRate >= 70 ? "bg-amber-500/10" : "bg-red-500/10"
            )}>
              <Bot className={cn(
                "w-6 h-6",
                overallSuccessRate >= 90 ? "text-emerald-500" : overallSuccessRate >= 70 ? "text-amber-500" : "text-red-500"
              )} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Agent Manager</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {activeAgents} of {agentHealth.length} agents active
                {agentsWithIssues > 0 && (
                  <span className="text-amber-500"> · {agentsWithIssues} need attention</span>
                )}
              </p>
            </div>
          </div>
          <Link
            href="/agents/conversations"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <MessageSquare className="w-4 h-4" />
            View Conversations
          </Link>
        </div>

        {/* Health Stats Row */}
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
              <div className={cn(
                "text-3xl font-bold tabular-nums",
                overallSuccessRate >= 90 ? "text-emerald-500" : overallSuccessRate >= 70 ? "text-amber-500" : "text-red-500"
              )}>
                {overallSuccessRate}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.successfulExecutions} / {stats.totalExecutions} runs
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Bot className="w-4 h-4" />
                <span className="text-xs font-medium">Agents</span>
              </div>
              <div className="text-3xl font-bold tabular-nums">{agentHealth.length}</div>
              <div className="flex items-center gap-1 mt-1">
                <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                <span className="text-xs text-muted-foreground">{activeAgents} active</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">Tasks</span>
              </div>
              <div className="text-3xl font-bold tabular-nums">{stats.totalTasks}</div>
              <div className="text-xs text-muted-foreground mt-1">{stats.enabledTasks} enabled</div>
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

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-medium">Executions</span>
              </div>
              <div className="text-3xl font-bold tabular-nums">{stats.totalExecutions}</div>
              <div className="text-xs text-muted-foreground mt-1">Total all-time</div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Health Grid */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Agent Health Status
            </CardTitle>
            <Link href="/agents/manage" className="text-xs text-primary hover:underline flex items-center gap-1">
              Manage <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agentHealth.map((agent: any) => {
                const health = getHealthBadge(agent.successRate);
                return (
                  <Link
                    key={agent.agentName}
                    href={`/agents/${agent.agentName}`}
                    className="block p-4 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Circle className={cn(
                          "w-2.5 h-2.5",
                          agent.status === 'active' ? "fill-emerald-500 text-emerald-500" :
                          agent.status === 'error' ? "fill-red-500 text-red-500" :
                          "fill-gray-400 text-gray-400"
                        )} />
                        <span className="font-medium text-sm">{agent.displayName}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Success Rate</span>
                        <span className={cn(
                          "font-semibold tabular-nums px-2 py-0.5 rounded",
                          getHealthColor(agent.successRate)
                        )}>
                          {agent.successRate}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Runs</span>
                        <span className="tabular-nums">
                          <span className="text-emerald-500">{agent.successfulRuns}</span>
                          <span className="text-muted-foreground"> / </span>
                          <span className={agent.failedRuns > 0 ? "text-red-500" : "text-muted-foreground"}>
                            {agent.failedRuns} failed
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tasks</span>
                        <span className="tabular-nums">{agent.taskCount}</span>
                      </div>

                      {agent.lastActiveAt && (
                        <div className="pt-2 border-t border-border/50">
                          <span className="text-xs text-muted-foreground">
                            Last active: {formatTimeAgo(agent.lastActiveAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Executions with Status Colors */}
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
            <CardContent className="space-y-1">
              {recentExecutions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No executions recorded yet</p>
              ) : (
                recentExecutions.map((exec: any) => (
                  <Link
                    key={exec.id}
                    href={`/agents/executions/${exec.id}`}
                    className={cn(
                      "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors hover:bg-muted/50",
                      exec.status === 'failed' && "bg-red-500/5"
                    )}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      exec.status === 'success' ? "bg-emerald-500" :
                      exec.status === 'failed' ? "bg-red-500" :
                      "bg-gray-400"
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
                            <span className="tabular-nums">{(exec.duration / 1000).toFixed(1)}s</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={exec.status === 'success' ? 'success' : exec.status === 'failed' ? 'destructive' : 'secondary'}
                      className="shrink-0"
                    >
                      {exec.status}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Conversations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Recent Conversations
              </CardTitle>
              <Link href="/agents/conversations" className="text-xs text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-1">
              {conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No conversations recorded yet</p>
              ) : (
                conversations.map((conv: any, i: number) => (
                  <div
                    key={conv.id || i}
                    className="py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {conv.message_type || 'text'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {conv.username || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(conv.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">
                      {conv.message}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Error Logs & Tool Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Errors */}
          <Card className={errorLogs.length > 0 ? "border-red-500/30" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className={cn("w-4 h-4", errorLogs.length > 0 ? "text-red-500" : "")} />
                Recent Errors
                {errorLogs.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{errorLogs.length}</Badge>
                )}
              </CardTitle>
              <Link href="/agents/logs" className="text-xs text-primary hover:underline flex items-center gap-1">
                View Logs <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {errorLogs.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No recent errors</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {errorLogs.map((log: any, i: number) => (
                    <div
                      key={log.id || i}
                      className="p-3 rounded-lg bg-red-500/5 border border-red-500/20"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={log.log_type === 'error' ? 'destructive' : 'warning'}>
                          {log.log_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">{log.message}</p>
                      {log.agent_id && (
                        <p className="text-xs text-muted-foreground mt-1">Agent: {log.agent_id}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tool Usage Stats */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Tool Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {toolStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No tool usage recorded yet</p>
              ) : (
                <div className="space-y-3">
                  {toolStats.slice(0, 6).map((tool: any, i: number) => (
                    <div key={tool.toolName || i} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{tool.toolName}</span>
                          <span className={cn(
                            "text-xs font-semibold tabular-nums px-2 py-0.5 rounded",
                            getHealthColor(tool.successRate)
                          )}>
                            {tool.successRate}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="tabular-nums">{tool.totalCalls} calls</span>
                          <span>·</span>
                          <span className="text-emerald-500 tabular-nums">{tool.successfulCalls} ok</span>
                          {tool.failedCalls > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-red-500 tabular-nums">{tool.failedCalls} failed</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <QuickAction
                href="/agents/tasks"
                icon={<Calendar className="w-5 h-5" />}
                label="Recurring Tasks"
                sublabel={`${stats.totalTasks} tasks`}
              />
              <QuickAction
                href="/agents/executions"
                icon={<Zap className="w-5 h-5" />}
                label="Executions"
                sublabel={`${stats.totalExecutions} runs`}
              />
              <QuickAction
                href="/agents/conversations"
                icon={<MessageSquare className="w-5 h-5" />}
                label="Conversations"
                sublabel="Chat logs"
              />
              <QuickAction
                href="/agents/logs"
                icon={<Activity className="w-5 h-5" />}
                label="Agent Logs"
                sublabel="All activity"
              />
              <QuickAction
                href="/agents/manage"
                icon={<Settings className="w-5 h-5" />}
                label="Manage"
                sublabel="Configure"
              />
            </div>
          </CardContent>
        </Card>
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
