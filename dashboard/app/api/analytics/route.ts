import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const supabase = getSupabase();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const thisMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const lastMonthStart = `${currentMonth === 1 ? currentYear - 1 : currentYear}-${String(currentMonth === 1 ? 12 : currentMonth - 1).padStart(2, '0')}-01`;
    const ytdStart = `${currentYear}-01-01`;
    const nextMonthStart = `${currentMonth === 12 ? currentYear + 1 : currentYear}-${String(currentMonth === 12 ? 1 : currentMonth + 1).padStart(2, '0')}-01`;

    // Get YTD transactions for analytics
    const { data: ytdData } = await supabase
      .from('transactions')
      .select('merchant_name, amount, date, category, name')
      .gte('date', ytdStart)
      .lt('amount', 0);

    const transactions = ytdData || [];

    // Top merchants by spending
    const merchantMap = new Map<string, { total: number; count: number }>();
    transactions.forEach(tx => {
      const merchant = tx.merchant_name;
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

    transactions.forEach(tx => {
      const date = new Date(tx.date);
      const dayIndex = date.getDay();
      dayStats[dayIndex].totalAmount += Math.abs(Number(tx.amount));
      dayStats[dayIndex].count++;
    });

    const dayOfWeekSpending = dayStats.map(d => ({
      day: d.day,
      avgAmount: d.count > 0 ? d.totalAmount / d.count : 0,
      count: d.count
    }));

    // Monthly comparison (this month vs last month)
    const { data: thisMonthData } = await supabase
      .from('transactions')
      .select('amount')
      .gte('date', thisMonthStart)
      .lt('date', nextMonthStart)
      .lt('amount', 0);

    const thisMonthTotal = (thisMonthData || []).reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);

    const { data: lastMonthData } = await supabase
      .from('transactions')
      .select('amount')
      .gte('date', lastMonthStart)
      .lt('date', thisMonthStart)
      .lt('amount', 0);

    const lastMonthTotal = (lastMonthData || []).reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);

    // Category trends over last 6 months
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const { data: trendData } = await supabase
      .from('transactions')
      .select('date, category, amount')
      .gte('date', sixMonthsAgoStr)
      .lt('amount', 0);

    // Group by month and category
    const categoryTrendsMap = new Map<string, Map<string, number>>();
    (trendData || []).forEach(tx => {
      const month = tx.date.substring(0, 7);
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
    const { data: largestData } = await supabase
      .from('transactions')
      .select('date, name, amount, category, merchant_name')
      .gte('date', thisMonthStart)
      .lt('amount', 0)
      .order('amount', { ascending: true }) // Most negative first
      .limit(10);

    const largestTransactions = (largestData || []).map(t => ({
      date: t.date,
      description: t.name,
      amount: Math.abs(Number(t.amount)),
      category: t.category,
      merchant: t.merchant_name
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
