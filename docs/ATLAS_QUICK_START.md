# Atlas Bot - Quick Start 🚀

## 1. Enable Message Content Intent

**CRITICAL FIRST STEP**:
1. Go to https://discord.com/developers/applications/1440057375527665674/bot
2. Scroll to **Privileged Gateway Intents**
3. Enable **MESSAGE CONTENT INTENT** ✅
4. Save Changes

## 2. Invite Bot to Server

Click this link:
```
https://discord.com/oauth2/authorize?client_id=1440057375527665674&permissions=68608&scope=bot
```

## 3. Get #global-ai Channel ID

1. Discord Settings → Advanced → Enable Developer Mode
2. Right-click `#global-ai` → Copy Channel ID
3. Update `.env`:

```bash
# Change this line:
GLOBAL_MARKETS_CHANNELS=1339709679537750036

# To this (add your channel ID):
GLOBAL_MARKETS_CHANNELS=1339709679537750036,<YOUR_GLOBAL_AI_CHANNEL_ID>
```

## 4. Start Atlas

```bash
npm run atlas:dev
```

Look for:
```
🌏 Atlas bot logged in as Atlas#XXXX
📡 Monitoring 2 channels
✅ Atlas bot is online and monitoring channels
```

## 5. Test It

Go to `#crypto-alerts` or `#global-ai` and type:

```
btc thoughts?
```

or

```
@Atlas what's the market sentiment?
```

You should see Atlas respond with sharp, concise market analysis!

## Common Commands

```bash
# Development (auto-restart)
npm run atlas:dev

# Production
npm run atlas

# Run both bots simultaneously
# Terminal 1:
npm run dev

# Terminal 2:
npm run atlas:dev
```

## Troubleshooting

**Not responding?**
- Check MESSAGE CONTENT INTENT is enabled
- Verify bot is in the server
- Try explicit mention: `@Atlas test`

**Tool errors?**
- Check internet connection
- CoinGecko/ExchangeRate APIs might be rate-limited

## Next Steps

- ✅ Customize personality in `src/atlas/atlasBot.ts`
- ✅ Add more tools in `src/atlas/atlasTools.ts`
- ✅ Deploy with PM2 for production

Full docs: `ATLAS_BOT_SETUP.md`
