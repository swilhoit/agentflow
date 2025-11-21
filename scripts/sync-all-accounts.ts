#!/usr/bin/env tsx

/**
 * Sync ALL Transactions from ALL Tokens
 * 
 * Syncs transactions from both AmEx and Truist accounts
 */

import * as dotenv from 'dotenv';
import { AdvisorTools } from '../src/advisor/advisorTools';
import { getSQLiteDatabase } from '../src/services/databaseFactory';
import * as fs from 'fs';
import * as yaml from 'yaml';
import * as https from 'https';

dotenv.config();

// Load tokens from advisor-env.yaml
const advisorEnvPath = './advisor-env.yaml';
const advisorEnv = yaml.parse(fs.readFileSync(advisorEnvPath, 'utf8'));
const TRUIST_TOKEN = advisorEnv.TELLER_API_TOKEN;
const AMEX_TOKEN = advisorEnv.TELLER_API_TOKEN_AMEX;
const CERT_PATH = './teller_certificates/certificate.pem';
const KEY_PATH = './teller_certificates/private_key.pem';

const httpsAgent = new https.Agent({
  cert: fs.readFileSync(CERT_PATH),
  key: fs.readFileSync(KEY_PATH)
});

async function tellerRequest(path: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.teller.io',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(token + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      agent: httpsAgent
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            console.error(`API error: ${res.statusCode} ${data}`);
            resolve({ error: `API error: ${res.statusCode}` });
          }
        } catch (error) {
          resolve({ error: 'Failed to parse response' });
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    req.end();
  });
}

async function syncAllAccounts() {
  console.log('');
  console.log('═'.repeat(80));
  console.log('   💾 Syncing ALL Transactions from ALL Accounts');
  console.log('═'.repeat(80));
  console.log('');

  const db = getSQLiteDatabase();
  let totalSynced = 0;
  let totalNew = 0;

  // Sync Truist accounts
  console.log('🏦 Syncing Truist Accounts...');
  console.log('─'.repeat(80));
  const truistAccounts: any = await tellerRequest('/accounts', TRUIST_TOKEN);
  
  if (!truistAccounts.error && Array.isArray(truistAccounts)) {
    console.log(`   Found ${truistAccounts.length} Truist account(s)`);
    
    for (const account of truistAccounts) {
      console.log(`\n   Syncing: ${account.name} (••${account.last_four})`);
      const transactions: any = await tellerRequest(`/accounts/${account.id}/transactions?count=500`, TRUIST_TOKEN);
      
      if (!transactions.error && Array.isArray(transactions)) {
        let accountNew = 0;
        transactions.forEach((txn: any) => {
          try {
            db.saveTransaction({
              transactionId: txn.id,
              accountId: account.id,
              accountName: account.name,
              date: txn.date,
              description: txn.description || 'Unknown',
              amount: parseFloat(txn.amount),
              type: txn.type,
              category: txn.details?.category || null,
              merchant: txn.details?.counterparty?.name || null,
              pending: txn.status === 'pending'
            });
            accountNew++;
          } catch (error) {
            // Transaction probably already exists, skip
          }
        });
        console.log(`   ✅ ${transactions.length} transactions (${accountNew} new)`);
        totalSynced += transactions.length;
        totalNew += accountNew;
      }
    }
  }

  // Sync AmEx accounts
  console.log('\n💳 Syncing American Express Accounts...');
  console.log('─'.repeat(80));
  const amexAccounts: any = await tellerRequest('/accounts', AMEX_TOKEN);
  
  if (!amexAccounts.error && Array.isArray(amexAccounts)) {
    console.log(`   Found ${amexAccounts.length} AmEx account(s)`);
    
    for (const account of amexAccounts) {
      console.log(`\n   Syncing: ${account.name} (••${account.last_four})`);
      const transactions: any = await tellerRequest(`/accounts/${account.id}/transactions?count=500`, AMEX_TOKEN);
      
      if (!transactions.error && Array.isArray(transactions)) {
        let accountNew = 0;
        transactions.forEach((txn: any) => {
          try {
            db.saveTransaction({
              transactionId: txn.id,
              accountId: account.id,
              accountName: account.name,
              date: txn.date,
              description: txn.description || 'Unknown',
              amount: parseFloat(txn.amount),
              type: txn.type,
              category: txn.details?.category || null,
              merchant: txn.details?.counterparty?.name || null,
              pending: txn.status === 'pending'
            });
            accountNew++;
          } catch (error) {
            // Transaction probably already exists, skip
          }
        });
        console.log(`   ✅ ${transactions.length} transactions (${accountNew} new)`);
        totalSynced += transactions.length;
        totalNew += accountNew;
      }
    }
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('✅ SYNC COMPLETE!');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`📊 Summary:`);
  console.log(`   Total Transactions Processed: ${totalSynced}`);
  console.log(`   New Transactions Saved: ${totalNew}`);
  console.log('');

  // Show recent transactions
  const recentTxns = db.getRecentTransactions(7, 10);
  console.log(`📝 Recent Transactions (last 7 days):`);
  console.log('─'.repeat(80));
  recentTxns.forEach((txn, index) => {
    console.log(`${index + 1}. ${txn.date} - ${txn.description}`);
    console.log(`   Amount: $${txn.amount}`);
    console.log(`   Account: ${txn.accountName}`);
    console.log('');
  });

  // Show spending summary
  const today = new Date().toISOString().split('T')[0];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const startDateStr = startDate.toISOString().split('T')[0];
  const spendingSummary = db.getSpendingSummary(startDateStr, today);
  
  console.log(`💰 Spending Summary (Last 30 Days):`);
  console.log('─'.repeat(80));
  const topCategories = spendingSummary.slice(0, 5);
  if (topCategories.length > 0) {
    topCategories.forEach((cat: any, index: number) => {
      console.log(`${index + 1}. ${cat.category || 'Uncategorized'}: $${Math.abs(cat.total_spent).toFixed(2)} (${cat.transaction_count} txns)`);
    });
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('✅ ALL ACCOUNTS SYNCED TO DATABASE!');
  console.log('═'.repeat(80));
  console.log('');
  console.log('💡 Next Steps:');
  console.log('   • Start your bot: npm run advisor:dev');
  console.log('   • Ask: "What did I spend on Truist last month?"');
  console.log('   • Ask: "Show my recent transactions"');
  console.log('   • Ask: "What\'s my total balance?"');
  console.log('');
}

syncAllAccounts().then(() => {
  console.log('✅ Sync completed\n');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

