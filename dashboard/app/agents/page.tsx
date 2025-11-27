import Link from 'next/link';
import { db_queries_agents } from '@/lib/database-agents';
import { Bot, Zap, Clock, AlertTriangle, CheckCircle, XCircle, ArrowRight, Calendar, Activity, Settings } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const agents = await db_queries_agents.getAllAgents();
  const stats = await db_queries_agents.getAgentStats();
  const recentExecutions = await db_queries_agents.getRecentExecutions(10);

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-title-lg">Agent Manager</h1>
              <p className="text-body-sm text-muted-foreground mt-1">
                Manage all agents and recurring tasks in your system
              </p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Agents"
            value={agents.length}
            subtext={`${agents.filter((a: any) => a.is_enabled).length} active`}
            icon={<Bot className="w-4 h-4" />}
          />
          <StatCard
            label="Total Tasks"
            value={stats.totalTasks}
            subtext={`${stats.enabledTasks} enabled`}
            icon={<Clock className="w-4 h-4" />}
          />
          <StatCard
            label="Success Rate"
            value={stats.totalExecutions > 0
              ? `${Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)}%`
              : '0%'}
            subtext={`${stats.successfulExecutions}/${stats.totalExecutions} runs`}
            icon={<CheckCircle className="w-4 h-4" />}
            variant={stats.successfulExecutions / stats.totalExecutions > 0.9 ? 'success' : 'default'}
          />
          <StatCard
            label="Failed Runs"
            value={stats.failedExecutions}
            subtext={`${stats.totalExecutions > 0
              ? Math.round((stats.failedExecutions / stats.totalExecutions) * 100)
              : 0}% failure rate`}
            icon={<XCircle className="w-4 h-4" />}
            variant={stats.failedExecutions > 0 ? 'destructive' : 'default'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Agents List */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-title-sm flex items-center gap-2">
                <Bot className="w-4 h-4 text-muted-foreground" />
                Agents
              </h2>
              <Link href="/agents/manage" className="text-xs text-primary hover:underline flex items-center gap-1">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-5 space-y-3">
              {agents.map((agent: any) => (
                <div key={agent.id} className="p-4 rounded-lg border border-border bg-background">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-sm">{agent.display_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {agent.agent_type} • {agent.agent_name}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <StatusBadge
                        status={agent.status}
                        variant={agent.status === 'active' ? 'success' : agent.status === 'error' ? 'destructive' : 'default'}
                      />
                      <StatusBadge
                        status={agent.is_enabled ? 'enabled' : 'disabled'}
                        variant={agent.is_enabled ? 'primary' : 'default'}
                      />
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
            </div>
          </div>

          {/* Recent Executions */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-title-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                Recent Executions
              </h2>
              <Link href="/agents/executions" className="text-xs text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-5 space-y-2">
              {recentExecutions.map((exec: any) => (
                <div key={exec.id} className="py-3 border-b border-border last:border-0">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{exec.task_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {exec.agent_name} • {exec.duration ? `${(exec.duration / 1000).toFixed(1)}s` : 'N/A'}
                      </p>
                    </div>
                    <StatusBadge
                      status={exec.status}
                      variant={exec.status === 'success' ? 'success' : exec.status === 'failed' ? 'destructive' : 'default'}
                    />
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
            </div>
          </div>
        </div>

        {/* Agent Types Breakdown */}
        <div className="rounded-lg border border-border bg-card mb-8">
          <div className="p-5 border-b border-border">
            <h2 className="text-title-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Agents by Type
            </h2>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {['discord-bot', 'scheduler', 'service'].map((type) => {
              const typeAgents = agents.filter((a: any) => a.agent_type === type);
              const activeCount = typeAgents.filter((a: any) => a.is_enabled && a.status === 'active').length;

              return (
                <div key={type} className="p-4 rounded-lg border border-border bg-background">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    {type}
                  </p>
                  <p className="text-2xl font-semibold mb-1">{typeAgents.length}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeCount} active • {typeAgents.length - activeCount} inactive
                  </p>
                  <div className="mt-3 space-y-1">
                    {typeAgents.map((agent: any) => (
                      <p
                        key={agent.id}
                        className={`text-xs ${agent.is_enabled && agent.status === 'active' ? 'text-success' : 'text-muted-foreground'}`}
                      >
                        • {agent.display_name}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-border bg-card">
          <div className="p-5 border-b border-border">
            <h2 className="text-title-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted-foreground" />
              Quick Actions
            </h2>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
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
        </div>

        {/* Status Banner */}
        <div className="mt-8 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Agent Manager Active</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tracking {agents.length} agents, {stats.totalTasks} recurring tasks, {stats.totalExecutions} total executions
            {' • '}
            Success rate: {stats.totalExecutions > 0
              ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
              : 0}%
            {stats.failedExecutions > 0 && ` • ${stats.failedExecutions} failed runs`}
          </p>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  subtext,
  icon,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'destructive';
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className={`text-2xl font-semibold ${
        variant === 'success' ? 'text-success' :
        variant === 'destructive' ? 'text-destructive' :
        ''
      }`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
    </div>
  );
}

// Status Badge Component
function StatusBadge({
  status,
  variant = 'default',
}: {
  status: string;
  variant?: 'default' | 'primary' | 'success' | 'destructive';
}) {
  const colors = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    destructive: 'bg-destructive/10 text-destructive',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[variant]}`}>
      {status}
    </span>
  );
}

// Quick Action Component
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
      className="p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-center"
    >
      <div className="flex justify-center mb-2 text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </Link>
  );
}
