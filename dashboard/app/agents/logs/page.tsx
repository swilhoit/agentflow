import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { db_queries_agents } from '@/lib/database-agents';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Calendar,
  Zap,
  Bot,
  LayoutDashboard,
  Settings,
  AlertTriangle,
  Info,
  Terminal,
  Wrench,
  MessageSquare,
  FileText,
  Circle,
  Filter,
  ChevronRight,
  Play,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function formatTimestamp(date: Date | string | null): string {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleString();
}

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return 'Unknown';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

function getLogTypeConfig(logType: string) {
  switch (logType) {
    case 'error':
      return {
        icon: XCircle,
        color: 'text-red-500',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        label: 'Error'
      };
    case 'warning':
      return {
        icon: AlertTriangle,
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        label: 'Warning'
      };
    case 'success':
      return {
        icon: CheckCircle,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        label: 'Success'
      };
    case 'info':
      return {
        icon: Info,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        label: 'Info'
      };
    case 'step':
      return {
        icon: Play,
        color: 'text-purple-500',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        label: 'Step'
      };
    case 'tool_call':
      return {
        icon: Wrench,
        color: 'text-cyan-500',
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/30',
        label: 'Tool Call'
      };
    case 'tool_result':
      return {
        icon: Terminal,
        color: 'text-teal-500',
        bg: 'bg-teal-500/10',
        border: 'border-teal-500/30',
        label: 'Tool Result'
      };
    default:
      return {
        icon: FileText,
        color: 'text-gray-500',
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/30',
        label: logType || 'Log'
      };
  }
}

export default async function AgentLogsPage() {
  // Fetch comprehensive log data
  const [recentLogs, errorLogs, toolExecutions, recentExecutions, agentHealth] = await Promise.all([
    db_queries_agents.getRecentAgentLogs(300),
    db_queries_agents.getErrorLogs(50),
    db_queries_agents.getRecentToolExecutions(100),
    db_queries_agents.getRecentExecutions(50),
    db_queries_agents.getAgentHealthSummary()
  ]);

  // Calculate stats
  const logsByType = recentLogs.reduce((acc: Record<string, number>, log: any) => {
    const type = log.log_type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const logsByAgent = recentLogs.reduce((acc: Record<string, number>, log: any) => {
    const agent = log.agent_id || 'unknown';
    acc[agent] = (acc[agent] || 0) + 1;
    return acc;
  }, {});

  const toolCallCount = toolExecutions.length;
  const toolSuccessCount = toolExecutions.filter((t: any) => t.success).length;
  const toolFailCount = toolExecutions.filter((t: any) => !t.success).length;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" />
            Back to Agents
          </Link>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Agent Logs</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Granular activity logs, tool calls, and step-by-step execution details
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Log Type Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {['error', 'warning', 'success', 'info', 'step', 'tool_call', 'tool_result'].map((type) => {
            const config = getLogTypeConfig(type);
            const count = logsByType[type] || 0;
            const Icon = config.icon;
            return (
              <Card key={type} className={cn(count > 0 && type === 'error' ? "border-red-500/30" : "")}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn("w-4 h-4", config.color)} />
                    <span className="text-xs font-medium text-muted-foreground">{config.label}</span>
                  </div>
                  <div className={cn("text-2xl font-bold tabular-nums", count > 0 && type === 'error' ? "text-red-500" : "")}>
                    {count}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Error Logs Section */}
        {errorLogs.length > 0 && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-4 h-4" />
                Recent Errors & Warnings
                <Badge variant="destructive">{errorLogs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
              {errorLogs.map((log: any, i: number) => {
                const config = getLogTypeConfig(log.log_type);
                const Icon = config.icon;
                return (
                  <div
                    key={log.id || i}
                    className={cn("p-3 rounded-lg border", config.border, config.bg)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("w-4 h-4 shrink-0", config.color)} />
                        <Badge variant="outline" className={cn("text-xs", config.color)}>
                          {config.label}
                        </Badge>
                        {log.agent_id && (
                          <Link
                            href={`/agents/${log.agent_id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            {log.agent_id}
                          </Link>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTimeAgo(log.timestamp)}
                      </span>
                    </div>
                    <p className={cn("text-sm", config.color)}>{log.message}</p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          View details
                        </summary>
                        <pre className="text-xs bg-black/10 p-2 rounded mt-1 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tool Executions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Recent Tool Calls
                <Badge variant="secondary">{toolCallCount}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  <span className="text-emerald-500">{toolSuccessCount} ok</span>
                  {toolFailCount > 0 && (
                    <span className="text-red-500"> / {toolFailCount} failed</span>
                  )}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
              {toolExecutions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No tool calls recorded</p>
              ) : (
                toolExecutions.map((tool: any, i: number) => (
                  <div
                    key={tool.id || i}
                    className={cn(
                      "p-3 rounded-lg border",
                      tool.success ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Circle className={cn(
                          "w-2 h-2",
                          tool.success ? "fill-emerald-500 text-emerald-500" : "fill-red-500 text-red-500"
                        )} />
                        <span className="font-medium text-sm">{tool.tool_name}</span>
                        <Badge variant={tool.success ? 'success' : 'destructive'} className="text-xs">
                          {tool.success ? 'success' : 'failed'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {tool.duration_ms && (
                          <span className="tabular-nums">{tool.duration_ms}ms</span>
                        )}
                        <span>{formatTimeAgo(tool.timestamp)}</span>
                      </div>
                    </div>
                    {tool.agent_id && (
                      <p className="text-xs text-muted-foreground mb-2">Agent: {tool.agent_id}</p>
                    )}
                    {tool.tool_input && (
                      <details className="mt-1">
                        <summary className="text-xs text-cyan-600 cursor-pointer hover:text-cyan-500">
                          Input
                        </summary>
                        <pre className="text-xs bg-cyan-500/10 p-2 rounded mt-1 overflow-x-auto max-h-24">
                          {typeof tool.tool_input === 'string'
                            ? tool.tool_input.substring(0, 500)
                            : JSON.stringify(tool.tool_input, null, 2).substring(0, 500)}
                        </pre>
                      </details>
                    )}
                    {tool.tool_output && (
                      <details className="mt-1">
                        <summary className="text-xs text-teal-600 cursor-pointer hover:text-teal-500">
                          Output
                        </summary>
                        <pre className="text-xs bg-teal-500/10 p-2 rounded mt-1 overflow-x-auto max-h-24">
                          {tool.tool_output.substring(0, 500)}
                          {tool.tool_output.length > 500 && '...'}
                        </pre>
                      </details>
                    )}
                    {tool.error && (
                      <div className="mt-2 p-2 rounded bg-red-500/10 text-red-600 text-xs">
                        {tool.error}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Logs by Agent */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Activity by Agent
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(logsByAgent).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No agent activity recorded</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(logsByAgent)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([agent, count]) => {
                      const agentInfo = agentHealth.find((a: any) => a.agentName === agent);
                      return (
                        <Link
                          key={agent}
                          href={`/agents/${agent}`}
                          className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <Circle className={cn(
                              "w-2.5 h-2.5",
                              agentInfo?.status === 'active' ? "fill-emerald-500 text-emerald-500" :
                              agentInfo?.status === 'error' ? "fill-red-500 text-red-500" :
                              "fill-gray-400 text-gray-400"
                            )} />
                            <div>
                              <span className="font-medium text-sm">
                                {agentInfo?.displayName || agent}
                              </span>
                              {agentInfo && (
                                <p className="text-xs text-muted-foreground">
                                  {agentInfo.successRate}% success rate
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{count} logs</Badge>
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Full Activity Log */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Full Activity Log
              <Badge variant="secondary">{recentLogs.length} entries</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No activity logs recorded yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Logs will appear here when agents execute tasks
                </p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {recentLogs.map((log: any, i: number) => {
                  const config = getLogTypeConfig(log.log_type);
                  const Icon = config.icon;
                  return (
                    <div
                      key={log.id || i}
                      className={cn(
                        "flex items-start gap-3 py-2 px-3 rounded-lg transition-colors hover:bg-muted/30",
                        log.log_type === 'error' && "bg-red-500/5",
                        log.log_type === 'warning' && "bg-amber-500/5"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <Badge variant="outline" className={cn("text-xs", config.color, config.bg)}>
                            {config.label}
                          </Badge>
                          {log.agent_id && (
                            <Link
                              href={`/agents/${log.agent_id}`}
                              className="text-xs text-primary hover:underline"
                            >
                              {log.agent_id}
                            </Link>
                          )}
                          {log.channel_id && (
                            <span className="text-xs text-muted-foreground">
                              #{log.channel_id.slice(-6)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto shrink-0">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{log.message}</p>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <details className="mt-1">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Details
                            </summary>
                            <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Task Executions Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Recent Task Executions
            </CardTitle>
            <Link href="/agents/executions" className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {recentExecutions.slice(0, 20).map((exec: any) => (
                <Link
                  key={exec.id}
                  href={`/agents/executions/${exec.id}`}
                  className={cn(
                    "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors hover:bg-muted/50 group",
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
                    <div className="text-xs text-muted-foreground">
                      {exec.agent_name} · {formatTimeAgo(exec.started_at)}
                    </div>
                  </div>
                  <Badge
                    variant={exec.status === 'success' ? 'success' : exec.status === 'failed' ? 'destructive' : 'secondary'}
                  >
                    {exec.status}
                  </Badge>
                </Link>
              ))}
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <QuickAction href="/agents/tasks" icon={<Calendar className="w-5 h-5" />} label="Recurring Tasks" />
              <QuickAction href="/agents/executions" icon={<Zap className="w-5 h-5" />} label="Executions" />
              <QuickAction href="/agents/conversations" icon={<MessageSquare className="w-5 h-5" />} label="Conversations" />
              <QuickAction href="/agents" icon={<Bot className="w-5 h-5" />} label="Agents" />
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
