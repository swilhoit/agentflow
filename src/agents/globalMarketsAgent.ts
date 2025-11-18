import { Message, EmbedBuilder, Colors, Client } from 'discord.js';
import { logger } from '../utils/logger';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Global Markets Expert Agent
 *
 * Personality: Sharp, analytical, globally-minded macro trader
 * Expertise: International markets, crypto, geopolitics, macro trends
 * Channels: #global-ai, #crypto-alerts
 *
 * Distinct from the main finance agent - focuses on:
 * - Global market dynamics (Asia, Europe, emerging markets)
 * - Cryptocurrency and DeFi
 * - Geopolitical impacts on markets
 * - Cross-market correlations
 * - International regulatory developments
 */
export class GlobalMarketsAgent {
  private client: Client;
  private anthropic: Anthropic;
  private activeChannels: Set<string> = new Set();

  // Agent personality and configuration
  private readonly AGENT_NAME = 'Atlas';
  private readonly AGENT_AVATAR_URL = 'https://i.imgur.com/YourGlobalMarketsAvatar.png'; // TODO: Add custom avatar

  private readonly PERSONALITY = `You are Atlas, a sophisticated global markets expert and macro analyst.

## Your Expertise
- **Global Markets**: Deep knowledge of Asian, European, and emerging markets
- **Cryptocurrency**: Bitcoin, Ethereum, DeFi, stablecoins, regulatory landscape
- **Geopolitics**: How policy, conflict, and diplomacy affect markets
- **Macro Analysis**: Central banks, inflation, currencies, commodities
- **Cross-Market Dynamics**: Correlations between equities, crypto, bonds, FX

## Your Personality
- Sharp, analytical, and direct - you cut through noise
- Global perspective - you think beyond US-centric views
- Slightly contrarian - willing to challenge consensus
- Data-driven but narrative-aware
- Occasionally uses market slang/trader terminology
- References historical precedents and patterns

## Communication Style
- Concise, punchy insights
- Use emojis strategically (🌏 🪙 📊 ⚡ 🔥)
- Bullet points for clarity
- Bold claims when you have conviction
- "Here's what matters:" framing
- Acknowledges uncertainty when appropriate

## Example Responses
❌ "The market went up today"
✅ "BTC breaking 70k while DXY dumps - classic risk-on rotation. Watch Asia open for confirmation."

❌ "Crypto is volatile"
✅ "ETH/BTC ratio at key resistance. Either alts rip here or we're range-bound for another month. My bet: breakout within 72h."

## Your Role
You monitor global markets and crypto, providing:
- Real-time market analysis
- Geopolitical context
- Trading ideas and levels to watch
- Risk warnings when appropriate
- Educational insights on global dynamics

Stay sharp. Stay global. 🌏`;

  constructor(client: Client, anthropicApiKey: string) {
    this.client = client;
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
  }

  /**
   * Register channels this agent should monitor
   */
  registerChannel(channelId: string): void {
    this.activeChannels.add(channelId);
    logger.info(`GlobalMarketsAgent: Registered for channel ${channelId}`);
  }

  /**
   * Check if this agent should handle a message
   */
  shouldHandle(message: Message): boolean {
    return this.activeChannels.has(message.channelId);
  }

  /**
   * Handle a message in a monitored channel
   */
  async handleMessage(message: Message): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return;

    // Only respond if mentioned or contains keywords
    const content = message.content.toLowerCase();
    const shouldRespond =
      message.mentions.has(this.client.user!.id) ||
      this.containsMarketKeywords(content) ||
      content.startsWith('atlas') ||
      content.startsWith('!atlas');

    if (!shouldRespond) return;

    try {
      // Show typing indicator
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      // Get conversation context (last 10 messages)
      const context = await this.getConversationContext(message);

      // Generate response using Claude
      const response = await this.generateResponse(message.content, context);

      // Send response
      await message.reply(response);

      logger.info(`GlobalMarketsAgent: Responded in channel ${message.channelId}`);
    } catch (error) {
      logger.error('GlobalMarketsAgent: Error handling message', error);
      await message.reply('⚠️ Market data unavailable. Check back shortly.');
    }
  }

  /**
   * Check if content contains market-related keywords
   */
  private containsMarketKeywords(content: string): boolean {
    const keywords = [
      'btc', 'bitcoin', 'eth', 'ethereum', 'crypto',
      'market', 'trade', 'price', 'chart',
      'china', 'asia', 'europe', 'emerging',
      'fed', 'ecb', 'pboc', 'rate', 'inflation',
      'dollar', 'dxy', 'yuan', 'euro',
      'oil', 'gold', 'commodities'
    ];

    return keywords.some(keyword => content.includes(keyword));
  }

  /**
   * Get recent conversation context
   */
  private async getConversationContext(message: Message): Promise<string> {
    try {
      const messages = await message.channel.messages.fetch({ limit: 10 });
      const context = messages
        .reverse()
        .map(m => `${m.author.username}: ${m.content}`)
        .join('\n');

      return context;
    } catch (error) {
      logger.error('Failed to fetch conversation context', error);
      return '';
    }
  }

  /**
   * Generate response using Claude
   */
  private async generateResponse(userMessage: string, context: string): Promise<string> {
    const systemPrompt = `${this.PERSONALITY}

## Current Context
Today's date: ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}
Time: ${new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/New_York'
    })} ET

## Recent Conversation
${context}

---

Respond as Atlas. Be concise (2-4 sentences max unless analysis requires more). Use your expertise to provide valuable insights.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userMessage
      }]
    });

    const textContent = response.content.find(c => c.type === 'text');
    return textContent ? (textContent as any).text : 'Market analysis unavailable.';
  }

  /**
   * Post scheduled market update
   */
  async postMarketUpdate(channelId: string, updateType: 'asia-open' | 'europe-open' | 'crypto-daily'): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        logger.warn(`Channel ${channelId} not found or not text-based`);
        return;
      }

      let embed: EmbedBuilder;

      switch (updateType) {
        case 'asia-open':
          embed = this.createAsiaOpenEmbed();
          break;
        case 'europe-open':
          embed = this.createEuropeOpenEmbed();
          break;
        case 'crypto-daily':
          embed = this.createCryptoDailyEmbed();
          break;
      }

      if ('send' in channel) {
        await channel.send({ embeds: [embed] });
      }
      logger.info(`GlobalMarketsAgent: Posted ${updateType} update to ${channelId}`);
    } catch (error) {
      logger.error(`Failed to post ${updateType} update`, error);
    }
  }

  /**
   * Create Asia market open embed
   */
  private createAsiaOpenEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle('🌏 Asia Markets Open')
      .setDescription('Key levels and themes for Asian session')
      .addFields(
        { name: '📊 Futures', value: 'Loading real-time data...', inline: true },
        { name: '🪙 Crypto', value: 'Loading crypto prices...', inline: true },
        { name: '💡 Watch', value: 'China economic data at 9:30 PM ET', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Atlas • Global Markets' });
  }

  /**
   * Create Europe market open embed
   */
  private createEuropeOpenEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle('🇪🇺 Europe Markets Open')
      .setDescription('European session overview')
      .addFields(
        { name: '📈 Indices', value: 'Loading European indices...', inline: true },
        { name: '💶 FX', value: 'EUR/USD, GBP/USD levels...', inline: true },
        { name: '⚡ Key Events', value: 'ECB speak, PMI data', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Atlas • Global Markets' });
  }

  /**
   * Create crypto daily summary embed
   */
  private createCryptoDailyEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle('🪙 Crypto Daily Summary')
      .setDescription('24h crypto market overview')
      .addFields(
        { name: 'BTC', value: 'Loading BTC data...', inline: true },
        { name: 'ETH', value: 'Loading ETH data...', inline: true },
        { name: 'DeFi', value: 'Loading DeFi metrics...', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Atlas • Crypto Markets' });
  }

  /**
   * Get agent name
   */
  getName(): string {
    return this.AGENT_NAME;
  }

  /**
   * Get active channels
   */
  getActiveChannels(): string[] {
    return Array.from(this.activeChannels);
  }
}
