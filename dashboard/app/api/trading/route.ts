import { NextResponse } from 'next/server';
import Alpaca from '@alpacahq/alpaca-trade-api';

interface AlpacaCredentials {
  apiKey: string;
  secretKey: string;
  paper: boolean;
}

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

    // Fetch all data in parallel
    const [account, positions, openOrders, closedOrders, portfolioHistory] = await Promise.all([
      client.getAccount(),
      client.getPositions(),
      client.getOrders({ status: 'open', limit: 100 } as any),
      client.getOrders({ status: 'closed', limit: 100 } as any),
      client.getPortfolioHistory({ period: '1M', timeframe: '1D' } as any)
    ]);

    // Parse account data
    const accountData = {
      id: account.id,
      accountNumber: account.account_number,
      status: account.status,
      currency: account.currency,
      cash: parseFloat(account.cash),
      portfolioValue: parseFloat(account.portfolio_value),
      buyingPower: parseFloat(account.buying_power),
      daytradeCount: parseInt(account.daytrade_count),
      patternDayTrader: account.pattern_day_trader,
      tradingBlocked: account.trading_blocked,
      equity: parseFloat(account.equity),
      lastEquity: parseFloat(account.last_equity),
      longMarketValue: parseFloat(account.long_market_value),
      shortMarketValue: parseFloat(account.short_market_value),
      initialMargin: parseFloat(account.initial_margin),
      maintenanceMargin: parseFloat(account.maintenance_margin),
      dayTradingBuyingPower: parseFloat(account.daytrading_buying_power),
      regtBuyingPower: parseFloat(account.regt_buying_power)
    };

    // Parse positions
    const positionsData = positions.map((pos: any) => ({
      assetId: pos.asset_id,
      symbol: pos.symbol,
      exchange: pos.exchange,
      assetClass: pos.asset_class,
      avgEntryPrice: parseFloat(pos.avg_entry_price),
      qty: parseFloat(pos.qty),
      side: pos.side,
      marketValue: parseFloat(pos.market_value),
      costBasis: parseFloat(pos.cost_basis),
      unrealizedPL: parseFloat(pos.unrealized_pl),
      unrealizedPLPercent: parseFloat(pos.unrealized_plpc) * 100,
      currentPrice: parseFloat(pos.current_price),
      lastdayPrice: parseFloat(pos.lastday_price),
      changeToday: parseFloat(pos.change_today) * 100
    }));

    // Parse orders
    const parseOrder = (order: any) => ({
      id: order.id,
      clientOrderId: order.client_order_id,
      symbol: order.symbol,
      assetClass: order.asset_class,
      qty: parseFloat(order.qty || '0'),
      filledQty: parseFloat(order.filled_qty || '0'),
      filledAvgPrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null,
      orderType: order.order_type || order.type,
      side: order.side,
      timeInForce: order.time_in_force,
      limitPrice: order.limit_price ? parseFloat(order.limit_price) : null,
      stopPrice: order.stop_price ? parseFloat(order.stop_price) : null,
      status: order.status,
      extendedHours: order.extended_hours,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      submittedAt: order.submitted_at,
      filledAt: order.filled_at,
      expiredAt: order.expired_at,
      canceledAt: order.canceled_at,
      failedAt: order.failed_at
    });

    const openOrdersData = openOrders.map(parseOrder);
    const closedOrdersData = closedOrders.map(parseOrder);

    // Parse portfolio history
    const historyData = portfolioHistory.timestamp.map((ts: number, i: number) => ({
      timestamp: ts * 1000, // Convert to milliseconds
      date: new Date(ts * 1000).toISOString(),
      equity: portfolioHistory.equity[i],
      profitLoss: portfolioHistory.profit_loss[i],
      profitLossPct: portfolioHistory.profit_loss_pct[i] * 100
    }));

    // Calculate trading metrics
    const filledOrders = closedOrdersData.filter((o: any) => o.status === 'filled');
    const buyOrders = filledOrders.filter((o: any) => o.side === 'buy');
    const sellOrders = filledOrders.filter((o: any) => o.side === 'sell');

    // Calculate daily change
    const dailyChange = accountData.equity - accountData.lastEquity;
    const dailyChangePercent = accountData.lastEquity > 0
      ? (dailyChange / accountData.lastEquity) * 100
      : 0;

    // Calculate total unrealized P&L
    const totalUnrealizedPL = positionsData.reduce((sum: number, pos: any) => sum + pos.unrealizedPL, 0);
    const totalCostBasis = positionsData.reduce((sum: number, pos: any) => sum + pos.costBasis, 0);
    const totalUnrealizedPLPercent = totalCostBasis > 0
      ? (totalUnrealizedPL / totalCostBasis) * 100
      : 0;

    // Calculate win rate from closed orders (simplified)
    const profitableTrades = sellOrders.filter((o: any) => {
      // This is a simplified calculation - in reality you'd match buys to sells
      return o.filledAvgPrice && o.filledAvgPrice > 0;
    });

    const metrics = {
      totalEquity: accountData.equity,
      portfolioValue: accountData.portfolioValue,
      cash: accountData.cash,
      buyingPower: accountData.buyingPower,
      dailyChange,
      dailyChangePercent,
      totalUnrealizedPL,
      totalUnrealizedPLPercent,
      positionsCount: positionsData.length,
      openOrdersCount: openOrdersData.length,
      totalTrades: filledOrders.length,
      buyOrdersCount: buyOrders.length,
      sellOrdersCount: sellOrders.length,
      daytradeCount: accountData.daytradeCount,
      patternDayTrader: accountData.patternDayTrader
    };

    return NextResponse.json({
      account: accountData,
      positions: positionsData,
      openOrders: openOrdersData,
      closedOrders: closedOrdersData,
      portfolioHistory: historyData,
      metrics,
      isPaper,
      lastUpdated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching trading data:', error);
    return NextResponse.json({
      error: 'Failed to fetch trading data',
      details: error.message
    }, { status: 500 });
  }
}
