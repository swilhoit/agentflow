'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, Briefcase,
  Activity, RefreshCw, AlertTriangle, CheckCircle,
  Clock, XCircle, ArrowUpRight, ArrowDownRight,
  FileText, Zap
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
type TradingMode = 'paper' | 'live';

// Account Summary Card Component
function AccountSummary({
  data,
  isPaper,
  loading,
  error,
  onRefresh
}: {
  data: TradingData | null;
  isPaper: boolean;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
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

  if (loading) {
    return (
      <div className="border border-border bg-card p-6 flex items-center justify-center h-48">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-destructive bg-destructive/10 p-6">
        <div className="flex items-center gap-2 text-destructive mb-2">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-mono text-sm">Error loading {isPaper ? 'paper' : 'live'} data</span>
        </div>
        <p className="text-xs text-muted-foreground font-mono mb-3">{error}</p>
        <button onClick={onRefresh} className="text-xs font-mono underline">Retry</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground font-mono text-sm">No data available</p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card">
      {/* Header */}
      <div className={`px-4 py-3 border-b border-border flex items-center justify-between ${isPaper ? 'bg-blue-500/10' : 'bg-green-500/10'}`}>
        <div className="flex items-center gap-2">
          {isPaper ? <FileText className="w-4 h-4 text-blue-500" /> : <Zap className="w-4 h-4 text-green-500" />}
          <span className={`font-mono text-sm font-bold ${isPaper ? 'text-blue-500' : 'text-green-500'}`}>
            {isPaper ? 'PAPER TRADING' : 'LIVE TRADING'}
          </span>
        </div>
        <button onClick={onRefresh} className="p-1 hover:bg-muted rounded">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted-foreground font-mono">EQUITY</div>
          <div className="text-xl font-bold font-mono">{formatCurrency(data.metrics.totalEquity)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground font-mono">CASH</div>
          <div className="text-xl font-bold font-mono">{formatCurrency(data.metrics.cash)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground font-mono">DAILY P&L</div>
          <div className={`text-lg font-bold font-mono flex items-center gap-1 ${data.metrics.dailyChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {data.metrics.dailyChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {formatCurrency(Math.abs(data.metrics.dailyChange))}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground font-mono">UNREALIZED</div>
          <div className={`text-lg font-bold font-mono ${data.metrics.totalUnrealizedPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {formatCurrency(data.metrics.totalUnrealizedPL)}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-4 pb-4 grid grid-cols-3 gap-2">
        <div className="bg-muted/30 p-2 text-center rounded">
          <div className="text-lg font-bold font-mono">{data.metrics.positionsCount}</div>
          <div className="text-xs text-muted-foreground font-mono">Positions</div>
        </div>
        <div className="bg-muted/30 p-2 text-center rounded">
          <div className="text-lg font-bold font-mono">{data.metrics.openOrdersCount}</div>
          <div className="text-xs text-muted-foreground font-mono">Open Orders</div>
        </div>
        <div className="bg-muted/30 p-2 text-center rounded">
          <div className="text-lg font-bold font-mono">{data.metrics.totalTrades}</div>
          <div className="text-xs text-muted-foreground font-mono">Trades</div>
        </div>
      </div>
    </div>
  );
}

export default function TradingPage() {
  // Paper trading state
  const [paperData, setPaperData] = useState<TradingData | null>(null);
  const [paperLoading, setPaperLoading] = useState(true);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [paperHistory, setPaperHistory] = useState<any>(null);

  // Live trading state
  const [liveData, setLiveData] = useState<TradingData | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveHistory, setLiveHistory] = useState<any>(null);

  // UI state
  const [activeMode, setActiveMode] = useState<TradingMode>('paper');
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('1M');
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');

  const fetchTradingData = useCallback(async (isPaper: boolean) => {
    const setLoading = isPaper ? setPaperLoading : setLiveLoading;
    const setError = isPaper ? setPaperError : setLiveError;
    const setData = isPaper ? setPaperData : setLiveData;

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
  }, []);

  const fetchHistoryData = useCallback(async (isPaper: boolean) => {
    const setHistory = isPaper ? setPaperHistory : setLiveHistory;
    try {
      const response = await fetch(`/api/trading/history?paper=${isPaper}&period=${historyPeriod}`);
      if (!response.ok) return;
      const json = await response.json();
      setHistory(json);
    } catch (err: any) {
      console.error('Error fetching history:', err);
    }
  }, [historyPeriod]);

  // Initial load - fetch both
  useEffect(() => {
    fetchTradingData(true);  // Paper
    fetchTradingData(false); // Live
  }, [fetchTradingData]);

  // Fetch history when period changes
  useEffect(() => {
    fetchHistoryData(true);
    fetchHistoryData(false);
  }, [fetchHistoryData, historyPeriod]);

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

  // Get active data based on mode
  const activeData = activeMode === 'paper' ? paperData : liveData;
  const activeHistory = activeMode === 'paper' ? paperHistory : liveHistory;
  const activeLoading = activeMode === 'paper' ? paperLoading : liveLoading;
  const activeError = activeMode === 'paper' ? paperError : liveError;

  const chartData = activeHistory?.history || activeData?.portfolioHistory;

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
              Paper & Live Trading Accounts
            </p>
          </div>
          <button
            onClick={() => {
              fetchTradingData(true);
              fetchTradingData(false);
            }}
            className="p-2 border border-border hover:bg-muted transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="font-mono text-xs">REFRESH ALL</span>
          </button>
        </div>

        {/* Account Summary Cards - Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AccountSummary
            data={paperData}
            isPaper={true}
            loading={paperLoading}
            error={paperError}
            onRefresh={() => fetchTradingData(true)}
          />
          <AccountSummary
            data={liveData}
            isPaper={false}
            loading={liveLoading}
            error={liveError}
            onRefresh={() => fetchTradingData(false)}
          />
        </div>

        {/* Mode Toggle for Detailed View */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-mono text-muted-foreground">DETAILED VIEW:</span>
          <div className="flex border border-border">
            <button
              onClick={() => setActiveMode('paper')}
              className={`px-4 py-2 font-mono text-xs uppercase transition-colors flex items-center gap-2 ${
                activeMode === 'paper'
                  ? 'bg-blue-500 text-white'
                  : 'hover:bg-muted'
              }`}
            >
              <FileText className="w-3 h-3" />
              PAPER
            </button>
            <button
              onClick={() => setActiveMode('live')}
              className={`px-4 py-2 font-mono text-xs uppercase transition-colors flex items-center gap-2 ${
                activeMode === 'live'
                  ? 'bg-green-500 text-white'
                  : 'hover:bg-muted'
              }`}
            >
              <Zap className="w-3 h-3" />
              LIVE
            </button>
          </div>
          {activeMode === 'live' && (
            <div className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-mono text-xs">REAL MONEY</span>
            </div>
          )}
        </div>

        {/* Portfolio Chart */}
        <div className="border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-mono uppercase text-muted-foreground flex items-center gap-2">
              {activeMode === 'paper' ? <FileText className="w-4 h-4 text-blue-500" /> : <Zap className="w-4 h-4 text-green-500" />}
              {activeMode === 'paper' ? 'PAPER' : 'LIVE'} PORTFOLIO PERFORMANCE
            </h3>
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
          {activeLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeMode === 'paper' ? '#3b82f6' : '#22c55e'} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={activeMode === 'paper' ? '#3b82f6' : '#22c55e'} stopOpacity={0}/>
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
                    return [value, name];
                  }}
                  labelFormatter={(value) => formatDate(value)}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke={activeMode === 'paper' ? '#3b82f6' : '#22c55e'}
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
          {activeHistory?.stats && (
            <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <div className="text-xs text-muted-foreground font-mono">START</div>
                <div className="font-mono font-bold">{formatCurrency(activeHistory.stats.startEquity)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground font-mono">CURRENT</div>
                <div className="font-mono font-bold">{formatCurrency(activeHistory.stats.endEquity)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground font-mono">TOTAL RETURN</div>
                <div className={`font-mono font-bold ${activeHistory.stats.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(activeHistory.stats.totalReturn)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground font-mono">RETURN %</div>
                <div className={`font-mono font-bold ${activeHistory.stats.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercent(activeHistory.stats.totalReturnPct)}
                </div>
              </div>
            </div>
          )}
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
            POSITIONS ({activeData?.positions.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 font-mono text-sm uppercase transition-colors border-b-2 ${
              activeTab === 'orders'
                ? 'border-accent text-accent'
                : 'border-transparent hover:text-accent'
            }`}
          >
            OPEN ORDERS ({activeData?.openOrders.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-mono text-sm uppercase transition-colors border-b-2 ${
              activeTab === 'history'
                ? 'border-accent text-accent'
                : 'border-transparent hover:text-accent'
            }`}
          >
            TRADE HISTORY ({activeData?.closedOrders.length || 0})
          </button>
        </div>

        {/* Positions Table */}
        {activeTab === 'positions' && (
          <div className="border border-border bg-card">
            {!activeData || activeData.positions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono">
                No open positions in {activeMode === 'paper' ? 'paper' : 'live'} account
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
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">P&L</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">P&L %</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">TODAY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeData.positions.map((position) => (
                      <tr key={position.symbol} className="border-t border-border hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold">{position.symbol}</div>
                          <div className="text-xs text-muted-foreground font-mono">{position.side.toUpperCase()}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">{position.qty.toFixed(4)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(position.avgEntryPrice)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(position.currentPrice)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(position.marketValue)}</td>
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
                  {activeData.positions.length > 0 && (
                    <tfoot className="bg-muted/30 border-t border-border">
                      <tr>
                        <td colSpan={4} className="py-3 px-4 font-mono font-bold">TOTAL</td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {formatCurrency(activeData.positions.reduce((sum, p) => sum + p.marketValue, 0))}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${activeData.metrics.totalUnrealizedPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(activeData.metrics.totalUnrealizedPL)}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono ${activeData.metrics.totalUnrealizedPLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatPercent(activeData.metrics.totalUnrealizedPLPercent)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}

        {/* Open Orders Table */}
        {activeTab === 'orders' && (
          <div className="border border-border bg-card">
            {!activeData || activeData.openOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono">
                No open orders in {activeMode === 'paper' ? 'paper' : 'live'} account
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
                    {activeData.openOrders.map((order) => (
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
            {!activeData || activeData.closedOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono">
                No trade history in {activeMode === 'paper' ? 'paper' : 'live'} account
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
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">FILLED</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">AVG PRICE</th>
                      <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3 px-4">TOTAL</th>
                      <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4">STATUS</th>
                      <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3 px-4">DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeData.closedOrders.map((order) => (
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
