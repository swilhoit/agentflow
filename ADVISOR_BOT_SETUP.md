# 💰 Financial Advisor Discord Bot Setup

## Current Status: ⚠️ CREDENTIALS NEEDED

Your financial data is ready (174 transactions in database + context document), but the Discord bot needs credentials to access it.

---

## 🔧 Setup Steps

### 1. Create .env File

```bash
cp .env.advisor .env
```

Then edit `.env` and fill in:

### 2. Get Discord Bot Token

1. Go to https://discord.com/developers/applications
2. Select your application (or create one)
3. Go to "Bot" section
4. Click "Reset Token" and copy it
5. Paste into `.env` as `ADVISOR_DISCORD_TOKEN`

### 3. Get Anthropic API Key

1. Go to https://console.anthropic.com/
2. Create an API key
3. Paste into `.env` as `ANTHROPIC_API_KEY`

### 4. Teller API Tokens (Already Have These!)

Your Teller tokens from `advisor-env.yaml`:
- AmEx: `token_77lfbjzhhtidtosa4rctadmclq`
- Truist: `token_hgpcghj7v7vaivxwoinyyggbza`

These are already in `.env.advisor` template!

### 5. Teller Certificates

Your certificates should already be in `teller_certificates/`:
- `certificate.pem`
- `private_key.pem`

The paths are already configured in `.env.advisor`!

### 6. Get Discord Channel ID

1. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
2. Right-click the channel where you want the bot
3. Click "Copy Channel ID"
4. Paste into `.env` as `ADVISOR_CHANNEL_ID`

---

## 🚀 Start the Bot

Once `.env` is configured:

```bash
npm run advisor:start
```

Or add this script to `package.json`:

```json
{
  "scripts": {
    "advisor:start": "tsx src/advisor/index.ts"
  }
}
```

Then start it:

```bash
npm run advisor:start
```

---

## ✅ Test in Discord

Once running, test with:

```
@mr krabs how much did I spend this month?
@mr krabs what's my balance?
@mr krabs show me my spending by category
```

---

## 🔍 Verify Setup

Run diagnostic anytime:

```bash
npx tsx scripts/diagnose-advisor-bot.ts
```

Should show all ✅ when ready!

---

## 📊 What Data is Available

The bot has access to:

✅ **174 recent transactions** (last 30 days)  
✅ **Date range:** Oct 21 - Nov 18, 2025  
✅ **Financial context document** with all your goals  
✅ **Teller API** for real-time balances

### Tools Available:

**Fast (from database):**
- Transaction history
- Spending by category
- Search transactions
- Budget analysis

**Real-time (from API):**
- Current account balances
- Net worth
- Recent sync status

---

## 🐛 Troubleshooting

### "Bot not responding in Discord"

1. Check bot is running: `ps aux | grep advisor`
2. Check credentials: `npx tsx scripts/diagnose-advisor-bot.ts`
3. Check Discord bot has permissions:
   - Read Messages
   - Send Messages
   - Read Message History

### "Can't access financial data"

1. Verify Teller tokens in `.env`
2. Check certificates exist in `teller_certificates/`
3. Run sync: `npm run sync:all`

### "Database empty"

```bash
npm run sync:all
```

This syncs all transactions from Teller API to local database.

---

## 💡 What the Bot Can Do

With your data, mr krabs can:

✅ Analyze spending patterns  
✅ Show budget breakdowns  
✅ Calculate savings goals  
✅ Track spending by category  
✅ Find specific transactions  
✅ Give financial advice  
✅ Monitor account balances  
✅ Help with house-buying plans  

All using YOUR actual financial data!

---

## 🔐 Security Notes

- `.env` is in `.gitignore` (never committed)
- Teller certificates should never be committed
- Bot only responds in configured channels
- All data stays local (database + memory)

---

## Next Steps

1. ✅ Copy `.env.advisor` to `.env`
2. ✅ Fill in Discord bot token
3. ✅ Fill in Anthropic API key
4. ✅ Fill in channel ID
5. ✅ Run `npm run advisor:start`
6. ✅ Test in Discord: `@mr krabs hello`

**Your financial data is ready - just need the bot credentials!** 💰🦀

