#!/usr/bin/env npx tsx
/**
 * Complete Financial Picture
 * 
 * Comprehensive overview of income, expenses, spending, and cash flow
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
  
  // ============================================================================
  // INCOME
  // ============================================================================
  console.log('💵 INCOME');
  console.log('-'.repeat(70));
  
  const incomeTransactions = allTransactions.filter(t => {
    const desc = t.description.toUpperCase();
    return t.amount > 0 && 
           !desc.includes('TRANSFER') && 
           !desc.includes('REFUND') &&
           !desc.includes('ADJUSTMENT') &&
           t.amount > 500; // Likely paychecks
  });
  
  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const monthlyIncome = (totalIncome / 90) * 30;
  
  console.log(`Total Income (90 days): $${totalIncome.toFixed(2)}`);
  console.log(`Average Monthly Income: $${monthlyIncome.toFixed(2)}`);
  console.log();
  
  // Show income transactions
  console.log('Recent Income:');
  incomeTransactions.slice(-5).forEach(t => {
    console.log(`  ${t.date}: $${t.amount.toFixed(2).padStart(10)} - ${t.description}`);
  });
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
  
  // Find rent (Statewide/Enterprise)
  const rentTransactions = allTransactions.filter(t => {
    const desc = t.description.toUpperCase();
    return desc.includes('STATEWIDE') || desc.includes('ENTERPRISE');
  });
  
  const rent = 1300; // User stated $1300/month
  
  console.log(`Rent (Statewide/Enterprise): $${rent.toFixed(2)}/month`);
  console.log(`Loan Payment: $${loanPayment.toFixed(2)}/month`);
  console.log();
  console.log(`Total Fixed Expenses: $${(rent + loanPayment).toFixed(2)}/month`);
  console.log();
  
  // ============================================================================
  // LIFESTYLE SPENDING (Credit Card Purchases)
  // ============================================================================
  console.log('💳 LIFESTYLE SPENDING (Credit Card Purchases)');
  console.log('-'.repeat(70));
  
  // Filter for actual purchases (exclude payments, transfers, etc.)
  const excludeKeywords = [
    'PAYMENT', 'ONLINE PAYMENT', 'AUTOPAY', 'ACH PMT', 'EPAYMENT',
    'WIRE REF', 'TRANSFER', 'INST XFER', 'ROBINHOOD'
  ];
  
  const actualPurchases = allTransactions.filter(t => {
    if (t.amount >= 0) return false; // Only negative amounts (spending)
    const upper = t.description.toUpperCase();
    return !excludeKeywords.some(kw => upper.includes(kw));
  });
  
  // Categorize spending
  const categorizeTransaction = (t: any) => {
    const desc = t.description.toLowerCase();
    const cat = (t.category || '').toLowerCase();
    
    // Groceries
    if (/whole\s*foods|wholefds|trader\s*joe|sprouts|lassens|target|costco|market|grocery|ralphs|vons/.test(desc) || cat.includes('grocer')) {
      return 'groceries';
    }
    
    // Dining
    if (/restaurant|dining|bar|cafe|coffee|pizza|burger|sushi|kitchen|grill|bistro|taco|delivery|doordash|uber\s*eats|grubhub|starbucks|tst|aplpay\s*tst|little\s*doms|mun\s*korean|shadowbrook/.test(desc) || cat.includes('dining') || cat.includes('food')) {
      return 'dining';
    }
    
    // Transportation
    if (/uber|lyft|waymo|ride|transport/.test(desc) || cat.includes('transportation')) {
      return 'transportation';
    }
    
    // Shopping
    if (/amazon|retail|store|shop/.test(desc) || cat.includes('shopping')) {
      return 'shopping';
    }
    
    // Entertainment
    if (/entertainment|movie|theater|concert|sport|game/.test(desc) || cat.includes('entertainment')) {
      return 'entertainment';
    }
    
    // Travel
    if (/hotel|airbnb|flight|airline|travel/.test(desc) || cat.includes('travel')) {
      return 'travel';
    }
    
    // Tech/Work
    if (/software|tech|phone|subscription|cursor|claude|anthropic|openai|vercel|figma/.test(desc) || cat.includes('software')) {
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
  
  actualPurchases.forEach(t => {
    const category = categorizeTransaction(t);
    spendingByCategory[category].total += Math.abs(t.amount);
    spendingByCategory[category].count += 1;
    spendingByCategory[category].transactions.push(t);
  });
  
  // Calculate totals
  const totalSpending = Object.values(spendingByCategory).reduce((sum, cat) => sum + cat.total, 0);
  const monthlySpending = (totalSpending / 90) * 30;
  
  console.log(`Total Spending (90 days): $${totalSpending.toFixed(2)}`);
  console.log(`Average Monthly: $${monthlySpending.toFixed(2)}`);
  console.log();
  
  // Show by category
  console.log('Breakdown by Category:');
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
    
    console.log(`  ${emoji} ${category.padEnd(15)} $${monthly.toFixed(2).padStart(8)}/mo  (${percent.toFixed(1)}%)  ${data.count} transactions`);
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
  
  console.log('Category         Budget/Month    Actual/Month    Difference');
  console.log('🛒 Groceries     $' + monthlyBudget.groceries.toFixed(2).padStart(10) + 
              '     $' + actualMonthly.groceries.toFixed(2).padStart(10) +
              '     ' + (actualMonthly.groceries > monthlyBudget.groceries ? '❌ +' : '✅ -') +
              '$' + Math.abs(actualMonthly.groceries - monthlyBudget.groceries).toFixed(2));
  
  console.log('🍽️  Dining       $' + monthlyBudget.dining.toFixed(2).padStart(10) + 
              '     $' + actualMonthly.dining.toFixed(2).padStart(10) +
              '     ' + (actualMonthly.dining > monthlyBudget.dining ? '❌ +' : '✅ -') +
              '$' + Math.abs(actualMonthly.dining - monthlyBudget.dining).toFixed(2));
  
  console.log('💵 Other         $' + monthlyBudget.other.toFixed(2).padStart(10) + 
              '     $' + actualMonthly.other.toFixed(2).padStart(10) +
              '     ' + (actualMonthly.other > monthlyBudget.other ? '❌ +' : '✅ -') +
              '$' + Math.abs(actualMonthly.other - monthlyBudget.other).toFixed(2));
  
  const totalBudget = Object.values(monthlyBudget).reduce((a, b) => a + b, 0);
  const totalActual = Object.values(actualMonthly).reduce((a, b) => a + b, 0);
  
  console.log('-'.repeat(70));
  console.log('TOTAL            $' + totalBudget.toFixed(2).padStart(10) + 
              '     $' + totalActual.toFixed(2).padStart(10) +
              '     ' + (totalActual > totalBudget ? '❌ +' : '✅ -') +
              '$' + Math.abs(totalActual - totalBudget).toFixed(2));
  console.log();
  
  // ============================================================================
  // CASH FLOW ANALYSIS
  // ============================================================================
  console.log('💸 MONTHLY CASH FLOW');
  console.log('-'.repeat(70));
  
  const monthlyIncomeCalc = monthlyIncome;
  const monthlyFixedExpenses = rent + loanPayment;
  const monthlyLifestyleSpending = monthlySpending;
  const monthlyTechWork = (spendingByCategory.tech.total / 90) * 30;
  const monthlyTravel = (spendingByCategory.travel.total / 90) * 30;
  
  console.log(`Income:                           +$${monthlyIncomeCalc.toFixed(2)}`);
  console.log();
  console.log('Fixed Expenses:');
  console.log(`  Rent:                           -$${rent.toFixed(2)}`);
  console.log(`  Loan Payment:                   -$${loanPayment.toFixed(2)}`);
  console.log(`  Subtotal:                       -$${monthlyFixedExpenses.toFixed(2)}`);
  console.log();
  console.log('Lifestyle Spending:');
  console.log(`  Groceries:                      -$${actualMonthly.groceries.toFixed(2)}`);
  console.log(`  Dining Out:                     -$${actualMonthly.dining.toFixed(2)}`);
  console.log(`  Transportation:                 -$${((spendingByCategory.transportation.total / 90) * 30).toFixed(2)}`);
  console.log(`  Shopping:                       -$${((spendingByCategory.shopping.total / 90) * 30).toFixed(2)}`);
  console.log(`  Entertainment:                  -$${((spendingByCategory.entertainment.total / 90) * 30).toFixed(2)}`);
  console.log(`  Other:                          -$${((spendingByCategory.other.total / 90) * 30).toFixed(2)}`);
  console.log(`  Subtotal:                       -$${(monthlyLifestyleSpending - monthlyTechWork - monthlyTravel).toFixed(2)}`);
  console.log();
  console.log('Work Expenses:');
  console.log(`  Tech/Software/Phone:            -$${monthlyTechWork.toFixed(2)}`);
  console.log();
  console.log('Travel (Occasional):');
  console.log(`  Hotels/Flights/Trips:           -$${monthlyTravel.toFixed(2)}`);
  console.log();
  console.log('='.repeat(70));
  
  const netCashFlow = monthlyIncomeCalc - monthlyFixedExpenses - monthlyLifestyleSpending;
  const budgetDeficit = monthlyIncomeCalc < (monthlyFixedExpenses + monthlyLifestyleSpending);
  
  console.log(`NET CASH FLOW:                    ${netCashFlow >= 0 ? '+' : ''}$${netCashFlow.toFixed(2)}`);
  
  if (budgetDeficit) {
    console.log(`⚠️  DEFICIT: Spending $${Math.abs(netCashFlow).toFixed(2)} more than income per month`);
  } else {
    console.log(`✅ SURPLUS: Saving $${netCashFlow.toFixed(2)} per month`);
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
  
  console.log(`Debt-to-Income Ratio:             ${debtToIncome.toFixed(1)}% (Loan payment / Income)`);
  console.log(`Fixed Expenses Ratio:             ${fixedToIncome.toFixed(1)}% (Rent + Loan / Income)`);
  console.log(`Lifestyle Spending Ratio:         ${lifestyleToIncome.toFixed(1)}% (All spending / Income)`);
  console.log(`Savings Rate:                     ${savingsRate.toFixed(1)}% ${savingsRate < 0 ? '⚠️  Negative!' : '✅'}`);
  console.log();
  
  // ============================================================================
  // KEY INSIGHTS
  // ============================================================================
  console.log('💡 KEY INSIGHTS');
  console.log('-'.repeat(70));
  
  // Find biggest spending category
  const biggestCategory = sortedCategories[0];
  const biggestCategoryName = biggestCategory[0];
  const biggestCategoryAmount = biggestCategory[1].total;
  const biggestCategoryMonthly = (biggestCategoryAmount / 90) * 30;
  
  console.log(`1. Biggest spending category: ${biggestCategoryName} ($${biggestCategoryMonthly.toFixed(2)}/mo)`);
  
  // Budget comparison
  if (budgetDeficit) {
    console.log(`2. ⚠️  Currently spending more than earning (deficit: $${Math.abs(netCashFlow).toFixed(2)}/mo)`);
  } else {
    console.log(`2. ✅ Cash flow positive (surplus: $${netCashFlow.toFixed(2)}/mo)`);
  }
  
  // Debt burden
  if (debtToIncome > 35) {
    console.log(`3. ⚠️  Loan payment is ${debtToIncome.toFixed(1)}% of income (high debt burden)`);
  } else {
    console.log(`3. ✅ Loan payment is ${debtToIncome.toFixed(1)}% of income (manageable)`);
  }
  
  // Budget adherence
  const overBudgetCategories = [];
  if (actualMonthly.groceries > monthlyBudget.groceries) overBudgetCategories.push('groceries');
  if (actualMonthly.dining > monthlyBudget.dining) overBudgetCategories.push('dining');
  if (actualMonthly.other > monthlyBudget.other) overBudgetCategories.push('other');
  
  if (overBudgetCategories.length > 0) {
    console.log(`4. ⚠️  Over budget in: ${overBudgetCategories.join(', ')}`);
  } else {
    console.log(`4. ✅ Spending within budget across all categories`);
  }
  
  // Travel impact
  if (monthlyTravel > 0) {
    console.log(`5. ✈️  Travel spending: $${monthlyTravel.toFixed(2)}/mo (occasional, not in regular budget)`);
  }
  
  console.log();
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('📋 EXECUTIVE SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log(`You earn ~$${monthlyIncomeCalc.toFixed(2)}/month`);
  console.log(`Your fixed costs are $${monthlyFixedExpenses.toFixed(2)}/month (rent + loan)`);
  console.log(`Your lifestyle spending is ~$${monthlyLifestyleSpending.toFixed(2)}/month`);
  console.log();
  
  if (budgetDeficit) {
    console.log(`You're currently running a deficit of $${Math.abs(netCashFlow).toFixed(2)}/month`);
    console.log(`This is unsustainable long-term without reducing spending or increasing income.`);
  } else {
    console.log(`You have a surplus of $${netCashFlow.toFixed(2)}/month`);
    console.log(`This surplus can go toward savings, investments, or extra debt payments.`);
  }
  console.log();
  
  console.log(`Your new category budget system tracks:`);<br>  console.log(`  🛒 Groceries: $${weeklyBudget.groceries}/week ($${monthlyBudget.groceries.toFixed(2)}/month)`);
  console.log(`  🍽️  Dining: $${weeklyBudget.dining}/week ($${monthlyBudget.dining.toFixed(2)}/month)`);
  console.log(`  💵 Other: $${weeklyBudget.other}/week ($${monthlyBudget.other.toFixed(2)}/month)`);
  console.log();
  
  console.log('✅ Your Discord bot is now monitoring these budgets and will alert you');
  console.log('   when spending in any category approaches or exceeds limits.');
  console.log();
  
  process.exit(0);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
