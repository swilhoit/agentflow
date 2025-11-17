#!/usr/bin/env ts-node

/**
 * Fetch historical price data for all AI Manhattan Project tickers
 * Populates database with last 30 days of daily prices for trend analysis
 */

import YahooFinanceClass from 'yahoo-finance2';
import { THESIS_PORTFOLIO } from '../services/tickerMonitor';
import { getDatabase } from '../services/databaseFactory';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const yahooFinance = new YahooFinanceClass();

async function main() {
  console.log('📊 Fetching Historical Price Data for AI Manhattan Project Tickers\n');
  console.log('='.repeat(80));

  const db = getDatabase();

  // Get all unique tickers
  const allTickers = THESIS_PORTFOLIO.flatMap(category => category.tickers);
  const uniqueTickers = [...new Set(allTickers)];

  console.log(`Tickers to fetch: ${uniqueTickers.length}`);

  // Date range: last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  console.log(`Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);

  let totalDataPoints = 0;
  let successfulTickers = 0;
  let failedTickers: string[] = [];

  // Fetch historical data for each ticker
  for (let i = 0; i < uniqueTickers.length; i++) {
    const symbol = uniqueTickers[i];

    try {
      console.log(`[${i + 1}/${uniqueTickers.length}] Fetching ${symbol}...`);

      // Fetch historical data
      const historicalData = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      });

      if (historicalData && historicalData.length > 0) {
        console.log(`   📈 Found ${historicalData.length} data points`);

        // Get quote for current name
        let tickerName = symbol;
        try {
          const quote = await yahooFinance.quote(symbol);
          tickerName = quote.longName || quote.shortName || symbol;
        } catch (e) {
          // Use symbol as fallback
        }

        let savedCount = 0;

        // Save each historical data point
        for (const dataPoint of historicalData) {
          try {
            const date = new Date(dataPoint.date);
            const dateStr = date.toISOString().split('T')[0];

            // Calculate daily change
            const open = dataPoint.open || dataPoint.close;
            const close = dataPoint.close;
            const changeAmount = close - open;
            const changePercent = ((changeAmount / open) * 100);

            // For historical data, we don't have forward-looking performance
            // We'll calculate it from the data we have
            const performance30d = await calculatePerformance(historicalData, dataPoint.date, 30);
            const performance90d = undefined; // Would need 90+ days of data
            const performance365d = undefined; // Would need 365+ days of data

            await db.saveMarketData({
              symbol,
              name: tickerName,
              price: close,
              changeAmount,
              changePercent,
              volume: dataPoint.volume || undefined,
              marketCap: undefined, // Not available in historical data
              performance30d,
              performance90d,
              performance365d,
              date: dateStr
            });

            savedCount++;

          } catch (error: any) {
            // Likely duplicate date, skip
            logger.debug(`Skipped duplicate for ${symbol} on ${dataPoint.date}`);
          }
        }

        console.log(`   💾 Saved ${savedCount} historical price points`);
        totalDataPoints += savedCount;
        successfulTickers++;

      } else {
        console.log(`   ⚠️  No historical data found`);
        failedTickers.push(symbol);
      }

      // Small delay to avoid overwhelming the API
      if (i < uniqueTickers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      failedTickers.push(symbol);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 HISTORICAL PRICE DATA SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Data Points Saved: ${totalDataPoints}`);
  console.log(`Successful Tickers: ${successfulTickers}/${uniqueTickers.length}`);
  console.log(`Failed Tickers: ${failedTickers.length}`);
  if (failedTickers.length > 0) {
    console.log(`   Failed: ${failedTickers.join(', ')}`);
  }
  console.log(`Date Range: Last 30 days (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`);
  console.log('='.repeat(80));

  console.log('\n📈 Data Points by Category:\n');

  for (const category of THESIS_PORTFOLIO) {
    const categoryPoints = category.tickers.reduce((sum, ticker) => {
      // Estimate: successful tickers had ~30 points each
      return sum + (failedTickers.includes(ticker) ? 0 : 30);
    }, 0);

    console.log(`${category.name}`);
    console.log(`   Estimated: ${categoryPoints} data points`);
  }

  console.log('\n='.repeat(80));
  console.log('✅ Historical price data fetch complete!\n');
  console.log('💡 Next step:');
  console.log('   Run: npx ts-node src/scripts/generate-comprehensive-report.ts\n');
}

/**
 * Calculate performance over a period from historical data
 */
function calculatePerformance(
  historicalData: any[],
  currentDate: Date,
  daysBack: number
): number | undefined {
  try {
    const currentDataPoint = historicalData.find(d =>
      new Date(d.date).toDateString() === new Date(currentDate).toDateString()
    );

    if (!currentDataPoint) return undefined;

    const targetDate = new Date(currentDate);
    targetDate.setDate(targetDate.getDate() - daysBack);

    // Find closest data point to target date
    let closestPoint = null;
    let minDiff = Infinity;

    for (const point of historicalData) {
      const pointDate = new Date(point.date);
      const diff = Math.abs(pointDate.getTime() - targetDate.getTime());

      if (diff < minDiff && pointDate <= new Date(currentDate)) {
        minDiff = diff;
        closestPoint = point;
      }
    }

    if (!closestPoint) return undefined;

    const oldPrice = closestPoint.close;
    const newPrice = currentDataPoint.close;

    return ((newPrice - oldPrice) / oldPrice) * 100;

  } catch (error) {
    return undefined;
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
