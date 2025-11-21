'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

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

const LOAN_TYPE_ICONS: Record<string, string> = {
  personal: '=d',
  student: '<�',
  auto: '=�',
  mortgage: '<�',
  credit: '=�',
  other: '=�'
};

const LOAN_TYPE_COLORS: Record<string, string> = {
  personal: '#00aa66',
  student: '#3377ff',
  auto: '#ff8800',
  mortgage: '#dd3333',
  credit: '#00ff88',
  other: '#999999'
};

export default function LoansPage() {
  const [data, setData] = useState<LoanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [extraPayment, setExtraPayment] = useState(0);

  // New loan form
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
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading loans...</div>
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

  const debtFreeDate = new Date();
  debtFreeDate.setMonth(debtFreeDate.getMonth() + data.monthsUntilDebtFree);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-mono uppercase">=� LOAN PAYBACK TRACKER</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Track all loans and payoff progress
          </p>
        </div>
        <button
          onClick={() => setShowAddLoan(!showAddLoan)}
          className="border border-border bg-accent text-accent-foreground px-4 py-2 hover:opacity-80 transition-opacity font-mono text-sm"
        >
          {showAddLoan ? 'Cancel' : '+ Add Loan'}
        </button>
      </div>

      {/* Add Loan Form */}
      {showAddLoan && (
        <div className="border border-border bg-card p-6 space-y-4">
          <h3 className="font-mono text-sm uppercase text-muted-foreground">Add New Loan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Loan Name"
              className="border border-border bg-background p-2 font-mono text-sm"
              value={newLoan.name}
              onChange={(e) => setNewLoan({ ...newLoan, name: e.target.value })}
            />
            <select
              className="border border-border bg-background p-2 font-mono text-sm"
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
            <input
              type="number"
              placeholder="Original Amount"
              className="border border-border bg-background p-2 font-mono text-sm"
              value={newLoan.original_amount || ''}
              onChange={(e) => setNewLoan({ ...newLoan, original_amount: parseFloat(e.target.value) || 0 })}
            />
            <input
              type="number"
              placeholder="Current Balance"
              className="border border-border bg-background p-2 font-mono text-sm"
              value={newLoan.current_balance || ''}
              onChange={(e) => setNewLoan({ ...newLoan, current_balance: parseFloat(e.target.value) || 0 })}
            />
            <input
              type="number"
              placeholder="Interest Rate (%)"
              className="border border-border bg-background p-2 font-mono text-sm"
              value={newLoan.interest_rate || ''}
              onChange={(e) => setNewLoan({ ...newLoan, interest_rate: parseFloat(e.target.value) || 0 })}
            />
            <input
              type="number"
              placeholder="Monthly Payment"
              className="border border-border bg-background p-2 font-mono text-sm"
              value={newLoan.monthly_payment || ''}
              onChange={(e) => setNewLoan({ ...newLoan, monthly_payment: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <button
            onClick={handleAddLoan}
            className="border border-border bg-accent text-accent-foreground px-6 py-2 hover:opacity-80 transition-opacity font-mono text-sm"
          >
            Add Loan
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border border-border bg-card p-6">
          <div className="text-xs text-muted-foreground font-mono uppercase">Total Owed</div>
          <div className="text-3xl font-bold font-mono mt-2">{formatCurrency(data.totalOwed)}</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">{data.loans.length} active loans</div>
        </div>

        <div className="border border-border bg-card p-6">
          <div className="text-xs text-muted-foreground font-mono uppercase">Monthly Payment</div>
          <div className="text-3xl font-bold font-mono mt-2">{formatCurrency(data.totalMonthlyPayment)}</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">Combined total</div>
        </div>

        <div className="border border-border bg-card p-6">
          <div className="text-xs text-muted-foreground font-mono uppercase">Debt Free Date</div>
          <div className="text-3xl font-bold font-mono mt-2">{formatDate(debtFreeDate.toISOString())}</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">{data.monthsUntilDebtFree} months</div>
        </div>

        <div className="border border-border bg-card p-6">
          <div className="text-xs text-muted-foreground font-mono uppercase">Avg Interest</div>
          <div className="text-3xl font-bold font-mono mt-2">{data.totalInterestRate.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">Weighted average</div>
        </div>
      </div>

      {/* Payoff Calculator */}
      {data.loans.length > 0 && (
        <div className="border border-border bg-card p-6">
          <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
            =� Payoff Scenario Calculator
          </h3>
          <div className="space-y-4">
            <div>
              <label className="font-mono text-sm text-muted-foreground">Extra Monthly Payment: ${extraPayment}</label>
              <input
                type="range"
                min="0"
                max="1000"
                step="50"
                value={extraPayment}
                onChange={(e) => setExtraPayment(parseInt(e.target.value))}
                className="w-full mt-2"
              />
            </div>
            {extraPayment > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {data.loans.map((loan) => {
                  const newMonths = calculatePayoffWithExtra(loan, extraPayment);
                  const monthsSaved = (loan.monthsRemaining || 0) - newMonths;
                  return (
                    <div key={loan.id} className="border border-border bg-background p-4">
                      <div className="font-mono text-sm font-bold">{loan.name}</div>
                      <div className="font-mono text-xs text-muted-foreground mt-1">
                        Payoff in {newMonths} months
                      </div>
                      <div className="font-mono text-xs text-accent mt-1">
                        Save {monthsSaved} months!
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loan Cards */}
      {data.loans.length === 0 ? (
        <div className="border border-border bg-card p-12 text-center">
          <div className="text-muted-foreground font-mono">
            No loans yet. Click "+ Add Loan" to get started.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.loans.map((loan) => (
            <div key={loan.id} className="border border-border bg-card p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{LOAN_TYPE_ICONS[loan.loan_type]}</span>
                  <div>
                    <h3 className="font-mono font-bold">{loan.name}</h3>
                    <p className="font-mono text-xs text-muted-foreground capitalize">{loan.loan_type} Loan</p>
                  </div>
                </div>
                <button
                  onClick={() => loan.id && handleDeleteLoan(loan.id)}
                  className="text-destructive hover:opacity-70 font-mono text-xs"
                >
                  Delete
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 font-mono text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Original</div>
                  <div className="font-bold">{formatCurrency(loan.original_amount)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Balance</div>
                  <div className="font-bold">{formatCurrency(loan.current_balance)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Rate</div>
                  <div className="font-bold">{loan.interest_rate}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Monthly</div>
                  <div className="font-bold">{formatCurrency(loan.monthly_payment)}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-2">
                <div className="flex justify-between font-mono text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{loan.percentPaid?.toFixed(1)}% paid</span>
                </div>
                <div className="w-full h-2 bg-muted border border-border">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${loan.percentPaid}%`,
                      backgroundColor: LOAN_TYPE_COLORS[loan.loan_type]
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-between font-mono text-xs mt-4">
                <div>
                  <span className="text-muted-foreground">Payoff:</span>{' '}
                  <span className="font-bold">{formatDate(loan.payoff_date)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Interest:</span>{' '}
                  <span className="font-bold">{formatCurrency(loan.totalInterestPaid || 0)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
