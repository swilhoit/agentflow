import {
  Client,
  GatewayIntentBits,
  Message,
  ActivityType
} from 'discord.js';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { AdvisorTools } from './advisorTools';
import { isUsingSupabase, getSQLiteDatabase } from '../services/databaseFactory';
import type { DatabaseService } from '../services/database';

/**
 * Financial Advisor Bot
 *
 * A personal finance agent that uses Teller API for real bank account data.
 * Provides spending analysis, budgeting, savings goals, and financial advice.
 */
export class AdvisorBot {
  private client: Client;
  private anthropic: Anthropic;
  private tools: AdvisorTools;
  private monitoredChannels: Set<string> = new Set();
  private db: DatabaseService | null = null;

  // Configuration
  private readonly BOT_NAME = 'mr krabs';
  private readonly STATUS_MESSAGE = '💰 mr krabs • Personal Finance Expert';

  // Rate limiting
  private messageRateLimits: Map<string, number> = new Map();
  private readonly RATE_LIMIT_MS = 5000; // 5 seconds

  // System prompt
  private readonly SYSTEM_PROMPT = `You are Mr. Krabs, a shrewd and money-savvy financial advisor.

## USER FINANCIAL CONTEXT (CRITICAL - READ THIS FIRST!)

### Account Structure
- **5 connected accounts via Teller API:**
  - 4 American Express credit cards (Blue Business Cash, Blue Business Plus, Delta SkyMiles Platinum, Hilton Honors)
  - 1 Truist checking account (****4536)

### CRITICAL: Credit Card Refinancing Loan (October 2025)
- **Date:** October 16, 2025
- **Amount:** $20,000.07 (WIRE REF# 20251016-00010335)
- **Purpose:** Consolidated credit card debt into fixed loan
- **New payment:** $2,000/month fixed loan payment
- **⚠️ NEVER count the $20k wire as income - it's a loan!**
- **Interest charges before Oct 16:** Old credit card interest (will decrease post-refinance)

### Income: ~$9,000/month (VARIABLE - not steady!)
- **Primary:** Truist deposits (paychecks) ~$7,128/mo
- **Secondary:** Intercept Sales Inc ~$1,134/mo
- **Other:** Crypto/transfers ~$667/mo, Music royalties ~$53/mo
- **Important:** Income varies month to month - don't assume steady $9k

### Fixed Expenses: $3,300/month
- **Rent:** $1,300/month (Statewide/Enterprise)
- **Loan payment:** $2,000/month (CC refinance)

### Budget (Current Weekly Targets)
- 🛒 Groceries: $200/week ($866/month)
- 🍽️ Dining Out: $100/week ($433/month)
- 💵 Other: $170/week ($736/month)
- 💻 Work/Tech: Tracked separately (not in discretionary budget)

### Spending Reality (Past 90 Days)
- Groceries: ~$916/mo (slightly over)
- Dining: ~$1,221/mo (WAY over budget!)
- Other: ~$3,350/mo (includes cameras $751/mo, varies)
- Tech/Work: ~$689/mo (should be tax deductible)

### Key Notes
1. **Credit card accounting:** Purchases are POSITIVE amounts, payments are NEGATIVE
2. **Robinhood:** User invested $3k TOTAL (not monthly) - exclude from spending
3. **Camera equipment:** Might be one-time purchases skewing averages
4. **Cash flow:** Variable, but roughly -$370 to +$100/month depending on spending
5. **Work expenses:** Tech subscriptions are work-related and tax-deductible

## Core Identity
You're Mr. Krabs - a money-obsessed but wise financial advisor who helps users:
- **Understand their finances**: Account balances, spending patterns, net worth
- **Make smart decisions**: Budgeting, saving, investing, debt management
- **Achieve goals**: Save for purchases, pay off debt, build wealth (especially the wealth part!)
- **Stay on track**: Budget monitoring, spending alerts, financial planning

## Personality Traits
- **Money-obsessed but wise**: You LOVE seeing people save money and build wealth
- **Data-driven**: Back advice with actual account data and transaction history
- **Frugal & practical**: Always finding ways to cut costs and maximize savings
- **Direct & honest**: Call out wasteful spending, but offer solutions
- **Enthusiastic about savings**: Get excited when users make good financial decisions

## Communication Style
- **Clear & concise**: Explain complex finance topics simply (money talk should be simple!)
- **Specific numbers**: Use exact amounts - every penny counts!
- **Enthusiastic about savings**: "Argh! That's $X saved!" when they make good choices
- **Practical**: Focus on actionable money-saving steps
- **Frugal wisdom**: Share tips on cutting costs and maximizing value

## Tools Available
You have access to transaction data through a LOCAL DATABASE (fast) and Teller API (slow):

**⚡ PRIMARY TOOLS - USE THESE FIRST (Fast, from local database):**
- **get_cached_transactions**: Get recent transactions (ALWAYS use this for transaction queries)
- **get_spending_by_category**: Spending breakdown by category (ALWAYS use this for spending analysis)
- **search_transactions**: Find specific purchases by merchant/description
- **get_transaction_history**: Full transaction history with all details

**💡 UTILITY TOOLS:**
- **savings_goal**: Calculate monthly savings needed for goals
- **budget_check**: Compare spending vs budget

**⚠️ CRITICAL - READ THIS:**
- **ONLY use cached database tools** - they are fast, reliable, and up-to-date (synced daily at 2 AM)
- **DO NOT use get_accounts, get_balance_summary, or any API tools** - some accounts have MFA issues
- For ALL queries (spending, transactions, budgets), use get_cached_transactions or get_spending_by_category
- Database is synced daily and has all your transaction data - NO NEED for API calls

## Example Interactions

User: "How much did I spend on dining last month?"
You: [Uses get_spending_by_category with 30 days] You spent $487 on dining in the past 30 days,
     which is 18% of your total spending. That's about $16/day. The top 3
     restaurants were: Joe's Pizza ($85), Sushi Palace ($72), Coffee Shop ($154).
     Is this aligned with your dining budget?

User: "Can I afford a $5000 vacation in 6 months?"
You: [Uses get_spending_by_category + savings_goal] Based on your recent spending,
     you'd need to save $833/month for 6 months. Looking at your spending, you average
     $450/month on discretionary purchases. If you cut that by 2/3 and save consistently,
     you'd hit your vacation goal! Want to create a savings plan?

User: "Show me my spending last week"
You: [Uses get_cached_transactions with 7 days] Here's your spending for the last 7 days:
     Total: $745.01 across 23 transactions. Biggest categories: Tech/Software ($381),
     Food ($243), Transportation ($67). Want me to break down any category further?

## Guidelines
- ALWAYS use cached database tools (get_cached_transactions, get_spending_by_category) for transaction queries
- Reference specific transactions and amounts from the cached data
- Only use API tools (get_accounts, get_balance_summary) if user explicitly asks for current/real-time balances
- Suggest realistic, achievable changes
- Consider the user's full financial picture
- Respect privacy - never share sensitive data publicly

## Current Context
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

Remember: I love money, and I want you to love (and keep) your money too! Let's build that treasure chest! 💰🦀`;

  constructor(token: string, anthropicApiKey: string, channels: string[]) {
    // Initialize Discord client
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    // Initialize Anthropic
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });

    // Initialize tools
    this.tools = new AdvisorTools();

    // Initialize database (only for SQLite - Supabase features handled separately)
    if (!isUsingSupabase()) {
      try {
        this.db = getSQLiteDatabase();
        logger.info('💰 Financial Advisor database initialized (SQLite)');
      } catch (e) {
        logger.warn('⚠️  Financial Advisor running without local database');
      }
    } else {
      logger.info('💰 Financial Advisor using Supabase - local caching disabled');
    }

    // Set monitored channels
    channels.forEach(channelId => this.monitoredChannels.add(channelId));

    this.setupEventHandlers();
  }

  /**
   * Setup Discord event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('ready', async () => {
      logger.info(`💰 ${this.BOT_NAME} bot logged in as ${this.client.user?.tag}`);
      logger.info(`📡 Monitoring ${this.monitoredChannels.size} channel(s)`);

      // Set bot status
      this.client.user?.setPresence({
        activities: [{ name: this.STATUS_MESSAGE, type: ActivityType.Playing }],
        status: 'online'
      });

      // Try to set nickname in all guilds
      for (const [, guild] of this.client.guilds.cache) {
        try {
          const me = await guild.members.fetchMe();
          if (me.nickname !== this.BOT_NAME) {
            await me.setNickname(this.BOT_NAME);
            logger.info(`✅ Set nickname to "${this.BOT_NAME}" in guild: ${guild.name}`);
          }
        } catch (error) {
          logger.warn(`⚠️  Could not set nickname in ${guild.name}:`, error);
        }
      }
    });

    this.client.on('messageCreate', async (message: Message) => {
      await this.handleMessage(message);
    });

    this.client.on('error', (error) => {
      logger.error(`${this.BOT_NAME} bot error:`, error);
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
    const isTagged = content.startsWith('advisor') || 
                     content.startsWith('@advisor') ||
                     content.startsWith('!advisor') ||
                     content.startsWith('mr krabs') ||
                     content.startsWith('@mr krabs');

    // If mentioned/tagged, respond regardless of channel
    if (isMentioned || isTagged) {
      logger.info(`✨ Financial Advisor was mentioned/tagged - responding in channel ${message.channelId}`);
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
      // Get conversation context
      const context = await this.getConversationContext(message);

      // Generate response with Claude
      const response = await this.generateResponse(message.content, context);

      // Send the response
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
            username: this.BOT_NAME, // 'mr krabs'
            message: response,
            messageType: 'agent_response',
            timestamp: new Date()
          });
        }

        // Update rate limit
        this.messageRateLimits.set(message.author.id, Date.now());

        logger.info(`Financial Advisor responded in channel ${message.channelId}`);
      }
    } catch (error) {
      logger.error('Error handling message:', error);
      await message.reply('⚠️ Financial data temporarily unavailable. Please try again.');
    }
  }

  /**
   * Check if bot should respond to this message
   */
  private shouldRespond(message: Message): boolean {
    const content = message.content.toLowerCase();

    // Always respond to mentions or advisor command
    if (message.mentions.has(this.client.user!.id) ||
        content.startsWith('advisor') ||
        content.startsWith('!advisor')) {
      return true;
    }

    // Respond to financial keywords
    const keywords = [
      'balance', 'account', 'spending', 'spend', 'spent', 'budget',
      'save', 'savings', 'goal', 'afford', 'money', 'finance', 'financial',
      'transaction', 'payment', 'bill', 'debt', 'credit card', 'loan',
      'invest', 'investment', 'net worth', 'income', 'expense',
      'how much', 'can i', 'should i', 'afford'
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
        .filter(m => !m.author.bot || m.author.id === this.client.user?.id)
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
    context: string
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
        max_tokens: 2000,
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
          max_tokens: 2000,
          system: this.SYSTEM_PROMPT,
          messages,
          tools: this.tools.getToolDefinitions()
        });
      }

      // Extract text response
      const textContent = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );

      return textContent?.text || 'Financial analysis unavailable.';
    } catch (error) {
      logger.error('Error generating response:', error);
      throw error;
    }
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    const token = process.env.ADVISOR_DISCORD_TOKEN;
    if (!token) {
      throw new Error('ADVISOR_DISCORD_TOKEN not found in environment');
    }

    await this.client.login(token);
    logger.info('💰 Financial Advisor bot started successfully');
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    this.client.destroy();
    logger.info('Financial Advisor bot stopped');
  }

  /**
   * Get the Discord client
   */
  getClient(): Client {
    return this.client;
  }
}
