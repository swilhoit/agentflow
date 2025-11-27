'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  CreditCard,
  GraduationCap,
  Car,
  Home,
  Wallet,
  MoreHorizontal,
  Plus,
  X,
  Trash2,
  Calendar,
  Percent,
  DollarSign,
  Calculator,
  TrendingDown
} from 'lucide-react';

interface Loan {
  id?: number;
  user_id: string;
  name: string;
  original_amount: number;
  current_balance: number;
  interest_rate: number;
  monthly_payment: number;
  start_date: string;
  payoff_date?: string;
  loan_type: 'personal' | 'student' | 'auto' | 'mortgage' | 'credit' | 'other';
  status: 'active' | 'paid_off' | 'deferred';
  percentPaid?: number;
  monthsRemaining?: number;
  totalInterestPaid?: number;
}

interface LoanSummary {
  totalOwed: number;
  totalMonthlyPayment: number;
  totalInterestRate: number;
  monthsUntilDebtFree: number;
  loans: Loan[];
}

const LOAN_TYPE_ICONS: Record<string, React.ElementType> = {
  personal: Wallet,
  student: GraduationCap,
  auto: Car,
  mortgage: Home,
  credit: CreditCard,
  other: MoreHorizontal
};

const LOAN_TYPE_COLORS: Record<string, string> = {
  personal: 'bg-emerald-500',
  student: 'bg-blue-500',
  auto: 'bg-orange-500',
  mortgage: 'bg-red-500',
  credit: 'bg-purple-500',
  other: 'bg-gray-500'
};

function LoansPageSkeleton() {
  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-28" />
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex gap-4 mb-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function LoansPage() {
  const [data, setData] = useState<LoanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [extraPayment, setExtraPayment] = useState(0);

  const [newLoan, setNewLoan] = useState<Partial<Loan>>({
    name: '',
    original_amount: 0,
    current_balance: 0,
    interest_rate: 0,
    monthly_payment: 0,
    loan_type: 'personal',
    status: 'active'
  });

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/loans?userId=default_user');
      if (!response.ok) {
        throw new Error('Failed to fetch loans');
      }
      const json = await response.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLoan = async () => {
    try {
      const response = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newLoan, user_id: 'default_user' })
      });

      if (!response.ok) {
        throw new Error('Failed to add loan');
      }

      setShowAddLoan(false);
      setNewLoan({
        name: '',
        original_amount: 0,
        current_balance: 0,
        interest_rate: 0,
        monthly_payment: 0,
        loan_type: 'personal',
        status: 'active'
      });
      fetchLoans();
    } catch (err: any) {
      alert('Error adding loan: ' + err.message);
    }
  };

  const handleDeleteLoan = async (loanId: number) => {
    if (!confirm('Are you sure you want to delete this loan?')) return;

    try {
      const response = await fetch(`/api/loans?id=${loanId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete loan');
      }

      fetchLoans();
    } catch (err: any) {
      alert('Error deleting loan: ' + err.message);
    }
  };

  const calculatePayoffWithExtra = (loan: Loan, extra: number) => {
    const newPayment = loan.monthly_payment + extra;
    const monthlyRate = loan.interest_rate / 100 / 12;

    if (monthlyRate === 0) {
      return Math.ceil(loan.current_balance / newPayment);
    }

    const months = -Math.log(1 - (monthlyRate * loan.current_balance) / newPayment) / Math.log(1 + monthlyRate);
    return Math.ceil(months);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return <LoansPageSkeleton />;
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

  const debtFreeDate = new Date();
  debtFreeDate.setMonth(debtFreeDate.getMonth() + data.monthsUntilDebtFree);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Loans</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track all loans and payoff progress
            </p>
          </div>
          <Button onClick={() => setShowAddLoan(!showAddLoan)}>
            {showAddLoan ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add Loan
              </>
            )}
          </Button>
        </div>

        {/* Add Loan Form */}
        {showAddLoan && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add New Loan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Loan Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Car Loan"
                    className="w-full border border-border bg-background px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={newLoan.name}
                    onChange={(e) => setNewLoan({ ...newLoan, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Loan Type</label>
                  <select
                    className="w-full border border-border bg-background px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={newLoan.loan_type}
                    onChange={(e) => setNewLoan({ ...newLoan, loan_type: e.target.value as any })}
                  >
                    <option value="personal">Personal</option>
                    <option value="student">Student</option>
                    <option value="auto">Auto</option>
                    <option value="mortgage">Mortgage</option>
                    <option value="credit">Credit Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Original Amount</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full border border-border bg-background px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={newLoan.original_amount || ''}
                    onChange={(e) => setNewLoan({ ...newLoan, original_amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Current Balance</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full border border-border bg-background px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={newLoan.current_balance || ''}
                    onChange={(e) => setNewLoan({ ...newLoan, current_balance: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Interest Rate (%)</label>
                  <input
                    type="number"
                    placeholder="0"
                    step="0.1"
                    className="w-full border border-border bg-background px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={newLoan.interest_rate || ''}
                    onChange={(e) => setNewLoan({ ...newLoan, interest_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Monthly Payment</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full border border-border bg-background px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={newLoan.monthly_payment || ''}
                    onChange={(e) => setNewLoan({ ...newLoan, monthly_payment: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="mt-6">
                <Button onClick={handleAddLoan}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Loan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-medium">Total Owed</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{formatCurrency(data.totalOwed)}</div>
              <div className="text-xs text-muted-foreground mt-1">{data.loans.length} active loans</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingDown className="w-4 h-4" />
                <span className="text-xs font-medium">Monthly Payment</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{formatCurrency(data.totalMonthlyPayment)}</div>
              <div className="text-xs text-muted-foreground mt-1">Combined total</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">Debt Free Date</span>
              </div>
              <div className="text-2xl font-semibold">{formatDate(debtFreeDate.toISOString())}</div>
              <div className="text-xs text-muted-foreground mt-1 tabular-nums">{data.monthsUntilDebtFree} months</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Percent className="w-4 h-4" />
                <span className="text-xs font-medium">Avg Interest</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">{data.totalInterestRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground mt-1">Weighted average</div>
            </CardContent>
          </Card>
        </div>

        {/* Payoff Calculator */}
        {data.loans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Payoff Scenario Calculator
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-muted-foreground">Extra Monthly Payment</label>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(extraPayment)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="50"
                    value={extraPayment}
                    onChange={(e) => setExtraPayment(parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                {extraPayment > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {data.loans.map((loan) => {
                      const newMonths = calculatePayoffWithExtra(loan, extraPayment);
                      const monthsSaved = (loan.monthsRemaining || 0) - newMonths;
                      return (
                        <div key={loan.id} className="p-4 bg-secondary/50 rounded-lg">
                          <div className="font-medium text-sm">{loan.name}</div>
                          <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                            Payoff in {newMonths} months
                          </div>
                          <div className="text-xs text-success mt-1 tabular-nums font-medium">
                            Save {monthsSaved} months!
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loan Cards */}
        {data.loans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-muted-foreground">
                No loans yet. Click "Add Loan" to get started.
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.loans.map((loan) => {
              const Icon = LOAN_TYPE_ICONS[loan.loan_type];
              return (
                <Card key={loan.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          LOAN_TYPE_COLORS[loan.loan_type]
                        )}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{loan.name}</h3>
                          <p className="text-xs text-muted-foreground capitalize">{loan.loan_type} Loan</p>
                        </div>
                      </div>
                      <button
                        onClick={() => loan.id && handleDeleteLoan(loan.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Original</div>
                        <div className="font-semibold tabular-nums">{formatCurrency(loan.original_amount)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Balance</div>
                        <div className="font-semibold tabular-nums">{formatCurrency(loan.current_balance)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Rate</div>
                        <div className="font-semibold tabular-nums">{loan.interest_rate}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Monthly</div>
                        <div className="font-semibold tabular-nums">{formatCurrency(loan.monthly_payment)}</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span>Progress</span>
                        <span className="tabular-nums">{loan.percentPaid?.toFixed(1)}% paid</span>
                      </div>
                      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", LOAN_TYPE_COLORS[loan.loan_type])}
                          style={{ width: `${loan.percentPaid}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-xs">
                      <div>
                        <span className="text-muted-foreground">Payoff:</span>{' '}
                        <span className="font-medium">{formatDate(loan.payoff_date)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Interest:</span>{' '}
                        <span className="font-medium tabular-nums">{formatCurrency(loan.totalInterestPaid || 0)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
