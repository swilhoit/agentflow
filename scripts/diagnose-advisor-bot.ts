#!/usr/bin/env tsx

/**
 * Diagnostic script for Financial Advisor Discord Bot
 * 
 * Checks all requirements for the bot to access financial data
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSQLiteDatabase } from '../src/services/databaseFactory';

console.log('');
console.log('═'.repeat(80));
console.log('   🔍 FINANCIAL ADVISOR BOT DIAGNOSTIC');
console.log('═'.repeat(80));
console.log('');

const issues: string[] = [];
const warnings: string[] = [];
const successes: string[] = [];

// Check 1: Environment Variables
console.log('1️⃣  Checking Environment Variables...');
console.log('─'.repeat(80));

const requiredEnvVars = [
  'ADVISOR_DISCORD_TOKEN',
  'ANTHROPIC_API_KEY',
  'TELLER_API_TOKEN',
  'TELLER_CERT_PATH',
  'TELLER_KEY_PATH'
];

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (!value || value === '') {
    issues.push(`❌ ${varName} is not set`);
    console.log(`   ❌ ${varName}: NOT SET`);
  } else {
    successes.push(`✅ ${varName} is configured`);
    // Show partial value for security
    const display = varName.includes('TOKEN') || varName.includes('KEY') 
      ? value.substring(0, 10) + '...' 
      : value;
    console.log(`   ✅ ${varName}: ${display}`);
  }
});
console.log('');

// Check 2: Teller Certificates
console.log('2️⃣  Checking Teller API Certificates...');
console.log('─'.repeat(80));

const certPath = process.env.TELLER_CERT_PATH || '';
const keyPath = process.env.TELLER_KEY_PATH || '';

if (certPath && fs.existsSync(certPath)) {
  const stats = fs.statSync(certPath);
  console.log(`   ✅ Certificate found: ${certPath}`);
  console.log(`      Size: ${stats.size} bytes`);
  console.log(`      Modified: ${stats.mtime.toLocaleString()}`);
  successes.push('✅ certificate.pem exists');
} else {
  issues.push(`❌ Certificate not found at: ${certPath}`);
  console.log(`   ❌ Certificate not found: ${certPath}`);
}

if (keyPath && fs.existsSync(keyPath)) {
  const stats = fs.statSync(keyPath);
  console.log(`   ✅ Private key found: ${keyPath}`);
  console.log(`      Size: ${stats.size} bytes`);
  console.log(`      Modified: ${stats.mtime.toLocaleString()}`);
  successes.push('✅ private_key.pem exists');
} else {
  issues.push(`❌ Private key not found at: ${keyPath}`);
  console.log(`   ❌ Private key not found: ${keyPath}`);
}
console.log('');

// Check 3: Database
console.log('3️⃣  Checking Database...');
console.log('─'.repeat(80));

try {
  const db = getSQLiteDatabase();
  
  // Check if database file exists
  const dbPath = path.join(process.cwd(), 'data', 'agentflow.db');
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log(`   ✅ Database file found: ${dbPath}`);
    console.log(`      Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`      Modified: ${stats.mtime.toLocaleString()}`);
    successes.push('✅ Database file exists');
  } else {
    warnings.push(`⚠️  Database file not found at: ${dbPath}`);
    console.log(`   ⚠️  Database file not found: ${dbPath}`);
  }
  
  // Check if we can query the database
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const transactions = db.getTransactionsByDateRange(thirtyDaysAgo, today);
  
  console.log(`   ✅ Database is readable`);
  console.log(`      Transactions (last 30 days): ${transactions.length}`);
  
  if (transactions.length === 0) {
    warnings.push('⚠️  No transactions found in database (may need to sync)');
    console.log(`   ⚠️  No transactions in database - run sync script`);
  } else {
    successes.push(`✅ Database has ${transactions.length} recent transactions`);
    
    // Show date range
    const dates = transactions.map(t => t.date).sort();
    const oldest = dates[0];
    const newest = dates[dates.length - 1];
    console.log(`      Date range: ${oldest} to ${newest}`);
    
    // Show accounts
    const accounts = [...new Set(transactions.map(t => t.accountName || 'Unknown'))];
    console.log(`      Accounts: ${accounts.join(', ')}`);
  }
  
  successes.push('✅ Database is accessible and working');
  
} catch (error) {
  issues.push(`❌ Database error: ${error}`);
  console.log(`   ❌ Database error: ${error}`);
}
console.log('');

// Check 4: Financial Context Document
console.log('4️⃣  Checking Financial Context Document...');
console.log('─'.repeat(80));

const contextPath = path.join(process.cwd(), 'docs', 'FINANCIAL_CONTEXT.md');
if (fs.existsSync(contextPath)) {
  const stats = fs.statSync(contextPath);
  console.log(`   ✅ Context document found: ${contextPath}`);
  console.log(`      Size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`      Modified: ${stats.mtime.toLocaleString()}`);
  successes.push('✅ Financial context document exists');
} else {
  warnings.push('⚠️  Financial context document not found (helpful but not required)');
  console.log(`   ⚠️  Context document not found: ${contextPath}`);
}
console.log('');

// Check 5: Discord Bot Process
console.log('5️⃣  Checking if Discord Bot is Running...');
console.log('─'.repeat(80));

// Check package.json for scripts
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const scripts = packageJson.scripts || {};
  
  if (scripts['advisor:start'] || scripts['start:advisor']) {
    console.log(`   ✅ Advisor start script found in package.json`);
    const scriptName = scripts['advisor:start'] ? 'advisor:start' : 'start:advisor';
    console.log(`      Run with: npm run ${scriptName}`);
    successes.push('✅ Start script available');
  } else {
    warnings.push('⚠️  No advisor start script found in package.json');
    console.log(`   ⚠️  No advisor start script in package.json`);
    console.log(`      You may need to start it manually`);
  }
}
console.log('');

// Summary
console.log('═'.repeat(80));
console.log('   📊 DIAGNOSTIC SUMMARY');
console.log('═'.repeat(80));
console.log('');

console.log(`✅ Successes: ${successes.length}`);
successes.forEach(s => console.log(`   ${s}`));
console.log('');

if (warnings.length > 0) {
  console.log(`⚠️  Warnings: ${warnings.length}`);
  warnings.forEach(w => console.log(`   ${w}`));
  console.log('');
}

if (issues.length > 0) {
  console.log(`❌ Issues: ${issues.length}`);
  issues.forEach(i => console.log(`   ${i}`));
  console.log('');
}

// Recommendations
console.log('═'.repeat(80));
console.log('   💡 RECOMMENDATIONS');
console.log('═'.repeat(80));
console.log('');

if (issues.length > 0) {
  console.log('🚨 CRITICAL ISSUES TO FIX:');
  console.log('');
  
  const hasTokenIssues = issues.some(i => i.includes('TOKEN'));
  const hasCertIssues = issues.some(i => i.includes('Certificate') || i.includes('key'));
  const hasDbIssues = issues.some(i => i.includes('Database'));
  
  if (hasTokenIssues) {
    console.log('1. Set up environment variables in .env file:');
    console.log('   Copy .env.example to .env and fill in:');
    console.log('   - ADVISOR_DISCORD_TOKEN (from Discord Developer Portal)');
    console.log('   - ANTHROPIC_API_KEY (from Anthropic Console)');
    console.log('   - TELLER_API_TOKEN (from Teller Dashboard)');
    console.log('');
  }
  
  if (hasCertIssues) {
    console.log('2. Download Teller certificates:');
    console.log('   - Go to https://teller.io/dashboard');
    console.log('   - Download certificate.pem and private_key.pem');
    console.log('   - Place them in teller_certificates/ directory');
    console.log('   - Update .env with paths:');
    console.log('     TELLER_CERT_PATH=teller_certificates/certificate.pem');
    console.log('     TELLER_KEY_PATH=teller_certificates/private_key.pem');
    console.log('');
  }
  
  if (hasDbIssues) {
    console.log('3. Initialize database:');
    console.log('   npm run sync:all');
    console.log('   This will sync all transactions from Teller API to local database');
    console.log('');
  }
} else if (warnings.length > 0) {
  console.log('⚠️  OPTIONAL IMPROVEMENTS:');
  console.log('');
  
  if (warnings.some(w => w.includes('transactions'))) {
    console.log('- Sync transactions from Teller API:');
    console.log('  npm run sync:all');
    console.log('');
  }
}

if (issues.length === 0 && warnings.length === 0) {
  console.log('✅ ALL CHECKS PASSED!');
  console.log('');
  console.log('Your Financial Advisor bot should be working correctly.');
  console.log('');
  console.log('To start the bot:');
  console.log('  npm run advisor:start');
  console.log('');
  console.log('To test in Discord:');
  console.log('  @mr krabs how much did I spend this month?');
  console.log('');
}

console.log('═'.repeat(80));
console.log('');

// Exit code
if (issues.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

