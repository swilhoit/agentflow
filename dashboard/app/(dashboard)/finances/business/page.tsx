'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Building2, Calendar, DollarSign, Receipt, FileText, Calculator } from 'lucide-react';

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
  'Advertising & Marketing': 'hsl(var(--success))',
  'Office Supplies': 'hsl(var(--primary))',
  'Software & Subscriptions': '#f59e0b',
  'Travel & Meals': 'hsl(var(--destructive))',
  'Professional Services': '#8b5cf6',
  'Equipment & Depreciation': '#06b6d4',
  'Home Office': '#ec4899',
  'Other Business Expenses': '#6b7280',
  'Uncategorized': '#9ca3af'
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

function BusinessPageSkeleton() {
  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
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
            <div className="grid grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
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
    return <BusinessPageSkeleton />;
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

  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Business Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Separate business spending for taxes (IRS-compliant categories)
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">This Month</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{formatCurrency(data.thisMonth)}</div>
              <div className="text-xs text-muted-foreground mt-1">Business expenses</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Building2 className="w-4 h-4" />
                <span className="text-xs font-medium">This Quarter</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{formatCurrency(data.thisQuarter)}</div>
              <div className="text-xs text-muted-foreground mt-1">Q{currentQuarter} total</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-medium">YTD Total</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{formatCurrency(data.ytd)}</div>
              <div className="text-xs text-muted-foreground mt-1">Year to date</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calculator className="w-4 h-4 text-success" />
                <span className="text-xs font-medium">Tax Deductible</span>
              </div>
              <div className="text-2xl font-semibold text-success tabular-nums">{formatCurrency(data.taxDeductible)}</div>
              <div className="text-xs text-muted-foreground mt-1">50% for meals</div>
            </CardContent>
          </Card>
        </div>

        {/* Quarterly Tax Estimate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Quarterly Tax Estimates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {['q1', 'q2', 'q3', 'q4'].map((q, index) => {
                const quarterNum = index + 1;
                const amount = data.quarterlyTaxEstimate[q as keyof typeof data.quarterlyTaxEstimate] as number;
                const isCurrent = quarterNum === currentQuarter;

                return (
                  <div
                    key={q}
                    className={cn(
                      "p-4 rounded-lg border",
                      isCurrent ? 'bg-primary/5 border-primary/30' : 'bg-secondary/50 border-border'
                    )}
                  >
                    <div className="text-xs text-muted-foreground">Q{quarterNum}</div>
                    <div className="text-xl font-semibold tabular-nums mt-1">{formatCurrency(amount)}</div>
                    {isCurrent && (
                      <Badge variant="outline" className="text-[10px] mt-2 text-primary border-primary/30">
                        Current
                      </Badge>
                    )}
                  </div>
                );
              })}
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                <div className="text-xs text-muted-foreground">Next Due</div>
                <div className="text-sm font-semibold mt-1">{formatDate(data.quarterlyTaxEstimate.nextDueDate)}</div>
                <div className="text-xs text-muted-foreground mt-1">Payment deadline</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Breakdown Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">IRS Category Breakdown (YTD)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.categoryBreakdown}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ percent }) => percent ? `${(percent * 100).toFixed(1)}%` : ''}
                    labelLine={{ stroke: 'hsl(var(--border))' }}
                  >
                    {data.categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || '#9ca3af'} />
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

          {/* Category Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Category Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {data.categoryBreakdown.map((cat, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[cat.category] || '#9ca3af' }}
                      />
                      <span className="text-sm">{cat.category}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm tabular-nums">{formatCurrency(cat.amount)}</div>
                      <div className="text-xs text-muted-foreground">{cat.count} expenses</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Business Expenses (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.monthlyTrend}>
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
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Business Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground py-3">Date</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3">Description</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3">Tax Category</th>
                    <th className="text-right text-xs font-medium text-muted-foreground py-3">Amount</th>
                    <th className="text-center text-xs font-medium text-muted-foreground py-3">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.slice(0, 50).map((transaction) => (
                    <tr key={transaction.id} className="border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 text-sm">{formatDate(transaction.date)}</td>
                      <td className="py-3 text-sm truncate max-w-[300px]">{transaction.description}</td>
                      <td className="py-3 text-sm">
                        {selectedTransaction === transaction.id ? (
                          <select
                            className="border border-border bg-background px-2 py-1 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                            className="text-left hover:text-primary transition-colors"
                          >
                            {transaction.tax_category || (
                              <span className="text-muted-foreground italic text-xs">Add category</span>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="py-3 text-sm text-right font-semibold tabular-nums">
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td className="py-3 text-sm text-center">
                        {transaction.receipt_url ? (
                          <a
                            href={transaction.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:opacity-70"
                          >
                            <Receipt className="w-4 h-4 inline" />
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
