# 🏦 Connecting Truist to Teller

This guide walks you through connecting your Truist bank account to Teller, so your Financial Advisor bot can access real transaction data.

## Overview

Your project already has Teller API configured! You just need to:
1. ✅ **API Token** - Already configured: `token_77lfbjzhhtidtosa4rctadmclq`
2. ❌ **Download Certificates** - Need to download from Teller
3. ❌ **Connect Truist Account** - Link your bank account via Teller Connect

---

## Step 1: Download Teller Certificates

### Why Certificates Are Needed
Teller uses mTLS (mutual TLS) authentication, which requires both an API token (you have this) AND client certificates.

### How to Get Certificates

1. **Visit Teller Dashboard**
   - Go to: https://teller.io
   - Log into your account

2. **Navigate to API/Certificates Section**
   - Look for **Settings** → **API** or **Certificates**
   - You should see options to download client certificates

3. **Download Both Files**:
   - `certificate.pem` - Your public certificate
   - `private_key.pem` - Your private key

4. **Save Files Here**:
   ```
   /Volumes/LaCie/WEBDEV/agentflow/teller_certificates/certificate.pem
   /Volumes/LaCie/WEBDEV/agentflow/teller_certificates/private_key.pem
   ```

5. **Set Proper Permissions** (for security):
   ```bash
   cd /Volumes/LaCie/WEBDEV/agentflow
   chmod 600 teller_certificates/*.pem
   ```

### Verify Certificate Installation

After downloading, your directory should look like:
```
teller_certificates/
├── README.md          ✅ (already there)
├── certificate.pem    ← You just downloaded this
└── private_key.pem    ← You just downloaded this
```

---

## Step 2: Connect Truist Bank Account

Once you have certificates installed, you need to link your Truist account through **Teller Connect**.

### Option A: Use Teller Dashboard (Recommended)

1. **Log into Teller Dashboard**
   - Visit: https://teller.io
   - Navigate to **Accounts** or **Connected Institutions**

2. **Click "Add Bank Account" or "Connect Account"**

3. **Search for "Truist"**
   - Select "Truist Bank" from the list of institutions

4. **Enter Your Truist Credentials**
   - Username/Login ID
   - Password
   - Complete any 2FA/MFA steps Truist requires

5. **Authorize Access**
   - Review permissions (read account info, transactions, balances)
   - Confirm the connection

6. **Select Accounts**
   - Choose which Truist accounts to share (checking, savings, credit cards)

### Option B: Use Teller Connect Widget (Programmatic)

If you need to automate this or want users to connect their own accounts:

1. **Implement Teller Connect in Your App**
   ```typescript
   // Example: Add Teller Connect widget
   // This creates a secure popup for bank connection
   
   import TellerConnect from '@teller-io/teller-connect';
   
   const tellerConnect = TellerConnect({
     applicationId: 'your_application_id',
     onSuccess: (authorization) => {
       console.log('Successfully connected bank account!');
       console.log('Access Token:', authorization.accessToken);
     },
     onExit: () => {
       console.log('User closed connection flow');
     }
   });
   
   tellerConnect.open();
   ```

2. **Search for Truist** in the widget
3. **Enter credentials** securely (handled by Teller, not your app)
4. **Complete connection**

### What Happens During Connection

Teller will:
- ✅ Securely authenticate with Truist
- ✅ Fetch your account information (balances, account numbers)
- ✅ Begin syncing transactions (usually last 90 days)
- ✅ Maintain ongoing connection for updates

**Important**: Your Truist credentials are NEVER stored in your app. Teller handles authentication securely.

---

## Step 3: Test the Connection

Once certificates are installed AND your Truist account is connected, test everything:

```bash
cd /Volumes/LaCie/WEBDEV/agentflow

# Run the test script
npm run test:teller

# Or run directly
npx tsx scripts/test-teller-api.ts
```

### Expected Output

If successful, you should see:
```
🔍 Testing Teller API Access...

📋 Configuration Check:
✅ TELLER_API_TOKEN: Set (token_77lfbjzhhti...)
✅ Teller API certificates loaded

🏦 Test 1: Fetching Connected Accounts...
✅ Successfully connected!
📊 Found 1 account(s):

1. Truist Checking
   Type: depository (checking)
   Institution: Truist
   Balance: $2,543.21
   Last Four: 1234
   Status: open
   ID: acc_xxxxxxxxxxxxx

💰 Test 2: Fetching Balance Summary...
✅ Balance Summary:
   Total Assets: $2,543.21
   Total Liabilities: $0.00
   Net Worth: $2,543.21

📝 Test 3: Fetching Recent Transactions...
✅ Found 5 recent transaction(s) from Truist Checking:

1. 2024-01-15 - Amazon.com
   Amount: $-29.99
   Type: card_payment
   Category: shopping

2. 2024-01-14 - Starbucks
   Amount: $-5.75
   Type: card_payment
   Category: dining

...
```

---

## Step 4: Use Financial Advisor Bot

Once connected, your bot can access real Truist data!

### Start the Bot

```bash
# Development mode
npm run advisor:dev

# Production mode (cloud deployment)
./deploy/gcp-cloud-run-advisor.sh
```

### What Your Bot Can Do

With Truist connected, users can ask:

- 💰 **"What's my current balance?"**
  - Bot fetches real-time balance from Truist

- 📊 **"How much did I spend on dining last month?"**
  - Analyzes transactions by category

- 🔍 **"Show me recent Amazon purchases"**
  - Searches transaction descriptions

- 💡 **"Am I staying within my $500 grocery budget?"**
  - Compares spending to budget

- 📈 **"What's my net worth?"**
  - Calculates total across all accounts

---

## Troubleshooting

### "Missing certificate" Error
**Problem**: Certificates not found or in wrong location

**Solution**:
```bash
# Verify files exist
ls -la /Volumes/LaCie/WEBDEV/agentflow/teller_certificates/

# Should see:
# certificate.pem
# private_key.pem

# Check permissions
chmod 600 teller_certificates/*.pem
```

### "No accounts found" Error
**Problem**: Truist account not connected yet

**Solution**:
1. Log into https://teller.io
2. Navigate to "Connected Accounts" or "Institutions"
3. Click "Add Bank" → Search "Truist"
4. Complete the connection flow

### "Invalid credentials" Error from Truist
**Problem**: Truist login failed

**Solution**:
- Verify your Truist username/password are correct
- Check if your Truist account requires 2FA (text message, app verification)
- Make sure your Truist account is active and not locked
- Try logging into https://truist.com directly first

### "Connection expired" Error
**Problem**: Truist connection needs re-authentication

**Solution**:
- Bank connections expire periodically for security
- Re-authenticate through Teller dashboard
- Update credentials if you changed your Truist password

### Certificate Format Issues
**Problem**: Wrong file format

**Solution**:
- Certificates must be in PEM format (text files)
- They should start with `-----BEGIN CERTIFICATE-----`
- NOT .p12, .pfx, or binary formats
- If you have the wrong format, re-download from Teller

---

## Security & Privacy

### What Data Is Shared?
Through Teller, your bot can access:
- ✅ Account balances
- ✅ Transaction history
- ✅ Account details (type, institution, last 4 digits)

Your bot **CANNOT**:
- ❌ Transfer money
- ❌ Make payments
- ❌ Change account settings
- ❌ Access your Truist password

### How Data Is Secured
- 🔒 mTLS encryption for all API calls
- 🔒 Certificates stored locally (never in git)
- 🔒 Read-only access to account data
- 🔒 Truist credentials handled by Teller (not your app)

---

## Supported Truist Account Types

Teller supports these Truist account types:
- ✅ **Checking accounts**
- ✅ **Savings accounts**
- ✅ **Money market accounts**
- ✅ **Credit cards**
- ⚠️ **Loans** (limited support)
- ⚠️ **Mortgages** (limited support)
- ⚠️ **Investment accounts** (may not be available)

---

## Next Steps

### 1. Download Certificates
- [ ] Visit https://teller.io
- [ ] Download `certificate.pem`
- [ ] Download `private_key.pem`
- [ ] Save to `teller_certificates/` directory
- [ ] Run: `chmod 600 teller_certificates/*.pem`

### 2. Connect Truist
- [ ] Log into Teller dashboard
- [ ] Click "Add Bank Account"
- [ ] Search for "Truist"
- [ ] Enter your Truist credentials
- [ ] Complete 2FA if required
- [ ] Select accounts to share

### 3. Test Connection
- [ ] Run: `npm run test:teller`
- [ ] Verify accounts appear
- [ ] Check balance is correct
- [ ] Review recent transactions

### 4. Use Your Bot!
- [ ] Start bot: `npm run advisor:dev`
- [ ] Ask about your balance
- [ ] Query recent spending
- [ ] Get financial insights

---

## Quick Reference Commands

```bash
# Test Teller connection
npm run test:teller

# Start Financial Advisor bot (development)
npm run advisor:dev

# Check certificate permissions
ls -la teller_certificates/

# View environment variables
cat advisor-env.yaml

# Deploy to production
./deploy/gcp-cloud-run-advisor.sh
```

---

## Additional Resources

- **Teller Documentation**: https://teller.io/docs
- **Teller Dashboard**: https://teller.io
- **Teller Support**: support@teller.io
- **Truist Online Banking**: https://truist.com
- **Your Test Script**: `/scripts/test-teller-api.ts`
- **Certificate README**: `/teller_certificates/README.md`

---

**Need Help?** 
- Check `/docs/TELLER_API_SETUP_NEEDED.md` for more certificate info
- Review `/docs/TRANSACTION_SYNC_QUICK_START.md` for transaction syncing
- Run `npm run test:teller` to diagnose connection issues

**Ready to Go?** Download your certificates from Teller and connect Truist! 🚀

