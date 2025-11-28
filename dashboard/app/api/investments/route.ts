import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { PORTFOLIOS, getPortfolio, type PortfolioCategory } from '@/lib/portfolio-categories';

export async function GET(request: Request) {
  try {
    // Get category filter from query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as PortfolioCategory | null;

    // Build symbol filter based on category
    let symbolList: string[] = [];
    if (category && category !== 'all') {
      const portfolio = getPortfolio(category);
      if (portfolio) {
        symbolList = portfolio.symbols;
      }
    }

    // Try to get market data (table might not exist yet)
    let watchlist: any[] = [];
    let latestDate: string | null = null;

    try {
      // Check if market_data table exists and has data
      const dateResult = await query(
        `SELECT date FROM market_data ORDER BY date DESC LIMIT 1`
      );
      latestDate = dateResult.rows?.[0]?.date || null;

      if (latestDate) {
        let marketQuery = `
          SELECT symbol, name, price, change_amount, change_percent,
                 performance_30d, performance_90d, performance_365d, market_cap, volume, date
          FROM market_data WHERE date = $1`;
        const params: any[] = [latestDate];

        if (symbolList.length > 0) {
          marketQuery += ` AND symbol = ANY($2)`;
          params.push(symbolList);
        }
        marketQuery += ` ORDER BY symbol`;

        const marketResult = await query(marketQuery, params);
        watchlist = marketResult.rows || [];
      }
    } catch {
      // market_data table doesn't exist yet - that's ok
      console.log('Market data table not available');
    }

    // Try to get latest investment thesis
    let latestThesis: any = null;
    try {
      const thesisResult = await query(
        `SELECT id, week_start, week_end, title, executive_summary, detailed_analysis, recommendations, created_at
         FROM weekly_analysis WHERE analysis_type = 'thesis'
         ORDER BY week_start DESC LIMIT 1`
      );
      if (thesisResult.rows?.[0]) {
        const t = thesisResult.rows[0];
        latestThesis = {
          ...t,
          summary: t.executive_summary,
          timestamp: t.created_at
        };
      }
    } catch {
      // weekly_analysis table might not exist
    }

    // Try to get recent analysis
    let recentAnalysis: any[] = [];
    try {
      const analysisResult = await query(
        `SELECT id, week_start, week_end, analysis_type, title, executive_summary, created_at
         FROM weekly_analysis ORDER BY week_start DESC LIMIT 5`
      );
      recentAnalysis = (analysisResult.rows || []).map((a: any) => ({
        ...a,
        summary: a.executive_summary,
        timestamp: a.created_at
      }));
    } catch {
      // weekly_analysis table might not exist
    }

    // Try to get significant market news
    let significantNews: any[] = [];
    try {
      const newsResult = await query(
        `SELECT symbol, headline, summary, source, url, published_at, sentiment
         FROM market_news WHERE is_significant = true
         ORDER BY published_at DESC LIMIT 10`
      );
      significantNews = newsResult.rows || [];
    } catch {
      // market_news table might not exist
    }

    // Calculate portfolio performance metrics
    const portfolioStats = {
      totalSymbols: watchlist.length,
      avgChange30d: watchlist.length > 0
        ? watchlist.reduce((sum, s) => sum + (Number(s.performance_30d) || 0), 0) / watchlist.length
        : 0,
      avgChange90d: watchlist.length > 0
        ? watchlist.reduce((sum, s) => sum + (Number(s.performance_90d) || 0), 0) / watchlist.length
        : 0,
      avgChange365d: watchlist.length > 0
        ? watchlist.reduce((sum, s) => sum + (Number(s.performance_365d) || 0), 0) / watchlist.length
        : 0,
      winnersCount: watchlist.filter(s => (Number(s.performance_30d) || 0) > 0).length,
      losersCount: watchlist.filter(s => (Number(s.performance_30d) || 0) < 0).length,
      topGainer: watchlist.reduce((max, s) =>
        (Number(s.performance_30d) || -Infinity) > (Number(max?.performance_30d) || -Infinity) ? s : max, watchlist[0]),
      topLoser: watchlist.reduce((min, s) =>
        (Number(s.performance_30d) || Infinity) < (Number(min?.performance_30d) || Infinity) ? s : min, watchlist[0])
    };

    return NextResponse.json({
      watchlist,
      latestThesis,
      recentAnalysis,
      significantNews,
      portfolioStats,
      lastUpdated: latestDate,
      category: category || 'all',
      portfolios: PORTFOLIOS.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        symbolCount: p.symbols.length
      }))
    });
  } catch (error: any) {
    console.error('Error fetching investments:', error);
    return NextResponse.json({ error: 'Failed to fetch investments', details: error.message }, { status: 500 });
  }
}
