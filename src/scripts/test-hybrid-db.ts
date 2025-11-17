#!/usr/bin/env ts-node

/**
 * Test hybrid database mode - verify switching between SQLite and Cloud SQL
 */

import { getDatabase, resetDatabaseInstance } from '../services/databaseFactory';
import { logger } from '../utils/logger';

async function testDatabaseMode(mode: 'sqlite' | 'cloudsql') {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing DATABASE_TYPE=${mode}`);
  console.log('='.repeat(80));

  // Set environment variable
  process.env.DATABASE_TYPE = mode;

  // Reset instance to force recreation
  resetDatabaseInstance();

  try {
    const db = getDatabase();
    console.log(`✅ Database instance created for ${mode}`);

    // Test save market data
    console.log('\n📊 Testing saveMarketData...');
    const marketDataId = await db.saveMarketData({
      symbol: 'TEST',
      name: 'Test Company',
      price: 100.50,
      changeAmount: 2.50,
      changePercent: 2.55,
      volume: 1000000,
      marketCap: 50000000000,
      performance30d: 5.2,
      performance90d: 12.8,
      performance365d: 45.6,
      date: '2025-11-17'
    });
    console.log(`   ✅ Saved market data with ID: ${marketDataId}`);

    // Test save market news
    console.log('\n📰 Testing saveMarketNews...');
    const newsId = await db.saveMarketNews({
      articleId: Math.floor(Math.random() * 1000000),
      symbol: 'TEST',
      headline: 'Test Headline',
      summary: 'Test summary',
      source: 'Test Source',
      url: 'https://example.com/test',
      publishedAt: new Date(),
      category: 'general',
      isSignificant: true
    });
    console.log(`   ✅ Saved market news with ID: ${newsId}`);

    // Test save weekly analysis
    console.log('\n📋 Testing saveWeeklyAnalysis...');
    const analysisId = await db.saveWeeklyAnalysis({
      weekStart: '2025-11-10',
      weekEnd: '2025-11-17',
      analysisType: 'thesis',
      title: 'Test Weekly Analysis',
      summary: 'Test summary',
      detailedAnalysis: JSON.stringify({ test: 'data' }),
      keyEvents: JSON.stringify(['Event 1', 'Event 2']),
      recommendations: JSON.stringify(['Recommendation 1']),
      metadata: JSON.stringify({ test: true })
    });
    console.log(`   ✅ Saved weekly analysis with ID: ${analysisId}`);

    // Test query market data
    console.log('\n🔍 Testing getMarketDataByDateRange...');
    const marketData = await db.getMarketDataByDateRange('2025-11-01', '2025-11-30');
    console.log(`   ✅ Retrieved ${marketData.length} market data records`);

    // Test query news
    console.log('\n🔍 Testing getMarketNewsByDateRange...');
    const news = await db.getMarketNewsByDateRange('2025-11-01', '2025-11-30');
    console.log(`   ✅ Retrieved ${news.length} news records`);

    // Test query latest analysis
    console.log('\n🔍 Testing getLatestWeeklyAnalysis...');
    const latestAnalysis = await db.getLatestWeeklyAnalysis('thesis');
    console.log(`   ✅ Retrieved latest analysis: ${latestAnalysis ? 'Found' : 'Not found'}`);
    if (latestAnalysis) {
      console.log(`      Title: ${latestAnalysis.title}`);
    }

    console.log(`\n✅ All tests passed for ${mode}!`);

  } catch (error: any) {
    console.error(`\n❌ Error testing ${mode}:`, error.message);
    throw error;
  } finally {
    resetDatabaseInstance();
  }
}

async function main() {
  console.log('🧪 Testing Hybrid Database Mode\n');

  // Test SQLite mode
  await testDatabaseMode('sqlite');

  // Test Cloud SQL mode (only if credentials are configured)
  if (process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME &&
      process.env.CLOUDSQL_DATABASE &&
      process.env.CLOUDSQL_USER &&
      process.env.CLOUDSQL_PASSWORD) {
    await testDatabaseMode('cloudsql');
  } else {
    console.log('\n' + '='.repeat(80));
    console.log('⏭️  Skipping Cloud SQL test - credentials not configured');
    console.log('   To test Cloud SQL, add these to your .env:');
    console.log('   - CLOUDSQL_INSTANCE_CONNECTION_NAME');
    console.log('   - CLOUDSQL_DATABASE');
    console.log('   - CLOUDSQL_USER');
    console.log('   - CLOUDSQL_PASSWORD');
    console.log('='.repeat(80));
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Hybrid database system is working!');
  console.log('='.repeat(80));
  console.log('\n💡 Usage:');
  console.log('   For SQLite:   DATABASE_TYPE=sqlite');
  console.log('   For Cloud SQL: DATABASE_TYPE=cloudsql');
  console.log('\n');
}

main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
