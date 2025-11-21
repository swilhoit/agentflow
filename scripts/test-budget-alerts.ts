#!/usr/bin/env tsx

/**
 * Test Budget Alert Service
 */

import dotenv from 'dotenv';
import { BudgetAlertService } from '../src/services/budgetAlertService';

dotenv.config();

console.log('');
console.log('═'.repeat(80));
console.log('   🧪 TESTING BUDGET ALERT SERVICE');
console.log('═'.repeat(80));
console.log('');

const weeklyBudget = parseFloat(process.env.WEEKLY_BUDGET || '1000');
const channelId = process.env.FINANCIAL_ADVISOR_CHANNELS?.split(',')[0] || '';

console.log(`Weekly Budget: $${weeklyBudget}`);
console.log(`Channel ID: ${channelId}`);
console.log('');

// Create budget service
const budgetService = new BudgetAlertService({
  weeklyBudget,
  channelId,
  enabled: true
});

// Get current budget status
const status = budgetService.getBudgetStatus();

console.log('📊 CURRENT BUDGET STATUS');
console.log('─'.repeat(80));
console.log(`Week: ${status.startDate} to ${status.endDate}`);
console.log(`Day ${status.daysIntoWeek} of 7`);
console.log('');
console.log(`Weekly Budget: $${status.weeklyBudget.toFixed(2)}`);
console.log(`Spent: $${status.spent.toFixed(2)}`);
console.log(`Remaining: $${status.remaining.toFixed(2)}`);
console.log(`Percent Used: ${status.percentUsed.toFixed(1)}%`);
console.log(`Over Budget: ${status.isOverBudget ? 'YES 🚨' : 'NO ✅'}`);
console.log('');

// Show which alerts would fire
console.log('🔔 ALERT STATUS');
console.log('─'.repeat(80));
const thresholds = [
  { pct: 50, name: '50% Threshold', emoji: '💡' },
  { pct: 75, name: '75% Threshold', emoji: '⚠️' },
  { pct: 90, name: '90% Threshold', emoji: '⚠️' },
  { pct: 100, name: '100% Threshold', emoji: '🚨' }
];

thresholds.forEach(t => {
  const crossed = status.percentUsed >= t.pct;
  console.log(`${t.emoji} ${t.name}: ${crossed ? 'WOULD FIRE 🔔' : 'Not reached'}`);
});
console.log('');

console.log('💡 To receive alerts in Discord:');
console.log('   1. Make sure bot is running');
console.log('   2. Alerts will fire automatically when thresholds are crossed');
console.log('   3. Daily updates sent at 9:00 AM PST');
console.log('');
console.log('📝 To adjust your budget:');
console.log(`   Edit .env and set WEEKLY_BUDGET=${weeklyBudget}`);
console.log('   Then restart the bot');
console.log('');

console.log('═'.repeat(80));
console.log('');

process.exit(0);

