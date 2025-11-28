'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  LineChart, Briefcase, RefreshCw, AlertTriangle, CheckCircle,
  Clock, XCircle, ArrowUpRight, ArrowDownRight, FileText, Zap,
  TrendingUp, TrendingDown, DollarSign, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TradingData {
  account: any;
  positions: Array<any>;
  openOrders: Array<any>;
  closedOrders: Array<any>;
  portfolioHistory: Array<any>;
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

export default function TradingPage() {
  const [paperData, setPaperData] = useState<TradingData | null>(null);
  const [paperLoading, setPaperLoading] = useState(true);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [paperHistory, setPaperHistory] = useState<any>(null);

  const [liveData, setLiveData] = useState<TradingData | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveHistory, setLiveHistory] = useState<any>(null);

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

  useEffect(() => {
    fetchTradingData(true);
    fetchTradingData(false);
  }, [fetchTradingData]);

  useEffect(() => {
    fetchHistoryData(true);
    fetchHistoryData(false);
  }, [fetchHistoryData, historyPeriod]);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercent = (value: number | null | undefined) => {
    const numValue = Number(value);
    if (value === null || value === undefined || isNaN(numValue)) return '0.00%';
    const sign = numValue >= 0 ? '+' : '';
    return `${sign}${numValue.toFixed(2)}%`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const activeData = activeMode === 'paper' ? paperData : liveData;
  const activeHistory = activeMode === 'paper' ? paperHistory : liveHistory;
  const activeLoading = activeMode === 'paper' ? paperLoading : liveLoading;
  const chartData = activeHistory?.history || activeData?.portfolioHistory;

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <LineChart className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-title-lg">Trading</h1>
                <p className="text-body-sm text-muted-foreground mt-1">
                  Paper & Live Trading Accounts
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => { fetchTradingData(true); fetchTradingData(false); }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh All
            </Button>
          </div>

          {/* Account Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <AccountCard
              data={paperData}
              isPaper={true}
              loading={paperLoading}
              error={paperError}
              onRefresh={() => fetchTradingData(true)}
              formatCurrency={formatCurrency}
            />
            <AccountCard
              data={liveData}
              isPaper={false}
              loading={liveLoading}
              error={liveError}
              onRefresh={() => fetchTradingData(false)}
              formatCurrency={formatCurrency}
            />
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-4 mb-6">
            <span className="text-sm text-muted-foreground">Detailed View:</span>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setActiveMode('paper')}
                className={cn(
                  'px-4 py-2 text-sm flex items-center gap-2 transition-colors',
                  activeMode === 'paper' ? 'bg-blue-500 text-white' : 'hover:bg-muted'
                )}
              >
                <FileText className="w-4 h-4" />
                Paper
              </button>
              <button
                onClick={() => setActiveMode('live')}
                className={cn(
                  'px-4 py-2 text-sm flex items-center gap-2 transition-colors border-l border-border',
                  activeMode === 'live' ? 'bg-success text-white' : 'hover:bg-muted'
                )}
              >
                <Zap className="w-4 h-4" />
                Live
              </button>
            </div>
            {activeMode === 'live' && (
              <Badge variant="warning" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Real Money
              </Badge>
            )}
          </div>

          {/* Portfolio Chart */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                {activeMode === 'paper' ? <FileText className="w-4 h-4 text-blue-500" /> : <Zap className="w-4 h-4 text-success" />}
                {activeMode === 'paper' ? 'Paper' : 'Live'} Portfolio Performance
              </CardTitle>
              <div className="flex gap-1">
                {(['1D', '1W', '1M', '3M', '1A', 'all'] as HistoryPeriod[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => setHistoryPeriod(period)}
                    className={cn(
                      'px-3 py-1 text-xs rounded-md transition-colors',
                      historyPeriod === period ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    )}
                  >
                    {period === 'all' ? 'All' : period}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {activeLoading ? (
                <div className="h-[280px] flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : chartData && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={activeMode === 'paper' ? '#3b82f6' : 'hsl(var(--success))'} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={activeMode === 'paper' ? '#3b82f6' : 'hsl(var(--success))'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: 12
                      }}
                      formatter={(value: any) => [formatCurrency(value), 'Equity']}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke={activeMode === 'paper' ? '#3b82f6' : 'hsl(var(--success))'}
                      fill="url(#equityGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                  No portfolio history available
                </div>
              )}
              {activeHistory?.stats && (
                <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
                  <StatItem label="Start" value={formatCurrency(activeHistory.stats.startEquity)} />
                  <StatItem label="Current" value={formatCurrency(activeHistory.stats.endEquity)} />
                  <StatItem
                    label="Total Return"
                    value={formatCurrency(activeHistory.stats.totalReturn)}
                    variant={activeHistory.stats.totalReturn >= 0 ? 'success' : 'destructive'}
                  />
                  <StatItem
                    label="Return %"
                    value={formatPercent(activeHistory.stats.totalReturnPct)}
                    variant={activeHistory.stats.totalReturnPct >= 0 ? 'success' : 'destructive'}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border mb-6">
            {[
              { key: 'positions', label: 'Positions', count: activeData?.positions.length || 0 },
              { key: 'orders', label: 'Open Orders', count: activeData?.openOrders.length || 0 },
              { key: 'history', label: 'Trade History', count: activeData?.closedOrders.length || 0 },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={cn(
                  'px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px',
                  activeTab === tab.key
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                <span className="ml-2 text-xs text-muted-foreground">({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Tables */}
          <Card>
            <CardContent className="p-0">
              {activeTab === 'positions' && (
                <PositionsTable
                  positions={activeData?.positions || []}
                  formatCurrency={formatCurrency}
                  formatPercent={formatPercent}
                  activeMode={activeMode}
                />
              )}
              {activeTab === 'orders' && (
                <OrdersTable
                  orders={activeData?.openOrders || []}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  activeMode={activeMode}
                />
              )}
              {activeTab === 'history' && (
                <TradeHistoryTable
                  orders={activeData?.closedOrders || []}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  activeMode={activeMode}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Account Card Component
function AccountCard({ data, isPaper, loading, error, onRefresh, formatCurrency }: any) {
  if (loading) {
    return (
      <Card className={cn(isPaper ? 'border-blue-500/20' : 'border-success/20')}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Error loading {isPaper ? 'paper' : 'live'} data</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={onRefresh}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const change = data.metrics.dailyChange;
  const isPositive = change >= 0;

  return (
    <Card className={cn(isPaper ? 'border-blue-500/20' : 'border-success/20')}>
      <CardHeader className={cn('pb-3', isPaper ? 'bg-blue-500/5' : 'bg-success/5')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPaper ? <FileText className="w-4 h-4 text-blue-500" /> : <Zap className="w-4 h-4 text-success" />}
            <span className={cn('text-sm font-semibold', isPaper ? 'text-blue-500' : 'text-success')}>
              {isPaper ? 'Paper Trading' : 'Live Trading'}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Equity</div>
            <div className="text-xl font-semibold tabular-nums">{formatCurrency(data.metrics.totalEquity)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Cash</div>
            <div className="text-xl font-semibold tabular-nums">{formatCurrency(data.metrics.cash)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Daily P&L</div>
            <div className={cn('text-lg font-semibold tabular-nums flex items-center gap-1', isPositive ? 'text-success' : 'text-destructive')}>
              {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {formatCurrency(Math.abs(change))}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Unrealized</div>
            <div className={cn('text-lg font-semibold tabular-nums', data.metrics.totalUnrealizedPL >= 0 ? 'text-success' : 'text-destructive')}>
              {formatCurrency(data.metrics.totalUnrealizedPL)}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Positions', value: data.metrics.positionsCount },
            { label: 'Open Orders', value: data.metrics.openOrdersCount },
            { label: 'Trades', value: data.metrics.totalTrades },
          ].map((item) => (
            <div key={item.label} className="bg-muted/30 p-2.5 rounded-lg text-center">
              <div className="text-lg font-semibold tabular-nums">{item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Stat Item Component
function StatItem({ label, value, variant }: { label: string; value: string; variant?: 'success' | 'destructive' }) {
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn('font-semibold tabular-nums', variant === 'success' && 'text-success', variant === 'destructive' && 'text-destructive')}>
        {value}
      </div>
    </div>
  );
}

// Positions Table
function PositionsTable({ positions, formatCurrency, formatPercent, activeMode }: any) {
  if (positions.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        No open positions in {activeMode} account
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Symbol</th>
            <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">Qty</th>
            <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">Avg Entry</th>
            <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">Current</th>
            <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">Mkt Value</th>
            <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">P&L</th>
            <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">P&L %</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p: any) => (
            <tr key={p.symbol} className="border-b border-border/50 hover:bg-muted/20">
              <td className="py-3 px-4">
                <div className="font-medium">{p.symbol}</div>
                <div className="text-xs text-muted-foreground">{p.side}</div>
              </td>
              <td className="py-3 px-4 text-right tabular-nums">{Number(p.qty || 0).toFixed(4)}</td>
              <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(p.avgEntryPrice)}</td>
              <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(p.currentPrice)}</td>
              <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(p.marketValue)}</td>
              <td className={cn('py-3 px-4 text-right tabular-nums font-medium', p.unrealizedPL >= 0 ? 'text-success' : 'text-destructive')}>
                {formatCurrency(p.unrealizedPL)}
              </td>
              <td className={cn('py-3 px-4 text-right tabular-nums', p.unrealizedPLPercent >= 0 ? 'text-success' : 'text-destructive')}>
                {formatPercent(p.unrealizedPLPercent)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Orders Table
function OrdersTable({ orders, formatCurrency, formatDate, activeMode }: any) {
  if (orders.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        No open orders in {activeMode} account
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Symbol</th>
            <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Side</th>
            <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Type</th>
            <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">Qty</th>
            <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">Limit</th>
            <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Status</th>
            <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Created</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o: any) => (
            <tr key={o.id} className="border-b border-border/50 hover:bg-muted/20">
              <td className="py-3 px-4 font-medium">{o.symbol}</td>
              <td className={cn('py-3 px-4', o.side === 'buy' ? 'text-success' : 'text-destructive')}>{o.side}</td>
              <td className="py-3 px-4 text-muted-foreground">{o.orderType}</td>
              <td className="py-3 px-4 text-right tabular-nums">{o.qty}</td>
              <td className="py-3 px-4 text-right tabular-nums">{o.limitPrice ? formatCurrency(o.limitPrice) : '-'}</td>
              <td className="py-3 px-4">
                <Badge variant={o.status === 'filled' ? 'success' : o.status === 'canceled' ? 'destructive' : 'default'}>
                  {o.status}
                </Badge>
              </td>
              <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(o.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Trade History Table
function TradeHistoryTable({ orders, formatCurrency, formatDate, activeMode }: any) {
  if (orders.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        No trade history in {activeMode} account
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Symbol</th>
            <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Side</th>
            <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">Qty</th>
            <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">Avg Price</th>
            <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">Total</th>
            <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Status</th>
            <th className="text-left text-xs font-medium text-muted-foreground py-3 px-4">Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o: any) => (
            <tr key={o.id} className="border-b border-border/50 hover:bg-muted/20">
              <td className="py-3 px-4 font-medium">{o.symbol}</td>
              <td className={cn('py-3 px-4', o.side === 'buy' ? 'text-success' : 'text-destructive')}>{o.side}</td>
              <td className="py-3 px-4 text-right tabular-nums">{o.filledQty}</td>
              <td className="py-3 px-4 text-right tabular-nums">{o.filledAvgPrice ? formatCurrency(o.filledAvgPrice) : '-'}</td>
              <td className="py-3 px-4 text-right tabular-nums">
                {o.filledAvgPrice && o.filledQty ? formatCurrency(o.filledAvgPrice * o.filledQty) : '-'}
              </td>
              <td className="py-3 px-4">
                <Badge variant={o.status === 'filled' ? 'success' : o.status === 'canceled' ? 'destructive' : 'default'}>
                  {o.status}
                </Badge>
              </td>
              <td className="py-3 px-4 text-xs text-muted-foreground">{o.filledAt ? formatDate(o.filledAt) : formatDate(o.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
