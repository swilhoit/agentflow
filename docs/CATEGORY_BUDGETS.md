# 🎯 Category Budget System

## Overview

Your Financial Advisor bot now tracks **three separate weekly budgets** instead of one combined budget. Each category has its own spending limit, alerts, and tracking:

### 🛒 Groceries: $200/week
- Whole Foods, Sprouts, Lassens, Target, Trader Joe's, etc.
- Essential food shopping
- Counts toward weekly budget

### 🍽️ Dining Out: $100/week
- Restaurants, bars, cafes, delivery
- DoorDash, Uber Eats, Grubhub, Postmates
- Coffee shops, fast food, takeout
- **This is where spending gets out of hand!**

### 💵 Other Spending: $170/week
- Shopping (Amazon, retail stores)
- Transportation (Uber, Lyft, Waymo)
- Entertainment
- Miscellaneous purchases

### 💼 Work Expenses (Tracked Separately)
Not counted against your budget:
- Software subscriptions
- Tech purchases
- Phone bills
- Office supplies

**Total Weekly Budget: $470**

---

## 🔔 How Alerts Work

You'll get automatic notifications at these thresholds **for each category**:

| Threshold | Alert Type | When You'll Get It |
|-----------|------------|-------------------|
| **75%** | ⚠️ Warning | "Approaching limit" |
| **90%** | ⚠️ Near Limit | "Warning: Near limit" |
| **100%** | 🚨 Budget Exceeded | "BUDGET LIMIT REACHED!" |

### Example Alerts

```
🛒 ⚠️ Groceries: Approaching limit
You've used 75% of your groceries budget
Spent: $150.00 of $200.00
Remaining: $50.00
```

```
🍽️ 🚨 Dining Out: BUDGET LIMIT REACHED!
You've used 100% of your dining out budget
Spent: $100.00 of $100.00
Remaining: $0.00
🚫 Over budget! Try to reduce spending in this category.
```

---

## 📊 Daily Updates (9 AM PST)

Every morning at 9 AM, you'll get a comprehensive update showing:

### 1. Overall Progress
- Total budget: $470/week
- Total spent across all categories
- Days into week (e.g., Day 4 of 7)

### 2. Each Category's Status
Visual progress bars like:
```
🛒 GROCERIES:
[🟢🟢🟢🟢🟢🟢░░░░░░░░░] 40% ($80/$200)
✅ $120.00 left
```

```
🍽️ DINING OUT (Restaurants, Bars, Delivery):
[🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡░] 93% ($93/$100)
⚠️ $7.00 left
```

```
💵 OTHER (Shopping, Uber, Entertainment):
[🟢🟢🟢🟢🟢░░░░░░░░░░] 33% ($56/$170)
✅ $114.00 left
```

### 3. Work Expenses (If Any)
```
💼 WORK EXPENSES (Not in budget):
Tech/Software/Phone: $45.00
```

### 4. Daily Budget Recommendations
Based on remaining days:
```
💡 Budget per day remaining:
  🛒 Groceries: $30.00/day
  🍽️ Dining: $1.75/day (⚠️ almost out!)
  💵 Other: $28.50/day
```

---

## 🎨 Visual Indicators

Progress bars change color based on usage:
- 🟢 **Green** (0-74%): On track
- 🟡 **Yellow** (75-99%): Approaching limit
- 🔴 **Red** (100%+): Over budget

---

## ⚙️ Configuration

Your budgets are stored in `.env`:

```bash
GROCERIES_BUDGET=200
DINING_BUDGET=100
OTHER_BUDGET=170
BUDGET_UPDATE_TIME=0 9 * * *  # 9 AM daily
```

### To Adjust Budgets

1. **Stop the bot:**
   ```bash
   pkill -f "src/advisor"
   ```

2. **Edit `.env`:**
   ```bash
   nano .env
   ```
   
   Change the values:
   ```
   GROCERIES_BUDGET=250    # Increase groceries to $250/week
   DINING_BUDGET=80        # Decrease dining to $80/week
   OTHER_BUDGET=140        # Decrease other to $140/week
   ```

3. **Restart the bot:**
   ```bash
   npm run advisor:dev > logs/advisor.log 2>&1 &
   ```

### To Change Update Time

Edit `BUDGET_UPDATE_TIME` in `.env` using cron syntax:
```bash
BUDGET_UPDATE_TIME=0 21 * * *  # 9 PM daily
BUDGET_UPDATE_TIME=0 9,21 * * *  # 9 AM and 9 PM daily
BUDGET_UPDATE_TIME=0 9 * * 1  # 9 AM every Monday
```

---

## 📈 How Transactions Are Categorized

The bot automatically categorizes your transactions:

### 🛒 Groceries
Detected by keywords/merchants:
- Whole Foods, Trader Joe's, Safeway, Target, Walmart
- Costco, Sprouts, Lassens, Ralphs, Vons
- H Mart, Albertsons
- Any merchant with "market", "grocery", "supermarket"

### 🍽️ Dining Out
Detected by keywords/merchants:
- Restaurant, cafe, coffee, bar, pub, tavern
- Kitchen, grill, bistro, deli, bakery
- DoorDash, Uber Eats, Grubhub, Postmates
- Fast food: McDonald's, Chipotle, Starbucks, etc.
- Pizza, burger, sushi, taco places

### 💵 Other
Everything else that's not groceries, dining, or work:
- Amazon, retail shopping
- Uber, Lyft, Waymo (transportation)
- Entertainment venues
- General purchases

### 💼 Work (Not Budgeted)
Detected by keywords:
- Software, SaaS, subscriptions
- Tech companies: Cursor, Claude, OpenAI, Vercel, Figma
- Phone bills (AT&T)
- Office supplies

---

## 🧪 Testing

Test your current week's status:
```bash
npx tsx scripts/test-category-budgets.ts
```

This will show:
- Current spending in each category
- Remaining budget
- Days into week
- Recommended daily spending

---

## 📱 Using in Discord

The bot is monitoring your configured channel. It will:
1. **Send daily updates** at 9 AM PST
2. **Send threshold alerts** when you hit 75%, 90%, or 100% in any category
3. **Track the full week** (Monday-Sunday)
4. **Reset alerts** every Monday

You don't need to do anything - just watch for the notifications!

---

## 💡 Tips

### Stay on Track
- **Groceries ($200/week)**: Plan meals, use shopping lists, avoid impulse buys
- **Dining Out ($100/week)**: ~$14/day, about 3-4 restaurant meals
- **Other ($170/week)**: Track your Uber rides, limit Amazon purchases

### If You Go Over Budget
- You'll get a 🚨 alert immediately
- Try to reduce spending in that category for the rest of the week
- Check your daily budget recommendations each morning

### Separate Work Spending
- Tech/software purchases are tracked but don't count against your budget
- This way, work expenses don't interfere with lifestyle spending tracking

---

## 🚀 What's Next?

Want to:
- **Change budget amounts?** Edit `.env` and restart the bot
- **Add more categories?** Let me know (e.g., separate "Transportation" from "Other")
- **Adjust alert thresholds?** I can modify the 75%/90%/100% levels
- **See detailed breakdowns?** Ask the bot "show my spending this week" in Discord

---

## 🎯 Your Budget at a Glance

| Category | Weekly Budget | Daily Average |
|----------|---------------|---------------|
| 🛒 Groceries | $200 | $28.57 |
| 🍽️ Dining Out | $100 | $14.29 |
| 💵 Other | $170 | $24.29 |
| **TOTAL** | **$470** | **$67.14** |

---

**Questions?** Just ask in Discord or ping me here! 💰

