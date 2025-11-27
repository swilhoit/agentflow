#!/usr/bin/env npx tsx
/**
 * Direct migration script - reads from SQLite and generates SQL for Supabase
 * This outputs SQL that can be run via the Supabase MCP tool
 */

import Database from 'better-sqlite3';
import * as path from 'path';

const dbPath = path.join(__dirname, '..', 'data', 'agentflow.db');
const sqlite = new Database(dbPath, { readonly: true });
const USER_ID = '1662c902-1b18-41ec-be1f-e145f4054aba';

interface Transaction {
  transaction_id: string;
  account_id: string;
  account_name: string | null;
  description: string;
  merchant: string | null;
  amount: number;
  date: string;
  category: string | null;
  type: string;
}

// Get all transactions from SQLite
const transactions = sqlite.prepare(`
  SELECT transaction_id, account_id, account_name, description, merchant, amount, date, category, type
  FROM financial_transactions ORDER BY date DESC
`).all() as Transaction[];

console.log(`Total transactions in SQLite: ${transactions.length}`);

// Generate INSERT statements in batches
const batchSize = 50;
const batches: string[] = [];

for (let i = 0; i < transactions.length; i += batchSize) {
  const batch = transactions.slice(i, i + batchSize);
  
  const values = batch.map(t => {
    const name = (t.description || '').replace(/'/g, "''").substring(0, 500);
    const merchant = t.merchant ? `'${t.merchant.replace(/'/g, "''").substring(0, 100)}'` : 'NULL';
    const category = t.category ? `'${t.category.replace(/'/g, "''")}'` : 'NULL';
    const amount = typeof t.amount === 'number' ? t.amount.toFixed(2) : t.amount;
    
    return `('${USER_ID}', '${t.transaction_id}', '${name}', ${merchant}, ${amount}, '${t.date}', false, 'teller', '${t.account_id}', '${t.transaction_id}', ${category})`;
  }).join(',\n  ');
  
  const sql = `INSERT INTO transactions (user_id, transaction_id, name, merchant_name, amount, date, pending, source, teller_account_id, teller_transaction_id, category) VALUES
  ${values}
ON CONFLICT (transaction_id) DO UPDATE SET 
  name = EXCLUDED.name,
  merchant_name = EXCLUDED.merchant_name,
  amount = EXCLUDED.amount,
  category = EXCLUDED.category;`;
  
  batches.push(sql);
}

console.log(`Generated ${batches.length} SQL batches`);

// Output as JSON array for easy processing
const output = {
  totalTransactions: transactions.length,
  batchCount: batches.length,
  batches: batches
};

// Write to a file
import * as fs from 'fs';
fs.writeFileSync('/tmp/migration-batches.json', JSON.stringify(output, null, 2));
console.log('Written to /tmp/migration-batches.json');

// Also output first batch for testing
console.log('\n--- FIRST BATCH (for testing) ---');
console.log(batches[0].substring(0, 2000) + '...');

sqlite.close();





