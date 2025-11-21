#!/usr/bin/env tsx

/**
 * Truist-Teller Connection Setup Helper
 * 
 * This script checks your setup status and guides you through connecting Truist to Teller
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

const ROOT = path.resolve(__dirname, '..');
const CERT_DIR = path.join(ROOT, 'teller_certificates');
const CERT_PATH = path.join(CERT_DIR, 'certificate.pem');
const KEY_PATH = path.join(CERT_DIR, 'private_key.pem');
const ENV_FILE = path.join(ROOT, 'advisor-env.yaml');

interface SetupStatus {
  apiToken: boolean;
  certificate: boolean;
  privateKey: boolean;
  accountsConnected?: boolean;
}

function printHeader(text: string) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${text}`);
  console.log('='.repeat(70) + '\n');
}

function printSection(text: string) {
  console.log('\n' + '-'.repeat(70));
  console.log(`  ${text}`);
  console.log('-'.repeat(70) + '\n');
}

function checkSetupStatus(): SetupStatus {
  const status: SetupStatus = {
    apiToken: false,
    certificate: false,
    privateKey: false
  };

  // Check API token
  if (fs.existsSync(ENV_FILE)) {
    const envContent = yaml.parse(fs.readFileSync(ENV_FILE, 'utf8'));
    status.apiToken = !!envContent.TELLER_API_TOKEN;
  }

  // Check certificates
  status.certificate = fs.existsSync(CERT_PATH);
  status.privateKey = fs.existsSync(KEY_PATH);

  return status;
}

function printSetupStatus(status: SetupStatus) {
  printSection('Setup Status Check');

  console.log('📋 Required Components:\n');
  
  console.log(`1. Teller API Token: ${status.apiToken ? '✅ Configured' : '❌ Missing'}`);
  if (status.apiToken) {
    console.log('   Location: advisor-env.yaml');
  } else {
    console.log('   Action needed: Add TELLER_API_TOKEN to advisor-env.yaml');
  }

  console.log(`\n2. Client Certificate: ${status.certificate ? '✅ Installed' : '❌ Missing'}`);
  if (status.certificate) {
    console.log(`   Location: ${CERT_PATH}`);
    const stats = fs.statSync(CERT_PATH);
    console.log(`   Size: ${stats.size} bytes`);
  } else {
    console.log(`   Expected location: ${CERT_PATH}`);
    console.log('   Action needed: Download from https://teller.io');
  }

  console.log(`\n3. Private Key: ${status.privateKey ? '✅ Installed' : '❌ Missing'}`);
  if (status.privateKey) {
    console.log(`   Location: ${KEY_PATH}`);
    const stats = fs.statSync(KEY_PATH);
    console.log(`   Size: ${stats.size} bytes`);
    
    // Check permissions
    const mode = stats.mode & parseInt('777', 8);
    const permStr = mode.toString(8);
    if (permStr === '600') {
      console.log('   Permissions: ✅ Secure (600)');
    } else {
      console.log(`   Permissions: ⚠️  ${permStr} (should be 600)`);
      console.log('   Run: chmod 600 teller_certificates/*.pem');
    }
  } else {
    console.log(`   Expected location: ${KEY_PATH}`);
    console.log('   Action needed: Download from https://teller.io');
  }
}

function printNextSteps(status: SetupStatus) {
  printSection('Next Steps');

  const allReady = status.apiToken && status.certificate && status.privateKey;

  if (!status.apiToken) {
    console.log('❌ Step 1: Configure Teller API Token\n');
    console.log('Add this to advisor-env.yaml:');
    console.log('  TELLER_API_TOKEN: "your_token_here"');
    console.log('\nGet your token from: https://teller.io\n');
  } else {
    console.log('✅ Step 1: API Token configured\n');
  }

  if (!status.certificate || !status.privateKey) {
    console.log('❌ Step 2: Download Teller Certificates\n');
    console.log('1. Visit: https://teller.io');
    console.log('2. Log into your account');
    console.log('3. Navigate to Settings → API → Certificates');
    console.log('4. Download both files:');
    console.log(`   - certificate.pem → ${CERT_PATH}`);
    console.log(`   - private_key.pem → ${KEY_PATH}`);
    console.log('\n5. Set proper permissions:');
    console.log('   chmod 600 teller_certificates/*.pem\n');
  } else {
    console.log('✅ Step 2: Certificates installed\n');
  }

  if (allReady) {
    console.log('✅ Step 3: Connect Your Truist Account\n');
    console.log('Your setup is ready! Now connect your Truist bank account:\n');
    console.log('Option A - Teller Dashboard (Easiest):');
    console.log('  1. Visit: https://teller.io');
    console.log('  2. Navigate to "Accounts" or "Connected Institutions"');
    console.log('  3. Click "Add Bank Account"');
    console.log('  4. Search for "Truist"');
    console.log('  5. Enter your Truist credentials');
    console.log('  6. Complete any 2FA steps');
    console.log('  7. Select which accounts to share\n');
    
    console.log('Option B - Teller Connect Widget:');
    console.log('  Implement the Teller Connect widget in your app');
    console.log('  See: https://teller.io/docs/connect\n');

    console.log('\n✅ Step 4: Test the Connection\n');
    console.log('After connecting Truist, test everything:');
    console.log('  npm run test:teller\n');
    
    console.log('If the test passes, your bot can access:');
    console.log('  - Real-time account balances');
    console.log('  - Transaction history');
    console.log('  - Spending analytics');
    console.log('  - And more!\n');
  } else {
    console.log('⏸️  Step 3: Connect Truist Account');
    console.log('   Complete steps 1-2 first\n');
    
    console.log('⏸️  Step 4: Test Connection');
    console.log('   Complete steps 1-3 first\n');
  }
}

function printTroubleshooting() {
  printSection('Common Issues & Solutions');

  console.log('❓ "Can\'t find certificates in Teller dashboard"');
  console.log('   → Check: Settings → API → Certificates');
  console.log('   → Or email: support@teller.io\n');

  console.log('❓ "Certificate permissions error"');
  console.log('   → Run: chmod 600 teller_certificates/*.pem\n');

  console.log('❓ "No accounts found after connecting"');
  console.log('   → Wait a few minutes for Teller to sync');
  console.log('   → Check Teller dashboard to verify connection');
  console.log('   → Try running: npm run test:teller\n');

  console.log('❓ "Truist login failed"');
  console.log('   → Verify credentials at https://truist.com');
  console.log('   → Check if 2FA is required');
  console.log('   → Make sure account is not locked\n');

  console.log('❓ "Connection keeps expiring"');
  console.log('   → Re-authenticate in Teller dashboard');
  console.log('   → Update credentials if you changed password\n');
}

function printQuickCommands() {
  printSection('Quick Reference Commands');

  console.log('# Check certificate files exist');
  console.log('ls -la teller_certificates/\n');

  console.log('# Set proper permissions');
  console.log('chmod 600 teller_certificates/*.pem\n');

  console.log('# Test Teller connection');
  console.log('npm run test:teller\n');

  console.log('# Start Financial Advisor bot');
  console.log('npm run advisor:dev\n');

  console.log('# View this help again');
  console.log('npx tsx scripts/setup-truist-connection.ts\n');
}

function printResources() {
  printSection('Additional Resources');

  console.log('📚 Documentation:');
  console.log('   - Teller Docs: https://teller.io/docs');
  console.log('   - Teller Dashboard: https://teller.io');
  console.log('   - Truist Online: https://truist.com\n');

  console.log('📁 Local Guides:');
  console.log('   - Truist Setup: docs/CONNECT_TRUIST_TO_TELLER.md');
  console.log('   - Teller Setup: docs/TELLER_API_SETUP_NEEDED.md');
  console.log('   - Certificate Info: teller_certificates/README.md\n');

  console.log('🧪 Test Scripts:');
  console.log('   - Test Teller API: scripts/test-teller-api.ts');
  console.log('   - Transaction Sync: scripts/test-transaction-sync.ts\n');
}

// Main execution
function main() {
  printHeader('🏦 Truist-Teller Connection Setup Helper');

  console.log('This script helps you connect your Truist bank account to Teller,');
  console.log('enabling your Financial Advisor bot to access real transaction data.\n');

  const status = checkSetupStatus();
  
  printSetupStatus(status);
  printNextSteps(status);
  printTroubleshooting();
  printQuickCommands();
  printResources();

  printSection('Summary');

  const totalSteps = 3;
  const completedSteps = [
    status.apiToken,
    status.certificate && status.privateKey,
    false // Account connection (we can't check this without API call)
  ].filter(Boolean).length;

  console.log(`Progress: ${completedSteps}/${totalSteps} setup steps completed\n`);

  if (completedSteps === 0) {
    console.log('🎯 Next action: Get your API token from https://teller.io');
  } else if (completedSteps === 1) {
    console.log('🎯 Next action: Download certificates from https://teller.io');
  } else if (completedSteps === 2) {
    console.log('🎯 Next action: Connect your Truist account via Teller dashboard');
    console.log('   Then run: npm run test:teller');
  } else {
    console.log('🎉 Setup appears complete! Run: npm run test:teller');
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

main();

