'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Target,
  RefreshCw,
  BarChart3,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface VIXData {
  current: {
    vix: number;
    vixOpen: number;
    vixHigh: number;
    vixLow: number;
    vix3m?: number;
    spy?: number;
    spyChangePct?: number;
    percentile30d: number;
    percentile90d: number;
    termStructure: 'contango' | 'backwardation' | 'flat';
    termStructureRatio: number;
    regime: string;
  } | null;
  signals: VIXSignal[];
  positions: VIXPosition[];
  history: VIXHistoryPoint[];
  performance: {
    winRate: number;
    totalPnl: number;
    totalTrades: number;
    openPositions: number;
  };
}

interface VIXSignal {
  id: string;
  signalId: string;
  signalTime: string;
  vixLevel: number;
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
}

interface VIXPosition {
  id: string;
  positionId: string;
  symbol: string;
  contractType: 'stock' | 'call' | 'put';
  strikePrice?: number;
  expirationDate?: string;
  entryPrice: number;
  entryTime: string;
  quantity: number;
  side: 'long' | 'short';
  costBasis: number;
  realizedPnl?: number;
  realizedPnlPct?: number;
  vixAtEntry: number;
  strategyType: string;
  status: 'open' | 'closed' | 'expired';
}

interface VIXHistoryPoint {
  timestamp: string;
  vixClose: number;
  vix3mClose?: number;
  spyClose?: number;
  termStructureRatio?: number;
}

const regimeColors: Record<string, { bg: string; text: string; border: string }> = {
  low_vol: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500' },
  normal: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-500' },
  elevated: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500' },
  high_vol: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-500' },
  extreme: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500' },
};

const signalTypeEmojis: Record<string, string> = {
  oversold: '📉',
  overbought: '📈',
  spike: '⚡',
  term_structure: '📊',
  mean_reversion: '🔄',
  divergence: '↔️',
  event_based: '📅',
};

function VIXSkeleton() {
  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-10 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function VIXTradingPage() {
  const [data, setData] = useState<VIXData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);

  useEffect(() => {
    fetchVIXData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchVIXData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchVIXData = async () => {
    try {
      const response = await fetch('/api/vix?days=30');
      if (!response.ok) throw new Error('Failed to fetch VIX data');

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <VIXSkeleton />;

  const vixChange = data?.current ? (
    ((data.current.vix - data.current.vixOpen) / data.current.vixOpen) * 100
  ) : 0;

  const chartData = data?.history.map(h => ({
    date: new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    vix: h.vixClose,
    vix3m: h.vix3mClose,
    ratio: h.termStructureRatio,
  })) || [];

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-7 w-7" />
              VIX Trading Bot
            </h1>
            <p className="text-muted-foreground">
              Volatility analysis, signals, and VIX options trading
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchVIXData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* VIX Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Current VIX */}
          <Card className={cn(
            'border-2',
            data?.current?.regime && regimeColors[data.current.regime]?.border
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">VIX Index</p>
                  <p className="text-3xl font-bold">
                    {data?.current?.vix.toFixed(2) || '—'}
                  </p>
                  <div className={cn(
                    'flex items-center gap-1 text-sm',
                    vixChange > 0 ? 'text-red-600' : 'text-green-600'
                  )}>
                    {vixChange > 0 ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                    {Math.abs(vixChange).toFixed(2)}%
                  </div>
                </div>
                <Gauge className="h-10 w-10 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          {/* Volatility Regime */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Volatility Regime</p>
              {data?.current?.regime && (
                <Badge
                  className={cn(
                    'mt-2 text-lg px-3 py-1',
                    regimeColors[data.current.regime]?.bg,
                    regimeColors[data.current.regime]?.text
                  )}
                >
                  {data.current.regime.replace('_', ' ').toUpperCase()}
                </Badge>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {data?.current?.percentile90d.toFixed(0)}th percentile (90d)
              </p>
            </CardContent>
          </Card>

          {/* Term Structure */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Term Structure</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={
                  data?.current?.termStructure === 'contango' ? 'default' :
                  data?.current?.termStructure === 'backwardation' ? 'destructive' :
                  'secondary'
                }>
                  {data?.current?.termStructure?.toUpperCase() || 'FLAT'}
                </Badge>
              </div>
              <p className="text-sm mt-2">
                Ratio: <span className="font-medium">{data?.current?.termStructureRatio.toFixed(3)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                VIX/VIX3M
              </p>
            </CardContent>
          </Card>

          {/* SPY Context */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">SPY</p>
              <p className="text-2xl font-bold">
                ${data?.current?.spy?.toFixed(2) || '—'}
              </p>
              {data?.current?.spyChangePct !== undefined && (
                <div className={cn(
                  'flex items-center gap-1 text-sm',
                  data.current.spyChangePct > 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {data.current.spyChangePct > 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {data.current.spyChangePct > 0 ? '+' : ''}{data.current.spyChangePct.toFixed(2)}%
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Bot Performance</p>
              <p className={cn(
                'text-2xl font-bold',
                (data?.performance.totalPnl || 0) > 0 ? 'text-green-600' : 'text-red-600'
              )}>
                ${data?.performance.totalPnl.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-muted-foreground">
                Win Rate: {data?.performance.winRate.toFixed(0)}% ({data?.performance.totalTrades} trades)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* VIX Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              VIX History (30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="vixGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis domain={['auto', 'auto']} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <ReferenceLine y={15} stroke="#22c55e" strokeDasharray="3 3" label="Low Vol" />
                  <ReferenceLine y={20} stroke="#3b82f6" strokeDasharray="3 3" label="Normal" />
                  <ReferenceLine y={30} stroke="#f97316" strokeDasharray="3 3" label="High Vol" />
                  <Area
                    type="monotone"
                    dataKey="vix"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#vixGradient)"
                    name="VIX"
                  />
                  <Line
                    type="monotone"
                    dataKey="vix3m"
                    stroke="#3b82f6"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    name="VIX3M"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Active Signals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Active Trading Signals
              {data?.signals.length ? (
                <Badge variant="destructive">{data.signals.length}</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.signals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active signals at the moment</p>
                <p className="text-sm">The bot will generate signals when volatility conditions are favorable</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data?.signals.map((signal) => (
                  <div
                    key={signal.signalId}
                    className={cn(
                      'border rounded-lg p-4 cursor-pointer transition-all',
                      expandedSignal === signal.signalId ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
                    )}
                    onClick={() => setExpandedSignal(
                      expandedSignal === signal.signalId ? null : signal.signalId
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{signalTypeEmojis[signal.signalType]}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">
                              {signal.signalType.replace('_', ' ').toUpperCase()}
                            </h4>
                            <Badge variant="outline">
                              Strength: {signal.signalStrength}/10
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            VIX: {signal.vixLevel.toFixed(2)} • {new Date(signal.signalTime).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          signal.recommendation.includes('BUY') ? 'default' :
                          signal.recommendation.includes('SELL') ? 'destructive' :
                          'secondary'
                        }
                      >
                        {signal.recommendation.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    {expandedSignal === signal.signalId && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        <p className="text-sm">{signal.analysisReasoning}</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Symbol</p>
                            <p className="font-medium">{signal.suggestedSymbol || 'UVXY'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Target</p>
                            <p className="font-medium text-green-600">+{signal.targetPct}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Stop Loss</p>
                            <p className="font-medium text-red-600">-{signal.stopLossPct}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Max Hold</p>
                            <p className="font-medium">{signal.maxDaysToHold} days</p>
                          </div>
                        </div>

                        {signal.riskFactors && signal.riskFactors.length > 0 && (
                          <div>
                            <p className="text-sm font-medium flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              Risk Factors
                            </p>
                            <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                              {signal.riskFactors.map((risk, i) => (
                                <li key={i}>• {risk}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1">
                            <Target className="h-4 w-4 mr-2" />
                            Execute Signal
                          </Button>
                          <Button size="sm" variant="outline">
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Positions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Open Positions
              {data?.positions.length ? (
                <Badge>{data.positions.length}</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.positions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No open positions</p>
                <p className="text-sm">Execute a signal to open a position</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Symbol</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Side</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Qty</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Entry</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">VIX @ Entry</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Strategy</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.positions.map((position) => (
                      <tr key={position.positionId} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{position.symbol}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{position.contractType}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={position.side === 'long' ? 'default' : 'destructive'}>
                            {position.side}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">{position.quantity}</td>
                        <td className="py-3 px-4">${position.entryPrice.toFixed(2)}</td>
                        <td className="py-3 px-4">{position.vixAtEntry.toFixed(2)}</td>
                        <td className="py-3 px-4 capitalize text-sm">
                          {position.strategyType.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4">
                          <Button size="sm" variant="outline">Close</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Volatility Guide */}
        <Card>
          <CardHeader>
            <CardTitle>Volatility Regime Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                <h4 className="font-medium text-green-800 dark:text-green-200">Low Vol (&lt;13)</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Market is complacent. Good time to buy volatility cheaply. Consider VIX calls or SPY put protection.
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                <h4 className="font-medium text-blue-800 dark:text-blue-200">Normal (13-18)</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Typical market conditions. Focus on term structure trades and event-based plays.
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Elevated (18-25)</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Increasing uncertainty. Watch for mean reversion opportunities. Consider selling volatility.
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-orange-50 dark:bg-orange-950">
                <h4 className="font-medium text-orange-800 dark:text-orange-200">High Vol (25-35)</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Significant fear in the market. Good time to sell puts or buy SPY calls for recovery.
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950">
                <h4 className="font-medium text-red-800 dark:text-red-200">Extreme (&gt;35)</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Market panic. Very high premiums. Be cautious, but major opportunities for long positions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-500">
            <CardContent className="pt-6">
              <p className="text-red-500">Error: {error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
