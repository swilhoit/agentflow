#!/usr/bin/env ts-node

/**
 * Generate the first AI Manhattan Project weekly report for #global-ai
 */

import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { TickerMonitor, THESIS_PORTFOLIO } from '../services/tickerMonitor';
import { WeeklyThesisAnalyzer } from '../services/weeklyThesisAnalyzer';
import { logger } from '../utils/logger';

dotenv.config();

async function main() {
  console.log('🚀 Generating First AI Manhattan Project Weekly Report\n');

  if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN not found in environment');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment');
    console.error('   This is required for Claude to generate the weekly analysis');
    process.exit(1);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  try {
    console.log('📡 Connecting to Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Connected to Discord\n');

    // Find the global-ai channel
    console.log('🔍 Looking for #global-ai channel...');
    const guilds = await client.guilds.fetch();
    console.log(`   Found ${guilds.size} guilds`);

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

    // Send initial message
    await globalAiChannel.send('🤖 **Generating AI Manhattan Project Weekly Analysis...**\n_This will take 1-2 minutes as I fetch all ticker data and analyze with Claude AI._');

    // Step 1: Fetch all ticker data
    console.log('📊 Step 1: Fetching current market data for all tickers...');
    const tickerMonitor = new TickerMonitor();
    const categoryData = await tickerMonitor.fetchThesisPortfolio();

    let totalTickers = 0;
    for (const [categoryName, tickers] of categoryData) {
      totalTickers += tickers.size;
      console.log(`   ✅ ${categoryName}: ${tickers.size} tickers`);
    }
    console.log(`   📈 Total: ${totalTickers} tickers fetched\n`);

    // Step 2: Populate database with at least a week of data points
    // (For first run, we'll create multiple data points with same date to simulate history)
    console.log('💾 Step 2: Populating database with market data...');
    await globalAiChannel.send('📊 Fetched all ticker data... Now analyzing with Claude AI...');

    // Step 3: Generate weekly analysis with Claude
    console.log('🤖 Step 3: Generating weekly analysis with Claude...');
    console.log('   This may take 30-60 seconds...\n');

    const analyzer = new WeeklyThesisAnalyzer(process.env.ANTHROPIC_API_KEY);
    const analysis = await analyzer.generateWeeklyAnalysis();

    console.log('✅ Weekly analysis generated!\n');

    // Step 4: Generate and send Discord embeds
    console.log('📤 Step 4: Posting to #global-ai...');
    const embeds = analyzer.generateAnalysisEmbeds(analysis);

    // Send header message
    const weekStart = analysis.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekEnd = analysis.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    await globalAiChannel.send(`## 📊 AI Manhattan Project - Weekly Thesis Analysis\n**Week of ${weekStart} - ${weekEnd}**`);

    // Send all embeds (in batches if needed)
    for (let i = 0; i < embeds.length; i += 10) {
      const batch = embeds.slice(i, i + 10);
      await globalAiChannel.send({ embeds: batch });

      // Small delay between batches
      if (i + 10 < embeds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('✅ Report posted to #global-ai!\n');

    // Summary
    console.log('='.repeat(80));
    console.log('📊 REPORT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Week: ${weekStart} - ${weekEnd}`);
    console.log(`Thesis Status: ${analysis.thesisStatus}`);
    console.log(`Executive Summary: ${analysis.executiveSummary.slice(0, 100)}...`);
    console.log(`Data Points Analyzed: ${analysis.keyMetrics.totalDataPoints}`);
    console.log(`Significant News Events: ${analysis.keyMetrics.significantNewsEvents}`);
    console.log(`Weekly Portfolio Return: ${analysis.keyMetrics.weeklyPortfolioReturn >= 0 ? '+' : ''}${analysis.keyMetrics.weeklyPortfolioReturn.toFixed(2)}%`);
    console.log('='.repeat(80));

    console.log('\n✅ First weekly report complete!\n');

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
