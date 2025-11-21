#!/usr/bin/env npx tsx
/**
 * Actual Income Analysis - Excluding Loan
 */

import { getSQLiteDatabase } from '../src/services/databaseFactory';

async function main() {
  const db = getSQLiteDatabase();
  
  // Get last 90 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  console.log('💵 ACTUAL INCOME ANALYSIS (Excluding Loan)');
  console.log('='.repeat(70));
  console.log(`Period: ${startStr} to ${endStr}`);
  console.log();
  
  const allTransactions = db.getTransactionsByDateRange(startStr, endStr);
  
  const checkingDeposits = allTransactions.filter(t => 
    t.account_name?.includes('Checking') && t.amount > 0
  );
  
  console.log('ALL CHECKING DEPOSITS:');
  console.log('-'.repeat(70));
  
  let totalIncome = 0;
  let loanAmount = 0;
  let smallTransfers = 0;
  
  const incomeBySource: Record<string, number> = {};
  
  checkingDeposits.forEach(t => {
    const desc = t.description.toUpperCase();
    
    // Identify the loan
    if (t.amount > 19000 && t.amount < 21000 && desc.includes('WIRE')) {
      console.log(`${t.date}: $${t.amount.toFixed(2).padStart(10)} - ${t.description} ⚠️  LOAN (excluded)`);
      loanAmount += t.amount;
      return;
    }
    
    // Small transfers/reimbursements (under $250)
    if (t.amount < 250 && !desc.includes('TRUIST') && !desc.includes('INTERCEPT') && !desc.includes('DISTROKID')) {
      smallTransfers += t.amount;
      return;
    }
    
    // Real income
    console.log(`${t.date}: $${t.amount.toFixed(2).padStart(10)} - ${t.description}`);
    totalIncome += t.amount;
    
    // Categorize by source
    let source = 'Other';
    if (desc.includes('TRUIST')) source = 'Truist/Paychecks';
    else if (desc.includes('INTERCEPT')) source = 'Intercept Sales';
    else if (desc.includes('DISTROKID') || desc.includes('ASCAP')) source = 'Music Royalties';
    else if (desc.includes('TETRAHEDRON') || desc.includes('POLYGON')) source = 'Crypto/Transfers';
    else if (desc.includes('APPLE CASH')) source = 'Apple Cash';
    
    incomeBySource[source] = (incomeBySource[source] || 0) + t.amount;
  });
  
  console.log();
  console.log('='.repeat(70));
  console.log(`REAL INCOME (90 days):        $${totalIncome.toFixed(2)}`);
  console.log(`Loan Deposit (excluded):      $${loanAmount.toFixed(2)}`);
  console.log(`Small Transfers (excluded):   $${smallTransfers.toFixed(2)}`);
  console.log();
  
  const monthlyIncome = (totalIncome / 90) * 30;
  console.log(`📊 AVERAGE MONTHLY INCOME:    $${monthlyIncome.toFixed(2)}`);
  console.log();
  
  console.log('INCOME BY SOURCE (Monthly):');
  console.log('-'.repeat(70));
  Object.entries(incomeBySource)
    .sort((a, b) => b[1] - a[1])
    .forEach(([source, amount]) => {
      const monthly = (amount / 90) * 30;
      const percent = (amount / totalIncome) * 100;
      console.log(`  ${source.padEnd(25)} $${monthly.toFixed(2).padStart(8)}/mo  (${percent.toFixed(1)}%)`);
    });
  
  console.log();
  console.log('💡 CORRECTED FINANCIAL PICTURE:');
  console.log('-'.repeat(70));
  console.log(`Monthly Income:               $${monthlyIncome.toFixed(2)}`);
  console.log(`Fixed Costs (Rent + Loan):    $3,300.00`);
  console.log(`Lifestyle Spending:           $6,457.94 (from previous analysis)`);
  console.log(`Interest (will decrease):     $405.64 (going away with refi)`);
  console.log();
  
  const netCashFlow = monthlyIncome - 3300 - 6457.94;
  const netCashFlowAfterRefi = monthlyIncome - 3300 - 6457.94 + 405.64; // Add back interest
  
  if (netCashFlow < 0) {
    console.log(`Current Net Cash Flow:        -$${Math.abs(netCashFlow).toFixed(2)} (DEFICIT)`);
    console.log(`After Refi (no interest):     ${netCashFlowAfterRefi >= 0 ? '+' : '-'}$${Math.abs(netCashFlowAfterRefi).toFixed(2)}`);
  } else {
    console.log(`Current Net Cash Flow:        +$${netCashFlow.toFixed(2)}`);
    console.log(`After Refi (no interest):     +$${netCashFlowAfterRefi.toFixed(2)}`);
  }
  
  console.log();
  console.log('🎯 KEY CORRECTIONS:');
  console.log('   1. Excluded $20k loan from income calculation');
  console.log('   2. Interest charges will drop with refinance');
  console.log(`   3. Your real monthly income is ~$${monthlyIncome.toFixed(2)}, not $15,469`);
  console.log();
  
  process.exit(0);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

