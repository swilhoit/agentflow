#!/usr/bin/env tsx

/**
 * Real Spending Analysis (Excluding Transfers & Payments)
 * 
 * Analyzes actual spending, not credit card payments
 */

import { getSQLiteDatabase } from '../src/services/databaseFactory';

const db = getSQLiteDatabase();

console.log('');
console.log('═'.repeat(80));
console.log('   💰 REAL SPENDING ANALYSIS (90 Days)');
console.log('═'.repeat(80));
console.log('');

// Get date ranges
const today = new Date();
const ninetyDaysAgo = new Date();
ninetyDaysAgo.setDate(today.getDate() - 90);

const endDate = today.toISOString().split('T')[0];
const startDate = ninetyDaysAgo.toISOString().split('T')[0];

console.log(`📅 Analysis Period: ${startDate} to ${endDate} (90 days)`);
console.log('');

// Get all transactions
const allTransactions = db.getTransactionsByDateRange(startDate, endDate);

// Filter OUT transfers, payments, and internal movements
const excludeKeywords = [
  'PAYMENT',
  'ONLINE PAYMENT',
  'AUTOPAY',
  'ACH PMT',
  'AMEX EPAYMENT',
  'WIRE REF',
  'ONLINE FROM',
  'INST XFER',
  'TRANSFER',
  'PAYPAL TRANSFER',
  'VENMO TRANSFER',
];

const isTransferOrPayment = (desc: string) => {
  const upper = desc.toUpperCase();
  return excludeKeywords.some(keyword => upper.includes(keyword));
};

// Real expenses = negative amounts that aren't transfers
const realExpenses = allTransactions.filter(t => 
  t.amount < 0 && !isTransferOrPayment(t.description)
);

// Real income = positive amounts that aren't transfers (excluding the $20K loan)
const realIncome = allTransactions.filter(t => 
  t.amount > 0 && 
  !isTransferOrPayment(t.description) &&
  Math.abs(t.amount - 20000.07) > 0.01 // Exclude the $20K loan
);

const totalRealExpenses = Math.abs(realExpenses.reduce((sum, t) => sum + t.amount, 0));
const totalRealIncome = realIncome.reduce((sum, t) => sum + t.amount, 0);
const netCashFlow = totalRealIncome - totalRealExpenses;

console.log('═'.repeat(80));
console.log('   📊 REAL SPENDING (Excluding Transfers & Payments)');
console.log('═'.repeat(80));
console.log('');
console.log(`Total Transactions: ${allTransactions.length}`);
console.log(`Real Expenses: ${realExpenses.length} transactions`);
console.log(`Real Income: ${realIncome.length} transactions`);
console.log(`Excluded (transfers/payments): ${allTransactions.length - realExpenses.length - realIncome.length} transactions`);
console.log('');

console.log('💸 Real Spending Summary:');
console.log('─'.repeat(80));
console.log(`   Total Expenses:  -$${totalRealExpenses.toFixed(2)}`);
console.log(`   Total Income:    +$${totalRealIncome.toFixed(2)}`);
console.log(`   Net Cash Flow:   ${netCashFlow >= 0 ? '+' : ''}$${netCashFlow.toFixed(2)}`);
console.log('');

const avgDailySpend = totalRealExpenses / 90;
const avgWeeklySpend = avgDailySpend * 7;
const avgMonthlySpend = avgDailySpend * 30;

console.log('📈 Real Daily Averages:');
console.log('─'.repeat(80));
console.log(`   Daily:    $${avgDailySpend.toFixed(2)}`);
console.log(`   Weekly:   $${avgWeeklySpend.toFixed(2)}`);
console.log(`   Monthly:  $${avgMonthlySpend.toFixed(2)}`);
console.log('');

// Top spending categories
console.log('═'.repeat(80));
console.log('   💳 REAL SPENDING BY CATEGORY');
console.log('═'.repeat(80));
console.log('');

const categorySpending: Record<string, { total: number; count: number }> = {};
realExpenses.forEach(t => {
  const cat = t.category || 'Uncategorized';
  if (!categorySpending[cat]) {
    categorySpending[cat] = { total: 0, count: 0 };
  }
  categorySpending[cat].total += Math.abs(t.amount);
  categorySpending[cat].count++;
});

const sortedCategories = Object.entries(categorySpending)
  .sort((a, b) => b[1].total - a[1].total);

sortedCategories.forEach(([category, data], index) => {
  const percentage = (data.total / totalRealExpenses * 100);
  const bar = '█'.repeat(Math.floor(percentage / 2));
  console.log(`${(index + 1).toString().padStart(2)}. ${category.padEnd(25)} $${data.total.toFixed(2).padStart(10)} (${percentage.toFixed(1)}%)`);
  console.log(`    ${bar} ${data.count} transactions`);
  console.log('');
});

// Top merchants
console.log('═'.repeat(80));
console.log('   🏪 TOP MERCHANTS (Real Spending)');
console.log('═'.repeat(80));
console.log('');

const merchantSpending: Record<string, number> = {};
realExpenses.forEach(t => {
  const merchant = t.merchant || t.description.split(/\s+/).slice(0, 3).join(' ');
  merchantSpending[merchant] = (merchantSpending[merchant] || 0) + Math.abs(t.amount);
});

const topMerchants = Object.entries(merchantSpending)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15);

topMerchants.forEach(([merchant, amount], index) => {
  console.log(`${(index + 1).toString().padStart(2)}. ${merchant.slice(0, 50).padEnd(50)} $${amount.toFixed(2)}`);
});
console.log('');

// Largest real expenses
console.log('═'.repeat(80));
console.log('   💰 LARGEST REAL EXPENSES');
console.log('═'.repeat(80));
console.log('');

const largestExpenses = [...realExpenses]
  .sort((a, b) => a.amount - b.amount)
  .slice(0, 15);

largestExpenses.forEach((t, index) => {
  console.log(`${(index + 1).toString().padStart(2)}. ${t.date} - ${t.description.slice(0, 50)}`);
  console.log(`    Amount: -$${Math.abs(t.amount).toFixed(2)}`);
  if (t.merchant) console.log(`    Merchant: ${t.merchant}`);
  console.log('');
});

// Spending by account
console.log('═'.repeat(80));
console.log('   🏦 REAL SPENDING BY ACCOUNT');
console.log('═'.repeat(80));
console.log('');

const accountSpending: Record<string, { total: number; count: number }> = {};
realExpenses.forEach(t => {
  const acct = t.accountName || 'Unknown';
  if (!accountSpending[acct]) {
    accountSpending[acct] = { total: 0, count: 0 };
  }
  accountSpending[acct].total += Math.abs(t.amount);
  accountSpending[acct].count++;
});

Object.entries(accountSpending)
  .sort((a, b) => b[1].total - a[1].total)
  .forEach(([account, data]) => {
    console.log(`${account}`);
    console.log(`   Total Spent: $${data.total.toFixed(2)}`);
    console.log(`   Transactions: ${data.count}`);
    console.log(`   Average: $${(data.total / data.count).toFixed(2)} per transaction`);
    console.log('');
  });

// Insights
console.log('═'.repeat(80));
console.log('   💡 KEY INSIGHTS');
console.log('═'.repeat(80));
console.log('');

console.log(`📊 Real spending: $${avgDailySpend.toFixed(2)}/day vs $927/day when including payments`);
console.log(`   That's ${((avgDailySpend / 927) * 100).toFixed(1)}% of what it looked like!`);
console.log('');

if (netCashFlow > 0) {
  console.log(`✅ Positive real cash flow: $${netCashFlow.toFixed(2)} over 90 days`);
} else {
  console.log(`⚠️  Negative real cash flow: -$${Math.abs(netCashFlow).toFixed(2)} over 90 days`);
}
console.log('');

const savingsRate = totalRealIncome > 0 ? ((netCashFlow / totalRealIncome) * 100) : 0;
console.log(`💰 Real Savings Rate: ${savingsRate.toFixed(1)}%`);
console.log('');

if (sortedCategories.length > 0) {
  const topCat = sortedCategories[0];
  console.log(`🏆 Top spending category: ${topCat[0]} ($${topCat[1].total.toFixed(2)} - ${((topCat[1].total / totalRealExpenses) * 100).toFixed(1)}%)`);
  console.log('');
}

console.log(`📅 Real transaction frequency: ${(realExpenses.length / 90).toFixed(1)} purchases per day`);
console.log('');

// Note about the loan
console.log('═'.repeat(80));
console.log('   📝 NOTE ABOUT THE $20K WIRE TRANSFER');
console.log('═'.repeat(80));
console.log('');
console.log('   ⚠️  This analysis EXCLUDES the $20,000 wire transfer since it was a');
console.log('   loan to refinance credit card debt (not income).');
console.log('');
console.log('   Your real financial picture focuses on actual spending vs actual income.');
console.log('');

console.log('═'.repeat(80));
console.log('   ✅ ANALYSIS COMPLETE');
console.log('═'.repeat(80));
console.log('');

process.exit(0);

