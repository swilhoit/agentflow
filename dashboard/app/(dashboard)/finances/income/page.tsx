'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

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

const COLORS = ['#00aa66', '#3377ff', '#ff8800', '#dd3333', '#00ff88', '#5599ff', '#ffaa00', '#ff5555'];

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
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading income data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="border border-destructive bg-destructive/10 p-4 text-destructive">
          Error: {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <div className="text-muted-foreground">No data available</div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-mono uppercase">=� INCOME TRACKER</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Track all income sources and trends
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border border-border bg-card p-6">
          <div className="text-xs text-muted-foreground font-mono uppercase">This Month</div>
          <div className="text-3xl font-bold font-mono mt-2">{formatCurrency(data.summary.thisMonth)}</div>
          <div className={`text-xs font-mono mt-1 ${data.summary.changeFromLastMonth >= 0 ? 'text-accent' : 'text-destructive'}`}>
            {data.summary.changeFromLastMonth >= 0 ? '+' : ''}{data.summary.changeFromLastMonth.toFixed(1)}% vs last month
          </div>
        </div>

        <div className="border border-border bg-card p-6">
          <div className="text-xs text-muted-foreground font-mono uppercase">Last Month</div>
          <div className="text-3xl font-bold font-mono mt-2">{formatCurrency(data.summary.lastMonth)}</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">Previous period</div>
        </div>

        <div className="border border-border bg-card p-6">
          <div className="text-xs text-muted-foreground font-mono uppercase">YTD Total</div>
          <div className="text-3xl font-bold font-mono mt-2">{formatCurrency(data.summary.ytd)}</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">Year to date</div>
        </div>

        <div className="border border-border bg-card p-6">
          <div className="text-xs text-muted-foreground font-mono uppercase">Avg/Month</div>
          <div className="text-3xl font-bold font-mono mt-2">{formatCurrency(data.summary.avgPerMonth)}</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">Last 12 months</div>
        </div>
      </div>

      {/* Income Trend Chart */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
          Income Trend (Last 12 Months)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="month"
              tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 12 }}
            />
            <YAxis
              tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 12 }}
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
            <Line
              type="monotone"
              dataKey="amount"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ fill: 'var(--accent)', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Income Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="border border-border bg-card p-6">
          <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
            Income Sources (YTD)
          </h3>
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
                labelLine={{ stroke: 'var(--border)' }}
              >
                {data.sources.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

        {/* Sources Table */}
        <div className="border border-border bg-card p-6">
          <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
            Top Income Sources
          </h3>
          <div className="space-y-2">
            {data.sources.slice(0, 8).map((source, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="font-mono text-sm truncate max-w-[200px]">{source.source}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold">{formatCurrency(source.amount)}</div>
                  <div className="font-mono text-xs text-muted-foreground">{source.count} payments</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
          Recent Income Transactions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3">Date</th>
                <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3">Description</th>
                <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3">Category</th>
                <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.slice(0, 20).map((transaction) => (
                <tr key={transaction.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="py-3 font-mono text-sm">{formatDate(transaction.date)}</td>
                  <td className="py-3 font-mono text-sm truncate max-w-[300px]">{transaction.description}</td>
                  <td className="py-3 font-mono text-sm text-muted-foreground">{transaction.category || 'Uncategorized'}</td>
                  <td className="py-3 font-mono text-sm text-right font-bold text-accent">
                    +{formatCurrency(transaction.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}
