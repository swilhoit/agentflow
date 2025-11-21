import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const db = getDatabase();
    const now = new Date();

    // Calculate date ranges
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const thisMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const nextMonthStart = `${currentMonth === 12 ? currentYear + 1 : currentYear}-${String(currentMonth === 12 ? 1 : currentMonth + 1).padStart(2, '0')}-01`;
    const lastMonthStart = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-01`;
    const ytdStart = `${currentYear}-01-01`;
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().split('T')[0];

    // This month income
    const thisMonthResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM financial_transactions
      WHERE amount > 0 AND date >= ? AND date < ? AND type != 'transfer'
    `).get(thisMonthStart, nextMonthStart) as any;

    // Last month income
    const lastMonthResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM financial_transactions
      WHERE amount > 0 AND date >= ? AND date < ? AND type != 'transfer'
    `).get(lastMonthStart, thisMonthStart) as any;

    // YTD income
    const ytdResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM financial_transactions
      WHERE amount > 0 AND date >= ? AND type != 'transfer'
    `).get(ytdStart) as any;

    // Average per month (last 12 months)
    const avgResult = db.prepare(`
      SELECT COALESCE(AVG(monthly_income), 0) as avg_income
      FROM (
        SELECT strftime('%Y-%m', date) as month, SUM(amount) as monthly_income
        FROM financial_transactions
        WHERE amount > 0 AND date >= ? AND type != 'transfer'
        GROUP BY month
      )
    `).get(twelveMonthsAgoStr) as any;

    // Monthly trend (last 12 months)
    const trendData = db.prepare(`
      SELECT
        strftime('%Y-%m', date) as month,
        COALESCE(SUM(amount), 0) as amount
      FROM financial_transactions
      WHERE amount > 0 AND date >= ? AND type != 'transfer'
      GROUP BY month
      ORDER BY month ASC
    `).all(twelveMonthsAgoStr) as any[];

    // Income sources breakdown (YTD)
    const sourcesData = db.prepare(`
      SELECT
        description as source,
        COALESCE(SUM(amount), 0) as amount,
        COUNT(*) as count
      FROM financial_transactions
      WHERE amount > 0 AND date >= ? AND type != 'transfer'
      GROUP BY description
      ORDER BY amount DESC
      LIMIT 10
    `).all(ytdStart) as any[];

    const totalSourceIncome = sourcesData.reduce((sum, row) => sum + row.amount, 0);
    const sources = sourcesData.map((row: any) => ({
      source: row.source,
      amount: row.amount,
      count: row.count,
      percentage: totalSourceIncome > 0 ? (row.amount / totalSourceIncome) * 100 : 0
    }));

    // Recent income transactions
    const transactions = db.prepare(`
      SELECT
        id, date, description, amount, category, account_name, merchant
      FROM financial_transactions
      WHERE amount > 0 AND type != 'transfer'
      ORDER BY date DESC, id DESC
      LIMIT 100
    `).all() as any[];

    return NextResponse.json({
      summary: {
        thisMonth: thisMonthResult.total,
        lastMonth: lastMonthResult.total,
        ytd: ytdResult.total,
        avgPerMonth: avgResult.avg_income,
        changeFromLastMonth: lastMonthResult.total > 0
          ? ((thisMonthResult.total - lastMonthResult.total) / lastMonthResult.total) * 100
          : 0
      },
      trend: trendData,
      sources,
      transactions
    });
  } catch (error: any) {
    console.error('Error fetching income data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch income data', details: error.message },
      { status: 500 }
    );
  }
}
