'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonCard, SkeletonChart } from '@/components/ui/skeleton';
import {
  Activity,
  DollarSign,
  Briefcase,
  CreditCard,
  Bot,
  TrendingUp,
  Target,
  ArrowRight,
  Wallet,
} from 'lucide-react';
import { cn, formatCurrency as formatCurrencyUtil, formatDate } from '@/lib/utils';

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
        <div className="max-w-6xl mx-auto">
          <PageHeader
            title="Dashboard"
            description="Your financial overview at a glance"
            icon={<Wallet className="w-6 h-6" />}
          />

          {loading ? (
            <LoadingState />
          ) : overview ? (
            <div className="space-y-8 animate-fade-in">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Total Income"
                  value={formatCurrency(overview.summary.totalIncome)}
                  changeLabel="this month"
                  icon={<TrendingUp className="w-4 h-4" />}
                />
                <MetricCard
                  label="Total Expenses"
                  value={formatCurrency(overview.summary.totalExpenses)}
                  changeLabel="this month"
                  icon={<DollarSign className="w-4 h-4" />}
                />
                <MetricCard
                  label="Net Savings"
                  value={formatCurrency(overview.summary.netSavings)}
                  change={overview.summary.savingsRate}
                  trend={overview.summary.netSavings >= 0 ? 'up' : 'down'}
                />
                <MetricCard
                  label="Total Balance"
                  value={formatCurrency(overview.accounts.reduce((sum: number, acc: any) => sum + acc.balance, 0))}
                  changeLabel={`${overview.accounts.length} accounts`}
                  icon={<Wallet className="w-4 h-4" />}
                />
              </div>

              {/* Income vs Expenses Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Income vs Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={overview.monthlyTrend}>
                      <defs>
                        <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="month"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        tickFormatter={(value) => `$${(Number(value) / 1000).toFixed(0)}k`}
                        axisLine={false}
                        tickLine={false}
                        width={50}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          fontSize: 12,
                        }}
                        formatter={(value: any) => formatCurrency(value)}
                      />
                      <Area
                        type="monotone"
                        dataKey="income"
                        stroke="hsl(var(--success))"
                        fill="url(#incomeGradient)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        stroke="hsl(var(--destructive))"
                        fill="url(#expenseGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Quick Access Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <QuickAccessCard
                  href="/diagnostics"
                  icon={<Activity className="w-5 h-5" />}
                  title="Diagnostics"
                  subtitle="System health check"
                  badge={{ text: 'OK', variant: 'success' }}
                />
                <QuickAccessCard
                  href="/finances/income"
                  icon={<TrendingUp className="w-5 h-5" />}
                  title="Income"
                  subtitle={formatCurrency(overview.summary.totalIncome)}
                />
                <QuickAccessCard
                  href="/finances/business"
                  icon={<Briefcase className="w-5 h-5" />}
                  title="Business"
                  subtitle={formatCurrency(overview.summary.businessExpenses)}
                />
                <QuickAccessCard
                  href="/loans"
                  icon={<CreditCard className="w-5 h-5" />}
                  title="Loans"
                  subtitle={formatCurrency(overview.summary.loanPayments)}
                />
              </div>

              {/* Recent Activity & Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Transactions */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Recent Transactions
                    </CardTitle>
                    <Link
                      href="/finances"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      View all <ArrowRight className="w-3 h-3" />
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {overview.recentTransactions && overview.recentTransactions.length > 0 ? (
                        overview.recentTransactions.slice(0, 6).map((txn: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center justify-between py-2.5 hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {txn.merchant || txn.description}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(txn.date)}
                                {txn.category && ` • ${txn.category}`}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'text-sm font-medium tabular-nums ml-4',
                                txn.amount >= 0 ? 'text-success' : 'text-foreground'
                              )}
                            >
                              {txn.amount >= 0 ? '+' : ''}{formatCurrency(txn.amount)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No recent transactions
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Spending Categories */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Top Spending Categories
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {overview.categoryBreakdown.slice(0, 5).map((cat: any, index: number) => (
                        <div key={index}>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-sm">{cat.category}</span>
                            <span className="text-sm font-medium tabular-nums">
                              {formatCurrency(cat.amount)}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${cat.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Account Balances */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Account Balances
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {overview.accounts.slice(0, 6).map((acc: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      >
                        <div>
                          <p className="text-sm font-medium">{acc.name}</p>
                          <p className="text-xs text-muted-foreground">{acc.institution}</p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(acc.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* More Modules */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <QuickAccessCard
                  href="/agents"
                  icon={<Bot className="w-5 h-5" />}
                  title="Agents"
                  subtitle="Manage bots & tasks"
                />
                <QuickAccessCard
                  href="/investments"
                  icon={<TrendingUp className="w-5 h-5" />}
                  title="Investments"
                  subtitle="Market data & portfolio"
                />
                <QuickAccessCard
                  href="/goals"
                  icon={<Target className="w-5 h-5" />}
                  title="Goals"
                  subtitle="Track your progress"
                />
                <QuickAccessCard
                  href="/projects"
                  icon={<Activity className="w-5 h-5" />}
                  title="Projects"
                  subtitle="Kanban & tasks"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}

// Quick Access Card Component
function QuickAccessCard({
  href,
  icon,
  title,
  subtitle,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: { text: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'destructive' };
}) {
  return (
    <Link href={href}>
      <Card interactive className="h-full">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg bg-muted text-muted-foreground">
              {icon}
            </div>
            {badge && (
              <Badge variant={badge.variant}>{badge.text}</Badge>
            )}
          </div>
          <div className="mt-3">
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Loading State Component
function LoadingState() {
  return (
    <div className="space-y-8">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-32 mb-4" />
          <SkeletonChart />
        </CardContent>
      </Card>

      {/* Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
