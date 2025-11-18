#!/usr/bin/env tsx

/**
 * View Message Logs
 * 
 * View recent conversations from all agents in the database
 */

import { getSQLiteDatabase } from '../src/services/databaseFactory';
import { logger } from '../src/utils/logger';

async function viewMessageLogs() {
  const db = getSQLiteDatabase();

  console.log('💬 Recent Message Logs\n');
  console.log('='.repeat(100));

  // Get recent messages
  const messages = db.getRecentMessages(50);

  if (messages.length === 0) {
    console.log('\n⚠️  No messages found in database');
    return;
  }

  console.log(`\nShowing ${messages.length} most recent message(s):\n`);

  messages.forEach((msg: any, index: number) => {
    const time = new Date(msg.timestamp).toLocaleString();
    const messagePreview = msg.message.length > 100 
      ? msg.message.substring(0, 100) + '...' 
      : msg.message;
    
    console.log(`${index + 1}. [${time}] ${msg.username}`);
    console.log(`   Type: ${msg.message_type}`);
    console.log(`   Message: ${messagePreview}`);
    console.log('');
  });

  // Show stats by agent
  console.log('='.repeat(100));
  console.log('\n📊 Message Stats by Agent:\n');

  const stmt = db.prepare(`
    SELECT username, COUNT(*) as count 
    FROM conversations 
    GROUP BY username 
    ORDER BY count DESC
  `);
  const stats = stmt.all();

  stats.forEach((stat: any) => {
    console.log(`${stat.username}: ${stat.count} messages`);
  });

  // Show agents that have responded
  console.log('\n✅ Agents with messages in database:');
  const agents = stats
    .filter((s: any) => s.username !== 'sam5d' && s.username !== 'agents#4032')
    .map((s: any) => s.username);
  
  if (agents.length > 0) {
    agents.forEach((agent: string) => console.log(`   - ${agent}`));
  } else {
    console.log('   ⚠️  Only user messages found, no agent responses logged!');
  }

  // Check for specific agents
  console.log('\n🔍 Agent Detection:');
  const hasOrchestrator = stats.some((s: any) => 
    s.username.toLowerCase().includes('agent') || 
    s.username === 'AgentFlow Bot' ||
    s.username === 'TaskAgent'
  );
  const hasAtlas = stats.some((s: any) => s.username === 'Atlas' || s.username === 'atlas');
  const hasAdvisor = stats.some((s: any) => 
    s.username === 'mr krabs' || 
    s.username.toLowerCase().includes('krabs') ||
    s.username.toLowerCase().includes('advisor')
  );

  console.log(`   Orchestrator: ${hasOrchestrator ? '✅' : '❌'}`);
  console.log(`   Atlas: ${hasAtlas ? '✅' : '❌'}`);
  console.log(`   Financial Advisor (mr krabs): ${hasAdvisor ? '✅' : '❌'}`);

  if (!hasAtlas || !hasAdvisor) {
    console.log('\n⚠️  WARNING: Some agents are not logging messages!');
    console.log('   Solution: Restart the bots to enable message logging');
    console.log('   Commands:');
    console.log('     npm run advisor:dev  # For Financial Advisor');
    console.log('     npm run atlas:dev    # For Atlas');
  }
}

// Search for specific user or agent
async function searchMessages(query: string) {
  const db = getSQLiteDatabase();

  console.log(`\n🔍 Searching for: "${query}"\n`);
  console.log('='.repeat(100));

  const stmt = db.prepare(`
    SELECT * FROM conversations 
    WHERE username LIKE ? OR message LIKE ?
    ORDER BY timestamp DESC
    LIMIT 50
  `);

  const messages = stmt.all(`%${query}%`, `%${query}%`);

  if (messages.length === 0) {
    console.log(`\n⚠️  No messages found matching "${query}"`);
    return;
  }

  console.log(`\nFound ${messages.length} matching message(s):\n`);

  messages.forEach((msg: any, index: number) => {
    const time = new Date(msg.timestamp).toLocaleString();
    console.log(`${index + 1}. [${time}] ${msg.username}`);
    console.log(`   ${msg.message}`);
    console.log('');
  });
}

// Main
const args = process.argv.slice(2);

if (args[0] === 'search' && args[1]) {
  searchMessages(args[1]).catch(console.error);
} else if (args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
  console.log(`
📖 Usage:
  npx tsx scripts/view-message-logs.ts              # View recent messages
  npx tsx scripts/view-message-logs.ts search TERM  # Search for messages

Examples:
  npx tsx scripts/view-message-logs.ts
  npx tsx scripts/view-message-logs.ts search krabs
  npx tsx scripts/view-message-logs.ts search atlas
  npx tsx scripts/view-message-logs.ts search balance
  `);
} else {
  viewMessageLogs().catch(console.error);
}

