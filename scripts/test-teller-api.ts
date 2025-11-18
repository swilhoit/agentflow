#!/usr/bin/env tsx

/**
 * Test Teller API Access
 * 
 * This script tests the Teller API connection and verifies access to connected accounts.
 */

import * as dotenv from 'dotenv';
import { AdvisorTools } from '../src/advisor/advisorTools';

// Load environment variables
dotenv.config();

// Also load from advisor-env.yaml if TELLER_API_TOKEN is not set
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

async function testTellerAPI() {
  console.log('🔍 Testing Teller API Access...\n');
  console.log('='.repeat(60));
  
  // Check configuration
  console.log('\n📋 Configuration Check:');
  console.log('-'.repeat(60));
  console.log(`TELLER_API_TOKEN: ${process.env.TELLER_API_TOKEN ? '✅ Set (' + process.env.TELLER_API_TOKEN.substring(0, 15) + '...)' : '❌ Not set'}`);
  console.log(`TELLER_CERT_PATH: ${process.env.TELLER_CERT_PATH || '⚠️  Not set (optional)'}`);
  console.log(`TELLER_KEY_PATH: ${process.env.TELLER_KEY_PATH || '⚠️  Not set (optional)'}`);
  
  if (!process.env.TELLER_API_TOKEN) {
    console.error('\n❌ ERROR: TELLER_API_TOKEN is not set!');
    console.log('\nPlease set it in one of these files:');
    console.log('  - advisor-env.yaml');
    console.log('  - .env');
    console.log('  - or export it as an environment variable');
    process.exit(1);
  }
  
  console.log('\n');
  
  try {
    // Initialize the advisor tools
    const advisorTools = new AdvisorTools();
    
    // Test 1: Get all accounts
    console.log('🏦 Test 1: Fetching Connected Accounts...');
    console.log('-'.repeat(60));
    
    const accountsResult = await advisorTools.executeTool('get_accounts', {});
    
    if (accountsResult.error) {
      console.error(`❌ Error: ${accountsResult.error}`);
      console.log('\nPossible causes:');
      console.log('  - Invalid API token');
      console.log('  - No accounts connected');
      console.log('  - API connectivity issues');
      return;
    }
    
    console.log(`✅ Successfully connected!`);
    console.log(`\n📊 Found ${accountsResult.total_accounts} account(s):\n`);
    
    if (accountsResult.accounts && accountsResult.accounts.length > 0) {
      accountsResult.accounts.forEach((account: any, index: number) => {
        console.log(`${index + 1}. ${account.name}`);
        console.log(`   Type: ${account.type} (${account.subtype || 'N/A'})`);
        console.log(`   Institution: ${account.institution || 'Unknown'}`);
        console.log(`   Balance: ${account.currency || '$'}${account.balance}`);
        console.log(`   Last Four: ${account.last_four || 'N/A'}`);
        console.log(`   Status: ${account.status}`);
        console.log(`   ID: ${account.id}`);
        console.log('');
      });
      
      // Test 2: Get balance summary
      console.log('💰 Test 2: Fetching Balance Summary...');
      console.log('-'.repeat(60));
      
      const balanceResult = await advisorTools.executeTool('get_balance_summary', {});
      
      if (!balanceResult.error) {
        console.log(`✅ Balance Summary:`);
        console.log(`   Total Assets: $${balanceResult.total_assets}`);
        console.log(`   Total Liabilities: $${balanceResult.total_liabilities}`);
        console.log(`   Net Worth: $${balanceResult.net_worth}`);
      }
      
      console.log('\n');
      
      // Test 3: Get recent transactions from first account
      if (accountsResult.accounts[0]) {
        console.log('📝 Test 3: Fetching Recent Transactions...');
        console.log('-'.repeat(60));
        
        const firstAccountId = accountsResult.accounts[0].id;
        const transactionsResult = await advisorTools.executeTool('get_transactions', {
          account_id: firstAccountId,
          count: 5
        });
        
        if (!transactionsResult.error && transactionsResult.transactions) {
          console.log(`✅ Found ${transactionsResult.transactions.length} recent transaction(s) from ${accountsResult.accounts[0].name}:\n`);
          
          transactionsResult.transactions.forEach((txn: any, index: number) => {
            console.log(`${index + 1}. ${txn.date} - ${txn.description}`);
            console.log(`   Amount: $${txn.amount}`);
            console.log(`   Type: ${txn.type}`);
            console.log(`   Category: ${txn.category || 'N/A'}`);
            if (txn.merchant) {
              console.log(`   Merchant: ${txn.merchant}`);
            }
            console.log('');
          });
        } else {
          console.log('⚠️  No transactions found or error fetching transactions');
        }
      }
      
      console.log('='.repeat(60));
      console.log('✅ All tests passed! Teller API is working correctly.');
      console.log('='.repeat(60));
      
    } else {
      console.log('⚠️  No accounts found. Please connect accounts via Teller.');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('\nStack trace:', (error as Error).stack);
  }
}

// Run the test
testTellerAPI().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

