import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const db = getDatabase();

    // Get the latest investment thesis
    const latestThesis = db.prepare(`
      SELECT
        title,
        summary,
        detailed_analysis,
        week_start,
        week_end
      FROM weekly_analysis
      WHERE analysis_type = 'thesis'
      ORDER BY week_start DESC
      LIMIT 1
    `).get() as any;

    if (!latestThesis) {
      return NextResponse.json({ error: 'No investment thesis found' }, { status: 404 });
    }

    // Get watchlist symbols
    const latestDate = db.prepare(`
      SELECT MAX(date) as latest_date FROM market_data
    `).get() as any;

    const watchlistSymbols = db.prepare(`
      SELECT DISTINCT symbol, name
      FROM market_data
      WHERE date = ?
      ORDER BY symbol
      LIMIT 15
    `).all(latestDate?.latest_date || '') as any[];

    const symbolList = watchlistSymbols.map((s: any) => s.symbol).join(', ');

    // Call Perplexity API for daily analysis
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;

    if (!perplexityApiKey) {
      return NextResponse.json({
        error: 'Perplexity API key not configured',
        fallback: {
          analysis: latestThesis.summary,
          timestamp: new Date().toISOString(),
          source: 'Database'
        }
      }, { status: 200 });
    }

    const today = new Date().toISOString().split('T')[0];

    const prompt = `You are analyzing an investment thesis focused on AI infrastructure and nuclear/uranium energy stocks.

Investment Thesis Summary:
${latestThesis.summary}

Key Holdings/Watchlist: ${symbolList}

Provide a comprehensive daily analysis covering:
1. **Market Update**: Today's key developments affecting nuclear energy, uranium mining, and AI infrastructure stocks
2. **Thesis Validation**: How recent events support or challenge the investment thesis
3. **Notable Movers**: Which stocks in the watchlist are moving significantly and why
4. **Catalysts**: Upcoming events, earnings, or policy changes that could impact the thesis
5. **Risk Assessment**: Current risks and how to manage them
6. **Action Items**: Specific recommendations (buy/hold/watch levels)

Keep it concise but actionable. Include specific price levels and dates where relevant.

Today's date: ${today}`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are an expert investment analyst specializing in AI infrastructure, nuclear energy, and uranium mining sectors. Provide detailed, data-driven analysis with specific recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    const analysis = data.choices?.[0]?.message?.content;

    return NextResponse.json({
      analysis: analysis || 'No analysis available',
      thesis: latestThesis,
      watchlist: watchlistSymbols,
      timestamp: new Date().toISOString(),
      source: 'Perplexity AI',
      model: 'sonar',
      date: today
    });
  } catch (error: any) {
    console.error('Error generating investment analysis:', error);
    return NextResponse.json({
      error: 'Failed to generate analysis',
      details: error.message
    }, { status: 500 });
  }
}
