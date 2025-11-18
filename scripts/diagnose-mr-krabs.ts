#!/usr/bin/env tsx

/**
 * Diagnose Mr Krabs Issues
 * 
 * Checks why mr krabs isn't responding
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { getSQLiteDatabase } from '../src/services/databaseFactory';

dotenv.config();

async function diagnoseMrKrabs() {
  console.log('🔍 Diagnosing Mr Krabs Issues...\n');
  console.log('='.repeat(80));

  // Check 1: Environment variables
  console.log('\n📋 Check 1: Environment Configuration');
  console.log('-'.repeat(80));

  const requiredEnvVars = [
    'ADVISOR_DISCORD_TOKEN',
    'ADVISOR_DISCORD_CLIENT_ID',
    'ANTHROPIC_API_KEY',
    'FINANCIAL_ADVISOR_CHANNELS',
    'TELLER_API_TOKEN'
  ];

  let envIssues = 0;
  requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: Set (${value.substring(0, 15)}...)`);
    } else {
      console.log(`❌ ${varName}: NOT SET`);
      envIssues++;
    }
  });

  if (envIssues > 0) {
    console.log(`\n⚠️  ${envIssues} environment variable(s) missing!`);
    console.log('Solution: Check your .env and advisor-env.yaml files');
  }

  // Check 2: Teller certificates
  console.log('\n📋 Check 2: Teller API Certificates');
  console.log('-'.repeat(80));

  const certPath = process.env.TELLER_CERT_PATH || './teller_certificates/certificate.pem';
  const keyPath = process.env.TELLER_KEY_PATH || './teller_certificates/private_key.pem';

  const certExists = fs.existsSync(certPath);
  const keyExists = fs.existsSync(keyPath);

  console.log(`${certExists ? '✅' : '❌'} Certificate: ${certPath}`);
  console.log(`${keyExists ? '✅' : '❌'} Private Key: ${keyPath}`);

  if (!certExists || !keyExists) {
    console.log('\n⚠️  Teller certificates missing!');
    console.log('Solution: Place certificates in teller_certificates/ directory');
  }

  // Check 3: Database and transactions
  console.log('\n📋 Check 3: Transaction Database');
  console.log('-'.repeat(80));

  try {
    const db = getSQLiteDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM financial_transactions');
    const result: any = stmt.get();

    console.log(`✅ Database accessible`);
    console.log(`✅ ${result.count} transactions in database`);

    if (result.count === 0) {
      console.log('\n⚠️  No transactions synced!');
      console.log('Solution: Run npm run test:sync');
    }
  } catch (error) {
    console.log(`❌ Database error: ${error}`);
  }

  // Check 4: Recent bot activity
  console.log('\n📋 Check 4: Bot Activity (Recent Messages)');
  console.log('-'.repeat(80));

  try {
    const db = getSQLiteDatabase();
    const stmt = db.prepare(`
      SELECT datetime(timestamp) as time, username, COUNT(*) as count
      FROM conversations
      WHERE timestamp > datetime('now', '-1 hour')
      GROUP BY username
      ORDER BY timestamp DESC
    `);
    const activity = stmt.all();

    if (activity.length === 0) {
      console.log('⚠️  No bot activity in the last hour');
      console.log('   Bots may not be running');
    } else {
      console.log('Recent activity:');
      activity.forEach((act: any) => {
        console.log(`   ${act.username}: ${act.count} messages (last: ${act.time})`);
      });
    }

    // Check specifically for mr krabs
    const krabsStmt = db.prepare(`
      SELECT datetime(timestamp) as time, message
      FROM conversations
      WHERE username LIKE '%krabs%'
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    const lastKrabs: any = krabsStmt.get();

    if (lastKrabs) {
      console.log(`\n✅ Last mr krabs response: ${lastKrabs.time}`);
      console.log(`   Message: ${lastKrabs.message.substring(0, 100)}...`);
    } else {
      console.log('\n❌ Mr krabs has NEVER responded (not in database)');
      console.log('   This means message logging is working but bot isn\'t responding');
    }
  } catch (error) {
    console.log(`❌ Database query error: ${error}`);
  }

  // Check 5: Process check
  console.log('\n📋 Check 5: Is Mr Krabs Running?');
  console.log('-'.repeat(80));

  console.log('⚠️  Cannot check from this script');
  console.log('   Check manually with: ps aux | grep advisor');
  console.log('   Or check your terminal where you ran: npm run advisor:dev');

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 DIAGNOSIS SUMMARY');
  console.log('='.repeat(80));

  console.log('\nCommon Issues:');
  console.log('1. ❌ Bot Not Running');
  console.log('   → Start it: npm run advisor:dev');
  console.log('');
  console.log('2. ❌ Wrong Channel');
  console.log('   → Check FINANCIAL_ADVISOR_CHANNELS matches your Discord channel ID');
  console.log('   → Get ID: Right-click channel → Copy Channel ID');
  console.log('');
  console.log('3. ❌ Not Tagged');
  console.log('   → Try: @mr krabs show my balance');
  console.log('   → Or: advisor show my balance');
  console.log('');
  console.log('4. ❌ Rate Limited');
  console.log('   → Wait 5 seconds between messages');
  console.log('');
  console.log('5. ❌ Orchestrator Interfering');
  console.log('   → FIXED: Orchestrator now respects channel boundaries');

  console.log('\n💡 Quick Fix Steps:');
  console.log('1. Restart mr krabs: npm run advisor:dev');
  console.log('2. In Discord, tag him: @mr krabs hello');
  console.log('3. Check logs: npm run logs');

  console.log('\n🔍 Debug Commands:');
  console.log('npm run logs              # View message logs');
  console.log('npm run logs:search krabs # Search for mr krabs messages');
  console.log('npm run test:krabs        # Test database access');
  console.log('npm run test:teller       # Test Teller API');
}

diagnoseMrKrabs().catch(console.error);

