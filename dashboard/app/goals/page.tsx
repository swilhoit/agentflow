'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Target, DollarSign, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GoalData {
  currentMonth: {
    income: {
      actual: number;
      target: number;
      percentage: number;
    };
    expenses: {
      actual: number;
      target: number;
      percentage: number;
    };
    savingsRate: {
      actual: number;
      target: number;
      netSavings: number;
    };
  };
  categoryProgress: Array<{
    category: string;
    target: number;
    spent: number;
    remaining: number;
    percentage: number;
    overBudget: boolean;
  }>;
  monthlyProgress: Array<{
    month: string;
    income: number;
    expenses: number;
    savings: number;
    savingsRate: number;
  }>;
  goals: {
    monthlyIncome: number;
    monthlyExpenses: number;
    savingsRate: number;
    categories: Record<string, number>;
  };
}

function GoalsPageSkeleton() {
  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Main Goals skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20 mb-4" />
                <Skeleton className="h-2 w-full mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Category Progress skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="flex justify-between mb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
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

export default function GoalsPage() {
  const [data, setData] = useState<GoalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/goals');
      if (!response.ok) {
        throw new Error('Failed to fetch goals');
      }
      const json = await response.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return <GoalsPageSkeleton />;
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-destructive">Error: {error}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
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

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Financial Goals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track progress toward monthly income, spending, and savings goals
          </p>
        </div>

        {/* Main Goals Progress */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Income Goal */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">Income Target</span>
                <TrendingUp className="w-4 h-4 text-success" />
              </div>
              <div className="text-2xl font-semibold tabular-nums mb-1">
                {formatCurrency(data.currentMonth.income.actual)}
              </div>
              <div className="text-xs text-muted-foreground mb-4">
                of {formatCurrency(data.currentMonth.income.target)} goal
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-success rounded-full transition-all"
                  style={{ width: `${Math.min(100, data.currentMonth.income.percentage)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {Number(data.currentMonth.income.percentage || 0).toFixed(1)}% complete
              </div>
            </CardContent>
          </Card>

          {/* Expense Goal */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">Expense Limit</span>
                <TrendingDown className={cn(
                  "w-4 h-4",
                  data.currentMonth.expenses.percentage > 100 ? 'text-destructive' : 'text-warning'
                )} />
              </div>
              <div className="text-2xl font-semibold tabular-nums mb-1">
                {formatCurrency(data.currentMonth.expenses.actual)}
              </div>
              <div className="text-xs text-muted-foreground mb-4">
                of {formatCurrency(data.currentMonth.expenses.target)} limit
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    data.currentMonth.expenses.percentage > 100 ? 'bg-destructive' : 'bg-warning'
                  )}
                  style={{ width: `${Math.min(100, data.currentMonth.expenses.percentage)}%` }}
                />
              </div>
              <div className={cn(
                "text-xs tabular-nums flex items-center gap-1",
                data.currentMonth.expenses.percentage > 100 ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {Number(data.currentMonth.expenses.percentage || 0).toFixed(1)}% of limit
                {data.currentMonth.expenses.percentage > 100 && (
                  <>
                    <AlertTriangle className="w-3 h-3 ml-1" />
                    <span className="font-medium">Over budget</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Savings Rate Goal */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">Savings Rate</span>
                <Target className={cn(
                  "w-4 h-4",
                  data.currentMonth.savingsRate.actual >= data.currentMonth.savingsRate.target
                    ? 'text-success'
                    : 'text-warning'
                )} />
              </div>
              <div className="text-2xl font-semibold tabular-nums mb-1">
                {Number(data.currentMonth.savingsRate.actual || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mb-4">
                goal: {data.currentMonth.savingsRate.target}%
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    data.currentMonth.savingsRate.actual >= data.currentMonth.savingsRate.target
                      ? 'bg-success'
                      : 'bg-warning'
                  )}
                  style={{
                    width: `${Math.min(100, (data.currentMonth.savingsRate.actual / data.currentMonth.savingsRate.target) * 100)}%`
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {formatCurrency(data.currentMonth.savingsRate.netSavings)} net savings
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Budget Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Budget Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {data.categoryProgress.map((cat, index) => (
                <div key={index}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">{cat.category}</span>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-sm tabular-nums",
                        cat.overBudget ? 'text-destructive' : 'text-muted-foreground'
                      )}>
                        {formatCurrency(cat.spent)} / {formatCurrency(cat.target)}
                      </span>
                      {cat.overBudget ? (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Over
                        </Badge>
                      ) : (
                        <span className="text-xs text-success tabular-nums">
                          {formatCurrency(cat.remaining)} left
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        cat.overBudget ? 'bg-destructive' : 'bg-primary'
                      )}
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income vs Expenses Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Income vs Expenses (6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.monthlyProgress}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(value) => `$${(Number(value) / 1000).toFixed(0)}k`}
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
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="income" stroke="hsl(var(--success))" strokeWidth={2} name="Income" dot={false} />
                  <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" strokeWidth={2} name="Expenses" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Savings Rate Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Savings Rate Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.monthlyProgress}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12
                    }}
                    formatter={(value: any) => [`${Number(value || 0).toFixed(1)}%`, 'Savings Rate']}
                  />
                  <Bar dataKey="savingsRate" fill="hsl(var(--primary))" name="Savings Rate" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Goal Targets Info */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              Current Targets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <span className="text-muted-foreground">Monthly Income</span>
                <span className="font-semibold tabular-nums">{formatCurrency(data.goals.monthlyIncome)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <span className="text-muted-foreground">Monthly Expenses</span>
                <span className="font-semibold tabular-nums">{formatCurrency(data.goals.monthlyExpenses)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <span className="text-muted-foreground">Savings Rate</span>
                <span className="font-semibold tabular-nums">{data.goals.savingsRate}%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Goals can be customized in Settings
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
