import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const db = getDatabase();

    // Get latest market data for watchlist
    const latestDate = db.prepare(`
      SELECT MAX(date) as latest_date FROM market_data
    `).get() as any;

    const watchlist = db.prepare(`
      SELECT
        symbol,
        name,
        price,
        change_amount,
        change_percent,
        performance_30d,
        performance_90d,
        performance_365d,
        market_cap,
        volume,
        date
      FROM market_data
      WHERE date = ?
      ORDER BY symbol
    `).all(latestDate?.latest_date || '') as any[];

    // Get latest investment thesis/narrative
    const latestThesis = db.prepare(`
      SELECT
        id,
        week_start,
        week_end,
        title,
        summary,
        detailed_analysis,
        key_events,
        recommendations,
        timestamp
      FROM weekly_analysis
      WHERE analysis_type = 'thesis'
      ORDER BY week_start DESC
      LIMIT 1
    `).get() as any;

    // Get recent performance analysis
    const recentAnalysis = db.prepare(`
      SELECT
        id,
        week_start,
        week_end,
        analysis_type,
        title,
        summary,
        timestamp
      FROM weekly_analysis
      ORDER BY week_start DESC
      LIMIT 5
    `).all() as any[];

    // Get significant market news
    const significantNews = db.prepare(`
      SELECT
        symbol,
        headline,
        summary,
        source,
        url,
        published_at,
        sentiment
      FROM market_news
      WHERE is_significant = 1
      ORDER BY published_at DESC
      LIMIT 10
    `).all() as any[];

    // Calculate portfolio performance metrics
    const portfolioStats = {
      totalSymbols: watchlist.length,
      avgChange30d: watchlist.reduce((sum: number, s: any) => sum + (s.performance_30d || 0), 0) / watchlist.length || 0,
      avgChange90d: watchlist.reduce((sum: number, s: any) => sum + (s.performance_90d || 0), 0) / watchlist.length || 0,
      avgChange365d: watchlist.reduce((sum: number, s: any) => sum + (s.performance_365d || 0), 0) / watchlist.length || 0,
      winnersCount: watchlist.filter((s: any) => (s.performance_30d || 0) > 0).length,
      losersCount: watchlist.filter((s: any) => (s.performance_30d || 0) < 0).length,
      topGainer: watchlist.reduce((max: any, s: any) =>
        (s.performance_30d || -Infinity) > (max.performance_30d || -Infinity) ? s : max, watchlist[0]),
      topLoser: watchlist.reduce((min: any, s: any) =>
        (s.performance_30d || Infinity) < (min.performance_30d || Infinity) ? s : min, watchlist[0])
    };

    return NextResponse.json({
      watchlist,
      latestThesis,
      recentAnalysis,
      significantNews,
      portfolioStats,
      lastUpdated: latestDate?.latest_date
    });
  } catch (error: any) {
    console.error('Error fetching investments:', error);
    return NextResponse.json({ error: 'Failed to fetch investments', details: error.message }, { status: 500 });
  }
}
