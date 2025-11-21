# 🏦 Teller API - Setup Required

## Test Results Summary

✅ **Test Script Created**: `scripts/test-teller-api.ts`  
✅ **API Token Configured**: `token_77lfbjzhhtidtosa4rctadmclq`  
❌ **Client Certificates Missing**: Required for API access  

## Current Status

The Teller API test revealed that **client certificates are missing**. Teller requires mTLS (mutual TLS) authentication, which means you need both:
1. Your API token (✅ you have this)
2. Client certificates (❌ you need to download these)

### Error Received
```
Error: Missing certificate: Retry request using your Teller client certificate.
Status Code: 400
```

## 📋 What You Need To Do

### Step 1: Download Certificates from Teller

You need to download two files from your Teller account:

1. **Log into Teller Dashboard**
   - Visit: https://teller.io
   - Log into your account
   - Navigate to **API Settings** or **Certificates** section

2. **Download Both Certificate Files**:
   - `certificate.pem` - Your public certificate
   - `private_key.pem` - Your private key

3. **Save to This Location**:
   ```
   /Volumes/LaCie/WEBDEV/agentflow/teller_certificates/
   ```

### Step 2: Verify Certificate Files

After downloading, your directory should look like:
```
teller_certificates/
├── README.md          ✅ (already there)
├── certificate.pem    ❌ (you need to download)
└── private_key.pem    ❌ (you need to download)
```

### Step 3: Run the Test Again

Once you've placed the certificates, test the connection:

```bash
# Quick test
npm run test:teller

# Or run directly
npx tsx scripts/test-teller-api.ts
```

## 🔒 Security Notes

The certificates have been added to `.gitignore` to prevent accidental commits:
- ✅ `teller_certificates/*.pem` is now ignored
- ✅ `*.pem` files are excluded from version control
- ✅ Only the README will be tracked in git

**Never commit or share your certificate files!**

## 📁 File Locations

| File | Location | Status |
|------|----------|--------|
| API Token | `advisor-env.yaml` | ✅ Configured |
| Test Script | `scripts/test-teller-api.ts` | ✅ Created |
| Certificate Directory | `teller_certificates/` | ✅ Created |
| Public Certificate | `teller_certificates/certificate.pem` | ❌ **DOWNLOAD NEEDED** |
| Private Key | `teller_certificates/private_key.pem` | ❌ **DOWNLOAD NEEDED** |

## 🧪 What The Test Will Do

Once certificates are in place, the test will:

1. ✅ Verify API connection
2. ✅ List all connected bank accounts
3. ✅ Show account balances and types
4. ✅ Calculate net worth summary
5. ✅ Fetch recent transactions (from first account)

Sample output you'll see:
```
🏦 Test 1: Fetching Connected Accounts...
✅ Successfully connected!
📊 Found 3 account(s):

1. Chase Checking
   Type: depository (checking)
   Institution: Chase
   Balance: $5,432.10
   Status: open

2. Savings Account
   Type: depository (savings)
   Balance: $15,000.00
   Status: open

💰 Test 2: Balance Summary
   Total Assets: $20,432.10
   Net Worth: $20,432.10
```

## 🆘 Troubleshooting

### Can't Find Certificates in Teller Dashboard?

**Option 1**: Check Teller Documentation
- Visit: https://teller.io/docs/authentication

**Option 2**: Contact Teller Support
- Email: support@teller.io
- Include your account details and mention you need mTLS certificates

**Option 3**: Use Teller CLI (if available)
```bash
teller certificates download
```

### Certificate Permissions Error?
```bash
chmod 600 teller_certificates/*.pem
```

### Wrong Certificate Format?
- Ensure files are in PEM format (text files starting with `-----BEGIN`)
- They should NOT be .p12, .pfx, or other binary formats

## 🚀 Once Working

After certificates are configured, your Financial Advisor bot will be able to:

- 💰 Check real account balances
- 📊 Analyze spending patterns
- 🏦 Track transactions across all accounts
- 📈 Calculate net worth
- 💡 Provide personalized financial advice
- 🎯 Help with budget tracking and savings goals

## Quick Commands

```bash
# Test Teller connection
npm run test:teller

# Run Financial Advisor bot (once certs are ready)
npm run advisor:dev

# Deploy Financial Advisor to cloud
./deploy/gcp-cloud-run-advisor.sh
```

---

**Next Steps**: Download your certificates from https://teller.io and place them in the `teller_certificates/` directory, then run `npm run test:teller` to verify!

