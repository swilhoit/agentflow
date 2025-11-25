/**
 * Add AI Infrastructure and Main Market Indices Symbols to Database
 *
 * This script populates the market_data table with placeholder data for
 * the new portfolio categories (AI Infrastructure and Main Market Indices).
 *
 * NOTE: This adds placeholder data. The Market Update Scheduler will fetch
 * real market data for these symbols during its next run.
 */

import { getSQLiteDatabase } from '../src/services/databaseFactory';
import { MAIN_INDICES, AI_INFRASTRUCTURE } from '../dashboard/lib/portfolio-categories';

interface SymbolInfo {
  symbol: string;
  name: string;
}

// Symbol name mappings
const SYMBOL_NAMES: Record<string, string> = {
  // Main Indices
  'SPY': 'SPDR S&P 500 ETF Trust',
  'QQQ': 'Invesco QQQ Trust',
  'DIA': 'SPDR Dow Jones Industrial Average ETF',
  'IWM': 'iShares Russell 2000 ETF',
  'GLD': 'SPDR Gold Shares',
  'BTC-USD': 'Bitcoin USD',
  'ETH-USD': 'Ethereum USD',
  'DXY': 'U.S. Dollar Index',
  'TLT': 'iShares 20+ Year Treasury Bond ETF',
  'VIX': 'CBOE Volatility Index',

  // AI Infrastructure
  'NVDA': 'NVIDIA Corporation',
  'AMD': 'Advanced Micro Devices, Inc.',
  'MSFT': 'Microsoft Corporation',
  'GOOGL': 'Alphabet Inc. Class A',
  'META': 'Meta Platforms, Inc.',
  'AMZN': 'Amazon.com, Inc.',
  'ORCL': 'Oracle Corporation',
  'PLTR': 'Palantir Technologies Inc.',
  'SNOW': 'Snowflake Inc.',
  'DDOG': 'Datadog, Inc.',
  'NET': 'Cloudflare, Inc.',
  'EQIX': 'Equinix, Inc.',
  'DLR': 'Digital Realty Trust, Inc.',
  'PWR': 'Quanta Services, Inc.',
  'SMCI': 'Super Micro Computer, Inc.',
  'ARM': 'ARM Holdings plc',
  'AVGO': 'Broadcom Inc.',
  'MU': 'Micron Technology, Inc.',
  'TSM': 'Taiwan Semiconductor Manufacturing Company',
};

async function addPortfolioSymbols() {
  console.log('🚀 Adding AI Infrastructure and Main Market Indices symbols...\n');

  const db = getSQLiteDatabase();
  const rawDb = db.getRawDatabase();

  // Get today's date
  const today = new Date().toISOString().split('T')[0];

  // Combine all new symbols
  const allNewSymbols: SymbolInfo[] = [
    ...MAIN_INDICES.symbols.map(symbol => ({
      symbol,
      name: SYMBOL_NAMES[symbol] || symbol
    })),
    ...AI_INFRASTRUCTURE.symbols.map(symbol => ({
      symbol,
      name: SYMBOL_NAMES[symbol] || symbol
    }))
  ];

  // Remove duplicates (some symbols might be in both portfolios, e.g., EQIX, DLR, PWR)
  const uniqueSymbols = Array.from(
    new Map(allNewSymbols.map(s => [s.symbol, s])).values()
  );

  console.log(`📊 Total unique symbols to add: ${uniqueSymbols.length}\n`);

  // Check which symbols already exist
  const existingSymbols = rawDb.prepare(`
    SELECT DISTINCT symbol FROM market_data
  `).all() as Array<{ symbol: string }>;

  const existingSet = new Set(existingSymbols.map(s => s.symbol));

  const newSymbols = uniqueSymbols.filter(s => !existingSet.has(s.symbol));
  const skippedSymbols = uniqueSymbols.filter(s => existingSet.has(s.symbol));

  console.log(`✅ Already in database: ${skippedSymbols.length}`);
  console.log(`➕ New symbols to add: ${newSymbols.length}\n`);

  if (newSymbols.length === 0) {
    console.log('✨ All symbols already exist in database. Nothing to add.\n');
    return;
  }

  // Insert placeholder data for new symbols
  const insertStmt = rawDb.prepare(`
    INSERT INTO market_data (
      symbol, name, price, change_amount, change_percent,
      volume, market_cap, performance_30d, performance_90d, performance_365d,
      date, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  let addedCount = 0;
  const transaction = rawDb.transaction((symbols: SymbolInfo[]) => {
    for (const { symbol, name } of symbols) {
      try {
        // Placeholder values - will be updated by Market Update Scheduler
        insertStmt.run(
          symbol,
          name,
          0.0,           // price
          0.0,           // change_amount
          0.0,           // change_percent
          0,             // volume
          0,             // market_cap
          0.0,           // performance_30d
          0.0,           // performance_90d
          0.0,           // performance_365d
          today          // date
        );
        addedCount++;
      } catch (error: any) {
        console.error(`❌ Error adding ${symbol}:`, error.message);
      }
    }
  });

  transaction(newSymbols);

  console.log(`✅ Successfully added ${addedCount} new symbols to database\n`);

  // Summary
  console.log('📋 SUMMARY:');
  console.log('─────────────────────────────────────────');
  console.log(`Main Market Indices: ${MAIN_INDICES.symbols.length} symbols`);
  console.log(`AI Infrastructure: ${AI_INFRASTRUCTURE.symbols.length} symbols`);
  console.log(`Total unique: ${uniqueSymbols.length} symbols`);
  console.log(`Already existed: ${skippedSymbols.length}`);
  console.log(`Newly added: ${addedCount}`);
  console.log('─────────────────────────────────────────\n');

  console.log('⚠️  NOTE: Placeholder data added (all values = 0)');
  console.log('📡 Run the Market Update Scheduler to fetch real market data:\n');
  console.log('   npm run build && npx ts-node src/schedulers/marketUpdateScheduler.ts\n');
}

// Run the script
addPortfolioSymbols()
  .then(() => {
    console.log('✨ Portfolio symbols addition complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error adding portfolio symbols:', error);
    process.exit(1);
  });
