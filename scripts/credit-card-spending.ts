#!/usr/bin/env tsx

/**
 * Credit Card Spending Analysis
 * 
 * Analyzes ACTUAL purchases on credit cards (not payments)
 */

import { getSQLiteDatabase } from '../src/services/databaseFactory';

const db = getSQLiteDatabase();

console.log('');
console.log('═'.repeat(80));
console.log('   💳 ACTUAL CREDIT CARD SPENDING ANALYSIS (90 Days)');
console.log('═'.repeat(80));
console.log('');

const today = new Date();
const ninetyDaysAgo = new Date();
ninetyDaysAgo.setDate(today.getDate() - 90);
const endDate = today.toISOString().split('T')[0];
const startDate = ninetyDaysAgo.toISOString().split('T')[0];

console.log(`📅 Period: ${startDate} to ${endDate}\n`);

const allTxns = db.getTransactionsByDateRange(startDate, endDate);

// Filter to actual credit card PURCHASES (negative amounts, exclude payments/transfers/credits)
const excludeKeywords = [
  'PAYMENT', 'ONLINE PAYMENT', 'AUTOPAY', 'ACH PMT', 'EPAYMENT',
  'THANK YOU', 'CREDIT', 'REFUND', 'WIRE', 'TRANSFER', 'INST XFER'
];

const isExcluded = (desc: string) => {
  const upper = desc.toUpperCase();
  return excludeKeywords.some(kw => upper.includes(kw));
};

// For credit cards: POSITIVE = purchases (money you owe), NEGATIVE = payments
// For checking: NEGATIVE = expenses, POSITIVE = income
const creditCardAccounts = ['Delta SkyMiles', 'Blue Business', 'Hilton Honors'];
const isCreditCard = (t: any) => {
  const acctName = t.accountName || t.account_name || '';
  return creditCardAccounts.some(cc => acctName.includes(cc));
};

const purchases = allTxns.filter(t => {
  if (isCreditCard(t)) {
    // Credit card: purchases are positive amounts, exclude interest charges
    return t.amount > 0 && !t.description.toUpperCase().includes('INTEREST');
  } else {
    // Checking account: expenses are negative, exclude payments/transfers
    return t.amount < 0 && !isExcluded(t.description);
  }
});

const totalSpent = purchases.reduce((sum, t) => sum + Math.abs(t.amount), 0);

console.log('═'.repeat(80));
console.log('   📊 OVERVIEW');
console.log('═'.repeat(80));
console.log('');
console.log(`Total Purchases: ${purchases.length}`);
console.log(`Total Spent: $${totalSpent.toFixed(2)}`);
console.log('');
console.log(`Daily Average: $${(totalSpent / 90).toFixed(2)}`);
console.log(`Weekly Average: $${(totalSpent / 90 * 7).toFixed(2)}`);
console.log(`Monthly Average: $${(totalSpent / 3).toFixed(2)}`);
console.log('');

// By category
console.log('═'.repeat(80));
console.log('   🎯 SPENDING BY CATEGORY');
console.log('═'.repeat(80));
console.log('');

const categories: Record<string, { total: number; count: number; txns: any[] }> = {};
purchases.forEach(t => {
  const cat = t.category || 'Uncategorized';
  if (!categories[cat]) categories[cat] = { total: 0, count: 0, txns: [] };
  categories[cat].total += Math.abs(t.amount);
  categories[cat].count++;
  categories[cat].txns.push(t);
});

const sortedCats = Object.entries(categories).sort((a, b) => b[1].total - a[1].total);

sortedCats.forEach(([cat, data], idx) => {
  const pct = (data.total / totalSpent * 100);
  const monthly = data.total / 3;
  const bar = '█'.repeat(Math.floor(pct / 2));
  console.log(`${(idx + 1).toString().padStart(2)}. ${cat.padEnd(25)} $${data.total.toFixed(2).padStart(10)} ($${monthly.toFixed(2)}/mo)`);
  console.log(`    ${bar} ${data.count} purchases`);
  console.log('');
});

// Top merchants
console.log('═'.repeat(80));
console.log('   🏪 TOP MERCHANTS');
console.log('═'.repeat(80));
console.log('');

const merchants: Record<string, number> = {};
purchases.forEach(t => {
  const merch = t.merchant || t.description.split(/\s+/).slice(0, 3).join(' ');
  merchants[merch] = (merchants[merch] || 0) + Math.abs(t.amount);
});

const topMerchants = Object.entries(merchants)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25);

topMerchants.forEach(([merch, amt], idx) => {
  console.log(`${(idx + 1).toString().padStart(2)}. ${merch.slice(0, 50).padEnd(50)} $${amt.toFixed(2)}`);
});
console.log('');

// Dining & Food
console.log('═'.repeat(80));
console.log('   🍽️  FOOD & DINING BREAKDOWN');
console.log('═'.repeat(80));
console.log('');

const foodKeywords = ['restaurant', 'food', 'dining', 'cafe', 'coffee', 'pizza', 'burger', 'sushi', 'bar', 'grill', 'kitchen', 'taco', 'bistro'];
const groceryKeywords = ['market', 'grocery', 'whole foods', 'trader', 'safeway', 'target', 'walmart', 'costco'];

const dining = purchases.filter(t => {
  const desc = t.description.toLowerCase();
  return foodKeywords.some(kw => desc.includes(kw)) || t.category?.toLowerCase().includes('dining');
});

const groceries = purchases.filter(t => {
  const desc = t.description.toLowerCase();
  return groceryKeywords.some(kw => desc.includes(kw)) || t.category?.toLowerCase().includes('grocery');
});

const diningTotal = dining.reduce((sum, t) => sum + Math.abs(t.amount), 0);
const groceryTotal = groceries.reduce((sum, t) => sum + Math.abs(t.amount), 0);

console.log(`Dining Out: $${diningTotal.toFixed(2)} (${dining.length} transactions)`);
console.log(`  Monthly: $${(diningTotal / 3).toFixed(2)}`);
console.log(`  Average per meal: $${dining.length > 0 ? (diningTotal / dining.length).toFixed(2) : '0.00'}`);
console.log('');
console.log(`Groceries: $${groceryTotal.toFixed(2)} (${groceries.length} transactions)`);
console.log(`  Monthly: $${(groceryTotal / 3).toFixed(2)}`);
console.log('');
console.log(`Total Food: $${(diningTotal + groceryTotal).toFixed(2)}`);
console.log(`  Monthly: $${((diningTotal + groceryTotal) / 3).toFixed(2)}`);
console.log('');

// Travel
console.log('═'.repeat(80));
console.log('   ✈️  TRAVEL & TRANSPORTATION');
console.log('═'.repeat(80));
console.log('');

const travelKeywords = ['airline', 'flight', 'hotel', 'airbnb', 'uber', 'lyft', 'waymo', 'parking', 'rental', 'gas', 'station'];
const travel = purchases.filter(t => {
  const desc = t.description.toLowerCase();
  return travelKeywords.some(kw => desc.includes(kw)) || t.category?.toLowerCase().includes('travel') || t.category?.toLowerCase().includes('transportation');
});

const travelTotal = travel.reduce((sum, t) => sum + Math.abs(t.amount), 0);

console.log(`Total Travel: $${travelTotal.toFixed(2)} (${travel.length} transactions)`);
console.log(`  Monthly: $${(travelTotal / 3).toFixed(2)}`);
if (travel.length > 0) {
  console.log('');
  console.log('Recent travel expenses:');
  travel.slice(0, 10).forEach(t => {
    console.log(`  ${t.date} - ${t.description.slice(0, 40)} - $${Math.abs(t.amount).toFixed(2)}`);
  });
}
console.log('');

// Tech/Software
console.log('═'.repeat(80));
console.log('   💻 TECH & SOFTWARE');
console.log('═'.repeat(80));
console.log('');

const techKeywords = ['software', 'saas', 'subscription', 'cloud', 'api', 'github', 'vercel', 'anthropic', 'openai', 'cursor', 'netflix', 'spotify', 'apple'];
const tech = purchases.filter(t => {
  const desc = t.description.toLowerCase();
  return techKeywords.some(kw => desc.includes(kw)) || t.category?.toLowerCase().includes('software');
});

const techTotal = tech.reduce((sum, t) => sum + Math.abs(t.amount), 0);

console.log(`Total Tech/Software: $${techTotal.toFixed(2)} (${tech.length} transactions)`);
console.log(`  Monthly: $${(techTotal / 3).toFixed(2)}`);
if (tech.length > 0) {
  console.log('');
  console.log('Software subscriptions:');
  const techByMerchant: Record<string, number> = {};
  tech.forEach(t => {
    const merch = t.merchant || t.description.split(/\s+/).slice(0, 2).join(' ');
    techByMerchant[merch] = (techByMerchant[merch] || 0) + Math.abs(t.amount);
  });
  Object.entries(techByMerchant)
    .sort((a, b) => b[1] - a[1])
    .forEach(([merch, amt]) => {
      console.log(`  ${merch}: $${amt.toFixed(2)}`);
    });
}
console.log('');

// Largest purchases
console.log('═'.repeat(80));
console.log('   💰 LARGEST PURCHASES');
console.log('═'.repeat(80));
console.log('');

const largest = [...purchases].sort((a, b) => a.amount - b.amount).slice(0, 15);

largest.forEach((t, idx) => {
  console.log(`${(idx + 1).toString().padStart(2)}. ${t.date} - ${t.description.slice(0, 50)}`);
  console.log(`    $${Math.abs(t.amount).toFixed(2)} ${t.merchant ? `(${t.merchant})` : ''}`);
  console.log('');
});

// Summary
console.log('═'.repeat(80));
console.log('   💡 KEY INSIGHTS');
console.log('═'.repeat(80));
console.log('');

console.log(`📊 You're spending $${(totalSpent / 90).toFixed(2)}/day on actual purchases`);
console.log(`   That's $${(totalSpent / 3).toFixed(2)}/month in credit card spending`);
console.log('');

const breakdown = [
  { name: 'Food (dining + groceries)', amount: diningTotal + groceryTotal },
  { name: 'Travel & Transportation', amount: travelTotal },
  { name: 'Tech & Software', amount: techTotal },
  { name: 'Other', amount: totalSpent - diningTotal - groceryTotal - travelTotal - techTotal }
];

console.log('🎯 Spending breakdown:');
breakdown
  .sort((a, b) => b.amount - a.amount)
  .forEach(item => {
    const pct = (item.amount / totalSpent * 100);
    console.log(`   ${item.name}: $${item.amount.toFixed(2)} (${pct.toFixed(1)}%)`);
  });

console.log('');
console.log('═'.repeat(80));
console.log('   ✅ ANALYSIS COMPLETE');
console.log('═'.repeat(80));
console.log('');

process.exit(0);

