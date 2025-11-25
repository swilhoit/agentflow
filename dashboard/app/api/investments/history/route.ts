import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get last 90 days of price history for the symbol
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const startDate = cutoffDate.toISOString().split('T')[0];

    const { data: history, error } = await supabase
      .from('market_data')
      .select('date, price, change_percent, volume')
      .eq('symbol', symbol)
      .gte('date', startDate)
      .order('date', { ascending: true });

    if (error) throw error;

    if (!history || history.length === 0) {
      return NextResponse.json({ error: 'No history found for this symbol' }, { status: 404 });
    }

    // Calculate stats
    const prices = history.map(h => Number(h.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const latestPrice = prices[prices.length - 1];
    const firstPrice = prices[0];
    const changePercent = ((latestPrice - firstPrice) / firstPrice) * 100;

    return NextResponse.json({
      symbol,
      history,
      stats: {
        minPrice,
        maxPrice,
        avgPrice,
        latestPrice,
        firstPrice,
        changePercent,
        days: history.length
      }
    });
  } catch (error: any) {
    console.error('Error fetching stock history:', error);
    return NextResponse.json({ error: 'Failed to fetch stock history', details: error.message }, { status: 500 });
  }
}
