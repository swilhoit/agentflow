import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { db_queries_agents } from '@/lib/database-agents';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const agents = await db_queries_agents.getAllAgents();
  const stats = await db_queries_agents.getAgentStats();
  const recentExecutions = await db_queries_agents.getRecentExecutions(10);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to Home
            </Link>
            <h1 className="text-3xl font-bold mt-2">🤖 Agent Manager</h1>
            <p className="text-muted-foreground mt-1">
              Manage all agents and recurring tasks in your system
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">TOTAL AGENTS</div>
            <div className="text-3xl font-bold">{agents.length}</div>
            <div className="text-xs text-primary mt-1">
              {agents.filter((a: any) => a.is_enabled).length} active
            </div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">TOTAL TASKS</div>
            <div className="text-3xl font-bold">{stats.totalTasks}</div>
            <div className="text-xs text-primary mt-1">
              {stats.enabledTasks} enabled
            </div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">SUCCESS RATE</div>
            <div className="text-3xl font-bold">
              {stats.totalExecutions > 0
                ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
                : 0}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.successfulExecutions}/{stats.totalExecutions} runs
            </div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">FAILED RUNS</div>
            <div className={`text-3xl font-bold ${stats.failedExecutions > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {stats.failedExecutions}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.totalExecutions > 0
                ? Math.round((stats.failedExecutions / stats.totalExecutions) * 100)
                : 0}% failure rate
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Agents List */}
          <div className="border border-border bg-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">🤖 Agents</h2>
              <Link href="/agents/manage" className="text-sm text-primary hover:underline">
                Manage →
              </Link>
            </div>
            <div className="space-y-4">
              {agents.map((agent: any) => (
                <div key={agent.id} className="border border-border p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold">{agent.display_name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {agent.agent_type} • {agent.agent_name}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className={`text-xs px-2 py-1 border ${
                        agent.status === 'active' ? 'border-primary text-primary' :
                        agent.status === 'error' ? 'border-destructive text-destructive' :
                        'border-muted-foreground text-muted-foreground'
                      }`}>
                        {agent.status}
                      </span>
                      <span className={`text-xs px-2 py-1 border ${
                        agent.is_enabled ? 'border-primary text-primary' : 'border-border text-muted-foreground'
                      }`}>
                        {agent.is_enabled ? 'enabled' : 'disabled'}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {agent.description}
                  </div>
                  {agent.last_active_at && (
                    <div className="text-xs text-muted-foreground mt-2">
                      Last active: {new Date(agent.last_active_at).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Task Executions */}
          <div className="border border-border bg-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">⚡ Recent Executions</h2>
              <Link href="/agents/executions" className="text-sm text-primary hover:underline">
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {recentExecutions.map((exec: any) => (
                <div key={exec.id} className="border-b border-border pb-3 last:border-0">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1">
                      <div className="font-medium text-sm line-clamp-1">{exec.task_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {exec.agent_name} • {exec.duration ? `${(exec.duration / 1000).toFixed(1)}s` : 'N/A'}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 border ${
                      exec.status === 'success' ? 'border-primary text-primary' :
                      exec.status === 'failed' ? 'border-destructive text-destructive' :
                      'border-border text-muted-foreground'
                    }`}>
                      {exec.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(exec.started_at).toLocaleString()}
                  </div>
                  {exec.error && (
                    <div className="text-xs text-destructive mt-1 line-clamp-1">
                      Error: {exec.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Agent Types Breakdown */}
        <div className="border border-border bg-card p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">📊 Agents by Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['discord-bot', 'scheduler', 'service'].map((type) => {
              const typeAgents = agents.filter((a: any) => a.agent_type === type);
              const activeCount = typeAgents.filter((a: any) => a.is_enabled && a.status === 'active').length;

              return (
                <div key={type} className="border border-border p-4">
                  <div className="text-sm text-muted-foreground mb-2">{type.toUpperCase()}</div>
                  <div className="text-2xl font-bold mb-2">{typeAgents.length}</div>
                  <div className="text-xs text-muted-foreground">
                    {activeCount} active • {typeAgents.length - activeCount} inactive
                  </div>
                  <div className="mt-3 space-y-1">
                    {typeAgents.map((agent: any) => (
                      <div key={agent.id} className="text-xs">
                        <span className={agent.is_enabled && agent.status === 'active' ? 'text-primary' : 'text-muted-foreground'}>
                          • {agent.display_name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border border-border bg-card p-6">
          <h2 className="text-xl font-bold mb-4">⚙️ Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href="/agents/tasks"
              className="border border-border p-4 hover:bg-muted transition-colors text-center"
            >
              <div className="text-2xl mb-2">📅</div>
              <div className="text-sm font-medium">Recurring Tasks</div>
              <div className="text-xs text-muted-foreground mt-1">{stats.totalTasks} tasks</div>
            </Link>
            <Link
              href="/agents/executions"
              className="border border-border p-4 hover:bg-muted transition-colors text-center"
            >
              <div className="text-2xl mb-2">⚡</div>
              <div className="text-sm font-medium">Execution History</div>
              <div className="text-xs text-muted-foreground mt-1">{stats.totalExecutions} runs</div>
            </Link>
            <Link
              href="/agents/logs"
              className="border border-border p-4 hover:bg-muted transition-colors text-center"
            >
              <div className="text-2xl mb-2">📋</div>
              <div className="text-sm font-medium">Agent Logs</div>
              <div className="text-xs text-muted-foreground mt-1">View logs</div>
            </Link>
            <Link
              href="/agents/manage"
              className="border border-border p-4 hover:bg-muted transition-colors text-center"
            >
              <div className="text-2xl mb-2">⚙️</div>
              <div className="text-sm font-medium">Manage Agents</div>
              <div className="text-xs text-muted-foreground mt-1">Configure</div>
            </Link>
          </div>
        </div>

        {/* Database Info */}
        <div className="mt-8 border border-primary bg-card p-4">
          <div className="text-sm text-primary font-bold mb-2">✅ Agent Manager Active</div>
          <div className="text-xs text-muted-foreground">
            Tracking {agents.length} agents, {stats.totalTasks} recurring tasks, {stats.totalExecutions} total executions
            <br />
            Success rate: {stats.totalExecutions > 0
              ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
              : 0}%
            {stats.failedExecutions > 0 && ` • ${stats.failedExecutions} failed runs`}
          </div>
        </div>
      </div>
    </div>
  );
}
