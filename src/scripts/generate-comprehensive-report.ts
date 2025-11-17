#!/usr/bin/env ts-node

/**
 * Generate comprehensive AI Manhattan Project weekly report
 * 1. Fetches historical news (if needed)
 * 2. Fetches current market data
 * 3. Generates Claude AI analysis
 * 4. Posts full report with ticker list to #global-ai
 */

import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { TickerMonitor, THESIS_PORTFOLIO } from '../services/tickerMonitor';
import { NewsMonitor } from '../services/newsMonitor';
import { WeeklyThesisAnalyzer } from '../services/weeklyThesisAnalyzer';
import { getDatabase } from '../services/databaseFactory';
import { logger } from '../utils/logger';

dotenv.config();

async function main() {
  console.log('🚀 Generating Comprehensive AI Manhattan Project Weekly Report\n');
  console.log('='.repeat(80));

  // Verify required API keys
  if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN not found');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not found (required for Claude analysis)');
    process.exit(1);
  }

  const hasNewsKey = !!process.env.FINNHUB_API_KEY;
  if (!hasNewsKey) {
    console.log('⚠️  FINNHUB_API_KEY not found - skipping historical news fetch');
    console.log('   Get a free key at: https://finnhub.io/\n');
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  try {
    console.log('📡 Step 1: Connecting to Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Connected\n');

    // Find global-ai channel
    console.log('🔍 Step 2: Finding #global-ai channel...');
    const guilds = await client.guilds.fetch();
    let globalAiChannel: TextChannel | null = null;

    for (const [guildId, guild] of guilds) {
      const fullGuild = await client.guilds.fetch(guildId);
      const channels = await fullGuild.channels.fetch();

      for (const [channelId, channel] of channels) {
        if (channel && channel.name === 'global-ai' && channel.isTextBased()) {
          globalAiChannel = channel as TextChannel;
          console.log(`✅ Found #global-ai in ${fullGuild.name}\n`);
          break;
        }
      }
      if (globalAiChannel) break;
    }

    if (!globalAiChannel) {
      console.error('❌ Could not find #global-ai channel');
      process.exit(1);
    }

    // Notify start
    await globalAiChannel.send('🤖 **Generating Comprehensive Weekly Analysis...**\n_Fetching historical news and market data. This will take 2-3 minutes._');

    // Step 3: Fetch historical news if we have the API key
    if (hasNewsKey) {
      console.log('📰 Step 3: Fetching historical news (past 30 days)...');
      console.log('   This will take ~30 seconds due to API rate limits');

      const newsMonitor = new NewsMonitor(process.env.FINNHUB_API_KEY!);
      const allTickers = [...new Set(THESIS_PORTFOLIO.flatMap(c => c.tickers))];

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      let totalArticles = 0;

      for (let i = 0; i < allTickers.length; i++) {
        const symbol = allTickers[i];

        try {
          const news = await newsMonitor.fetchCompanyNews(symbol, startDate, endDate);

          if (news.length > 0) {
            let savedCount = 0;
            for (const article of news) {
              try {
                await newsMonitor['db'].saveMarketNews({
                  articleId: article.id,
                  symbol,
                  headline: article.headline,
                  summary: article.summary,
                  source: article.source,
                  url: article.url,
                  publishedAt: new Date(article.datetime * 1000),
                  category: article.category,
                  isSignificant: newsMonitor.isSignificantNews(article)
                });
                savedCount++;
              } catch (error) {
                // Duplicate, skip
              }
            }
            totalArticles += savedCount;
            console.log(`   [${i + 1}/${allTickers.length}] ${symbol}: ${savedCount} articles`);
          } else {
            console.log(`   [${i + 1}/${allTickers.length}] ${symbol}: 0 articles`);
          }

          // Rate limit: 1.1 seconds between calls
          if (i < allTickers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1100));
          }

        } catch (error: any) {
          console.error(`   ❌ ${symbol}: ${error.message}`);
        }
      }

      console.log(`✅ Fetched ${totalArticles} historical news articles\n`);
      await globalAiChannel.send(`📰 Collected ${totalArticles} news articles from past 30 days...`);
    } else {
      console.log('⏭️  Step 3: Skipping historical news (no API key)\n');
    }

    // Step 4: Fetch current market data
    console.log('📊 Step 4: Fetching current market data...');
    const tickerMonitor = new TickerMonitor();
    const categoryData = await tickerMonitor.fetchThesisPortfolio();

    let totalTickers = 0;
    for (const [categoryName, tickers] of categoryData) {
      totalTickers += tickers.size;
    }
    console.log(`✅ Fetched ${totalTickers} tickers\n`);

    await globalAiChannel.send('📊 Market data collected... Analyzing with Claude AI...');

    // Step 5: Generate analysis with Claude
    console.log('🤖 Step 5: Generating weekly analysis with Claude...');
    console.log('   This may take 30-60 seconds...');

    const analyzer = new WeeklyThesisAnalyzer(process.env.ANTHROPIC_API_KEY);
    const analysis = await analyzer.generateWeeklyAnalysis();

    console.log('✅ Analysis generated\n');

    // Step 6: Post comprehensive report to Discord
    console.log('📤 Step 6: Posting comprehensive report to #global-ai...');

    const weekStart = analysis.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekEnd = analysis.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Header
    await globalAiChannel.send(`## 📊 AI Manhattan Project - Comprehensive Weekly Analysis\n**Week of ${weekStart} - ${weekEnd}**\n**Data Points:** ${analysis.keyMetrics.totalDataPoints} | **News Articles:** ${analysis.keyMetrics.significantNewsEvents}`);

    // Generate embeds WITH full ticker list
    const embeds = analyzer.generateAnalysisEmbeds(analysis, true);

    console.log(`   Posting ${embeds.length} embeds...`);

    // Send all embeds in batches of 10
    for (let i = 0; i < embeds.length; i += 10) {
      const batch = embeds.slice(i, i + 10);
      await globalAiChannel.send({ embeds: batch });

      if (i + 10 < embeds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('✅ Report posted!\n');

    // Summary
    console.log('='.repeat(80));
    console.log('📊 COMPREHENSIVE REPORT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Week: ${weekStart} - ${weekEnd}`);
    console.log(`Tickers Tracked: ${totalTickers}`);
    console.log(`Market Data Points: ${analysis.keyMetrics.totalDataPoints}`);
    console.log(`News Articles: ${analysis.keyMetrics.significantNewsEvents}`);
    console.log(`Weekly Return: ${analysis.keyMetrics.weeklyPortfolioReturn >= 0 ? '+' : ''}${analysis.keyMetrics.weeklyPortfolioReturn.toFixed(2)}%`);
    console.log(`Thesis Status: ${analysis.thesisStatus}`);
    console.log('='.repeat(80));
    console.log(`\nExecutive Summary:\n${analysis.executiveSummary}`);
    console.log('='.repeat(80));

    console.log('\n✅ Comprehensive weekly report complete!\n');

    await client.destroy();
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
    await client.destroy();
    process.exit(1);
  }
}

main();
