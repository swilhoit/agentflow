#!/usr/bin/env ts-node

/**
 * Migrate AgentFlow database schema to Google Cloud SQL (PostgreSQL)
 */

import { Client } from 'pg';
import { Connector } from '@google-cloud/cloud-sql-connector';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const INSTANCE_CONNECTION_NAME = 'agentflow-discord-bot:us-central1:agentflow-db';
const DB_USER = 'agentflow-user';
const DB_NAME = 'agentflow';

async function main() {
  console.log('🚀 Migrating AgentFlow database schema to Google Cloud SQL...\n');

  // Read database password from credentials file
  const credsPath = path.join(process.cwd(), 'data', '.db-credentials');
  const credentials = fs.readFileSync(credsPath, 'utf-8');
  const DB_PASSWORD = credentials.split('\n')[1].trim(); // Second line has the user password

  console.log(`📡 Connecting to Cloud SQL instance: ${INSTANCE_CONNECTION_NAME}`);

  // Initialize Cloud SQL connector
  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName: INSTANCE_CONNECTION_NAME,
    ipType: 'PUBLIC' as any, // TypeScript type issue with Cloud SQL Connector
  });

  const client = new Client({
    ...clientOpts,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  try {
    await client.connect();
    console.log('✅ Connected to Cloud SQL!\n');

    console.log('📋 Creating database schema...\n');

    // Create conversations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        message TEXT NOT NULL,
        message_type TEXT NOT NULL CHECK(message_type IN ('voice', 'text', 'agent_response')),
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )
    `);
    console.log('✅ Created conversations table');

    // Create indexes for conversations
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_guild_channel_time
                        ON conversations(guild_id, channel_id, timestamp DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_user
                        ON conversations(user_id)`);

    // Create agent_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_logs (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        log_type TEXT NOT NULL CHECK(log_type IN ('info', 'warning', 'error', 'success', 'step')),
        message TEXT NOT NULL,
        details TEXT,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created agent_logs table');

    // Create indexes for agent_logs
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_logs_agent
                        ON agent_logs(agent_id, timestamp DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_logs_task
                        ON agent_logs(task_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_logs_guild_channel
                        ON agent_logs(guild_id, channel_id)`);

    // Create agent_tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL UNIQUE,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        task_description TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')),
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        result TEXT,
        error TEXT
      )
    `);
    console.log('✅ Created agent_tasks table');

    // Create indexes for agent_tasks
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent
                        ON agent_tasks(agent_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_guild_channel
                        ON agent_tasks(guild_id, channel_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_status
                        ON agent_tasks(status, started_at DESC)`);

    // Create daily_goals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_goals (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        date TEXT NOT NULL,
        goals TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )
    `);
    console.log('✅ Created daily_goals table');

    // Create indexes for daily_goals
    await client.query(`CREATE INDEX IF NOT EXISTS idx_daily_goals_user_date
                        ON daily_goals(user_id, date DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_daily_goals_guild_date
                        ON daily_goals(guild_id, date DESC)`);

    // Create market_data table for ticker prices and performance
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_data (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        change_amount REAL NOT NULL,
        change_percent REAL NOT NULL,
        volume BIGINT,
        market_cap BIGINT,
        performance_30d REAL,
        performance_90d REAL,
        performance_365d REAL,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        date TEXT NOT NULL
      )
    `);
    console.log('✅ Created market_data table');

    // Create indexes for market_data
    await client.query(`CREATE INDEX IF NOT EXISTS idx_market_data_symbol_date
                        ON market_data(symbol, date DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_market_data_timestamp
                        ON market_data(timestamp DESC)`);

    // Create market_news table for news articles
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_news (
        id SERIAL PRIMARY KEY,
        article_id BIGINT UNIQUE NOT NULL,
        symbol TEXT NOT NULL,
        headline TEXT NOT NULL,
        summary TEXT,
        source TEXT NOT NULL,
        url TEXT NOT NULL,
        published_at TIMESTAMP NOT NULL,
        category TEXT,
        sentiment TEXT,
        is_significant BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created market_news table');

    // Create indexes for market_news
    await client.query(`CREATE INDEX IF NOT EXISTS idx_market_news_symbol
                        ON market_news(symbol, published_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_market_news_published
                        ON market_news(published_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_market_news_significant
                        ON market_news(is_significant, published_at DESC)`);

    // Create weekly_analysis table for AI-generated thesis reports
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_analysis (
        id SERIAL PRIMARY KEY,
        week_start TEXT NOT NULL,
        week_end TEXT NOT NULL,
        analysis_type TEXT NOT NULL CHECK(analysis_type IN ('thesis', 'performance', 'news')),
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        detailed_analysis TEXT NOT NULL,
        key_events TEXT,
        recommendations TEXT,
        metadata TEXT,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created weekly_analysis table');

    // Create indexes for weekly_analysis
    await client.query(`CREATE INDEX IF NOT EXISTS idx_weekly_analysis_week
                        ON weekly_analysis(week_start DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_weekly_analysis_type
                        ON weekly_analysis(analysis_type, week_start DESC)`);

    console.log('\n✅ Database schema migration complete!');
    console.log('\n📊 Database Summary:');

    // Get table counts
    const tables = ['conversations', 'agent_logs', 'agent_tasks', 'daily_goals',
                   'market_data', 'market_news', 'weekly_analysis'];

    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`   - ${table}: ${result.rows[0].count} rows`);
    }

    console.log('\n🔗 Connection Info:');
    console.log(`   Instance: ${INSTANCE_CONNECTION_NAME}`);
    console.log(`   Database: ${DB_NAME}`);
    console.log(`   User: ${DB_USER}`);
    console.log(`   Region: us-central1`);
    console.log(`   Backups: Daily at 3:00 AM UTC (7-day retention)`);

    console.log('\n✅ Cloud SQL setup complete!\n');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await client.end();
    connector.close();
  }
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
