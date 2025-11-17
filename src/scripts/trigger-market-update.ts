#!/usr/bin/env ts-node

/**
 * Manually trigger market updates
 * Usage: ts-node src/scripts/trigger-market-update.ts [daily|close|test]
 */

import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { MarketUpdateScheduler, DEFAULT_SCHEDULE_CONFIG } from '../services/marketUpdateScheduler';
import { logger } from '../utils/logger';

dotenv.config();

async function main() {
  const mode = process.argv[2] || 'test';

  if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN not found in environment');
    process.exit(1);
  }

  if (!process.env.MARKET_UPDATES_GUILD_ID) {
    console.error('❌ MARKET_UPDATES_GUILD_ID not found in environment');
    console.error('Please set this in your .env file to your Discord server ID');
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

    const scheduler = new MarketUpdateScheduler(
      client,
      {
        ...DEFAULT_SCHEDULE_CONFIG,
        guildId: process.env.MARKET_UPDATES_GUILD_ID!,
        enabled: false // Don't start automatic scheduler
      },
      process.env.SYSTEM_NOTIFICATION_CHANNEL_ID
    );

    switch (mode) {
      case 'daily':
        logger.info('📈 Triggering daily market update...');
        await scheduler.triggerDailyUpdate();
        break;

      case 'close':
        logger.info('🔔 Triggering market close summary...');
        await scheduler.triggerMarketCloseSummary();
        break;

      case 'test':
        logger.info('🧪 Running test - fetching sample tickers...');
        const monitor = scheduler.getTickerMonitor();

        // Test with a few sample tickers
        const testTickers = ['OKLO', 'CCJ', 'DLR', 'UEC', 'FCX'];
        logger.info(`Fetching: ${testTickers.join(', ')}`);

        const data = await monitor.fetchMultipleTickers(testTickers);

        console.log('\n📊 Results:');
        for (const [symbol, ticker] of data) {
          const emoji = ticker.changePercent >= 0 ? '🟢' : '🔴';
          console.log(`${emoji} ${ticker.symbol}: $${ticker.price.toFixed(2)} (${ticker.changePercent >= 0 ? '+' : ''}${ticker.changePercent.toFixed(2)}%)`);
        }

        console.log('\n✅ Test complete! Market data is working.');
        break;

      default:
        console.error(`❌ Unknown mode: ${mode}`);
        console.error('Usage: ts-node src/scripts/trigger-market-update.ts [daily|close|test]');
        process.exit(1);
    }

    logger.info('✅ Complete! Disconnecting...');
    await client.destroy();
    process.exit(0);

  } catch (error) {
    logger.error('❌ Error:', error);
    await client.destroy();
    process.exit(1);
  }
}

main();
