import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { PORTFOLIOS, getPortfolio, type PortfolioCategory } from '@/lib/portfolio-categories';

export async function GET(request: Request) {
  try {
    const supabase = getSupabase();

    // Get category filter from query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as PortfolioCategory | null;

    // Get latest market data date
    const { data: dateData } = await supabase
      .from('market_data')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    const latestDate = dateData?.[0]?.date;

    // Build symbol filter based on category
    let symbolList: string[] = [];
    if (category && category !== 'all') {
      const portfolio = getPortfolio(category);
      if (portfolio) {
        symbolList = portfolio.symbols;
      }
    }

    // Get market data
    let watchlist: any[] = [];
    if (latestDate) {
      let query = supabase
        .from('market_data')
        .select('symbol, name, price, change_amount, change_percent, performance_30d, performance_90d, performance_365d, market_cap, volume, date')
        .eq('date', latestDate)
        .order('symbol');

      if (symbolList.length > 0) {
        query = query.in('symbol', symbolList);
      }

      const { data } = await query;
      watchlist = data || [];
    }

    // Get latest investment thesis/narrative
    const { data: thesisData } = await supabase
      .from('weekly_analysis')
      .select('id, week_start, week_end, title, executive_summary, detailed_analysis, recommendations, created_at')
      .eq('analysis_type', 'thesis')
      .order('week_start', { ascending: false })
      .limit(1);

    const latestThesis = thesisData?.[0] ? {
      ...thesisData[0],
      summary: thesisData[0].executive_summary,
      timestamp: thesisData[0].created_at
    } : null;

    // Get recent analysis
    const { data: analysisData } = await supabase
      .from('weekly_analysis')
      .select('id, week_start, week_end, analysis_type, title, executive_summary, created_at')
      .order('week_start', { ascending: false })
      .limit(5);

    const recentAnalysis = (analysisData || []).map(a => ({
      ...a,
      summary: a.executive_summary,
      timestamp: a.created_at
    }));

    // Get significant market news
    const { data: newsData } = await supabase
      .from('market_news')
      .select('symbol, headline, summary, source, url, published_at, sentiment')
      .eq('is_significant', true)
      .order('published_at', { ascending: false })
      .limit(10);

    const significantNews = newsData || [];

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
