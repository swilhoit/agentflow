#!/usr/bin/env tsx

import { getSQLiteDatabase } from '../src/services/databaseFactory';

const db = getSQLiteDatabase();

console.log('📅 Checking Truist Transaction Date Range...\n');

// Get all transactions from Truist account
const allTxns = db.getRecentTransactions(365, 1000);
const truistTxns = allTxns.filter(t => t.accountName?.includes('Checking 4536') || t.accountName?.includes('Truist'));

if (truistTxns.length === 0) {
  console.log('❌ No Truist transactions found in database');
  process.exit(1);
}

// Sort by date
const sortedTxns = truistTxns.sort((a, b) => a.date.localeCompare(b.date));

const earliest = sortedTxns[0].date;
const latest = sortedTxns[sortedTxns.length - 1].date;

// Calculate days span
const start = new Date(earliest);
const end = new Date(latest);
const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

console.log('═'.repeat(70));
console.log('   📊 Truist Checking Account (••4536)');
console.log('═'.repeat(70));
console.log('');
console.log(`   Earliest Transaction: ${earliest}`);
console.log(`   Latest Transaction:   ${latest}`);
console.log(`   Time Span:           ${daysDiff} days`);
console.log(`   Total Transactions:  ${truistTxns.length}`);
console.log('');

// Show first 5 and last 5 transactions
console.log('📝 Earliest 5 Transactions:');
console.log('─'.repeat(70));
sortedTxns.slice(0, 5).forEach((txn, i) => {
  console.log(`${i + 1}. ${txn.date} - ${txn.description}`);
  console.log(`   Amount: $${txn.amount}`);
});

console.log('');
console.log('📝 Latest 5 Transactions:');
console.log('─'.repeat(70));
sortedTxns.slice(-5).forEach((txn, i) => {
  console.log(`${i + 1}. ${txn.date} - ${txn.description}`);
  console.log(`   Amount: $${txn.amount}`);
});

console.log('');
console.log('═'.repeat(70));

