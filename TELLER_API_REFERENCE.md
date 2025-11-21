# 🔌 Teller API Reference Guide

Quick reference for testing your Teller API connection and querying bank data.

---

## 🚀 Quick Test Commands

### Using NPM Scripts (Recommended)

```bash
# TypeScript test (comprehensive, formatted output)
npm run test:teller

# Direct curl test (raw API responses)
npm run test:teller:curl

# Check setup status
npm run setup:truist
```

### Using curl Directly

```bash
# Navigate to certificate directory first
cd teller_certificates

# Get all connected accounts
curl --cert certificate.pem \
     --key private_key.pem \
     -u token_77lfbjzhhtidtosa4rctadmclq: \
     https://api.teller.io/accounts | python3 -m json.tool

# Get balances for a specific account
curl --cert certificate.pem \
     --key private_key.pem \
     -u token_77lfbjzhhtidtosa4rctadmclq: \
     https://api.teller.io/accounts/ACCOUNT_ID/balances | python3 -m json.tool

# Get recent transactions (last 10)
curl --cert certificate.pem \
     --key private_key.pem \
     -u token_77lfbjzhhtidtosa4rctadmclq: \
     https://api.teller.io/accounts/ACCOUNT_ID/transactions?count=10 | python3 -m json.tool

# Get account details
curl --cert certificate.pem \
     --key private_key.pem \
     -u token_77lfbjzhhtidtosa4rctadmclq: \
     https://api.teller.io/accounts/ACCOUNT_ID | python3 -m json.tool
```

---

## 📚 Teller API Endpoints

### Base URL
```
https://api.teller.io
```

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/accounts` | GET | List all connected accounts |
| `/accounts/:id` | GET | Get specific account details |
| `/accounts/:id/balances` | GET | Get account balances |
| `/accounts/:id/transactions` | GET | Get account transactions |
| `/accounts/:id/details` | GET | Get extended account details |

### Query Parameters

#### Transactions Endpoint

```
GET /accounts/:id/transactions?count=50&from_id=txn_xxx
```

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `count` | integer | Number of transactions to return | 100 |
| `from_id` | string | Pagination cursor (transaction ID) | - |

---

## 🔐 Authentication

Teller uses **mTLS (mutual TLS)** + **Basic Auth**:

1. **Client Certificates**: Required for mTLS
   - `certificate.pem` - Your public certificate
   - `private_key.pem` - Your private key

2. **API Token**: Used for Basic Auth
   - Token: `token_77lfbjzhhtidtosa4rctadmclq`
   - Format: `Authorization: Basic base64(token:)`

### Example Authentication (curl)

```bash
curl --cert certificate.pem \
     --key private_key.pem \
     -u token_77lfbjzhhtidtosa4rctadmclq: \
     https://api.teller.io/accounts
```

### Example Authentication (HTTPie)

```bash
# If you have httpie installed
http --cert certificate.pem \
     --cert-key private_key.pem \
     --auth token_77lfbjzhhtidtosa4rctadmclq: \
     https://api.teller.io/accounts
```

---

## 📊 Response Examples

### Accounts List

```json
[
  {
    "id": "acc_xxxxxxxx",
    "name": "Truist Checking",
    "type": "depository",
    "subtype": "checking",
    "status": "open",
    "currency": "USD",
    "last_four": "1234",
    "institution": {
      "name": "Truist",
      "id": "truist"
    },
    "links": {
      "self": "https://api.teller.io/accounts/acc_xxxxxxxx",
      "balances": "https://api.teller.io/accounts/acc_xxxxxxxx/balances",
      "transactions": "https://api.teller.io/accounts/acc_xxxxxxxx/transactions"
    }
  }
]
```

### Account Balances

```json
{
  "account_id": "acc_xxxxxxxx",
  "available": "2543.21",
  "ledger": "2543.21",
  "links": {
    "self": "https://api.teller.io/accounts/acc_xxxxxxxx/balances",
    "account": "https://api.teller.io/accounts/acc_xxxxxxxx"
  }
}
```

### Transactions List

```json
[
  {
    "id": "txn_xxxxxxxx",
    "account_id": "acc_xxxxxxxx",
    "date": "2025-11-18",
    "description": "Amazon.com",
    "amount": "-29.99",
    "type": "card_payment",
    "status": "posted",
    "details": {
      "counterparty": {
        "name": "AMAZON",
        "type": "organization"
      },
      "category": "shopping"
    },
    "links": {
      "self": "https://api.teller.io/accounts/acc_xxxxxxxx/transactions/txn_xxxxxxxx",
      "account": "https://api.teller.io/accounts/acc_xxxxxxxx"
    }
  }
]
```

---

## 🏦 Account Types

| Type | Subtype | Description |
|------|---------|-------------|
| `depository` | `checking` | Checking accounts |
| `depository` | `savings` | Savings accounts |
| `depository` | `money_market` | Money market accounts |
| `credit` | `credit_card` | Credit card accounts |
| `loan` | `mortgage` | Mortgage loans |
| `loan` | `auto` | Auto loans |
| `loan` | `personal` | Personal loans |

---

## 💳 Transaction Types

| Type | Description |
|------|-------------|
| `card_payment` | Debit/credit card purchase |
| `ach` | ACH transfer |
| `wire` | Wire transfer |
| `check` | Check payment |
| `transfer` | Account transfer |
| `refund` | Refund/credit |
| `fee` | Bank fee |
| `interest` | Interest payment |
| `dividend` | Dividend payment |
| `atm` | ATM withdrawal |

---

## 🔄 Testing Different Scenarios

### 1. Check What's Currently Connected

```bash
npm run test:teller
```

Expected: See list of all connected accounts (currently 5 AmEx, 0 Truist)

### 2. Test Raw API Response

```bash
npm run test:teller:curl
```

Expected: See formatted JSON responses from API

### 3. After Adding Truist

Once you add Truist via Teller dashboard, run:

```bash
npm run test:teller
```

Expected: See Truist accounts appear in the list!

### 4. Test Specific Account

```bash
# Get account ID from test output, then:
cd teller_certificates

# Replace ACCOUNT_ID with actual ID
curl --cert certificate.pem \
     --key private_key.pem \
     -u token_77lfbjzhhtidtosa4rctadmclq: \
     https://api.teller.io/accounts/ACCOUNT_ID/transactions?count=20 \
     | python3 -m json.tool
```

---

## 🛠️ Troubleshooting API Calls

### Error: "Missing certificate"

**Problem**: Certificate files not found or not readable

**Solution**:
```bash
# Check files exist
ls -la teller_certificates/

# Should see:
# certificate.pem
# private_key.pem

# Fix permissions
chmod 600 teller_certificates/*.pem
```

### Error: "Invalid certificate" or "Certificate verification failed"

**Problem**: Certificates may be expired or corrupted

**Solution**:
1. Re-download certificates from https://teller.io
2. Replace existing files in `teller_certificates/`
3. Run test again

### Error: "Unauthorized" or 401

**Problem**: API token issue

**Solution**:
1. Verify token in `advisor-env.yaml`
2. Check token format (should start with `token_`)
3. Ensure no extra spaces or quotes

### Error: "Account not found" or 404

**Problem**: Account ID doesn't exist or access removed

**Solution**:
1. Run `npm run test:teller` to get current account IDs
2. Check if account was disconnected in Teller dashboard
3. Try re-connecting the account

### Empty Response or No Accounts

**Problem**: No banks connected yet

**Solution**:
1. Visit https://teller.io
2. Add bank accounts (including Truist!)
3. Run test again

---

## 📋 Quick Checklist

Before testing API:
- [ ] Certificates exist in `teller_certificates/`
- [ ] Certificate permissions are 600
- [ ] API token configured in `advisor-env.yaml`
- [ ] At least one bank account connected in Teller dashboard

To add Truist:
- [ ] Visit https://teller.io
- [ ] Click "Add Bank Account"
- [ ] Search for "Truist"
- [ ] Enter credentials
- [ ] Complete 2FA
- [ ] Run `npm run test:teller` to verify

---

## 🔗 Resources

- **Teller API Docs**: https://teller.io/docs/api
- **Teller Dashboard**: https://teller.io
- **Support**: support@teller.io

### Local Documentation

- Setup Guide: `docs/CONNECT_TRUIST_TO_TELLER.md`
- Quick Start: `TRUIST_SETUP_QUICKSTART.md`
- Next Steps: `TRUIST_NEXT_STEPS.txt`
- Setup Helper: `npm run setup:truist`

---

## 💡 Pro Tips

1. **Use npm scripts for regular testing** - They provide better formatted output
2. **Use curl for debugging** - See raw API responses
3. **Check account IDs first** - Get list before querying specific accounts
4. **Test after adding banks** - Verify new connections immediately
5. **Keep certificates secure** - Never commit or share `.pem` files

---

**Current Status**: ✅ API working, 5 AmEx accounts connected, Truist not yet added

**Next Step**: Visit https://teller.io and add your Truist account!

