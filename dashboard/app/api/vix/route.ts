import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export interface VIXSignal {
  id: string;
  signalId: string;
  signalTime: string;
  vixLevel: number;
  vixChangePct?: number;
  vixTermStructure?: 'contango' | 'backwardation' | 'flat';
  vixPercentile30d?: number;
  vixPercentile90d?: number;
  spyLevel?: number;
  spyChangePct?: number;
  signalType: string;
  signalStrength: number;
  confidencePct: number;
  recommendation: string;
  suggestedSymbol?: string;
  suggestedExpiration?: string;
  positionSizePct?: number;
  stopLossPct?: number;
  targetPct?: number;
  maxDaysToHold?: number;
  analysisReasoning?: string;
  riskFactors?: string[];
  status: string;
  expiresAt?: string;
}

export interface VIXPosition {
  id: string;
  positionId: string;
  signalId?: string;
  symbol: string;
  contractType: 'stock' | 'call' | 'put';
  strikePrice?: number;
  expirationDate?: string;
  entryPrice: number;
  entryTime: string;
  quantity: number;
  side: 'long' | 'short';
  costBasis: number;
  exitPrice?: number;
  exitTime?: string;
  exitReason?: string;
  realizedPnl?: number;
  realizedPnlPct?: number;
  vixAtEntry: number;
  spyAtEntry?: number;
  strategyType: string;
  status: 'open' | 'closed' | 'expired';
}

export interface VIXHistoryPoint {
  timestamp: string;
  vixClose: number;
  vix3mClose?: number;
  spyClose?: number;
  termStructureRatio?: number;
}

async function fetchYahooVIX(): Promise<{
  vixClose: number;
  vixOpen: number;
  vixHigh: number;
  vixLow: number;
  vix3mClose?: number;
  spyClose?: number;
  spyChangePct?: number;
} | null> {
  try {
    const symbols = ['^VIX', '^VIX3M', 'SPY'];
    const results: Record<string, any> = {};

    for (const symbol of symbols) {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 60 } // Cache for 1 minute
      });

      if (response.ok) {
        const data = await response.json();
        const quote = data.chart?.result?.[0];
        if (quote) {
          const meta = quote.meta;
          const indicators = quote.indicators?.quote?.[0];
          results[symbol] = {
            open: indicators?.open?.[0] || meta.previousClose,
            high: indicators?.high?.[0] || meta.regularMarketPrice,
            low: indicators?.low?.[0] || meta.regularMarketPrice,
            close: meta.regularMarketPrice,
            changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
          };
        }
      }
    }

    if (!results['^VIX']) return null;

    return {
      vixClose: results['^VIX'].close,
      vixOpen: results['^VIX'].open,
      vixHigh: results['^VIX'].high,
      vixLow: results['^VIX'].low,
      vix3mClose: results['^VIX3M']?.close,
      spyClose: results['SPY']?.close,
      spyChangePct: results['SPY']?.changePercent,
    };
  } catch (error) {
    console.error('Error fetching VIX data:', error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'summary';
    const days = parseInt(searchParams.get('days') || '30');

    // Fetch current VIX data from Yahoo Finance
    const currentVIX = await fetchYahooVIX();

    // Get active signals
    const { data: signalsData, error: signalsError } = await supabase
      .from('vix_signals')
      .select('*')
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .order('signal_time', { ascending: false })
      .limit(10);

    if (signalsError) {
      console.error('Error fetching VIX signals:', signalsError);
    }

    // Get open positions
    const { data: positionsData, error: positionsError } = await supabase
      .from('vix_positions')
      .select('*')
      .eq('status', 'open')
      .order('entry_time', { ascending: false })
      .limit(20);

    if (positionsError) {
      console.error('Error fetching VIX positions:', positionsError);
    }

    // Get VIX history
    const historyStart = new Date();
    historyStart.setDate(historyStart.getDate() - days);

    const { data: historyData, error: historyError } = await supabase
      .from('vix_history')
      .select('*')
      .gte('timestamp', historyStart.toISOString())
      .order('timestamp', { ascending: true })
      .limit(500);

    if (historyError) {
      console.error('Error fetching VIX history:', historyError);
    }

    // Map signals
    const signals: VIXSignal[] = (signalsData || []).map((row: any) => ({
      id: row.id?.toString(),
      signalId: row.signal_id,
      signalTime: row.signal_time,
      vixLevel: parseFloat(row.vix_level),
      vixChangePct: row.vix_change_pct ? parseFloat(row.vix_change_pct) : undefined,
      vixTermStructure: row.vix_term_structure,
      vixPercentile30d: row.vix_percentile_30d ? parseFloat(row.vix_percentile_30d) : undefined,
      vixPercentile90d: row.vix_percentile_90d ? parseFloat(row.vix_percentile_90d) : undefined,
      spyLevel: row.spy_level ? parseFloat(row.spy_level) : undefined,
      spyChangePct: row.spy_change_pct ? parseFloat(row.spy_change_pct) : undefined,
      signalType: row.signal_type,
      signalStrength: row.signal_strength,
      confidencePct: parseFloat(row.confidence_pct),
      recommendation: row.recommendation,
      suggestedSymbol: row.suggested_symbol,
      suggestedExpiration: row.suggested_expiration,
      positionSizePct: row.position_size_pct ? parseFloat(row.position_size_pct) : undefined,
      stopLossPct: row.stop_loss_pct ? parseFloat(row.stop_loss_pct) : undefined,
      targetPct: row.target_pct ? parseFloat(row.target_pct) : undefined,
      maxDaysToHold: row.max_days_to_hold,
      analysisReasoning: row.analysis_reasoning,
      riskFactors: row.risk_factors,
      status: row.status,
      expiresAt: row.expires_at,
    }));

    // Map positions
    const positions: VIXPosition[] = (positionsData || []).map((row: any) => ({
      id: row.id?.toString(),
      positionId: row.position_id,
      signalId: row.signal_id,
      symbol: row.symbol,
      contractType: row.contract_type,
      strikePrice: row.strike_price ? parseFloat(row.strike_price) : undefined,
      expirationDate: row.expiration_date,
      entryPrice: parseFloat(row.entry_price),
      entryTime: row.entry_time,
      quantity: row.quantity,
      side: row.side,
      costBasis: parseFloat(row.cost_basis),
      exitPrice: row.exit_price ? parseFloat(row.exit_price) : undefined,
      exitTime: row.exit_time,
      exitReason: row.exit_reason,
      realizedPnl: row.realized_pnl ? parseFloat(row.realized_pnl) : undefined,
      realizedPnlPct: row.realized_pnl_pct ? parseFloat(row.realized_pnl_pct) : undefined,
      vixAtEntry: parseFloat(row.vix_at_entry),
      spyAtEntry: row.spy_at_entry ? parseFloat(row.spy_at_entry) : undefined,
      strategyType: row.strategy_type,
      status: row.status,
    }));

    // Map history
    const history: VIXHistoryPoint[] = (historyData || []).map((row: any) => ({
      timestamp: row.timestamp,
      vixClose: parseFloat(row.vix_close),
      vix3mClose: row.vix3m_close ? parseFloat(row.vix3m_close) : undefined,
      spyClose: row.spy_close ? parseFloat(row.spy_close) : undefined,
      termStructureRatio: row.term_structure_ratio ? parseFloat(row.term_structure_ratio) : undefined,
    }));

    // Calculate metrics from history
    const vixValues = history.map(h => h.vixClose);
    const percentile30d = vixValues.length > 0 && currentVIX
      ? calculatePercentile(currentVIX.vixClose, vixValues.slice(-30))
      : 50;
    const percentile90d = vixValues.length > 0 && currentVIX
      ? calculatePercentile(currentVIX.vixClose, vixValues)
      : 50;

    // Determine term structure
    let termStructure: 'contango' | 'backwardation' | 'flat' = 'flat';
    let termStructureRatio = 1;
    if (currentVIX?.vix3mClose) {
      termStructureRatio = currentVIX.vixClose / currentVIX.vix3mClose;
      if (termStructureRatio < 0.95) termStructure = 'contango';
      else if (termStructureRatio > 1.05) termStructure = 'backwardation';
    }

    // Determine volatility regime
    let regime = 'normal';
    if (currentVIX) {
      if (currentVIX.vixClose < 13 || percentile90d < 10) regime = 'low_vol';
      else if (currentVIX.vixClose < 18 || percentile90d < 40) regime = 'normal';
      else if (currentVIX.vixClose < 25 || percentile90d < 70) regime = 'elevated';
      else if (currentVIX.vixClose < 35 || percentile90d < 90) regime = 'high_vol';
      else regime = 'extreme';
    }

    // Calculate performance metrics
    const closedPositions = await getClosedPositions(30);
    const winRate = closedPositions.length > 0
      ? (closedPositions.filter(p => (p.realizedPnl || 0) > 0).length / closedPositions.length) * 100
      : 0;
    const totalPnl = closedPositions.reduce((sum, p) => sum + (p.realizedPnl || 0), 0);

    return NextResponse.json({
      current: currentVIX ? {
        vix: currentVIX.vixClose,
        vixOpen: currentVIX.vixOpen,
        vixHigh: currentVIX.vixHigh,
        vixLow: currentVIX.vixLow,
        vix3m: currentVIX.vix3mClose,
        spy: currentVIX.spyClose,
        spyChangePct: currentVIX.spyChangePct,
        percentile30d,
        percentile90d,
        termStructure,
        termStructureRatio,
        regime,
      } : null,
      signals,
      positions,
      history,
      performance: {
        winRate,
        totalPnl,
        totalTrades: closedPositions.length,
        openPositions: positions.length,
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in VIX API:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

function calculatePercentile(value: number, data: number[]): number {
  if (data.length === 0) return 50;
  const sorted = [...data].sort((a, b) => a - b);
  const below = sorted.filter(v => v < value).length;
  return (below / sorted.length) * 100;
}

async function getClosedPositions(days: number): Promise<VIXPosition[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('vix_positions')
    .select('*')
    .eq('status', 'closed')
    .gte('exit_time', startDate.toISOString())
    .order('exit_time', { ascending: false });

  if (error) {
    console.error('Error fetching closed positions:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id?.toString(),
    positionId: row.position_id,
    signalId: row.signal_id,
    symbol: row.symbol,
    contractType: row.contract_type,
    strikePrice: row.strike_price ? parseFloat(row.strike_price) : undefined,
    expirationDate: row.expiration_date,
    entryPrice: parseFloat(row.entry_price),
    entryTime: row.entry_time,
    quantity: row.quantity,
    side: row.side,
    costBasis: parseFloat(row.cost_basis),
    exitPrice: row.exit_price ? parseFloat(row.exit_price) : undefined,
    exitTime: row.exit_time,
    exitReason: row.exit_reason,
    realizedPnl: row.realized_pnl ? parseFloat(row.realized_pnl) : undefined,
    realizedPnlPct: row.realized_pnl_pct ? parseFloat(row.realized_pnl_pct) : undefined,
    vixAtEntry: parseFloat(row.vix_at_entry),
    spyAtEntry: row.spy_at_entry ? parseFloat(row.spy_at_entry) : undefined,
    strategyType: row.strategy_type,
    status: row.status,
  }));
}
