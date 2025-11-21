'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Target, DollarSign } from 'lucide-react';

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
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground font-mono">LOADING GOALS...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="border border-destructive bg-destructive/10 p-4 text-destructive">
            Error: {error}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-muted-foreground">No data available</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold font-mono uppercase">🎯 FINANCIAL GOALS & TARGETS</h1>
          <p className="text-sm text-muted-foreground font-mono mt-2">
            Track progress toward monthly income, spending, and savings goals
          </p>
        </div>

        {/* Main Goals Progress */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Income Goal */}
          <div className="border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground font-mono uppercase">INCOME TARGET</div>
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <div className="text-2xl font-bold font-mono mb-1">
              {formatCurrency(data.currentMonth.income.actual)}
            </div>
            <div className="text-xs text-muted-foreground font-mono mb-3">
              of {formatCurrency(data.currentMonth.income.target)} goal
            </div>
            <div className="w-full h-2 bg-muted border border-border mb-2">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${Math.min(100, data.currentMonth.income.percentage)}%` }}
              />
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              {data.currentMonth.income.percentage.toFixed(1)}% complete
            </div>
          </div>

          {/* Expense Goal */}
          <div className="border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground font-mono uppercase">EXPENSE LIMIT</div>
              <TrendingDown className="w-4 h-4 text-destructive" />
            </div>
            <div className="text-2xl font-bold font-mono mb-1">
              {formatCurrency(data.currentMonth.expenses.actual)}
            </div>
            <div className="text-xs text-muted-foreground font-mono mb-3">
              of {formatCurrency(data.currentMonth.expenses.target)} limit
            </div>
            <div className="w-full h-2 bg-muted border border-border mb-2">
              <div
                className={`h-full transition-all ${
                  data.currentMonth.expenses.percentage > 100 ? 'bg-destructive' : 'bg-accent'
                }`}
                style={{ width: `${Math.min(100, data.currentMonth.expenses.percentage)}%` }}
              />
            </div>
            <div className={`text-xs font-mono ${
              data.currentMonth.expenses.percentage > 100 ? 'text-destructive' : 'text-muted-foreground'
            }`}>
              {data.currentMonth.expenses.percentage.toFixed(1)}% of limit
              {data.currentMonth.expenses.percentage > 100 && ' - OVER BUDGET!'}
            </div>
          </div>

          {/* Savings Rate Goal */}
          <div className="border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground font-mono uppercase">SAVINGS RATE</div>
              <Target className="w-4 h-4 text-accent" />
            </div>
            <div className="text-2xl font-bold font-mono mb-1">
              {data.currentMonth.savingsRate.actual.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground font-mono mb-3">
              goal: {data.currentMonth.savingsRate.target}%
            </div>
            <div className="w-full h-2 bg-muted border border-border mb-2">
              <div
                className={`h-full transition-all ${
                  data.currentMonth.savingsRate.actual >= data.currentMonth.savingsRate.target
                    ? 'bg-accent'
                    : 'bg-yellow-500'
                }`}
                style={{
                  width: `${Math.min(100, (data.currentMonth.savingsRate.actual / data.currentMonth.savingsRate.target) * 100)}%`
                }}
              />
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              {formatCurrency(data.currentMonth.savingsRate.netSavings)} net savings
            </div>
          </div>
        </div>

        {/* Category Budget Progress */}
        <div className="border border-border bg-card p-6">
          <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
            📊 CATEGORY BUDGET PROGRESS
          </h3>
          <div className="space-y-4">
            {data.categoryProgress.map((cat, index) => (
              <div key={index}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-sm font-bold">{cat.category}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-sm ${cat.overBudget ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {formatCurrency(cat.spent)} / {formatCurrency(cat.target)}
                    </span>
                    {cat.overBudget ? (
                      <span className="text-destructive font-mono text-xs">⚠ OVER</span>
                    ) : (
                      <span className="text-accent font-mono text-xs">{formatCurrency(cat.remaining)} left</span>
                    )}
                  </div>
                </div>
                <div className="w-full h-2 bg-muted border border-border">
                  <div
                    className={`h-full transition-all ${cat.overBudget ? 'bg-destructive' : 'bg-accent'}`}
                    style={{ width: `${Math.min(100, cat.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income vs Expenses Trend */}
          <div className="border border-border bg-card p-6">
            <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
              INCOME VS EXPENSES (6 MONTHS)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthlyProgress}>
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
                <Legend
                  wrapperStyle={{ fontFamily: 'monospace', fontSize: 12 }}
                />
                <Line type="monotone" dataKey="income" stroke="hsl(var(--accent))" strokeWidth={2} name="Income" />
                <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" strokeWidth={2} name="Expenses" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Savings Rate Trend */}
          <div className="border border-border bg-card p-6">
            <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
              SAVINGS RATE TREND
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.monthlyProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    fontFamily: 'monospace',
                    fontSize: 12
                  }}
                  formatter={(value: any) => `${value.toFixed(1)}%`}
                />
                <Bar dataKey="savingsRate" fill="hsl(var(--accent))" name="Savings Rate" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Goal Targets Info */}
        <div className="border border-accent/20 bg-accent/5 p-6">
          <h3 className="text-sm font-mono uppercase text-muted-foreground mb-3">
            💡 CURRENT TARGETS
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-sm">
            <div>
              <span className="text-muted-foreground">Monthly Income:</span>{' '}
              <span className="font-bold">{formatCurrency(data.goals.monthlyIncome)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Monthly Expenses:</span>{' '}
              <span className="font-bold">{formatCurrency(data.goals.monthlyExpenses)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Savings Rate:</span>{' '}
              <span className="font-bold">{data.goals.savingsRate}%</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-3">
            Note: Goals can be customized in Settings (coming soon)
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
