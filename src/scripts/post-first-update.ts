#!/usr/bin/env ts-node

/**
 * Post the first AI Manhattan Project market update to global-ai channel
 */

import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { TickerMonitor, THESIS_PORTFOLIO } from '../services/tickerMonitor';
import { logger } from '../utils/logger';

dotenv.config();

async function main() {
  if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN not found in environment');
    process.exit(1);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  try {
    logger.info('Connecting to Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    logger.info('✅ Connected to Discord');

    // Find the global-ai channel
    const guilds = await client.guilds.fetch();
    logger.info(`Found ${guilds.size} guilds`);

    let globalAiChannel = null;
    for (const [guildId, guild] of guilds) {
      const fullGuild = await client.guilds.fetch(guildId);
      const channels = await fullGuild.channels.fetch();

      for (const [channelId, channel] of channels) {
        if (channel && channel.name === 'global-ai' && channel.isTextBased()) {
          globalAiChannel = channel;
          logger.info(`✅ Found #global-ai in ${fullGuild.name}`);
          break;
        }
      }

      if (globalAiChannel) break;
    }

    if (!globalAiChannel) {
      logger.error('❌ Could not find #global-ai channel');
      process.exit(1);
    }

    // Send intro message
    await globalAiChannel.send(`🚀 **AI Manhattan Project Market Tracker - ONLINE**

I'll be monitoring your thesis portfolio with:
• 📊 **Daily updates** at 9 AM ET (market open)
• 🔔 **Market close summaries** at 4:05 PM ET
• 📰 **Hourly news monitoring** during market hours
• 📈 **Historical performance tracking** (30/90/365 day)

Let me fetch some sample tickers to show you what's coming...`);

    // Create ticker monitor
    const monitor = new TickerMonitor();

    logger.info('Fetching sample tickers...');
    const sampleTickers = ['OKLO', 'CCJ', 'DLR', 'UEC', 'FCX'];
    const data = await monitor.fetchMultipleTickers(sampleTickers);

    if (data.size === 0) {
      await globalAiChannel.send('⚠️ Having trouble fetching live data right now. Will try again at 9 AM ET!');
      logger.warn('No ticker data retrieved');
    } else {
      // Generate and send embeds
      const sampleCategory = new Map([['Sample Data', data]]);
      const embeds = monitor.generateDailySummaryEmbed(sampleCategory);

      // Send first embed
      if (embeds.length > 0) {
        await globalAiChannel.send({ embeds: [embeds[0]] });
      }

      // Show one sample ticker with historical data
      let hasHistorical = false;
      for (const [symbol, ticker] of data) {
        if (ticker.performance30d !== undefined) {
          hasHistorical = true;
          const p30 = ticker.performance30d >= 0 ? `+${ticker.performance30d.toFixed(1)}%` : `${ticker.performance30d.toFixed(1)}%`;
          const p90 = ticker.performance90d !== undefined ? (ticker.performance90d >= 0 ? `+${ticker.performance90d.toFixed(1)}%` : `${ticker.performance90d.toFixed(1)}%`) : 'N/A';
          const p365 = ticker.performance365d !== undefined ? (ticker.performance365d >= 0 ? `+${ticker.performance365d.toFixed(1)}%` : `${ticker.performance365d.toFixed(1)}%`) : 'N/A';

          await globalAiChannel.send(`📈 **Sample: ${ticker.symbol}**
Current: $${ticker.price.toFixed(2)} (${ticker.changePercent >= 0 ? '+' : ''}${ticker.changePercent.toFixed(2)}%)
30d: ${p30} | 90d: ${p90} | 1y: ${p365}`);
          break;
        }
      }

      if (!hasHistorical) {
        logger.info('Sample data loaded without historical performance');
      }
    }

    // Final message
    await globalAiChannel.send(`✅ **Setup Complete!**

Your full AI Manhattan Project portfolio will be tracked automatically:
${THESIS_PORTFOLIO.map(cat => `• ${cat.name}: ${cat.tickers.length} tickers`).join('\n')}

**Total: ${THESIS_PORTFOLIO.reduce((sum, cat) => sum + cat.tickers.length, 0)} tickers across 7 categories**

See you at 9 AM ET for the first full update! 📊`);

    logger.info('✅ First update posted successfully!');
    await client.destroy();
    process.exit(0);

  } catch (error) {
    logger.error('❌ Error:', error);
    await client.destroy();
    process.exit(1);
  }
}

main();
