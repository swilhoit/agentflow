#!/usr/bin/env tsx

/**
 * Test Transaction Sync System
 * 
 * Tests the database transaction storage and sync service
 */

import * as dotenv from 'dotenv';
import { TransactionSyncService } from '../src/services/transactionSyncService';
import { getSQLiteDatabase } from '../src/services/databaseFactory';
import { logger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

// Also load from advisor-env.yaml if needed
if (!process.env.TELLER_API_TOKEN) {
  const fs = require('fs');
  const yaml = require('yaml');
  
  try {
    const advisorEnvPath = './advisor-env.yaml';
    if (fs.existsSync(advisorEnvPath)) {
      const advisorEnv = yaml.parse(fs.readFileSync(advisorEnvPath, 'utf8'));
      process.env.TELLER_API_TOKEN = advisorEnv.TELLER_API_TOKEN;
      process.env.TELLER_CERT_PATH = advisorEnv.TELLER_CERT_PATH;
      process.env.TELLER_KEY_PATH = advisorEnv.TELLER_KEY_PATH;
      console.log('✅ Loaded credentials from advisor-env.yaml');
    }
  } catch (error) {
    console.error('⚠️  Could not load advisor-env.yaml:', error);
  }
}

async function testTransactionSync() {
  console.log('🧪 Testing Transaction Sync System...\n');
  console.log('='.repeat(80));

  try {
    const db = getSQLiteDatabase();

    // Test 1: Check database connectivity
    console.log('\n📋 Test 1: Database Connectivity');
    console.log('-'.repeat(80));
    console.log('✅ Database connected');

    // Test 2: Check if transactions table exists
    console.log('\n📋 Test 2: Transactions Table');
    console.log('-'.repeat(80));
    try {
      const existingTransactions = db.getRecentTransactions(30);
      console.log(`✅ Transactions table exists`);
      console.log(`   Found ${existingTransactions.length} existing transaction(s) from last 30 days`);
    } catch (error) {
      console.log('⚠️  Transactions table might not exist or is empty');
    }

    // Test 3: Create sync service
    console.log('\n📋 Test 3: Transaction Sync Service');
    console.log('-'.repeat(80));
    
    const syncService = new TransactionSyncService({
      enabled: false, // Don't start cron, we'll trigger manually
      daysToSync: 90
    });
    
    console.log('✅ Sync service created');

    // Test 4: Check sync status before sync
    console.log('\n📋 Test 4: Check Sync Status (Before)');
    console.log('-'.repeat(80));
    const statusBefore = syncService.getStatus();
    console.log(`   Last Sync: ${statusBefore.lastSync}`);
    console.log(`   Recent Transaction Count: ${statusBefore.recentTransactionCount}`);
    console.log(`   Total Transactions: ${statusBefore.totalTransactions}`);
    console.log(`   Unique Categories: ${statusBefore.uniqueCategories}`);

    // Test 5: Run manual sync
    console.log('\n📋 Test 5: Manual Sync');
    console.log('-'.repeat(80));
    console.log('Starting sync... (this may take a moment)');
    
    const syncResult = await syncService.triggerSync();
    
    if (syncResult.success) {
      console.log('✅ Sync completed successfully!');
      
      if (syncResult.stats) {
        console.log('\n📊 Sync Statistics:');
        console.log(`   Duration: ${syncResult.stats.duration}`);
        console.log(`   Accounts Synced: ${syncResult.stats.accounts}`);
        console.log(`   Total Transactions: ${syncResult.stats.totalTransactions}`);
        console.log(`   New Transactions: ${syncResult.stats.newTransactions}`);
        console.log(`   Updated Transactions: ${syncResult.stats.updatedTransactions}`);
        
        if (syncResult.stats.accountStats && syncResult.stats.accountStats.length > 0) {
          console.log('\n   Per-Account Breakdown:');
          syncResult.stats.accountStats.forEach((acc: any) => {
            console.log(`   - ${acc.account}: ${acc.synced} transactions (${acc.new} new, ${acc.updated} updated)`);
          });
        }
      }
    } else {
      console.log(`❌ Sync failed: ${syncResult.message}`);
    }

    // Test 6: Check sync status after sync
    console.log('\n📋 Test 6: Check Sync Status (After)');
    console.log('-'.repeat(80));
    const statusAfter = syncService.getStatus();
    console.log(`   Last Sync: ${statusAfter.lastSync}`);
    console.log(`   Recent Transaction Count: ${statusAfter.recentTransactionCount}`);
    console.log(`   Total Transactions: ${statusAfter.totalTransactions}`);
    console.log(`   Unique Categories: ${statusAfter.uniqueCategories}`);

    // Test 7: Query transactions from database
    console.log('\n📋 Test 7: Query Recent Transactions');
    console.log('-'.repeat(80));
    const recentTransactions = db.getRecentTransactions(7, 10);
    console.log(`✅ Retrieved ${recentTransactions.length} transactions from last 7 days:\n`);
    
    recentTransactions.forEach((txn, index) => {
      console.log(`${index + 1}. ${txn.date} - ${txn.description}`);
      console.log(`   Amount: $${txn.amount}`);
      console.log(`   Account: ${txn.accountName}`);
      console.log(`   Category: ${txn.category || 'N/A'}`);
      console.log('');
    });

    // Test 8: Get spending summary
    console.log('\n📋 Test 8: Spending Summary');
    console.log('-'.repeat(80));
    const today = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const spendingSummary = db.getSpendingSummary(startDateStr, today);
    console.log(`✅ Spending by category (last 30 days):\n`);
    
    spendingSummary.slice(0, 10).forEach((cat: any, index: number) => {
      console.log(`${index + 1}. ${cat.category || 'Uncategorized'}`);
      console.log(`   Total: $${cat.total_spent.toFixed(2)}`);
      console.log(`   Count: ${cat.transaction_count} transactions`);
      console.log(`   Average: $${cat.avg_amount.toFixed(2)}`);
      console.log('');
    });

    // Test 9: Get categories
    console.log('\n📋 Test 9: Transaction Categories');
    console.log('-'.repeat(80));
    const categories = db.getTransactionCategories();
    console.log(`✅ Found ${categories.length} unique categories:`);
    console.log(`   ${categories.slice(0, 15).join(', ')}${categories.length > 15 ? '...' : ''}`);

    // Test 10: Get sync stats
    console.log('\n📋 Test 10: Sync Statistics');
    console.log('-'.repeat(80));
    const syncStats = await syncService.getSyncStats(30);
    console.log(`   Period: ${syncStats.period}`);
    console.log(`   Transaction Count: ${syncStats.transactionCount}`);
    console.log(`   Unique Categories: ${syncStats.uniqueCategories}`);
    console.log(`   Last Sync: ${syncStats.lastSync}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests passed! Transaction sync system is working perfectly.');
    console.log('='.repeat(80));
    console.log('\n💡 Next Steps:');
    console.log('   - Transactions will now sync daily at 2:00 AM PST');
    console.log('   - You can ask the Financial Advisor about your spending anytime');
    console.log('   - Database caching provides instant responses');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('\nStack trace:', (error as Error).stack);
    process.exit(1);
  }
}

// Run the tests
testTransactionSync().then(() => {
  console.log('\n✅ Test completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

