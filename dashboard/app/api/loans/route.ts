import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export interface Loan {
  id?: string;
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
  created_at?: string;
  updated_at?: string;
}

interface LoanSummary {
  totalOwed: number;
  totalMonthlyPayment: number;
  totalInterestRate: number;
  monthsUntilDebtFree: number;
  loans: Array<Loan & {
    percentPaid: number;
    monthsRemaining: number;
    totalInterestPaid: number;
  }>;
}

function calculateMonthsRemaining(balance: number, monthlyPayment: number, interestRate: number): number {
  if (monthlyPayment <= 0 || balance <= 0) return 0;

  const monthlyRate = interestRate / 100 / 12;
  if (monthlyRate === 0) {
    return Math.ceil(balance / monthlyPayment);
  }

  // Using loan formula: n = -log(1 - r*P/A) / log(1 + r)
  const months = -Math.log(1 - (monthlyRate * balance) / monthlyPayment) / Math.log(1 + monthlyRate);
  return Math.ceil(months);
}

function calculateTotalInterest(balance: number, monthlyPayment: number, interestRate: number): number {
  const months = calculateMonthsRemaining(balance, monthlyPayment, interestRate);
  const totalPaid = monthlyPayment * months;
  return Math.max(0, totalPaid - balance);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default_user';

    // Get all active loans for user from loans table
    const result = await query(
      `SELECT * FROM loans
       WHERE user_id = $1 AND status = 'active'
       ORDER BY current_balance DESC`,
      [userId]
    );

    // Map database rows to loan format
    const loans: Loan[] = (result.rows || []).map((loan: any) => ({
      id: loan.id,
      user_id: loan.user_id,
      name: loan.name,
      original_amount: Number(loan.original_amount),
      current_balance: Number(loan.current_balance),
      interest_rate: Number(loan.interest_rate) || 0,
      monthly_payment: Number(loan.monthly_payment),
      start_date: loan.start_date,
      payoff_date: loan.payoff_date,
      loan_type: loan.loan_type as Loan['loan_type'],
      status: loan.status as Loan['status'],
      created_at: loan.created_at,
      updated_at: loan.updated_at
    }));

    // Calculate summary statistics
    let totalOwed = 0;
    let totalMonthlyPayment = 0;
    let maxMonthsRemaining = 0;

    const loansWithCalcs = loans.map(loan => {
      const percentPaid = loan.original_amount > 0
        ? ((loan.original_amount - loan.current_balance) / loan.original_amount) * 100
        : 0;

      const monthsRemaining = calculateMonthsRemaining(
        loan.current_balance,
        loan.monthly_payment,
        loan.interest_rate
      );

      const totalInterestPaid = calculateTotalInterest(
        loan.current_balance,
        loan.monthly_payment,
        loan.interest_rate
      );

      totalOwed += loan.current_balance;
      totalMonthlyPayment += loan.monthly_payment;
      maxMonthsRemaining = Math.max(maxMonthsRemaining, monthsRemaining);

      return {
        ...loan,
        percentPaid,
        monthsRemaining,
        totalInterestPaid
      };
    });

    const summary: LoanSummary = {
      totalOwed,
      totalMonthlyPayment,
      totalInterestRate: loans.length > 0
        ? loans.reduce((sum, l) => sum + l.interest_rate, 0) / loans.length
        : 0,
      monthsUntilDebtFree: maxMonthsRemaining,
      loans: loansWithCalcs
    };

    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('Error fetching loans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loans', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const loan = await request.json() as Loan;

    // Validate required fields
    if (!loan.name || !loan.original_amount || !loan.current_balance || !loan.monthly_payment) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Set defaults
    loan.user_id = loan.user_id || 'default_user';
    loan.loan_type = loan.loan_type || 'personal';
    loan.status = loan.status || 'active';
    loan.start_date = loan.start_date || new Date().toISOString().split('T')[0];

    // Calculate estimated payoff date
    if (!loan.payoff_date) {
      const months = calculateMonthsRemaining(
        loan.current_balance,
        loan.monthly_payment,
        loan.interest_rate
      );
      const payoffDate = new Date();
      payoffDate.setMonth(payoffDate.getMonth() + months);
      loan.payoff_date = payoffDate.toISOString().split('T')[0];
    }

    // Insert into loans table
    const result = await query(
      `INSERT INTO loans (user_id, name, original_amount, current_balance, interest_rate, monthly_payment, start_date, payoff_date, loan_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        loan.user_id,
        loan.name,
        loan.original_amount,
        loan.current_balance,
        loan.interest_rate || 0,
        loan.monthly_payment,
        loan.start_date,
        loan.payoff_date,
        loan.loan_type,
        loan.status
      ]
    );

    return NextResponse.json({
      success: true,
      loanId: result.rows[0]?.id
    });

  } catch (error: any) {
    console.error('Error creating loan:', error);
    return NextResponse.json(
      { error: 'Failed to create loan', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('id');

    if (!loanId) {
      return NextResponse.json(
        { error: 'Loan ID is required' },
        { status: 400 }
      );
    }

    await query('DELETE FROM loans WHERE id = $1', [loanId]);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error deleting loan:', error);
    return NextResponse.json(
      { error: 'Failed to delete loan', details: error.message },
      { status: 500 }
    );
  }
}
