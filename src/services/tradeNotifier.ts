import { Client, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import { logger } from '../utils/logger';
import { AlpacaTradingService, Order, Position } from './alpacaTrading';
import Alpaca from '@alpacahq/alpaca-trade-api';

export interface TradeNotification {
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  orderType: string;
  status: string;
  orderId: string;
  filledAt?: Date;
  totalValue: number;
}

export interface TradeNotifierConfig {
  discordClient: Client;
  paperTradingChannelId: string;
  liveTradingChannelId?: string;
  alpacaApiKey: string;
  alpacaSecretKey: string;
  paper?: boolean;
}

export class TradeNotifier {
  private client: Client;
  private paperChannelId: string;
  private liveChannelId?: string;
  private alpacaClient: Alpaca;
  private alpacaStream: any;
  private isPaper: boolean;
  private isConnected: boolean = false;

  constructor(config: TradeNotifierConfig) {
    this.client = config.discordClient;
    this.paperChannelId = config.paperTradingChannelId;
    this.liveChannelId = config.liveTradingChannelId;
    this.isPaper = config.paper !== false;

    const baseUrl = this.isPaper
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets';

    this.alpacaClient = new Alpaca({
      keyId: config.alpacaApiKey,
      secretKey: config.alpacaSecretKey,
      paper: this.isPaper,
      baseUrl: baseUrl
    });

    logger.info(`📊 TradeNotifier initialized for ${this.isPaper ? 'PAPER' : 'LIVE'} trading`);
  }

  /**
   * Start listening for trade updates via Alpaca websocket
   */
  async startListening(): Promise<void> {
    try {
      logger.info('🔌 Connecting to Alpaca trade updates stream...');

      // Connect to Alpaca websocket for trade updates
      this.alpacaStream = this.alpacaClient.trade_ws;

      this.alpacaStream.onConnect(() => {
        logger.info('✅ Connected to Alpaca trade updates stream');
        this.isConnected = true;
        // Subscribe to trade updates
        this.alpacaStream.subscribe(['trade_updates']);
      });

      this.alpacaStream.onDisconnect(() => {
        logger.warn('⚠️ Disconnected from Alpaca trade updates stream');
        this.isConnected = false;
      });

      this.alpacaStream.onError((err: any) => {
        logger.error('❌ Alpaca stream error:', err);
      });

      this.alpacaStream.onOrderUpdate((data: any) => {
        this.handleOrderUpdate(data);
      });

      this.alpacaStream.onStateChange((state: string) => {
        logger.info(`📡 Alpaca stream state: ${state}`);
      });

      // Connect to the stream
      this.alpacaStream.connect();

    } catch (error) {
      logger.error('Failed to start trade notifier:', error);
      throw error;
    }
  }

  /**
   * Stop listening for trade updates
   */
  stopListening(): void {
    if (this.alpacaStream) {
      this.alpacaStream.disconnect();
      this.isConnected = false;
      logger.info('🔌 Disconnected from Alpaca trade updates stream');
    }
  }

  /**
   * Handle incoming order update from Alpaca
   */
  private async handleOrderUpdate(data: any): Promise<void> {
    try {
      const event = data.event;
      const order = data.order;

      logger.info(`📬 Received order update: ${event} for ${order.symbol}`);

      // Only notify on significant events
      const notifiableEvents = ['fill', 'partial_fill', 'canceled', 'rejected', 'new'];

      if (!notifiableEvents.includes(event)) {
        return;
      }

      // Build notification
      const notification: TradeNotification = {
        symbol: order.symbol,
        side: order.side,
        qty: parseFloat(order.qty || order.filled_qty || '0'),
        price: parseFloat(order.filled_avg_price || order.limit_price || '0'),
        orderType: order.order_type || order.type,
        status: event,
        orderId: order.id,
        filledAt: order.filled_at ? new Date(order.filled_at) : undefined,
        totalValue: parseFloat(order.filled_qty || '0') * parseFloat(order.filled_avg_price || '0')
      };

      await this.sendTradeNotification(notification, event);

    } catch (error) {
      logger.error('Error handling order update:', error);
    }
  }

  /**
   * Send trade notification to Discord
   */
  async sendTradeNotification(trade: TradeNotification, event: string): Promise<void> {
    try {
      const channelId = this.isPaper ? this.paperChannelId : (this.liveChannelId || this.paperChannelId);
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased() || !('send' in channel)) {
        logger.warn(`Cannot send to channel ${channelId}`);
        return;
      }

      const embed = this.buildTradeEmbed(trade, event);
      await (channel as TextChannel).send({ embeds: [embed] });

      logger.info(`📤 Trade notification sent: ${trade.side.toUpperCase()} ${trade.qty} ${trade.symbol}`);

    } catch (error) {
      logger.error('Failed to send trade notification:', error);
    }
  }

  /**
   * Build Discord embed for trade notification
   */
  private buildTradeEmbed(trade: TradeNotification, event: string): EmbedBuilder {
    const isBuy = trade.side === 'buy';
    const color = this.getEventColor(event, isBuy);
    const emoji = this.getEventEmoji(event, isBuy);
    const title = this.getEventTitle(event, trade);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${emoji} ${title}`)
      .setDescription(`**${trade.symbol}**`)
      .addFields(
        { name: 'Side', value: trade.side.toUpperCase(), inline: true },
        { name: 'Quantity', value: trade.qty.toString(), inline: true },
        { name: 'Type', value: trade.orderType?.toUpperCase() || 'MARKET', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `${this.isPaper ? '📝 Paper' : '💰 Live'} Trading • Order ID: ${trade.orderId.slice(0, 8)}...` });

    // Add price info for filled orders
    if (event === 'fill' || event === 'partial_fill') {
      embed.addFields(
        { name: 'Fill Price', value: `$${trade.price.toFixed(2)}`, inline: true },
        { name: 'Total Value', value: `$${trade.totalValue.toFixed(2)}`, inline: true },
        { name: 'Filled At', value: trade.filledAt ? `<t:${Math.floor(trade.filledAt.getTime() / 1000)}:T>` : 'N/A', inline: true }
      );
    }

    return embed;
  }

  /**
   * Get color based on event type
   */
  private getEventColor(event: string, isBuy: boolean): number {
    switch (event) {
      case 'fill':
        return isBuy ? Colors.Green : Colors.Red;
      case 'partial_fill':
        return Colors.Yellow;
      case 'new':
        return Colors.Blue;
      case 'canceled':
        return Colors.Grey;
      case 'rejected':
        return Colors.DarkRed;
      default:
        return Colors.Default;
    }
  }

  /**
   * Get emoji based on event type
   */
  private getEventEmoji(event: string, isBuy: boolean): string {
    switch (event) {
      case 'fill':
        return isBuy ? '🟢 BUY FILLED' : '🔴 SELL FILLED';
      case 'partial_fill':
        return '🟡 PARTIAL FILL';
      case 'new':
        return '📝 ORDER PLACED';
      case 'canceled':
        return '❌ ORDER CANCELED';
      case 'rejected':
        return '⛔ ORDER REJECTED';
      default:
        return '📊';
    }
  }

  /**
   * Get title based on event
   */
  private getEventTitle(event: string, trade: TradeNotification): string {
    switch (event) {
      case 'fill':
        return `Trade Executed`;
      case 'partial_fill':
        return `Partial Fill`;
      case 'new':
        return `New Order`;
      case 'canceled':
        return `Order Canceled`;
      case 'rejected':
        return `Order Rejected`;
      default:
        return `Order Update`;
    }
  }

  /**
   * Manually notify about a trade (can be called from trading service)
   */
  async notifyTrade(order: Order, event: 'fill' | 'new' | 'canceled' | 'rejected' = 'fill'): Promise<void> {
    const notification: TradeNotification = {
      symbol: order.symbol,
      side: order.side,
      qty: order.filledQty || order.qty,
      price: order.filledAvgPrice || order.limitPrice || 0,
      orderType: order.orderType || order.type,
      status: order.status,
      orderId: order.id,
      filledAt: order.filledAt || undefined,
      totalValue: (order.filledQty || 0) * (order.filledAvgPrice || 0)
    };

    await this.sendTradeNotification(notification, event);
  }

  /**
   * Send a summary of current positions
   */
  async sendPositionsSummary(positions: Position[]): Promise<void> {
    try {
      const channelId = this.isPaper ? this.paperChannelId : (this.liveChannelId || this.paperChannelId);
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased() || !('send' in channel)) {
        return;
      }

      if (positions.length === 0) {
        await (channel as TextChannel).send('📊 **Portfolio Summary**: No open positions');
        return;
      }

      const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
      const totalPL = positions.reduce((sum, p) => sum + p.unrealizedPL, 0);
      const totalPLPercent = positions.reduce((sum, p) => sum + p.costBasis, 0) > 0
        ? (totalPL / positions.reduce((sum, p) => sum + p.costBasis, 0)) * 100
        : 0;

      const embed = new EmbedBuilder()
        .setColor(totalPL >= 0 ? Colors.Green : Colors.Red)
        .setTitle('📊 Portfolio Summary')
        .setDescription(`**${positions.length}** open positions`)
        .addFields(
          { name: 'Total Value', value: `$${totalValue.toFixed(2)}`, inline: true },
          { name: 'Unrealized P&L', value: `${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(2)}`, inline: true },
          { name: 'P&L %', value: `${totalPLPercent >= 0 ? '+' : ''}${totalPLPercent.toFixed(2)}%`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `${this.isPaper ? '📝 Paper' : '💰 Live'} Trading` });

      // Add top positions
      const topPositions = positions
        .sort((a, b) => Math.abs(b.unrealizedPL) - Math.abs(a.unrealizedPL))
        .slice(0, 5);

      const positionsList = topPositions.map(p => {
        const plEmoji = p.unrealizedPL >= 0 ? '🟢' : '🔴';
        return `${plEmoji} **${p.symbol}**: ${p.qty} @ $${p.currentPrice.toFixed(2)} (${p.unrealizedPL >= 0 ? '+' : ''}$${p.unrealizedPL.toFixed(2)})`;
      }).join('\n');

      embed.addFields({ name: 'Top Positions', value: positionsList || 'None', inline: false });

      await (channel as TextChannel).send({ embeds: [embed] });

    } catch (error) {
      logger.error('Failed to send positions summary:', error);
    }
  }

  /**
   * Check if the notifier is connected to Alpaca stream
   */
  isStreamConnected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let tradeNotifierInstance: TradeNotifier | null = null;

export function getTradeNotifier(): TradeNotifier | null {
  return tradeNotifierInstance;
}

export function initializeTradeNotifier(config: TradeNotifierConfig): TradeNotifier {
  if (tradeNotifierInstance) {
    return tradeNotifierInstance;
  }

  tradeNotifierInstance = new TradeNotifier(config);
  return tradeNotifierInstance;
}

export default TradeNotifier;
