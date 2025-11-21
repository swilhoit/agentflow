#!/usr/bin/env tsx

/**
 * 90-Day Financial Analysis
 * 
 * Comprehensive financial analysis of the past 90 days
 */

import { getSQLiteDatabase } from '../src/services/databaseFactory';

const db = getSQLiteDatabase();

console.log('');
console.log('═'.repeat(80));
console.log('   💰 90-DAY FINANCIAL ANALYSIS');
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

// Get all transactions in the period
const allTransactions = db.getTransactionsByDateRange(startDate, endDate);

console.log('═'.repeat(80));
console.log('   📊 OVERVIEW');
console.log('═'.repeat(80));
console.log('');
console.log(`Total Transactions: ${allTransactions.length}`);
console.log('');

// Separate income and expenses
const expenses = allTransactions.filter(t => t.amount < 0);
const income = allTransactions.filter(t => t.amount > 0);

const totalExpenses = Math.abs(expenses.reduce((sum, t) => sum + t.amount, 0));
const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
const netCashFlow = totalIncome - totalExpenses;

console.log('💸 Spending Summary:');
console.log('─'.repeat(80));
console.log(`   Total Expenses:  -$${totalExpenses.toFixed(2)}`);
console.log(`   Total Income:    +$${totalIncome.toFixed(2)}`);
console.log(`   Net Cash Flow:   ${netCashFlow >= 0 ? '+' : ''}$${netCashFlow.toFixed(2)}`);
console.log('');

const avgDailySpend = totalExpenses / 90;
const avgWeeklySpend = avgDailySpend * 7;
const avgMonthlySpend = avgDailySpend * 30;

console.log('📈 Averages:');
console.log('─'.repeat(80));
console.log(`   Daily:    $${avgDailySpend.toFixed(2)}`);
console.log(`   Weekly:   $${avgWeeklySpend.toFixed(2)}`);
console.log(`   Monthly:  $${avgMonthlySpend.toFixed(2)}`);
console.log('');

// Spending by category
console.log('═'.repeat(80));
console.log('   💳 SPENDING BY CATEGORY');
console.log('═'.repeat(80));
console.log('');

const spendingByCategory = db.getSpendingSummary(startDate, endDate);

if (spendingByCategory.length > 0) {
  spendingByCategory.slice(0, 10).forEach((cat, index) => {
    const percentage = (Math.abs(cat.total_spent) / totalExpenses * 100);
    const bar = '█'.repeat(Math.floor(percentage / 2));
    console.log(`${index + 1}. ${(cat.category || 'Uncategorized').padEnd(25)} $${Math.abs(cat.total_spent).toFixed(2).padStart(12)} (${percentage.toFixed(1)}%)`);
    console.log(`   ${bar} ${cat.transaction_count} transactions`);
    console.log('');
  });
} else {
  console.log('   No categorized spending data available');
  console.log('');
}

// Account breakdown
console.log('═'.repeat(80));
console.log('   🏦 SPENDING BY ACCOUNT');
console.log('═'.repeat(80));
console.log('');

const accountSpending: Record<string, { expenses: number; income: number; count: number }> = {};

allTransactions.forEach(t => {
  const acct = t.accountName || 'Unknown';
  if (!accountSpending[acct]) {
    accountSpending[acct] = { expenses: 0, income: 0, count: 0 };
  }
  if (t.amount < 0) {
    accountSpending[acct].expenses += Math.abs(t.amount);
  } else {
    accountSpending[acct].income += t.amount;
  }
  accountSpending[acct].count++;
});

Object.entries(accountSpending)
  .sort((a, b) => b[1].expenses - a[1].expenses)
  .forEach(([account, data]) => {
    console.log(`${account}`);
    console.log(`   Expenses: -$${data.expenses.toFixed(2)}`);
    console.log(`   Income:   +$${data.income.toFixed(2)}`);
    console.log(`   Net:      ${(data.income - data.expenses) >= 0 ? '+' : ''}$${(data.income - data.expenses).toFixed(2)}`);
    console.log(`   Transactions: ${data.count}`);
    console.log('');
  });

// Top merchants
console.log('═'.repeat(80));
console.log('   🏪 TOP MERCHANTS');
console.log('═'.repeat(80));
console.log('');

const merchantSpending: Record<string, number> = {};
expenses.forEach(t => {
  const merchant = t.merchant || t.description.split(/\s+/).slice(0, 3).join(' ');
  merchantSpending[merchant] = (merchantSpending[merchant] || 0) + Math.abs(t.amount);
});

const topMerchants = Object.entries(merchantSpending)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

topMerchants.forEach(([merchant, amount], index) => {
  console.log(`${(index + 1).toString().padStart(2)}. ${merchant.slice(0, 50).padEnd(50)} $${amount.toFixed(2)}`);
});
console.log('');

// Recent large transactions
console.log('═'.repeat(80));
console.log('   💰 LARGEST TRANSACTIONS');
console.log('═'.repeat(80));
console.log('');

const largestExpenses = [...expenses]
  .sort((a, b) => a.amount - b.amount)
  .slice(0, 10);

console.log('Largest Expenses:');
console.log('─'.repeat(80));
largestExpenses.forEach((t, index) => {
  console.log(`${index + 1}. ${t.date} - ${t.description.slice(0, 45)}`);
  console.log(`   Amount: -$${Math.abs(t.amount).toFixed(2)}`);
  console.log(`   Account: ${t.accountName || 'Unknown'}`);
  console.log('');
});

const largestIncome = [...income]
  .sort((a, b) => b.amount - a.amount)
  .slice(0, 5);

if (largestIncome.length > 0) {
  console.log('Largest Income:');
  console.log('─'.repeat(80));
  largestIncome.forEach((t, index) => {
    console.log(`${index + 1}. ${t.date} - ${t.description.slice(0, 45)}`);
    console.log(`   Amount: +$${t.amount.toFixed(2)}`);
    console.log(`   Account: ${t.accountName || 'Unknown'}`);
    console.log('');
  });
}

// Spending trends
console.log('═'.repeat(80));
console.log('   📊 SPENDING TRENDS');
console.log('═'.repeat(80));
console.log('');

// Group by week
const weeklySpending: Record<string, number> = {};
expenses.forEach(t => {
  const date = new Date(t.date);
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  const weekKey = weekStart.toISOString().split('T')[0];
  weeklySpending[weekKey] = (weeklySpending[weekKey] || 0) + Math.abs(t.amount);
});

const weeks = Object.entries(weeklySpending).sort((a, b) => a[0].localeCompare(b[0]));
console.log('Weekly Spending (last 13 weeks):');
console.log('─'.repeat(80));
weeks.slice(-13).forEach(([week, amount]) => {
  const bar = '█'.repeat(Math.floor(amount / 100));
  console.log(`Week of ${week}: $${amount.toFixed(2).padStart(10)} ${bar}`);
});
console.log('');

// Insights
console.log('═'.repeat(80));
console.log('   💡 KEY INSIGHTS');
console.log('═'.repeat(80));
console.log('');

if (netCashFlow > 0) {
  console.log(`✅ Positive cash flow: You saved $${netCashFlow.toFixed(2)} over 90 days`);
} else {
  console.log(`⚠️  Negative cash flow: Spending exceeded income by $${Math.abs(netCashFlow).toFixed(2)}`);
}
console.log('');

const savingsRate = totalIncome > 0 ? ((netCashFlow / totalIncome) * 100) : 0;
if (savingsRate > 0) {
  console.log(`💰 Savings Rate: ${savingsRate.toFixed(1)}% of income`);
} else {
  console.log(`💸 Spending Rate: ${Math.abs(savingsRate).toFixed(1)}% over income`);
}
console.log('');

if (spendingByCategory.length > 0) {
  const topCategory = spendingByCategory[0];
  const topCatPercentage = (Math.abs(topCategory.total_spent) / totalExpenses * 100);
  console.log(`🏆 Top spending category: ${topCategory.category || 'Uncategorized'} ($${Math.abs(topCategory.total_spent).toFixed(2)} - ${topCatPercentage.toFixed(1)}%)`);
  console.log('');
}

console.log(`📅 Transaction frequency: ${(allTransactions.length / 90).toFixed(1)} transactions per day`);
console.log('');

// Compare weeks
if (weeks.length >= 2) {
  const lastWeek = weeks[weeks.length - 1][1];
  const prevWeek = weeks[weeks.length - 2][1];
  const weekChange = ((lastWeek - prevWeek) / prevWeek * 100);
  
  if (weekChange > 0) {
    console.log(`📈 Last week spending increased by ${weekChange.toFixed(1)}% compared to previous week`);
  } else {
    console.log(`📉 Last week spending decreased by ${Math.abs(weekChange).toFixed(1)}% compared to previous week`);
  }
  console.log('');
}

console.log('═'.repeat(80));
console.log('   ✅ ANALYSIS COMPLETE');
console.log('═'.repeat(80));
console.log('');
console.log('💡 Recommendations:');
console.log(`   • Track spending in top categories to identify savings opportunities`);
console.log(`   • Review large recurring transactions`);
console.log(`   • Set budgets for high-spend categories`);
console.log(`   • Monitor weekly spending trends`);
console.log('');

process.exit(0);

