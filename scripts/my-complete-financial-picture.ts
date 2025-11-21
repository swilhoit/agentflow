#!/usr/bin/env npx tsx
/**
 * Complete Financial Picture - Corrected for Credit Card Accounting
 * 
 * Credit cards: positive amounts = purchases (increase balance)
 * Checking: negative amounts = purchases (decrease balance)
 */

import { getSQLiteDatabase } from '../src/services/databaseFactory';
import type { DatabaseService } from '../src/services/database';

async function main() {
  const db: DatabaseService = getSQLiteDatabase();
  
  // Get last 90 days of data
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  console.log('💰 YOUR COMPLETE FINANCIAL PICTURE');
  console.log('='.repeat(70));
  console.log(`Analysis Period: ${startStr} to ${endStr} (90 days)`);
  console.log();
  
  // Get all transactions
  const allTransactions = db.getTransactionsByDateRange(startStr, endStr);
  
  console.log(`Total transactions: ${allTransactions.length}`);
  
  // Separate by account type
  const creditCardTransactions = allTransactions.filter(t => 
    !t.account_name?.includes('Checking')
  );
  const checkingTransactions = allTransactions.filter(t => 
    t.account_name?.includes('Checking')
  );
  
  console.log(`Credit card transactions: ${creditCardTransactions.length}`);
  console.log(`Checking transactions: ${checkingTransactions.length}`);
  console.log();
  
  // ============================================================================
  // INCOME
  // ============================================================================
  console.log('💵 INCOME');
  console.log('-'.repeat(70));
  
  // Income from checking account (deposits)
  const incomeTransactions = checkingTransactions.filter(t => {
    const desc = t.description.toUpperCase();
    return t.amount > 0 && 
           !desc.includes('TRANSFER FROM') && 
           !desc.includes('REFUND') &&
           !desc.includes('ADJUSTMENT') &&
           t.amount > 500; // Likely paychecks
  });
  
  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const monthlyIncome = (totalIncome / 90) * 30;
  
  console.log(`Total Income (90 days): $${totalIncome.toFixed(2)}`);
  console.log(`Average Monthly Income: $${monthlyIncome.toFixed(2)}`);
  console.log();
  
  // ============================================================================
  // DEBT SITUATION
  // ============================================================================
  console.log('🏦 DEBT & LOAN OBLIGATIONS');
  console.log('-'.repeat(70));
  
  const loanPayment = 2000; // User stated $2k/month loan payment
  const loanAmount = 20000; // User stated $20k consolidation loan
  
  console.log(`Credit Card Consolidation Loan: $${loanAmount.toFixed(2)}`);
  console.log(`Monthly Loan Payment: $${loanPayment.toFixed(2)}`);
  console.log(`Purpose: Refinanced credit card debt`);
  console.log();
  
  // ============================================================================
  // RECURRING MONTHLY EXPENSES
  // ============================================================================
  console.log('🏠 RECURRING MONTHLY EXPENSES');
  console.log('-'.repeat(70));
  
  const rent = 1300; // User stated $1300/month
  
  console.log(`Rent (Statewide/Enterprise): $${rent.toFixed(2)}/month`);
  console.log(`Loan Payment: $${loanPayment.toFixed(2)}/month`);
  console.log();
  console.log(`Total Fixed Expenses: $${(rent + loanPayment).toFixed(2)}/month`);
  console.log();
  
  // ============================================================================
  // LIFESTYLE SPENDING (Credit Card Purchases)
  // ============================================================================
  console.log('💳 LIFESTYLE SPENDING (Past 90 Days)');
  console.log('-'.repeat(70));
  
  // For credit cards: purchases are POSITIVE amounts
  const creditCardPurchases = creditCardTransactions.filter(t => {
    if (t.amount <= 0) return false; // Payments are negative
    const desc = t.description.toUpperCase();
    // Exclude credits and refunds
    return !desc.includes('CREDIT') || desc.includes('UBER');
  });
  
  // Categorize spending
  const categorizeTransaction = (t: any) => {
    const desc = t.description.toLowerCase();
    
    // Groceries
    if (/lassens|whole\s*foods|wholefds|trader\s*joe|sprouts|market|grocery|yucca.*market|ralphs|vons|target.*grocery|costco/.test(desc)) {
      return 'groceries';
    }
    
    // Dining (restaurants, bars, coffee)
    if (/restaurant|dining|bar|cafe|coffee|tst\*|xibei|lotus\s*lounge|valerie\s*echo|shadowbrook|little\s*doms|mun\s*korean|glowing|canyon|blaine.*s|pizz|burger|sushi|kitchen|grill|bistro|taco|mexican|chinese|italian|thai/.test(desc)) {
      return 'dining';
    }
    
    // Transportation
    if (/uber|lyft|waymo|bt\*waymo|ride|taxi/.test(desc)) {
      return 'transportation';
    }
    
    // Shopping
    if (/amazon|retail|store|shop/.test(desc) && !/market/.test(desc)) {
      return 'shopping';
    }
    
    // Entertainment
    if (/entertainment|movie|theater|concert|sport|game|spotify|netflix|hulu/.test(desc)) {
      return 'entertainment';
    }
    
    // Travel
    if (/hotel|airbnb|flight|airline|travel|delta/.test(desc)) {
      return 'travel';
    }
    
    // Tech/Work (software, subscriptions, dev tools)
    if (/cursor|claude|anthropic|openai|vercel|figma|github|google.*cloud|perplexity|elevenlabs|apollo\.io|stripe|heroku|aws|digital.*ocean|netlify|phone|at&t|verizon/.test(desc)) {
      return 'tech';
    }
    
    return 'other';
  };
  
  const spendingByCategory: Record<string, { total: number; count: number; transactions: any[] }> = {
    groceries: { total: 0, count: 0, transactions: [] },
    dining: { total: 0, count: 0, transactions: [] },
    transportation: { total: 0, count: 0, transactions: [] },
    shopping: { total: 0, count: 0, transactions: [] },
    entertainment: { total: 0, count: 0, transactions: [] },
    travel: { total: 0, count: 0, transactions: [] },
    tech: { total: 0, count: 0, transactions: [] },
    other: { total: 0, count: 0, transactions: [] }
  };
  
  creditCardPurchases.forEach(t => {
    const category = categorizeTransaction(t);
    spendingByCategory[category].total += t.amount;
    spendingByCategory[category].count += 1;
    spendingByCategory[category].transactions.push(t);
  });
  
  // Calculate totals
  const totalSpending = Object.values(spendingByCategory).reduce((sum, cat) => sum + cat.total, 0);
  const monthlySpending = (totalSpending / 90) * 30;
  
  console.log(`Total Credit Card Purchases (90 days): $${totalSpending.toFixed(2)}`);
  console.log(`Average Monthly Spending: $${monthlySpending.toFixed(2)}`);
  console.log();
  
  // Show by category
  console.log('Breakdown by Category (Monthly Average):');
  const sortedCategories = Object.entries(spendingByCategory)
    .sort((a, b) => b[1].total - a[1].total)
    .filter(([_, data]) => data.total > 0);
  
  sortedCategories.forEach(([category, data]) => {
    const monthly = (data.total / 90) * 30;
    const percent = (data.total / totalSpending) * 100;
    const emoji = {
      groceries: '🛒',
      dining: '🍽️',
      transportation: '🚗',
      shopping: '🛍️',
      entertainment: '🎭',
      travel: '✈️',
      tech: '💻',
      other: '💵'
    }[category] || '💰';
    
    console.log(`  ${emoji} ${category.padEnd(15)} $${monthly.toFixed(2).padStart(8)}/mo  (${percent.toFixed(1)}% of spending)  ${data.count} purchases`);
  });
  console.log();
  
  // ============================================================================
  // TOP MERCHANTS
  // ============================================================================
  console.log('🏪 TOP MERCHANTS (Past 90 Days)');
  console.log('-'.repeat(70));
  
  const merchantTotals: Record<string, number> = {};
  creditCardPurchases.forEach(t => {
    const merchant = t.description.split(/\s+/).slice(0, 2).join(' '); // First 2 words
    merchantTotals[merchant] = (merchantTotals[merchant] || 0) + t.amount;
  });
  
  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  topMerchants.forEach(([merchant, amount], index) => {
    const monthly = (amount / 90) * 30;
    console.log(`  ${(index + 1).toString().padStart(2)}. ${merchant.padEnd(35)} $${monthly.toFixed(2).padStart(8)}/mo`);
  });
  console.log();
  
  // ============================================================================
  // MONTHLY BUDGET COMPARISON
  // ============================================================================
  console.log('📊 YOUR WEEKLY BUDGET vs ACTUAL SPENDING');
  console.log('-'.repeat(70));
  
  const weeklyBudget = {
    groceries: 200,
    dining: 100,
    other: 170 // transportation + shopping + entertainment + other
  };
  
  const monthlyBudget = {
    groceries: weeklyBudget.groceries * 4.33,
    dining: weeklyBudget.dining * 4.33,
    other: weeklyBudget.other * 4.33
  };
  
  const actualMonthly = {
    groceries: (spendingByCategory.groceries.total / 90) * 30,
    dining: (spendingByCategory.dining.total / 90) * 30,
    other: (
      spendingByCategory.transportation.total +
      spendingByCategory.shopping.total +
      spendingByCategory.entertainment.total +
      spendingByCategory.other.total
    ) / 90 * 30
  };
  
  const formatComparison = (budget: number, actual: number) => {
    const diff = actual - budget;
    const status = diff > 0 ? '❌ OVER' : '✅ UNDER';
    return `${status} by $${Math.abs(diff).toFixed(2)}`;
  };
  
  console.log('Category         Budget/Month    Actual/Month    Status');
  console.log('----------------------------------------------------------------');
  console.log(`🛒 Groceries     $${monthlyBudget.groceries.toFixed(2).padStart(10)}     $${actualMonthly.groceries.toFixed(2).padStart(10)}     ${formatComparison(monthlyBudget.groceries, actualMonthly.groceries)}`);
  console.log(`🍽️  Dining       $${monthlyBudget.dining.toFixed(2).padStart(10)}     $${actualMonthly.dining.toFixed(2).padStart(10)}     ${formatComparison(monthlyBudget.dining, actualMonthly.dining)}`);
  console.log(`💵 Other         $${monthlyBudget.other.toFixed(2).padStart(10)}     $${actualMonthly.other.toFixed(2).padStart(10)}     ${formatComparison(monthlyBudget.other, actualMonthly.other)}`);
  
  const totalBudget = Object.values(monthlyBudget).reduce((a, b) => a + b, 0);
  const totalActualDiscretionary = Object.values(actualMonthly).reduce((a, b) => a + b, 0);
  
  console.log('----------------------------------------------------------------');
  console.log(`TOTAL            $${totalBudget.toFixed(2).padStart(10)}     $${totalActualDiscretionary.toFixed(2).padStart(10)}     ${formatComparison(totalBudget, totalActualDiscretionary)}`);
  console.log();
  
  // Work expenses (tracked separately)
  const monthlyTech = (spendingByCategory.tech.total / 90) * 30;
  console.log(`💼 Work Expenses: $${monthlyTech.toFixed(2)}/month (tracked separately)`);
  console.log();
  
  // ============================================================================
  // CASH FLOW ANALYSIS
  // ============================================================================
  console.log('💸 MONTHLY CASH FLOW');
  console.log('-'.repeat(70));
  
  const monthlyIncomeCalc = monthlyIncome;
  const monthlyFixedExpenses = rent + loanPayment;
  const monthlyLifestyleSpending = totalActualDiscretionary + monthlyTech;
  const monthlyTravel = (spendingByCategory.travel.total / 90) * 30;
  
  console.log(`📈 Income:                        +$${monthlyIncomeCalc.toFixed(2)}`);
  console.log();
  console.log('📉 Fixed Expenses:');
  console.log(`   Rent:                          -$${rent.toFixed(2)}`);
  console.log(`   Loan Payment (CC Refi):        -$${loanPayment.toFixed(2)}`);
  console.log(`   Subtotal:                      -$${monthlyFixedExpenses.toFixed(2)}`);
  console.log();
  console.log('🛒 Lifestyle Spending (Discretionary):');
  console.log(`   Groceries:                     -$${actualMonthly.groceries.toFixed(2)}`);
  console.log(`   Dining Out:                    -$${actualMonthly.dining.toFixed(2)}`);
  console.log(`   Transportation:                -$${((spendingByCategory.transportation.total / 90) * 30).toFixed(2)}`);
  console.log(`   Shopping:                      -$${((spendingByCategory.shopping.total / 90) * 30).toFixed(2)}`);
  console.log(`   Entertainment:                 -$${((spendingByCategory.entertainment.total / 90) * 30).toFixed(2)}`);
  console.log(`   Other:                         -$${((spendingByCategory.other.total / 90) * 30).toFixed(2)}`);
  console.log(`   Subtotal:                      -$${totalActualDiscretionary.toFixed(2)}`);
  console.log();
  console.log('💻 Work Expenses:');
  console.log(`   Tech/Software/Dev Tools:       -$${monthlyTech.toFixed(2)}`);
  console.log();
  
  if (monthlyTravel > 0) {
    console.log('✈️  Travel (Occasional):');
    console.log(`   Hotels/Flights/Trips:          -$${monthlyTravel.toFixed(2)}`);
    console.log();
  }
  
  console.log('='.repeat(70));
  
  const netCashFlow = monthlyIncomeCalc - monthlyFixedExpenses - monthlyLifestyleSpending - monthlyTravel;
  const budgetDeficit = netCashFlow < 0;
  
  if (budgetDeficit) {
    console.log(`❌ NET CASH FLOW:                 -$${Math.abs(netCashFlow).toFixed(2)} (DEFICIT)`);
    console.log(`⚠️  You're spending $${Math.abs(netCashFlow).toFixed(2)} more than you earn each month!`);
  } else {
    console.log(`✅ NET CASH FLOW:                 +$${netCashFlow.toFixed(2)} (SURPLUS)`);
    console.log(`💰 You're saving $${netCashFlow.toFixed(2)} per month!`);
  }
  console.log();
  
  // ============================================================================
  // FINANCIAL HEALTH METRICS
  // ============================================================================
  console.log('📈 FINANCIAL HEALTH METRICS');
  console.log('-'.repeat(70));
  
  const debtToIncome = (loanPayment / monthlyIncomeCalc) * 100;
  const lifestyleToIncome = (monthlyLifestyleSpending / monthlyIncomeCalc) * 100;
  const fixedToIncome = (monthlyFixedExpenses / monthlyIncomeCalc) * 100;
  const savingsRate = (netCashFlow / monthlyIncomeCalc) * 100;
  const discretionaryToIncome = (totalActualDiscretionary / monthlyIncomeCalc) * 100;
  
  console.log(`Debt-to-Income Ratio:             ${debtToIncome.toFixed(1)}% ${debtToIncome > 35 ? '⚠️  High' : '✅ OK'}`);
  console.log(`Fixed Expenses Ratio:             ${fixedToIncome.toFixed(1)}% ${fixedToIncome > 50 ? '⚠️  High' : '✅ OK'}`);
  console.log(`Discretionary Spending:           ${discretionaryToIncome.toFixed(1)}% of income`);
  console.log(`Total Lifestyle Spending:         ${lifestyleToIncome.toFixed(1)}% of income`);
  console.log(`Savings Rate:                     ${savingsRate.toFixed(1)}% ${savingsRate < 10 ? '⚠️  Low' : '✅ Good'}`);
  console.log();
  
  // ============================================================================
  // KEY INSIGHTS
  // ============================================================================
  console.log('💡 KEY INSIGHTS & RECOMMENDATIONS');
  console.log('-'.repeat(70));
  
  let insightNumber = 1;
  
  // Biggest spending category
  const biggestCategory = sortedCategories[0];
  if (biggestCategory) {
    const biggestCategoryName = biggestCategory[0];
    const biggestCategoryAmount = (biggestCategory[1].total / 90) * 30;
    console.log(`${insightNumber++}. Biggest spending: ${biggestCategoryName} ($${biggestCategoryAmount.toFixed(2)}/mo)`);
  }
  
  // Cash flow status
  if (budgetDeficit) {
    console.log(`${insightNumber++}. ⚠️  DEFICIT ALERT: Spending exceeds income by $${Math.abs(netCashFlow).toFixed(2)}/month`);
    console.log(`   This is unsustainable - need to reduce spending or increase income!`);
  } else {
    console.log(`${insightNumber++}. ✅ Positive cash flow: Saving $${netCashFlow.toFixed(2)}/month`);
  }
  
  // Budget adherence
  const overBudgetCategories = [];
  if (actualMonthly.groceries > monthlyBudget.groceries) overBudgetCategories.push(`groceries (+$${(actualMonthly.groceries - monthlyBudget.groceries).toFixed(2)})`);
  if (actualMonthly.dining > monthlyBudget.dining) overBudgetCategories.push(`dining (+$${(actualMonthly.dining - monthlyBudget.dining).toFixed(2)})`);
  if (actualMonthly.other > monthlyBudget.other) overBudgetCategories.push(`other (+$${(actualMonthly.other - monthlyBudget.other).toFixed(2)})`);
  
  if (overBudgetCategories.length > 0) {
    console.log(`${insightNumber++}. ⚠️  Over budget in: ${overBudgetCategories.join(', ')}`);
  } else {
    console.log(`${insightNumber++}. ✅ All spending within budget!`);
  }
  
  // Debt burden
  console.log(`${insightNumber++}. Loan payment is ${debtToIncome.toFixed(1)}% of income ${debtToIncome > 35 ? '(high burden)' : '(manageable)'}`);
  
  // Work expenses
  console.log(`${insightNumber++}. Work expenses: $${monthlyTech.toFixed(2)}/mo (should be tax-deductible!)`);
  
  console.log();
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('📋 EXECUTIVE SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log(`💵 Monthly Income:              $${monthlyIncomeCalc.toFixed(2)}`);
  console.log(`🏠 Fixed Costs (Rent + Loan):   $${monthlyFixedExpenses.toFixed(2)} (${fixedToIncome.toFixed(1)}% of income)`);
  console.log(`🛒 Lifestyle Spending:          $${monthlyLifestyleSpending.toFixed(2)} (${lifestyleToIncome.toFixed(1)}% of income)`);
  console.log(`💰 Net Cash Flow:               ${netCashFlow >= 0 ? '+' : ''}$${netCashFlow.toFixed(2)}`);
  console.log();
  
  console.log(`🎯 Your New Budget System:`);
  console.log(`   🛒 Groceries: $${weeklyBudget.groceries}/week ($${monthlyBudget.groceries.toFixed(2)}/month)`);
  console.log(`   🍽️  Dining: $${weeklyBudget.dining}/week ($${monthlyBudget.dining.toFixed(2)}/month)`);
  console.log(`   💵 Other: $${weeklyBudget.other}/week ($${monthlyBudget.other.toFixed(2)}/month)`);
  console.log(`   💻 Work: Tracked separately (not in budget)`);
  console.log();
  
  console.log(`🤖 Your Discord bot is monitoring these budgets 24/7`);
  console.log(`   Daily updates at 9 AM PST`);
  console.log(`   Alerts at 75%, 90%, and 100% of each budget`);
  console.log();
  
  process.exit(0);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

