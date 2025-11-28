import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET(request: Request) {
  try {
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
    const thisMonthResult = await query(
      `SELECT amount FROM financial_transactions
       WHERE amount > 0 AND date >= $1 AND date < $2
       AND (category IS NULL OR category != 'transfer')`,
      [thisMonthStart, nextMonthStart]
    );
    const thisMonthTotal = (thisMonthResult.rows || []).reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

    // Last month income
    const lastMonthResult = await query(
      `SELECT amount FROM financial_transactions
       WHERE amount > 0 AND date >= $1 AND date < $2
       AND (category IS NULL OR category != 'transfer')`,
      [lastMonthStart, thisMonthStart]
    );
    const lastMonthTotal = (lastMonthResult.rows || []).reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

    // YTD income
    const ytdResult = await query(
      `SELECT amount FROM financial_transactions
       WHERE amount > 0 AND date >= $1
       AND (category IS NULL OR category != 'transfer')`,
      [ytdStart]
    );
    const ytdTotal = (ytdResult.rows || []).reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

    // Monthly trend (last 12 months)
    const trendResult = await query(
      `SELECT date, amount FROM financial_transactions
       WHERE amount > 0 AND date >= $1
       AND (category IS NULL OR category != 'transfer')
       ORDER BY date`,
      [twelveMonthsAgoStr]
    );

    // Group by month
    const monthlyMap = new Map<string, number>();
    (trendResult.rows || []).forEach((tx: any) => {
      const dateStr = tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date);
      const month = dateStr.substring(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + Number(tx.amount));
    });

    const trendData = Array.from(monthlyMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Average per month
    const avgPerMonth = trendData.length > 0
      ? trendData.reduce((sum, m) => sum + m.amount, 0) / trendData.length
      : 0;

    // Income sources breakdown (YTD)
    const sourcesResult = await query(
      `SELECT description, amount FROM financial_transactions
       WHERE amount > 0 AND date >= $1
       AND (category IS NULL OR category != 'transfer')`,
      [ytdStart]
    );

    // Group by source (description)
    const sourceMap = new Map<string, { amount: number; count: number }>();
    (sourcesResult.rows || []).forEach((tx: any) => {
      const source = tx.description || 'Unknown';
      const existing = sourceMap.get(source) || { amount: 0, count: 0 };
      sourceMap.set(source, {
        amount: existing.amount + Number(tx.amount),
        count: existing.count + 1
      });
    });

    const totalSourceIncome = Array.from(sourceMap.values()).reduce((sum, s) => sum + s.amount, 0);
    const sources = Array.from(sourceMap.entries())
      .map(([source, data]) => ({
        source,
        amount: data.amount,
        count: data.count,
        percentage: totalSourceIncome > 0 ? (data.amount / totalSourceIncome) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Recent income transactions
    const recentResult = await query(
      `SELECT id, date, description, amount, category, merchant
       FROM financial_transactions
       WHERE amount > 0 AND (category IS NULL OR category != 'transfer')
       ORDER BY date DESC LIMIT 100`
    );

    const transactions = (recentResult.rows || []).map((t: any) => ({
      id: String(t.id),
      date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : String(t.date),
      description: t.description,
      amount: Number(t.amount),
      category: t.category,
      account_name: null,
      merchant: t.merchant
    }));

    return NextResponse.json({
      summary: {
        thisMonth: thisMonthTotal,
        lastMonth: lastMonthTotal,
        ytd: ytdTotal,
        avgPerMonth,
        changeFromLastMonth: lastMonthTotal > 0
          ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
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
