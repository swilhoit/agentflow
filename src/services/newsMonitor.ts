// @ts-ignore - No types available for finnhub package
import finnhub from 'finnhub';
import { logger } from '../utils/logger';
import { EmbedBuilder, Colors } from 'discord.js';
import { getDatabase } from './databaseFactory';

export interface NewsArticle {
  id: number;
  category: string;
  datetime: number;
  headline: string;
  image?: string;
  related: string; // ticker symbol
  source: string;
  summary: string;
  url: string;
}

export interface NewsSentiment {
  symbol: string;
  sentiment: {
    bullishPercent: number;
    bearishPercent: number;
  };
  buzz: {
    articlesInLastWeek: number;
    weeklyAverage: number;
  };
}

/**
 * News Monitoring Service using Finnhub API
 */
export class NewsMonitor {
  private client: any;
  private lastCheckTime: Map<string, number> = new Map(); // symbol -> timestamp
  private seenArticles: Set<number> = new Set(); // Track article IDs to avoid duplicates
  private readonly MAX_SEEN_ARTICLES = 1000; // Limit memory usage
  private db = getDatabase();

  constructor(apiKey: string) {
    this.client = new finnhub.DefaultApi(apiKey);
  }

  /**
   * Fetch company news for a ticker
   */
  async fetchCompanyNews(
    symbol: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<NewsArticle[]> {
    try {
      const from = fromDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours
      const to = toDate || new Date();

      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];

      logger.info(`Fetching news for ${symbol} from ${fromStr} to ${toStr}`);

      return new Promise((resolve, reject) => {
        this.client.companyNews(symbol, fromStr, toStr, (error: any, data: any) => {
          if (error) {
            logger.error(`Error fetching news for ${symbol}:`, error);
            reject(error);
          } else {
            resolve(data || []);
          }
        });
      });
    } catch (error: any) {
      logger.error(`Failed to fetch news for ${symbol}:`, error.message);
      return [];
    }
  }

  /**
   * Fetch general market news
   */
  async fetchMarketNews(category: string = 'general'): Promise<NewsArticle[]> {
    try {
      logger.info(`Fetching market news for category: ${category}`);

      return new Promise((resolve, reject) => {
        this.client.marketNews(category, (error: any, data: any) => {
          if (error) {
            logger.error(`Error fetching market news:`, error);
            reject(error);
          } else {
            resolve(data || []);
          }
        });
      });
    } catch (error: any) {
      logger.error(`Failed to fetch market news:`, error.message);
      return [];
    }
  }

  /**
   * Fetch news sentiment for a ticker
   */
  async fetchNewsSentiment(symbol: string): Promise<NewsSentiment | null> {
    try {
      logger.info(`Fetching news sentiment for ${symbol}`);

      return new Promise((resolve, reject) => {
        this.client.newsSentiment(symbol, (error: any, data: any) => {
          if (error) {
            logger.error(`Error fetching sentiment for ${symbol}:`, error);
            resolve(null);
          } else {
            resolve(data || null);
          }
        });
      });
    } catch (error: any) {
      logger.error(`Failed to fetch sentiment for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Check for new news articles since last check
   */
  async checkForNewNews(symbols: string[]): Promise<Map<string, NewsArticle[]>> {
    const newsBySymbol = new Map<string, NewsArticle[]>();

    for (const symbol of symbols) {
      try {
        const lastCheck = this.lastCheckTime.get(symbol) || Date.now() - 60 * 60 * 1000; // Default: last hour
        const fromDate = new Date(lastCheck);
        const toDate = new Date();

        const news = await this.fetchCompanyNews(symbol, fromDate, toDate);

        // Filter out articles we've already seen
        const newArticles = news.filter(article => {
          if (this.seenArticles.has(article.id)) {
            return false;
          }
          this.seenArticles.add(article.id);
          return true;
        });

        if (newArticles.length > 0) {
          newsBySymbol.set(symbol, newArticles);
          logger.info(`Found ${newArticles.length} new articles for ${symbol}`);

          // Save articles to database
          for (const article of newArticles) {
            try {
              this.db.saveMarketNews({
                articleId: article.id,
                symbol,
                headline: article.headline,
                summary: article.summary,
                source: article.source,
                url: article.url,
                publishedAt: new Date(article.datetime * 1000),
                category: article.category,
                isSignificant: this.isSignificantNews(article)
              });
            } catch (error) {
              logger.warn(`Failed to save news article ${article.id} to database:`, error);
            }
          }
        }

        // Update last check time
        this.lastCheckTime.set(symbol, toDate.getTime());

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        logger.error(`Error checking news for ${symbol}:`, error.message);
      }
    }

    // Clean up seen articles if too many
    if (this.seenArticles.size > this.MAX_SEEN_ARTICLES) {
      const articlesToRemove = this.seenArticles.size - this.MAX_SEEN_ARTICLES;
      const iterator = this.seenArticles.values();
      for (let i = 0; i < articlesToRemove; i++) {
        const value = iterator.next().value;
        if (value !== undefined) {
          this.seenArticles.delete(value);
        }
      }
    }

    return newsBySymbol;
  }

  /**
   * Generate Discord embed for a news article
   */
  generateNewsEmbed(article: NewsArticle, sentiment?: NewsSentiment): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle(article.headline.slice(0, 256))
      .setDescription(article.summary.slice(0, 4096))
      .setURL(article.url)
      .setTimestamp(article.datetime * 1000);

    if (article.image) {
      embed.setThumbnail(article.image);
    }

    embed.addFields({
      name: 'Source',
      value: `${article.source} | ${article.related}`,
      inline: true
    });

    if (sentiment) {
      const sentimentColor = sentiment.sentiment.bullishPercent > sentiment.sentiment.bearishPercent ? '🟢' : '🔴';
      const sentimentText = `${sentimentColor} ${sentiment.sentiment.bullishPercent.toFixed(0)}% Bullish / ${sentiment.sentiment.bearishPercent.toFixed(0)}% Bearish`;

      embed.addFields({
        name: 'Market Sentiment',
        value: sentimentText,
        inline: true
      });

      embed.addFields({
        name: 'Buzz',
        value: `${sentiment.buzz.articlesInLastWeek} articles this week`,
        inline: true
      });
    }

    embed.setFooter({ text: 'Powered by Finnhub' });

    return embed;
  }

  /**
   * Generate summary of multiple news articles
   */
  generateNewsSummary(newsBySymbol: Map<string, NewsArticle[]>): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle('📰 AI Manhattan Project News Digest')
      .setDescription('Latest news affecting your thesis portfolio')
      .setTimestamp();

    let hasNews = false;

    for (const [symbol, articles] of newsBySymbol) {
      if (articles.length === 0) continue;

      hasNews = true;

      // Show top 3 most recent articles per symbol
      const topArticles = articles.slice(0, 3);
      const articlesList = topArticles
        .map(a => `• [${a.headline.slice(0, 80)}...](${a.url})`)
        .join('\n');

      embed.addFields({
        name: `${symbol} (${articles.length} new ${articles.length === 1 ? 'article' : 'articles'})`,
        value: articlesList,
        inline: false
      });
    }

    if (!hasNews) {
      embed.setDescription('No new articles since last check');
    }

    embed.setFooter({ text: 'Powered by Finnhub' });

    return embed;
  }

  /**
   * Determine if news is significant (for alerting)
   */
  isSignificantNews(article: NewsArticle): boolean {
    const significantKeywords = [
      'merger', 'acquisition', 'buyout', 'deal',
      'earnings', 'revenue', 'profit', 'loss',
      'contract', 'award', 'partnership',
      'fda', 'approval', 'recall',
      'bankruptcy', 'lawsuit', 'investigation',
      'breakthrough', 'discovery', 'innovation',
      'nuclear', 'uranium', 'reactor', 'energy',
      'data center', 'ai infrastructure'
    ];

    const headlineLower = article.headline.toLowerCase();
    const summaryLower = article.summary.toLowerCase();

    return significantKeywords.some(keyword =>
      headlineLower.includes(keyword) || summaryLower.includes(keyword)
    );
  }

  /**
   * Reset last check times (for testing)
   */
  resetCheckTimes(): void {
    this.lastCheckTime.clear();
    logger.info('Reset news check times');
  }

  /**
   * Clear seen articles cache
   */
  clearSeenArticles(): void {
    this.seenArticles.clear();
    logger.info('Cleared seen articles cache');
  }
}
