import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { getDatabase } from './databaseFactory';
import { EmbedBuilder, Colors } from 'discord.js';

export interface WeeklyAnalysisResult {
  weekStart: Date;
  weekEnd: Date;
  executiveSummary: string;
  usThesisDevelopments: string[];
  chinaThesisDevelopments: string[];
  portfolioPerformance: {
    bestPerformers: Array<{ symbol: string; performance: number; catalyst?: string }>;
    worstPerformers: Array<{ symbol: string; performance: number; reason?: string }>;
  };
  usVsChinaScorecard: {
    nuclearApprovals: { us: number; china: number };
    gridInvestment: { us: string; china: string };
    policyMomentum: { us: string; china: string };
  };
  thesisStatus: 'ON TRACK' | 'ACCELERATING' | 'SLOWING' | 'AT RISK';
  nextWeekCatalysts: string[];
  recommendations: string[];
  keyMetrics: {
    totalDataPoints: number;
    significantNewsEvents: number;
    weeklyPortfolioReturn: number;
  };
}

/**
 * Weekly Thesis Analysis Service
 * Uses Claude to analyze market data and news for AI Manhattan Project thesis
 */
export class WeeklyThesisAnalyzer {
  private anthropic: Anthropic;
  private db = getDatabase();

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Generate weekly analysis using Claude
   */
  async generateWeeklyAnalysis(): Promise<WeeklyAnalysisResult> {
    // Get date range for the past week
    const weekEnd = new Date();
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekStartStr = this.formatDate(weekStart);
    const weekEndStr = this.formatDate(weekEnd);

    logger.info(`Generating weekly analysis for ${weekStartStr} to ${weekEndStr}`);

    // Gather data from database
    const marketData = await this.getWeeklyMarketData(weekStartStr, weekEndStr);
    const newsData = await this.getWeeklyNews(weekStartStr, weekEndStr);
    const significantNews = newsData.filter((n: any) => n.is_significant);

    logger.info(`Collected ${marketData.length} market data points and ${newsData.length} news articles (${significantNews.length} significant)`);

    // Build analysis prompt for Claude
    const analysisPrompt = this.buildAnalysisPrompt(
      marketData,
      newsData,
      weekStartStr,
      weekEndStr
    );

    // Call Claude for analysis
    const claudeResponse = await this.analyzeWithClaude(analysisPrompt);

    // Parse and structure the response
    const analysis = this.parseClaudeAnalysis(claudeResponse, weekStart, weekEnd, marketData, newsData);

    // Add all ticker performance data for full list generation
    (analysis as any).allTickerPerformance = this.getAllTickerPerformance(marketData);

    // Save to database
    this.saveAnalysisToDatabase(analysis);

    return analysis;
  }

  /**
   * Build comprehensive analysis prompt for Claude
   */
  private buildAnalysisPrompt(
    marketData: any[],
    newsData: any[],
    weekStart: string,
    weekEnd: string
  ): string {
    // Group market data by symbol
    const symbolPerformance = new Map<string, any[]>();
    for (const data of marketData) {
      if (!symbolPerformance.has(data.symbol)) {
        symbolPerformance.set(data.symbol, []);
      }
      symbolPerformance.get(data.symbol)!.push(data);
    }

    // Calculate weekly performance for each symbol
    const weeklyPerformance: Array<{ symbol: string; startPrice: number; endPrice: number; performance: number }> = [];
    for (const [symbol, dataPoints] of symbolPerformance) {
      if (dataPoints.length >= 2) {
        // Sort by date
        dataPoints.sort((a, b) => a.date.localeCompare(b.date));
        const startPrice = dataPoints[0].price;
        const endPrice = dataPoints[dataPoints.length - 1].price;
        const performance = ((endPrice - startPrice) / startPrice) * 100;
        weeklyPerformance.push({ symbol, startPrice, endPrice, performance });
      }
    }

    // Sort performance
    weeklyPerformance.sort((a, b) => b.performance - a.performance);

    // Group news by symbol
    const newsBySymbol = new Map<string, any[]>();
    for (const news of newsData) {
      if (!newsBySymbol.has(news.symbol)) {
        newsBySymbol.set(news.symbol, []);
      }
      newsBySymbol.get(news.symbol)!.push(news);
    }

    return `You are analyzing the "AI Manhattan Project" investment thesis, which states that both the US and China are engaging in state-led infrastructure buildouts to support AI development, requiring massive investments in:
- Nuclear and uranium energy (for power generation)
- Grid infrastructure (to distribute power)
- Data centers (for AI compute)
- Critical minerals (copper, rare earths for hardware)

Analyze the following week's data (${weekStart} to ${weekEnd}) and provide a comprehensive thesis progress report.

## MARKET DATA

### Weekly Performance (${weeklyPerformance.length} tickers tracked)

Top 10 Performers:
${weeklyPerformance.slice(0, 10).map(p => `- ${p.symbol}: ${p.performance >= 0 ? '+' : ''}${p.performance.toFixed(2)}% ($${p.startPrice.toFixed(2)} → $${p.endPrice.toFixed(2)})`).join('\n')}

Bottom 10 Performers:
${weeklyPerformance.slice(-10).reverse().map(p => `- ${p.symbol}: ${p.performance >= 0 ? '+' : ''}${p.performance.toFixed(2)}% ($${p.startPrice.toFixed(2)} → $${p.endPrice.toFixed(2)})`).join('\n')}

## NEWS DATA (${newsData.length} articles, ${newsData.filter((n: any) => n.is_significant).length} significant)

${Array.from(newsBySymbol.entries()).slice(0, 15).map(([symbol, articles]) => `
### ${symbol} (${articles.length} articles)
${articles.slice(0, 3).map((a: any) => `- ${a.headline}\n  Source: ${a.source} | ${new Date(a.published_at).toLocaleDateString()}\n  ${a.summary?.slice(0, 200)}...`).join('\n')}
`).join('\n')}

## THESIS CATEGORIES TO ANALYZE

1. **US Nuclear/Uranium** (CCJ, UEC, UUUU, DNN, OKLO, SMR, NNE, LEU)
   - Policy developments (DOE, NRC approvals, White House initiatives)
   - Uranium spot price movements
   - New reactor approvals or construction milestones

2. **China/International Nuclear** (1816.HK, 601985.SS, 1772.HK, CCJ)
   - State Grid expansion announcements
   - Nuclear reactor approvals by China Nuclear
   - State-led infrastructure investment increases

3. **Grid Infrastructure** (PWR, MYRG, ABBNY, SIEGY)
   - Grid modernization projects announced
   - Power transmission infrastructure buildouts
   - Grid capacity additions for data centers

4. **Data Center REITs** (DLR, EQIX, AMT, CCI, SBAC)
   - New data center construction announcements
   - AI/hyperscaler lease agreements
   - Power demand increases

5. **Critical Minerals** (FCX, SCCO, TECK, MP)
   - Copper/rare earth supply/demand dynamics
   - China export restrictions or policy changes
   - New mining projects or capacity expansions

## REQUIRED OUTPUT FORMAT

Please provide your analysis in the following JSON structure:

{
  "executiveSummary": "2-3 sentence summary of the week's most important thesis developments",
  "usThesisDevelopments": [
    "Bullet point 1: Key US development with specific details",
    "Bullet point 2: ...",
    "Up to 5 most significant US developments"
  ],
  "chinaThesisDevelopments": [
    "Bullet point 1: Key China development with specific details",
    "Bullet point 2: ...",
    "Up to 5 most significant China developments"
  ],
  "portfolioInsights": {
    "bestPerformers": [
      {"symbol": "OKLO", "performance": 18.2, "catalyst": "NRC design approval received"},
      {"symbol": "CCJ", "performance": 8.1, "catalyst": "Uranium spot price increased 3%"}
    ],
    "worstPerformers": [
      {"symbol": "DLR", "performance": -2.1, "reason": "REIT sector weakness amid rate concerns"}
    ]
  },
  "usVsChinaScorecard": {
    "nuclearApprovals": {"us": 2, "china": 4},
    "gridInvestment": {"us": "$2B announced", "china": "$8B announced"},
    "policyMomentum": {"us": "Strong", "china": "Very Strong"}
  },
  "thesisStatus": "ON TRACK | ACCELERATING | SLOWING | AT RISK",
  "thesisStatusRationale": "1-2 sentence explanation of thesis status",
  "nextWeekCatalysts": [
    "Specific upcoming event with date (e.g., 'Cameco earnings report - Nov 20')",
    "Policy announcement or data release expected",
    "Up to 5 most important catalysts"
  ],
  "recommendations": [
    "Actionable recommendation 1 (e.g., 'Consider adding to CCJ on any dip below $45')",
    "Actionable recommendation 2",
    "Up to 5 recommendations"
  ]
}

Focus on:
1. **State-led infrastructure buildout** - Are governments accelerating AI infrastructure investments?
2. **US vs China comparison** - Which country is moving faster?
3. **Thesis validation** - Do news events support or contradict the investment thesis?
4. **Actionable insights** - What should be done based on this week's developments?

Provide ONLY the JSON output, no additional text.`;
  }

  /**
   * Call Claude API for analysis
   */
  private async analyzeWithClaude(prompt: string): Promise<string> {
    try {
      logger.info('Calling Claude API for weekly analysis...');

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        temperature: 0.3, // Lower temperature for more factual analysis
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const response = message.content[0].type === 'text' ? message.content[0].text : '';
      logger.info(`Claude analysis complete (${response.length} characters)`);

      return response;

    } catch (error: any) {
      logger.error('Error calling Claude API:', error.message);
      throw new Error(`Failed to generate analysis: ${error.message}`);
    }
  }

  /**
   * Parse Claude's JSON response into structured analysis
   */
  private parseClaudeAnalysis(
    claudeResponse: string,
    weekStart: Date,
    weekEnd: Date,
    marketData: any[],
    newsData: any[]
  ): WeeklyAnalysisResult {
    try {
      // Extract JSON from response (Claude might wrap it in markdown)
      let jsonStr = claudeResponse.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Calculate portfolio-wide weekly return
      const symbolPerformance = new Map<string, any[]>();
      for (const data of marketData) {
        if (!symbolPerformance.has(data.symbol)) {
          symbolPerformance.set(data.symbol, []);
        }
        symbolPerformance.get(data.symbol)!.push(data);
      }

      let totalReturn = 0;
      let tickerCount = 0;
      for (const [symbol, dataPoints] of symbolPerformance) {
        if (dataPoints.length >= 2) {
          dataPoints.sort((a, b) => a.date.localeCompare(b.date));
          const startPrice = dataPoints[0].price;
          const endPrice = dataPoints[dataPoints.length - 1].price;
          const performance = ((endPrice - startPrice) / startPrice) * 100;
          totalReturn += performance;
          tickerCount++;
        }
      }
      const weeklyPortfolioReturn = tickerCount > 0 ? totalReturn / tickerCount : 0;

      return {
        weekStart,
        weekEnd,
        executiveSummary: parsed.executiveSummary || 'No summary available',
        usThesisDevelopments: parsed.usThesisDevelopments || [],
        chinaThesisDevelopments: parsed.chinaThesisDevelopments || [],
        portfolioPerformance: {
          bestPerformers: parsed.portfolioInsights?.bestPerformers || [],
          worstPerformers: parsed.portfolioInsights?.worstPerformers || []
        },
        usVsChinaScorecard: parsed.usVsChinaScorecard || {
          nuclearApprovals: { us: 0, china: 0 },
          gridInvestment: { us: 'N/A', china: 'N/A' },
          policyMomentum: { us: 'N/A', china: 'N/A' }
        },
        thesisStatus: parsed.thesisStatus || 'ON TRACK',
        nextWeekCatalysts: parsed.nextWeekCatalysts || [],
        recommendations: parsed.recommendations || [],
        keyMetrics: {
          totalDataPoints: marketData.length,
          significantNewsEvents: newsData.filter((n: any) => n.is_significant).length,
          weeklyPortfolioReturn
        }
      };

    } catch (error: any) {
      logger.error('Error parsing Claude analysis:', error.message);
      logger.error('Claude response:', claudeResponse);
      throw new Error(`Failed to parse analysis: ${error.message}`);
    }
  }

  /**
   * Generate Discord embeds for weekly analysis with full ticker list
   */
  generateAnalysisEmbeds(analysis: WeeklyAnalysisResult, includeFullTickerList: boolean = false): EmbedBuilder[] {
    const embeds: EmbedBuilder[] = [];

    // If full ticker list requested, add it first
    if (includeFullTickerList && analysis.keyMetrics && (analysis as any).allTickerPerformance) {
      const tickerListEmbeds = this.generateTickerListEmbeds((analysis as any).allTickerPerformance);
      embeds.push(...tickerListEmbeds);
    }

    // Main summary embed
    const summaryEmbed = new EmbedBuilder()
      .setColor(this.getThesisStatusColor(analysis.thesisStatus))
      .setTitle('📊 AI Manhattan Project - Weekly Thesis Analysis')
      .setDescription(`**Week of ${this.formatDateShort(analysis.weekStart)} - ${this.formatDateShort(analysis.weekEnd)}**`)
      .setTimestamp();

    summaryEmbed.addFields({
      name: '🎯 Executive Summary',
      value: analysis.executiveSummary,
      inline: false
    });

    summaryEmbed.addFields({
      name: '📈 Portfolio Performance',
      value: `Weekly Return: ${analysis.keyMetrics.weeklyPortfolioReturn >= 0 ? '+' : ''}${analysis.keyMetrics.weeklyPortfolioReturn.toFixed(2)}%\nData Points: ${analysis.keyMetrics.totalDataPoints} | Significant News: ${analysis.keyMetrics.significantNewsEvents}`,
      inline: false
    });

    summaryEmbed.addFields({
      name: '✅ Thesis Status',
      value: this.getThesisStatusEmoji(analysis.thesisStatus) + ' ' + analysis.thesisStatus,
      inline: true
    });

    embeds.push(summaryEmbed);

    // US/China developments embed
    const developmentsEmbed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle('🌍 US vs China Developments');

    if (analysis.usThesisDevelopments.length > 0) {
      developmentsEmbed.addFields({
        name: '🇺🇸 US Developments',
        value: analysis.usThesisDevelopments.map(d => `• ${d}`).join('\n').slice(0, 1024),
        inline: false
      });
    }

    if (analysis.chinaThesisDevelopments.length > 0) {
      developmentsEmbed.addFields({
        name: '🇨🇳 China Developments',
        value: analysis.chinaThesisDevelopments.map(d => `• ${d}`).join('\n').slice(0, 1024),
        inline: false
      });
    }

    embeds.push(developmentsEmbed);

    // Performance and scorecard embed
    const performanceEmbed = new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle('📊 Performance & Scorecard');

    if (analysis.portfolioPerformance.bestPerformers.length > 0) {
      const bestPerformersText = analysis.portfolioPerformance.bestPerformers
        .map(p => `🟩 **${p.symbol}**: ${p.performance >= 0 ? '+' : ''}${p.performance.toFixed(1)}%${p.catalyst ? ` - ${p.catalyst}` : ''}`)
        .join('\n');
      performanceEmbed.addFields({
        name: '🏆 Best Performers',
        value: bestPerformersText.slice(0, 1024),
        inline: false
      });
    }

    if (analysis.portfolioPerformance.worstPerformers.length > 0) {
      const worstPerformersText = analysis.portfolioPerformance.worstPerformers
        .map(p => `🔴 **${p.symbol}**: ${p.performance >= 0 ? '+' : ''}${p.performance.toFixed(1)}%${p.reason ? ` - ${p.reason}` : ''}`)
        .join('\n');
      performanceEmbed.addFields({
        name: '📉 Worst Performers',
        value: worstPerformersText.slice(0, 1024),
        inline: false
      });
    }

    // US vs China scorecard table
    const scorecard = analysis.usVsChinaScorecard;
    const scorecardText = `\`\`\`
Metric              | US        | China     | Winner
--------------------|-----------|-----------|--------
Nuclear Approvals   | ${String(scorecard.nuclearApprovals.us).padEnd(9)} | ${String(scorecard.nuclearApprovals.china).padEnd(9)} | ${scorecard.nuclearApprovals.china > scorecard.nuclearApprovals.us ? '🇨🇳' : scorecard.nuclearApprovals.us > scorecard.nuclearApprovals.china ? '🇺🇸' : '➖'}
Grid Investment     | ${scorecard.gridInvestment.us.padEnd(9)} | ${scorecard.gridInvestment.china.padEnd(9)} |
Policy Momentum     | ${scorecard.policyMomentum.us.padEnd(9)} | ${scorecard.policyMomentum.china.padEnd(9)} |
\`\`\``;

    performanceEmbed.addFields({
      name: '⚖️ US vs China Scorecard',
      value: scorecardText,
      inline: false
    });

    embeds.push(performanceEmbed);

    // Outlook embed
    const outlookEmbed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle('🔮 Outlook & Recommendations');

    if (analysis.nextWeekCatalysts.length > 0) {
      outlookEmbed.addFields({
        name: '📅 Next Week Catalysts',
        value: analysis.nextWeekCatalysts.map(c => `• ${c}`).join('\n').slice(0, 1024),
        inline: false
      });
    }

    if (analysis.recommendations.length > 0) {
      outlookEmbed.addFields({
        name: '💡 Action Items',
        value: analysis.recommendations.map(r => `• ${r}`).join('\n').slice(0, 1024),
        inline: false
      });
    }

    outlookEmbed.setFooter({ text: `Generated by AI analysis of ${analysis.keyMetrics.totalDataPoints} data points | Powered by Claude` });

    embeds.push(outlookEmbed);

    return embeds;
  }

  /**
   * Get weekly market data from database
   */
  private async getWeeklyMarketData(startDate: string, endDate: string): Promise<any[]> {
    return await this.db.getMarketDataByDateRange(startDate, endDate);
  }

  /**
   * Get weekly news from database
   */
  private async getWeeklyNews(startDate: string, endDate: string): Promise<any[]> {
    return await this.db.getMarketNewsByDateRange(startDate, endDate);
  }

  /**
   * Save analysis to database
   */
  private saveAnalysisToDatabase(analysis: WeeklyAnalysisResult): void {
    try {
      this.db.saveWeeklyAnalysis({
        weekStart: this.formatDate(analysis.weekStart),
        weekEnd: this.formatDate(analysis.weekEnd),
        analysisType: 'thesis',
        title: `AI Manhattan Project Analysis - ${this.formatDateShort(analysis.weekStart)} to ${this.formatDateShort(analysis.weekEnd)}`,
        summary: analysis.executiveSummary,
        detailedAnalysis: JSON.stringify({
          usThesisDevelopments: analysis.usThesisDevelopments,
          chinaThesisDevelopments: analysis.chinaThesisDevelopments,
          portfolioPerformance: analysis.portfolioPerformance,
          usVsChinaScorecard: analysis.usVsChinaScorecard
        }),
        keyEvents: JSON.stringify([
          ...analysis.usThesisDevelopments.slice(0, 3),
          ...analysis.chinaThesisDevelopments.slice(0, 3)
        ]),
        recommendations: JSON.stringify(analysis.recommendations),
        metadata: JSON.stringify({
          thesisStatus: analysis.thesisStatus,
          nextWeekCatalysts: analysis.nextWeekCatalysts,
          keyMetrics: analysis.keyMetrics
        })
      });

      logger.info('Saved weekly analysis to database');
    } catch (error: any) {
      logger.error('Error saving analysis to database:', error.message);
    }
  }

  /**
   * Helper: Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Helper: Format date as MMM DD
   */
  private formatDateShort(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /**
   * Get color for thesis status
   */
  private getThesisStatusColor(status: string): number {
    switch (status) {
      case 'ACCELERATING':
        return Colors.Green;
      case 'ON TRACK':
        return Colors.Blue;
      case 'SLOWING':
        return Colors.Orange;
      case 'AT RISK':
        return Colors.Red;
      default:
        return Colors.Grey;
    }
  }

  /**
   * Get emoji for thesis status
   */
  private getThesisStatusEmoji(status: string): string {
    switch (status) {
      case 'ACCELERATING':
        return '🚀';
      case 'ON TRACK':
        return '✅';
      case 'SLOWING':
        return '⚠️';
      case 'AT RISK':
        return '🔴';
      default:
        return '❓';
    }
  }

  /**
   * Get all ticker performance data from market data
   */
  private getAllTickerPerformance(marketData: any[]): any[] {
    // Group by symbol and get latest data for each
    const symbolMap = new Map<string, any>();

    for (const data of marketData) {
      if (!symbolMap.has(data.symbol)) {
        symbolMap.set(data.symbol, data);
      } else {
        // Keep the most recent data
        const existing = symbolMap.get(data.symbol);
        if (new Date(data.timestamp) > new Date(existing.timestamp)) {
          symbolMap.set(data.symbol, data);
        }
      }
    }

    return Array.from(symbolMap.values()).map(d => ({
      symbol: d.symbol,
      price: d.price,
      changePercent: d.change_percent,
      performance30d: d.performance_30d,
      performance90d: d.performance_90d,
      performance365d: d.performance_365d
    }));
  }

  /**
   * Generate embeds showing full ticker list with price metrics
   */
  private generateTickerListEmbeds(tickerPerformance: any[]): EmbedBuilder[] {
    const embeds: EmbedBuilder[] = [];

    // Group by category (we'll use color coding)
    const categories = [
      { name: '🇺🇸 US Nuclear & Micro Reactors', tickers: ['OKLO', 'NNE', 'SMR'] },
      { name: '☢️ Uranium Mining & Enrichment', tickers: ['UUUU', 'UEC', 'CCJ', 'LEU', 'LTBR'] },
      { name: '⚡ Grid Infrastructure & Power', tickers: ['PWR', 'MYRG', 'ET', 'WMB', 'TLN'] },
      { name: '🏢 Data Center REITs', tickers: ['DLR', 'EQIX'] },
      { name: '⛏️ Critical Minerals', tickers: ['FCX', 'ASPI'] },
      { name: '🌏 China & ROW Nuclear/Uranium', tickers: ['1816.HK', 'PDN.AX', 'KAP.L', 'CGG.TO'] },
      { name: '📊 Thematic ETFs & Trusts', tickers: ['SRUUF', 'U-UN.TO', 'URA', 'NLR', 'URNM'] }
    ];

    for (const category of categories) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle(category.name);

      let description = '```\n';
      description += 'Ticker    Price    Daily   30d     90d     1yr\n';
      description += '─'.repeat(50) + '\n';

      for (const symbol of category.tickers) {
        const ticker = tickerPerformance.find(t => t.symbol === symbol);

        if (ticker) {
          const price = ticker.price != null ? `$${ticker.price.toFixed(2)}`.padEnd(8) : 'N/A     ';
          const daily = ticker.changePercent != null
            ? `${ticker.changePercent >= 0 ? '+' : ''}${ticker.changePercent.toFixed(1)}%`.padEnd(7)
            : 'N/A    ';
          const p30 = ticker.performance30d != null
            ? `${ticker.performance30d >= 0 ? '+' : ''}${ticker.performance30d.toFixed(1)}%`.padEnd(7)
            : 'N/A    ';
          const p90 = ticker.performance90d != null
            ? `${ticker.performance90d >= 0 ? '+' : ''}${ticker.performance90d.toFixed(1)}%`.padEnd(7)
            : 'N/A    ';
          const p365 = ticker.performance365d != null
            ? `${ticker.performance365d >= 0 ? '+' : ''}${ticker.performance365d.toFixed(1)}%`.padEnd(7)
            : 'N/A    ';

          description += `${symbol.padEnd(10)}${price}${daily}${p30}${p90}${p365}\n`;
        }
      }

      description += '```';
      embed.setDescription(description);

      embeds.push(embed);
    }

    return embeds;
  }
}
