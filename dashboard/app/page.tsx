'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export default function Home() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/finances/overview')
      .then(res => res.json())
      .then(data => {
        setOverview(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching overview:', err);
        setLoading(false);
      });
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold font-mono uppercase">DASHBOARD</h1>
            <p className="text-sm text-muted-foreground font-mono mt-2">Financial overview and quick access</p>
          </div>

        {/* Financial Summary Cards */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground font-mono">LOADING FINANCIAL DATA...</div>
          </div>
        ) : overview ? (
          <>
            {/* Top Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="border border-border bg-card p-6">
                <div className="text-xs text-muted-foreground font-mono uppercase">TOTAL INCOME</div>
                <div className="text-2xl font-bold font-mono mt-2">{formatCurrency(overview.summary.totalIncome)}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">This month</div>
              </div>
              <div className="border border-border bg-card p-6">
                <div className="text-xs text-muted-foreground font-mono uppercase">TOTAL EXPENSES</div>
                <div className="text-2xl font-bold font-mono mt-2">{formatCurrency(overview.summary.totalExpenses)}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">This month</div>
              </div>
              <div className="border border-border bg-card p-6">
                <div className="text-xs text-muted-foreground font-mono uppercase">NET SAVINGS</div>
                <div className={`text-2xl font-bold font-mono mt-2 ${overview.summary.netSavings >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {formatCurrency(overview.summary.netSavings)}
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  {overview.summary.savingsRate.toFixed(1)}% savings rate
                </div>
              </div>
              <div className="border border-border bg-card p-6">
                <div className="text-xs text-muted-foreground font-mono uppercase">ACCOUNTS</div>
                <div className="text-2xl font-bold font-mono mt-2">{formatCurrency(overview.accounts.reduce((sum: number, acc: any) => sum + acc.balance, 0))}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">{overview.accounts.length} accounts</div>
              </div>
            </div>

            {/* Income/Expense Trend Chart */}
            <div className="border border-border bg-card p-6 mb-6">
              <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">INCOME VS EXPENSES (6 MONTHS)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={overview.monthlyTrend}>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }}
                  />
                  <YAxis
                    tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Area type="monotone" dataKey="income" stackId="1" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="expenses" stackId="2" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Module Cards with Preview Data */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Diagnostics Card */}
              <Link
                href="/diagnostics"
                className="border border-border bg-card p-6 hover:bg-muted/50 transition-colors group"
              >
                <h2 className="text-lg font-bold font-mono uppercase mb-2 group-hover:text-accent transition-colors">🔍 DIAGNOSTICS</h2>
                <div className="text-2xl font-bold font-mono mb-1 text-accent">SYSTEM OK</div>
                <div className="text-xs text-muted-foreground font-mono">CHECK CONNECTIONS →</div>
              </Link>

              {/* Income Tracker Card */}
              <Link
                href="/finances/income"
                className="border border-border bg-card p-6 hover:bg-muted/50 transition-colors group"
              >
                <h2 className="text-lg font-bold font-mono uppercase mb-2 group-hover:text-accent transition-colors">💵 INCOME TRACKER</h2>
                <div className="text-2xl font-bold font-mono mb-1">{formatCurrency(overview.summary.totalIncome)}</div>
                <div className="text-xs text-muted-foreground font-mono">THIS MONTH →</div>
              </Link>

              {/* Business Expenses Card */}
              <Link
                href="/finances/business"
                className="border border-border bg-card p-6 hover:bg-muted/50 transition-colors group"
              >
                <h2 className="text-lg font-bold font-mono uppercase mb-2 group-hover:text-accent transition-colors">🏢 BUSINESS EXPENSES</h2>
                <div className="text-2xl font-bold font-mono mb-1">{formatCurrency(overview.summary.businessExpenses)}</div>
                <div className="text-xs text-muted-foreground font-mono">TAX DEDUCTIBLE →</div>
              </Link>

              {/* Loans Card */}
              <Link
                href="/loans"
                className="border border-border bg-card p-6 hover:bg-muted/50 transition-colors group"
              >
                <h2 className="text-lg font-bold font-mono uppercase mb-2 group-hover:text-accent transition-colors">💳 LOAN PAYBACK</h2>
                <div className="text-2xl font-bold font-mono mb-1">{formatCurrency(overview.summary.loanPayments)}</div>
                <div className="text-xs text-muted-foreground font-mono">MONTHLY PAYMENTS →</div>
              </Link>
            </div>

            {/* Recent Transactions */}
            <div className="border border-border bg-card p-6 mb-6">
              <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">RECENT TRANSACTIONS</h3>
              <div className="space-y-2">
                {overview.recentTransactions && overview.recentTransactions.length > 0 ? (
                  overview.recentTransactions.map((txn: any, index: number) => (
                    <div key={index} className="flex items-center justify-between py-2 hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="font-mono text-sm font-bold truncate max-w-[300px]">
                          {txn.merchant || txn.description}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {txn.category && ` • ${txn.category}`}
                        </div>
                      </div>
                      <div className={`font-mono text-sm font-bold ${txn.amount >= 0 ? 'text-accent' : 'text-foreground'}`}>
                        {txn.amount >= 0 ? '+' : ''}{formatCurrency(txn.amount)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground font-mono text-sm">
                    No recent transactions
                  </div>
                )}
              </div>
            </div>

            {/* Spending Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="border border-border bg-card p-6">
                <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">TOP SPENDING CATEGORIES</h3>
                <div className="space-y-3">
                  {overview.categoryBreakdown.slice(0, 5).map((cat: any, index: number) => (
                    <div key={index}>
                      <div className="flex justify-between mb-1">
                        <span className="font-mono text-sm">{cat.category}</span>
                        <span className="font-mono text-sm font-bold">{formatCurrency(cat.amount)}</span>
                      </div>
                      <div className="w-full h-2 bg-muted border border-border">
                        <div
                          className="h-full bg-accent transition-all"
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-border bg-card p-6">
                <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">ACCOUNT BALANCES</h3>
                <div className="space-y-2">
                  {overview.accounts.slice(0, 5).map((acc: any, index: number) => (
                    <div key={index} className="flex justify-between items-center py-2">
                      <div>
                        <div className="font-mono text-sm font-bold">{acc.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{acc.institution}</div>
                      </div>
                      <div className="font-mono text-sm font-bold">{formatCurrency(acc.balance)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}

        {/* Additional Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            href="/agents"
            className="border border-border bg-card p-6 hover:bg-muted/50 transition-colors group"
          >
            <h2 className="text-lg font-bold font-mono uppercase mb-2 group-hover:text-accent transition-colors">🤖 AGENTS</h2>
            <p className="text-sm text-muted-foreground font-mono">Manage bots & tasks →</p>
          </Link>

          <Link
            href="/investments"
            className="border border-border bg-card p-6 hover:bg-muted/50 transition-colors group"
          >
            <h2 className="text-lg font-bold font-mono uppercase mb-2 group-hover:text-accent transition-colors">📈 INVESTMENTS</h2>
            <p className="text-sm text-muted-foreground font-mono">Market data & portfolio →</p>
          </Link>

          <Link
            href="/goals"
            className="border border-border bg-card p-6 hover:bg-muted/50 transition-colors group"
          >
            <h2 className="text-lg font-bold font-mono uppercase mb-2 group-hover:text-accent transition-colors">🎯 GOALS</h2>
            <p className="text-sm text-muted-foreground font-mono">Daily goals & productivity →</p>
          </Link>

          <Link
            href="/tasks"
            className="border border-border bg-card p-6 hover:bg-muted/50 transition-colors group"
          >
            <h2 className="text-lg font-bold font-mono uppercase mb-2 group-hover:text-accent transition-colors">✅ TASKS</h2>
            <p className="text-sm text-muted-foreground font-mono">Trello & agent monitoring →</p>
          </Link>
        </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
