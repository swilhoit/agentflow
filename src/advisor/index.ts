import dotenv from 'dotenv';
import { AdvisorBot } from './advisorBot';
import { logger, LogLevel } from '../utils/logger';
import * as http from 'http';
import { TransactionSyncService } from '../services/transactionSyncService';

dotenv.config();

/**
 * Financial Advisor Bot Standalone Entry Point
 *
 * Runs independently from other bots
 */
async function main() {
  try {
    // Set log level
    const logLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    logger.setLevel(LogLevel[logLevel as keyof typeof LogLevel] || LogLevel.INFO);

    logger.info('💰 Starting mr krabs - Personal Finance Expert...');

    // Validate required environment variables
    const required = [
      'ADVISOR_DISCORD_TOKEN',
      'ADVISOR_DISCORD_CLIENT_ID',
      'ANTHROPIC_API_KEY',
      'FINANCIAL_ADVISOR_CHANNELS',
      'TELLER_API_TOKEN'
    ];

    for (const varName of required) {
      if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
      }
    }

    // Parse channels
    const channels = process.env.FINANCIAL_ADVISOR_CHANNELS!.split(',').map(ch => ch.trim());
    logger.info(`📡 Will monitor ${channels.length} channel(s):`);
    channels.forEach(ch => logger.info(`   - ${ch}`));

    // Start HTTP server FIRST for Cloud Run health checks
    const port = parseInt(process.env.ADVISOR_PORT || process.env.PORT || '8081');
    const server = http.createServer((req, res) => {
      if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          bot: 'mr krabs',
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        logger.info(`🌐 Health check server listening on port ${port}`);
        resolve();
      });
    });

    // Now start Discord bot
    const advisor = new AdvisorBot(
      process.env.ADVISOR_DISCORD_TOKEN!,
      process.env.ANTHROPIC_API_KEY!,
      channels
    );

    await advisor.start();

    // Start Transaction Sync Service
    logger.info('📊 Initializing Transaction Sync Service...');
    const transactionSync = new TransactionSyncService({
      enabled: true,
      cronExpression: '0 2 * * *', // 2:00 AM daily
      timezone: 'America/Los_Angeles',
      daysToSync: 90
    });

    // Run initial sync
    logger.info('🔄 Running initial transaction sync...');
    const initialSync = await transactionSync.triggerSync();
    if (initialSync.success) {
      logger.info('✅ Initial transaction sync completed');
      if (initialSync.stats) {
        logger.info(`   Synced ${initialSync.stats.totalTransactions} transactions from ${initialSync.stats.accounts} accounts`);
      }
    } else {
      logger.warn(`⚠️  Initial sync failed: ${initialSync.message}`);
    }

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('💰 Shutting down Financial Advisor bot...');
      transactionSync.stop();
      server.close();
      await advisor.stop();
      logger.info('✅ Financial Advisor shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    logger.info('✅ Financial Advisor bot is online and monitoring channels');
    logger.info('   Ask about balances, spending, budgets, or savings goals!');
    logger.info('   Transactions sync daily at 2:00 AM PST');

  } catch (error) {
    logger.error('Failed to start Financial Advisor bot:', error);
    process.exit(1);
  }
}

main();
