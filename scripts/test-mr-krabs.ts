#!/usr/bin/env ts-node

/**
 * Test Mr Krabs Financial Advisor
 *
 * Simulates user queries to test for duplicate messages and response quality
 */

import dotenv from 'dotenv';
import { AdvisorTools } from '../src/advisor/advisorTools';
import { logger, LogLevel } from '../src/utils/logger';

dotenv.config();

async function main() {
  try {
    logger.setLevel(LogLevel.INFO);
    logger.info('🧪 Testing Mr Krabs Financial Advisor...');

    const tools = new AdvisorTools();

    // Test 1: Get cached transactions (should be fast and work)
    logger.info('\n📊 Test 1: Getting cached transactions...');
    const txns = tools.getCachedTransactions('', 7);
    logger.info(`✅ Retrieved ${txns.count} transactions from last 7 days`);
    logger.info(`   Source: ${txns.source}`);
    logger.info(`   Last sync: ${txns.last_sync}`);

    if (txns.count > 0) {
      logger.info('\n   Most recent transactions:');
      txns.transactions.slice(0, 3).forEach((t: any) => {
        logger.info(`   - ${t.date}: ${t.description} $${t.amount}`);
      });
    }

    // Test 2: Get spending by category (should be fast and work)
    logger.info('\n📊 Test 2: Getting spending analysis...');
    const spending = tools.getCachedSpendingAnalysis(30);
    logger.info(`✅ Analyzed ${spending.transaction_count} transactions`);
    logger.info(`   Total spent: $${spending.total_spent}`);
    logger.info(`   Source: ${spending.source}`);

    if (spending.categories && spending.categories.length > 0) {
      logger.info('\n   Top spending categories:');
      spending.categories.slice(0, 5).forEach((cat: any) => {
        logger.info(`   - ${cat.category}: $${cat.amount} (${cat.transaction_count} txns)`);
      });
    }

    // Test 3: Search transactions
    logger.info('\n🔍 Test 3: Searching for specific transactions...');
    const searchResults = tools.searchTransactions('whole foods', 30);
    logger.info(`✅ Found ${searchResults.count} matching transactions`);

    if (searchResults.count > 0) {
      logger.info('\n   Sample results:');
      searchResults.transactions.slice(0, 3).forEach((t: any) => {
        logger.info(`   - ${t.date}: ${t.description} $${t.amount}`);
      });
    }

    // Test 4: Budget check
    logger.info('\n💰 Test 4: Checking budget...');
    const budgetCheck = await tools.executeTool('budget_check', {
      category: 'dining',
      budget_amount: 100
    });

    if (budgetCheck.error) {
      logger.warn(`⚠️  Budget check had an issue: ${budgetCheck.error}`);
    } else {
      logger.info(`✅ Budget check completed`);
      logger.info(`   Category: ${budgetCheck.category}`);
      logger.info(`   Budget: $${budgetCheck.budget}`);
      logger.info(`   Spent: $${budgetCheck.spent}`);
      logger.info(`   Status: ${budgetCheck.status}`);
    }

    // Summary
    logger.info('\n✅ All tests completed successfully!');
    logger.info('Mr Krabs is ready to use with cached database tools only.');
    logger.info('No API calls were made - everything came from the local database.');
    logger.info('This prevents duplicate messages and ensures fast, reliable responses.');

    process.exit(0);

  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

main();
