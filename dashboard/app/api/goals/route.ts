import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const db = getDatabase();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const thisMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const nextMonthStart = `${currentMonth === 12 ? currentYear + 1 : currentYear}-${String(currentMonth === 12 ? 1 : currentMonth + 1).padStart(2, '0')}-01`;
    const ytdStart = `${currentYear}-01-01`;

    // Get actual income this month
    const actualIncome = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM financial_transactions
      WHERE amount > 0 AND date >= ? AND date < ?
    `).get(thisMonthStart, nextMonthStart) as any;

    // Get actual expenses this month
    const actualExpenses = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM financial_transactions
      WHERE amount < 0 AND date >= ? AND date < ?
    `).get(thisMonthStart, nextMonthStart) as any;

    // Get spending by category this month
    const categorySpending = db.prepare(`
      SELECT
        category,
        COALESCE(SUM(ABS(amount)), 0) as spent
      FROM financial_transactions
      WHERE amount < 0 AND date >= ? AND date < ? AND category IS NOT NULL
      GROUP BY category
      ORDER BY spent DESC
    `).all(thisMonthStart, nextMonthStart) as any[];

    // Get monthly progress (last 6 months)
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyProgress = db.prepare(`
      SELECT
        strftime('%Y-%m', date) as month,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expenses
      FROM financial_transactions
      WHERE date >= ?
      GROUP BY month
      ORDER BY month
    `).all(sixMonthsAgo.toISOString().split('T')[0]) as any[];

    // Calculate savings rate
    const netSavings = actualIncome.total - actualExpenses.total;
    const savingsRate = actualIncome.total > 0 ? (netSavings / actualIncome.total) * 100 : 0;

    // Hardcoded goals (these could come from a goals table in the future)
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
      }
    };

    // Calculate category progress
    const categoryProgress = Object.entries(goals.categories).map(([category, target]) => {
      const spent = categorySpending.find(c => c.category === category)?.spent || 0;
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
          actual: actualIncome.total,
          target: goals.monthlyIncome,
          percentage: (actualIncome.total / goals.monthlyIncome) * 100
        },
        expenses: {
          actual: actualExpenses.total,
          target: goals.monthlyExpenses,
          percentage: (actualExpenses.total / goals.monthlyExpenses) * 100
        },
        savingsRate: {
          actual: savingsRate,
          target: goals.savingsRate,
          netSavings
        }
      },
      categoryProgress,
      monthlyProgress: monthlyProgress.map(m => ({
        month: m.month,
        income: m.income,
        expenses: m.expenses,
        savings: m.income - m.expenses,
        savingsRate: m.income > 0 ? ((m.income - m.expenses) / m.income) * 100 : 0
      })),
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
