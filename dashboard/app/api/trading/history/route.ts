import { NextResponse } from 'next/server';
import Alpaca from '@alpacahq/alpaca-trade-api';

function getAlpacaCredentials(paper: boolean = true) {
  return paper ? {
    apiKey: process.env.ALPACA_PAPER_API_KEY || process.env.ALPACA_API_KEY || '',
    secretKey: process.env.ALPACA_PAPER_SECRET_KEY || process.env.ALPACA_SECRET_KEY || '',
  } : {
    apiKey: process.env.ALPACA_LIVE_API_KEY || process.env.ALPACA_API_KEY || '',
    secretKey: process.env.ALPACA_LIVE_SECRET_KEY || process.env.ALPACA_SECRET_KEY || '',
  };
}

function getAlpacaClient(paper: boolean = true): Alpaca {
  const credentials = getAlpacaCredentials(paper);

  return new Alpaca({
    keyId: credentials.apiKey,
    secretKey: credentials.secretKey,
    paper: paper,
    baseUrl: paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets'
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isPaper = searchParams.get('paper') !== 'false';
    const period = searchParams.get('period') || '1M';
    const timeframe = searchParams.get('timeframe') || '1D';

    // Check if credentials are configured
    const credentials = getAlpacaCredentials(isPaper);
    if (!credentials.apiKey || !credentials.secretKey) {
      return NextResponse.json({
        error: 'Trading API not configured',
        details: `Alpaca ${isPaper ? 'paper' : 'live'} trading credentials not set`,
        configured: false,
        isPaper
      }, { status: 503 });
    }

    const client = getAlpacaClient(isPaper);

    // Fetch portfolio history with specified period
    const portfolioHistory = await client.getPortfolioHistory({
      period: period,
      timeframe: timeframe,
      extended_hours: false
    } as any);

    // Parse portfolio history
    const historyData = portfolioHistory.timestamp.map((ts: number, i: number) => ({
      timestamp: ts * 1000,
      date: new Date(ts * 1000).toISOString(),
      equity: portfolioHistory.equity[i],
      profitLoss: portfolioHistory.profit_loss[i],
      profitLossPct: portfolioHistory.profit_loss_pct[i] * 100
    }));

    // Calculate statistics
    const equities = historyData.map((d: any) => d.equity).filter((e: number) => e != null);
    const profitLosses = historyData.map((d: any) => d.profitLoss).filter((p: number) => p != null);

    const stats = {
      startEquity: equities[0] || 0,
      endEquity: equities[equities.length - 1] || 0,
      minEquity: Math.min(...equities),
      maxEquity: Math.max(...equities),
      totalReturn: profitLosses[profitLosses.length - 1] || 0,
      totalReturnPct: historyData[historyData.length - 1]?.profitLossPct || 0,
      baseValue: portfolioHistory.base_value
    };

    return NextResponse.json({
      history: historyData,
      stats,
      period,
      timeframe,
      isPaper,
      lastUpdated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching portfolio history:', error);
    return NextResponse.json({
      error: 'Failed to fetch portfolio history',
      details: error.message
    }, { status: 500 });
  }
}
