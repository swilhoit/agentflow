'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then(res => res.json())
      .then(json => { setData(json); setLoading(false); })
      .catch(err => { console.error('Error:', err); setLoading(false); });
  }, []);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground font-mono">LOADING ANALYTICS...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) return null;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-mono uppercase">📊 SPENDING ANALYTICS</h1>
          <p className="text-sm text-muted-foreground font-mono mt-2">Deep insights into your spending patterns</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-border bg-card p-6">
            <div className="text-xs text-muted-foreground font-mono uppercase">THIS MONTH</div>
            <div className="text-3xl font-bold font-mono mt-2">{formatCurrency(data.monthlyComparison.thisMonth)}</div>
          </div>
          <div className="border border-border bg-card p-6">
            <div className="text-xs text-muted-foreground font-mono uppercase">LAST MONTH</div>
            <div className="text-3xl font-bold font-mono mt-2">{formatCurrency(data.monthlyComparison.lastMonth)}</div>
          </div>
          <div className="border border-border bg-card p-6">
            <div className="text-xs text-muted-foreground font-mono uppercase">CHANGE</div>
            <div className={`text-3xl font-bold font-mono mt-2 ${data.monthlyComparison.change > 0 ? 'text-destructive' : 'text-accent'}`}>
              {data.monthlyComparison.change > 0 ? '+' : ''}{data.monthlyComparison.change.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-border bg-card p-6">
            <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">TOP MERCHANTS (YTD)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topMerchants} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="merchant" width={100} tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12 }} formatter={(value: any) => formatCurrency(value)} />
                <Bar dataKey="total" fill="hsl(var(--accent))" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border border-border bg-card p-6">
            <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">SPENDING BY DAY</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={data.dayOfWeekSpending}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="day" tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }} />
                <PolarRadiusAxis tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }} />
                <Radar dataKey="avgAmount" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.3} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12 }} formatter={(value: any) => formatCurrency(value)} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-border bg-card p-6">
          <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">LARGEST TRANSACTIONS</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3">DATE</th>
                  <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3">DESCRIPTION</th>
                  <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3">CATEGORY</th>
                  <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {data.largestTransactions.map((txn: any, i: number) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="py-3 font-mono text-sm">{new Date(txn.date).toLocaleDateString()}</td>
                    <td className="py-3 font-mono text-sm truncate max-w-[300px]">{txn.description}</td>
                    <td className="py-3 font-mono text-sm text-muted-foreground">{txn.category || 'Uncategorized'}</td>
                    <td className="py-3 font-mono text-sm text-right font-bold">{formatCurrency(txn.amount)}</td>
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
