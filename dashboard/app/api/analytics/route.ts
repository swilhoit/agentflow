import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const db = getDatabase();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const thisMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const lastMonthStart = `${currentMonth === 1 ? currentYear - 1 : currentYear}-${String(currentMonth === 1 ? 12 : currentMonth - 1).padStart(2, '0')}-01`;
    const ytdStart = `${currentYear}-01-01`;

    // Top merchants by spending
    const topMerchants = db.prepare(`
      SELECT merchant, COALESCE(SUM(ABS(amount)), 0) as total, COUNT(*) as count
      FROM financial_transactions
      WHERE amount < 0 AND merchant IS NOT NULL AND date >= ?
      GROUP BY merchant
      ORDER BY total DESC
      LIMIT 10
    `).all(ytdStart) as any[];

    // Spending by day of week
    const dayOfWeekSpending = db.prepare(`
      SELECT 
        CASE CAST(strftime('%w', date) AS INTEGER)
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END as day,
        COALESCE(AVG(ABS(amount)), 0) as avgAmount,
        COUNT(*) as count
      FROM financial_transactions
      WHERE amount < 0 AND date >= ?
      GROUP BY strftime('%w', date)
      ORDER BY CAST(strftime('%w', date) AS INTEGER)
    `).all(ytdStart) as any[];

    // Monthly comparison (this month vs last month)
    const thisMonthTotal = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM financial_transactions
      WHERE amount < 0 AND date >= ? AND date < ?
    `).get(thisMonthStart, `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`) as any;

    const lastMonthTotal = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM financial_transactions
      WHERE amount < 0 AND date >= ? AND date < ?
    `).get(lastMonthStart, thisMonthStart) as any;

    // Category trends over last 6 months
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const categoryTrends = db.prepare(`
      SELECT 
        strftime('%Y-%m', date) as month,
        category,
        COALESCE(SUM(ABS(amount)), 0) as amount
      FROM financial_transactions
      WHERE amount < 0 AND date >= ?
      GROUP BY month, category
      ORDER BY month, amount DESC
    `).all(sixMonthsAgo.toISOString().split('T')[0]) as any[];

    // Largest transactions this month
    const largestTransactions = db.prepare(`
      SELECT date, description, amount, category, merchant
      FROM financial_transactions
      WHERE amount < 0 AND date >= ?
      ORDER BY ABS(amount) DESC
      LIMIT 10
    `).all(thisMonthStart) as any[];

    return NextResponse.json({
      topMerchants,
      dayOfWeekSpending,
      monthlyComparison: {
        thisMonth: thisMonthTotal.total,
        lastMonth: lastMonthTotal.total,
        change: ((thisMonthTotal.total - lastMonthTotal.total) / lastMonthTotal.total) * 100
      },
      categoryTrends,
      largestTransactions: largestTransactions.map((t: any) => ({
        ...t,
        amount: Math.abs(t.amount)
      }))
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics', details: error.message }, { status: 500 });
  }
}
