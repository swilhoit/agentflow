'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
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
    if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
    if (amount >= 1e12) return `$${(amount / 1e12).toFixed(2)}T`;
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(2)}K`;
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground font-mono">LOADING INVESTMENTS...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="border border-destructive bg-destructive/10 p-4 text-destructive">
            Error: {error}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-muted-foreground">No data available</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold font-mono uppercase">📈 INVESTMENTS & MARKET ANALYSIS</h1>
          <p className="text-sm text-muted-foreground font-mono mt-2">
            Investment thesis, watchlist, and market intelligence
            {data.lastUpdated && ` • Last updated: ${formatDate(data.lastUpdated)}`}
          </p>
        </div>

        {/* Portfolio Tabs */}
        {data?.portfolios && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 font-mono text-xs uppercase whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-card border border-border hover:bg-muted'
              }`}
            >
              ALL ({data.portfolios.reduce((sum, p) => sum + p.symbolCount, 0)})
            </button>
            {data.portfolios.map((portfolio) => (
              <button
                key={portfolio.id}
                onClick={() => setSelectedCategory(portfolio.id)}
                className={`px-4 py-2 font-mono text-xs uppercase whitespace-nowrap transition-colors ${
                  selectedCategory === portfolio.id
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-card border border-border hover:bg-muted'
                }`}
                title={portfolio.description}
              >
                {portfolio.name} ({portfolio.symbolCount})
              </button>
            ))}
          </div>
        )}

        {/* Portfolio Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border border-border bg-card p-6">
            <div className="text-xs text-muted-foreground font-mono uppercase">WATCHLIST</div>
            <div className="text-3xl font-bold font-mono mt-2">{data.portfolioStats.totalSymbols}</div>
            <div className="text-xs text-muted-foreground font-mono mt-1">symbols tracked</div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-xs text-muted-foreground font-mono uppercase">30-DAY PERF</div>
            <div className={`text-3xl font-bold font-mono mt-2 ${data.portfolioStats.avgChange30d >= 0 ? 'text-accent' : 'text-destructive'}`}>
              {data.portfolioStats.avgChange30d >= 0 ? '+' : ''}{data.portfolioStats.avgChange30d.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-1">
              {data.portfolioStats.winnersCount}↑ {data.portfolioStats.losersCount}↓
            </div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-xs text-muted-foreground font-mono uppercase">TOP GAINER</div>
            <div className="text-lg font-bold font-mono mt-2">{data.portfolioStats.topGainer?.symbol}</div>
            <div className="text-xs text-accent font-mono mt-1">
              +{data.portfolioStats.topGainer?.performance_30d?.toFixed(2)}%
            </div>
          </div>

          <div className="border border-border bg-card p-6">
            <div className="text-xs text-muted-foreground font-mono uppercase">TOP LOSER</div>
            <div className="text-lg font-bold font-mono mt-2">{data.portfolioStats.topLoser?.symbol}</div>
            <div className="text-xs text-destructive font-mono mt-1">
              {data.portfolioStats.topLoser?.performance_30d?.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Daily AI Analysis */}
        {analysisLoading ? (
          <div className="border border-border bg-card p-6">
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground font-mono text-sm">GENERATING DAILY ANALYSIS...</div>
            </div>
          </div>
        ) : dailyAnalysis?.analysis && (
          <div className="border border-accent/30 bg-accent/5 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-bold font-mono uppercase">🤖 DAILY AI ANALYSIS</h2>
              </div>
              <button
                onClick={fetchDailyAnalysis}
                className="text-xs font-mono text-accent hover:opacity-70 transition-opacity"
              >
                REFRESH
              </button>
            </div>
            <div className="space-y-3">
              <div className="font-mono text-xs text-muted-foreground">
                Generated: {formatDate(dailyAnalysis.timestamp)} • {dailyAnalysis.source} • {dailyAnalysis.model}
              </div>
              <div className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
                {dailyAnalysis.analysis}
              </div>
            </div>
          </div>
        )}

        {/* Watchlist Table */}
        <div className="border border-border bg-card p-6">
          <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">📊 WATCHLIST</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3">SYMBOL</th>
                  <th className="text-left font-mono text-xs uppercase text-muted-foreground py-3">NAME</th>
                  <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3">PRICE</th>
                  <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3">CHANGE</th>
                  <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3">30D</th>
                  <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3">90D</th>
                  <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3">1Y</th>
                  <th className="text-right font-mono text-xs uppercase text-muted-foreground py-3">MKT CAP</th>
                </tr>
              </thead>
              <tbody>
                {data.watchlist.map((stock, index) => (
                  <React.Fragment key={`${stock.symbol}-${index}`}>
                    <tr
                      className={`hover:bg-muted/50 cursor-pointer ${selectedStock === stock.symbol ? 'bg-muted/30' : ''}`}
                      onClick={() => handleStockClick(stock.symbol)}
                    >
                      <td className="py-3 font-mono text-sm font-bold">{stock.symbol}</td>
                      <td className="py-3 font-mono text-sm truncate max-w-[200px]">{stock.name}</td>
                      <td className="py-3 font-mono text-sm text-right">${stock.price.toFixed(2)}</td>
                      <td className={`py-3 font-mono text-sm text-right ${stock.change_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent.toFixed(2)}%
                      </td>
                      <td className={`py-3 font-mono text-sm text-right ${stock.performance_30d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {stock.performance_30d >= 0 ? '+' : ''}{stock.performance_30d?.toFixed(2)}%
                      </td>
                      <td className={`py-3 font-mono text-sm text-right ${stock.performance_90d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {stock.performance_90d >= 0 ? '+' : ''}{stock.performance_90d?.toFixed(2)}%
                      </td>
                      <td className={`py-3 font-mono text-sm text-right ${stock.performance_365d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {stock.performance_365d >= 0 ? '+' : ''}{stock.performance_365d?.toFixed(2)}%
                      </td>
                      <td className="py-3 font-mono text-sm text-right text-muted-foreground">
                        {formatCurrency(stock.market_cap)}
                      </td>
                    </tr>
                    {selectedStock === stock.symbol && (
                      <tr>
                        <td colSpan={8} className="p-4 bg-muted/20">
                          {historyLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="text-muted-foreground font-mono text-sm">Loading chart...</div>
                            </div>
                          ) : stockHistory ? (
                            <div>
                              <div className="font-mono text-sm font-bold mb-4">{stock.symbol} - Price History (90 Days)</div>
                              <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={stockHistory.history}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                  <XAxis
                                    dataKey="date"
                                    tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  />
                                  <YAxis
                                    tick={{ fill: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 10 }}
                                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                                    domain={['dataMin', 'dataMax']}
                                  />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: 'var(--card)',
                                      border: '1px solid var(--border)',
                                      fontFamily: 'monospace',
                                      fontSize: 12
                                    }}
                                    formatter={(value: any) => `$${value.toFixed(2)}`}
                                    labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="price"
                                    stroke={stock.performance_90d >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
                                    strokeWidth={2}
                                    dot={false}
                                    name="Price"
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground font-mono text-sm">
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
        </div>

        {/* Recent Analysis & News Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Analysis */}
          <div className="border border-border bg-card p-6">
            <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">RECENT ANALYSIS</h3>
            <div className="space-y-3">
              {data.recentAnalysis.map((analysis, index) => (
                <div key={index} className="pb-3 last:pb-0">
                  <div
                    className="cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => setExpandedAnalysis(expandedAnalysis === index ? null : index)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-mono text-sm font-bold">{analysis.title}</div>
                        <div className="font-mono text-xs text-muted-foreground mt-1">
                          {formatDate(analysis.week_start)} • {analysis.analysis_type}
                        </div>
                      </div>
                      <div className="text-accent text-xs font-mono">
                        {expandedAnalysis === index ? '▼' : '▶'}
                      </div>
                    </div>
                    <div className={`font-mono text-xs text-muted-foreground mt-2 ${expandedAnalysis === index ? '' : 'line-clamp-2'}`}>
                      {analysis.summary}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Significant News */}
          <div className="border border-border bg-card p-6">
            <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">SIGNIFICANT NEWS</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {data.significantNews.map((news, index) => (
                <div key={index} className="pb-3 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-accent">{news.symbol}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatDate(news.published_at)}
                        </span>
                      </div>
                      <div className="font-mono text-sm mt-1">{news.headline}</div>
                      {news.summary && (
                        <div className="font-mono text-xs text-muted-foreground mt-1 line-clamp-2">
                          {news.summary}
                        </div>
                      )}
                    </div>
                    <a
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:opacity-70"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
