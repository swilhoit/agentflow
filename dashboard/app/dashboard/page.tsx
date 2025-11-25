'use client';

import { formatCurrency, formatPercentage } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export const dynamic = 'force-dynamic';

interface Transaction {
  id: string;
  description: string;
  date: string;
  amount: number;
  account_name?: string;
}

interface AgentTask {
  id: string;
  task_description: string;
  status: string;
  started_at: string;
}

interface MarketData {
  id: number;
  symbol: string;
  name: string;
  price: number;
  change_percent: number;
}

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [incomeChange, setIncomeChange] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [activeAgents, setActiveAgents] = useState<AgentTask[]>([]);
  const [recentAgents, setRecentAgents] = useState<AgentTask[]>([]);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [daysElapsed, setDaysElapsed] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch financial overview
        const financeRes = await fetch('/api/finances/overview');
        if (financeRes.ok) {
          const financeData = await financeRes.json();
          setIncome(financeData.summary?.totalIncome || 0);
          setExpenses(financeData.summary?.totalExpenses || 0);
          setRecentTransactions(
            (financeData.recentTransactions || []).map((tx: any) => ({
              id: tx.date + tx.amount,
              description: tx.description,
              date: tx.date,
              amount: tx.amount,
              account_name: tx.merchant
            }))
          );
          setTransactionCount(financeData.recentTransactions?.length || 0);
        }

        // Calculate days elapsed in month
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const days = Math.floor((today.getTime() - firstDayOfMonth.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        setDaysElapsed(days);

        // Fetch goals data for comparison
        const goalsRes = await fetch('/api/goals');
        if (goalsRes.ok) {
          const goalsData = await goalsRes.json();
          // Calculate income change from monthly progress
          const progress = goalsData.monthlyProgress || [];
          if (progress.length >= 2) {
            const currentMonth = progress[progress.length - 1];
            const lastMonth = progress[progress.length - 2];
            if (lastMonth.income > 0) {
              setIncomeChange(((currentMonth.income - lastMonth.income) / lastMonth.income) * 100);
            }
          }
        }

        // Fetch market data
        const investRes = await fetch('/api/investments');
        if (investRes.ok) {
          const investData = await investRes.json();
          setMarketData((investData.watchlist || []).slice(0, 3));
        }

        // Set some sample agent data (since we don't have a dedicated endpoint)
        setActiveAgents([]);
        setRecentAgents([]);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const netSavings = income - expenses;
  const burnRate = daysElapsed > 0 ? expenses / daysElapsed : 0;
  const savingsRate = income > 0 ? (netSavings / income) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-xl">Loading dashboard...</div>
        </div>
      </div>
    );
  }

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
              Real-time data from Supabase cloud database
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
                {transactionCount} transactions
              </div>
            </div>

            <div className="border border-border bg-card p-6">
              <div className="text-sm text-muted-foreground mb-2">NET SAVINGS</div>
              <div className={`text-2xl font-bold ${netSavings >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(netSavings)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {savingsRate.toFixed(1)}% savings rate
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
              <Link href="/finances" className="text-sm text-primary hover:underline">
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((txn, idx) => (
                  <div key={idx} className="flex justify-between items-start border-b border-border pb-3 last:border-0">
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
                ))
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No transactions found
                </div>
              )}
            </div>
          </div>

          {/* Agent Activity */}
          <div className="border border-border bg-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Agent Activity</h3>
              <Link href="/agents" className="text-sm text-primary hover:underline">
                View All →
              </Link>
            </div>
            <div className="mb-4">
              <div className="text-sm text-muted-foreground mb-2">Active Agents</div>
              <div className="text-3xl font-bold">{activeAgents.length}</div>
            </div>
            <div className="space-y-3">
              {recentAgents.length > 0 ? (
                recentAgents.map((agent, idx) => (
                  <div key={idx} className="border-b border-border pb-3 last:border-0">
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
                ))
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No recent agent activity
                </div>
              )}
            </div>
          </div>

          {/* Market Snapshot */}
          {marketData.length > 0 && (
            <div className="border border-border bg-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Market Snapshot</h3>
                <Link href="/investments" className="text-sm text-primary hover:underline">
                  View All →
                </Link>
              </div>
              <div className="space-y-3">
                {marketData.map((stock, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-border pb-3 last:border-0">
                    <div>
                      <div className="font-bold">{stock.symbol}</div>
                      <div className="text-xs text-muted-foreground">{stock.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold">${Number(stock.price).toFixed(2)}</div>
                      <div className={`text-xs ${Number(stock.change_percent) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {Number(stock.change_percent) >= 0 ? '+' : ''}{Number(stock.change_percent).toFixed(2)}%
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
                href="/finances/income"
                className="border border-border p-4 hover:bg-muted transition-colors text-center"
              >
                <div className="text-2xl mb-2">💵</div>
                <div className="text-sm font-medium">Income Tracker</div>
              </Link>
              <Link
                href="/finances/business"
                className="border border-border p-4 hover:bg-muted transition-colors text-center"
              >
                <div className="text-2xl mb-2">🏢</div>
                <div className="text-sm font-medium">Business Expenses</div>
              </Link>
              <Link
                href="/loans"
                className="border border-border p-4 hover:bg-muted transition-colors text-center"
              >
                <div className="text-2xl mb-2">💳</div>
                <div className="text-sm font-medium">Loan Tracker</div>
              </Link>
              <Link
                href="/goals"
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
          <div className="text-sm text-primary font-bold mb-2">☁️ Connected to Supabase Cloud Database</div>
          <div className="text-xs text-muted-foreground">
            Using PostgreSQL via Supabase • Project: <code className="bg-muted px-1 py-0.5">personal-finance</code>
            <br />
            No local database files used • All data is stored in the cloud
          </div>
        </div>
      </div>
    </div>
  );
}
