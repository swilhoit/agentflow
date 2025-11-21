#!/usr/bin/env tsx

/**
 * House Buying Plan
 * 
 * Creates a realistic roadmap to homeownership based on current finances
 */

console.log('');
console.log('═'.repeat(80));
console.log('   🏡 YOUR HOUSE BUYING PLAN');
console.log('═'.repeat(80));
console.log('');

// Current Financial Situation
const monthlyIncome = 7314;
const currentRent = 1300;
const loanPayment = 2000;
const baselineSpending = 4725;
const currentDeficit = -711;

console.log('═'.repeat(80));
console.log('   📊 CURRENT SITUATION');
console.log('═'.repeat(80));
console.log('');
console.log(`Monthly Income: $${monthlyIncome.toLocaleString()}`);
console.log(`Current Expenses: $${(currentRent + loanPayment + baselineSpending).toLocaleString()}`);
console.log(`Monthly Cash Flow: $${currentDeficit.toLocaleString()}`);
console.log('');
console.log(`🔴 Current Status: Budget Deficit`);
console.log('');

// Loan payoff calculation
const loanBalance = 20000;
const monthsToPayoff = Math.ceil(loanBalance / loanPayment);

console.log('═'.repeat(80));
console.log('   💳 LOAN PAYOFF TIMELINE');
console.log('═'.repeat(80));
console.log('');
console.log(`Loan Amount: $${loanBalance.toLocaleString()}`);
console.log(`Monthly Payment: $${loanPayment.toLocaleString()}`);
console.log(`Months to Payoff: ~${monthsToPayoff} months`);
console.log('');

const payoffDate = new Date();
payoffDate.setMonth(payoffDate.getMonth() + monthsToPayoff);
console.log(`Projected Payoff: ${payoffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
console.log('');
console.log(`💡 After loan payoff, you'll have +$${loanPayment.toLocaleString()}/month freed up!`);
console.log('');

// Post-loan budget
const postLoanMonthly = monthlyIncome - currentRent - baselineSpending;

console.log('═'.repeat(80));
console.log('   ✅ POST-LOAN BUDGET (After Loan Payoff)');
console.log('═'.repeat(80));
console.log('');
console.log(`Monthly Income:           $${monthlyIncome.toLocaleString()}`);
console.log(`Rent:                     $${currentRent.toLocaleString()}`);
console.log(`Lifestyle Expenses:       $${baselineSpending.toLocaleString()}`);
console.log('─'.repeat(80));
console.log(`Available for Savings:    $${postLoanMonthly.toLocaleString()}/month`);
console.log('');

// House buying requirements (LA market estimate)
console.log('═'.repeat(80));
console.log('   🏠 HOUSE BUYING REQUIREMENTS');
console.log('═'.repeat(80));
console.log('');

const targetHomePrice = 500000; // Conservative for LA area
const downPaymentPercent = 10; // FHA 3.5% to conventional 20%, using 10% as middle ground
const downPayment = targetHomePrice * (downPaymentPercent / 100);
const closingCosts = targetHomePrice * 0.03; // ~3% of home price
const emergencyFund = (currentRent + baselineSpending) * 6; // 6 months expenses
const movingCosts = 5000;

const totalNeededUpfront = downPayment + closingCosts + emergencyFund + movingCosts;

console.log(`Target Home Price: $${targetHomePrice.toLocaleString()} (conservative for LA)`);
console.log('');
console.log('💰 Cash Needed:');
console.log(`  Down Payment (${downPaymentPercent}%):     $${downPayment.toLocaleString()}`);
console.log(`  Closing Costs (~3%):      $${closingCosts.toLocaleString()}`);
console.log(`  Emergency Fund (6mo):     $${emergencyFund.toLocaleString()}`);
console.log(`  Moving Costs:             $${movingCosts.toLocaleString()}`);
console.log('─'.repeat(80));
console.log(`  TOTAL NEEDED:             $${totalNeededUpfront.toLocaleString()}`);
console.log('');

// Monthly mortgage estimate
const loanAmount = targetHomePrice - downPayment;
const interestRate = 0.07; // 7% current rates
const loanTermYears = 30;
const monthlyRate = interestRate / 12;
const numPayments = loanTermYears * 12;
const monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
const propertyTax = targetHomePrice * 0.01 / 12; // ~1% annual
const insurance = 150; // ~$150/month estimate
const totalMonthlyHousing = monthlyMortgage + propertyTax + insurance;

console.log('📈 Monthly Housing Costs (Estimated):');
console.log(`  Mortgage (7%, 30yr):      $${Math.round(monthlyMortgage).toLocaleString()}`);
console.log(`  Property Tax:             $${Math.round(propertyTax).toLocaleString()}`);
console.log(`  Insurance:                $${Math.round(insurance).toLocaleString()}`);
console.log(`  HOA (if applicable):      $200-500`);
console.log('─'.repeat(80));
console.log(`  TOTAL:                    ~$${Math.round(totalMonthlyHousing).toLocaleString()}-${Math.round(totalMonthlyHousing + 500).toLocaleString()}/month`);
console.log('');
console.log(`💡 Compare to current rent: $${currentRent.toLocaleString()}/month`);
console.log(`   Increase: +$${Math.round(totalMonthlyHousing - currentRent).toLocaleString()}/month`);
console.log('');

// THE PLAN
console.log('═'.repeat(80));
console.log('   🎯 YOUR HOUSE BUYING ROADMAP');
console.log('═'.repeat(80));
console.log('');

console.log('PHASE 1: STABILIZE (Months 1-3) 🚨');
console.log('─'.repeat(80));
console.log('Goal: Fix the $711/month deficit');
console.log('');
console.log('Actions:');
console.log('  1. Increase income by $400-500/month:');
console.log('     - Freelance projects');
console.log('     - Consulting work');
console.log('     - Part-time gig');
console.log('     - More music releases');
console.log('');
console.log('  2. Cut expenses by $300-400/month:');
console.log('     - Dining: $73/meal → $40/meal saves $528/mo');
console.log('     - Tech subscriptions: Cut 30% saves $165/mo');
console.log('     - Review "Other" $2,390 category');
console.log('');
console.log('  3. Keep making $2K loan payments');
console.log('');
console.log('✅ Target: Break even or +$200/month surplus');
console.log('');

const phase1End = 3;
console.log('');
console.log(`PHASE 2: PAY OFF LOAN (Months 4-${monthsToPayoff}) 💳`);
console.log('─'.repeat(80));
console.log('Goal: Eliminate the $20K loan completely');
console.log('');
console.log('Actions:');
console.log('  1. Maintain income increases from Phase 1');
console.log('  2. Keep expenses reduced');
console.log('  3. Continue $2K/month payments');
console.log('  4. Put any extra income toward loan');
console.log('');
console.log(`✅ Target: Loan paid off by ${payoffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
console.log('');

// Aggressive saving phase
const aggressiveSavingsRate = postLoanMonthly * 0.70; // Save 70% of freed up cash
const monthsToSaveDownPayment = Math.ceil(downPayment / aggressiveSavingsRate);
const monthsToSaveTotal = Math.ceil(totalNeededUpfront / aggressiveSavingsRate);

console.log('');
console.log(`PHASE 3: AGGRESSIVE SAVING (Months ${monthsToPayoff + 1}-${monthsToPayoff + monthsToSaveDownPayment}) 💰`);
console.log('─'.repeat(80));
console.log('Goal: Save down payment + closing costs');
console.log('');
console.log('Actions:');
console.log('  1. Save $1,400+/month (70% of freed up $2K)');
console.log('  2. Maintain reduced lifestyle spending');
console.log('  3. Increase income to $8,500-9,000/month');
console.log('  4. Open high-yield savings account (5% APY)');
console.log('  5. Keep credit score high (check monthly)');
console.log('');
console.log(`  Savings Target: $${downPayment.toLocaleString()} (down payment)`);
console.log(`  Timeline: ${monthsToSaveDownPayment} months at $${Math.round(aggressiveSavingsRate).toLocaleString()}/month`);
console.log('');
console.log('✅ Target: $50K saved for down payment + closing');
console.log('');

const emergencySaveMonths = Math.ceil(emergencyFund / (aggressiveSavingsRate * 0.5));

console.log('');
console.log(`PHASE 4: EMERGENCY FUND (Months ${monthsToPayoff + monthsToSaveDownPayment + 1}-${monthsToPayoff + monthsToSaveTotal}) 🏦`);
console.log('─'.repeat(80));
console.log('Goal: Build 6-month emergency fund');
console.log('');
console.log('Actions:');
console.log('  1. Continue saving $700-1,000/month');
console.log('  2. Keep emergency fund separate');
console.log('  3. Start researching neighborhoods');
console.log('  4. Get pre-approved for mortgage');
console.log('');
console.log(`  Savings Target: $${emergencyFund.toLocaleString()} (6 months expenses)`);
console.log(`  Timeline: ${emergencySaveMonths} months more`);
console.log('');
console.log('✅ Target: Full emergency fund + ready to buy');
console.log('');

const totalMonthsToReady = monthsToPayoff + monthsToSaveTotal;
const readyDate = new Date();
readyDate.setMonth(readyDate.getMonth() + totalMonthsToReady);

console.log('');
console.log(`PHASE 5: HOUSE HUNTING (Month ${totalMonthsToReady}+) 🏡`);
console.log('─'.repeat(80));
console.log('Goal: Find and purchase your home');
console.log('');
console.log('Actions:');
console.log('  1. Get pre-approved for mortgage');
console.log('  2. Work with realtor');
console.log('  3. Tour homes');
console.log('  4. Make offers');
console.log('  5. Close on your home!');
console.log('');
console.log(`✅ Target: Homeowner by ${readyDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} or earlier`);
console.log('');

// Timeline summary
console.log('═'.repeat(80));
console.log('   📅 COMPLETE TIMELINE');
console.log('═'.repeat(80));
console.log('');

const timeline = [
  { phase: 'Stabilize Budget', months: 3, savings: 0 },
  { phase: 'Pay Off Loan', months: monthsToPayoff - 3, savings: 0 },
  { phase: 'Save Down Payment', months: monthsToSaveDownPayment, savings: downPayment + closingCosts },
  { phase: 'Build Emergency Fund', months: emergencySaveMonths, savings: emergencyFund },
  { phase: 'House Hunting', months: 3, savings: 0 },
];

let cumulativeMonths = 0;
let totalSavings = 0;
timeline.forEach((item, idx) => {
  cumulativeMonths += item.months;
  totalSavings += item.savings;
  const milestoneDate = new Date();
  milestoneDate.setMonth(milestoneDate.getMonth() + cumulativeMonths);
  
  console.log(`${idx + 1}. ${item.phase.padEnd(25)} ${item.months.toString().padStart(2)} months  →  ${milestoneDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`);
  if (item.savings > 0) {
    console.log(`   Cumulative savings: $${totalSavings.toLocaleString()}`);
  }
});

console.log('─'.repeat(80));
console.log(`TOTAL TIME TO HOMEOWNERSHIP: ${cumulativeMonths} months (~${Math.round(cumulativeMonths / 12 * 10) / 10} years)`);
console.log('');

// Key milestones
console.log('═'.repeat(80));
console.log('   🎯 KEY MILESTONES & REQUIREMENTS');
console.log('═'.repeat(80));
console.log('');

console.log('Financial Requirements:');
console.log(`  ✓ Cash Saved: $${totalNeededUpfront.toLocaleString()}`);
console.log(`  ✓ Credit Score: 680+ (ideally 740+ for best rates)`);
console.log(`  ✓ Debt-to-Income: <43% (yours will improve after loan payoff)`);
console.log(`  ✓ Stable Income: 2 years documented income`);
console.log(`  ✓ Emergency Fund: 6 months expenses saved`);
console.log('');

console.log('Income Requirements:');
const requiredIncomeForMortgage = (totalMonthlyHousing * 12) / 0.28; // 28% front-end ratio
const requiredMonthlyIncome = requiredIncomeForMortgage / 12;
console.log(`  Lenders prefer housing ≤28% of gross income`);
console.log(`  For $${Math.round(totalMonthlyHousing).toLocaleString()}/month housing:`);
console.log(`  Minimum income needed: $${Math.round(requiredMonthlyIncome).toLocaleString()}/month`);
console.log(`  Your current income: $${monthlyIncome.toLocaleString()}/month`);
if (monthlyIncome < requiredMonthlyIncome) {
  const gap = requiredMonthlyIncome - monthlyIncome;
  console.log(`  ⚠️  Gap: Need +$${Math.round(gap).toLocaleString()}/month more income`);
} else {
  console.log(`  ✅ You meet the income requirement!`);
}
console.log('');

// Alternative strategies
console.log('═'.repeat(80));
console.log('   💡 ALTERNATIVE STRATEGIES TO SPEED THIS UP');
console.log('═'.repeat(80));
console.log('');

console.log('1. Lower Down Payment:');
console.log(`   - FHA loan: 3.5% down = $${(targetHomePrice * 0.035).toLocaleString()}`);
console.log(`   - Saves ${monthsToSaveDownPayment - Math.ceil(targetHomePrice * 0.035 / aggressiveSavingsRate)} months!`);
console.log(`   - Trade-off: Higher monthly payments + PMI`);
console.log('');

console.log('2. Lower Price Point:');
console.log(`   - $350K home: $${(350000 * 0.10).toLocaleString()} down payment`);
console.log(`   - Saves ${Math.ceil((downPayment - 35000) / aggressiveSavingsRate)} months`);
console.log(`   - May need to look outside LA or consider condos`);
console.log('');

console.log('3. Increase Income More:');
console.log(`   - Get income to $10K/month = save $2,500/month`);
console.log(`   - Would save down payment in ${Math.ceil(downPayment / 2500)} months!`);
console.log(`   - Side business, promotion, consulting`);
console.log('');

console.log('4. House Hacking:');
console.log(`   - Buy duplex/triplex, live in one unit`);
console.log(`   - Rent others to cover mortgage`);
console.log(`   - FHA allows this with 3.5% down`);
console.log('');

console.log('5. First-Time Buyer Programs:');
console.log(`   - CA Dream For All: Down payment assistance`);
console.log(`   - LA County programs available`);
console.log(`   - Check CalHFA, local credit unions`);
console.log('');

// Action items
console.log('═'.repeat(80));
console.log('   ✅ NEXT 30 DAYS: ACTION ITEMS');
console.log('═'.repeat(80));
console.log('');

console.log('Immediate Steps (This Month):');
console.log('');
console.log('Week 1:');
console.log('  [ ] Track every expense for 7 days (use app)');
console.log('  [ ] Identify $300+ in expense cuts');
console.log('  [ ] Check credit score (free on Credit Karma)');
console.log('  [ ] List 3 side income opportunities');
console.log('');
console.log('Week 2:');
console.log('  [ ] Implement expense cuts');
console.log('  [ ] Start one side income project');
console.log('  [ ] Research high-yield savings accounts (5%+)');
console.log('  [ ] Create "House Fund" savings account');
console.log('');
console.log('Week 3:');
console.log('  [ ] Apply for side gig/freelance work');
console.log('  [ ] Cancel unused subscriptions');
console.log('  [ ] Meal prep to reduce dining costs');
console.log('  [ ] Research first-time buyer programs');
console.log('');
console.log('Week 4:');
console.log('  [ ] Review month\'s progress');
console.log('  [ ] Aim for +$200-400 surplus');
console.log('  [ ] Set up automatic transfers to house fund');
console.log('  [ ] Read about LA housing market');
console.log('');

console.log('═'.repeat(80));
console.log('   🎉 SUMMARY');
console.log('═'.repeat(80));
console.log('');

console.log('📊 Your Path to Homeownership:');
console.log('');
console.log(`   Timeline: ${Math.round(cumulativeMonths / 12 * 10) / 10} years`);
console.log(`   Total Cash Needed: $${totalNeededUpfront.toLocaleString()}`);
console.log(`   Monthly Savings Required: $${Math.round(aggressiveSavingsRate).toLocaleString()}`);
console.log('');
console.log('🎯 Critical Success Factors:');
console.log('   1. Increase income by $1,000-2,000/month');
console.log('   2. Cut lifestyle expenses by $300-500/month');
console.log('   3. Pay off $20K loan in 10 months');
console.log('   4. Save aggressively after loan payoff');
console.log('   5. Maintain good credit (700+)');
console.log('');
console.log('💪 You CAN do this! It requires:');
console.log('   ✓ Discipline with spending');
console.log('   ✓ Hustle for extra income');
console.log('   ✓ Patience (2-3 years)');
console.log('   ✓ Focus on the goal');
console.log('');
console.log('🏡 The reward: Your own home in LA!');
console.log('');

console.log('═'.repeat(80));
console.log('');

process.exit(0);

