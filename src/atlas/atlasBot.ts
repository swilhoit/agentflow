import {
  Client,
  GatewayIntentBits,
  Message,
  EmbedBuilder,
  Colors,
  ActivityType
} from 'discord.js';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { AtlasTools } from './atlasTools';
import { isUsingSupabase, getSQLiteDatabase } from '../services/databaseFactory';
import type { DatabaseService } from '../services/database';

/**
 * Atlas - Global Markets Expert Bot
 *
 * A standalone Discord bot focused on global markets, crypto, and geopolitical analysis.
 * Runs independently from the main AgentFlow bot with its own personality and toolset.
 */
export class AtlasBot {
  private client: Client;
  private anthropic: Anthropic;
  private tools: AtlasTools;
  private monitoredChannels: Set<string> = new Set();
  private db: DatabaseService | null = null;

  // Configuration
  private readonly BOT_NAME = 'Atlas';
  private readonly STATUS_MESSAGE = 'Global Markets • !atlas help';

  // Rate limiting
  private messageRateLimits: Map<string, number> = new Map();
  private readonly RATE_LIMIT_MS = 5000; // 5 seconds between responses per user

  // System prompt for Atlas
  private readonly SYSTEM_PROMPT = `You are Atlas, a world-class global markets expert and macro analyst.

## Core Identity
You're a sharp, analytical trader with deep knowledge of:
- **Global Markets**: Asian (Nikkei, Hang Seng, Shanghai), European (DAX, FTSE, CAC), emerging markets
- **Cryptocurrency**: Bitcoin, Ethereum, DeFi protocols, stablecoins, on-chain metrics, regulatory landscape
- **Geopolitics**: How policy, elections, conflicts, and diplomacy move markets
- **Macro**: Central banks (Fed, ECB, BOJ, PBOC), inflation, currencies, commodities
- **Cross-Market Dynamics**: Correlations between equities, crypto, bonds, FX, and commodities

## Personality Traits
- **Sharp & Direct**: Cut through noise. No fluff. Actionable insights.
- **Global Perspective**: Think beyond US-centric views. You track Asia, Europe, EM.
- **Slightly Contrarian**: Challenge consensus when data supports it. Not a permabull/bear.
- **Data-Driven**: Back claims with evidence, charts, on-chain data, historical patterns.
- **Trader Terminology**: Use market slang naturally (rip, dump, chad, giga, wen, etc.)
- **Pattern Recognition**: Reference historical precedents. "Last time X happened, Y followed."

## Communication Style
- **Concise**: 2-4 sentences unless deep analysis required
- **Punchy**: Start with the key insight
- **Strategic Emojis**: 🌏 (global), 🪙 (crypto), 📊 (charts), ⚡ (breaking), 🔥 (hot take), 🐻🐂 (sentiment)
- **Bullet Points**: For multi-part analysis
- **Bold Claims**: When you have conviction, own it
- **Acknowledge Uncertainty**: "Could go either way" when genuinely unclear

## Response Framework
1. **Hook**: Lead with the key insight
2. **Context**: Brief supporting evidence
3. **Outlook**: What to watch / what happens next
4. **Risk**: Mention key risks if relevant

## Example Responses

❌ BAD:
"Bitcoin went up today because of buying pressure. It could continue going up or it might go down."

✅ GOOD:
"BTC breaking $70k on declining volume - classic bull trap setup. Watch for a flush to $65k support. If it holds there, we're back in business. If it breaks, next stop $60k. 📊"

❌ BAD:
"China announced stimulus. This is bullish."

✅ GOOD:
"PBOC rate cut smaller than expected (10bps vs 15bps whispers). Market pricing in disappointment - watch Shanghai session for confirmation. If CSI 300 holds 3,200, we're good. Break below = more cuts needed. 🌏"

❌ BAD:
"EUR/USD is at an important level."

✅ GOOD:
"EUR/USD at 1.08 - make-or-break level. ECB dovish but Fed also signaling cuts. I'm leaning range-bound 1.06-1.10 until we get clear policy divergence. Short-term bias: slight USD weakness. 💶"

## Tools Available
You have access to comprehensive real-time market intelligence tools:

**Real-Time Data:**
- **crypto_price**: Current crypto prices (BTC, ETH, etc.)
- **forex_rate**: FX rates (EUR/USD, USD/JPY, etc.)
- **market_sentiment**: Crypto Fear & Greed Index with interpretation

**Perplexity-Powered Intelligence (ALWAYS use for current events):**
- **news_search**: Latest breaking news via Perplexity real-time web search
- **market_intelligence**: Comprehensive analysis reports (in-depth topics)
- **geopolitical_analysis**: Market implications of geopolitical events
- **sector_analysis**: Deep sector analysis (uranium, AI chips, DeFi, etc.)
- **earnings_analysis**: Latest company earnings with market reaction
- **breaking_market_news**: Current market-moving news

**AI Manhattan Project Portfolio (Yahoo Finance + Perplexity):**
- **portfolio_snapshot**: Full AI Manhattan thesis portfolio (30+ tickers: nuclear, uranium, grid, data centers, China/ROW, ETFs)
- **ticker_deep_dive**: Deep analysis on any ticker (price + Perplexity news + analyst opinions)

**Technical:**
- **chart_analysis**: Technical analysis for assets

CRITICAL USAGE RULES:
1. When users ask about "latest", "today", "recent", "what happened" → ALWAYS use Perplexity tools
2. For AI Manhattan thesis questions → use portfolio_snapshot or ticker_deep_dive
3. For geopolitical events → use geopolitical_analysis
4. For sector trends → use sector_analysis
5. Combine tools strategically (e.g., ticker_deep_dive + sector_analysis)

Examples:
- "show me the AI Manhattan portfolio" → portfolio_snapshot
- "deep dive on CCJ" → ticker_deep_dive
- "latest uranium sector news" → sector_analysis("uranium mining")
- "china stimulus impact" → geopolitical_analysis
- "nvidia earnings" → earnings_analysis
- "breaking market news" → breaking_market_news

## When to Respond
- User mentions you: "@Atlas" or "atlas"
- Market keywords: btc, eth, crypto, china, fed, inflation, market, trade, etc.
- Questions about: price action, macro trends, geopolitics, trading ideas
- NOT: Off-topic chit-chat, personal questions, non-market discussion

## Current Context
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
Time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })} ET

Stay sharp. Stay global. 🌏`;

  constructor(token: string, anthropicApiKey: string, channels: string[]) {
    // Initialize Discord client
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    // Initialize database (only for SQLite - Supabase handled separately)
    if (!isUsingSupabase()) {
      try {
        this.db = getSQLiteDatabase();
        logger.info('🌍 Atlas database initialized (SQLite)');
      } catch (e) {
        logger.warn('⚠️  Atlas running without local database');
      }
    } else {
      logger.info('🌍 Atlas using Supabase - message logging disabled');
    }

    // Initialize Anthropic
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });

    // Initialize tools
    this.tools = new AtlasTools();

    // Set monitored channels
    channels.forEach(channelId => this.monitoredChannels.add(channelId));

    this.setupEventHandlers();
  }

  /**
   * Setup Discord event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      logger.info(`🌏 Atlas bot logged in as ${this.client.user?.tag}`);
      logger.info(`📡 Monitoring ${this.monitoredChannels.size} channels`);

      // Set bot status
      this.client.user?.setPresence({
        activities: [{ name: this.STATUS_MESSAGE, type: ActivityType.Watching }],
        status: 'online'
      });
    });

    this.client.on('messageCreate', async (message: Message) => {
      await this.handleMessage(message);
    });

    this.client.on('error', (error) => {
      logger.error('Atlas bot error:', error);
    });
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(message: Message): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check if bot is mentioned or tagged
    const isMentioned = message.mentions.has(this.client.user!.id);
    const content = message.content.toLowerCase();
    const isTagged = content.startsWith('atlas') || 
                     content.startsWith('@atlas') ||
                     content.startsWith('!atlas');

    // If mentioned/tagged, respond regardless of channel
    if (isMentioned || isTagged) {
      logger.info(`✨ Atlas was mentioned/tagged - responding in channel ${message.channelId}`);
      // Continue to respond below
    }
    // Otherwise, only respond in monitored channels
    else if (!this.monitoredChannels.has(message.channelId)) {
      return;
    }

    // Check if we should respond (keywords, etc.)
    if (!this.shouldRespond(message)) return;

    // Rate limiting
    if (this.isRateLimited(message.author.id)) {
      logger.info(`Rate limited user ${message.author.id}`);
      return;
    }

    try {
      // Show typing indicator
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      // Get conversation context
      const context = await this.getConversationContext(message);

      // Generate response with Claude
      const response = await this.generateResponse(message.content, context, message);

      // Send response
      if (response) {
        await message.reply(response);

        // Save messages to database (if available)
        if (this.db) {
          this.db.saveMessage({
            guildId: message.guild!.id,
            channelId: message.channel.id,
            userId: message.author.id,
            username: message.author.tag,
            message: message.content,
            messageType: 'text',
            timestamp: new Date()
          });

          this.db.saveMessage({
            guildId: message.guild!.id,
            channelId: message.channel.id,
            userId: this.client.user!.id,
            username: this.BOT_NAME, // 'Atlas'
            message: response,
            messageType: 'agent_response',
            timestamp: new Date()
          });
        }

        // Update rate limit
        this.messageRateLimits.set(message.author.id, Date.now());

        logger.info(`Atlas responded in channel ${message.channelId}`);
      }
    } catch (error) {
      logger.error('Error handling message:', error);
      await message.reply('⚠️ Market data temporarily unavailable. Try again in a moment.');
    }
  }

  /**
   * Check if Atlas should respond to this message
   */
  private shouldRespond(message: Message): boolean {
    const content = message.content.toLowerCase();

    // Always respond to mentions or atlas command
    if (message.mentions.has(this.client.user!.id) ||
        content.startsWith('atlas') ||
        content.startsWith('!atlas')) {
      return true;
    }

    // Respond to market keywords
    const keywords = [
      'btc', 'bitcoin', 'eth', 'ethereum', 'crypto', 'coin',
      'market', 'trade', 'trading', 'price', 'chart', 'ta',
      'china', 'asia', 'europe', 'emerging', 'japan', 'india',
      'fed', 'ecb', 'boj', 'pboc', 'central bank',
      'rate', 'inflation', 'cpi', 'ppi', 'gdp',
      'dollar', 'dxy', 'yuan', 'euro', 'yen',
      'oil', 'gold', 'silver', 'commodities',
      'bull', 'bear', 'pump', 'dump', 'moon', 'crash'
    ];

    return keywords.some(keyword => content.includes(keyword));
  }

  /**
   * Check if user is rate limited
   */
  private isRateLimited(userId: string): boolean {
    const lastMessage = this.messageRateLimits.get(userId);
    if (!lastMessage) return false;

    const timeSince = Date.now() - lastMessage;
    return timeSince < this.RATE_LIMIT_MS;
  }

  /**
   * Get recent conversation context
   */
  private async getConversationContext(message: Message): Promise<string> {
    try {
      const messages = await message.channel.messages.fetch({ limit: 10 });
      const context = messages
        .reverse()
        .filter(m => !m.author.bot || m.author.id === this.client.user?.id) // Include Atlas's own messages
        .map(m => `${m.author.username}: ${m.content}`)
        .join('\n');

      return context;
    } catch (error) {
      logger.error('Failed to fetch conversation context:', error);
      return '';
    }
  }

  /**
   * Generate response using Claude with tool support
   */
  private async generateResponse(
    userMessage: string,
    context: string,
    message: Message
  ): Promise<string> {
    try {
      const messages: Anthropic.MessageParam[] = [
        {
          role: 'user',
          content: `Recent conversation:\n${context}\n\nLatest message: ${userMessage}`
        }
      ];

      let response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: this.SYSTEM_PROMPT,
        messages,
        tools: this.tools.getToolDefinitions()
      });

      // Handle tool use
      while (response.stop_reason === 'tool_use') {
        // Find ALL tool use blocks in the response
        const toolUses = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        if (toolUses.length === 0) break;

        // Add assistant message with tool calls
        messages.push({
          role: 'assistant',
          content: response.content
        });

        // Execute ALL tools and collect results
        const toolResults = await Promise.all(
          toolUses.map(async (toolUse) => {
            const result = await this.tools.executeTool(toolUse.name, toolUse.input as Record<string, any>);
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: JSON.stringify(result)
            };
          })
        );

        // Add user message with ALL tool results
        messages.push({
          role: 'user',
          content: toolResults as any
        });

        response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: this.SYSTEM_PROMPT,
          messages,
          tools: this.tools.getToolDefinitions()
        });
      }

      // Extract text response
      const textContent = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );

      return textContent?.text || 'Market analysis unavailable.';
    } catch (error) {
      logger.error('Error generating response:', error);
      throw error;
    }
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    const token = process.env.ATLAS_DISCORD_TOKEN;
    if (!token) {
      throw new Error('ATLAS_DISCORD_TOKEN not found in environment');
    }

    await this.client.login(token);
    logger.info('🌏 Atlas bot started successfully');
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    this.client.destroy();
    logger.info('Atlas bot stopped');
  }

  /**
   * Get the Discord client (for external use)
   */
  getClient(): Client {
    return this.client;
  }
}
