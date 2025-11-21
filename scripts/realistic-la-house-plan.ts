#!/usr/bin/env tsx

/**
 * Realistic LA House Buying Plan
 * 
 * Based on ACTUAL LA market prices ($1M+)
 */

console.log('');
console.log('═'.repeat(80));
console.log('   🏡 REALISTIC LA HOUSING MARKET ANALYSIS');
console.log('═'.repeat(80));
console.log('');

// Your financial situation
const yourIncome = 7314;
const partnerIncome = 7314;
const combinedIncome = yourIncome + partnerIncome;
const yourSpending = 4725;
const partnerSpending = 4725;
const loanPayment = 2000;
const totalExpenses = yourSpending + partnerSpending + loanPayment;
const currentCashFlow = combinedIncome - totalExpenses;
const postLoanCashFlow = combinedIncome - yourSpending - partnerSpending;

console.log('💰 YOUR FINANCES:');
console.log(`  Combined Income: $${combinedIncome.toLocaleString()}/month`);
console.log(`  Combined Expenses: $${totalExpenses.toLocaleString()}/month`);
console.log(`  Current Cash Flow: $${currentCashFlow.toLocaleString()}/month`);
console.log(`  Post-Loan (Sept 2026): $${postLoanCashFlow.toLocaleString()}/month`);
console.log('');

// Actual LA market prices
console.log('═'.repeat(80));
console.log('   🏠 ACTUAL LA MARKET PRICES (2025)');
console.log('═'.repeat(80));
console.log('');

const markets = [
  { area: 'LA Proper - Single Family Home', price: 1200000, note: 'Median for decent neighborhood' },
  { area: 'LA - Condo (2BR)', price: 750000, note: 'More affordable option' },
  { area: 'LA - Cheaper Neighborhoods', price: 900000, note: 'Compton, South LA, etc.' },
  { area: 'Pasadena / Glendale', price: 1100000, note: 'Near LA, good areas' },
  { area: 'Inland Empire (Riverside)', price: 550000, note: '60+ min commute' },
  { area: 'Lancaster / Palmdale', price: 450000, note: '90+ min commute' },
];

markets.forEach(m => {
  console.log(`${m.area}:`);
  console.log(`  Price: $${m.price.toLocaleString()}`);
  console.log(`  Note: ${m.note}`);
  console.log('');
});

// Calculate what you can actually afford
console.log('═'.repeat(80));
console.log('   💰 WHAT YOU CAN ACTUALLY AFFORD');
console.log('═'.repeat(80));
console.log('');

const maxMonthlyHousing = combinedIncome * 0.28; // 28% front-end ratio
const interestRate = 0.07;
const monthlyRate = interestRate / 12;
const numPayments = 30 * 12;

// Back-calculate max home price
const maxMortgagePayment = maxMonthlyHousing - 600; // Subtract tax + insurance + HOA
const maxLoanAmount = maxMortgagePayment * (Math.pow(1 + monthlyRate, numPayments) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, numPayments));

console.log('🏦 LENDER LIMITS:');
console.log(`  Max monthly housing (28%): $${Math.round(maxMonthlyHousing).toLocaleString()}`);
console.log(`  Max mortgage payment: $${Math.round(maxMortgagePayment).toLocaleString()}`);
console.log(`  Max loan amount: $${Math.round(maxLoanAmount).toLocaleString()}`);
console.log('');

// With 10% down
const maxHomePrice10 = maxLoanAmount / 0.90;
console.log(`  Max home price (10% down): $${Math.round(maxHomePrice10).toLocaleString()}`);
console.log('');

// With 20% down
const maxHomePrice20 = maxLoanAmount / 0.80;
console.log(`  Max home price (20% down): $${Math.round(maxHomePrice20).toLocaleString()}`);
console.log('');

console.log('⚠️  REALITY CHECK:');
console.log(`  LA median home: $1,200,000`);
console.log(`  You can afford: $${Math.round(maxHomePrice10).toLocaleString()}`);
console.log(`  Gap: $${Math.round(1200000 - maxHomePrice10).toLocaleString()}`);
console.log('');
console.log('  💡 You need DOUBLE your current income to afford a typical LA home!');
console.log('');

// Scenarios with different home prices
console.log('═'.repeat(80));
console.log('   📊 REALISTIC SCENARIOS');
console.log('═'.repeat(80));
console.log('');

const scenarios = [
  { name: 'LA Single Family Home', price: 1200000, realistic: false },
  { name: 'LA Condo (2BR)', price: 750000, realistic: true },
  { name: 'Pasadena/Glendale', price: 1100000, realistic: false },
  { name: 'Inland Empire', price: 550000, realistic: true },
  { name: 'Stretch Goal (Higher Income)', price: 1000000, realistic: false, incomeNeeded: 22000 },
];

scenarios.forEach(scenario => {
  console.log(`\n${scenario.name}: $${scenario.price.toLocaleString()}`);
  console.log('─'.repeat(80));
  
  const downPayment10 = scenario.price * 0.10;
  const downPayment20 = scenario.price * 0.20;
  const closingCosts = scenario.price * 0.03;
  const emergencyFund = (yourSpending + partnerSpending) * 6;
  const movingCosts = 5000;
  const totalNeeded = downPayment10 + closingCosts + emergencyFund + movingCosts;
  
  const loanAmount = scenario.price - downPayment10;
  const monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  const propertyTax = scenario.price * 0.01 / 12;
  const insurance = 150;
  const pmi = loanAmount * 0.005 / 12;
  const hoa = scenario.name.includes('Condo') ? 500 : 200;
  const totalMonthly = monthlyMortgage + propertyTax + insurance + pmi + hoa;
  
  const housingPercent = (totalMonthly / combinedIncome * 100);
  const monthsToSave = Math.ceil(totalNeeded / (postLoanCashFlow * 0.80));
  const yearsToSave = (monthsToSave / 12).toFixed(1);
  
  console.log('💰 Cash Needed (10% down):');
  console.log(`   Down payment: $${downPayment10.toLocaleString()}`);
  console.log(`   Closing costs: $${closingCosts.toLocaleString()}`);
  console.log(`   Emergency fund: $${emergencyFund.toLocaleString()}`);
  console.log(`   Total: $${totalNeeded.toLocaleString()}`);
  console.log('');
  
  console.log('📈 Monthly Payment:');
  console.log(`   Mortgage: $${Math.round(monthlyMortgage).toLocaleString()}`);
  console.log(`   Tax + Insurance + PMI: $${Math.round(propertyTax + insurance + pmi).toLocaleString()}`);
  console.log(`   HOA: $${hoa}`);
  console.log(`   TOTAL: $${Math.round(totalMonthly).toLocaleString()}/month`);
  console.log('');
  
  console.log('📊 Affordability:');
  console.log(`   % of income: ${housingPercent.toFixed(1)}%`);
  console.log(`   Budget left: $${(combinedIncome - totalMonthly - (yourSpending + partnerSpending - 1300)).toLocaleString()}/month`);
  
  if (housingPercent > 35) {
    console.log(`   🚨 UNAFFORDABLE - ${housingPercent.toFixed(0)}% is too high!`);
  } else if (housingPercent > 28) {
    console.log(`   ⚠️  TIGHT - ${housingPercent.toFixed(0)}% leaves little room`);
  } else {
    console.log(`   ✅ AFFORDABLE - ${housingPercent.toFixed(0)}% is reasonable`);
  }
  
  console.log('');
  console.log('⏱️  Timeline:');
  console.log(`   Months to save: ${monthsToSave} months (~${yearsToSave} years)`);
  
  if (scenario.incomeNeeded) {
    console.log('');
    console.log(`💡 Would need combined income: $${scenario.incomeNeeded.toLocaleString()}/month`);
    console.log(`   Current: $${combinedIncome.toLocaleString()}`);
    console.log(`   Gap: $${(scenario.incomeNeeded - combinedIncome).toLocaleString()}/month`);
  }
});

// The harsh reality
console.log('');
console.log('═'.repeat(80));
console.log('   💡 THE HARSH REALITY');
console.log('═'.repeat(80));
console.log('');

console.log('With your current $14,628/month combined income:');
console.log('');
console.log('❌ CANNOT AFFORD:');
console.log('   - Typical LA single family home ($1.2M)');
console.log('   - Pasadena/Glendale homes ($1.1M)');
console.log('   - Even "cheap" LA neighborhoods ($900K)');
console.log('');
console.log('✅ CAN AFFORD:');
console.log('   - LA Condo 2BR ($750K) - TIGHT but doable');
console.log('   - Inland Empire homes ($550K) - Comfortable');
console.log('   - Lancaster/Palmdale ($450K) - Easy');
console.log('');
console.log('⚠️  OR INCREASE INCOME:');
console.log('   - For $1M home: Need $22K/month combined (~$11K each)');
console.log('   - Current: $7.3K each');
console.log('   - Gap: +$3.7K/month EACH');
console.log('');

// Realistic options
console.log('═'.repeat(80));
console.log('   🎯 YOUR REALISTIC OPTIONS');
console.log('═'.repeat(80));
console.log('');

console.log('OPTION 1: BUY A CONDO IN LA ($750K) 🏢');
console.log('─'.repeat(80));
console.log('Timeline: 3-4 years');
console.log('');
console.log('Pros:');
console.log('  ✓ Stay in LA');
console.log('  ✓ Build equity');
console.log('  ✓ Achievable with current income');
console.log('  ✓ Can sell later for house');
console.log('');
console.log('Cons:');
console.log('  ✗ Not a house');
console.log('  ✗ HOA fees ($500/month)');
console.log('  ✗ Less space');
console.log('  ✗ Shared walls');
console.log('');
console.log('Monthly: $5,350 (37% of income) - TIGHT');
console.log('Cash needed: $126K');
console.log('Save time: 30 months after loan');
console.log('Buy by: March 2029');
console.log('');

console.log('');
console.log('OPTION 2: MOVE TO INLAND EMPIRE ($550K) 🚗');
console.log('─'.repeat(80));
console.log('Timeline: 2-3 years');
console.log('');
console.log('Pros:');
console.log('  ✓ Actual HOUSE with yard');
console.log('  ✓ Much more affordable');
console.log('  ✓ Comfortable monthly payment');
console.log('  ✓ Faster timeline');
console.log('');
console.log('Cons:');
console.log('  ✗ 60-90 min commute to LA');
console.log('  ✗ Less urban amenities');
console.log('  ✗ Away from friends/scene');
console.log('  ✗ Gas/commute costs');
console.log('');
console.log('Monthly: $3,900 (27% of income) - COMFORTABLE');
console.log('Cash needed: $110K');
console.log('Save time: 21 months after loan');
console.log('Buy by: June 2028');
console.log('');

console.log('');
console.log('OPTION 3: DRAMATICALLY INCREASE INCOME ($22K/mo) 💰');
console.log('─'.repeat(80));
console.log('Timeline: 2-4 years to increase income, then 3-4 years to save');
console.log('');
console.log('What you need:');
console.log('  - You: $7.3K → $11K/month (+$3.7K) = 51% raise');
console.log('  - Partner: $7.3K → $11K/month (+$3.7K) = 51% raise');
console.log('  - OR one of you makes $15K+, other makes $7K');
console.log('');
console.log('How to get there:');
console.log('  • Senior developer role ($150K+/year)');
console.log('  • Management position');
console.log('  • Successful business/startup');
console.log('  • Multiple income streams');
console.log('');
console.log('Then can afford: $1M home');
console.log('Timeline: 6-8 years total');
console.log('');

console.log('');
console.log('OPTION 4: WAIT & BUILD EQUITY ($750K → $1.2M) 📈');
console.log('─'.repeat(80));
console.log('The "ladder" strategy');
console.log('');
console.log('Phase 1 (Years 1-4): Buy $750K condo');
console.log('  - Pay off loan, save, buy condo');
console.log('  - Build equity while home appreciates');
console.log('  - Continue increasing income');
console.log('');
console.log('Phase 2 (Years 5-10): Trade up');
console.log('  - Condo worth ~$900K (assume 4% annual appreciation)');
console.log('  - You have $150K equity');
console.log('  - Income now $20K/month combined');
console.log('  - Sell condo, buy $1.2M house');
console.log('');
console.log('Timeline: 10 years total');
console.log('Outcome: LA single family home');
console.log('');

console.log('');
console.log('OPTION 5: PARTNER WITH OTHERS 👥');
console.log('─'.repeat(80));
console.log('House hacking / co-buying strategies');
console.log('');
console.log('A) Buy duplex/triplex:');
console.log('  - Live in one unit');
console.log('  - Rent others for $3K-4K/month');
console.log('  - Reduces your housing cost');
console.log('  - Can afford $900K property');
console.log('');
console.log('B) Co-buy with family/friends:');
console.log('  - Pool resources with another couple');
console.log('  - $28K combined income = afford $1.2M');
console.log('  - Shared ownership agreement');
console.log('  - Split or sell later');
console.log('');

// Recommendation
console.log('');
console.log('═'.repeat(80));
console.log('   🎯 MY HONEST RECOMMENDATION');
console.log('═'.repeat(80));
console.log('');

console.log('Given your situation:');
console.log('  - Combined income: $14,628/month');
console.log('  - Current surplus: $3,178/month');
console.log('  - Post-loan: $5,178/month to save');
console.log('');

console.log('🏆 BEST PATH: OPTION 2 (Inland Empire) + OPTION 3 (Increase Income)');
console.log('');
console.log('Step 1: Buy in Inland Empire (2-3 years)');
console.log('  - Achievable with current income');
console.log('  - Actual house with yard');
console.log('  - Build equity immediately');
console.log('  - $550K = $3,900/month payment');
console.log('');

console.log('Step 2: Focus on income growth (Years 3-7)');
console.log('  - Both work on career advancement');
console.log('  - Build side businesses');
console.log('  - Let home appreciate');
console.log('  - Target: $20K+/month combined');
console.log('');

console.log('Step 3: Move closer to LA (Year 7-10)');
console.log('  - Sell Inland Empire home (now worth $650K+)');
console.log('  - Have $150K+ equity');
console.log('  - Higher income = qualify for $1M+ home');
console.log('  - Buy in better LA area');
console.log('');

console.log('Alternative: If you MUST stay in LA NOW');
console.log('  → Buy $750K condo (tight but doable)');
console.log('  → 37% of income to housing');
console.log('  → Trade up in 5-7 years');
console.log('');

// Action plan
console.log('═'.repeat(80));
console.log('   ✅ 30-DAY ACTION PLAN');
console.log('═'.repeat(80));
console.log('');

console.log('Week 1: REALITY CHECK');
console.log('  [ ] Tour homes in Riverside/San Bernardino');
console.log('  [ ] Tour condos in LA');
console.log('  [ ] Calculate commute times for work');
console.log('  [ ] Discuss with partner: Location vs. House');
console.log('');

console.log('Week 2: INCOME STRATEGY');
console.log('  [ ] Both assess current income trajectory');
console.log('  [ ] Research career moves for +$3K/month each');
console.log('  [ ] Identify side income opportunities');
console.log('  [ ] Set 5-year income goal');
console.log('');

console.log('Week 3: FINANCIAL PREP');
console.log('  [ ] Decide: Condo in LA or House in IE?');
console.log('  [ ] Calculate exact savings needed');
console.log('  [ ] Open house fund');
console.log('  [ ] Research CalHFA programs');
console.log('');

console.log('Week 4: START EXECUTION');
console.log('  [ ] Start saving aggressively');
console.log('  [ ] Apply for first-time buyer programs');
console.log('  [ ] Get pre-qualified for target price');
console.log('  [ ] Begin income increase plan');
console.log('');

// Summary
console.log('═'.repeat(80));
console.log('   💭 FINAL THOUGHTS');
console.log('═'.repeat(80));
console.log('');

console.log('The LA housing market is BRUTAL. Here\'s the truth:');
console.log('');
console.log('📊 Your Options:');
console.log('   1. Buy $750K condo in LA (achievable, tight budget)');
console.log('   2. Buy $550K house in Inland Empire (achievable, comfortable)');
console.log('   3. Double your income first, then buy $1M+ (6-8 years)');
console.log('   4. Buy condo now, trade up later (10 years to house)');
console.log('');

console.log('💡 My Advice:');
console.log('   If you can stomach the commute → Inland Empire house');
console.log('   If you must stay in LA → Condo, then trade up');
console.log('   Either way → Focus on increasing income!');
console.log('');

console.log('🎯 The Real Goal:');
console.log('   Get to $20K+/month combined income');
console.log('   Then you have real options in LA');
console.log('   Current path: You\'re priced out of most of LA');
console.log('');

console.log('💪 You GOT This:');
console.log('   - You\'re already saving $3K/month');
console.log('   - You have no bad debt after loan payoff');
console.log('   - Dual income is powerful');
console.log('   - Just need to be strategic about location OR income');
console.log('');

console.log('═'.repeat(80));
console.log('');

process.exit(0);

