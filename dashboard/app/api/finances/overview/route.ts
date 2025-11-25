import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

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
    const supabase = getSupabase();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const thisMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const nextMonthStart = `${currentMonth === 12 ? currentYear + 1 : currentYear}-${String(currentMonth === 12 ? 1 : currentMonth + 1).padStart(2, '0')}-01`;

    // Get income this month (positive amounts)
    const { data: incomeData } = await supabase
      .from('transactions')
      .select('amount')
      .gt('amount', 0)
      .gte('date', thisMonthStart)
      .lt('date', nextMonthStart)
      .neq('category', 'transfer');

    const totalIncome = (incomeData || []).reduce((sum, tx) => sum + Number(tx.amount), 0);

    // Get expenses this month (negative amounts, excluding business expenses)
    const { data: expenseData } = await supabase
      .from('transactions')
      .select('amount')
      .lt('amount', 0)
      .gte('date', thisMonthStart)
      .lt('date', nextMonthStart)
      .neq('category', 'transfer');

    const totalExpenses = (expenseData || []).reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);

    // Business expenses - transactions with category 'Business'
    const { data: businessData } = await supabase
      .from('transactions')
      .select('amount')
      .lt('amount', 0)
      .gte('date', thisMonthStart)
      .lt('date', nextMonthStart)
      .eq('category', 'Business');

    const businessExpenses = (businessData || []).reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);

    // Get loan payments - try the loans table if it exists
    let loanPayments = 0;
    try {
      const { data: loansData } = await supabase
        .from('financial_goals')
        .select('target_amount')
        .eq('goal_type', 'debt')
        .eq('status', 'active');
      
      // Approximate monthly from total target
      loanPayments = (loansData || []).reduce((sum, loan) => sum + (Number(loan.target_amount) / 12), 0);
    } catch {
      // Loans table might not exist
    }

    // Get account balances from teller_accounts
    const { data: accountsData } = await supabase
      .from('teller_accounts')
      .select('account_id, name, type, institution_name, current_balance')
      .eq('is_active', true)
      .order('current_balance', { ascending: false });

    const accounts = (accountsData || []).map(acc => ({
      name: acc.name || acc.account_id,
      type: acc.type || 'unknown',
      balance: Number(acc.current_balance) || 0,
      institution: acc.institution_name || 'Unknown'
    }));

    // Monthly trend - last 6 months
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const { data: monthlyData } = await supabase
      .from('transactions')
      .select('date, amount, category')
      .gte('date', sixMonthsAgoStr)
      .neq('category', 'transfer')
      .order('date');

    // Group by month
    const monthlyMap = new Map<string, { income: number; expenses: number }>();
    (monthlyData || []).forEach(tx => {
      const month = tx.date.substring(0, 7); // YYYY-MM
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
    const { data: categoryData } = await supabase
      .from('transactions')
      .select('category, amount')
      .lt('amount', 0)
      .gte('date', thisMonthStart)
      .lt('date', nextMonthStart)
      .neq('category', 'transfer')
      .not('category', 'is', null);

    const categoryMap = new Map<string, number>();
    (categoryData || []).forEach(tx => {
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

    // Upcoming payments (from financial_goals with type 'debt')
    const { data: upcomingGoals } = await supabase
      .from('financial_goals')
      .select('goal_name, target_amount, target_date')
      .eq('goal_type', 'debt')
      .eq('status', 'active')
      .order('target_amount', { ascending: false })
      .limit(5);

    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = nextMonth.toISOString().split('T')[0].substring(0, 7);

    const upcomingPayments = (upcomingGoals || []).map(goal => ({
      type: 'loan' as const,
      name: goal.goal_name,
      amount: Number(goal.target_amount) / 12, // Approximate monthly
      dueDate: `${nextMonthStr}-01`
    }));

    // Recent transactions
    const { data: recentTxData } = await supabase
      .from('transactions')
      .select('date, name, amount, category, merchant_name')
      .neq('category', 'transfer')
      .order('date', { ascending: false })
      .limit(10);

    const recentTransactions = (recentTxData || []).map(tx => ({
      date: tx.date,
      description: tx.name || '',
      amount: Number(tx.amount),
      category: tx.category,
      merchant: tx.merchant_name
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
