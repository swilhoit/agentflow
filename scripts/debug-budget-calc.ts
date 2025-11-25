#!/usr/bin/env npx tsx

import { getSQLiteDatabase } from '../src/services/databaseFactory';

const db = getSQLiteDatabase();

// Calculate week range (same logic as budget service)
const now = new Date();
const dayOfWeek = now.getDay();
const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
const startOfWeek = new Date(now);
startOfWeek.setDate(now.getDate() - daysToMonday);
startOfWeek.setHours(0, 0, 0, 0);

const startDate = startOfWeek.toISOString().split('T')[0];
const endDate = now.toISOString().split('T')[0];

console.log(`Week range: ${startDate} to ${endDate}`);
console.log(`Day of week: ${dayOfWeek} (0=Sun, 1=Mon, ...)`);
console.log();

const transactions = db.getTransactionsByDateRange(startDate, endDate);
console.log(`Total transactions in range: ${transactions.length}`);

// Filter same as budget service
const excludeKeywords = [
  'PAYMENT', 'ONLINE PAYMENT', 'AUTOPAY', 'ACH PMT', 'EPAYMENT',
  'WIRE REF', 'TRANSFER', 'INST XFER', 'ROBINHOOD', 'INVESTMENT', 'CREDIT'
];

const allSpending = transactions.filter(t => {
  const upper = t.description.toUpperCase();
  
  if (excludeKeywords.some(kw => upper.includes(kw))) return false;
  
  // Skip income/deposits
  if (upper.includes('FROM ****') || upper.includes('DEPOSIT') || upper.includes('INTERCEPT SALES')) return false;
  
  const isChecking = (t.account_name?.includes('Checking') || t.accountType === 'depository');
  const isPurchase = isChecking ? t.amount < 0 : t.amount > 0;
  
  return isPurchase;
});

console.log(`Filtered spending transactions: ${allSpending.length}`);
console.log();

const total = allSpending.reduce((sum, t) => sum + Math.abs(t.amount), 0);
console.log(`TOTAL: $${total.toFixed(2)}`);
console.log();

// Group by amount to find anomalies
console.log('Top 10 transactions:');
allSpending
  .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  .slice(0, 10)
  .forEach(t => {
    console.log(`  ${t.date} | $${Math.abs(t.amount).toFixed(2).padStart(10)} | ${t.description.slice(0, 40)} | ${t.accountName}`);
  });

process.exit(0);

