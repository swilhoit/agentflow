#!/usr/bin/env tsx

/**
 * Baseline Monthly Spending
 * 
 * Separates recurring expenses from one-time purchases
 */

import { getSQLiteDatabase } from '../src/services/databaseFactory';

const db = getSQLiteDatabase();

console.log('');
console.log('═'.repeat(80));
console.log('   💰 BASELINE MONTHLY SPENDING (Recurring vs One-Time)');
console.log('═'.repeat(80));
console.log('');

const today = new Date();
const ninetyDaysAgo = new Date();
ninetyDaysAgo.setDate(today.getDate() - 90);
const endDate = today.toISOString().split('T')[0];
const startDate = ninetyDaysAgo.toISOString().split('T')[0];

console.log(`📅 Period: ${startDate} to ${endDate}\n`);

const allTxns = db.getTransactionsByDateRange(startDate, endDate);

const excludeKeywords = [
  'PAYMENT', 'ONLINE PAYMENT', 'AUTOPAY', 'ACH PMT', 'EPAYMENT',
  'THANK YOU', 'CREDIT', 'REFUND', 'WIRE', 'TRANSFER', 'INST XFER'
];

const isExcluded = (desc: string) => {
  const upper = desc.toUpperCase();
  return excludeKeywords.some(kw => upper.includes(kw));
};

const creditCardAccounts = ['Delta SkyMiles', 'Blue Business', 'Hilton Honors'];
const isCreditCard = (t: any) => {
  const acctName = t.accountName || t.account_name || '';
  return creditCardAccounts.some(cc => acctName.includes(cc));
};

const purchases = allTxns.filter(t => {
  if (isCreditCard(t)) {
    return t.amount > 0 && !t.description.toUpperCase().includes('INTEREST');
  } else {
    return t.amount < 0 && !isExcluded(t.description);
  }
});

// Define one-time / irregular purchases
const oneTimeMerchants = [
  'OC CAMERAS',           // $2,252 - Camera gear
  'DELTA AIR',            // $1,562 - Flights (occasional)
  'AIRBNB',               // $525 - Travel accommodation
  'HILTON',               // $514 - Hotel stays
  'APLPAY REI',           // $427 - Outdoor gear (one-time)
  'GOODPEEPLES',          // $320 - One-time
  'NAMECHEAP',            // $260 - Domain renewals (annual?)
  'FRAMER',               // $255 - Design tool (could be recurring?)
  'ROBINHOOD',            // $2,905 - Investments (not spending)
  'STATEWIDE',            // $2,550 - Rent (handled separately)
  'ENTERP',               // Rent
];

const isOneTime = (t: any) => {
  const desc = t.description.toUpperCase();
  const merch = (t.merchant || '').toUpperCase();
  return oneTimeMerchants.some(om => desc.includes(om) || merch.includes(om));
};

const recurringExpenses = purchases.filter(t => !isOneTime(t));
const oneTimeExpenses = purchases.filter(t => isOneTime(t));

const recurringTotal = recurringExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
const oneTimeTotal = oneTimeExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
const totalSpent = purchases.reduce((sum, t) => sum + Math.abs(t.amount), 0);

console.log('═'.repeat(80));
console.log('   📊 SPENDING BREAKDOWN');
console.log('═'.repeat(80));
console.log('');
console.log(`Total Spending (90 days): $${totalSpent.toFixed(2)}`);
console.log('');
console.log(`Recurring Monthly Expenses: $${(recurringTotal / 3).toFixed(2)}/month`);
console.log(`  Total over 90 days: $${recurringTotal.toFixed(2)}`);
console.log(`  Transactions: ${recurringExpenses.length}`);
console.log('');
console.log(`One-Time/Irregular Purchases: $${oneTimeTotal.toFixed(2)}`);
console.log(`  Transactions: ${oneTimeExpenses.length}`);
console.log('');

// Break down recurring by category
console.log('═'.repeat(80));
console.log('   🔁 RECURRING MONTHLY EXPENSES');
console.log('═'.repeat(80));
console.log('');

const recurringByCategory: Record<string, { total: number; count: number }> = {};
recurringExpenses.forEach(t => {
  const cat = t.category || 'Uncategorized';
  if (!recurringByCategory[cat]) recurringByCategory[cat] = { total: 0, count: 0 };
  recurringByCategory[cat].total += Math.abs(t.amount);
  recurringByCategory[cat].count++;
});

Object.entries(recurringByCategory)
  .sort((a, b) => b[1].total - a[1].total)
  .forEach(([cat, data]) => {
    const monthly = data.total / 3;
    console.log(`${cat.padEnd(25)} $${monthly.toFixed(2).padStart(10)}/mo (${data.count} purchases)`);
  });
console.log('');

// Top recurring merchants
console.log('═'.repeat(80));
console.log('   🏪 RECURRING MERCHANTS (Monthly Average)');
console.log('═'.repeat(80));
console.log('');

const recurringMerchants: Record<string, number> = {};
recurringExpenses.forEach(t => {
  const merch = t.merchant || t.description.split(/\s+/).slice(0, 3).join(' ');
  recurringMerchants[merch] = (recurringMerchants[merch] || 0) + Math.abs(t.amount);
});

Object.entries(recurringMerchants)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([merch, amt]) => {
    const monthly = amt / 3;
    console.log(`${merch.slice(0, 50).padEnd(50)} $${monthly.toFixed(2)}/mo`);
  });
console.log('');

// One-time breakdown
console.log('═'.repeat(80));
console.log('   🎯 ONE-TIME / IRREGULAR PURCHASES');
console.log('═'.repeat(80));
console.log('');

const oneTimeMerchantTotals: Record<string, { total: number; txns: any[] }> = {};
oneTimeExpenses.forEach(t => {
  const merch = t.merchant || t.description.split(/\s+/).slice(0, 3).join(' ');
  if (!oneTimeMerchantTotals[merch]) oneTimeMerchantTotals[merch] = { total: 0, txns: [] };
  oneTimeMerchantTotals[merch].total += Math.abs(t.amount);
  oneTimeMerchantTotals[merch].txns.push(t);
});

Object.entries(oneTimeMerchantTotals)
  .sort((a, b) => b[1].total - a[1].total)
  .forEach(([merch, data]) => {
    console.log(`${merch.slice(0, 50).padEnd(50)} $${data.total.toFixed(2)}`);
    if (data.txns.length <= 3) {
      data.txns.forEach(t => {
        console.log(`  ${t.date} - $${Math.abs(t.amount).toFixed(2)}`);
      });
    } else {
      console.log(`  (${data.txns.length} transactions)`);
    }
    console.log('');
  });

// Food breakdown (recurring)
console.log('═'.repeat(80));
console.log('   🍽️  FOOD SPENDING (Recurring)');
console.log('═'.repeat(80));
console.log('');

const foodKeywords = ['restaurant', 'food', 'dining', 'cafe', 'coffee', 'pizza', 'burger', 'kitchen', 'doms', 'taco', 'grill'];
const groceryKeywords = ['wholefds', 'whole foods', 'sprouts', 'lassens', 'market', 'grocery'];

const recurringDining = recurringExpenses.filter(t => {
  const desc = t.description.toLowerCase();
  return foodKeywords.some(kw => desc.includes(kw));
});

const recurringGroceries = recurringExpenses.filter(t => {
  const desc = t.description.toLowerCase();
  return groceryKeywords.some(kw => desc.includes(kw));
});

const diningTotal = recurringDining.reduce((sum, t) => sum + Math.abs(t.amount), 0);
const groceryTotal = recurringGroceries.reduce((sum, t) => sum + Math.abs(t.amount), 0);

console.log(`Dining Out: $${(diningTotal / 3).toFixed(2)}/month`);
console.log(`  Total: $${diningTotal.toFixed(2)} (${recurringDining.length} meals)`);
console.log(`  Average: $${recurringDining.length > 0 ? (diningTotal / recurringDining.length).toFixed(2) : '0.00'} per meal`);
console.log('');
console.log(`Groceries: $${(groceryTotal / 3).toFixed(2)}/month`);
console.log(`  Total: $${groceryTotal.toFixed(2)} (${recurringGroceries.length} trips)`);
console.log('');
console.log(`Total Food: $${((diningTotal + groceryTotal) / 3).toFixed(2)}/month`);
console.log('');

// Tech/Software (recurring subscriptions)
console.log('═'.repeat(80));
console.log('   💻 TECH & SOFTWARE SUBSCRIPTIONS');
console.log('═'.repeat(80));
console.log('');

const techKeywords = ['claude', 'cursor', 'anthropic', 'openai', 'chatgpt', 'vercel', 'heroku', 'figma', 'google', 'microsoft', 'github', 'scraper'];
const recurringTech = recurringExpenses.filter(t => {
  const desc = t.description.toLowerCase();
  return techKeywords.some(kw => desc.includes(kw));
});

const techTotal = recurringTech.reduce((sum, t) => sum + Math.abs(t.amount), 0);
console.log(`Total Tech/Software: $${(techTotal / 3).toFixed(2)}/month`);
console.log('');

const techByMerch: Record<string, number> = {};
recurringTech.forEach(t => {
  const merch = t.merchant || t.description.split(/\s+/).slice(0, 2).join(' ');
  techByMerch[merch] = (techByMerch[merch] || 0) + Math.abs(t.amount);
});

Object.entries(techByMerch)
  .sort((a, b) => b[1] - a[1])
  .forEach(([merch, amt]) => {
    console.log(`  ${merch}: $${(amt / 3).toFixed(2)}/month (total: $${amt.toFixed(2)})`);
  });
console.log('');

// Summary
console.log('═'.repeat(80));
console.log('   💡 YOUR REAL BASELINE MONTHLY SPENDING');
console.log('═'.repeat(80));
console.log('');

const monthlyRecurring = recurringTotal / 3;

console.log(`📊 Recurring Monthly Expenses: $${monthlyRecurring.toFixed(2)}/month`);
console.log(`   (This is what you actually spend month-to-month)`);
console.log('');
console.log(`🎯 One-Time Purchases (90 days): $${oneTimeTotal.toFixed(2)}`);
console.log(`   - Camera gear: ~$2,252`);
console.log(`   - Travel (flights/hotels): ~$2,600`);
console.log(`   - REI gear: ~$427`);
console.log(`   - Investments: ~$2,905`);
console.log(`   - Rent: ~$4,000`);
console.log('');
console.log(`💸 Without the big one-time purchases, your baseline is:`);
console.log(`   ~$${monthlyRecurring.toFixed(2)}/month in actual lifestyle spending`);
console.log('');

console.log('═'.repeat(80));
console.log('   ✅ ANALYSIS COMPLETE');
console.log('═'.repeat(80));
console.log('');

process.exit(0);

