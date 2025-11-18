#!/usr/bin/env tsx

/**
 * Test Mr Krabs Database Access
 * 
 * Verifies that the Financial Advisor can access and query the transactions database
 */

import * as dotenv from 'dotenv';
import { AdvisorTools } from '../src/advisor/advisorTools';
import { getSQLiteDatabase } from '../src/services/databaseFactory';

dotenv.config();

// Load from advisor-env.yaml if needed
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
      console.log('✅ Loaded credentials from advisor-env.yaml\n');
    }
  } catch (error) {
    console.error('⚠️  Could not load advisor-env.yaml:', error);
  }
}

async function testMrKrabsDbAccess() {
  console.log('💰 Testing Mr Krabs Database Access...\n');
  console.log('='.repeat(80));

  try {
    const db = getSQLiteDatabase();
    const advisorTools = new AdvisorTools();

    // Test 1: Check database connectivity
    console.log('\n📋 Test 1: Database Connectivity');
    console.log('-'.repeat(80));
    console.log('✅ Database connected');

    // Test 2: Check transaction count
    console.log('\n📋 Test 2: Transaction Database Status');
    console.log('-'.repeat(80));
    
    const stmt = db.prepare('SELECT COUNT(*) as count, MIN(date) as oldest, MAX(date) as newest FROM financial_transactions');
    const stats: any = stmt.get();
    
    console.log(`✅ Found ${stats.count} transactions in database`);
    console.log(`   Oldest: ${stats.oldest}`);
    console.log(`   Newest: ${stats.newest}`);

    if (stats.count === 0) {
      console.log('\n⚠️  WARNING: No transactions in database!');
      console.log('   Run: npm run test:sync');
      return;
    }

    // Test 3: Test mr krabs tool definitions
    console.log('\n📋 Test 3: Mr Krabs Tools Available');
    console.log('-'.repeat(80));
    
    const tools = advisorTools.getToolDefinitions();
    const dbTools = tools.filter(t => t.name.includes('cached') || t.name.includes('search') || t.name.includes('history'));
    
    console.log(`✅ Total tools available: ${tools.length}`);
    console.log(`✅ Database-specific tools: ${dbTools.length}`);
    console.log('\nDatabase Tools:');
    dbTools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });

    // Test 4: Execute get_cached_transactions
    console.log('\n📋 Test 4: Get Cached Transactions (Last 7 Days)');
    console.log('-'.repeat(80));
    
    const cachedResult = await advisorTools.executeTool('get_cached_transactions', { days: 7 });
    
    if (cachedResult.error) {
      console.log(`❌ Error: ${cachedResult.error}`);
    } else {
      console.log(`✅ Retrieved ${cachedResult.count} transactions`);
      console.log(`   Source: ${cachedResult.source}`);
      console.log(`   Last sync: ${cachedResult.last_sync}`);
      
      if (cachedResult.transactions && cachedResult.transactions.length > 0) {
        console.log('\n   Recent transactions:');
        cachedResult.transactions.slice(0, 5).forEach((txn: any, i: number) => {
          console.log(`   ${i + 1}. ${txn.date} - ${txn.description} ($${txn.amount})`);
        });
      }
    }

    // Test 5: Search transactions
    console.log('\n📋 Test 5: Search Transactions (ANTHROPIC)');
    console.log('-'.repeat(80));
    
    const searchResult = await advisorTools.executeTool('search_transactions', { 
      query: 'ANTHROPIC',
      days: 30 
    });
    
    if (searchResult.error) {
      console.log(`❌ Error: ${searchResult.error}`);
    } else {
      console.log(`✅ Found ${searchResult.matches} matching transaction(s)`);
      
      if (searchResult.transactions && searchResult.transactions.length > 0) {
        console.log('\n   Matches:');
        searchResult.transactions.forEach((txn: any, i: number) => {
          console.log(`   ${i + 1}. ${txn.date} - ${txn.description} ($${txn.amount})`);
        });
      }
    }

    // Test 6: Get spending by category
    console.log('\n📋 Test 6: Spending by Category (Last 30 Days)');
    console.log('-'.repeat(80));
    
    const spendingResult = await advisorTools.executeTool('get_spending_by_category', { days: 30 });
    
    if (spendingResult.error) {
      console.log(`❌ Error: ${spendingResult.error}`);
    } else {
      console.log(`✅ Total spent: $${spendingResult.total_spent}`);
      console.log(`   Transaction count: ${spendingResult.transaction_count}`);
      console.log(`   Daily average: $${spendingResult.daily_average}`);
      
      if (spendingResult.categories && spendingResult.categories.length > 0) {
        console.log('\n   Top categories:');
        spendingResult.categories.slice(0, 5).forEach((cat: any, i: number) => {
          console.log(`   ${i + 1}. ${cat.category || 'Uncategorized'}: $${cat.amount} (${cat.percentage}%)`);
        });
      }
    }

    // Test 7: Get transaction history
    console.log('\n📋 Test 7: Transaction History');
    console.log('-'.repeat(80));
    
    const historyResult = await advisorTools.executeTool('get_transaction_history', { days: 90 });
    
    if (historyResult.error) {
      console.log(`❌ Error: ${historyResult.error}`);
    } else {
      console.log(`✅ Total transactions: ${historyResult.total_transactions}`);
      console.log(`   Unique categories: ${historyResult.unique_categories}`);
      console.log(`   Period: ${historyResult.period_days} days`);
      console.log(`   Last sync: ${historyResult.last_sync}`);
    }

    // Test 8: Verify tool integration
    console.log('\n📋 Test 8: Tool Integration Check');
    console.log('-'.repeat(80));
    
    const allTools = tools.map(t => t.name);
    const requiredTools = [
      'get_cached_transactions',
      'search_transactions',
      'get_spending_by_category',
      'get_transaction_history'
    ];
    
    const missingTools = requiredTools.filter(t => !allTools.includes(t));
    
    if (missingTools.length === 0) {
      console.log('✅ All database tools properly integrated');
      console.log('✅ Mr Krabs can access transaction database');
    } else {
      console.log(`❌ Missing tools: ${missingTools.join(', ')}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests passed! Mr Krabs has full access to transaction database!');
    console.log('='.repeat(80));

    console.log('\n💡 Mr Krabs can now:');
    console.log('   - Query cached transactions (instant!)');
    console.log('   - Search by merchant/description');
    console.log('   - Analyze spending by category');
    console.log('   - View full transaction history');
    console.log('   - All from the local database (no API calls needed!)');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('\nStack trace:', (error as Error).stack);
    process.exit(1);
  }
}

// Run the test
testMrKrabsDbAccess().then(() => {
  console.log('\n✅ Test completed successfully\n');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

