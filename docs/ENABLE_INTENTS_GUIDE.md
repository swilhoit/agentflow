# How to Enable MESSAGE_CONTENT Intent

## Step-by-Step Instructions

### For Financial Advisor Bot

1. **Go to this URL** (I've already opened it for you):
   ```
   https://discord.com/developers/applications/1440082655449321582/bot
   ```

2. **Scroll down** until you see a section called **"Privileged Gateway Intents"**

3. You'll see three toggle switches:
   - PRESENCE INTENT
   - SERVER MEMBERS INTENT
   - **MESSAGE CONTENT INTENT** ← This is the one you need!

4. **Toggle ON** the switch next to "MESSAGE CONTENT INTENT"
   - It will turn blue when enabled

5. **Click "Save Changes"** at the bottom of the page

6. **Done!** The bot will automatically restart and connect.

---

### For Atlas Bot

1. **Go to this URL** (I've already opened it for you):
   ```
   https://discord.com/developers/applications/1440057375527665674/bot
   ```

2. **Scroll down** to **"Privileged Gateway Intents"**

3. **Toggle ON** the "MESSAGE CONTENT INTENT" switch

4. **Click "Save Changes"**

5. **Done!**

---

## Visual Guide

When you're on the bot settings page, you're looking for this section:

```
┌─────────────────────────────────────────┐
│ Privileged Gateway Intents              │
├─────────────────────────────────────────┤
│                                         │
│ ○ PRESENCE INTENT                       │
│   [OFF]                                 │
│                                         │
│ ○ SERVER MEMBERS INTENT                 │
│   [OFF]                                 │
│                                         │
│ ● MESSAGE CONTENT INTENT  ← Enable this!│
│   [OFF] ← Click to turn ON              │
│                                         │
└─────────────────────────────────────────┘

          [Save Changes]  ← Click this!
```

After you toggle it ON, it should look like:

```
│ ● MESSAGE CONTENT INTENT                │
│   [ON] ← Blue/Green = Enabled           │
```

---

## After Enabling

Once you've enabled MESSAGE_CONTENT intent for **both bots**:

1. Wait 10-20 seconds for the bots to restart
2. Run this command to check status:
   ```bash
   ./verify-bots.sh
   ```

You should see:
```
✅ Atlas is ONLINE!
✅ Financial Advisor is ONLINE!
```

---

## Troubleshooting

**If you don't see "Privileged Gateway Intents":**
- Make sure you're on the "Bot" page (left sidebar)
- Scroll down - it's usually near the bottom

**If the toggle won't turn on:**
- Make sure you're logged into the correct Discord account
- Refresh the page and try again

**If the bot still doesn't connect after enabling:**
- Wait 30 seconds, then run `./verify-bots.sh`
- If still not working, force restart:
  ```bash
  gcloud run services update agentflow-advisor --region us-central1 --timeout=3600
  gcloud run services update agentflow-atlas --region us-central1 --timeout=3600
  ```

---

## Quick Links

**Financial Advisor Bot Settings:**
https://discord.com/developers/applications/1440082655449321582/bot

**Atlas Bot Settings:**
https://discord.com/developers/applications/1440057375527665674/bot

**After enabling, verify:**
```bash
./verify-bots.sh
```
