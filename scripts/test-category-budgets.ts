#!/usr/bin/env tsx
/**
 * Test Category Budget Service
 * 
 * Tests the three-category budget system
 */

import { CategoryBudgetService } from '../src/services/categoryBudgetService';
import { logger } from '../utils/logger';

async function main() {
  console.log('🧪 Testing Category Budget Service...\n');
  
  // Initialize service with test budgets
  const service = new CategoryBudgetService({
    groceriesBudget: 200,
    diningBudget: 100,
    otherBudget: 170,
    channelId: 'test-channel',
    enabled: true
  });
  
  // Get current status
  const status = service.getBudgetStatus();
  
  console.log('📊 CURRENT WEEK STATUS (Day ' + status.daysIntoWeek + ' of 7)');
  console.log('='.repeat(60));
  console.log();
  
  // Groceries
  console.log('🛒 GROCERIES BUDGET: $200/week');
  console.log(`   Spent: $${status.groceries.spent.toFixed(2)} (${status.groceries.percentUsed.toFixed(1)}%)`);
  console.log(`   Remaining: $${status.groceries.remaining.toFixed(2)}`);
  console.log(`   Status: ${status.groceries.isOverBudget ? '❌ OVER BUDGET' : '✅ On track'}`);
  console.log();
  
  // Dining
  console.log('🍽️  DINING OUT BUDGET: $100/week');
  console.log(`   Spent: $${status.dining.spent.toFixed(2)} (${status.dining.percentUsed.toFixed(1)}%)`);
  console.log(`   Remaining: $${status.dining.remaining.toFixed(2)}`);
  console.log(`   Status: ${status.dining.isOverBudget ? '❌ OVER BUDGET' : '✅ On track'}`);
  console.log();
  
  // Other
  console.log('💵 OTHER SPENDING BUDGET: $170/week');
  console.log(`   Spent: $${status.other.spent.toFixed(2)} (${status.other.percentUsed.toFixed(1)}%)`);
  console.log(`   Remaining: $${status.other.remaining.toFixed(2)}`);
  console.log(`   Status: ${status.other.isOverBudget ? '❌ OVER BUDGET' : '✅ On track'}`);
  console.log();
  
  // Work expenses
  if (status.work && status.work.spent > 0) {
    console.log('💼 WORK EXPENSES (Not counted in budget):');
    console.log(`   Tech/Software/Phone: $${status.work.spent.toFixed(2)}`);
    console.log();
  }
  
  // Overall
  const totalBudget = 200 + 100 + 170;
  const totalSpent = status.groceries.spent + status.dining.spent + status.other.spent;
  const totalRemaining = totalBudget - totalSpent;
  const overallPercent = (totalSpent / totalBudget) * 100;
  
  console.log('📊 OVERALL:');
  console.log(`   Total Budget: $${totalBudget}/week`);
  console.log(`   Total Spent: $${totalSpent.toFixed(2)} (${overallPercent.toFixed(1)}%)`);
  console.log(`   Total Remaining: $${totalRemaining.toFixed(2)}`);
  console.log();
  
  // Days remaining
  const daysRemaining = 7 - status.daysIntoWeek;
  if (daysRemaining > 0) {
    console.log('💡 RECOMMENDED DAILY SPENDING (remaining days):');
    console.log(`   🛒 Groceries: $${(status.groceries.remaining / daysRemaining).toFixed(2)}/day`);
    console.log(`   🍽️  Dining: $${(status.dining.remaining / daysRemaining).toFixed(2)}/day`);
    console.log(`   💵 Other: $${(status.other.remaining / daysRemaining).toFixed(2)}/day`);
    console.log();
  }
  
  // Alert thresholds
  console.log('⚠️  ALERT THRESHOLDS:');
  console.log('   75% → Warning notification');
  console.log('   90% → Near limit notification');
  console.log('   100% → Budget exceeded notification');
  console.log();
  
  console.log('✅ Test complete!');
  console.log('💡 Daily updates will be sent at 9 AM PST');
  
  service.stop();
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

