import { logger } from '../utils/logger';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import { EventEmitter } from 'events';
import { AlpacaTradingService } from './alpacaTrading';
import { getEconomicCalendarService, EconomicEvent } from './economicCalendarService';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface VIXData {
  timestamp: Date;
  vixOpen: number;
  vixHigh: number;
  vixLow: number;
  vixClose: number;
  vix3mClose?: number;
  vix6mClose?: number;
  spyClose?: number;
  spyChangePct?: number;
}

export interface VIXSignal {
  id?: string;
  signalId: string;
  signalTime: Date;
  vixLevel: number;
  vixChangePct?: number;
  vixTermStructure?: 'contango' | 'backwardation' | 'flat';
  vixPercentile30d?: number;
  vixPercentile90d?: number;
  spyLevel?: number;
  spyChangePct?: number;
  spyRsi14?: number;
  signalType: SignalType;
  signalStrength: number; // 1-10
  confidencePct: number;
  recommendation: Recommendation;
  suggestedSymbol?: string;
  suggestedExpiration?: Date;
  suggestedStrike?: number;
  positionSizePct?: number;
  stopLossPct?: number;
  targetPct?: number;
  maxDaysToHold?: number;
  relatedEventId?: number;
  analysisReasoning?: string;
  riskFactors?: string[];
  status: 'active' | 'expired' | 'executed' | 'invalidated';
  expiresAt?: Date;
  notificationSent: boolean;
}

export type SignalType =
  | 'oversold'
  | 'overbought'
  | 'spike'
  | 'term_structure'
  | 'mean_reversion'
  | 'divergence'
  | 'event_based';

export type Recommendation =
  | 'BUY_VIX_CALLS'
  | 'BUY_VIX_PUTS'
  | 'BUY_SPY_PUTS'
  | 'BUY_SPY_CALLS'
  | 'SELL_VIX_CALLS'
  | 'SELL_VIX_PUTS'
  | 'CALENDAR_SPREAD'
  | 'HEDGE_PORTFOLIO'
  | 'NO_ACTION';

export interface VIXPosition {
  id?: string;
  positionId: string;
  signalId?: string;
  symbol: string;
  contractType: 'stock' | 'call' | 'put';
  strikePrice?: number;
  expirationDate?: Date;
  entryPrice: number;
  entryTime: Date;
  quantity: number;
  side: 'long' | 'short';
  costBasis: number;
  exitPrice?: number;
  exitTime?: Date;
  exitReason?: string;
  realizedPnl?: number;
  realizedPnlPct?: number;
  vixAtEntry: number;
  spyAtEntry?: number;
  strategyType: string;
  status: 'open' | 'closed' | 'expired';
  notes?: string;
}

export interface VIXAnalysis {
  currentVix: number;
  vixChange1d: number;
  vixChange5d: number;
  vixPercentile30d: number;
  vixPercentile90d: number;
  termStructure: 'contango' | 'backwardation' | 'flat';
  termStructureRatio: number;
  regime: 'low_vol' | 'normal' | 'elevated' | 'high_vol' | 'extreme';
  spyLevel: number;
  spyRsi: number;
  upcomingEvents: EconomicEvent[];
  signals: VIXSignal[];
}

export interface VIXBotConfig {
  enabled: boolean;
  autoTrade: boolean;
  maxPositionSizePct: number;
  maxOpenPositions: number;
  preferredSymbols: string[];
  targetExpirationDays: number;
  stopLossDefault: number;
  takeProfitDefault: number;
}

// VIX-related trading symbols
const VIX_SYMBOLS = {
  VIX_DIRECT: ['^VIX'],          // VIX index itself (not directly tradeable)
  VIX_LONG: ['UVXY', 'VXX'],     // Long volatility ETPs
  VIX_SHORT: ['SVXY'],           // Short volatility ETPs
  SPY_OPTIONS: ['SPY', 'SPX'],   // For hedging
};

const DEFAULT_CONFIG: VIXBotConfig = {
  enabled: true,
  autoTrade: false, // Manual execution by default
  maxPositionSizePct: 5,
  maxOpenPositions: 3,
  preferredSymbols: ['UVXY', 'VXX', 'SPY'],
  targetExpirationDays: 14,
  stopLossDefault: 25,
  takeProfitDefault: 50,
};

// ============================================================================
// VIXTradingBot
// ============================================================================

export class VIXTradingBot extends EventEmitter {
  private supabase: SupabaseClient;
  private alpaca?: AlpacaTradingService;
  private discordClient?: Client;
  private config: VIXBotConfig;
  private analysisInterval?: NodeJS.Timeout;
  private vixHistory: VIXData[] = [];

  constructor(config: Partial<VIXBotConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    logger.info('📊 VIXTradingBot initialized');
  }

  /**
   * Set Alpaca service for trading
   */
  setAlpacaService(alpaca: AlpacaTradingService): void {
    this.alpaca = alpaca;
  }

  /**
   * Set Discord client for notifications
   */
  setDiscordClient(client: Client): void {
    this.discordClient = client;
  }

  /**
   * Start automatic VIX analysis
   */
  startAutoAnalysis(intervalMinutes: number = 30): void {
    // Initial analysis
    this.runAnalysis().catch(err =>
      logger.error('Initial VIX analysis failed:', err)
    );

    // Schedule recurring analysis
    this.analysisInterval = setInterval(
      () => this.runAnalysis().catch(err =>
        logger.error('Scheduled VIX analysis failed:', err)
      ),
      intervalMinutes * 60 * 1000
    );

    logger.info(`📊 VIX auto-analysis started (every ${intervalMinutes} minutes)`);
  }

  /**
   * Stop auto analysis
   */
  stopAutoAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }
  }

  /**
   * Run full VIX analysis and generate signals
   */
  async runAnalysis(): Promise<VIXAnalysis> {
    logger.info('📊 Running VIX analysis...');

    try {
      // Fetch current VIX data
      const vixData = await this.fetchVIXData();
      if (!vixData) {
        throw new Error('Failed to fetch VIX data');
      }

      // Store in history
      await this.storeVIXHistory(vixData);

      // Load historical data for percentile calculations
      const history = await this.loadVIXHistory(90);

      // Calculate metrics
      const percentile30d = this.calculatePercentile(vixData.vixClose, history.slice(-30));
      const percentile90d = this.calculatePercentile(vixData.vixClose, history);
      const termStructure = this.analyzeTermStructure(vixData);
      const regime = this.determineVolatilityRegime(vixData.vixClose, percentile90d);

      // Calculate RSI for SPY
      const spyRsi = await this.calculateSpyRsi();

      // Get upcoming high-impact events
      const calendarService = getEconomicCalendarService();
      const upcomingEvents = await calendarService.getHighImpactEvents(7);

      // Generate signals based on analysis
      const signals = await this.generateSignals({
        vixData,
        percentile30d,
        percentile90d,
        termStructure,
        regime,
        spyRsi,
        upcomingEvents,
      });

      // Save active signals
      for (const signal of signals) {
        await this.saveSignal(signal);
        if (!signal.notificationSent) {
          await this.sendSignalNotification(signal);
        }
      }

      const analysis: VIXAnalysis = {
        currentVix: vixData.vixClose,
        vixChange1d: vixData.vixClose - (history[history.length - 2]?.vixClose || vixData.vixClose),
        vixChange5d: vixData.vixClose - (history[history.length - 6]?.vixClose || vixData.vixClose),
        vixPercentile30d: percentile30d,
        vixPercentile90d: percentile90d,
        termStructure: termStructure.structure,
        termStructureRatio: termStructure.ratio,
        regime,
        spyLevel: vixData.spyClose || 0,
        spyRsi: spyRsi,
        upcomingEvents,
        signals,
      };

      this.emit('analysis:complete', analysis);
      logger.info(`📊 VIX Analysis: ${vixData.vixClose.toFixed(2)} (${regime}), ${signals.length} signals generated`);

      return analysis;
    } catch (error) {
      logger.error('VIX analysis failed:', error);
      this.emit('analysis:error', error);
      throw error;
    }
  }

  /**
   * Fetch current VIX data from Yahoo Finance
   */
  async fetchVIXData(): Promise<VIXData | null> {
    try {
      // Fetch VIX, VIX3M, and SPY data
      const [vixQuote, vix3mQuote, spyQuote] = await Promise.all([
        this.fetchYahooQuote('^VIX'),
        this.fetchYahooQuote('^VIX3M'),
        this.fetchYahooQuote('SPY'),
      ]);

      if (!vixQuote) return null;

      return {
        timestamp: new Date(),
        vixOpen: vixQuote.open,
        vixHigh: vixQuote.high,
        vixLow: vixQuote.low,
        vixClose: vixQuote.close,
        vix3mClose: vix3mQuote?.close,
        spyClose: spyQuote?.close,
        spyChangePct: spyQuote?.changePercent,
      };
    } catch (error) {
      logger.error('Failed to fetch VIX data:', error);
      return null;
    }
  }

  /**
   * Fetch quote from Yahoo Finance
   */
  private async fetchYahooQuote(symbol: string): Promise<{
    open: number;
    high: number;
    low: number;
    close: number;
    changePercent: number;
  } | null> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`);
      }

      const data = await response.json() as { chart?: { result?: Array<{ meta: any; indicators?: { quote?: Array<any> } }> } };
      const quote = data.chart?.result?.[0];

      if (!quote) return null;

      const meta = quote.meta;
      const indicators = quote.indicators?.quote?.[0];

      return {
        open: indicators?.open?.[0] || meta.previousClose,
        high: indicators?.high?.[0] || meta.regularMarketPrice,
        low: indicators?.low?.[0] || meta.regularMarketPrice,
        close: meta.regularMarketPrice,
        changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
      };
    } catch (error) {
      logger.error(`Failed to fetch quote for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Store VIX data in history
   */
  private async storeVIXHistory(data: VIXData): Promise<void> {
    try {
      const termRatio = data.vix3mClose
        ? data.vixClose / data.vix3mClose
        : null;

      await this.supabase.from('vix_history').upsert({
        timestamp: data.timestamp.toISOString(),
        vix_open: data.vixOpen,
        vix_high: data.vixHigh,
        vix_low: data.vixLow,
        vix_close: data.vixClose,
        vix3m_close: data.vix3mClose,
        spy_close: data.spyClose,
        spy_change_pct: data.spyChangePct,
        term_structure_ratio: termRatio,
      }, { onConflict: 'timestamp' });
    } catch (error) {
      logger.error('Failed to store VIX history:', error);
    }
  }

  /**
   * Load VIX history from database
   */
  private async loadVIXHistory(days: number): Promise<VIXData[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('vix_history')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        timestamp: new Date(row.timestamp),
        vixOpen: parseFloat(row.vix_open),
        vixHigh: parseFloat(row.vix_high),
        vixLow: parseFloat(row.vix_low),
        vixClose: parseFloat(row.vix_close),
        vix3mClose: row.vix3m_close ? parseFloat(row.vix3m_close) : undefined,
        spyClose: row.spy_close ? parseFloat(row.spy_close) : undefined,
        spyChangePct: row.spy_change_pct ? parseFloat(row.spy_change_pct) : undefined,
      }));
    } catch (error) {
      logger.error('Failed to load VIX history:', error);
      return this.vixHistory;
    }
  }

  /**
   * Calculate percentile of current VIX level
   */
  private calculatePercentile(current: number, history: VIXData[]): number {
    if (history.length === 0) return 50;

    const values = history.map(h => h.vixClose).sort((a, b) => a - b);
    const below = values.filter(v => v < current).length;
    return (below / values.length) * 100;
  }

  /**
   * Analyze VIX term structure
   */
  private analyzeTermStructure(data: VIXData): { structure: 'contango' | 'backwardation' | 'flat'; ratio: number } {
    if (!data.vix3mClose) {
      return { structure: 'flat', ratio: 1 };
    }

    const ratio = data.vixClose / data.vix3mClose;

    if (ratio < 0.95) {
      return { structure: 'contango', ratio }; // VIX < VIX3M (normal market)
    } else if (ratio > 1.05) {
      return { structure: 'backwardation', ratio }; // VIX > VIX3M (fearful market)
    }

    return { structure: 'flat', ratio };
  }

  /**
   * Determine volatility regime
   */
  private determineVolatilityRegime(vix: number, percentile: number): 'low_vol' | 'normal' | 'elevated' | 'high_vol' | 'extreme' {
    if (vix < 13 || percentile < 10) return 'low_vol';
    if (vix < 18 || percentile < 40) return 'normal';
    if (vix < 25 || percentile < 70) return 'elevated';
    if (vix < 35 || percentile < 90) return 'high_vol';
    return 'extreme';
  }

  /**
   * Calculate SPY RSI (14-day)
   */
  private async calculateSpyRsi(): Promise<number> {
    try {
      if (!this.alpaca) return 50;

      const spyBars = await this.alpaca.getBars('SPY', {
        timeframe: '1Day',
        limit: 15,
      });

      if (!spyBars || spyBars.length < 15) return 50;

      // Calculate RSI
      let gains = 0;
      let losses = 0;

      for (let i = 1; i < spyBars.length; i++) {
        const change = spyBars[i].close - spyBars[i - 1].close;
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }

      const avgGain = gains / 14;
      const avgLoss = losses / 14;

      if (avgLoss === 0) return 100;

      const rs = avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    } catch (error) {
      logger.error('Failed to calculate SPY RSI:', error);
      return 50;
    }
  }

  /**
   * Generate trading signals based on analysis
   */
  private async generateSignals(params: {
    vixData: VIXData;
    percentile30d: number;
    percentile90d: number;
    termStructure: { structure: 'contango' | 'backwardation' | 'flat'; ratio: number };
    regime: string;
    spyRsi: number;
    upcomingEvents: EconomicEvent[];
  }): Promise<VIXSignal[]> {
    const signals: VIXSignal[] = [];
    const { vixData, percentile30d, percentile90d, termStructure, regime, spyRsi, upcomingEvents } = params;

    // Check for existing active signals to avoid duplicates
    const activeSignals = await this.getActiveSignals();
    const activeTypes = new Set(activeSignals.map(s => s.signalType));

    // Signal 1: VIX Oversold (complacent market)
    if (vixData.vixClose < 15 && percentile90d < 20 && !activeTypes.has('oversold')) {
      signals.push(this.createSignal({
        vixData,
        percentile30d,
        percentile90d,
        termStructure,
        signalType: 'oversold',
        signalStrength: Math.min(10, Math.round(10 - (vixData.vixClose / 15) * 5)),
        recommendation: 'BUY_VIX_CALLS',
        reasoning: `VIX at ${vixData.vixClose.toFixed(2)} is below 15, indicating market complacency. This is in the bottom ${percentile90d.toFixed(0)}% of readings over 90 days. Mean reversion likely.`,
        riskFactors: ['Sustained low volatility possible', 'Time decay on options', 'FOMC could maintain low vol'],
        targetPct: 75,
        stopLossPct: 30,
        maxDays: 21,
      }));
    }

    // Signal 2: VIX Overbought (fearful market)
    if (vixData.vixClose > 30 && percentile90d > 80 && !activeTypes.has('overbought')) {
      signals.push(this.createSignal({
        vixData,
        percentile30d,
        percentile90d,
        termStructure,
        signalType: 'overbought',
        signalStrength: Math.min(10, Math.round((vixData.vixClose - 30) / 5 + 5)),
        recommendation: 'BUY_VIX_PUTS',
        reasoning: `VIX at ${vixData.vixClose.toFixed(2)} is above 30, indicating extreme fear. This is in the top ${(100 - percentile90d).toFixed(0)}% of readings. Mean reversion to ~20 likely.`,
        riskFactors: ['Crisis could escalate', 'VIX could spike further', 'Put premiums elevated'],
        targetPct: 50,
        stopLossPct: 40,
        maxDays: 14,
      }));
    }

    // Signal 3: VIX Spike (rapid move)
    const prevClose = this.vixHistory[this.vixHistory.length - 1]?.vixClose || vixData.vixOpen;
    const dailyChange = ((vixData.vixClose - prevClose) / prevClose) * 100;

    if (dailyChange > 20 && !activeTypes.has('spike')) {
      signals.push(this.createSignal({
        vixData,
        percentile30d,
        percentile90d,
        termStructure,
        signalType: 'spike',
        signalStrength: Math.min(10, Math.round(dailyChange / 5)),
        recommendation: 'BUY_SPY_CALLS',
        reasoning: `VIX spiked ${dailyChange.toFixed(1)}% today. Large VIX spikes typically mean-revert within 1-5 days. Consider buying SPY calls for the bounce.`,
        riskFactors: ['Spike could continue', 'News-driven volatility', 'Weekend risk'],
        targetPct: 30,
        stopLossPct: 20,
        maxDays: 7,
      }));
    }

    // Signal 4: Term Structure Extreme
    if (termStructure.ratio < 0.85 && termStructure.structure === 'contango' && !activeTypes.has('term_structure')) {
      signals.push(this.createSignal({
        vixData,
        percentile30d,
        percentile90d,
        termStructure,
        signalType: 'term_structure',
        signalStrength: 6,
        recommendation: 'CALENDAR_SPREAD',
        reasoning: `VIX term structure shows extreme contango (ratio: ${termStructure.ratio.toFixed(2)}). Consider calendar spread to capture roll yield.`,
        riskFactors: ['Sudden volatility spike', 'Contango can persist', 'Execution costs'],
        targetPct: 25,
        stopLossPct: 15,
        maxDays: 30,
      }));
    } else if (termStructure.ratio > 1.15 && termStructure.structure === 'backwardation' && !activeTypes.has('term_structure')) {
      signals.push(this.createSignal({
        vixData,
        percentile30d,
        percentile90d,
        termStructure,
        signalType: 'term_structure',
        signalStrength: 7,
        recommendation: 'BUY_SPY_PUTS',
        reasoning: `VIX in backwardation (ratio: ${termStructure.ratio.toFixed(2)}) signals elevated near-term fear. Consider hedging.`,
        riskFactors: ['Market could stabilize', 'Put premiums elevated', 'Timing risk'],
        targetPct: 30,
        stopLossPct: 25,
        maxDays: 14,
      }));
    }

    // Signal 5: SPY/VIX Divergence
    if (vixData.spyChangePct && vixData.spyChangePct > 1 && dailyChange > 5 && !activeTypes.has('divergence')) {
      signals.push(this.createSignal({
        vixData,
        percentile30d,
        percentile90d,
        termStructure,
        signalType: 'divergence',
        signalStrength: 5,
        recommendation: 'HEDGE_PORTFOLIO',
        reasoning: `SPY up ${vixData.spyChangePct.toFixed(1)}% but VIX also up ${dailyChange.toFixed(1)}%. This divergence often precedes corrections.`,
        riskFactors: ['False signal possible', 'Trend could continue', 'Low conviction'],
        targetPct: 20,
        stopLossPct: 15,
        maxDays: 10,
      }));
    }

    // Signal 6: Event-Based (high impact events coming)
    const highImpactSoon = upcomingEvents.filter(e => {
      const hoursUntil = (e.scheduledTime.getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursUntil > 0 && hoursUntil < 48 && e.impactLevel === 'high';
    });

    if (highImpactSoon.length > 0 && vixData.vixClose < 18 && !activeTypes.has('event_based')) {
      const nextEvent = highImpactSoon[0];
      signals.push(this.createSignal({
        vixData,
        percentile30d,
        percentile90d,
        termStructure,
        signalType: 'event_based',
        signalStrength: 6,
        recommendation: 'BUY_VIX_CALLS',
        reasoning: `${nextEvent.eventName} in ${Math.round((nextEvent.scheduledTime.getTime() - Date.now()) / (1000 * 60 * 60))} hours. VIX at ${vixData.vixClose.toFixed(2)} is low ahead of high-impact event.`,
        riskFactors: ['Event could be non-event', 'Premium decay', 'Already priced in'],
        relatedEventId: parseInt(nextEvent.id || '0'),
        targetPct: 40,
        stopLossPct: 25,
        maxDays: 3,
      }));
    }

    return signals;
  }

  /**
   * Create a signal object
   */
  private createSignal(params: {
    vixData: VIXData;
    percentile30d: number;
    percentile90d: number;
    termStructure: { structure: 'contango' | 'backwardation' | 'flat'; ratio: number };
    signalType: SignalType;
    signalStrength: number;
    recommendation: Recommendation;
    reasoning: string;
    riskFactors: string[];
    targetPct: number;
    stopLossPct: number;
    maxDays: number;
    relatedEventId?: number;
  }): VIXSignal {
    const { vixData, percentile30d, percentile90d, termStructure, signalType, signalStrength, recommendation, reasoning, riskFactors, targetPct, stopLossPct, maxDays, relatedEventId } = params;

    // Determine suggested symbol based on recommendation
    let suggestedSymbol = 'UVXY';
    if (recommendation.includes('SPY')) {
      suggestedSymbol = 'SPY';
    } else if (recommendation.includes('VIX')) {
      suggestedSymbol = recommendation.includes('PUT') ? 'UVXY' : 'UVXY';
    }

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + this.config.targetExpirationDays);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + maxDays);

    return {
      signalId: `vix-${signalType}-${Date.now()}-${uuidv4().slice(0, 8)}`,
      signalTime: new Date(),
      vixLevel: vixData.vixClose,
      vixChangePct: vixData.spyChangePct,
      vixTermStructure: termStructure.structure,
      vixPercentile30d: percentile30d,
      vixPercentile90d: percentile90d,
      spyLevel: vixData.spyClose,
      spyChangePct: vixData.spyChangePct,
      signalType,
      signalStrength,
      confidencePct: signalStrength * 10,
      recommendation,
      suggestedSymbol,
      suggestedExpiration: expirationDate,
      positionSizePct: Math.min(this.config.maxPositionSizePct, signalStrength * 0.5),
      stopLossPct,
      targetPct,
      maxDaysToHold: maxDays,
      relatedEventId,
      analysisReasoning: reasoning,
      riskFactors,
      status: 'active',
      expiresAt,
      notificationSent: false,
    };
  }

  /**
   * Save signal to database
   */
  private async saveSignal(signal: VIXSignal): Promise<void> {
    try {
      await this.supabase.from('vix_signals').upsert({
        signal_id: signal.signalId,
        signal_time: signal.signalTime.toISOString(),
        vix_level: signal.vixLevel,
        vix_change_pct: signal.vixChangePct,
        vix_term_structure: signal.vixTermStructure,
        vix_percentile_30d: signal.vixPercentile30d,
        vix_percentile_90d: signal.vixPercentile90d,
        spy_level: signal.spyLevel,
        spy_change_pct: signal.spyChangePct,
        signal_type: signal.signalType,
        signal_strength: signal.signalStrength,
        confidence_pct: signal.confidencePct,
        recommendation: signal.recommendation,
        suggested_symbol: signal.suggestedSymbol,
        suggested_expiration: signal.suggestedExpiration?.toISOString().split('T')[0],
        position_size_pct: signal.positionSizePct,
        stop_loss_pct: signal.stopLossPct,
        target_pct: signal.targetPct,
        max_days_to_hold: signal.maxDaysToHold,
        related_event_id: signal.relatedEventId,
        analysis_reasoning: signal.analysisReasoning,
        risk_factors: signal.riskFactors,
        status: signal.status,
        expires_at: signal.expiresAt?.toISOString(),
        notification_sent: signal.notificationSent,
      }, { onConflict: 'signal_id' });
    } catch (error) {
      logger.error('Failed to save VIX signal:', error);
    }
  }

  /**
   * Get active signals
   */
  async getActiveSignals(): Promise<VIXSignal[]> {
    try {
      const { data, error } = await this.supabase
        .from('vix_signals')
        .select('*')
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .order('signal_time', { ascending: false });

      if (error) throw error;

      return (data || []).map(this.mapDbToSignal);
    } catch (error) {
      logger.error('Failed to get active signals:', error);
      return [];
    }
  }

  /**
   * Get signal history
   */
  async getSignalHistory(days: number = 30): Promise<VIXSignal[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('vix_signals')
        .select('*')
        .gte('signal_time', startDate.toISOString())
        .order('signal_time', { ascending: false });

      if (error) throw error;

      return (data || []).map(this.mapDbToSignal);
    } catch (error) {
      logger.error('Failed to get signal history:', error);
      return [];
    }
  }

  /**
   * Execute a signal (place trade)
   * NOTE: Full options trading via Alpaca is not yet implemented.
   * For now, this logs the signal for manual execution.
   */
  async executeSignal(signalId: string): Promise<VIXPosition | null> {
    if (!this.alpaca) {
      throw new Error('Alpaca service not configured');
    }

    const signals = await this.getActiveSignals();
    const signal = signals.find(s => s.signalId === signalId);

    if (!signal) {
      throw new Error(`Signal ${signalId} not found or not active`);
    }

    try {
      // For options-based signals, log for manual execution
      // Full options trading via Alpaca Options API is not yet implemented
      if (signal.recommendation.includes('CALL') || signal.recommendation.includes('PUT')) {
        logger.warn(`⚠️ Options execution not yet automated. Signal ${signalId} requires manual execution.`);
        logger.info(`📊 Signal Details:
  - Type: ${signal.signalType}
  - Recommendation: ${signal.recommendation}
  - Symbol: ${signal.suggestedSymbol || 'UVXY'}
  - VIX Level: ${signal.vixLevel}
  - Target: +${signal.targetPct}%
  - Stop Loss: -${signal.stopLossPct}%
  - Reasoning: ${signal.analysisReasoning}`);

        // Mark signal as pending manual execution
        await this.supabase
          .from('vix_signals')
          .update({ status: 'active' }) // Keep active for manual tracking
          .eq('signal_id', signalId);

        // Return a placeholder position for tracking
        const position: VIXPosition = {
          positionId: `pos-${uuidv4().slice(0, 8)}`,
          signalId: signal.signalId,
          symbol: signal.suggestedSymbol || 'UVXY',
          contractType: signal.recommendation.includes('CALL') ? 'call' : 'put',
          entryPrice: 0, // To be filled manually
          entryTime: new Date(),
          quantity: 0, // To be filled manually
          side: signal.recommendation.includes('SELL') ? 'short' : 'long',
          costBasis: 0,
          vixAtEntry: signal.vixLevel,
          spyAtEntry: signal.spyLevel,
          strategyType: signal.signalType,
          status: 'open',
          notes: 'Awaiting manual execution - options trading not yet automated',
        };

        return position;
      }

      // For non-options signals (HEDGE_PORTFOLIO, NO_ACTION, etc.)
      logger.info(`📊 Signal ${signalId} noted: ${signal.recommendation}`);
      return null;
    } catch (error) {
      logger.error(`Failed to process signal ${signalId}:`, error);
      throw error;
    }
  }

  /**
   * Save position to database
   */
  private async savePosition(position: VIXPosition): Promise<void> {
    try {
      await this.supabase.from('vix_positions').upsert({
        position_id: position.positionId,
        signal_id: position.signalId,
        symbol: position.symbol,
        contract_type: position.contractType,
        strike_price: position.strikePrice,
        expiration_date: position.expirationDate?.toISOString().split('T')[0],
        entry_price: position.entryPrice,
        entry_time: position.entryTime.toISOString(),
        quantity: position.quantity,
        side: position.side,
        cost_basis: position.costBasis,
        vix_at_entry: position.vixAtEntry,
        spy_at_entry: position.spyAtEntry,
        strategy_type: position.strategyType,
        status: position.status,
      }, { onConflict: 'position_id' });
    } catch (error) {
      logger.error('Failed to save position:', error);
    }
  }

  /**
   * Get open positions
   */
  async getOpenPositions(): Promise<VIXPosition[]> {
    try {
      const { data, error } = await this.supabase
        .from('vix_positions')
        .select('*')
        .eq('status', 'open')
        .order('entry_time', { ascending: false });

      if (error) throw error;

      return (data || []).map(this.mapDbToPosition);
    } catch (error) {
      logger.error('Failed to get open positions:', error);
      return [];
    }
  }

  /**
   * Send Discord notification for a signal
   */
  private async sendSignalNotification(signal: VIXSignal): Promise<void> {
    if (!this.discordClient) return;

    try {
      const channel = await this.findTradingChannel();
      if (!channel) return;

      const embed = this.createSignalEmbed(signal);
      await channel.send({ embeds: [embed] });

      // Mark as notified
      await this.supabase
        .from('vix_signals')
        .update({ notification_sent: true })
        .eq('signal_id', signal.signalId);

      logger.info(`📢 Sent VIX signal notification: ${signal.signalType}`);
    } catch (error) {
      logger.error('Failed to send signal notification:', error);
    }
  }

  /**
   * Create Discord embed for a signal
   */
  private createSignalEmbed(signal: VIXSignal): EmbedBuilder {
    const strengthColors: { [key: number]: number } = {
      1: Colors.Grey, 2: Colors.Grey, 3: Colors.Grey,
      4: Colors.Yellow, 5: Colors.Yellow, 6: Colors.Yellow,
      7: Colors.Orange, 8: Colors.Orange,
      9: Colors.Red, 10: Colors.Red,
    };

    const typeEmojis: Record<SignalType, string> = {
      oversold: '📉',
      overbought: '📈',
      spike: '⚡',
      term_structure: '📊',
      mean_reversion: '🔄',
      divergence: '↔️',
      event_based: '📅',
    };

    const embed = new EmbedBuilder()
      .setColor(strengthColors[signal.signalStrength] || Colors.Blue)
      .setTitle(`${typeEmojis[signal.signalType]} VIX Signal: ${signal.signalType.toUpperCase().replace('_', ' ')}`)
      .setDescription(signal.analysisReasoning || '')
      .addFields(
        { name: '📊 VIX Level', value: signal.vixLevel.toFixed(2), inline: true },
        { name: '💪 Strength', value: `${signal.signalStrength}/10`, inline: true },
        { name: '🎯 Confidence', value: `${signal.confidencePct.toFixed(0)}%`, inline: true },
        { name: '📈 Recommendation', value: signal.recommendation.replace(/_/g, ' '), inline: true },
        { name: '💰 Symbol', value: signal.suggestedSymbol || 'N/A', inline: true },
        { name: '📅 Max Hold', value: `${signal.maxDaysToHold} days`, inline: true },
      );

    if (signal.targetPct && signal.stopLossPct) {
      embed.addFields(
        { name: '🎯 Target', value: `+${signal.targetPct}%`, inline: true },
        { name: '🛑 Stop Loss', value: `-${signal.stopLossPct}%`, inline: true },
        { name: '📏 Position Size', value: `${signal.positionSizePct?.toFixed(1)}%`, inline: true },
      );
    }

    if (signal.riskFactors && signal.riskFactors.length > 0) {
      embed.addFields({
        name: '⚠️ Risk Factors',
        value: signal.riskFactors.map(r => `• ${r}`).join('\n'),
      });
    }

    embed.setTimestamp(signal.signalTime);
    embed.setFooter({ text: 'VIX Trading Bot | Not financial advice' });

    return embed;
  }

  /**
   * Find trading channel
   */
  private async findTradingChannel(): Promise<TextChannel | null> {
    if (!this.discordClient) return null;

    try {
      const guilds = await this.discordClient.guilds.fetch();

      for (const [guildId] of guilds) {
        const fullGuild = await this.discordClient.guilds.fetch(guildId);
        const channels = await fullGuild.channels.fetch();

        for (const [, channel] of channels) {
          if (channel && (channel.name === 'trading' || channel.name === 'vix-trading') && channel.isTextBased()) {
            return channel as TextChannel;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Error finding trading channel:', error);
      return null;
    }
  }

  /**
   * Map database row to VIXSignal
   */
  private mapDbToSignal(row: any): VIXSignal {
    return {
      id: row.id?.toString(),
      signalId: row.signal_id,
      signalTime: new Date(row.signal_time),
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
      suggestedExpiration: row.suggested_expiration ? new Date(row.suggested_expiration) : undefined,
      suggestedStrike: row.suggested_strike ? parseFloat(row.suggested_strike) : undefined,
      positionSizePct: row.position_size_pct ? parseFloat(row.position_size_pct) : undefined,
      stopLossPct: row.stop_loss_pct ? parseFloat(row.stop_loss_pct) : undefined,
      targetPct: row.target_pct ? parseFloat(row.target_pct) : undefined,
      maxDaysToHold: row.max_days_to_hold,
      relatedEventId: row.related_event_id,
      analysisReasoning: row.analysis_reasoning,
      riskFactors: row.risk_factors,
      status: row.status,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      notificationSent: row.notification_sent,
    };
  }

  /**
   * Map database row to VIXPosition
   */
  private mapDbToPosition(row: any): VIXPosition {
    return {
      id: row.id?.toString(),
      positionId: row.position_id,
      signalId: row.signal_id,
      symbol: row.symbol,
      contractType: row.contract_type,
      strikePrice: row.strike_price ? parseFloat(row.strike_price) : undefined,
      expirationDate: row.expiration_date ? new Date(row.expiration_date) : undefined,
      entryPrice: parseFloat(row.entry_price),
      entryTime: new Date(row.entry_time),
      quantity: row.quantity,
      side: row.side,
      costBasis: parseFloat(row.cost_basis),
      exitPrice: row.exit_price ? parseFloat(row.exit_price) : undefined,
      exitTime: row.exit_time ? new Date(row.exit_time) : undefined,
      exitReason: row.exit_reason,
      realizedPnl: row.realized_pnl ? parseFloat(row.realized_pnl) : undefined,
      realizedPnlPct: row.realized_pnl_pct ? parseFloat(row.realized_pnl_pct) : undefined,
      vixAtEntry: parseFloat(row.vix_at_entry),
      spyAtEntry: row.spy_at_entry ? parseFloat(row.spy_at_entry) : undefined,
      strategyType: row.strategy_type,
      status: row.status,
      notes: row.notes,
    };
  }

  /**
   * Get current VIX summary for dashboard
   */
  async getVIXSummary(): Promise<{
    current: VIXData | null;
    signals: VIXSignal[];
    positions: VIXPosition[];
    regime: string;
    termStructure: string;
  }> {
    const vixData = await this.fetchVIXData();
    const signals = await this.getActiveSignals();
    const positions = await this.getOpenPositions();

    let regime = 'unknown';
    let termStructure = 'unknown';

    if (vixData) {
      const history = await this.loadVIXHistory(90);
      const percentile90d = this.calculatePercentile(vixData.vixClose, history);
      regime = this.determineVolatilityRegime(vixData.vixClose, percentile90d);
      termStructure = this.analyzeTermStructure(vixData).structure;
    }

    return {
      current: vixData,
      signals,
      positions,
      regime,
      termStructure,
    };
  }
}

// Singleton instance
let vixBotInstance: VIXTradingBot | null = null;

export function getVIXTradingBot(): VIXTradingBot {
  if (!vixBotInstance) {
    vixBotInstance = new VIXTradingBot();
  }
  return vixBotInstance;
}

export function initializeVIXTradingBot(config?: Partial<VIXBotConfig>): VIXTradingBot {
  vixBotInstance = new VIXTradingBot(config);
  return vixBotInstance;
}
