import dotenv from 'dotenv';
import { AtlasBot } from './atlasBot';
import { logger, LogLevel } from '../utils/logger';
import * as http from 'http';

dotenv.config();

/**
 * Atlas Bot Standalone Entry Point
 *
 * Runs independently from the main AgentFlow bot
 */
async function main() {
  try {
    // Set log level
    const logLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    logger.setLevel(LogLevel[logLevel as keyof typeof LogLevel] || LogLevel.INFO);

    logger.info('🌏 Starting Atlas - Global Markets Expert Bot...');

    // Validate required environment variables
    const required = [
      'ATLAS_DISCORD_TOKEN',
      'ATLAS_DISCORD_CLIENT_ID',
      'ANTHROPIC_API_KEY',
      'GLOBAL_MARKETS_CHANNELS'
    ];

    for (const varName of required) {
      if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
      }
    }

    // Parse channels
    const channels = process.env.GLOBAL_MARKETS_CHANNELS!.split(',').map(ch => ch.trim());
    logger.info(`📡 Will monitor ${channels.length} channel(s):`);
    channels.forEach(ch => logger.info(`   - ${ch}`));

    // Start HTTP server FIRST for container health checks
    const port = parseInt(process.env.ATLAS_PORT || process.env.PORT || '8082');
    const server = http.createServer((req, res) => {
      if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          bot: 'Atlas',
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
    const atlas = new AtlasBot(
      process.env.ATLAS_DISCORD_TOKEN!,
      process.env.ANTHROPIC_API_KEY!,
      channels
    );

    await atlas.start();

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('🌏 Shutting down Atlas bot...');
      server.close();
      await atlas.stop();
      logger.info('✅ Atlas shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    logger.info('✅ Atlas bot is online and monitoring channels');
    logger.info('   Type messages with market keywords or mention @Atlas');
    logger.info('   Example: "btc breaking 70k thoughts?"');

  } catch (error) {
    logger.error('Failed to start Atlas bot:', error);
    process.exit(1);
  }
}

main();
