#!/usr/bin/env npx tsx
/**
 * Manual sync from ALL Teller tokens to database
 */

import { getSQLiteDatabase } from '../src/services/databaseFactory';
import type { DatabaseService, FinancialTransaction } from '../src/services/database';
import * as https from 'https';
import * as fs from 'fs';

async function tellerRequest(token: string, endpoint: string): Promise<any> {
  const certPath = process.env.TELLER_CERT_PATH || './teller_certificates/certificate.pem';
  const keyPath = process.env.TELLER_KEY_PATH || './teller_certificates/private_key.pem';
  
  const httpsAgent = new https.Agent({
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath)
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.teller.io',
      path: endpoint,
      method: 'GET',
      agent: httpsAgent,
      auth: `${token}:`
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function syncToken(tokenName: string, token: string, db: DatabaseService) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Syncing from: ${tokenName}`);
  console.log('='.repeat(70));
  
  // Get accounts
  const accounts = await tellerRequest(token, '/accounts');
  console.log(`Found ${accounts.length} account(s)`);
  
  let totalSynced = 0;
  let totalNew = 0;
  
  for (const account of accounts) {
    console.log(`\n📊 ${account.name} (${account.type})`);
    
    // Get transactions
    const transactions = await tellerRequest(token, `/accounts/${account.id}/transactions?count=500`);
    console.log(`   Retrieved ${transactions.length} transaction(s)`);
    
    // Get existing IDs
    const existing = db.getTransactionsByAccount(account.id, 1000);
    const existingIds = new Set(existing.map(t => t.transactionId));
    
    // Prepare for save
    const toSave: FinancialTransaction[] = transactions.map((txn: any) => ({
      transactionId: txn.id,
      accountId: account.id,
      accountName: account.name,
      accountType: account.type,
      institution: account.institution?.name || 'Unknown',
      date: txn.date,
      description: txn.description,
      amount: parseFloat(txn.amount),
      type: txn.type,
      category: txn.category || null,
      merchant: txn.merchant || null,
      details: JSON.stringify(txn),
      syncedAt: new Date(),
      metadata: null
    }));
    
    const newCount = toSave.filter(t => !existingIds.has(t.transactionId)).length;
    
    if (toSave.length > 0) {
      db.saveTransactionsBatch(toSave);
      totalSynced += toSave.length;
      totalNew += newCount;
      console.log(`   ✅ Synced ${toSave.length} transactions (${newCount} new, ${toSave.length - newCount} updated)`);
    }
  }
  
  console.log(`\n✅ ${tokenName}: ${totalSynced} transactions synced (${totalNew} new)`);
  return { totalSynced, totalNew };
}

async function main() {
  console.log('🔄 SYNCING ALL TELLER TOKENS TO DATABASE');
  console.log('='.repeat(70));
  
  const db = getSQLiteDatabase();
  
  const tokens = [
    { name: 'Truist (Primary)', token: process.env.TELLER_API_TOKEN },
    { name: 'AmEx Cards', token: process.env.TELLER_API_TOKEN_AMEX }
  ];
  
  let grandTotal = 0;
  let grandNew = 0;
  
  for (const { name, token } of tokens) {
    if (!token) {
      console.log(`\n⚠️  Skipping ${name} - token not found`);
      continue;
    }
    
    try {
      const { totalSynced, totalNew } = await syncToken(name, token, db);
      grandTotal += totalSynced;
      grandNew += totalNew;
    } catch (error) {
      console.error(`❌ Error syncing ${name}:`, error);
    }
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🎉 SYNC COMPLETE`);
  console.log(`   Total transactions: ${grandTotal}`);
  console.log(`   New transactions: ${grandNew}`);
  console.log(`   Updated: ${grandTotal - grandNew}`);
  console.log('='.repeat(70));
  
  // Show what's in the database now
  console.log(`\n📊 DATABASE SUMMARY:`);
  const allAccounts = await new Promise<any[]>((resolve) => {
    const stmt = db['db'].prepare('SELECT DISTINCT account_name, COUNT(*) as count FROM financial_transactions GROUP BY account_name ORDER BY account_name');
    resolve(stmt.all());
  });
  
  allAccounts.forEach((a: any) => {
    console.log(`   ${a.account_name}: ${a.count} transactions`);
  });
  
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

