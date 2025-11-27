import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { TickerMonitor, TickerData, THESIS_PORTFOLIO } from './tickerMonitor';
import { NewsMonitor } from './newsMonitor';
import { PerplexityMarketService } from './perplexityMarketService';
import {
  AlpacaTradingService,
  getAlpacaService,
  initializeAlpacaService,
  Position,
  Order,
  AccountInfo,
  OptionContract
} from './alpacaTrading';
import { Client, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import { getTradeNotifier, TradeNotifier } from './tradeNotifier';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MarketIntelligence {
  timestamp: Date;
  marketStatus: {
    isOpen: boolean;
    nextOpen?: Date;
    nextClose?: Date;
  };
  portfolioData: {
    categories: Array<{
      name: string;
      allocation: string;
      tickers: TickerData[];
      avgPerformance: number;
    }>;
    topGainers: TickerData[];
    topLosers: TickerData[];
    overallSentiment: 'bullish' | 'bearish' | 'neutral';
  };
  newsAnalysis: {
    significantNews: Array<{
      symbol: string;
      headline: string;
      sentiment: 'bullish' | 'bearish' | 'neutral';
      impact: 'high' | 'medium' | 'low';
      summary: string;
    }>;
    overallNewsSentiment: 'bullish' | 'bearish' | 'neutral';
  };
  accountStatus: {
    cash: number;
    portfolioValue: number;
    buyingPower: number;
    positions: Position[];
    openOrders: Order[];
  };
}

export interface TradingRecommendation {
  action: 'BUY' | 'SELL' | 'HOLD' | 'OPTION_BUY' | 'OPTION_SELL';
  symbol: string;
  quantity?: number;
  notional?: number; // Dollar amount
  orderType: 'market' | 'limit';
  limitPrice?: number;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  priority: number; // 1-10, higher = more urgent
  riskLevel: 'low' | 'medium' | 'high';
  // For options
  optionType?: 'call' | 'put';
  strikePrice?: number;
  expirationDate?: string;
  optionStrategy?: string;
}

export interface DailyTradingPlan {
  date: Date;
  marketConditions: string;
  thesisAlignment: string;
  recommendations: TradingRecommendation[];
  holdReasons: string[];
  riskAssessment: string;
  portfolioAdjustments: string;
  optionsOpportunities: string[];
  summary: string;
}

export interface TradeExecution {
  recommendation: TradingRecommendation;
  executed: boolean;
  orderId?: string;
  executionPrice?: number;
  executionTime?: Date;
  error?: string;
}

// ============================================================================
// Trading Agent Service
// ============================================================================

export class TradingAgent {
  private anthropic: Anthropic;
  private tickerMonitor: TickerMonitor;
  private newsMonitor: NewsMonitor;
  private perplexity: PerplexityMarketService;
  private alpaca: AlpacaTradingService | null = null;
  private discordClient?: Client;
  private tradingChannelId?: string;

  // Configuration
  private maxPositionSize = 0.15; // Max 15% of portfolio in single position
  private maxDailyTrades = 5; // Limit trades per day
  private minCashReserve = 0.10; // Keep 10% cash minimum
  private autoExecute = false; // Default to recommendation-only mode

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.tickerMonitor = new TickerMonitor();
    this.newsMonitor = new NewsMonitor(process.env.FINNHUB_API_KEY || '');
    this.perplexity = new PerplexityMarketService(process.env.PERPLEXITY_API_KEY || '');

    // Initialize Alpaca
    const alpacaKey = process.env.ALPACA_API_KEY;
    const alpacaSecret = process.env.ALPACA_SECRET_KEY;
    if (alpacaKey && alpacaSecret) {
      this.alpaca = getAlpacaService() || initializeAlpacaService({
        apiKey: alpacaKey,
        secretKey: alpacaSecret,
        paper: process.env.ALPACA_PAPER !== 'false'
      });
    }

    logger.info('🤖 TradingAgent initialized');
  }

  setDiscordClient(client: Client, channelId?: string): void {
    this.discordClient = client;
    this.tradingChannelId = channelId;
  }

  setAutoExecute(enabled: boolean): void {
    this.autoExecute = enabled;
    logger.info(`🤖 Trading auto-execute: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  // ==========================================================================
  // Data Gathering
  // ==========================================================================

  async gatherMarketIntelligence(): Promise<MarketIntelligence> {
    logger.info('📊 Gathering market intelligence...');

    if (!this.alpaca) {
      throw new Error('Alpaca trading service not configured');
    }

    // Gather all data in parallel
    const [
      marketClock,
      portfolioData,
      account,
      positions,
      openOrders
    ] = await Promise.all([
      this.alpaca.getClock(),
      this.tickerMonitor.fetchThesisPortfolio(),
      this.alpaca.getAccount(),
      this.alpaca.getPositions(),
      this.alpaca.getOrders({ status: 'open' })
    ]);

    // Flatten the Map<string, Map<string, TickerData>> to an array
    const allTickers: TickerData[] = [];
    for (const [categoryName, tickerMap] of portfolioData) {
      for (const [symbol, tickerData] of tickerMap) {
        allTickers.push(tickerData);
      }
    }

    // Process portfolio data by category
    const categories = THESIS_PORTFOLIO.map(category => {
      const categoryTickerMap = portfolioData.get(category.name);
      const categoryTickers: TickerData[] = categoryTickerMap
        ? Array.from(categoryTickerMap.values())
        : [];

      const avgPerformance = categoryTickers.length > 0
        ? categoryTickers.reduce((sum, t) => sum + t.changePercent, 0) / categoryTickers.length
        : 0;

      return {
        name: category.name,
        allocation: category.allocation || '0%',
        tickers: categoryTickers,
        avgPerformance
      };
    });

    // Top gainers/losers from all tickers
    const sortedByChange = [...allTickers].sort((a, b) => b.changePercent - a.changePercent);
    const topGainers = sortedByChange.slice(0, 5);
    const topLosers = sortedByChange.slice(-5).reverse();

    // Overall sentiment based on gainers vs losers
    const gainers = allTickers.filter(t => t.changePercent > 0).length;
    const losers = allTickers.filter(t => t.changePercent < 0).length;
    const overallSentiment = gainers > losers * 1.5 ? 'bullish'
      : losers > gainers * 1.5 ? 'bearish' : 'neutral';

    // Gather recent significant news
    const recentNews = await this.gatherRecentNews(allTickers.map(t => t.symbol));

    return {
      timestamp: new Date(),
      marketStatus: {
        isOpen: marketClock.isOpen,
        nextOpen: marketClock.nextOpen,
        nextClose: marketClock.nextClose
      },
      portfolioData: {
        categories,
        topGainers,
        topLosers,
        overallSentiment
      },
      newsAnalysis: recentNews,
      accountStatus: {
        cash: account.cash,
        portfolioValue: account.portfolioValue,
        buyingPower: account.buyingPower,
        positions,
        openOrders
      }
    };
  }

  private async gatherRecentNews(symbols: string[]): Promise<MarketIntelligence['newsAnalysis']> {
    const significantNews: MarketIntelligence['newsAnalysis']['significantNews'] = [];

    // Get news for top movers only to avoid rate limits
    const symbolsToCheck = symbols.slice(0, 10);

    for (const symbol of symbolsToCheck) {
      try {
        const news = await this.newsMonitor.fetchCompanyNews(
          symbol,
          new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          new Date()
        );

        for (const article of news.slice(0, 3)) {
          if (this.newsMonitor.isSignificantNews(article)) {
            // Use Perplexity to analyze sentiment
            let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
            let impact: 'high' | 'medium' | 'low' = 'medium';

            try {
              const analysis = await this.perplexity.analyzeNewsArticle({
                headline: article.headline,
                summary: article.summary || '',
                symbol,
                source: article.source,
                url: article.url
              });

              if (analysis.toLowerCase().includes('bullish') ||
                  analysis.toLowerCase().includes('positive')) {
                sentiment = 'bullish';
              } else if (analysis.toLowerCase().includes('bearish') ||
                         analysis.toLowerCase().includes('negative')) {
                sentiment = 'bearish';
              }

              if (analysis.toLowerCase().includes('significant') ||
                  analysis.toLowerCase().includes('major')) {
                impact = 'high';
              }
            } catch (e) {
              // Continue without AI analysis
            }

            significantNews.push({
              symbol,
              headline: article.headline,
              sentiment,
              impact,
              summary: article.summary || ''
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to fetch news for ${symbol}:`, error);
      }
    }

    // Determine overall news sentiment
    const bullishNews = significantNews.filter(n => n.sentiment === 'bullish').length;
    const bearishNews = significantNews.filter(n => n.sentiment === 'bearish').length;
    const overallNewsSentiment = bullishNews > bearishNews ? 'bullish'
      : bearishNews > bullishNews ? 'bearish' : 'neutral';

    return {
      significantNews,
      overallNewsSentiment
    };
  }

  // ==========================================================================
  // AI Analysis & Recommendations
  // ==========================================================================

  async generateDailyTradingPlan(intelligence: MarketIntelligence): Promise<DailyTradingPlan> {
    logger.info('🧠 Generating daily trading plan with Claude...');

    const currentPositionsStr = intelligence.accountStatus.positions.length > 0
      ? intelligence.accountStatus.positions.map(p =>
          `  - ${p.symbol}: ${p.qty} shares @ $${p.avgEntryPrice.toFixed(2)} (P/L: ${p.unrealizedPLPercent >= 0 ? '+' : ''}${p.unrealizedPLPercent.toFixed(2)}%)`
        ).join('\n')
      : '  No current positions';

    const topMoversStr = [
      'Top Gainers:',
      ...intelligence.portfolioData.topGainers.map(t =>
        `  ${t.symbol}: +${t.changePercent.toFixed(2)}% @ $${t.price.toFixed(2)}`
      ),
      'Top Losers:',
      ...intelligence.portfolioData.topLosers.map(t =>
        `  ${t.symbol}: ${t.changePercent.toFixed(2)}% @ $${t.price.toFixed(2)}`
      )
    ].join('\n');

    const newsStr = intelligence.newsAnalysis.significantNews.length > 0
      ? intelligence.newsAnalysis.significantNews.map(n =>
          `  - [${n.sentiment.toUpperCase()}] ${n.symbol}: ${n.headline}`
        ).join('\n')
      : '  No significant news today';

    const categoryPerformance = intelligence.portfolioData.categories.map(c =>
      `  ${c.name} (${c.allocation}): ${c.avgPerformance >= 0 ? '+' : ''}${c.avgPerformance.toFixed(2)}%`
    ).join('\n');

    const prompt = `You are an intelligent trading agent managing a paper trading account focused on the "AI Manhattan Project" investment thesis. Your thesis centers on energy infrastructure for AI (nuclear, uranium, grid infrastructure, data centers) with a US vs China competition lens.

## CURRENT ACCOUNT STATUS
- Cash: $${intelligence.accountStatus.cash.toLocaleString()}
- Portfolio Value: $${intelligence.accountStatus.portfolioValue.toLocaleString()}
- Buying Power: $${intelligence.accountStatus.buyingPower.toLocaleString()}

## CURRENT POSITIONS
${currentPositionsStr}

## THESIS PORTFOLIO PERFORMANCE
${categoryPerformance}

## TODAY'S MARKET MOVERS
${topMoversStr}

## SIGNIFICANT NEWS (Last 24h)
${newsStr}

## MARKET STATUS
- Market is currently: ${intelligence.marketStatus.isOpen ? 'OPEN' : 'CLOSED'}
- Overall Market Sentiment: ${intelligence.portfolioData.overallSentiment}
- News Sentiment: ${intelligence.newsAnalysis.overallNewsSentiment}

## TARGET ALLOCATIONS
${THESIS_PORTFOLIO.map(c => `- ${c.name}: ${c.allocation}`).join('\n')}

## TRADING RULES
1. Maximum position size: 15% of portfolio
2. Keep minimum 10% cash reserve
3. Maximum 5 trades per day
4. Consider options for leveraged exposure or hedging
5. Don't chase - if holding makes sense, recommend HOLD
6. Focus on thesis alignment - prefer positions that align with the AI energy thesis

## YOUR TASK
Analyze the current market conditions and generate a trading plan. You may recommend:
- BUY: Open new positions or add to existing
- SELL: Close or reduce positions
- HOLD: Maintain current positions (with reasoning)
- OPTION_BUY: Buy calls or puts for specific opportunities
- OPTION_SELL: Sell covered calls or cash-secured puts

Return your analysis as a JSON object with this structure:
{
  "marketConditions": "Brief assessment of current market conditions",
  "thesisAlignment": "How current conditions align with AI energy thesis",
  "recommendations": [
    {
      "action": "BUY|SELL|HOLD|OPTION_BUY|OPTION_SELL",
      "symbol": "TICKER",
      "quantity": 10,
      "orderType": "market|limit",
      "limitPrice": 150.00,
      "reasoning": "Why this trade",
      "confidence": "high|medium|low",
      "priority": 8,
      "riskLevel": "low|medium|high",
      "optionType": "call|put",
      "strikePrice": 160.00,
      "expirationDate": "2024-02-16",
      "optionStrategy": "Long call for earnings play"
    }
  ],
  "holdReasons": ["Reason 1 for not trading more actively"],
  "riskAssessment": "Current portfolio risk assessment",
  "portfolioAdjustments": "Suggested rebalancing",
  "optionsOpportunities": ["Options opportunity 1", "Options opportunity 2"],
  "summary": "One paragraph executive summary of the trading plan"
}

Be conservative - it's better to hold cash than make poor trades. Only recommend trades you have conviction in.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const plan = JSON.parse(jsonMatch[0]);

      return {
        date: new Date(),
        marketConditions: plan.marketConditions || '',
        thesisAlignment: plan.thesisAlignment || '',
        recommendations: plan.recommendations || [],
        holdReasons: plan.holdReasons || [],
        riskAssessment: plan.riskAssessment || '',
        portfolioAdjustments: plan.portfolioAdjustments || '',
        optionsOpportunities: plan.optionsOpportunities || [],
        summary: plan.summary || ''
      };
    } catch (error) {
      logger.error('Error generating trading plan:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Trade Execution
  // ==========================================================================

  async executeRecommendations(
    plan: DailyTradingPlan,
    options: { dryRun?: boolean; maxTrades?: number } = {}
  ): Promise<TradeExecution[]> {
    const { dryRun = !this.autoExecute, maxTrades = this.maxDailyTrades } = options;

    if (!this.alpaca) {
      throw new Error('Alpaca trading service not configured');
    }

    const executions: TradeExecution[] = [];

    // Sort by priority
    const sortedRecs = [...plan.recommendations]
      .filter(r => r.action !== 'HOLD')
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxTrades);

    for (const rec of sortedRecs) {
      const execution: TradeExecution = {
        recommendation: rec,
        executed: false
      };

      if (dryRun) {
        logger.info(`🧪 [DRY RUN] Would execute: ${rec.action} ${rec.quantity || rec.notional} ${rec.symbol}`);
        execution.executed = false;
        executions.push(execution);
        continue;
      }

      try {
        let order: Order;

        if (rec.action === 'BUY') {
          if (rec.quantity) {
            order = rec.orderType === 'limit' && rec.limitPrice
              ? await this.alpaca.limitBuy(rec.symbol, rec.quantity, rec.limitPrice)
              : await this.alpaca.marketBuy(rec.symbol, rec.quantity);
          } else if (rec.notional) {
            order = await this.alpaca.buyDollarAmount(rec.symbol, rec.notional);
          } else {
            throw new Error('No quantity or notional specified');
          }
        } else if (rec.action === 'SELL') {
          if (rec.quantity) {
            order = rec.orderType === 'limit' && rec.limitPrice
              ? await this.alpaca.limitSell(rec.symbol, rec.quantity, rec.limitPrice)
              : await this.alpaca.marketSell(rec.symbol, rec.quantity);
          } else {
            // Sell entire position
            order = await this.alpaca.closePosition(rec.symbol);
          }
        } else if (rec.action === 'OPTION_BUY' && rec.optionType && rec.strikePrice && rec.expirationDate) {
          // Get option contract
          const contracts = await this.alpaca.getOptionContracts({
            underlyingSymbol: rec.symbol,
            expirationDate: rec.expirationDate,
            type: rec.optionType,
            strikePrice: rec.strikePrice,
            limit: 1
          });

          if (contracts.length === 0) {
            throw new Error(`No option contract found for ${rec.symbol} ${rec.optionType} ${rec.strikePrice} ${rec.expirationDate}`);
          }

          order = await this.alpaca.createOptionOrder({
            symbol: contracts[0].symbol,
            qty: rec.quantity || 1,
            side: 'buy',
            type: rec.orderType === 'limit' ? 'limit' : 'market',
            timeInForce: 'day',
            limitPrice: rec.limitPrice
          });
        } else {
          logger.warn(`Skipping unsupported action: ${rec.action}`);
          continue;
        }

        execution.executed = true;
        execution.orderId = order.id;
        execution.executionTime = new Date();

        logger.info(`✅ Executed: ${rec.action} ${rec.symbol} - Order ID: ${order.id}`);

        // Send trade notification to Discord
        const tradeNotifier = getTradeNotifier();
        if (tradeNotifier) {
          await tradeNotifier.notifyTrade(order, 'new');
        }
      } catch (error: any) {
        execution.error = error.message;
        logger.error(`❌ Failed to execute ${rec.action} ${rec.symbol}:`, error);
      }

      executions.push(execution);
    }

    return executions;
  }

  // ==========================================================================
  // Discord Notifications
  // ==========================================================================

  async notifyTradingPlan(plan: DailyTradingPlan): Promise<void> {
    if (!this.discordClient || !this.tradingChannelId) {
      logger.warn('Discord client or trading channel not configured');
      return;
    }

    try {
      const channel = await this.discordClient.channels.fetch(this.tradingChannelId);
      if (!channel || !channel.isTextBased()) {
        logger.warn('Trading channel not found or not text-based');
        return;
      }

      const textChannel = channel as TextChannel;

      // Main summary embed
      const summaryEmbed = new EmbedBuilder()
        .setTitle('🤖 Daily Trading Plan')
        .setColor(Colors.Blue)
        .setDescription(plan.summary)
        .addFields(
          { name: '📊 Market Conditions', value: plan.marketConditions || 'N/A', inline: false },
          { name: '🎯 Thesis Alignment', value: plan.thesisAlignment || 'N/A', inline: false },
          { name: '⚠️ Risk Assessment', value: plan.riskAssessment || 'N/A', inline: false }
        )
        .setTimestamp();

      await textChannel.send({ embeds: [summaryEmbed] });

      // Recommendations embed
      if (plan.recommendations.length > 0) {
        const recsEmbed = new EmbedBuilder()
          .setTitle('📋 Trading Recommendations')
          .setColor(Colors.Green);

        for (const rec of plan.recommendations.slice(0, 10)) {
          const emoji = rec.action === 'BUY' ? '🟢'
            : rec.action === 'SELL' ? '🔴'
            : rec.action.includes('OPTION') ? '📊' : '⏸️';

          const value = [
            `**Action:** ${rec.action}`,
            rec.quantity ? `**Qty:** ${rec.quantity}` : '',
            rec.notional ? `**Amount:** $${rec.notional}` : '',
            rec.limitPrice ? `**Limit:** $${rec.limitPrice}` : '',
            `**Confidence:** ${rec.confidence}`,
            `**Risk:** ${rec.riskLevel}`,
            rec.optionStrategy ? `**Strategy:** ${rec.optionStrategy}` : '',
            `**Reasoning:** ${rec.reasoning.substring(0, 200)}...`
          ].filter(Boolean).join('\n');

          recsEmbed.addFields({
            name: `${emoji} ${rec.symbol} (Priority: ${rec.priority}/10)`,
            value,
            inline: false
          });
        }

        await textChannel.send({ embeds: [recsEmbed] });
      }

      // Hold reasons if no active trades
      if (plan.holdReasons.length > 0 && plan.recommendations.filter(r => r.action !== 'HOLD').length === 0) {
        const holdEmbed = new EmbedBuilder()
          .setTitle('⏸️ Holding - No Active Trades Today')
          .setColor(Colors.Yellow)
          .setDescription(plan.holdReasons.join('\n• '));

        await textChannel.send({ embeds: [holdEmbed] });
      }

      // Options opportunities
      if (plan.optionsOpportunities.length > 0) {
        const optionsEmbed = new EmbedBuilder()
          .setTitle('📊 Options Opportunities')
          .setColor(Colors.Purple)
          .setDescription(plan.optionsOpportunities.join('\n• '));

        await textChannel.send({ embeds: [optionsEmbed] });
      }

      logger.info('📤 Trading plan notifications sent to Discord');
    } catch (error) {
      logger.error('Failed to send trading plan notifications:', error);
    }
  }

  async notifyTradeExecutions(executions: TradeExecution[]): Promise<void> {
    if (!this.discordClient || !this.tradingChannelId) return;

    try {
      const channel = await this.discordClient.channels.fetch(this.tradingChannelId);
      if (!channel || !channel.isTextBased()) return;

      const textChannel = channel as TextChannel;

      const executedTrades = executions.filter(e => e.executed);
      const failedTrades = executions.filter(e => !e.executed && e.error);

      if (executedTrades.length > 0) {
        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Trades Executed')
          .setColor(Colors.Green)
          .setTimestamp();

        for (const exec of executedTrades) {
          successEmbed.addFields({
            name: `${exec.recommendation.action} ${exec.recommendation.symbol}`,
            value: `Order ID: \`${exec.orderId}\`\nQty: ${exec.recommendation.quantity || 'N/A'}`,
            inline: true
          });
        }

        await textChannel.send({ embeds: [successEmbed] });
      }

      if (failedTrades.length > 0) {
        const failEmbed = new EmbedBuilder()
          .setTitle('❌ Trade Failures')
          .setColor(Colors.Red)
          .setTimestamp();

        for (const exec of failedTrades) {
          failEmbed.addFields({
            name: `${exec.recommendation.action} ${exec.recommendation.symbol}`,
            value: `Error: ${exec.error}`,
            inline: false
          });
        }

        await textChannel.send({ embeds: [failEmbed] });
      }
    } catch (error) {
      logger.error('Failed to send trade execution notifications:', error);
    }
  }

  // ==========================================================================
  // Main Entry Point
  // ==========================================================================

  async runDailyAnalysis(options: {
    execute?: boolean;
    notify?: boolean;
  } = {}): Promise<{
    intelligence: MarketIntelligence;
    plan: DailyTradingPlan;
    executions?: TradeExecution[];
  }> {
    const { execute = this.autoExecute, notify = true } = options;

    logger.info('🤖 Starting daily trading analysis...');

    // 1. Gather intelligence
    const intelligence = await this.gatherMarketIntelligence();
    logger.info('📊 Market intelligence gathered');

    // 2. Generate trading plan
    const plan = await this.generateDailyTradingPlan(intelligence);
    logger.info(`📋 Trading plan generated: ${plan.recommendations.length} recommendations`);

    // 3. Notify on Discord
    if (notify) {
      await this.notifyTradingPlan(plan);
    }

    // 4. Execute trades if enabled
    let executions: TradeExecution[] | undefined;
    if (execute && plan.recommendations.some(r => r.action !== 'HOLD')) {
      executions = await this.executeRecommendations(plan, { dryRun: false });

      if (notify) {
        await this.notifyTradeExecutions(executions);
      }
    }

    logger.info('✅ Daily trading analysis complete');

    return { intelligence, plan, executions };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let tradingAgentInstance: TradingAgent | null = null;

export function getTradingAgent(): TradingAgent {
  if (!tradingAgentInstance) {
    tradingAgentInstance = new TradingAgent();
  }
  return tradingAgentInstance;
}

export default TradingAgent;
