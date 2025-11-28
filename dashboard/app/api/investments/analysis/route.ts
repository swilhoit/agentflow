import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Try to get the latest investment thesis
    let latestThesis: any = null;
    try {
      const thesisResult = await query(
        `SELECT title, executive_summary, detailed_analysis, week_start, week_end
         FROM weekly_analysis
         WHERE analysis_type = 'thesis'
         ORDER BY week_start DESC LIMIT 1`
      );

      if (thesisResult.rows?.[0]) {
        latestThesis = {
          ...thesisResult.rows[0],
          summary: thesisResult.rows[0].executive_summary
        };
      }
    } catch {
      // weekly_analysis table might not exist
    }

    if (!latestThesis) {
      return NextResponse.json({ error: 'No investment thesis found' }, { status: 404 });
    }

    // Try to get latest market data date and watchlist
    let latestDate: string | null = null;
    let watchlistSymbols: any[] = [];

    try {
      const dateResult = await query(
        `SELECT date FROM market_data ORDER BY date DESC LIMIT 1`
      );
      latestDate = dateResult.rows?.[0]?.date || null;

      if (latestDate) {
        const watchlistResult = await query(
          `SELECT symbol, name FROM market_data
           WHERE date = $1 ORDER BY symbol LIMIT 15`,
          [latestDate]
        );
        watchlistSymbols = watchlistResult.rows || [];
      }
    } catch {
      // market_data table might not exist
    }

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

    const prompt = `You are Atlas, an expert investment analyst tracking the AI infrastructure and nuclear/uranium energy narrative.

CORE INVESTMENT THESIS:
${latestThesis.summary}

DETAILED THESIS ANALYSIS:
${JSON.stringify(latestThesis.detailed_analysis) || 'Not available'}

CURRENT WATCHLIST: ${symbolList || 'Not specified'}

Provide a DETAILED daily analysis focusing on narrative progression and macro trends. Structure your analysis as follows:

## 1. NARRATIVE PROGRESSION UPDATE
- How is the AI infrastructure buildout narrative evolving today?
- What major AI companies announced regarding data center expansion, energy needs, or infrastructure investments?
- Are we seeing acceleration or deceleration in AI adoption and infrastructure spending?
- What are hyperscalers (MSFT, GOOGL, AMZN, META) doing with their AI infrastructure budgets?

## 2. NUCLEAR ENERGY RENAISSANCE
- Latest developments in nuclear power agreements with tech companies
- Updates on Small Modular Reactor (SMR) projects and regulatory approvals
- Policy changes or government support for nuclear energy
- Are we seeing more corporate PPAs (Power Purchase Agreements) for nuclear energy?
- Timeline updates: When are new reactors coming online?

## 3. URANIUM SUPPLY/DEMAND DYNAMICS
- Current uranium spot price and trend ($ per pound)
- Major uranium supply announcements or mine developments
- Demand forecasts from utilities and tech companies
- Any disruptions to supply chains (Kazakhstan, Canada, Australia)
- Inventory levels at utilities vs. future needs

## 4. SECTOR-SPECIFIC ANALYSIS
For each relevant sector in our watchlist:
- **AI Infrastructure Companies**: Latest capex announcements, energy partnerships
- **Nuclear Operators**: New contracts, capacity expansion plans
- **Uranium Miners**: Production updates, new discoveries, M&A activity
- **SMR Developers**: Technology milestones, customer agreements

## 5. WATCHLIST STOCK MOVEMENTS
For each symbol showing significant movement (>3%), provide:
- Current price and % change
- Specific catalyst driving the move
- How this relates to our thesis
- Technical levels (support/resistance)

## 6. MACRO CATALYSTS & TIMELINE
- Upcoming earnings dates for key watchlist companies
- Regulatory decisions or policy announcements expected
- Industry conferences or events where news could break
- Long-term catalysts (3-6 months out)

## 7. THESIS CONFIDENCE SCORE
Rate on scale of 1-10 how today's developments support our thesis:
- Score: X/10
- Reasoning: Brief explanation of score
- Change from yesterday: Better/Worse/Neutral

## 8. CONTRARIAN VIEW & RISKS
- What could prove our thesis wrong?
- Are there any warning signs in the data?
- Alternative explanations for positive developments
- Black swan risks specific to this narrative

## 9. ACTION ITEMS
- Specific stocks to buy, hold, or trim with price targets
- What to watch for in the next 24-48 hours
- Research to be done
- Stop losses or profit-taking levels

Be thorough, data-driven, and cite specific sources. Focus on HOW the narrative is unfolding, not just WHAT is happening. Connect the dots between developments.

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
            content: 'You are Atlas, a world-class investment analyst who tracks macro narratives and their progression. You specialize in identifying inflection points in AI infrastructure adoption, nuclear energy renaissance, and uranium supply/demand dynamics. You provide comprehensive, multi-layered analysis that connects geopolitical events, corporate actions, and market movements to form a coherent investment narrative. You are thorough, data-driven, and always cite sources.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 4000
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
