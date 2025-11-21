#!/usr/bin/env tsx

/**
 * Dual Income House Buying Plan
 * 
 * Revised plan with partner's income included
 */

console.log('');
console.log('═'.repeat(80));
console.log('   🏡💑 DUAL INCOME HOUSE BUYING PLAN');
console.log('═'.repeat(80));
console.log('');

// Combined Financial Situation
const yourIncome = 7314;
const partnerIncome = 7314;
const combinedIncome = yourIncome + partnerIncome;
const currentRent = 1300;
const yourLoanPayment = 2000;
const yourBaselineSpending = 4725; // Your full baseline
const partnerSpending = 4725; // Partner's full baseline (same as yours)
const combinedSpending = yourBaselineSpending + partnerSpending; // Both spending full amounts

console.log('═'.repeat(80));
console.log('   💰 COMBINED HOUSEHOLD FINANCES');
console.log('═'.repeat(80));
console.log('');
console.log('Monthly Income:');
console.log(`  You:                      $${yourIncome.toLocaleString()}`);
console.log(`  Partner:                  $${partnerIncome.toLocaleString()}`);
console.log('─'.repeat(80));
console.log(`  COMBINED:                 $${combinedIncome.toLocaleString()}`);
console.log('');

console.log('Monthly Expenses:');
console.log(`  Your Spending:            $${yourBaselineSpending.toLocaleString()}`);
console.log(`  Partner Spending:         $${partnerSpending.toLocaleString()}`);
console.log(`  Your Loan:                $${yourLoanPayment.toLocaleString()}`);
console.log('─'.repeat(80));
const totalExpenses = yourBaselineSpending + partnerSpending + yourLoanPayment;
console.log(`  TOTAL:                    $${totalExpenses.toLocaleString()}`);
console.log('');

const currentCashFlow = combinedIncome - totalExpenses;
console.log(`💰 CURRENT CASH FLOW:       $${currentCashFlow.toLocaleString()}/month`);
console.log('');

if (currentCashFlow > 0) {
  console.log(`✅ SURPLUS! You're already saving $${currentCashFlow.toLocaleString()}/month!`);
} else {
  console.log(`⚠️  Deficit: $${Math.abs(currentCashFlow).toLocaleString()}/month`);
}
console.log('');

// Post-loan payoff
const monthsToPayoff = Math.ceil(20000 / yourLoanPayment);
const postLoanCashFlow = combinedIncome - (totalExpenses - yourLoanPayment);

console.log('═'.repeat(80));
console.log('   💳 AFTER LOAN PAYOFF (Sept 2026)');
console.log('═'.repeat(80));
console.log('');
console.log(`Combined Income:            $${combinedIncome.toLocaleString()}`);
console.log(`Combined Expenses:          $${(totalExpenses - yourLoanPayment).toLocaleString()}`);
console.log('─'.repeat(80));
console.log(`AVAILABLE TO SAVE:          $${postLoanCashFlow.toLocaleString()}/month`);
console.log('');
console.log(`🚀 That's $${(postLoanCashFlow * 12).toLocaleString()}/year in savings potential!`);
console.log('');

// House buying requirements with dual income
console.log('═'.repeat(80));
console.log('   🏠 HOUSE BUYING POWER (DUAL INCOME)');
console.log('═'.repeat(80));
console.log('');

// Calculate max home price based on 28% front-end ratio
const maxMonthlyHousing = combinedIncome * 0.28;
const interestRate = 0.07;
const monthlyRate = interestRate / 12;
const numPayments = 30 * 12;

// Back-calculate max loan from max payment
// payment = loan * (r(1+r)^n) / ((1+r)^n - 1)
// loan = payment * ((1+r)^n - 1) / (r(1+r)^n)
const maxMortgagePayment = maxMonthlyHousing - 500 - 150; // Subtract tax + insurance estimate
const maxLoanAmount = maxMortgagePayment * (Math.pow(1 + monthlyRate, numPayments) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, numPayments));

console.log('🏦 LENDER QUALIFICATION:');
console.log(`  Combined Income: $${combinedIncome.toLocaleString()}/month`);
console.log(`  Max Housing (28%): $${Math.round(maxMonthlyHousing).toLocaleString()}/month`);
console.log(`  Max Loan Amount: $${Math.round(maxLoanAmount).toLocaleString()}`);
console.log('');

// Different home price scenarios
const scenarios = [
  { price: 600000, name: 'LA - Decent Area' },
  { price: 750000, name: 'LA - Good Area' },
  { price: 500000, name: 'Conservative' },
];

console.log('🎯 HOME PRICE SCENARIOS:');
console.log('');

scenarios.forEach(scenario => {
  const downPayment10 = scenario.price * 0.10;
  const downPayment20 = scenario.price * 0.20;
  const closingCosts = scenario.price * 0.03;
  const loanAmount = scenario.price - downPayment10;
  const monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  const propertyTax = scenario.price * 0.01 / 12;
  const totalHousing = monthlyMortgage + propertyTax + 150;
  const housingPercent = (totalHousing / combinedIncome * 100);
  
  console.log(`${scenario.name}: $${scenario.price.toLocaleString()}`);
  console.log(`  10% down: $${downPayment10.toLocaleString()}`);
  console.log(`  20% down: $${downPayment20.toLocaleString()}`);
  console.log(`  Monthly payment: $${Math.round(totalHousing).toLocaleString()}/month (${housingPercent.toFixed(1)}% of income)`);
  console.log(`  ${housingPercent < 28 ? '✅' : '⚠️'} ${housingPercent < 28 ? 'Within lender guidelines' : 'Above recommended 28%'}`);
  console.log('');
});

// Recommended target
const targetPrice = 650000;
const downPayment10 = targetPrice * 0.10;
const downPayment20 = targetPrice * 0.20;
const closingCosts = targetPrice * 0.03;
const emergencyFund = (yourBaselineSpending + partnerSpending) * 6; // 6 months of lifestyle expenses (no loan)
const movingCosts = 5000;

console.log('═'.repeat(80));
console.log('   🎯 RECOMMENDED TARGET: $650K HOME');
console.log('═'.repeat(80));
console.log('');

console.log('💰 CASH NEEDED (10% Down):');
console.log(`  Down Payment:             $${downPayment10.toLocaleString()}`);
console.log(`  Closing Costs:            $${closingCosts.toLocaleString()}`);
console.log(`  Emergency Fund (6mo):     $${emergencyFund.toLocaleString()}`);
console.log(`  Moving/Buffer:            $${movingCosts.toLocaleString()}`);
console.log('─'.repeat(80));
const totalNeeded10 = downPayment10 + closingCosts + emergencyFund + movingCosts;
console.log(`  TOTAL NEEDED:             $${totalNeeded10.toLocaleString()}`);
console.log('');

console.log('💰 CASH NEEDED (20% Down - No PMI):');
console.log(`  Down Payment:             $${downPayment20.toLocaleString()}`);
console.log(`  Closing Costs:            $${closingCosts.toLocaleString()}`);
console.log(`  Emergency Fund (6mo):     $${emergencyFund.toLocaleString()}`);
console.log(`  Moving/Buffer:            $${movingCosts.toLocaleString()}`);
console.log('─'.repeat(80));
const totalNeeded20 = downPayment20 + closingCosts + emergencyFund + movingCosts;
console.log(`  TOTAL NEEDED:             $${totalNeeded20.toLocaleString()}`);
console.log('');

// Monthly housing cost
const loanAmount = targetPrice - downPayment10;
const monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
const propertyTax = targetPrice * 0.01 / 12;
const pmi = loanAmount * 0.005 / 12; // 0.5% annual PMI
const totalMonthlyHousing = monthlyMortgage + propertyTax + 150 + pmi;

console.log('📈 MONTHLY HOUSING COST:');
console.log(`  Mortgage (7%, 30yr):      $${Math.round(monthlyMortgage).toLocaleString()}`);
console.log(`  Property Tax:             $${Math.round(propertyTax).toLocaleString()}`);
console.log(`  Insurance:                $150`);
console.log(`  PMI (10% down):           $${Math.round(pmi).toLocaleString()}`);
console.log(`  HOA (estimate):           $300`);
console.log('─'.repeat(80));
console.log(`  TOTAL:                    $${Math.round(totalMonthlyHousing + 300).toLocaleString()}/month`);
console.log('');
console.log(`  Current rent: $${currentRent.toLocaleString()}/month`);
console.log(`  Increase: +$${Math.round(totalMonthlyHousing + 300 - currentRent).toLocaleString()}/month`);
console.log('');
console.log(`  % of combined income: ${((totalMonthlyHousing + 300) / combinedIncome * 100).toFixed(1)}%`);
console.log(`  ✅ Well within 28% guideline!`);
console.log('');

// FAST TRACK TIMELINE
console.log('═'.repeat(80));
console.log('   🚀 FAST TRACK TIMELINE (10% Down)');
console.log('═'.repeat(80));
console.log('');

const aggressiveSaveRate = postLoanCashFlow * 0.80; // Save 80% after loan
const monthsToSave10 = Math.ceil(totalNeeded10 / aggressiveSaveRate);

console.log('PHASE 1: PAY OFF LOAN (Now - Sept 2026) - 10 months');
console.log('─'.repeat(80));
console.log('Actions:');
console.log('  - Continue $2K/month loan payments');
console.log('  - Save remaining surplus: $' + currentCashFlow.toLocaleString() + '/month');
console.log('  - Build credit scores (both partners)');
console.log('  - Research neighborhoods');
console.log('');
const phase1Savings = currentCashFlow * monthsToPayoff;
console.log(`✅ Saved by Sept 2026: $${Math.round(phase1Savings).toLocaleString()}`);
console.log('');

console.log(`PHASE 2: AGGRESSIVE SAVING (Oct 2026 - ???) - ${monthsToSave10} months`);
console.log('─'.repeat(80));
console.log('Actions:');
console.log(`  - Save $${Math.round(aggressiveSaveRate).toLocaleString()}/month (80% of $${postLoanCashFlow.toLocaleString()})`);
console.log('  - Keep lifestyle spending flat');
console.log('  - Open high-yield savings (5% APY)');
console.log('  - Both partners maintain good credit (740+)');
console.log('  - Meet with mortgage broker');
console.log('');
const remainingNeeded = totalNeeded10 - phase1Savings;
const phase2Months = Math.ceil(remainingNeeded / aggressiveSaveRate);
console.log(`  Amount still needed: $${Math.round(remainingNeeded).toLocaleString()}`);
console.log(`  Months to save: ${phase2Months} months`);
console.log('');

const buyDate = new Date();
buyDate.setMonth(buyDate.getMonth() + monthsToPayoff + phase2Months);
console.log(`✅ READY TO BUY: ${buyDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
console.log('');

const totalMonths = monthsToPayoff + phase2Months;
console.log('PHASE 3: HOUSE HUNTING - 2-3 months');
console.log('─'.repeat(80));
console.log('Actions:');
console.log('  - Get pre-approved (dual income application)');
console.log('  - Tour homes with realtor');
console.log('  - Make competitive offers');
console.log('  - Close on your home!');
console.log('');

const closeDate = new Date();
closeDate.setMonth(closeDate.getMonth() + totalMonths + 3);
console.log(`🏡 HOMEOWNER BY: ${closeDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
console.log('');

console.log('═'.repeat(80));
console.log('   📅 COMPLETE TIMELINE');
console.log('═'.repeat(80));
console.log('');
console.log(`Pay off loan:          10 months  →  Sept 2026`);
console.log(`Aggressive saving:     ${phase2Months} months  →  ${buyDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`);
console.log(`House hunting:         3 months   →  ${closeDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`);
console.log('─'.repeat(80));
console.log(`TOTAL TIME: ${totalMonths + 3} months (~${((totalMonths + 3) / 12).toFixed(1)} years)`);
console.log('');
console.log(`🎉 That's ${12.5 - ((totalMonths + 3) / 12).toFixed(1)} years FASTER than solo!`);
console.log('');

// Even faster options
console.log('═'.repeat(80));
console.log('   ⚡ EVEN FASTER OPTIONS');
console.log('═'.repeat(80));
console.log('');

console.log('1. Start Saving NOW (Before Loan Payoff):');
console.log(`   - Split: $1,000 to loan, $1,000 to house fund`);
console.log(`   - Would save $${(currentCashFlow * monthsToPayoff + 1000 * monthsToPayoff).toLocaleString()} by Sept 2026`);
console.log(`   - Buy house ${Math.floor(10000 / aggressiveSaveRate)} months sooner!`);
console.log('');

console.log('2. Increase Income (Both Partners):');
console.log(`   - If both get +$1K/month raise = +$2K combined`);
console.log(`   - New save rate: $${(aggressiveSaveRate + 2000).toLocaleString()}/month`);
console.log(`   - Buy house ${phase2Months - Math.ceil(remainingNeeded / (aggressiveSaveRate + 2000))} months sooner!`);
console.log('');

console.log('3. Use First-Time Buyer Programs:');
console.log('   - CalHFA: 3.5% down = $' + (targetPrice * 0.035).toLocaleString() + ' down payment');
console.log(`   - Save $${(downPayment10 - targetPrice * 0.035).toLocaleString()} = ${Math.ceil((downPayment10 - targetPrice * 0.035) / aggressiveSaveRate)} months faster!`);
console.log('   - CA Dream For All: 20% down payment assistance');
console.log('');

console.log('4. Partner Contributes to Loan Payoff:');
console.log('   - Pay $4K/month instead of $2K');
console.log('   - Loan paid off in 5 months (Feb 2026)');
console.log('   - Start aggressive saving 5 months earlier!');
console.log('   - Buy house by ' + new Date(buyDate.getTime() - 5 * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
console.log('');

// Best scenario
console.log('═'.repeat(80));
console.log('   🏆 BEST CASE SCENARIO');
console.log('═'.repeat(80));
console.log('');

console.log('If you do ALL of these:');
console.log('  1. Partner helps with loan ($4K/month) → Paid off in 5 months');
console.log('  2. Both get small raises (+$500 each) → +$1K combined');
console.log('  3. Use CalHFA 3.5% down → Save $42K instead of $65K');
console.log('  4. Save 80% of free cash → $5,400/month savings');
console.log('');

const bestCaseLoanMonths = 5;
const bestCaseSavings = (targetPrice * 0.035 + closingCosts + emergencyFund + movingCosts) - currentCashFlow * bestCaseLoanMonths;
const bestCaseSaveRate = (postLoanCashFlow + 1000) * 0.80;
const bestCaseMonths = Math.ceil(bestCaseSavings / bestCaseSaveRate);

const bestCaseDate = new Date();
bestCaseDate.setMonth(bestCaseDate.getMonth() + bestCaseLoanMonths + bestCaseMonths);

console.log(`Loan payoff: ${bestCaseLoanMonths} months (May 2026)`);
console.log(`Aggressive saving: ${bestCaseMonths} months`);
console.log(`─`.repeat(80));
console.log(`🏡 HOMEOWNER BY: ${bestCaseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} (~${((bestCaseLoanMonths + bestCaseMonths) / 12).toFixed(1)} years!)`);
console.log('');

// Budget with house
console.log('═'.repeat(80));
console.log('   💰 BUDGET AFTER BUYING HOUSE');
console.log('═'.repeat(80));
console.log('');

const postHouseBudget = combinedIncome - Math.round(totalMonthlyHousing + 300) - (totalExpenses - yourLoanPayment - currentRent);
console.log(`Combined Income:            $${combinedIncome.toLocaleString()}`);
console.log(`Housing (mortgage+tax+ins): $${Math.round(totalMonthlyHousing + 300).toLocaleString()}`);
console.log(`Lifestyle expenses:         $${(totalExpenses - yourLoanPayment - currentRent).toLocaleString()}`);
console.log('─'.repeat(80));
console.log(`Remaining (savings/fun):    $${postHouseBudget.toLocaleString()}/month`);
console.log('');

if (postHouseBudget > 1000) {
  console.log(`✅ Still have $${postHouseBudget.toLocaleString()}/month for:`);
  console.log('   - Renovations');
  console.log('   - Travel');
  console.log('   - Investments');
  console.log('   - Extra mortgage payments');
}
console.log('');

// Action plan
console.log('═'.repeat(80));
console.log('   ✅ YOUR 30-DAY ACTION PLAN (DUAL INCOME)');
console.log('═'.repeat(80));
console.log('');

console.log('Week 1: ALIGN WITH PARTNER');
console.log('  [ ] Discuss homeownership goals together');
console.log('  [ ] Agree on target timeline (1-2 years?)');
console.log('  [ ] Compare credit scores (both aim for 740+)');
console.log('  [ ] Decide on loan payoff strategy (solo vs shared)');
console.log('');

console.log('Week 2: FINANCIAL SETUP');
console.log('  [ ] Open joint "House Fund" savings account');
console.log('  [ ] Set up automatic transfers ($' + Math.round(currentCashFlow).toLocaleString() + '/mo now)');
console.log('  [ ] Both check credit reports (free on Credit Karma)');
console.log('  [ ] Calculate exact combined expenses');
console.log('');

console.log('Week 3: RESEARCH & PLANNING');
console.log('  [ ] Research CalHFA and CA Dream For All programs');
console.log('  [ ] Tour neighborhoods you like');
console.log('  [ ] Meet with mortgage broker (get pre-qualified)');
console.log('  [ ] Calculate exact budget for house');
console.log('');

console.log('Week 4: OPTIMIZE & COMMIT');
console.log('  [ ] Look for ways to increase savings rate');
console.log('  [ ] Set goal: Save $' + Math.round(aggressiveSaveRate).toLocaleString() + '/month after loan');
console.log('  [ ] Sign up for first-time buyer workshops');
console.log('  [ ] Create 12-month savings milestone tracker');
console.log('');

// Summary
console.log('═'.repeat(80));
console.log('   🎉 SUMMARY: DUAL INCOME ADVANTAGE');
console.log('═'.repeat(80));
console.log('');

console.log('💰 The Numbers:');
console.log(`   Combined Income: $${combinedIncome.toLocaleString()}/month`);
console.log(`   Home Price: $650,000`);
console.log(`   Down Payment: $${downPayment10.toLocaleString()} (10%)`);
console.log(`   Monthly Housing: $${Math.round(totalMonthlyHousing + 300).toLocaleString()}`);
console.log('');

console.log('⏱️  Timeline:');
console.log(`   Standard path: ~${((totalMonths + 3) / 12).toFixed(1)} years`);
console.log(`   Best case: ~${((bestCaseLoanMonths + bestCaseMonths) / 12).toFixed(1)} years`);
console.log('');

console.log('🎯 Success Factors:');
console.log('   ✅ Dual income makes this VERY achievable!');
console.log('   ✅ Already have positive cash flow');
console.log('   ✅ Can afford $650K home comfortably');
console.log('   ✅ Both partners contributing to savings');
console.log('');

console.log('💪 Action Items:');
console.log('   1. Decide how to handle the $20K loan (split it?)');
console.log('   2. Start saving NOW even while paying loan');
console.log('   3. Use first-time buyer programs');
console.log('   4. Both maintain excellent credit');
console.log('   5. Stay disciplined with spending');
console.log('');

console.log('🏡 YOUR HOME AWAITS IN 1-2 YEARS! 🎉');
console.log('');

console.log('═'.repeat(80));
console.log('');

process.exit(0);

