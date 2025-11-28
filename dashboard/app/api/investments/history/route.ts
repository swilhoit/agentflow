import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
    }

    // Get last 90 days of price history for the symbol
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const startDate = cutoffDate.toISOString().split('T')[0];

    try {
      const result = await query(
        `SELECT date, price, change_percent, volume
         FROM market_data
         WHERE symbol = $1 AND date >= $2
         ORDER BY date ASC`,
        [symbol, startDate]
      );

      const history = result.rows || [];

      if (history.length === 0) {
        return NextResponse.json({ error: 'No history found for this symbol' }, { status: 404 });
      }

      // Calculate stats
      const prices = history.map((h: any) => Number(h.price));
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;
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
    } catch {
      // market_data table might not exist
      return NextResponse.json({ error: 'Market data not available' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('Error fetching stock history:', error);
    return NextResponse.json({ error: 'Failed to fetch stock history', details: error.message }, { status: 500 });
  }
}
