'use client';

import { formatCurrency, formatPercentage } from '@/lib/utils';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  CreditCard,
  PiggyBank,
  Flame,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Bot,
  Wallet,
  Building2,
  Target,
  Cloud,
  Database,
  BarChart3,
  Receipt,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dashboard Overview</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time data from your connected accounts
            </p>
          </div>
        </div>

        {/* Financial Summary */}
        <div>
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Financial Summary (This Month)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-xs font-medium">Total Income</span>
                </div>
                <div className="text-2xl font-semibold tabular-nums">{formatCurrency(income)}</div>
                <div className={cn(
                  "text-xs mt-1 flex items-center gap-1",
                  incomeChange >= 0 ? 'text-success' : 'text-destructive'
                )}>
                  {incomeChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {formatPercentage(incomeChange, 1)} vs last month
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-xs font-medium">Total Spent</span>
                </div>
                <div className="text-2xl font-semibold tabular-nums">{formatCurrency(expenses)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {transactionCount} transactions
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <PiggyBank className={cn("w-4 h-4", netSavings >= 0 ? 'text-success' : 'text-destructive')} />
                  <span className="text-xs font-medium">Net Savings</span>
                </div>
                <div className={cn(
                  "text-2xl font-semibold tabular-nums",
                  netSavings >= 0 ? 'text-success' : 'text-destructive'
                )}>
                  {formatCurrency(netSavings)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {Number(savingsRate || 0).toFixed(1)}% savings rate
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Flame className="w-4 h-4 text-warning" />
                  <span className="text-xs font-medium">Burn Rate</span>
                </div>
                <div className="text-2xl font-semibold tabular-nums">{formatCurrency(burnRate)}/day</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {daysElapsed} days tracked
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Recent Transactions
              </CardTitle>
              <Link href="/finances" className="text-xs text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((txn, idx) => (
                  <div key={idx} className="flex justify-between items-start border-b border-border pb-3 last:border-0">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{txn.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {txn.date} · {txn.account_name || 'Unknown Account'}
                      </div>
                    </div>
                    <div className={cn(
                      "font-semibold tabular-nums",
                      txn.amount >= 0 ? 'text-success' : 'text-foreground'
                    )}>
                      {txn.amount >= 0 ? '+' : ''}{formatCurrency(txn.amount)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No transactions found
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agent Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Agent Activity
              </CardTitle>
              <Link href="/agents" className="text-xs text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="text-xs text-muted-foreground mb-1">Active Agents</div>
                <div className="text-3xl font-semibold tabular-nums">{activeAgents.length}</div>
              </div>
              <div className="space-y-3">
                {recentAgents.length > 0 ? (
                  recentAgents.map((agent, idx) => (
                    <div key={idx} className="border-b border-border pb-3 last:border-0">
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium text-sm line-clamp-1">{agent.task_description}</div>
                        <Badge
                          variant={
                            agent.status === 'completed' ? 'success' :
                            agent.status === 'failed' ? 'destructive' :
                            agent.status === 'running' ? 'default' : 'secondary'
                          }
                        >
                          {agent.status}
                        </Badge>
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
            </CardContent>
          </Card>

          {/* Market Snapshot */}
          {marketData.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Market Snapshot
                </CardTitle>
                <Link href="/investments" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {marketData.map((stock, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-border pb-3 last:border-0">
                    <div>
                      <div className="font-semibold">{stock.symbol}</div>
                      <div className="text-xs text-muted-foreground">{stock.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">${Number(stock.price).toFixed(2)}</div>
                      <div className={cn(
                        "text-xs flex items-center gap-1 justify-end",
                        Number(stock.change_percent) >= 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {Number(stock.change_percent) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Number(stock.change_percent) >= 0 ? '+' : ''}{Number(stock.change_percent).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <QuickAction
                  href="/finances/income"
                  icon={<Wallet className="w-5 h-5" />}
                  label="Income Tracker"
                />
                <QuickAction
                  href="/finances/business"
                  icon={<Building2 className="w-5 h-5" />}
                  label="Business Expenses"
                />
                <QuickAction
                  href="/loans"
                  icon={<CreditCard className="w-5 h-5" />}
                  label="Loan Tracker"
                />
                <QuickAction
                  href="/goals"
                  icon={<Target className="w-5 h-5" />}
                  label="Daily Goals"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Database Info */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <Cloud className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Connected to Supabase Cloud Database</span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Database className="w-3 h-3" />
            Using PostgreSQL via Supabase · All data is stored in the cloud
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-center group"
    >
      <div className="flex justify-center mb-2 text-muted-foreground group-hover:text-primary transition-colors">
        {icon}
      </div>
      <p className="text-sm font-medium">{label}</p>
    </Link>
  );
}
