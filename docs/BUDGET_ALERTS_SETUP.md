# 💰 Budget Alerts & Daily Updates

## Overview

The Financial Advisor bot now includes automatic budget tracking with:
- ✅ **Daily budget updates** at 9 AM PST
- ✅ **Automatic alerts** when you hit spending thresholds
- ✅ **Visual progress bars** showing budget usage
- ✅ **Spending projections** for the week
- ✅ **Category breakdowns** of where money is going

---

## 🔔 Alert System

### Automatic Threshold Alerts

You'll receive automatic alerts when you hit these thresholds of your weekly budget:

1. **50% Used** 💡 - Halfway through your budget
2. **75% Used** ⚠️ - Approaching your limit
3. **90% Used** ⚠️ - Near budget limit (slow down!)
4. **100% Used** 🚨 - **BUDGET LIMIT REACHED!**

Each alert is sent **once per week** when the threshold is crossed.

### Daily Budget Updates

Every morning at **9:00 AM PST**, you'll receive a comprehensive update with:

📊 **Current Status:**
- How much you've spent this week
- How much budget remains
- Percentage of budget used
- Visual progress bar

📈 **Analysis:**
- Daily spending average
- Projected weekly spending
- Recommended daily spend to stay on budget
- Days remaining in the week

💳 **Top Categories:**
- Your top 5 spending categories for the week
- Amount spent in each

✅ **Recommendations:**
- Whether you're on track
- How much you can spend per day
- Warnings if you're trending over budget

---

## ⚙️ Configuration

### Set Your Weekly Budget

In `.env` file:

```bash
# Your weekly spending limit (default: $1000)
WEEKLY_BUDGET=1000

# Time for daily updates (cron format, default: 9 AM)
BUDGET_UPDATE_TIME=0 9 * * *
```

### Common Budget Update Times

```bash
# 9 AM daily (default)
BUDGET_UPDATE_TIME=0 9 * * *

# 8 AM daily
BUDGET_UPDATE_TIME=0 8 * * *

# 10 PM daily (evening summary)
BUDGET_UPDATE_TIME=0 22 * * *

# 9 AM and 8 PM (two updates daily)
# Note: Set up two separate cron jobs for this
```

---

## 📊 Example Daily Update

```
✅ Weekly Budget Update - Day 3 of 7

📊 This Week's Spending:
Budget: $1,000.00
Spent: $487.50 (48.8%)
Remaining: $512.50

📈 Progress Bar:
[🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢░░░░░░░░░░] 48.8%

📅 Spending Analysis:
Daily average: $162.50/day
Projected weekly: $1,137.50
Budget/day remaining: $128.13/day

⚠️ On Track to Exceed Budget
At current rate, you'll be $137.50 over budget by week's end.
💡 Reduce spending to $128.13/day to stay on track.

💳 Top Categories:
  • Food: $243.00
  • Transportation: $112.50
  • Shopping: $87.00
  • Entertainment: $45.00
```

---

## 🚨 Example Alert Messages

### 50% Alert
```
💡 Budget update

You've used 50% of your weekly budget
Spent: $500.00 of $1,000.00
Remaining: $500.00

Day 3 of 7 (43% through the week)
```

### 90% Alert
```
⚠️ Warning: Near budget limit

You've used 90% of your weekly budget
Spent: $900.00 of $1,000.00
Remaining: $100.00

Day 5 of 7 (71% through the week)

💡 Tip: You have limited budget left. Prioritize essential purchases only.
```

### 100% Alert
```
🚨 BUDGET LIMIT REACHED!

You've used 100% of your weekly budget
Spent: $1,000.00 of $1,000.00
Remaining: $0.00

Day 6 of 7 (86% through the week)

🚫 You are over budget! Consider reducing spending for the rest of the week.
```

---

## 💬 Manual Budget Check

Ask mr krabs anytime:

```
@mr krabs check my budget
@mr krabs how much have I spent this week?
@mr krabs am I over budget?
@mr krabs weekly budget status
```

---

## 🔧 Advanced Configuration

### Change Your Budget Mid-Week

In Discord:
```
@mr krabs set my weekly budget to $1500
```

Or update `.env` and restart the bot.

### Disable Alerts Temporarily

Set in `.env`:
```bash
# Disable budget alerts
WEEKLY_BUDGET=0
```

Or set a very high budget:
```bash
# Effectively disable alerts
WEEKLY_BUDGET=999999
```

### Different Budgets for Different Weeks

Currently not supported, but you can:
1. Update `.env` with new budget
2. Restart the bot
3. Budget tracking continues with new amount

---

## 📅 How Budget Weeks Work

- **Week starts:** Monday at 12:00 AM
- **Week ends:** Sunday at 11:59 PM
- **Alerts reset:** Monday morning automatically
- **Daily updates:** Every day at configured time
- **Real-time tracking:** Budget checked after every transaction sync

---

## 🎯 Setting the Right Budget

### Recommended Approach

Based on your financial analysis:

**Your actual baseline spending:** $4,725/month
- Food: $1,304/month = ~$301/week
- Tech: $551/month = ~$127/week
- Phone: $157/month = ~$36/week
- Transportation: $113/month = ~$26/week
- Shopping: $209/month = ~$48/week
- Other: $2,390/month = ~$551/week

**Total baseline:** ~$1,089/week

### Budget Recommendations

**Conservative (with partner):**
```bash
# If sharing expenses 50/50
WEEKLY_BUDGET=545  # Half of $1,089
```

**Individual (your spending only):**
```bash
# Your personal discretionary spending
WEEKLY_BUDGET=750  # Food + entertainment + misc
```

**Household (both partners combined):**
```bash
# Full household spending
WEEKLY_BUDGET=2000  # $1,089 baseline + buffer
```

**Aggressive Savings Mode:**
```bash
# Cut discretionary by 30%
WEEKLY_BUDGET=762  # $1,089 - 30%
```

---

## 🐛 Troubleshooting

### Not Receiving Daily Updates

1. Check bot is running: `ps aux | grep advisor`
2. Check time zone in `.env`
3. Check Discord channel ID is correct
4. Check bot has permission to send messages

### Alerts Not Firing

1. Verify `WEEKLY_BUDGET` is set in `.env`
2. Check transactions are syncing (run `npm run sync:all`)
3. Verify spending has actually crossed thresholds
4. Check logs for errors

### Budget Seems Wrong

1. Verify week calculation (Monday-Sunday)
2. Check that transfers/payments are being excluded
3. Run manual check: `@mr krabs check my budget`
4. Check database has recent transactions

---

## 📊 Technical Details

### What Counts as "Spending"

✅ **Included:**
- Credit card purchases
- Debit card transactions
- ATM withdrawals
- Bill payments (utilities, subscriptions)
- Cash transactions (if tracked)

❌ **Excluded:**
- Credit card payments (to avoid double-counting)
- Transfers between your own accounts
- Loan payments
- Investment deposits
- Refunds/credits

### Week Calculation

- Week starts: Monday 12:00 AM PST
- Week ends: Sunday 11:59 PM PST
- Day 1 = Monday, Day 7 = Sunday
- Alerts reset automatically on Monday

---

## 🎉 What's Next

Potential future enhancements:
- Monthly budget tracking
- Category-specific budgets (e.g., $300/week food limit)
- Budget rollover (unused budget carries to next week)
- Budget recommendations based on income
- Spending trends and forecasts
- Budget vs actual charts

---

**Your budget tracking is now LIVE!** 

Set your `WEEKLY_BUDGET` in `.env` and restart the bot to start receiving daily updates and alerts! 💰📊

