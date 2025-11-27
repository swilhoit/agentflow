#!/usr/bin/env npx tsx
/**
 * Migrate transactions from local SQLite to Supabase
 * 
 * This script transfers all real Teller transactions from the local database
 * to the Supabase cloud database.
 */

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = '1662c902-1b18-41ec-be1f-e145f4054aba'; // Sam's user ID

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

interface SQLiteTransaction {
  id: number;
  transaction_id: string;
  account_id: string;
  account_name: string | null;
  account_type: string | null;
  institution: string | null;
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string | null;
  merchant: string | null;
  details: string | null;
  synced_at: string | null;
  metadata: string | null;
}

async function migrateTransactions() {
  console.log('');
  console.log('═'.repeat(80));
  console.log('   💾 Migrating Transactions from SQLite to Supabase');
  console.log('═'.repeat(80));
  console.log('');

  // Connect to SQLite
  const dbPath = path.join(__dirname, '..', 'data', 'agentflow.db');
  console.log(`📂 Opening SQLite: ${dbPath}`);
  const sqlite = new Database(dbPath, { readonly: true });

  // Connect to Supabase with service role key (bypasses RLS)
  console.log(`☁️  Connecting to Supabase: ${SUPABASE_URL}`);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // Get all transactions from SQLite
  console.log('');
  console.log('📊 Reading transactions from SQLite...');
  const transactions = sqlite.prepare(`
    SELECT * FROM financial_transactions ORDER BY date DESC
  `).all() as SQLiteTransaction[];
  
  console.log(`   Found ${transactions.length} transactions`);

  // Get date range
  const dates = transactions.map(t => t.date).sort();
  console.log(`   Date range: ${dates[0]} to ${dates[dates.length - 1]}`);

  // Get unique accounts
  const accounts = [...new Set(transactions.map(t => t.account_name))];
  console.log(`   Accounts: ${accounts.length}`);
  accounts.forEach(a => console.log(`      - ${a}`));

  // Check existing transactions in Supabase
  console.log('');
  console.log('🔍 Checking existing Supabase transactions...');
  const { count: existingCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID);
  
  console.log(`   Existing transactions: ${existingCount || 0}`);

  // Convert to Supabase format and insert in batches
  console.log('');
  console.log('🚀 Migrating transactions to Supabase...');
  console.log('─'.repeat(80));

  const BATCH_SIZE = 100;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    
    const supabaseTransactions = batch.map(txn => ({
      user_id: USER_ID,
      account_id: null, // Teller transactions use teller_account_id instead
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
      console.error(`   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += data?.length || batch.length;
      process.stdout.write(`\r   ✅ Progress: ${inserted}/${transactions.length} transactions`);
    }
  }

  console.log('');
  console.log('');
  console.log('═'.repeat(80));
  console.log('   📊 MIGRATION COMPLETE');
  console.log('═'.repeat(80));
  console.log(`   ✅ Inserted/Updated: ${inserted}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log('');

  // Verify final count
  const { count: finalCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID);
  
  console.log(`   📈 Total transactions in Supabase: ${finalCount}`);
  console.log('');

  sqlite.close();
}

migrateTransactions().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

