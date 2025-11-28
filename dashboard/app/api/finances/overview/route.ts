import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

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
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const thisMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const nextMonthStart = `${currentMonth === 12 ? currentYear + 1 : currentYear}-${String(currentMonth === 12 ? 1 : currentMonth + 1).padStart(2, '0')}-01`;

    // Get income this month (positive amounts)
    const incomeResult = await query(
      `SELECT amount FROM financial_transactions
       WHERE amount > 0 AND date >= $1 AND date < $2
       AND (category IS NULL OR category != 'transfer')`,
      [thisMonthStart, nextMonthStart]
    );
    const totalIncome = (incomeResult.rows || []).reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

    // Get expenses this month (negative amounts)
    const expenseResult = await query(
      `SELECT amount FROM financial_transactions
       WHERE amount < 0 AND date >= $1 AND date < $2
       AND (category IS NULL OR category != 'transfer')`,
      [thisMonthStart, nextMonthStart]
    );
    const totalExpenses = (expenseResult.rows || []).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount)), 0);

    // Business expenses - transactions with category 'Business'
    const businessResult = await query(
      `SELECT amount FROM financial_transactions
       WHERE amount < 0 AND date >= $1 AND date < $2 AND category = 'Business'`,
      [thisMonthStart, nextMonthStart]
    );
    const businessExpenses = (businessResult.rows || []).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount)), 0);

    // Get loan payments from loans table
    let loanPayments = 0;
    try {
      const loansResult = await query(
        `SELECT monthly_payment FROM loans WHERE status = 'active'`
      );
      loanPayments = (loansResult.rows || []).reduce((sum: number, loan: any) => sum + Number(loan.monthly_payment || 0), 0);
    } catch {
      // Loans table might not have data
    }

    // Get unique accounts from transactions
    const accountsResult = await query(
      `SELECT DISTINCT account_name as name, account_type as type, institution,
       (SELECT SUM(amount) FROM financial_transactions ft2 WHERE ft2.account_id = ft.account_id) as balance
       FROM financial_transactions ft
       WHERE account_name IS NOT NULL
       ORDER BY account_name`
    );
    const accounts = (accountsResult.rows || []).map((acc: any) => ({
      name: acc.name || 'Unknown',
      type: acc.type || 'unknown',
      balance: Number(acc.balance) || 0,
      institution: acc.institution || 'Unknown'
    }));

    // Monthly trend - last 6 months
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const monthlyResult = await query(
      `SELECT date, amount, category FROM financial_transactions
       WHERE date >= $1 AND (category IS NULL OR category != 'transfer')
       ORDER BY date`,
      [sixMonthsAgoStr]
    );

    // Group by month
    const monthlyMap = new Map<string, { income: number; expenses: number }>();
    (monthlyResult.rows || []).forEach((tx: any) => {
      const dateStr = tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date);
      const month = dateStr.substring(0, 7); // YYYY-MM
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { income: 0, expenses: 0 });
      }
      const entry = monthlyMap.get(month)!;
      const amount = Number(tx.amount);
      if (amount > 0) {
        entry.income += amount;
      } else {
        entry.expenses += Math.abs(amount);
      }
    });

    const monthlyTrend = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        income: data.income,
        expenses: data.expenses,
        net: data.income - data.expenses
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Category breakdown
    const categoryResult = await query(
      `SELECT category, amount FROM financial_transactions
       WHERE amount < 0 AND date >= $1 AND date < $2
       AND category IS NOT NULL AND category != 'transfer'`,
      [thisMonthStart, nextMonthStart]
    );

    const categoryMap = new Map<string, number>();
    (categoryResult.rows || []).forEach((tx: any) => {
      const cat = tx.category || 'Uncategorized';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + Math.abs(Number(tx.amount)));
    });

    const totalCategoryAmount = Array.from(categoryMap.values()).reduce((sum, val) => sum + val, 0);
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalCategoryAmount > 0 ? (amount / totalCategoryAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    // Upcoming payments from loans table
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = nextMonth.toISOString().split('T')[0].substring(0, 7);

    let upcomingPayments: Array<{ type: 'loan' | 'bill' | 'tax'; name: string; amount: number; dueDate: string }> = [];
    try {
      const loansResult = await query(
        `SELECT name, monthly_payment FROM loans WHERE status = 'active' ORDER BY monthly_payment DESC LIMIT 5`
      );
      upcomingPayments = (loansResult.rows || []).map((loan: any) => ({
        type: 'loan' as const,
        name: loan.name,
        amount: Number(loan.monthly_payment),
        dueDate: `${nextMonthStr}-01`
      }));
    } catch {
      // Loans table might not have data
    }

    // Recent transactions
    const recentResult = await query(
      `SELECT date, description, amount, category, merchant
       FROM financial_transactions
       WHERE category IS NULL OR category != 'transfer'
       ORDER BY date DESC LIMIT 10`
    );

    const recentTransactions = (recentResult.rows || []).map((tx: any) => ({
      date: tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date),
      description: tx.description || '',
      amount: Number(tx.amount),
      category: tx.category,
      merchant: tx.merchant
    }));

    // Calculate summary
    const netSavings = totalIncome - totalExpenses - businessExpenses - loanPayments;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    const overview: FinancialOverview = {
      summary: {
        totalIncome,
        totalExpenses,
        netSavings,
        savingsRate,
        businessExpenses,
        loanPayments
      },
      accounts,
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
