#!/usr/bin/env ts-node

/**
 * Fetch historical news for all AI Manhattan Project tickers
 * Populates database with last 30 days of news for better context
 */

import { NewsMonitor } from '../services/newsMonitor';
import { THESIS_PORTFOLIO } from '../services/tickerMonitor';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('📰 Fetching Historical News for AI Manhattan Project Tickers\n');

  if (!process.env.FINNHUB_API_KEY) {
    console.error('❌ FINNHUB_API_KEY not found in environment');
    console.error('   Get a free API key at: https://finnhub.io/');
    process.exit(1);
  }

  const newsMonitor = new NewsMonitor(process.env.FINNHUB_API_KEY);

  // Get all unique tickers
  const allTickers = THESIS_PORTFOLIO.flatMap(category => category.tickers);
  const uniqueTickers = [...new Set(allTickers)];

  console.log(`📊 Total tickers to fetch news for: ${uniqueTickers.length}\n`);

  // Date range: last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);

  let totalArticles = 0;
  let significantArticles = 0;
  const tickerStats: { [key: string]: number } = {};

  // Fetch news for each ticker
  for (let i = 0; i < uniqueTickers.length; i++) {
    const symbol = uniqueTickers[i];

    try {
      console.log(`[${i + 1}/${uniqueTickers.length}] Fetching news for ${symbol}...`);

      const news = await newsMonitor.fetchCompanyNews(symbol, startDate, endDate);

      if (news.length > 0) {
        console.log(`   ✅ Found ${news.length} articles`);

        // Save to database
        let savedCount = 0;
        let significantCount = 0;

        for (const article of news) {
          try {
            const isSignificant = newsMonitor.isSignificantNews(article);

            await newsMonitor['db'].saveMarketNews({
              articleId: article.id,
              symbol,
              headline: article.headline,
              summary: article.summary,
              source: article.source,
              url: article.url,
              publishedAt: new Date(article.datetime * 1000),
              category: article.category,
              isSignificant
            });

            savedCount++;
            if (isSignificant) significantCount++;

          } catch (error) {
            // Likely a duplicate, skip silently
            logger.debug(`Skipped duplicate article ${article.id}`);
          }
        }

        console.log(`   💾 Saved ${savedCount} new articles (${significantCount} significant)`);

        totalArticles += savedCount;
        significantArticles += significantCount;
        tickerStats[symbol] = savedCount;

      } else {
        console.log(`   ⚠️  No articles found`);
        tickerStats[symbol] = 0;
      }

      // Rate limiting: Finnhub free tier allows 60 calls/min
      // Wait 1.1 seconds between calls to stay under limit
      if (i < uniqueTickers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1100));
      }

    } catch (error: any) {
      console.error(`   ❌ Error fetching news for ${symbol}: ${error.message}`);
      tickerStats[symbol] = 0;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 HISTORICAL NEWS FETCH SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Articles Saved: ${totalArticles}`);
  console.log(`Significant Articles: ${significantArticles}`);
  console.log(`Date Range: Last 30 days`);
  console.log('='.repeat(80));

  console.log('\n📈 Articles by Category:\n');

  for (const category of THESIS_PORTFOLIO) {
    const categoryArticles = category.tickers.reduce((sum, ticker) => sum + (tickerStats[ticker] || 0), 0);
    console.log(`${category.name}`);
    console.log(`   Total: ${categoryArticles} articles`);

    for (const ticker of category.tickers) {
      const count = tickerStats[ticker] || 0;
      if (count > 0) {
        console.log(`   - ${ticker}: ${count} articles`);
      }
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('✅ Historical news fetch complete!\n');
  console.log('💡 Next steps:');
  console.log('   1. Run: npx ts-node src/scripts/generate-comprehensive-report.ts');
  console.log('   2. Check #global-ai for the full weekly analysis\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
