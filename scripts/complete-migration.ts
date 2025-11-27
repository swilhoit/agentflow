#!/usr/bin/env npx tsx
/**
 * Complete the Teller transaction migration to Supabase
 * 
 * Run: SUPABASE_SERVICE_ROLE_KEY=your_key npx tsx scripts/complete-migration.ts
 * 
 * Get your service role key from:
 * https://supabase.com/dashboard/project/ymxhsdtagnalxebnskst/settings/api
 */

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

const SUPABASE_URL = 'https://ymxhsdtagnalxebnskst.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = '1662c902-1b18-41ec-be1f-e145f4054aba';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.error('');
  console.error('Get your service role key from:');
  console.error('https://supabase.com/dashboard/project/ymxhsdtagnalxebnskst/settings/api');
  console.error('');
  console.error('Then run:');
  console.error('SUPABASE_SERVICE_ROLE_KEY=your_key npx tsx scripts/complete-migration.ts');
  process.exit(1);
}

interface SQLiteTransaction {
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

async function completeMigration() {
  console.log('');
  console.log('═'.repeat(80));
  console.log('   💾 Completing Transaction Migration to Supabase');
  console.log('═'.repeat(80));
  console.log('');

  // Connect to SQLite
  const dbPath = path.join(__dirname, '..', 'data', 'agentflow.db');
  console.log(`📂 Opening SQLite: ${dbPath}`);
  const sqlite = new Database(dbPath, { readonly: true });

  // Connect to Supabase
  console.log(`☁️  Connecting to Supabase: ${SUPABASE_URL}`);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // Get all transactions from SQLite
  const transactions = sqlite.prepare(`
    SELECT transaction_id, account_id, account_name, description, merchant, amount, date, category, type
    FROM financial_transactions ORDER BY date DESC
  `).all() as SQLiteTransaction[];
  
  console.log(`📊 Found ${transactions.length} transactions in SQLite`);

  // Check current Supabase count
  const { count: existingCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID);
  
  console.log(`☁️  Existing transactions in Supabase: ${existingCount}`);

  // Insert in batches
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  console.log('');
  console.log('🚀 Migrating transactions...');
  console.log('─'.repeat(80));

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    
    const supabaseTransactions = batch.map(txn => ({
      user_id: USER_ID,
      account_id: null,
      transaction_id: txn.transaction_id,
      name: txn.description,
      merchant_name: txn.merchant,
      amount: txn.amount,
      iso_currency_code: 'USD',
      category: txn.category,
      date: txn.date,
      pending: false,
      source: 'teller' as const,
      teller_account_id: txn.account_id,
      teller_transaction_id: txn.transaction_id
    }));

    const { data, error } = await supabase
      .from('transactions')
      .upsert(supabaseTransactions, { 
        onConflict: 'transaction_id',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += data?.length || batch.length;
      process.stdout.write(`\r   ✅ Progress: ${Math.min(inserted, transactions.length)}/${transactions.length} transactions`);
    }
  }

  console.log('\n');
  console.log('═'.repeat(80));
  console.log('   📊 MIGRATION COMPLETE');
  console.log('═'.repeat(80));
  console.log(`   ✅ Inserted/Updated: ${inserted}`);
  console.log(`   ❌ Errors: ${errors}`);

  // Verify final count
  const { count: finalCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID);
  
  console.log(`   📈 Total transactions in Supabase: ${finalCount}`);
  console.log('');

  sqlite.close();
}

completeMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});





