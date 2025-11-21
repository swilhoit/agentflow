# 💰 Discretionary Budget Tracking

## Overview

Your budget alerts now track **discretionary/lifestyle spending only** - the stuff that "gets out of hand":

✅ **Tracked Against Budget:**
- 🍽️ Food & Dining (restaurants, groceries, bars)
- 🍺 Entertainment (bars, events, shows)
- 🚗 Transportation (Uber, Lyft, Waymo, parking, gas)
- 🛍️ Shopping (retail, clothing, Amazon)
- ✈️ Travel (hotels, Airbnb, flights)
- 🏋️ Fitness (gym, sports)
- 💵 General/Uncategorized purchases

❌ **NOT Tracked (Work-Related):**
- 💻 Tech & Software subscriptions (Claude, Cursor, Figma, etc.)
- 📱 Phone bills
- 🏢 Office expenses
- 🌐 Internet/utilities

Work expenses are shown separately in daily updates but don't count against your budget.

---

## 📊 Your Real Spending Pattern

Based on your analysis, here's your actual discretionary spending:

### Monthly Breakdown
- **Food/Dining:** $1,304/month = **$301/week**
  - Groceries: $915/month
  - Dining out: $389/month ($73/meal average)
- **Transportation:** $113/month = **$26/week**
  - Uber/Waymo/Lyft
- **Shopping:** $209/month = **$48/week**
  - Amazon, retail
- **Other Discretionary:** ~$400/month = **$92/week**

**Total Discretionary:** ~$467/week

### Work Expenses (Tracked Separately)
- **Tech/Software:** $551/month = **$127/week**
  - Claude AI: $213/month
  - Cursor: $121/month
  - Google Cloud: $71/month
  - Figma, etc.: $146/month
- **Phone:** $157/month = **$36/week**

---

## 🎯 Recommended Budget Settings

Based on YOUR actual spending:

### Option 1: Match Current Spending (Maintenance Mode)
```bash
WEEKLY_BUDGET=470
```
This covers your baseline discretionary spending with no cuts.

### Option 2: Moderate Savings (10% cut)
```bash
WEEKLY_BUDGET=420
```
Cut discretionary by $50/week = $200/month savings.

### Option 3: Aggressive Savings (20% cut)
```bash
WEEKLY_BUDGET=375
```
Cut discretionary by $95/week = $380/month savings.

### Option 4: Extreme Savings (30% cut)
```bash
WEEKLY_BUDGET=330
```
Cut discretionary by $140/week = $560/month savings.

---

## 💡 Where to Cut

To stay under budget, here's where the money goes:

### Food ($301/week) - Biggest Category
**Easy Cuts:**
- Reduce dining out from $73/meal → $40/meal (saves $33/meal)
- Cook at home 2 more nights/week (saves $150/week)
- Meal prep on Sundays (saves $100/week)
- Skip expensive restaurants, go casual (saves $30/meal)

**Moderate:** Cut to $200/week (saves $101/week)  
**Aggressive:** Cut to $150/week (saves $151/week)

### Transportation ($26/week)
**Easy Cuts:**
- Combine Uber trips (saves $10/week)
- Walk short distances (saves $5/week)
- Use public transit when possible (saves $15/week)

**Moderate:** Cut to $15/week (saves $11/week)  
**Aggressive:** Cut to $10/week (saves $16/week)

### Shopping ($48/week)
**Easy Cuts:**
- Wait 24 hours before impulse purchases (saves $20/week)
- Use what you have first (saves $10/week)
- Buy used/refurbished (saves $10/week)

**Moderate:** Cut to $30/week (saves $18/week)  
**Aggressive:** Cut to $15/week (saves $33/week)

---

## 📅 Example Daily Update (New Format)

```
✅ Weekly Discretionary Budget Update - Day 3 of 7

💰 Lifestyle Spending (Food, Bars, Ubers, etc.):
Budget: $420.00
Spent: $187.50 (44.6%)
Remaining: $232.50

📈 Progress Bar:
[🟢🟢🟢🟢🟢🟢🟢🟢🟢░░░░░░░░░░░] 44.6%

📅 Spending Analysis:
Daily average: $62.50/day
Projected weekly: $437.50
Budget/day remaining: $58.13/day

⚠️ On Track to Exceed Budget
At current rate, you'll be $17.50 over budget by week's end.
💡 Reduce spending to $58.13/day to stay on track.

🍽️ Top Discretionary Categories:
  • Food: $112.50
  • Transportation: $45.00
  • Shopping: $30.00

💼 Work-Related Expenses (Not counted in budget):
Tech/Software/Phone: $127.00
  • Cursor: $40.33
  • Claude AI: $70.90
  • Phone: $15.77
```

---

## 🎯 Recommended Budget: $420/week

This gives you:
- **Food:** $250/week (cut from $301 - cook more, cheaper restaurants)
- **Transportation:** $20/week (combine trips, walk more)
- **Shopping:** $30/week (reduce impulse buys)
- **Other:** $120/week (entertainment, misc)

**Total savings:** $200/month compared to current baseline!

---

## 🚨 What Triggers Alerts

Alerts fire when your **discretionary spending** crosses these thresholds:

- **50%** of budget (e.g., $210 if budget is $420) 💡
- **75%** of budget (e.g., $315 if budget is $420) ⚠️
- **90%** of budget (e.g., $378 if budget is $420) ⚠️
- **100%** of budget (e.g., $420 if budget is $420) 🚨

Tech spending doesn't trigger these alerts - it's shown separately.

---

## 📊 Track Work Expenses

While work expenses don't count against your budget, you'll see:
- Total tech/software/phone spending for the week
- Top work-related expenses
- Trends over time

This helps you:
- Track business deductions
- Identify unused subscriptions
- Plan for annual renewals

---

## 💬 Commands

```
@mr krabs check my budget
@mr krabs how much discretionary spending this week?
@mr krabs what's my work spending?
@mr krabs set my weekly budget to $420
```

---

## ⚙️ Update Your Budget

Edit `/Volumes/LaCie/WEBDEV/agentflow/.env`:

```bash
# Recommended: $420/week discretionary budget
WEEKLY_BUDGET=420
```

Then restart:
```bash
npm run advisor:start
```

---

## 🎉 What This Solves

**Before:** $1,089/week budget mixed work and lifestyle spending  
**After:** $420/week focused on controllable discretionary spending

**Benefits:**
- ✅ Focus on spending that actually varies (food, entertainment, shopping)
- ✅ Don't get alerted for necessary work expenses
- ✅ Clear picture of where money "gets out of hand"
- ✅ Separate tracking for tax-deductible work expenses

**Your discretionary budget is now laser-focused on the spending you can actually control!** 🎯

