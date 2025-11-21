'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

const TAX_CATEGORIES = [
  'Advertising & Marketing',
  'Office Supplies',
  'Software & Subscriptions',
  'Travel & Meals',
  'Professional Services',
  'Equipment & Depreciation',
  'Home Office',
  'Other Business Expenses'
];

const CATEGORY_COLORS: Record<string, string> = {
  'Advertising & Marketing': '#00aa66',
  'Office Supplies': '#3377ff',
  'Software & Subscriptions': '#ff8800',
  'Travel & Meals': '#dd3333',
  'Professional Services': '#00ff88',
  'Equipment & Depreciation': '#5599ff',
  'Home Office': '#ffaa00',
  'Other Business Expenses': '#999999',
  'Uncategorized': '#666666'
};

interface BusinessExpenseSummary {
  thisMonth: number;
  thisQuarter: number;
  ytd: number;
  taxDeductible: number;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    amount: number;
  }>;
  transactions: Array<{
    id: number;
    date: string;
    description: string;
    amount: number;
    category: string | null;
    tax_category: string | null;
    merchant: string | null;
    receipt_url: string | null;
  }>;
  quarterlyTaxEstimate: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    current: number;
    nextDueDate: string;
  };
}

export default function BusinessExpensesPage() {
  const [data, setData] = useState<BusinessExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<string>('');

  useEffect(() => {
    fetchBusinessExpenses();
  }, []);

  const fetchBusinessExpenses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/finances/business');
      if (!response.ok) {
        throw new Error('Failed to fetch business expenses');
      }
      const json = await response.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = async (transactionId: number, taxCategory: string) => {
    try {
      const response = await fetch('/api/finances/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          taxCategory,
          isBusinessExpense: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update category');
      }

      setSelectedTransaction(null);
      setEditingCategory('');
      fetchBusinessExpenses();
    } catch (err: any) {
      alert('Error updating category: ' + err.message);
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
      <DashboardLayout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading business expenses...</div>
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
        <h1 className="text-3xl font-bold"><� BUSINESS EXPENSES TRACKER</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Separate business spending for taxes (IRS-compliant categories)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border border-border bg-card p-6">
          <div className="text-xs text-muted-foreground font-mono uppercase">This Month</div>
          <div className="text-3xl font-bold font-mono mt-2">{formatCurrency(data.thisMonth)}</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">Business expenses</div>
        </div>

        <div className="border border-border bg-card p-6">
          <div className="text-xs text-muted-foreground font-mono uppercase">This Quarter</div>
          <div className="text-3xl font-bold font-mono mt-2">{formatCurrency(data.thisQuarter)}</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">Q{Math.floor(new Date().getMonth() / 3) + 1} total</div>
        </div>

        <div className="border border-border bg-card p-6">
          <div className="text-xs text-muted-foreground font-mono uppercase">YTD Total</div>
          <div className="text-3xl font-bold font-mono mt-2">{formatCurrency(data.ytd)}</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">Year to date</div>
        </div>

        <div className="border border-border bg-card p-6">
          <div className="text-xs text-muted-foreground font-mono uppercase">Tax Deductible</div>
          <div className="text-3xl font-bold font-mono mt-2 text-accent">{formatCurrency(data.taxDeductible)}</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">50% for meals</div>
        </div>
      </div>

      {/* Quarterly Tax Estimate */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
          =� Quarterly Tax Estimates
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {['q1', 'q2', 'q3', 'q4'].map((q, index) => {
            const quarterNum = index + 1;
            const amount = data.quarterlyTaxEstimate[q as keyof typeof data.quarterlyTaxEstimate] as number;
            const isCurrent = quarterNum === Math.floor(new Date().getMonth() / 3) + 1;

            return (
              <div key={q} className={`border border-border p-4 ${isCurrent ? 'bg-accent/10' : 'bg-background'}`}>
                <div className="text-xs text-muted-foreground font-mono">Q{quarterNum}</div>
                <div className="text-xl font-bold font-mono mt-1">{formatCurrency(amount)}</div>
                {isCurrent && <div className="text-xs text-accent font-mono mt-1">Current</div>}
              </div>
            );
          })}
          <div className="border border-border bg-accent/20 p-4">
            <div className="text-xs text-muted-foreground font-mono">Next Due</div>
            <div className="text-sm font-bold font-mono mt-1">{formatDate(data.quarterlyTaxEstimate.nextDueDate)}</div>
            <div className="text-xs text-muted-foreground font-mono mt-1">Payment deadline</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Pie Chart */}
        <div className="border border-border bg-card p-6">
          <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
            IRS Category Breakdown (YTD)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.categoryBreakdown}
                dataKey="amount"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ percentage }) => `${percentage.toFixed(1)}%`}
                labelLine={{ stroke: 'var(--border)' }}
              >
                {data.categoryBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || '#999999'} />
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

        {/* Category Table */}
        <div className="border border-border bg-card p-6">
          <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
            Category Summary
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {data.categoryBreakdown.map((cat, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3"
                    style={{ backgroundColor: CATEGORY_COLORS[cat.category] || '#999999' }}
                  />
                  <span className="font-mono text-sm">{cat.category}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold">{formatCurrency(cat.amount)}</div>
                  <div className="font-mono text-xs text-muted-foreground">{cat.count} expenses</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
          Monthly Business Expenses (Last 12 Months)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.monthlyTrend}>
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
            <Bar dataKey="amount" fill="var(--accent)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Business Transactions */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
          Business Transactions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3">Date</th>
                <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3">Description</th>
                <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3">Tax Category</th>
                <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3">Amount</th>
                <th className="text-center font-mono text-xs uppercase text-muted-foreground py-3">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.slice(0, 50).map((transaction) => (
                <tr key={transaction.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="py-3 font-mono text-sm">{formatDate(transaction.date)}</td>
                  <td className="py-3 font-mono text-sm truncate max-w-[300px]">{transaction.description}</td>
                  <td className="py-3 font-mono text-sm">
                    {selectedTransaction === transaction.id ? (
                      <select
                        className="border border-border bg-background p-1 text-xs"
                        value={editingCategory}
                        onChange={(e) => {
                          setEditingCategory(e.target.value);
                          handleCategoryChange(transaction.id, e.target.value);
                        }}
                      >
                        <option value="">Select category...</option>
                        {TAX_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedTransaction(transaction.id);
                          setEditingCategory(transaction.tax_category || '');
                        }}
                        className="text-left hover:text-accent transition-colors"
                      >
                        {transaction.tax_category || (
                          <span className="text-muted-foreground italic">Add category</span>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="py-3 font-mono text-sm text-right font-bold">
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td className="py-3 font-mono text-sm text-center">
                    {transaction.receipt_url ? (
                      <a href={transaction.receipt_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:opacity-70">
                        =�
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
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
