import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const supabase = getSupabase();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const thisMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const nextMonthStart = `${currentMonth === 12 ? currentYear + 1 : currentYear}-${String(currentMonth === 12 ? 1 : currentMonth + 1).padStart(2, '0')}-01`;

    // Get actual income this month
    const { data: incomeData } = await supabase
      .from('transactions')
      .select('amount')
      .gt('amount', 0)
      .gte('date', thisMonthStart)
      .lt('date', nextMonthStart);

    const actualIncome = (incomeData || []).reduce((sum, tx) => sum + Number(tx.amount), 0);

    // Get actual expenses this month
    const { data: expenseData } = await supabase
      .from('transactions')
      .select('amount')
      .lt('amount', 0)
      .gte('date', thisMonthStart)
      .lt('date', nextMonthStart);

    const actualExpenses = (expenseData || []).reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);

    // Get spending by category this month
    const { data: categoryData } = await supabase
      .from('transactions')
      .select('category, amount')
      .lt('amount', 0)
      .gte('date', thisMonthStart)
      .lt('date', nextMonthStart)
      .not('category', 'is', null);

    const categorySpending = new Map<string, number>();
    (categoryData || []).forEach(tx => {
      const cat = tx.category || 'Uncategorized';
      categorySpending.set(cat, (categorySpending.get(cat) || 0) + Math.abs(Number(tx.amount)));
    });

    // Get monthly progress (last 6 months)
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const { data: monthlyData } = await supabase
      .from('transactions')
      .select('date, amount')
      .gte('date', sixMonthsAgoStr)
      .order('date');

    // Group by month
    const monthlyMap = new Map<string, { income: number; expenses: number }>();
    (monthlyData || []).forEach(tx => {
      const month = tx.date.substring(0, 7);
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

    const monthlyProgress = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        income: data.income,
        expenses: data.expenses,
        savings: data.income - data.expenses,
        savingsRate: data.income > 0 ? ((data.income - data.expenses) / data.income) * 100 : 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate savings rate
    const netSavings = actualIncome - actualExpenses;
    const savingsRate = actualIncome > 0 ? (netSavings / actualIncome) * 100 : 0;

    // Default goals (these could come from a goals table in the future)
    const goals = {
      monthlyIncome: 15000,
      monthlyExpenses: 8000,
      savingsRate: 40,
      categories: {
        'Food & Dining': 800,
        'Transportation': 500,
        'Shopping': 400,
        'Entertainment': 300,
        'Utilities': 200,
        'Healthcare': 300,
        'Travel': 500
      } as Record<string, number>
    };

    // Calculate category progress
    const categoryProgress = Object.entries(goals.categories).map(([category, target]) => {
      const spent = categorySpending.get(category) || 0;
      return {
        category,
        target,
        spent,
        remaining: Math.max(0, target - spent),
        percentage: (spent / target) * 100,
        overBudget: spent > target
      };
    });

    return NextResponse.json({
      currentMonth: {
        income: {
          actual: actualIncome,
          target: goals.monthlyIncome,
          percentage: (actualIncome / goals.monthlyIncome) * 100
        },
        expenses: {
          actual: actualExpenses,
          target: goals.monthlyExpenses,
          percentage: (actualExpenses / goals.monthlyExpenses) * 100
        },
        savingsRate: {
          actual: savingsRate,
          target: goals.savingsRate,
          netSavings
        }
      },
      categoryProgress,
      monthlyProgress,
      goals
    });
  } catch (error: any) {
    console.error('Error fetching goals:', error);
    return NextResponse.json({ error: 'Failed to fetch goals', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { goalType, value } = body;

    // In the future, save custom goals to database
    // For now, just return success
    return NextResponse.json({ success: true, message: 'Goal updated' });
  } catch (error: any) {
    console.error('Error updating goal:', error);
    return NextResponse.json({ error: 'Failed to update goal', details: error.message }, { status: 500 });
  }
}
