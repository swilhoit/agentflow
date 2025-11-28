import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { db_queries_agents } from '@/lib/database-agents';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Timer,
  Bot,
  Calendar,
  Wrench,
  FileText,
  AlertTriangle,
  Circle,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

function formatTimestamp(date: Date | string | null): string {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleString();
}

interface PageProps {
  params: Promise<{ executionId: string }>;
}

export default async function ExecutionDetailPage({ params }: PageProps) {
  const { executionId } = await params;

  // Fetch execution details
  const execution = await db_queries_agents.getExecutionById(executionId);

  if (!execution) {
    notFound();
  }

  // Fetch related data
  const [logs, toolExecutions] = await Promise.all([
    db_queries_agents.getAgentLogs(execution.task_id || executionId),
    db_queries_agents.getToolExecutions(execution.task_id || executionId)
  ]);

  const isSuccess = execution.status === 'success';
  const isFailed = execution.status === 'failed';

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <Link href="/agents/executions" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="w-3 h-3" />
            Back to Executions
          </Link>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                isSuccess ? "bg-emerald-500/10" : isFailed ? "bg-red-500/10" : "bg-gray-500/10"
              )}>
                <Zap className={cn(
                  "w-6 h-6",
                  isSuccess ? "text-emerald-500" : isFailed ? "text-red-500" : "text-gray-500"
                )} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold text-foreground">
                    {execution.task_name}
                  </h1>
                  <Badge variant={isSuccess ? 'success' : isFailed ? 'destructive' : 'secondary'}>
                    {execution.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Executed by {execution.agent_name}
                </p>
              </div>
            </div>
            <Link
              href={`/agents/${execution.agent_name}`}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View Agent <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Execution Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className={cn(
            "border-l-4",
            isSuccess ? "border-l-emerald-500" : isFailed ? "border-l-red-500" : "border-l-gray-400"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                {isSuccess ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : isFailed ? (
                  <XCircle className="w-4 h-4 text-red-500" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
                <span className="text-xs font-medium">Status</span>
              </div>
              <div className={cn(
                "text-2xl font-bold capitalize",
                isSuccess ? "text-emerald-500" : isFailed ? "text-red-500" : "text-foreground"
              )}>
                {execution.status}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Timer className="w-4 h-4" />
                <span className="text-xs font-medium">Duration</span>
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {execution.duration ? formatDuration(execution.duration) : 'N/A'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">Started</span>
              </div>
              <div className="text-sm font-medium">
                {formatTimestamp(execution.started_at)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Wrench className="w-4 h-4" />
                <span className="text-xs font-medium">Tool Calls</span>
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {toolExecutions.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Section (if failed) */}
        {isFailed && execution.error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-4 h-4" />
                Error Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm text-red-600 whitespace-pre-wrap bg-red-500/10 p-4 rounded-lg overflow-x-auto">
                {execution.error}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Result Section (if available) */}
        {execution.result && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Execution Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {typeof execution.result === 'string'
                  ? execution.result
                  : JSON.stringify(execution.result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tool Executions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Tool Calls
                {toolExecutions.length > 0 && (
                  <Badge variant="secondary">{toolExecutions.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {toolExecutions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No tool calls recorded</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {toolExecutions.map((tool: any, i: number) => (
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
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {tool.duration_ms ? formatDuration(tool.duration_ms) : 'N/A'}
                          </span>
                          <Badge variant={tool.success ? 'success' : 'destructive'}>
                            {tool.success ? 'success' : 'failed'}
                          </Badge>
                        </div>
                      </div>

                      {tool.tool_input && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            Input
                          </summary>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                            {typeof tool.tool_input === 'string'
                              ? tool.tool_input
                              : JSON.stringify(tool.tool_input, null, 2)}
                          </pre>
                        </details>
                      )}

                      {tool.tool_output && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            Output
                          </summary>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto max-h-40">
                            {tool.tool_output.substring(0, 1000)}
                            {tool.tool_output.length > 1000 && '...'}
                          </pre>
                        </details>
                      )}

                      {tool.error && (
                        <div className="mt-2 p-2 rounded bg-red-500/10 text-red-600 text-xs">
                          {tool.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Execution Logs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Execution Logs
                {logs.length > 0 && (
                  <Badge variant="secondary">{logs.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No logs recorded</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {logs.map((log: any, i: number) => (
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
                        <span className="text-xs opacity-70">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs">{log.message}</p>

                      {log.details && Object.keys(log.details).length > 0 && (
                        <details className="mt-1">
                          <summary className="text-xs opacity-70 cursor-pointer hover:opacity-100">
                            Details
                          </summary>
                          <pre className="text-xs bg-black/10 p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Metadata (if available) */}
        {execution.metadata && Object.keys(execution.metadata).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Metadata
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(execution.metadata, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Link
            href="/agents/executions"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Executions
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href={`/agents/${execution.agent_name}`}
              className="text-sm text-primary hover:underline"
            >
              View Agent
            </Link>
            <Link
              href={`/agents/tasks/${execution.agent_name}`}
              className="text-sm text-primary hover:underline"
            >
              View Tasks
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
