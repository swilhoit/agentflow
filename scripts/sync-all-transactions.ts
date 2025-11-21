#!/usr/bin/env tsx

/**
 * Sync All Transactions from Teller to Database
 * 
 * Downloads all transactions from all connected accounts
 */

import * as dotenv from 'dotenv';
import { TransactionSyncService } from '../src/services/transactionSyncService';
import { getSQLiteDatabase } from '../src/services/databaseFactory';
import * as fs from 'fs';
import * as yaml from 'yaml';

// Load environment variables
dotenv.config();

// Also load from advisor-env.yaml if needed
if (!process.env.TELLER_API_TOKEN) {
  try {
    const advisorEnvPath = './advisor-env.yaml';
    if (fs.existsSync(advisorEnvPath)) {
      const advisorEnv = yaml.parse(fs.readFileSync(advisorEnvPath, 'utf8'));
      process.env.TELLER_API_TOKEN = advisorEnv.TELLER_API_TOKEN;
      process.env.TELLER_CERT_PATH = advisorEnv.TELLER_CERT_PATH;
      process.env.TELLER_KEY_PATH = advisorEnv.TELLER_KEY_PATH;
      console.log('✅ Loaded credentials from advisor-env.yaml\n');
    }
  } catch (error) {
    console.error('⚠️  Could not load advisor-env.yaml:', error);
  }
}

async function syncAllTransactions() {
  console.log('');
  console.log('═'.repeat(80));
  console.log('   💾 Syncing All Transactions from Teller to Database');
  console.log('═'.repeat(80));
  console.log('');

  try {
    const db = getSQLiteDatabase();

    // Check existing transactions
    console.log('📊 Checking Existing Database...');
    console.log('─'.repeat(80));
    const existingCount = db.getRecentTransactions(365).length;
    console.log(`   Current transactions in database: ${existingCount}`);
    console.log('');

    // Create sync service with 90 days of history
    console.log('🔧 Initializing Sync Service...');
    console.log('─'.repeat(80));
    const syncService = new TransactionSyncService({
      enabled: false, // Manual trigger only
      daysToSync: 90  // Get last 90 days
    });
    console.log('   ✅ Sync service ready');
    console.log('   📅 Will sync: Last 90 days of transactions');
    console.log('');

    // Trigger sync
    console.log('🚀 Starting Transaction Sync...');
    console.log('─'.repeat(80));
    console.log('   This may take a minute depending on transaction count...');
    console.log('');

    const startTime = Date.now();
    const syncResult = await syncService.triggerSync();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (syncResult.success) {
      console.log('✅ SYNC COMPLETED SUCCESSFULLY!');
      console.log('═'.repeat(80));
      console.log('');

      if (syncResult.stats) {
        console.log('📊 Sync Statistics:');
        console.log('─'.repeat(80));
        console.log(`   ⏱️  Duration: ${duration} seconds`);
        console.log(`   🏦 Accounts Synced: ${syncResult.stats.accounts}`);
        console.log(`   📝 Total Transactions: ${syncResult.stats.totalTransactions}`);
        console.log(`   ✨ New Transactions: ${syncResult.stats.newTransactions}`);
        console.log(`   🔄 Updated Transactions: ${syncResult.stats.updatedTransactions}`);
        console.log('');

        if (syncResult.stats.accountStats && syncResult.stats.accountStats.length > 0) {
          console.log('📋 Per-Account Breakdown:');
          console.log('─'.repeat(80));
          syncResult.stats.accountStats.forEach((acc: any, index: number) => {
            console.log(`   ${index + 1}. ${acc.account}`);
            console.log(`      • Synced: ${acc.synced} transactions`);
            console.log(`      • New: ${acc.new}`);
            console.log(`      • Updated: ${acc.updated}`);
            console.log('');
          });
        }
      }

      // Show sample transactions
      console.log('📝 Sample Recent Transactions:');
      console.log('─'.repeat(80));
      const recentTxns = db.getRecentTransactions(7, 5);
      
      if (recentTxns.length > 0) {
        recentTxns.forEach((txn, index) => {
          console.log(`   ${index + 1}. ${txn.date} - ${txn.description}`);
          console.log(`      Amount: $${txn.amount}`);
          console.log(`      Account: ${txn.accountName}`);
          if (txn.merchant) console.log(`      Merchant: ${txn.merchant}`);
          console.log('');
        });
      } else {
        console.log('   No transactions found (this may indicate an issue)');
      }

      // Show spending summary
      console.log('💰 Spending Summary (Last 30 Days):');
      console.log('─'.repeat(80));
      const today = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const startDateStr = startDate.toISOString().split('T')[0];
      
      const spendingSummary = db.getSpendingSummary(startDateStr, today);
      
      if (spendingSummary.length > 0) {
        const topCategories = spendingSummary.slice(0, 5);
        topCategories.forEach((cat: any, index: number) => {
          console.log(`   ${index + 1}. ${cat.category || 'Uncategorized'}: $${cat.total_spent.toFixed(2)} (${cat.transaction_count} txns)`);
        });
      } else {
        console.log('   No spending data available yet');
      }
      
      console.log('');
      console.log('═'.repeat(80));
      console.log('✅ ALL TRANSACTIONS SYNCED TO DATABASE!');
      console.log('═'.repeat(80));
      console.log('');
      console.log('💡 Next Steps:');
      console.log('   • Start your Financial Advisor bot: npm run advisor:dev');
      console.log('   • Ask questions like:');
      console.log('     - "What did I spend on groceries last month?"');
      console.log('     - "Show my recent transactions"');
      console.log('     - "What\'s my spending by category?"');
      console.log('');

    } else {
      console.log('❌ SYNC FAILED');
      console.log('═'.repeat(80));
      console.log(`   Error: ${syncResult.message}`);
      console.log('');
      console.log('💡 Troubleshooting:');
      console.log('   • Make sure Teller API is accessible');
      console.log('   • Check your API token and certificates');
      console.log('   • Run: npm run test:teller');
      console.log('');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Fatal Error:', error);
    console.error('\nStack trace:', (error as Error).stack);
    process.exit(1);
  }
}

// Run the sync
syncAllTransactions().then(() => {
  console.log('✅ Sync script completed\n');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

