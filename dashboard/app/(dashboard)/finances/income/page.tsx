'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Calendar, DollarSign, BarChart3 } from 'lucide-react';

interface IncomeSummary {
  thisMonth: number;
  lastMonth: number;
  ytd: number;
  avgPerMonth: number;
  changeFromLastMonth: number;
}

interface IncomeData {
  summary: IncomeSummary;
  trend: Array<{ month: string; amount: number }>;
  sources: Array<{ source: string; amount: number; count: number; percentage: number }>;
  transactions: Array<{
    id: number;
    date: string;
    description: string;
    amount: number;
    category: string | null;
    account_name: string | null;
    merchant: string | null;
  }>;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  '#f59e0b',
  'hsl(var(--destructive))',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#6b7280'
];

function IncomePageSkeleton() {
  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
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
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function IncomeTrackerPage() {
  const [data, setData] = useState<IncomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIncomeData();
  }, []);

  const fetchIncomeData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/finances/income');
      if (!response.ok) {
        throw new Error('Failed to fetch income data');
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return <IncomePageSkeleton />;
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
          <h1 className="text-2xl font-semibold text-foreground">Income Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track all income sources and trends
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-medium">This Month</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{formatCurrency(data.summary.thisMonth)}</div>
              <div className={cn(
                "text-xs mt-1 tabular-nums",
                data.summary.changeFromLastMonth >= 0 ? 'text-success' : 'text-destructive'
              )}>
                {data.summary.changeFromLastMonth >= 0 ? '+' : ''}{data.summary.changeFromLastMonth.toFixed(1)}% vs last month
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">Last Month</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{formatCurrency(data.summary.lastMonth)}</div>
              <div className="text-xs text-muted-foreground mt-1">Previous period</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-xs font-medium">YTD Total</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{formatCurrency(data.summary.ytd)}</div>
              <div className="text-xs text-muted-foreground mt-1">Year to date</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <BarChart3 className="w-4 h-4" />
                <span className="text-xs font-medium">Avg/Month</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{formatCurrency(data.summary.avgPerMonth)}</div>
              <div className="text-xs text-muted-foreground mt-1">Last 12 months</div>
            </CardContent>
          </Card>
        </div>

        {/* Income Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income Trend (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.trend}>
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
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Income Sources */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Income Sources (YTD)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.sources}
                    dataKey="amount"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ percent }) => percent ? `${(percent * 100).toFixed(1)}%` : ''}
                    labelLine={{ stroke: 'hsl(var(--border))' }}
                  >
                    {data.sources.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

          {/* Sources Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Income Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.sources.slice(0, 8).map((source, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm truncate max-w-[200px]">{source.source}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm tabular-nums">{formatCurrency(source.amount)}</div>
                      <div className="text-xs text-muted-foreground">{source.count} payments</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Income Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground py-3">Date</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3">Description</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3">Category</th>
                    <th className="text-right text-xs font-medium text-muted-foreground py-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.slice(0, 20).map((transaction) => (
                    <tr key={transaction.id} className="border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 text-sm">{formatDate(transaction.date)}</td>
                      <td className="py-3 text-sm truncate max-w-[300px]">{transaction.description}</td>
                      <td className="py-3 text-sm text-muted-foreground">{transaction.category || 'Uncategorized'}</td>
                      <td className="py-3 text-sm text-right font-semibold text-success tabular-nums">
                        +{formatCurrency(transaction.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
