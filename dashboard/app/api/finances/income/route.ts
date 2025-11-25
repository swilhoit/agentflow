import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const supabase = getSupabase();
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
    const { data: thisMonthData } = await supabase
      .from('transactions')
      .select('amount')
      .gt('amount', 0)
      .gte('date', thisMonthStart)
      .lt('date', nextMonthStart)
      .neq('category', 'transfer');

    const thisMonthTotal = (thisMonthData || []).reduce((sum, tx) => sum + Number(tx.amount), 0);

    // Last month income
    const { data: lastMonthData } = await supabase
      .from('transactions')
      .select('amount')
      .gt('amount', 0)
      .gte('date', lastMonthStart)
      .lt('date', thisMonthStart)
      .neq('category', 'transfer');

    const lastMonthTotal = (lastMonthData || []).reduce((sum, tx) => sum + Number(tx.amount), 0);

    // YTD income
    const { data: ytdData } = await supabase
      .from('transactions')
      .select('amount')
      .gt('amount', 0)
      .gte('date', ytdStart)
      .neq('category', 'transfer');

    const ytdTotal = (ytdData || []).reduce((sum, tx) => sum + Number(tx.amount), 0);

    // Monthly trend (last 12 months)
    const { data: trendRaw } = await supabase
      .from('transactions')
      .select('date, amount')
      .gt('amount', 0)
      .gte('date', twelveMonthsAgoStr)
      .neq('category', 'transfer')
      .order('date');

    // Group by month
    const monthlyMap = new Map<string, number>();
    (trendRaw || []).forEach(tx => {
      const month = tx.date.substring(0, 7);
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
    const { data: sourcesRaw } = await supabase
      .from('transactions')
      .select('name, amount')
      .gt('amount', 0)
      .gte('date', ytdStart)
      .neq('category', 'transfer');

    // Group by source (name/description)
    const sourceMap = new Map<string, { amount: number; count: number }>();
    (sourcesRaw || []).forEach(tx => {
      const source = tx.name || 'Unknown';
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
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('id, date, name, amount, category, merchant_name')
      .gt('amount', 0)
      .neq('category', 'transfer')
      .order('date', { ascending: false })
      .limit(100);

    const transactions = (recentTransactions || []).map(t => ({
      id: t.id,
      date: t.date,
      description: t.name,
      amount: Number(t.amount),
      category: t.category,
      account_name: null,
      merchant: t.merchant_name
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
