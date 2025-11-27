import { NextResponse } from 'next/server';
import Alpaca from '@alpacahq/alpaca-trade-api';

function getAlpacaClient(paper: boolean = true): Alpaca {
  const credentials = paper ? {
    apiKey: process.env.ALPACA_PAPER_API_KEY || process.env.ALPACA_API_KEY || '',
    secretKey: process.env.ALPACA_PAPER_SECRET_KEY || process.env.ALPACA_SECRET_KEY || '',
  } : {
    apiKey: process.env.ALPACA_LIVE_API_KEY || process.env.ALPACA_API_KEY || '',
    secretKey: process.env.ALPACA_LIVE_SECRET_KEY || process.env.ALPACA_SECRET_KEY || '',
  };

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
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '500');

    const client = getAlpacaClient(isPaper);

    // Fetch orders based on status
    const orders = await client.getOrders({
      status: status,
      limit: Math.min(limit, 500),
      direction: 'desc'
    } as any);

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

    const ordersData = orders.map(parseOrder);

    // Calculate order statistics
    const filledOrders = ordersData.filter((o: any) => o.status === 'filled');
    const canceledOrders = ordersData.filter((o: any) => o.status === 'canceled');
    const pendingOrders = ordersData.filter((o: any) => ['new', 'accepted', 'pending_new'].includes(o.status));

    // Calculate total value traded
    const totalValueTraded = filledOrders.reduce((sum: number, o: any) => {
      const value = o.filledQty * (o.filledAvgPrice || 0);
      return sum + value;
    }, 0);

    // Group by symbol
    const symbolStats: { [key: string]: { count: number; totalQty: number; totalValue: number } } = {};
    filledOrders.forEach((o: any) => {
      if (!symbolStats[o.symbol]) {
        symbolStats[o.symbol] = { count: 0, totalQty: 0, totalValue: 0 };
      }
      symbolStats[o.symbol].count++;
      symbolStats[o.symbol].totalQty += o.filledQty;
      symbolStats[o.symbol].totalValue += o.filledQty * (o.filledAvgPrice || 0);
    });

    // Get most traded symbols
    const mostTraded = Object.entries(symbolStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([symbol, stats]) => ({ symbol, ...stats }));

    const stats = {
      totalOrders: ordersData.length,
      filledOrders: filledOrders.length,
      canceledOrders: canceledOrders.length,
      pendingOrders: pendingOrders.length,
      totalValueTraded,
      mostTraded,
      buyOrders: filledOrders.filter((o: any) => o.side === 'buy').length,
      sellOrders: filledOrders.filter((o: any) => o.side === 'sell').length
    };

    return NextResponse.json({
      orders: ordersData,
      stats,
      status,
      isPaper,
      lastUpdated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({
      error: 'Failed to fetch orders',
      details: error.message
    }, { status: 500 });
  }
}
