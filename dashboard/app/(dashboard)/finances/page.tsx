'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';

export default function FinancesPage() {
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground font-mono">LOADING FINANCES...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!overview) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-muted-foreground">No data available</div>
        </div>
      </DashboardLayout>
    );
  }

  const CATEGORY_COLORS = [
    '#00aa66', '#3377ff', '#ff8800', '#dd3333', '#00ff88', '#5599ff', '#ffaa00', '#999999'
  ];

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold font-mono uppercase">💰 FINANCES</h1>
          <p className="text-sm text-muted-foreground font-mono mt-2">
            Complete financial overview and management
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border border-border bg-card p-6">
            <div className="text-xs text-muted-foreground font-mono uppercase">Total Income</div>
            <div className="text-3xl font-bold font-mono mt-2">{formatCurrency(overview.summary.totalIncome)}</div>
            <div className="text-xs text-muted-foreground font-mono mt-1">This month</div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-xs text-muted-foreground font-mono uppercase">Total Expenses</div>
            <div className="text-3xl font-bold font-mono mt-2">{formatCurrency(overview.summary.totalExpenses)}</div>
            <div className="text-xs text-muted-foreground font-mono mt-1">This month</div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-xs text-muted-foreground font-mono uppercase">Net Savings</div>
            <div className={`text-3xl font-bold font-mono mt-2 ${overview.summary.netSavings >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(overview.summary.netSavings)}
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-1">
              {overview.summary.savingsRate.toFixed(1)}% savings rate
            </div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-xs text-muted-foreground font-mono uppercase">Accounts Balance</div>
            <div className="text-3xl font-bold font-mono mt-2">
              {formatCurrency(overview.accounts.reduce((sum: number, acc: any) => sum + acc.balance, 0))}
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-1">{overview.accounts.length} accounts</div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/finances/income"
            className="border border-border bg-card p-6 hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <h2 className="text-lg font-bold font-mono uppercase group-hover:text-accent transition-colors">Income Tracker</h2>
            </div>
            <div className="text-2xl font-bold font-mono mb-1">{formatCurrency(overview.summary.totalIncome)}</div>
            <div className="text-xs text-muted-foreground font-mono">View income sources →</div>
          </Link>

          <Link
            href="/finances/business"
            className="border border-border bg-card p-6 hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <DollarSign className="w-6 h-6 text-accent" />
              <h2 className="text-lg font-bold font-mono uppercase group-hover:text-accent transition-colors">Business Expenses</h2>
            </div>
            <div className="text-2xl font-bold font-mono mb-1">{formatCurrency(overview.summary.businessExpenses)}</div>
            <div className="text-xs text-muted-foreground font-mono">Tax deductible →</div>
          </Link>

          <Link
            href="/loans"
            className="border border-border bg-card p-6 hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <CreditCard className="w-6 h-6 text-red-500" />
              <h2 className="text-lg font-bold font-mono uppercase group-hover:text-accent transition-colors">Loan Payments</h2>
            </div>
            <div className="text-2xl font-bold font-mono mb-1">{formatCurrency(overview.summary.loanPayments)}</div>
            <div className="text-xs text-muted-foreground font-mono">Monthly payments →</div>
          </Link>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income vs Expenses Trend */}
          <div className="border border-border bg-card p-6">
            <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">Income vs Expenses (6 Months)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={overview.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    fontFamily: 'monospace',
                    fontSize: 12
                  }}
                  formatter={(value: any) => formatCurrency(value)}
                />
                <Area type="monotone" dataKey="income" stackId="1" stroke="rgb(34, 197, 94)" fill="rgb(34, 197, 94)" fillOpacity={0.3} name="Income" />
                <Area type="monotone" dataKey="expenses" stackId="2" stroke="rgb(239, 68, 68)" fill="rgb(239, 68, 68)" fillOpacity={0.3} name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Category Breakdown */}
          <div className="border border-border bg-card p-6">
            <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">Spending by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={overview.categoryBreakdown}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => name && percent ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={{ stroke: 'var(--border)' }}
                >
                  {overview.categoryBreakdown.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    fontFamily: 'monospace',
                    fontSize: 12
                  }}
                  formatter={(value: any) => formatCurrency(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Accounts & Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Account Balances */}
          <div className="border border-border bg-card p-6">
            <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">Account Balances</h3>
            <div className="space-y-2">
              {overview.accounts.slice(0, 8).map((acc: any, index: number) => (
                <div key={index} className="flex justify-between items-center py-2">
                  <div>
                    <div className="font-mono text-sm font-bold">{acc.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{acc.institution}</div>
                  </div>
                  <div className={`font-mono text-sm font-bold ${acc.balance >= 0 ? '' : 'text-red-500'}`}>
                    {formatCurrency(acc.balance)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Spending Categories */}
          <div className="border border-border bg-card p-6">
            <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">Top Spending Categories</h3>
            <div className="space-y-4">
              {overview.categoryBreakdown.slice(0, 5).map((cat: any, index: number) => (
                <div key={index}>
                  <div className="flex justify-between mb-2">
                    <span className="font-mono text-sm">{cat.category}</span>
                    <span className="font-mono text-sm font-bold">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="w-full h-3 bg-muted border border-border">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-1">
                    {cat.percentage.toFixed(1)}% of total spending
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
