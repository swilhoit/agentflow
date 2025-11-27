#!/usr/bin/env node
/**
 * Direct migration script using Supabase REST API
 */
const Database = require('better-sqlite3');
const path = require('path');

const SUPABASE_URL = 'https://ymxhsdtagnalxebnskst.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteGhzZHRhZ25hbHhlYm5za3N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzQyOTUsImV4cCI6MjA3MDQ1MDI5NX0.eO8Tq7P-y-WWoMDBxWz7DvVFR2mmPm3_WIx04RABkTE';
const USER_ID = '1662c902-1b18-41ec-be1f-e145f4054aba';

async function main() {
  const dbPath = path.join(__dirname, '..', 'data', 'agentflow.db');
  const db = new Database(dbPath, { readonly: true });
  
  // Get all transactions
  const transactions = db.prepare(`
    SELECT * FROM financial_transactions ORDER BY date DESC
  `).all();
  
  console.log(`Found ${transactions.length} transactions to migrate`);
  
  // Insert in batches
  const BATCH_SIZE = 100;
  let success = 0;
  let errors = 0;
  
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    
    const records = batch.map(t => ({
      user_id: USER_ID,
      account_id: null,
      transaction_id: t.transaction_id,
      name: t.description,
      merchant_name: t.merchant || null,
      amount: t.amount,
      iso_currency_code: 'USD',
      category: t.category || null,
      date: t.date,
      pending: false,
      source: 'teller',
      teller_account_id: t.account_id,
      teller_transaction_id: t.transaction_id
    }));
    
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(records)
      });
      
      if (!res.ok) {
        const text = await res.text();
        console.error(`Batch ${Math.floor(i/BATCH_SIZE)+1} error: ${res.status} - ${text}`);
        errors += batch.length;
      } else {
        success += batch.length;
        console.log(`Batch ${Math.floor(i/BATCH_SIZE)+1}: ${success}/${transactions.length} done`);
      }
    } catch (e) {
      console.error(`Batch ${Math.floor(i/BATCH_SIZE)+1} failed:`, e.message);
      errors += batch.length;
    }
  }
  
  console.log(`\nMigration complete: ${success} success, ${errors} errors`);
  db.close();
}

main().catch(console.error);

