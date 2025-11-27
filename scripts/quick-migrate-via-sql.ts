#!/usr/bin/env npx tsx
/**
 * Quick migration - inserts transactions from SQLite export into Supabase via SQL
 */

import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Hardcode credentials for this migration
const SUPABASE_URL = 'https://ymxhsdtagnalxebnskst.supabase.co';
const USER_ID = '1662c902-1b18-41ec-be1f-e145f4054aba';

// Get service key from environment
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable required');
  console.error('   Run with: SUPABASE_SERVICE_ROLE_KEY=your_key npx tsx scripts/quick-migrate-via-sql.ts');
  process.exit(1);
}

interface SQLiteTransaction {
  transaction_id: string;
  account_id: string;
  account_name: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string | null;
  merchant: string | null;
}

async function main() {
  console.log('\n═'.repeat(80));
  console.log('   💾 Quick Migration: SQLite → Supabase');
  console.log('═'.repeat(80));

  // Read exported transactions
  const jsonPath = '/tmp/all_transactions.json';
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Export file not found: ${jsonPath}`);
    console.error('   Run: sqlite3 -json data/agentflow.db "SELECT * FROM financial_transactions" > /tmp/all_transactions.json');
    process.exit(1);
  }

  const transactions: SQLiteTransaction[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`\n📂 Loaded ${transactions.length} transactions from export`);

  // Connect to Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // Get existing transaction IDs
  console.log('\n🔍 Checking existing transactions in Supabase...');
  const { data: existing } = await supabase
    .from('transactions')
    .select('transaction_id')
    .eq('user_id', USER_ID);
  
  const existingIds = new Set((existing || []).map(t => t.transaction_id));
  console.log(`   Found ${existingIds.size} existing transactions`);

  // Filter to only new transactions
  const newTransactions = transactions.filter(t => !existingIds.has(t.transaction_id));
  console.log(`   Need to insert ${newTransactions.length} new transactions`);

  if (newTransactions.length === 0) {
    console.log('\n✅ All transactions already migrated!');
    return;
  }

  // Insert in batches
  console.log('\n🚀 Inserting transactions...');
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < newTransactions.length; i += BATCH_SIZE) {
    const batch = newTransactions.slice(i, i + BATCH_SIZE);
    
    const records = batch.map(t => ({
      user_id: USER_ID,
      transaction_id: t.transaction_id,
      teller_transaction_id: t.transaction_id,
      teller_account_id: t.account_id,
      name: t.description,
      merchant_name: t.merchant,
      amount: t.amount,
      iso_currency_code: 'USD',
      category: t.category,
      date: t.date,
      pending: false,
      source: 'teller'
    }));

    const { data, error } = await supabase
      .from('transactions')
      .upsert(records, { onConflict: 'transaction_id' })
      .select('id');

    if (error) {
      console.error(`\n❌ Batch error:`, error.message);
      errors += batch.length;
    } else {
      inserted += data?.length || batch.length;
      process.stdout.write(`\r   Progress: ${inserted}/${newTransactions.length} (${Math.round(inserted/newTransactions.length*100)}%)`);
    }
  }

  console.log('\n\n═'.repeat(80));
  console.log('   📊 MIGRATION COMPLETE');
  console.log('═'.repeat(80));
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   ❌ Errors: ${errors}`);

  // Verify
  const { count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID);
  
  console.log(`   📈 Total in Supabase: ${count}\n`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

