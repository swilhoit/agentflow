#!/usr/bin/env ts-node

/**
 * Fetch current prices for all tickers in the AI Manhattan Project portfolio
 */

import { TickerMonitor, THESIS_PORTFOLIO } from '../services/tickerMonitor';
import { logger } from '../utils/logger';

async function main() {
  console.log('🚀 Fetching current prices for all AI Manhattan Project tickers...\n');

  const tickerMonitor = new TickerMonitor();

  // Get all unique tickers from portfolio
  const allTickers = THESIS_PORTFOLIO.flatMap(category => category.tickers);
  const uniqueTickers = [...new Set(allTickers)]; // Remove duplicates

  console.log(`📊 Total tickers to fetch: ${uniqueTickers.length}\n`);

  // Fetch data for all tickers
  const results = await tickerMonitor.fetchMultipleTickers(uniqueTickers);

  console.log('\n✅ Fetching complete! Results:\n');
  console.log('='.repeat(80));

  // Display results by category
  for (const category of THESIS_PORTFOLIO) {
    console.log(`\n${category.name}`);
    console.log(`${category.description} | Allocation: ${category.allocation || 'N/A'}`);
    console.log('-'.repeat(80));

    for (const symbol of category.tickers) {
      const data = results.get(symbol);

      if (data) {
        const changeSymbol = data.changePercent >= 0 ? '+' : '';
        const emoji = data.changePercent >= 0 ? '🟢' : '🔴';

        console.log(
          `${emoji} ${symbol.padEnd(12)} | $${data.price.toFixed(2).padStart(8)} | ` +
          `${changeSymbol}${data.changePercent.toFixed(2)}% | ${data.name.slice(0, 40)}`
        );

        // Show historical performance if available
        if (data.performance30d !== undefined) {
          const p30 = data.performance30d >= 0 ? `+${data.performance30d.toFixed(1)}%` : `${data.performance30d.toFixed(1)}%`;
          const p90 = data.performance90d !== undefined
            ? (data.performance90d >= 0 ? `+${data.performance90d.toFixed(1)}%` : `${data.performance90d.toFixed(1)}%`)
            : 'N/A';
          const p365 = data.performance365d !== undefined
            ? (data.performance365d >= 0 ? `+${data.performance365d.toFixed(1)}%` : `${data.performance365d.toFixed(1)}%`)
            : 'N/A';

          console.log(`   📈 Historical: 30d: ${p30} | 90d: ${p90} | 1y: ${p365}`);
        }
      } else {
        console.log(`❌ ${symbol.padEnd(12)} | Failed to fetch data`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));

  // Summary statistics
  const successfulFetches = results.size;
  const failedFetches = uniqueTickers.length - successfulFetches;

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Successful: ${successfulFetches}`);
  console.log(`   ❌ Failed: ${failedFetches}`);

  if (results.size > 0) {
    const prices = Array.from(results.values());
    const avgChange = prices.reduce((sum, data) => sum + data.changePercent, 0) / prices.length;
    const positiveCount = prices.filter(data => data.changePercent >= 0).length;
    const negativeCount = prices.filter(data => data.changePercent < 0).length;

    console.log(`\n📈 Portfolio Performance Today:`);
    console.log(`   Average Change: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`);
    console.log(`   🟢 Up: ${positiveCount} tickers`);
    console.log(`   🔴 Down: ${negativeCount} tickers`);

    // Best and worst performers
    const sorted = [...prices].sort((a, b) => b.changePercent - a.changePercent);

    console.log(`\n🏆 Top 5 Performers Today:`);
    sorted.slice(0, 5).forEach((data, i) => {
      console.log(`   ${i + 1}. ${data.symbol.padEnd(12)} ${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%`);
    });

    console.log(`\n📉 Bottom 5 Performers Today:`);
    sorted.slice(-5).reverse().forEach((data, i) => {
      console.log(`   ${i + 1}. ${data.symbol.padEnd(12)} ${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%`);
    });
  }

  console.log('\n✅ Done!\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
