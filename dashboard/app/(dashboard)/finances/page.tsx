'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, ArrowRight, Wallet, PiggyBank, Building2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function FinancesPageSkeleton() {
  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-16 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

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
    return <FinancesPageSkeleton />;
  }

  if (!overview) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No data available</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const CATEGORY_COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--success))',
    '#f59e0b',
    'hsl(var(--destructive))',
    '#8b5cf6',
    '#06b6d4',
    '#ec4899',
    '#6b7280'
  ];

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Finances</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete financial overview and management
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-xs font-medium">Total Income</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{formatCurrency(overview.summary.totalIncome)}</div>
              <div className="text-xs text-muted-foreground mt-1">This month</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingDown className="w-4 h-4 text-destructive" />
                <span className="text-xs font-medium">Total Expenses</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{formatCurrency(overview.summary.totalExpenses)}</div>
              <div className="text-xs text-muted-foreground mt-1">This month</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <PiggyBank className="w-4 h-4" />
                <span className="text-xs font-medium">Net Savings</span>
              </div>
              <div className={cn(
                "text-2xl font-semibold tabular-nums",
                overview.summary.netSavings >= 0 ? 'text-success' : 'text-destructive'
              )}>
                {formatCurrency(overview.summary.netSavings)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                {overview.summary.savingsRate.toFixed(1)}% savings rate
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Wallet className="w-4 h-4" />
                <span className="text-xs font-medium">Accounts Balance</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {formatCurrency(overview.accounts.reduce((sum: number, acc: any) => sum + acc.balance, 0))}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{overview.accounts.length} accounts</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/finances/income" className="group">
            <Card className="hover:border-primary/50 transition-colors h-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-success" />
                  </div>
                  <h2 className="font-semibold group-hover:text-primary transition-colors">Income Tracker</h2>
                </div>
                <div className="text-2xl font-semibold tabular-nums mb-1">{formatCurrency(overview.summary.totalIncome)}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  View income sources
                  <ArrowRight className="w-3 h-3" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/finances/business" className="group">
            <Card className="hover:border-primary/50 transition-colors h-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-semibold group-hover:text-primary transition-colors">Business Expenses</h2>
                </div>
                <div className="text-2xl font-semibold tabular-nums mb-1">{formatCurrency(overview.summary.businessExpenses)}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  Tax deductible
                  <ArrowRight className="w-3 h-3" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/loans" className="group">
            <Card className="hover:border-primary/50 transition-colors h-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-destructive" />
                  </div>
                  <h2 className="font-semibold group-hover:text-primary transition-colors">Loan Payments</h2>
                </div>
                <div className="text-2xl font-semibold tabular-nums mb-1">{formatCurrency(overview.summary.loanPayments)}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  Monthly payments
                  <ArrowRight className="w-3 h-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income vs Expenses Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Income vs Expenses (6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={overview.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12
                    }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                  <Area type="monotone" dataKey="income" stackId="1" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.2} name="Income" />
                  <Area type="monotone" dataKey="expenses" stackId="2" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.2} name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
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
                    labelLine={{ stroke: 'hsl(var(--border))' }}
                  >
                    {overview.categoryBreakdown.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12
                    }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Accounts & Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Account Balances */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Balances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overview.accounts.slice(0, 8).map((acc: any, index: number) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                    <div>
                      <div className="font-medium text-sm">{acc.name}</div>
                      <div className="text-xs text-muted-foreground">{acc.institution}</div>
                    </div>
                    <div className={cn(
                      "font-semibold text-sm tabular-nums",
                      acc.balance < 0 && 'text-destructive'
                    )}>
                      {formatCurrency(acc.balance)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Spending Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Spending Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {overview.categoryBreakdown.slice(0, 5).map((cat: any, index: number) => (
                  <div key={index}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">{cat.category}</span>
                      <span className="font-semibold text-sm tabular-nums">{formatCurrency(cat.amount)}</span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                      {cat.percentage.toFixed(1)}% of total spending
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
