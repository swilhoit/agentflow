#!/usr/bin/env ts-node

/**
 * Register Finnhub webhooks for all AI Manhattan Project tickers
 *
 * You need to provide your webhook URL which should be:
 * - Production: https://your-cloud-run-url.run.app/webhooks/finnhub/news
 * - Development: Use ngrok to expose localhost:3001
 *
 * To use ngrok for development:
 * 1. Install: brew install ngrok (or download from https://ngrok.com)
 * 2. Run: ngrok http 3001
 * 3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
 * 4. Use: https://abc123.ngrok.io/webhooks/finnhub/news
 */

import axios from 'axios';
import { THESIS_PORTFOLIO } from '../services/tickerMonitor';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

const FINNHUB_API_BASE = 'https://finnhub.io/api/v1';

interface WebhookResponse {
  webhook: {
    id: string;
    url: string;
    event: string;
    symbol: string;
  }[];
}

async function promptWebhookUrl(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n🌐 Enter your webhook URL:\n   (e.g., https://your-app.run.app/webhooks/finnhub/news)\n   URL: ', (url) => {
      rl.close();
      resolve(url.trim());
    });
  });
}

async function registerWebhook(symbol: string, webhookUrl: string, apiKey: string): Promise<boolean> {
  try {
    const response = await axios.post(
      `${FINNHUB_API_BASE}/webhook/add`,
      {
        event: 'news',
        symbol,
        url: webhookUrl
      },
      {
        params: { token: apiKey }
      }
    );

    if (response.status === 200) {
      logger.info(`✅ Registered webhook for ${symbol}`);
      return true;
    } else {
      logger.error(`❌ Failed to register ${symbol}: ${response.statusText}`);
      return false;
    }
  } catch (error: any) {
    if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
      logger.info(`⚠️  Webhook for ${symbol} already exists`);
      return true;
    }
    logger.error(`❌ Error registering ${symbol}: ${error.message}`);
    return false;
  }
}

async function listWebhooks(apiKey: string): Promise<void> {
  try {
    const response = await axios.get<WebhookResponse>(
      `${FINNHUB_API_BASE}/webhook/list`,
      { params: { token: apiKey } }
    );

    if (response.data.webhook && response.data.webhook.length > 0) {
      console.log('\n📋 Currently registered webhooks:');
      console.log('='.repeat(80));
      for (const hook of response.data.webhook) {
        console.log(`${hook.symbol.padEnd(10)} | ${hook.event.padEnd(10)} | ${hook.url}`);
      }
      console.log('='.repeat(80));
    } else {
      console.log('\n📋 No webhooks currently registered');
    }
  } catch (error: any) {
    logger.error('Error listing webhooks:', error.message);
  }
}

async function deleteAllWebhooks(apiKey: string): Promise<void> {
  try {
    const response = await axios.get<WebhookResponse>(
      `${FINNHUB_API_BASE}/webhook/list`,
      { params: { token: apiKey } }
    );

    if (response.data.webhook && response.data.webhook.length > 0) {
      for (const hook of response.data.webhook) {
        try {
          await axios.post(
            `${FINNHUB_API_BASE}/webhook/delete`,
            { id: hook.id },
            { params: { token: apiKey } }
          );
          logger.info(`🗑️  Deleted webhook for ${hook.symbol}`);
        } catch (error) {
          logger.error(`Failed to delete webhook for ${hook.symbol}`);
        }
      }
    }
  } catch (error: any) {
    logger.error('Error deleting webhooks:', error.message);
  }
}

async function main() {
  console.log('🔔 Finnhub Webhook Registration for AI Manhattan Project\n');
  console.log('='.repeat(80));

  if (!process.env.FINNHUB_API_KEY) {
    console.error('❌ FINNHUB_API_KEY not found in environment');
    process.exit(1);
  }

  if (!process.env.FINNHUB_WEBHOOK_SECRET) {
    console.error('❌ FINNHUB_WEBHOOK_SECRET not found in environment');
    process.exit(1);
  }

  const apiKey = process.env.FINNHUB_API_KEY;

  // Show current webhooks
  await listWebhooks(apiKey);

  // Get webhook URL from user
  const webhookUrl = await promptWebhookUrl();

  if (!webhookUrl.startsWith('http')) {
    console.error('❌ Invalid URL. Must start with http:// or https://');
    process.exit(1);
  }

  console.log(`\n📍 Using webhook URL: ${webhookUrl}`);
  console.log(`🔐 Using webhook secret: ${process.env.FINNHUB_WEBHOOK_SECRET}\n`);

  // Get all unique tickers
  const allTickers = THESIS_PORTFOLIO.flatMap(category => category.tickers);
  const uniqueTickers = [...new Set(allTickers)];

  console.log(`📊 Registering webhooks for ${uniqueTickers.length} tickers...\n`);

  let successCount = 0;
  let failureCount = 0;

  for (const symbol of uniqueTickers) {
    const success = await registerWebhook(symbol, webhookUrl, apiKey);
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 WEBHOOK REGISTRATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tickers: ${uniqueTickers.length}`);
  console.log(`Successfully Registered: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  console.log(`Webhook URL: ${webhookUrl}`);
  console.log(`Webhook Secret: ${process.env.FINNHUB_WEBHOOK_SECRET}`);
  console.log('='.repeat(80));

  // Show final list of webhooks
  console.log('\n📋 Final webhook list:');
  await listWebhooks(apiKey);

  console.log('\n✅ Webhook registration complete!');
  console.log('\n💡 Next steps:');
  console.log('   1. Start your bot: npm start');
  console.log('   2. Monitor #global-ai for real-time news notifications');
  console.log('   3. Watch logs for incoming webhook events\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
