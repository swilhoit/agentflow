'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Briefcase,
  Activity, RefreshCw, AlertTriangle, CheckCircle,
  Clock, XCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

interface TradingData {
  account: {
    id: string;
    accountNumber: string;
    status: string;
    cash: number;
    portfolioValue: number;
    buyingPower: number;
    equity: number;
    lastEquity: number;
    daytradeCount: number;
    patternDayTrader: boolean;
    tradingBlocked: boolean;
  };
  positions: Array<{
    symbol: string;
    exchange: string;
    assetClass: string;
    avgEntryPrice: number;
    qty: number;
    side: string;
    marketValue: number;
    costBasis: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
    currentPrice: number;
    lastdayPrice: number;
    changeToday: number;
  }>;
  openOrders: Array<{
    id: string;
    symbol: string;
    qty: number;
    filledQty: number;
    filledAvgPrice: number | null;
    orderType: string;
    side: string;
    status: string;
    limitPrice: number | null;
    stopPrice: number | null;
    createdAt: string;
    filledAt: string | null;
  }>;
  closedOrders: Array<{
    id: string;
    symbol: string;
    qty: number;
    filledQty: number;
    filledAvgPrice: number | null;
    orderType: string;
    side: string;
    status: string;
    limitPrice: number | null;
    stopPrice: number | null;
    createdAt: string;
    filledAt: string | null;
  }>;
  portfolioHistory: Array<{
    timestamp: number;
    date: string;
    equity: number;
    profitLoss: number;
    profitLossPct: number;
  }>;
  metrics: {
    totalEquity: number;
    portfolioValue: number;
    cash: number;
    buyingPower: number;
    dailyChange: number;
    dailyChangePercent: number;
    totalUnrealizedPL: number;
    totalUnrealizedPLPercent: number;
    positionsCount: number;
    openOrdersCount: number;
    totalTrades: number;
    daytradeCount: number;
    patternDayTrader: boolean;
  };
  isPaper: boolean;
  lastUpdated: string;
}

type HistoryPeriod = '1D' | '1W' | '1M' | '3M' | '1A' | 'all';

export default function TradingPage() {
  const [data, setData] = useState<TradingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaper, setIsPaper] = useState(true);
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('1M');
  const [historyData, setHistoryData] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');

  const fetchTradingData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/trading?paper=${isPaper}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to fetch trading data');
      }
      const json = await response.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isPaper]);

  const fetchHistoryData = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const response = await fetch(`/api/trading/history?paper=${isPaper}&period=${historyPeriod}`);
      if (!response.ok) {
        console.warn('Failed to fetch history');
        return;
      }
      const json = await response.json();
      setHistoryData(json);
    } catch (err: any) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [isPaper, historyPeriod]);

  useEffect(() => {
    fetchTradingData();
  }, [fetchTradingData]);

  useEffect(() => {
    fetchHistoryData();
  }, [fetchHistoryData]);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return '0.00%';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'filled': return 'text-green-500';
      case 'canceled': return 'text-red-500';
      case 'new':
      case 'accepted':
      case 'pending_new': return 'text-yellow-500';
      case 'rejected':
      case 'failed': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'filled': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'canceled': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'new':
      case 'accepted':
      case 'pending_new': return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground font-mono flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              LOADING TRADING DATA...
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="border border-destructive bg-destructive/10 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-mono">Error: {error}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2 font-mono">
              Make sure your Alpaca API credentials are configured in environment variables.
            </p>
            <button
              onClick={fetchTradingData}
              className="mt-4 px-4 py-2 bg-accent text-accent-foreground font-mono text-sm hover:opacity-80"
            >
              RETRY
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-muted-foreground font-mono">No trading data available</div>
        </div>
      </DashboardLayout>
    );
  }

  const chartData = historyData?.history || data.portfolioHistory;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-mono uppercase flex items-center gap-3">
              <Activity className="w-8 h-8" />
              TRADING DASHBOARD
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-2">
              {isPaper ? 'Paper Trading' : 'Live Trading'} • Account: {data.account.accountNumber}
              {data.lastUpdated && ` • Updated: ${formatDate(data.lastUpdated)}`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchTradingData}
              className="p-2 border border-border hover:bg-muted transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {/* Paper/Live Toggle */}
            <div className="flex border border-border">
              <button
                onClick={() => setIsPaper(true)}
                className={`px-4 py-2 font-mono text-xs uppercase transition-colors ${
                  isPaper
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                PAPER
              </button>
              <button
                onClick={() => setIsPaper(false)}
                className={`px-4 py-2 font-mono text-xs uppercase transition-colors ${
                  !isPaper
                    ? 'bg-destructive text-destructive-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                LIVE
              </button>
            </div>
          </div>
        </div>

        {/* Warning for Live Trading */}
        {!isPaper && (
          <div className="border border-destructive bg-destructive/10 p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <span className="font-mono text-sm text-destructive">
              LIVE TRADING MODE - Real money is at risk
            </span>
          </div>
        )}

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground font-mono uppercase flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              EQUITY
            </div>
            <div className="text-2xl font-bold font-mono mt-2">
              {formatCurrency(data.metrics.totalEquity)}
            </div>
          </div>

          <div className="border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground font-mono uppercase flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              POSITIONS VALUE
            </div>
            <div className="text-2xl font-bold font-mono mt-2">
              {formatCurrency(data.metrics.portfolioValue)}
            </div>
          </div>

          <div className="border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground font-mono uppercase">CASH</div>
            <div className="text-2xl font-bold font-mono mt-2">
              {formatCurrency(data.metrics.cash)}
            </div>
          </div>

          <div className="border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground font-mono uppercase">DAILY P&L</div>
            <div className={`text-2xl font-bold font-mono mt-2 flex items-center gap-1 ${
              data.metrics.dailyChange >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {data.metrics.dailyChange >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
              {formatCurrency(Math.abs(data.metrics.dailyChange))}
            </div>
            <div className={`text-xs font-mono ${data.metrics.dailyChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatPercent(data.metrics.dailyChangePercent)}
            </div>
          </div>

          <div className="border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground font-mono uppercase">UNREALIZED P&L</div>
            <div className={`text-2xl font-bold font-mono mt-2 ${
              data.metrics.totalUnrealizedPL >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {formatCurrency(data.metrics.totalUnrealizedPL)}
            </div>
            <div className={`text-xs font-mono ${data.metrics.totalUnrealizedPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatPercent(data.metrics.totalUnrealizedPLPercent)}
            </div>
          </div>

          <div className="border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground font-mono uppercase">BUYING POWER</div>
            <div className="text-2xl font-bold font-mono mt-2">
              {formatCurrency(data.metrics.buyingPower)}
            </div>
          </div>
        </div>

        {/* Portfolio Chart */}
        <div className="border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-mono uppercase text-muted-foreground">PORTFOLIO PERFORMANCE</h3>
            <div className="flex gap-1">
              {(['1D', '1W', '1M', '3M', '1A', 'all'] as HistoryPeriod[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setHistoryPeriod(period)}
                  className={`px-3 py-1 font-mono text-xs transition-colors ${
                    historyPeriod === period
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted border border-border'
                  }`}
                >
                  {period === 'all' ? 'ALL' : period}
                </button>
              ))}
            </div>
          </div>
          {historyLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }}
                  tickFormatter={formatShortDate}
                />
                <YAxis
                  tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  domain={['dataMin', 'dataMax']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    fontFamily: 'monospace',
                    fontSize: 12
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'equity') return [formatCurrency(value), 'Equity'];
                    if (name === 'profitLoss') return [formatCurrency(value), 'P&L'];
                    return [value, name];
                  }}
                  labelFormatter={(value) => formatDate(value)}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke="hsl(var(--accent))"
                  fill="url(#equityGradient)"
                  strokeWidth={2}
                  name="equity"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground font-mono text-sm">
              No portfolio history available
            </div>
          )}
          {historyData?.stats && (
            <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <div className="text-xs text-muted-foreground font-mono">START</div>
                <div className="font-mono font-bold">{formatCurrency(historyData.stats.startEquity)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground font-mono">CURRENT</div>
                <div className="font-mono font-bold">{formatCurrency(historyData.stats.endEquity)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground font-mono">TOTAL RETURN</div>
                <div className={`font-mono font-bold ${historyData.stats.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(historyData.stats.totalReturn)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground font-mono">RETURN %</div>
                <div className={`font-mono font-bold ${historyData.stats.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercent(historyData.stats.totalReturnPct)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-border bg-card p-4 text-center">
            <div className="text-3xl font-bold font-mono">{data.metrics.positionsCount}</div>
            <div className="text-xs text-muted-foreground font-mono">POSITIONS</div>
          </div>
          <div className="border border-border bg-card p-4 text-center">
            <div className="text-3xl font-bold font-mono">{data.metrics.openOrdersCount}</div>
            <div className="text-xs text-muted-foreground font-mono">OPEN ORDERS</div>
          </div>
          <div className="border border-border bg-card p-4 text-center">
            <div className="text-3xl font-bold font-mono">{data.metrics.totalTrades}</div>
            <div className="text-xs text-muted-foreground font-mono">TOTAL TRADES</div>
          </div>
          <div className="border border-border bg-card p-4 text-center">
            <div className="text-3xl font-bold font-mono">{data.metrics.daytradeCount}</div>
            <div className="text-xs text-muted-foreground font-mono">DAY TRADES</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-4 py-2 font-mono text-sm uppercase transition-colors border-b-2 ${
              activeTab === 'positions'
                ? 'border-accent text-accent'
                : 'border-transparent hover:text-accent'
            }`}
          >
            POSITIONS ({data.positions.length})
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 font-mono text-sm uppercase transition-colors border-b-2 ${
              activeTab === 'orders'
                ? 'border-accent text-accent'
                : 'border-transparent hover:text-accent'
            }`}
          >
            OPEN ORDERS ({data.openOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-mono text-sm uppercase transition-colors border-b-2 ${
              activeTab === 'history'
                ? 'border-accent text-accent'
                : 'border-transparent hover:text-accent'
            }`}
          >
            TRADE HISTORY ({data.closedOrders.length})
          </button>
        </div>

        {/* Positions Table */}
        {activeTab === 'positions' && (
          <div className="border border-border bg-card">
            {data.positions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono">
                No open positions
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4">SYMBOL</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">QTY</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">AVG ENTRY</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">CURRENT</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">MKT VALUE</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">COST BASIS</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">P&L</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">P&L %</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">TODAY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.positions.map((position) => (
                      <tr key={position.symbol} className="border-t border-border hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold">{position.symbol}</div>
                          <div className="text-xs text-muted-foreground font-mono">{position.side.toUpperCase()}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">{position.qty.toFixed(4)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(position.avgEntryPrice)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(position.currentPrice)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(position.marketValue)}</td>
                        <td className="py-3 px-4 text-right font-mono text-muted-foreground">{formatCurrency(position.costBasis)}</td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${position.unrealizedPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(position.unrealizedPL)}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono ${position.unrealizedPLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatPercent(position.unrealizedPLPercent)}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono ${position.changeToday >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatPercent(position.changeToday)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t border-border">
                    <tr>
                      <td colSpan={4} className="py-3 px-4 font-mono font-bold">TOTAL</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {formatCurrency(data.positions.reduce((sum, p) => sum + p.marketValue, 0))}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                        {formatCurrency(data.positions.reduce((sum, p) => sum + p.costBasis, 0))}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${data.metrics.totalUnrealizedPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatCurrency(data.metrics.totalUnrealizedPL)}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono ${data.metrics.totalUnrealizedPLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatPercent(data.metrics.totalUnrealizedPLPercent)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Open Orders Table */}
        {activeTab === 'orders' && (
          <div className="border border-border bg-card">
            {data.openOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono">
                No open orders
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4">SYMBOL</th>
                      <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4">SIDE</th>
                      <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4">TYPE</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">QTY</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">LIMIT</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">STOP</th>
                      <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4">STATUS</th>
                      <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4">CREATED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.openOrders.map((order) => (
                      <tr key={order.id} className="border-t border-border hover:bg-muted/30">
                        <td className="py-3 px-4 font-mono font-bold">{order.symbol}</td>
                        <td className={`py-3 px-4 font-mono ${order.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                          {order.side.toUpperCase()}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">{order.orderType?.toUpperCase()}</td>
                        <td className="py-3 px-4 text-right font-mono">{order.qty}</td>
                        <td className="py-3 px-4 text-right font-mono">
                          {order.limitPrice ? formatCurrency(order.limitPrice) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {order.stopPrice ? formatCurrency(order.stopPrice) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(order.status)}
                            <span className={`font-mono text-xs ${getStatusColor(order.status)}`}>
                              {order.status.toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Trade History Table */}
        {activeTab === 'history' && (
          <div className="border border-border bg-card">
            {data.closedOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono">
                No trade history
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4">SYMBOL</th>
                      <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4">SIDE</th>
                      <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4">TYPE</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">QTY</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">FILLED QTY</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">AVG PRICE</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">TOTAL</th>
                      <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4">STATUS</th>
                      <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4">FILLED AT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.closedOrders.map((order) => (
                      <tr key={order.id} className="border-t border-border hover:bg-muted/30">
                        <td className="py-3 px-4 font-mono font-bold">{order.symbol}</td>
                        <td className={`py-3 px-4 font-mono ${order.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                          {order.side.toUpperCase()}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">{order.orderType?.toUpperCase()}</td>
                        <td className="py-3 px-4 text-right font-mono">{order.qty}</td>
                        <td className="py-3 px-4 text-right font-mono">{order.filledQty}</td>
                        <td className="py-3 px-4 text-right font-mono">
                          {order.filledAvgPrice ? formatCurrency(order.filledAvgPrice) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {order.filledAvgPrice && order.filledQty
                            ? formatCurrency(order.filledAvgPrice * order.filledQty)
                            : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(order.status)}
                            <span className={`font-mono text-xs ${getStatusColor(order.status)}`}>
                              {order.status.toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {order.filledAt ? formatDate(order.filledAt) : formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
