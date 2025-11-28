'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, ExternalLink, RefreshCw, ChevronDown, ChevronRight, Briefcase, BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { PortfolioCategory } from '@/lib/portfolio-categories';

interface Portfolio {
  id: PortfolioCategory;
  name: string;
  description: string;
  symbolCount: number;
}

interface InvestmentData {
  watchlist: Array<{
    symbol: string;
    name: string;
    price: number;
    change_amount: number;
    change_percent: number;
    performance_30d: number;
    performance_90d: number;
    performance_365d: number;
    market_cap: number;
    volume: number;
  }>;
  latestThesis: {
    title: string;
    summary: string;
    detailed_analysis: string;
    key_events: string;
    recommendations: string;
    week_start: string;
    week_end: string;
  };
  recentAnalysis: Array<{
    analysis_type: string;
    title: string;
    summary: string;
    week_start: string;
  }>;
  significantNews: Array<{
    symbol: string;
    headline: string;
    summary: string;
    source: string;
    url: string;
    published_at: string;
    sentiment: string;
  }>;
  portfolioStats: {
    totalSymbols: number;
    avgChange30d: number;
    avgChange90d: number;
    avgChange365d: number;
    winnersCount: number;
    losersCount: number;
    topGainer: any;
    topLoser: any;
  };
  lastUpdated: string;
  category: PortfolioCategory;
  portfolios: Portfolio[];
}

function InvestmentsPageSkeleton() {
  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-lg" />
          ))}
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-24 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function InvestmentsPage() {
  const [data, setData] = useState<InvestmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [dailyAnalysis, setDailyAnalysis] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [stockHistory, setStockHistory] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedAnalysis, setExpandedAnalysis] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PortfolioCategory>('all');

  useEffect(() => {
    fetchInvestments();
    fetchDailyAnalysis();
  }, [selectedCategory]);

  const fetchInvestments = async () => {
    try {
      setLoading(true);
      const url = selectedCategory === 'all'
        ? '/api/investments'
        : `/api/investments?category=${selectedCategory}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch investments');
      }
      const json = await response.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyAnalysis = async () => {
    try {
      setAnalysisLoading(true);
      const response = await fetch('/api/investments/analysis');
      if (!response.ok) {
        console.warn('Failed to fetch daily analysis');
        return;
      }
      const json = await response.json();
      setDailyAnalysis(json);
    } catch (err: any) {
      console.error('Error fetching daily analysis:', err);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const fetchStockHistory = async (symbol: string) => {
    try {
      setHistoryLoading(true);
      const response = await fetch(`/api/investments/history?symbol=${symbol}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stock history');
      }
      const json = await response.json();
      setStockHistory(json);
    } catch (err: any) {
      console.error('Error fetching stock history:', err);
      setStockHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleStockClick = (symbol: string) => {
    if (selectedStock === symbol) {
      setSelectedStock(null);
      setStockHistory(null);
    } else {
      setSelectedStock(symbol);
      fetchStockHistory(symbol);
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    const numAmount = Number(amount);
    if (amount === null || amount === undefined || isNaN(numAmount)) return '$0.00';
    if (numAmount >= 1e12) return `$${(numAmount / 1e12).toFixed(2)}T`;
    if (numAmount >= 1e9) return `$${(numAmount / 1e9).toFixed(2)}B`;
    if (numAmount >= 1e6) return `$${(numAmount / 1e6).toFixed(2)}M`;
    if (numAmount >= 1e3) return `$${(numAmount / 1e3).toFixed(2)}K`;
    return `$${numAmount.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatPercent = (value: number | null | undefined, showSign = true) => {
    const numValue = Number(value);
    if (value === null || value === undefined || isNaN(numValue)) return '—';
    const sign = showSign && numValue >= 0 ? '+' : '';
    return `${sign}${numValue.toFixed(2)}%`;
  };

  if (loading) {
    return <InvestmentsPageSkeleton />;
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-destructive">Error: {error}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No data available</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Investments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Investment thesis, watchlist, and market intelligence
              {data.lastUpdated && (
                <span className="ml-2 text-muted-foreground/70">
                  · Updated {formatDate(data.lastUpdated)}
                </span>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchInvestments}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Portfolio Tabs */}
        {data?.portfolios && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                "px-4 py-2 text-sm rounded-lg transition-colors",
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              All
              <span className="ml-2 text-xs opacity-70">
                {data.portfolios.reduce((sum, p) => sum + p.symbolCount, 0)}
              </span>
            </button>
            {data.portfolios.map((portfolio) => (
              <button
                key={portfolio.id}
                onClick={() => setSelectedCategory(portfolio.id)}
                className={cn(
                  "px-4 py-2 text-sm rounded-lg transition-colors",
                  selectedCategory === portfolio.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                )}
                title={portfolio.description}
              >
                {portfolio.name}
                <span className="ml-2 text-xs opacity-70">{portfolio.symbolCount}</span>
              </button>
            ))}
          </div>
        )}

        {/* Portfolio Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Briefcase className="w-4 h-4" />
                <span className="text-xs font-medium">Watchlist</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {data.portfolioStats.totalSymbols}
              </div>
              <div className="text-xs text-muted-foreground mt-1">symbols tracked</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <BarChart3 className="w-4 h-4" />
                <span className="text-xs font-medium">30-Day Performance</span>
              </div>
              <div className={cn(
                "text-2xl font-semibold tabular-nums",
                data.portfolioStats.avgChange30d >= 0 ? 'text-success' : 'text-destructive'
              )}>
                {formatPercent(data.portfolioStats.avgChange30d)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <span className="text-success">{data.portfolioStats.winnersCount} up</span>
                <span>·</span>
                <span className="text-destructive">{data.portfolioStats.losersCount} down</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-xs font-medium">Top Gainer</span>
              </div>
              <div className="text-lg font-semibold">
                {data.portfolioStats.topGainer?.symbol || '—'}
              </div>
              <div className="text-sm text-success tabular-nums mt-1">
                {formatPercent(data.portfolioStats.topGainer?.performance_30d)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingDown className="w-4 h-4 text-destructive" />
                <span className="text-xs font-medium">Top Loser</span>
              </div>
              <div className="text-lg font-semibold">
                {data.portfolioStats.topLoser?.symbol || '—'}
              </div>
              <div className="text-sm text-destructive tabular-nums mt-1">
                {formatPercent(data.portfolioStats.topLoser?.performance_30d, false)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily AI Analysis */}
        {analysisLoading ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Generating daily analysis...</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : dailyAnalysis?.analysis && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base">Daily AI Analysis</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchDailyAnalysis}
                  className="text-primary hover:text-primary"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Generated {formatDate(dailyAnalysis.timestamp)} · {dailyAnalysis.source} · {dailyAnalysis.model}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {dailyAnalysis.analysis}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Watchlist Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Watchlist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 pr-4">Symbol</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 pr-4">Name</th>
                    <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">Price</th>
                    <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">Change</th>
                    <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">30D</th>
                    <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">90D</th>
                    <th className="text-right text-xs font-medium text-muted-foreground py-3 px-4">1Y</th>
                    <th className="text-right text-xs font-medium text-muted-foreground py-3 pl-4">Market Cap</th>
                  </tr>
                </thead>
                <tbody>
                  {data.watchlist.map((stock, index) => (
                    <React.Fragment key={`${stock.symbol}-${index}`}>
                      <tr
                        className={cn(
                          "border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors",
                          selectedStock === stock.symbol && 'bg-muted/30'
                        )}
                        onClick={() => handleStockClick(stock.symbol)}
                      >
                        <td className="py-3 pr-4">
                          <span className="font-medium text-sm">{stock.symbol}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                            {stock.name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm tabular-nums">${Number(stock.price || 0).toFixed(2)}</span>
                        </td>
                        <td className={cn(
                          "py-3 px-4 text-right text-sm tabular-nums",
                          stock.change_percent >= 0 ? 'text-success' : 'text-destructive'
                        )}>
                          {formatPercent(stock.change_percent)}
                        </td>
                        <td className={cn(
                          "py-3 px-4 text-right text-sm tabular-nums",
                          stock.performance_30d >= 0 ? 'text-success' : 'text-destructive'
                        )}>
                          {formatPercent(stock.performance_30d)}
                        </td>
                        <td className={cn(
                          "py-3 px-4 text-right text-sm tabular-nums",
                          stock.performance_90d >= 0 ? 'text-success' : 'text-destructive'
                        )}>
                          {formatPercent(stock.performance_90d)}
                        </td>
                        <td className={cn(
                          "py-3 px-4 text-right text-sm tabular-nums",
                          stock.performance_365d >= 0 ? 'text-success' : 'text-destructive'
                        )}>
                          {formatPercent(stock.performance_365d)}
                        </td>
                        <td className="py-3 pl-4 text-right">
                          <span className="text-sm text-muted-foreground tabular-nums">
                            {formatCurrency(stock.market_cap)}
                          </span>
                        </td>
                      </tr>
                      {selectedStock === stock.symbol && (
                        <tr>
                          <td colSpan={8} className="p-4 bg-muted/20">
                            {historyLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="flex items-center gap-3">
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  <span className="text-sm text-muted-foreground">Loading chart...</span>
                                </div>
                              </div>
                            ) : stockHistory ? (
                              <div>
                                <div className="text-sm font-medium mb-4">
                                  {stock.symbol} · Price History (90 Days)
                                </div>
                                <ResponsiveContainer width="100%" height={300}>
                                  <LineChart data={stockHistory.history}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis
                                      dataKey="date"
                                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    />
                                    <YAxis
                                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                      tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                                      domain={['dataMin', 'dataMax']}
                                    />
                                    <Tooltip
                                      contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                        fontSize: 12
                                      }}
                                      formatter={(value: any) => [`$${Number(value || 0).toFixed(2)}`, 'Price']}
                                      labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="price"
                                      stroke={stock.performance_90d >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                                      strokeWidth={2}
                                      dot={false}
                                      name="Price"
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <div className="text-center py-8 text-muted-foreground text-sm">
                                No price history available
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Analysis & News Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.recentAnalysis.map((analysis, index) => (
                  <div
                    key={index}
                    className="border-b border-border/50 pb-4 last:border-0 last:pb-0"
                  >
                    <div
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setExpandedAnalysis(expandedAnalysis === index ? null : index)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{analysis.title}</div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <span>{formatDate(analysis.week_start)}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {analysis.analysis_type}
                            </Badge>
                          </div>
                        </div>
                        {expandedAnalysis === index ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className={cn(
                        "text-sm text-muted-foreground mt-2",
                        expandedAnalysis === index ? '' : 'line-clamp-2'
                      )}>
                        {analysis.summary}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Significant News */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Significant News</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {data.significantNews.map((news, index) => (
                  <div
                    key={index}
                    className="border-b border-border/50 pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs font-medium">
                            {news.symbol}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(news.published_at)}
                          </span>
                        </div>
                        <div className="text-sm font-medium">{news.headline}</div>
                        {news.summary && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {news.summary}
                          </div>
                        )}
                      </div>
                      <a
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
