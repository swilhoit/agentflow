import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

interface FinancialOverview {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    savingsRate: number;
    businessExpenses: number;
    loanPayments: number;
  };
  accounts: Array<{
    name: string;
    type: string;
    balance: number;
    institution: string;
  }>;
  monthlyTrend: Array<{
    month: string;
    income: number;
    expenses: number;
    net: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  upcomingPayments: Array<{
    type: 'loan' | 'bill' | 'tax';
    name: string;
    amount: number;
    dueDate: string;
  }>;
  recentTransactions: Array<{
    date: string;
    description: string;
    amount: number;
    category: string | null;
    merchant: string | null;
  }>;
}

export async function GET(request: Request) {
  try {
    const db = getDatabase();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const thisMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const nextMonthStart = `${currentMonth === 12 ? currentYear + 1 : currentYear}-${String(currentMonth === 12 ? 1 : currentMonth + 1).padStart(2, '0')}-01`;

    const incomeResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM financial_transactions
      WHERE amount > 0 AND date >= ? AND date < ? AND type != 'transfer'
    `).get(thisMonthStart, nextMonthStart) as any;

    const expensesResult = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM financial_transactions
      WHERE amount < 0 AND date >= ? AND date < ? AND type != 'transfer' AND COALESCE(is_business_expense, 0) = 0
    `).get(thisMonthStart, nextMonthStart) as any;

    const businessResult = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM financial_transactions
      WHERE amount < 0 AND date >= ? AND date < ? AND is_business_expense = 1
    `).get(thisMonthStart, nextMonthStart) as any;

    const loansResult = db.prepare(`
      SELECT COALESCE(SUM(monthly_payment), 0) as total
      FROM loans WHERE status = 'active'
    `).get() as any;

    // Get account balances by summing all transactions per account
    // For duplicate accounts (same name), only show the most recently updated one
    const accounts = db.prepare(`
      SELECT
        account_id,
        account_name as name,
        account_type as type,
        institution,
        COALESCE(SUM(amount), 0) as balance,
        MAX(date) as last_transaction
      FROM financial_transactions
      WHERE account_id IS NOT NULL
      GROUP BY account_id, account_name, account_type, institution
      ORDER BY ABS(balance) DESC
    `).all() as any[];

    // Filter out duplicate accounts - keep only the most recent one for each name
    const uniqueAccounts = accounts.reduce((acc: any[], current: any) => {
      const existing = acc.find(a => a.name === current.name);
      if (!existing) {
        acc.push(current);
      } else if (current.last_transaction > existing.last_transaction) {
        // Replace with more recent account
        const index = acc.indexOf(existing);
        acc[index] = current;
      }
      return acc;
    }, []);

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const monthlyData = db.prepare(`
      SELECT strftime('%Y-%m', date) as month,
        COALESCE(SUM(CASE WHEN amount > 0 AND type != 'transfer' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN amount < 0 AND type != 'transfer' THEN ABS(amount) ELSE 0 END), 0) as expenses
      FROM financial_transactions WHERE date >= ? GROUP BY month ORDER BY month ASC
    `).all(sixMonthsAgoStr) as any[];

    const monthlyTrend = monthlyData.map((row: any) => ({
      month: row.month,
      income: row.income,
      expenses: row.expenses,
      net: row.income - row.expenses
    }));

    const categoryData = db.prepare(`
      SELECT COALESCE(category, 'Uncategorized') as category, COALESCE(SUM(ABS(amount)), 0) as amount
      FROM financial_transactions
      WHERE amount < 0 AND date >= ? AND date < ? AND type != 'transfer' AND COALESCE(is_business_expense, 0) = 0
      GROUP BY category ORDER BY amount DESC LIMIT 8
    `).all(thisMonthStart, nextMonthStart) as any[];

    const totalCategoryAmount = categoryData.reduce((sum: number, row: any) => sum + row.amount, 0);
    const categoryBreakdown = categoryData.map((row: any) => ({
      category: row.category,
      amount: row.amount,
      percentage: totalCategoryAmount > 0 ? (row.amount / totalCategoryAmount) * 100 : 0
    }));

    const upcomingLoans = db.prepare(`
      SELECT name, monthly_payment as amount, payoff_date
      FROM loans WHERE status = 'active' ORDER BY monthly_payment DESC LIMIT 5
    `).all() as any[];

    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = nextMonth.toISOString().split('T')[0].substring(0, 7);

    const upcomingPayments = upcomingLoans.map((loan: any) => ({
      type: 'loan' as const,
      name: loan.name,
      amount: loan.amount,
      dueDate: `${nextMonthStr}-01`
    }));

    // Get recent transactions (last 10)
    const recentTransactions = db.prepare(`
      SELECT date, description, amount, category, merchant
      FROM financial_transactions
      WHERE type != 'transfer'
      ORDER BY date DESC, id DESC
      LIMIT 10
    `).all() as any[];

    const totalIncome = incomeResult.total;
    const totalExpenses = expensesResult.total;
    const netSavings = totalIncome - totalExpenses - businessResult.total - loansResult.total;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    const overview: FinancialOverview = {
      summary: {
        totalIncome,
        totalExpenses,
        netSavings,
        savingsRate,
        businessExpenses: businessResult.total,
        loanPayments: loansResult.total
      },
      accounts: uniqueAccounts.map((acc: any) => ({
        name: acc.name || acc.account_id,
        type: acc.type || 'unknown',
        balance: acc.balance || 0,
        institution: acc.institution || 'Unknown'
      })),
      monthlyTrend,
      categoryBreakdown,
      upcomingPayments,
      recentTransactions
    };

    return NextResponse.json(overview);
  } catch (error: any) {
    console.error('Error fetching financial overview:', error);
    return NextResponse.json({ error: 'Failed to fetch financial overview', details: error.message }, { status: 500 });
  }
}
