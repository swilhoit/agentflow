import { NewsMonitor, NewsArticle } from './newsMonitor';
import { THESIS_PORTFOLIO } from './tickerMonitor';
import { logger } from '../utils/logger';
import { Client, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import crypto from 'crypto';
import { PriceImpactTracker } from './priceImpactTracker';

export interface FinnhubWebhookPayload {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image?: string;
  related: string; // ticker symbol
  source: string;
  summary: string;
  url: string;
}

export interface FinnhubWebhookEvent {
  data: FinnhubWebhookPayload[];
  event: string;
}

/**
 * Finnhub Webhook Handler Service
 * Receives real-time news events from Finnhub webhooks
 */
export class FinnhubWebhookService {
  private newsMonitor: NewsMonitor;
  private priceImpactTracker: PriceImpactTracker;
  private discordClient?: Client;
  private webhookSecret: string;
  private trackedTickers: Set<string>;

  constructor(apiKey: string, webhookSecret: string) {
    this.newsMonitor = new NewsMonitor(apiKey);
    this.priceImpactTracker = new PriceImpactTracker();
    this.webhookSecret = webhookSecret;

    // Build set of tracked tickers for fast lookup
    this.trackedTickers = new Set(
      THESIS_PORTFOLIO.flatMap(category => category.tickers)
    );

    logger.info(`🔔 Finnhub Webhook Service initialized for ${this.trackedTickers.size} tickers`);
  }

  /**
   * Set Discord client for posting real-time news notifications
   */
  setDiscordClient(client: Client): void {
    this.discordClient = client;
  }

  /**
   * Validate webhook signature
   */
  validateSignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    logger.info(`Webhook signature validation:`);
    logger.info(`  Received: ${signature}`);
    logger.info(`  Expected: ${expectedSignature}`);
    logger.info(`  Match: ${signature === expectedSignature}`);

    return signature === expectedSignature;
  }

  /**
   * Handle incoming webhook event from Finnhub
   */
  async handleWebhookEvent(event: FinnhubWebhookEvent): Promise<void> {
    try {
      logger.info(`🔔 Received ${event.data.length} news items from Finnhub webhook`);

      for (const newsItem of event.data) {
        // Only process news for tracked tickers
        if (!this.trackedTickers.has(newsItem.related)) {
          logger.debug(`Skipping news for untracked ticker: ${newsItem.related}`);
          continue;
        }

        // Convert to NewsArticle format
        const article: NewsArticle = {
          id: newsItem.id,
          category: newsItem.category,
          datetime: newsItem.datetime,
          headline: newsItem.headline,
          image: newsItem.image,
          related: newsItem.related,
          source: newsItem.source,
          summary: newsItem.summary,
          url: newsItem.url
        };

        // Check if significant
        const isSignificant = this.newsMonitor.isSignificantNews(article);

        // Save to database
        try {
          await this.newsMonitor['db'].saveMarketNews({
            articleId: article.id,
            symbol: article.related,
            headline: article.headline,
            summary: article.summary,
            source: article.source,
            url: article.url,
            publishedAt: new Date(article.datetime * 1000),
            category: article.category,
            isSignificant
          });

          logger.info(`💾 Saved news for ${article.related}: ${article.headline.substring(0, 60)}...`);
        } catch (error: any) {
          if (error.message?.includes('UNIQUE constraint')) {
            logger.debug(`Duplicate news article ${article.id}, skipping`);
            continue;
          }
          throw error;
        }

        // Start price impact tracking if significant
        if (isSignificant) {
          // Post to Discord with initial price
          if (this.discordClient) {
            await this.postToDiscord(article);
          }

          // Start tracking price impact in the background
          // Pass callback to post updates to Discord
          this.priceImpactTracker.startTracking(
            article.id,
            article.related,
            new Date(article.datetime * 1000),
            // Callback for posting price updates to Discord
            async (impactId: number, symbol: string, interval: string) => {
              await this.postPriceUpdate(article.id, symbol, interval);
            }
          ).catch(error => {
            logger.error(`Error starting price impact tracking for ${article.related}:`, error);
          });
        }
      }

    } catch (error) {
      logger.error('Error handling Finnhub webhook event:', error);
      throw error;
    }
  }

  /**
   * Find #global-ai channel
   */
  private async findGlobalAiChannel(): Promise<TextChannel | null> {
    if (!this.discordClient) {
      return null;
    }

    try {
      const guilds = await this.discordClient.guilds.fetch();

      for (const [guildId, guild] of guilds) {
        const fullGuild = await this.discordClient.guilds.fetch(guildId);
        const channels = await fullGuild.channels.fetch();

        for (const [channelId, channel] of channels) {
          if (channel && channel.name === 'global-ai' && channel.isTextBased()) {
            return channel as TextChannel;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Error finding #global-ai channel:', error);
      return null;
    }
  }

  /**
   * Post significant news to Discord #global-ai channel
   */
  private async postToDiscord(article: NewsArticle): Promise<void> {
    if (!this.discordClient) {
      logger.warn('Discord client not set, skipping notification');
      return;
    }

    try {
      const globalAiChannel = await this.findGlobalAiChannel();
      if (!globalAiChannel) {
        logger.warn('Could not find #global-ai channel for news notification');
        return;
      }

      // Get initial price impact data to show current price
      const impact = await this.priceImpactTracker.getImpactForArticle(article.id);

      // Create embed for news
      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle(`📰 ${article.related} | ${article.headline}`)
        .setDescription(article.summary || 'No summary available')
        .addFields(
          { name: 'Source', value: article.source, inline: true },
          { name: 'Time', value: new Date(article.datetime * 1000).toLocaleString(), inline: true }
        )
        .setURL(article.url);

      // Add current price if available
      if (impact?.priceBeforeNews) {
        embed.addFields({
          name: '📍 Current Price',
          value: `$${impact.priceBeforeNews.toFixed(2)}`,
          inline: true
        });
        embed.setFooter({ text: '⏱️ Tracking price impact: 5min, 15min, 30min, 1hr, 1day' });
      }

      if (article.image) {
        embed.setThumbnail(article.image);
      }

      await globalAiChannel.send({ embeds: [embed] });
      logger.info(`📤 Posted significant news to #global-ai: ${article.related}`);

    } catch (error) {
      logger.error('Error posting news to Discord:', error);
    }
  }

  /**
   * Post price impact update to Discord
   */
  private async postPriceUpdate(articleId: number, symbol: string, interval: string): Promise<void> {
    if (!this.discordClient) {
      return;
    }

    try {
      const globalAiChannel = await this.findGlobalAiChannel();
      if (!globalAiChannel) {
        logger.warn('Could not find #global-ai channel for price update');
        return;
      }

      // Get price impact data
      const impact = await this.priceImpactTracker.getImpactForArticle(articleId);
      if (!impact) {
        logger.warn(`No price impact data found for article ${articleId}`);
        return;
      }

      // Only post updates for 1 hour and 1 day intervals (to avoid spam)
      if (interval !== '1hour' && interval !== '1day') {
        return;
      }

      // Determine emoji and color based on impact
      let emoji = '📊';
      let color: number = Colors.Blue;
      let priceChange = 0;

      if (interval === '1hour' && impact.priceAfter1Hour) {
        priceChange = ((impact.priceAfter1Hour - impact.priceBeforeNews) / impact.priceBeforeNews) * 100;
      } else if (interval === '1day' && impact.priceAfter1Day) {
        priceChange = ((impact.priceAfter1Day - impact.priceBeforeNews) / impact.priceBeforeNews) * 100;
      }

      if (priceChange > 0) {
        emoji = '📈';
        color = Colors.Green;
      } else if (priceChange < 0) {
        emoji = '📉';
        color = Colors.Red;
      }

      // Create embed for price update
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} ${symbol} Price Impact Update (${interval === '1hour' ? '1 Hour' : '1 Day'})`)
        .setTimestamp();

      // Add price fields based on interval
      embed.addFields({
        name: '📍 Price at News Time',
        value: `$${impact.priceBeforeNews.toFixed(2)}`,
        inline: true
      });

      if (interval === '1hour' && impact.priceAfter1Hour) {
        embed.addFields(
          {
            name: '💰 Price After 1 Hour',
            value: `$${impact.priceAfter1Hour.toFixed(2)}`,
            inline: true
          },
          {
            name: '📊 Impact',
            value: `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`,
            inline: true
          }
        );

        // Add volume spike if available
        if (impact.volumeSpike !== undefined && impact.volumeSpike !== null) {
          embed.addFields({
            name: '📦 Volume Spike',
            value: `${impact.volumeSpike >= 0 ? '+' : ''}${impact.volumeSpike.toFixed(0)}%`,
            inline: true
          });
        }
      } else if (interval === '1day' && impact.priceAfter1Day) {
        embed.addFields(
          {
            name: '💰 Price After 1 Day',
            value: `$${impact.priceAfter1Day.toFixed(2)}`,
            inline: true
          },
          {
            name: '🎯 Total Impact',
            value: `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`,
            inline: true
          }
        );

        // Add summary of all intervals
        const priceHistory: string[] = [];
        if (impact.priceAfter5Min) {
          const change = ((impact.priceAfter5Min - impact.priceBeforeNews) / impact.priceBeforeNews) * 100;
          priceHistory.push(`5min: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`);
        }
        if (impact.priceAfter15Min) {
          const change = ((impact.priceAfter15Min - impact.priceBeforeNews) / impact.priceBeforeNews) * 100;
          priceHistory.push(`15min: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`);
        }
        if (impact.priceAfter30Min) {
          const change = ((impact.priceAfter30Min - impact.priceBeforeNews) / impact.priceBeforeNews) * 100;
          priceHistory.push(`30min: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`);
        }
        if (impact.priceAfter1Hour) {
          const change = ((impact.priceAfter1Hour - impact.priceBeforeNews) / impact.priceBeforeNews) * 100;
          priceHistory.push(`1hr: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`);
        }

        if (priceHistory.length > 0) {
          embed.addFields({
            name: '📈 Price History',
            value: priceHistory.join(' • '),
            inline: false
          });
        }
      }

      await globalAiChannel.send({ embeds: [embed] });
      logger.info(`📤 Posted ${interval} price update for ${symbol}`);

    } catch (error) {
      logger.error(`Error posting price update for ${symbol}:`, error);
    }
  }
}
