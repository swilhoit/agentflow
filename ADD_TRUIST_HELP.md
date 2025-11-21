# 🏦 How to Add Truist Account to Teller

## The Problem

You already have 5 American Express accounts connected to Teller, but **can't find where to add another account** (Truist).

---

## ✅ Solution Options

### Option 1: Check Teller Dashboard Carefully

The location varies depending on your Teller account type:

#### If you have a Developer Account:
1. Go to: **https://teller.io** or **https://dashboard.teller.io**
2. Log in
3. Look for one of these sections:
   - **"Connected Accounts"**
   - **"Enrollments"** 
   - **"Institutions"**
   - **"Test Accounts"** (if in sandbox mode)
4. Look for buttons like:
   - **"+ Add Account"**
   - **"Connect New Institution"**
   - **"New Enrollment"**
   - **"Add Test Bank"** (sandbox)

#### Common Dashboard Layouts:
- **Left Sidebar**: Check for "Accounts", "Enrollments", or "Institutions"
- **Top Navigation**: Look for "Connect" or "Add Account"
- **Main Dashboard**: Look for a "+" button or "Add" button

### Option 2: Use Teller Connect (Recommended)

Since you already have accounts connected, you likely used Teller Connect before. Here's how to use it again:

#### A. Find Your Application ID

Your Teller setup should have an **Application ID**. Check:
- Teller dashboard → Settings → API Keys
- Look for: `app_xxxxxxxxxxxxx`

#### B. Use the Teller Connect HTML Page

I created `teller-connect.html` for you. To use it:

1. **Get your Application ID** from Teller dashboard
2. **Edit the HTML file**:
   ```bash
   nano teller-connect.html
   ```
3. **Find and replace**:
   ```javascript
   applicationId: 'YOUR_APPLICATION_ID'
   ```
   Replace with your actual ID: `app_xxxxxxxxxxxxx`

4. **Uncomment the SDK line** (near bottom of file):
   ```html
   <script src="https://cdn.teller.io/connect/connect.js"></script>
   ```

5. **Open in browser**:
   ```bash
   open teller-connect.html
   ```

6. **Click "Connect Truist Account"**

### Option 3: API Enrollment Token (Advanced)

You can programmatically create an enrollment using the Teller API:

```bash
# Check if there's an enrollments endpoint
cd teller_certificates

curl --cert certificate.pem \
     --key private_key.pem \
     -u token_77lfbjzhhtidtosa4rctadmclq: \
     https://api.teller.io/enrollments | python3 -m json.tool
```

This might show you existing enrollments and how to create new ones.

### Option 4: Contact Teller Support (Fastest!)

Since you already have accounts connected, Teller support can quickly help:

📧 **Email**: support@teller.io

**Message Template**:
```
Subject: Need Help Adding Truist Bank Account

Hi Teller Team,

I have an account with API token: token_77lfbjzhhtidtosa4rctadmclq

I currently have 5 American Express accounts connected, but I need 
to add my Truist bank account and can't find where to do this in 
the dashboard.

Can you please guide me on how to add another institution?

Thank you!
```

They usually respond within a few hours.

### Option 5: Check if Sandbox vs Production

Your existing AmEx accounts might be **test/sandbox accounts**. Check:

```bash
cd teller_certificates

# Check account details
curl --cert certificate.pem \
     --key private_key.pem \
     -u token_77lfbjzhhtidtosa4rctadmclq: \
     https://api.teller.io/accounts | python3 -c "
import sys, json
accounts = json.load(sys.stdin)
if accounts:
    print('Enrollment ID:', accounts[0].get('enrollment_id', 'N/A'))
    print('Institution ID:', accounts[0].get('institution', {}).get('id', 'N/A'))
"
```

If you see `enrollment_id` starting with `enr_test_`, you're in **sandbox mode**.

#### For Sandbox Mode:
- Visit: https://teller.io/docs/sandbox
- Use test credentials to add "Truist" test account
- Test banks have specific credentials (check Teller docs)

#### For Production Mode:
- You need real Truist credentials
- Use Teller Connect widget to add real accounts

---

## 🔍 Debugging Steps

### Step 1: Check Your Enrollment

```bash
cd /Volumes/LaCie/WEBDEV/agentflow/teller_certificates

# See all account details
curl --cert certificate.pem \
     --key private_key.pem \
     -u token_77lfbjzhhtidtosa4rctadmclq: \
     https://api.teller.io/accounts | python3 -m json.tool > accounts.json

# View the file
cat accounts.json
```

Look for:
- `enrollment_id` - This tells you which enrollment session created these accounts
- `institution.id` - Should be "amex" for American Express

### Step 2: Try the Enrollments Endpoint

```bash
# Check enrollments
curl --cert certificate.pem \
     --key private_key.pem \
     -u token_77lfbjzhhtidtosa4rctadmclq: \
     https://api.teller.io/enrollments | python3 -m json.tool
```

This might show you how to create new enrollments.

### Step 3: Check Teller Documentation

Visit: https://teller.io/docs/api/enrollments

Look for documentation on:
- Creating enrollment tokens
- Using Teller Connect
- Adding institutions

---

## 🎯 Most Likely Solution

Since you already have 5 AmEx accounts connected, you probably used one of these methods before:

1. **Teller Connect Widget** - You opened a popup/iframe and added AmEx
2. **Teller Dashboard** - You clicked a button to add a test account

**To add Truist, you'll need to use the same method again.**

### Quick Actions:

#### 1. Check for Application ID
```bash
# Your API token suggests you have an application
# Application ID format: app_xxxxxxxxxxxxx
# Check your Teller dashboard for this
```

#### 2. Email Teller Support (Recommended!)
Since you can't find the interface, **Teller support is your fastest option**:
- Email: support@teller.io  
- Include your API token
- Ask: "How do I add another bank (Truist) to my existing enrollment?"

#### 3. Check API Documentation
Visit: https://teller.io/docs/api
Look for "Enrollments" or "Teller Connect" sections

---

## 🆘 Still Stuck?

### Run This Diagnostic:

```bash
cd /Volumes/LaCie/WEBDEV/agentflow

# Create a diagnostic script
cat > check-teller-enrollment.sh << 'EOF'
#!/bin/bash
cd teller_certificates

echo "🔍 Checking Teller Setup..."
echo ""

echo "📋 Current Accounts:"
curl --cert certificate.pem \
     --key private_key.pem \
     -u token_77lfbjzhhtidtosa4rctadmclq: \
     -s https://api.teller.io/accounts | python3 -c "
import sys, json
accounts = json.load(sys.stdin)
for acc in accounts:
    print(f\"  • {acc['name']} ({acc['institution']['name']})\")
    print(f\"    Enrollment: {acc['enrollment_id']}\")
"

echo ""
echo "🔗 Trying enrollments endpoint..."
curl --cert certificate.pem \
     --key private_key.pem \
     -u token_77lfbjzhhtidtosa4rctadmclq: \
     -s https://api.teller.io/enrollments 2>&1 | head -20

echo ""
echo "📧 If you still can't add Truist, email:"
echo "   support@teller.io"
EOF

chmod +x check-teller-enrollment.sh
./check-teller-enrollment.sh
```

---

## 📞 Direct Support Channels

### Teller Support
- **Email**: support@teller.io
- **Documentation**: https://teller.io/docs
- **Status**: https://status.teller.io

### What to Include in Support Request:
1. Your API token (first 20 chars: `token_77lfbjzhhtidto...`)
2. Issue: "Cannot find where to add Truist bank to existing enrollment"
3. Current status: "5 AmEx accounts connected, need to add Truist"

---

## 💡 Quick Workaround

If you **urgently** need Truist data and can't wait:

### Create a New Teller Application
1. Go to https://teller.io
2. Create a new application
3. Get new API token and certificates
4. Connect Truist through new enrollment
5. Use both tokens in your app (one for AmEx, one for Truist)

This isn't ideal, but it works while you figure out the proper method.

---

## ✅ Next Steps

1. **Try Option 4 first** (email support@teller.io) ← **Fastest solution**
2. While waiting, check Teller dashboard more carefully
3. Review Teller Connect documentation
4. Run the diagnostic script above

**Most likely outcome**: Teller support will send you a link or show you exactly where to click in the dashboard to add another institution.

---

**Remember**: Since you already successfully connected 5 accounts, adding Truist should use the exact same process. Teller support can quickly point you to it!

