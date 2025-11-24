#!/usr/bin/env ts-node

/**
 * Test Weekly Budget Service
 *
 * Generates a test weekly budget summary report
 */

import dotenv from 'dotenv';
import { WeeklyBudgetService } from '../src/services/weeklyBudgetService';
import { logger, LogLevel } from '../src/utils/logger';
import { Client, GatewayIntentBits } from 'discord.js';

dotenv.config();

async function main() {
  try {
    logger.setLevel(LogLevel.INFO);
    logger.info('🧪 Testing Weekly Budget Service...');

    // Get budget configuration from env
    const groceriesBudget = parseFloat(process.env.GROCERIES_BUDGET || '200');
    const diningBudget = parseFloat(process.env.DINING_BUDGET || '100');
    const otherBudget = parseFloat(process.env.OTHER_BUDGET || '170');
    const monthlyBusinessBudget = parseFloat(process.env.MONTHLY_BUSINESS_BUDGET || '500');

    // Get channel ID
    const channels = process.env.FINANCIAL_ADVISOR_CHANNELS?.split(',').map(ch => ch.trim()) || [];
    if (channels.length === 0) {
      throw new Error('FINANCIAL_ADVISOR_CHANNELS not configured');
    }

    logger.info(`📊 Budget Configuration:`);
    logger.info(`   Groceries: $${groceriesBudget}/week`);
    logger.info(`   Dining: $${diningBudget}/week`);
    logger.info(`   Other: $${otherBudget}/week`);
    logger.info(`   Business: $${monthlyBusinessBudget}/month`);
    logger.info(`   Channel: ${channels[0]}`);

    // Create service
    const weeklyBudgetService = new WeeklyBudgetService({
      groceriesBudget,
      diningBudget,
      otherBudget,
      monthlyBusinessBudget,
      channelId: channels[0],
      enabled: false // Don't start the cron scheduler
    });

    // Create Discord client
    if (!process.env.ADVISOR_DISCORD_TOKEN) {
      throw new Error('ADVISOR_DISCORD_TOKEN not configured');
    }

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    logger.info('🔌 Connecting to Discord...');
    await client.login(process.env.ADVISOR_DISCORD_TOKEN);

    logger.info('✅ Connected to Discord');
    weeklyBudgetService.setDiscordClient(client);

    // Send test summary
    logger.info('📤 Sending test weekly summary...');
    await weeklyBudgetService.triggerSummary();

    logger.info('✅ Test weekly summary sent!');
    logger.info('Check your Discord channel to see the report.');

    // Cleanup
    await client.destroy();
    process.exit(0);

  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

main();
