import { formatCurrency, formatPercentage } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { db_queries } from '@/lib/database';

export const dynamic = 'force-dynamic';

export default async function DashboardOverview() {
  // Get current month date range
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const startDate = firstDayOfMonth.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  // Fetch real data from your database
  const transactions = db_queries.getTransactionsByDateRange(startDate, endDate);
  const recentTransactions = db_queries.getRecentTransactions(5);
  const activeAgents = db_queries.getActiveAgentTasks();
  const recentAgents = db_queries.getRecentAgentTasks(5);
  const marketData = db_queries.getLatestMarketData().slice(0, 3);

  // Calculate financial metrics
  const income = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const expenses = Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
  const netSavings = income - expenses;
  const daysElapsed = Math.floor((today.getTime() - firstDayOfMonth.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const burnRate = expenses / daysElapsed;

  // Get last month for comparison
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const lastMonthTransactions = db_queries.getTransactionsByDateRange(
    lastMonthStart.toISOString().split('T')[0],
    lastMonthEnd.toISOString().split('T')[0]
  );
  const lastMonthIncome = lastMonthTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const incomeChange = lastMonthIncome > 0 ? ((income - lastMonthIncome) / lastMonthIncome) * 100 : 0;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to Home
            </Link>
            <h1 className="text-3xl font-bold mt-2">Dashboard Overview</h1>
            <p className="text-muted-foreground mt-1">
              Real-time data from your AgentFlow database
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Financial Summary */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">💰 Financial Summary (This Month)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-border bg-card p-6">
              <div className="text-sm text-muted-foreground mb-2">TOTAL INCOME</div>
              <div className="text-2xl font-bold">{formatCurrency(income)}</div>
              <div className={`text-xs mt-1 ${incomeChange >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatPercentage(incomeChange, 1)} vs last month
              </div>
            </div>

            <div className="border border-border bg-card p-6">
              <div className="text-sm text-muted-foreground mb-2">TOTAL SPENT</div>
              <div className="text-2xl font-bold">{formatCurrency(expenses)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {transactions.filter(t => t.amount < 0).length} transactions
              </div>
            </div>

            <div className="border border-border bg-card p-6">
              <div className="text-sm text-muted-foreground mb-2">NET SAVINGS</div>
              <div className={`text-2xl font-bold ${netSavings >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(netSavings)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {((netSavings / income) * 100).toFixed(1)}% savings rate
              </div>
            </div>

            <div className="border border-border bg-card p-6">
              <div className="text-sm text-muted-foreground mb-2">BURN RATE</div>
              <div className="text-2xl font-bold">{formatCurrency(burnRate)}/day</div>
              <div className="text-xs text-muted-foreground mt-1">
                {daysElapsed} days tracked
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Transactions */}
          <div className="border border-border bg-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Recent Transactions</h3>
              <Link href="/dashboard/finances" className="text-sm text-primary hover:underline">
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {recentTransactions.map((txn) => (
                <div key={txn.id} className="flex justify-between items-start border-b border-border pb-3 last:border-0">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{txn.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {txn.date} • {txn.account_name || 'Unknown Account'}
                    </div>
                  </div>
                  <div className={`font-mono font-bold ${txn.amount >= 0 ? 'text-primary' : 'text-foreground'}`}>
                    {txn.amount >= 0 ? '+' : ''}{formatCurrency(txn.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Activity */}
          <div className="border border-border bg-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Agent Activity</h3>
              <Link href="/dashboard/tasks" className="text-sm text-primary hover:underline">
                View All →
              </Link>
            </div>
            <div className="mb-4">
              <div className="text-sm text-muted-foreground mb-2">Active Agents</div>
              <div className="text-3xl font-bold">{activeAgents.length}</div>
            </div>
            <div className="space-y-3">
              {recentAgents.map((agent) => (
                <div key={agent.id} className="border-b border-border pb-3 last:border-0">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-medium text-sm line-clamp-1">{agent.task_description}</div>
                    <span className={`text-xs px-2 py-1 border ${
                      agent.status === 'completed' ? 'border-primary text-primary' :
                      agent.status === 'failed' ? 'border-destructive text-destructive' :
                      agent.status === 'running' ? 'border-accent text-accent' :
                      'border-border text-muted-foreground'
                    }`}>
                      {agent.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Started: {new Date(agent.started_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Market Snapshot */}
          {marketData.length > 0 && (
            <div className="border border-border bg-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Market Snapshot</h3>
                <Link href="/dashboard/investments" className="text-sm text-primary hover:underline">
                  View All →
                </Link>
              </div>
              <div className="space-y-3">
                {marketData.map((stock) => (
                  <div key={stock.id} className="flex justify-between items-center border-b border-border pb-3 last:border-0">
                    <div>
                      <div className="font-bold">{stock.symbol}</div>
                      <div className="text-xs text-muted-foreground">{stock.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold">${stock.price.toFixed(2)}</div>
                      <div className={`text-xs ${stock.change_percent >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="border border-border bg-card p-6">
            <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/dashboard/finances/income"
                className="border border-border p-4 hover:bg-muted transition-colors text-center"
              >
                <div className="text-2xl mb-2">💵</div>
                <div className="text-sm font-medium">Income Tracker</div>
              </Link>
              <Link
                href="/dashboard/finances/business"
                className="border border-border p-4 hover:bg-muted transition-colors text-center"
              >
                <div className="text-2xl mb-2">🏢</div>
                <div className="text-sm font-medium">Business Expenses</div>
              </Link>
              <Link
                href="/dashboard/loans"
                className="border border-border p-4 hover:bg-muted transition-colors text-center"
              >
                <div className="text-2xl mb-2">💳</div>
                <div className="text-sm font-medium">Loan Tracker</div>
              </Link>
              <Link
                href="/dashboard/goals"
                className="border border-border p-4 hover:bg-muted transition-colors text-center"
              >
                <div className="text-2xl mb-2">🎯</div>
                <div className="text-sm font-medium">Daily Goals</div>
              </Link>
            </div>
          </div>
        </div>

        {/* Database Info */}
        <div className="mt-8 border border-primary bg-card p-4">
          <div className="text-sm text-primary font-bold mb-2">✅ Connected to Live Database</div>
          <div className="text-xs text-muted-foreground">
            Showing real data from: <code className="bg-muted px-1 py-0.5">/data/agentflow.db</code>
            <br />
            Transactions: {recentTransactions.length} • Agents: {activeAgents.length} active, {recentAgents.length} recent
            {marketData.length > 0 && ` • Market: ${marketData.length} symbols`}
          </div>
        </div>
      </div>
    </div>
  );
}
