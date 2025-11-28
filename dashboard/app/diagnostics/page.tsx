'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle,
  Clock,
  Database,
  ExternalLink,
  Globe,
  MessageSquare,
  RefreshCw,
  Server,
  Shield,
  TrendingUp,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
  Timer,
  AlertCircle,
  ArrowRight,
  Play,
  CircleDot
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface DiagnosticsData {
  timestamp: string;
  responseTime: number;
  systemHealth: {
    score: number;
    status: 'healthy' | 'degraded' | 'critical';
    overallSuccessRate: number;
    totalAgents: number;
    healthyAgents: number;
    criticalAgents: number;
    tasksNeedingAttention: number;
  };
  agentStats: {
    totalTasks: number;
    enabledTasks: number;
    disabledTasks: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    agents: Array<{
      agentName: string;
      displayName: string;
      status: string;
      isEnabled: boolean;
      lastActiveAt: string | null;
      agentType: string;
      taskCount: number;
      totalRuns: number;
      successfulRuns: number;
      failedRuns: number;
      successRate: number;
    }>;
  };
  services: {
    database: {
      connected: boolean;
      latency: number | null;
      serverTime: string;
      tables: {
        agents: number;
        tasks: number;
        executions: number;
        conversations: number;
        logs: number;
      } | null;
      error?: string;
    };
    discord: { configured: boolean; status: string };
    supabase: { configured: boolean; status: string };
    openai: { configured: boolean; status: string };
    anthropic: { configured: boolean; status: string };
    vercel: { configured: boolean; status: string };
    alpaca: { configured: boolean; status: string };
    teller: { configured: boolean; status: string };
  };
  activity: {
    timeline: Array<{ hour: string; total: number; successful: number; failed: number }>;
    recentExecutions: any[];
    failedExecutions: any[];
    tasksNeedingAttention: any[];
  };
  errors: {
    recent: any[];
    count24h: number;
  };
  toolStats: Array<{
    toolName: string;
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgDuration: number;
    successRate: number;
  }>;
}

function DiagnosticsPageSkeleton() {
  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </DashboardLayout>
  );
}

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return 'Never';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

function getHealthGradient(score: number) {
  if (score >= 90) return 'from-emerald-500 to-green-500';
  if (score >= 70) return 'from-amber-500 to-yellow-500';
  return 'from-red-500 to-rose-500';
}

function getHealthBg(score: number) {
  if (score >= 90) return 'bg-emerald-500/10';
  if (score >= 70) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

function getHealthText(score: number) {
  if (score >= 90) return 'text-emerald-500';
  if (score >= 70) return 'text-amber-500';
  return 'text-red-500';
}

export default function DiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchDiagnostics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/diagnostics');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch diagnostics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchDiagnostics(true), 30000);
    return () => clearInterval(interval);
  }, [fetchDiagnostics]);

  if (loading) return <DiagnosticsPageSkeleton />;
  if (!data) return <DiagnosticsPageSkeleton />;

  const { systemHealth, agentStats, services, activity, errors, toolStats } = data;

  const serviceList = [
    { key: 'database', name: 'PostgreSQL', icon: Database, critical: true },
    { key: 'discord', name: 'Discord', icon: MessageSquare, critical: true },
    { key: 'openai', name: 'OpenAI', icon: Zap, critical: true },
    { key: 'anthropic', name: 'Anthropic', icon: Bot, critical: true },
    { key: 'supabase', name: 'Supabase', icon: Database, critical: false },
    { key: 'vercel', name: 'Vercel', icon: Globe, critical: false },
    { key: 'alpaca', name: 'Alpaca', icon: TrendingUp, critical: false },
    { key: 'teller', name: 'Teller', icon: Shield, critical: false },
  ];

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", getHealthBg(systemHealth.score))}>
                <Activity className={cn("w-6 h-6", getHealthText(systemHealth.score))} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">System Diagnostics</h1>
                <p className="text-sm text-muted-foreground">
                  Real-time health monitoring for AgentFlow
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Updated {formatTimeAgo(lastRefresh)}
            </span>
            <button
              onClick={() => fetchDiagnostics(true)}
              disabled={refreshing}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors",
                "bg-secondary hover:bg-secondary/80",
                refreshing && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {/* Health Score + Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Health Score Card */}
          <Card className="md:col-span-1 overflow-hidden">
            <div className={cn("h-1 bg-gradient-to-r", getHealthGradient(systemHealth.score))} />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Health Score</span>
                <Badge variant={systemHealth.status === 'healthy' ? 'default' : systemHealth.status === 'degraded' ? 'secondary' : 'destructive'}>
                  {systemHealth.status}
                </Badge>
              </div>
              <div className={cn("text-5xl font-bold tabular-nums", getHealthText(systemHealth.score))}>
                {systemHealth.score}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {data.responseTime}ms response time
              </div>
            </CardContent>
          </Card>

          {/* Agents Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Bot className="w-4 h-4" />
                <span className="text-sm">Agents</span>
              </div>
              <div className="text-3xl font-semibold">
                {systemHealth.healthyAgents}/{systemHealth.totalAgents}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {systemHealth.criticalAgents > 0 ? (
                  <span className="text-red-500">{systemHealth.criticalAgents} critical</span>
                ) : (
                  'All healthy'
                )}
              </div>
            </CardContent>
          </Card>

          {/* Success Rate Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Success Rate</span>
              </div>
              <div className={cn("text-3xl font-semibold", getHealthText(systemHealth.overallSuccessRate))}>
                {systemHealth.overallSuccessRate}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {agentStats.totalExecutions.toLocaleString()} total executions
              </div>
            </CardContent>
          </Card>

          {/* Issues Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Issues</span>
              </div>
              <div className={cn(
                "text-3xl font-semibold",
                (systemHealth.tasksNeedingAttention + errors.count24h) > 0 ? "text-amber-500" : "text-emerald-500"
              )}>
                {systemHealth.tasksNeedingAttention + errors.count24h}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {systemHealth.tasksNeedingAttention} stale tasks, {errors.count24h} errors
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Health */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  Agent Health
                </CardTitle>
                <Link
                  href="/agents"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {agentStats.agents.map((agent) => (
                  <div
                    key={agent.agentName}
                    className={cn(
                      "p-4 rounded-lg border transition-colors",
                      agent.status === 'error' ? "border-red-500/30 bg-red-500/5" :
                      agent.successRate < 80 ? "border-amber-500/30 bg-amber-500/5" :
                      "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CircleDot className={cn(
                            "w-3 h-3 flex-shrink-0",
                            agent.status === 'active' ? "text-emerald-500" :
                            agent.status === 'error' ? "text-red-500" : "text-gray-400"
                          )} />
                          <span className="font-medium text-sm truncate">{agent.displayName}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {agent.agentType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{agent.taskCount} tasks</span>
                          <span>{agent.totalRuns.toLocaleString()} runs</span>
                          <span>Last active {formatTimeAgo(agent.lastActiveAt)}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={cn(
                          "text-lg font-semibold tabular-nums",
                          agent.successRate >= 95 ? "text-emerald-500" :
                          agent.successRate >= 80 ? "text-amber-500" : "text-red-500"
                        )}>
                          {agent.successRate}%
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {agent.successfulRuns}/{agent.totalRuns}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Service Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4" />
                Service Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {serviceList.map(({ key, name, icon: Icon, critical }) => {
                  const service = services[key as keyof typeof services];
                  const isConnected = key === 'database'
                    ? (service as any).connected
                    : (service as any).configured;

                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg",
                        isConnected ? "bg-muted/50" : critical ? "bg-red-500/10" : "bg-amber-500/10"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn(
                          "w-4 h-4",
                          isConnected ? "text-emerald-500" : critical ? "text-red-500" : "text-amber-500"
                        )} />
                        <span className="text-sm font-medium">{name}</span>
                        {critical && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            required
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {key === 'database' && (service as any).latency && (
                          <span className="text-xs text-muted-foreground">
                            {(service as any).latency}ms
                          </span>
                        )}
                        {isConnected ? (
                          <Wifi className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Database Stats */}
              {services.database.connected && services.database.tables && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-xs font-medium text-muted-foreground mb-3">Database Records</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between px-2 py-1 rounded bg-muted/50">
                      <span className="text-muted-foreground">Agents</span>
                      <span className="font-medium">{services.database.tables.agents}</span>
                    </div>
                    <div className="flex justify-between px-2 py-1 rounded bg-muted/50">
                      <span className="text-muted-foreground">Tasks</span>
                      <span className="font-medium">{services.database.tables.tasks}</span>
                    </div>
                    <div className="flex justify-between px-2 py-1 rounded bg-muted/50">
                      <span className="text-muted-foreground">Executions</span>
                      <span className="font-medium">{services.database.tables.executions.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between px-2 py-1 rounded bg-muted/50">
                      <span className="text-muted-foreground">Logs</span>
                      <span className="font-medium">{services.database.tables.logs.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Errors */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  Recent Errors
                </CardTitle>
                <Badge variant={errors.count24h > 0 ? "destructive" : "secondary"}>
                  {errors.count24h} in 24h
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {errors.recent.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <p className="text-sm">No errors in the last 24 hours</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {errors.recent.slice(0, 5).map((error: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {error.agent_id || error.task_id || 'System'}
                          </div>
                          <div className="text-xs text-red-400 mt-1 line-clamp-2">
                            {error.message || error.content || 'Unknown error'}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatTimeAgo(error.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Recent Executions
                </CardTitle>
                <Link
                  href="/agents/executions"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {activity.recentExecutions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent executions</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {activity.recentExecutions.slice(0, 8).map((exec: any, idx: number) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg",
                        exec.status === 'success' ? "bg-emerald-500/5" :
                        exec.status === 'failed' ? "bg-red-500/5" : "bg-muted/50"
                      )}
                    >
                      {exec.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : exec.status === 'failed' ? (
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {exec.task_name || exec.taskName}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {exec.agent_name || exec.agentName}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-muted-foreground">
                          {formatTimeAgo(exec.started_at || exec.startedAt)}
                        </div>
                        {exec.duration && (
                          <div className="text-[10px] text-muted-foreground">
                            {exec.duration}ms
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tool Performance (if available) */}
        {toolStats && toolStats.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="w-4 h-4" />
                Tool Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {toolStats.slice(0, 12).map((tool) => (
                  <div key={tool.toolName} className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs font-medium truncate mb-1">{tool.toolName}</div>
                    <div className="flex items-baseline justify-between">
                      <span className={cn(
                        "text-lg font-semibold",
                        tool.successRate >= 95 ? "text-emerald-500" :
                        tool.successRate >= 80 ? "text-amber-500" : "text-red-500"
                      )}>
                        {tool.successRate}%
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {tool.totalCalls} calls
                      </span>
                    </div>
                    {tool.avgDuration > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        avg {Math.round(tool.avgDuration)}ms
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Last checked: {new Date(data.timestamp).toLocaleString()}</span>
          <span>Auto-refresh every 30s</span>
        </div>
      </div>
    </DashboardLayout>
  );
}
