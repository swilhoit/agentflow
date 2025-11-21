import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
    }

    const db = getDatabase();

    // Get last 90 days of price history for the symbol
    const history = db.prepare(`
      SELECT
        date,
        price,
        change_percent,
        volume
      FROM market_data
      WHERE symbol = ?
      AND date >= date('now', '-90 days')
      ORDER BY date ASC
    `).all(symbol) as any[];

    if (history.length === 0) {
      return NextResponse.json({ error: 'No history found for this symbol' }, { status: 404 });
    }

    // Calculate stats
    const prices = history.map(h => h.price);
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
