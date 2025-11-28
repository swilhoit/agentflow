import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET(request: Request) {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const thisMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const lastMonthStart = `${currentMonth === 1 ? currentYear - 1 : currentYear}-${String(currentMonth === 1 ? 12 : currentMonth - 1).padStart(2, '0')}-01`;
    const ytdStart = `${currentYear}-01-01`;
    const nextMonthStart = `${currentMonth === 12 ? currentYear + 1 : currentYear}-${String(currentMonth === 12 ? 1 : currentMonth + 1).padStart(2, '0')}-01`;

    // Get YTD transactions for analytics
    const ytdResult = await query(
      `SELECT merchant, amount, date, category, description
       FROM financial_transactions
       WHERE date >= $1 AND amount < 0`,
      [ytdStart]
    );

    const transactions = ytdResult.rows || [];

    // Top merchants by spending
    const merchantMap = new Map<string, { total: number; count: number }>();
    transactions.forEach((tx: any) => {
      const merchant = tx.merchant;
      if (merchant) {
        const existing = merchantMap.get(merchant) || { total: 0, count: 0 };
        merchantMap.set(merchant, {
          total: existing.total + Math.abs(Number(tx.amount)),
          count: existing.count + 1
        });
      }
    });

    const topMerchants = Array.from(merchantMap.entries())
      .map(([merchant, data]) => ({
        merchant,
        total: data.total,
        count: data.count
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Spending by day of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayStats = dayNames.map(day => ({ day, totalAmount: 0, count: 0 }));

    transactions.forEach((tx: any) => {
      const dateVal = tx.date instanceof Date ? tx.date : new Date(tx.date);
      const dayIndex = dateVal.getDay();
      dayStats[dayIndex].totalAmount += Math.abs(Number(tx.amount));
      dayStats[dayIndex].count++;
    });

    const dayOfWeekSpending = dayStats.map(d => ({
      day: d.day,
      avgAmount: d.count > 0 ? d.totalAmount / d.count : 0,
      count: d.count
    }));

    // Monthly comparison (this month vs last month)
    const thisMonthResult = await query(
      `SELECT amount FROM financial_transactions
       WHERE date >= $1 AND date < $2 AND amount < 0`,
      [thisMonthStart, nextMonthStart]
    );
    const thisMonthTotal = (thisMonthResult.rows || []).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount)), 0);

    const lastMonthResult = await query(
      `SELECT amount FROM financial_transactions
       WHERE date >= $1 AND date < $2 AND amount < 0`,
      [lastMonthStart, thisMonthStart]
    );
    const lastMonthTotal = (lastMonthResult.rows || []).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount)), 0);

    // Category trends over last 6 months
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const trendResult = await query(
      `SELECT date, category, amount FROM financial_transactions
       WHERE date >= $1 AND amount < 0`,
      [sixMonthsAgoStr]
    );

    // Group by month and category
    const categoryTrendsMap = new Map<string, Map<string, number>>();
    (trendResult.rows || []).forEach((tx: any) => {
      const dateStr = tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date);
      const month = dateStr.substring(0, 7);
      const category = tx.category || 'Uncategorized';

      if (!categoryTrendsMap.has(month)) {
        categoryTrendsMap.set(month, new Map());
      }
      const monthMap = categoryTrendsMap.get(month)!;
      monthMap.set(category, (monthMap.get(category) || 0) + Math.abs(Number(tx.amount)));
    });

    const categoryTrends: Array<{ month: string; category: string; amount: number }> = [];
    categoryTrendsMap.forEach((categoryMap, month) => {
      categoryMap.forEach((amount, category) => {
        categoryTrends.push({ month, category, amount });
      });
    });
    categoryTrends.sort((a, b) => a.month.localeCompare(b.month) || b.amount - a.amount);

    // Largest transactions this month
    const largestResult = await query(
      `SELECT date, description, amount, category, merchant
       FROM financial_transactions
       WHERE date >= $1 AND amount < 0
       ORDER BY amount ASC LIMIT 10`,
      [thisMonthStart]
    );

    const largestTransactions = (largestResult.rows || []).map((t: any) => ({
      date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : String(t.date),
      description: t.description,
      amount: Math.abs(Number(t.amount)),
      category: t.category,
      merchant: t.merchant
    }));

    return NextResponse.json({
      topMerchants,
      dayOfWeekSpending,
      monthlyComparison: {
        thisMonth: thisMonthTotal,
        lastMonth: lastMonthTotal,
        change: lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0
      },
      categoryTrends,
      largestTransactions
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics', details: error.message }, { status: 500 });
  }
}
