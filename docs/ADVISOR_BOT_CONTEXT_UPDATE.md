# Financial Advisor Bot - Context Update

## What Was Added

The Discord Financial Advisor bot (`mr krabs`) now has comprehensive context about your financial situation built into its system prompt.

## Context Included

### ✅ Account Structure
- Knows about all 5 connected accounts (4 AmEx cards + Truist checking)
- Understands which accounts are used for what

### ✅ Credit Card Refinancing Loan
- **Knows about the $20k loan from October 16, 2025**
- **Will NOT count it as income** when doing calculations
- Understands the $2,000/month payment obligation
- Knows interest charges will decrease post-refinance

### ✅ Income Reality
- Understands your income is ~$9k/month (not $15k)
- Knows it comes from multiple sources (paychecks, freelance, etc.)
- **Knows income varies month-to-month**
- Won't assume steady income

### ✅ Fixed Expenses
- Rent: $1,300/month
- Loan payment: $2,000/month
- Total: $3,300/month fixed

### ✅ Budget System
- Groceries: $200/week
- Dining: $100/week
- Other: $170/week
- Work expenses tracked separately

### ✅ Spending Patterns
- Knows you're over budget on dining
- Understands camera equipment might be one-time purchases
- Knows work tech expenses should be tax-deductible
- Understands Robinhood contributions ($3k total, not monthly)

### ✅ Critical Accounting Rules
- **Credit cards:** Purchases = positive amounts, Payments = negative amounts
- **Checking:** Spending = negative amounts, Income = positive amounts
- Knows to exclude transfers and payments from spending analysis

## What This Means

When you ask the bot questions in Discord, it will:

1. **✅ Correctly calculate income** (excluding the $20k loan)
2. **✅ Account for income variability** (won't assume steady $9k)
3. **✅ Understand your budget goals** ($470/week discretionary)
4. **✅ Know your fixed obligations** (rent + loan = $3,300)
5. **✅ Give contextual advice** based on your full situation
6. **✅ Identify work expenses** for tax purposes
7. **✅ Understand spending patterns** (dining over budget, etc.)

## Examples

### Before (No Context):
```
You: "How's my cash flow?"
Bot: "You have $5,000/month surplus!" ❌ (counted loan as income)
```

### After (With Context):
```
You: "How's my cash flow?"
Bot: "Based on your ~$9k monthly income and $3,300 fixed costs + ~$6,458 lifestyle spending, you're roughly breaking even or slightly negative depending on the month. Your income varies, so it's important to track closely." ✅
```

### Before:
```
You: "Can I afford this $500 purchase?"
Bot: "Sure, you're saving $5k/month!" ❌
```

### After:
```
You: "Can I afford this $500 purchase?"
Bot: "Your cash flow is tight - you're roughly breaking even each month. That $500 would put you $500 in the red this month. Consider waiting or cutting other spending (your dining is $788 over budget already). Every penny counts!" ✅
```

## The Bot Now Understands

### Your Story
- You refinanced $20k in CC debt in October 2025
- You're making $2k/month payments on that loan
- Your income is variable, around $9k/month
- You're trying to stick to a $470/week discretionary budget
- Your biggest challenge is dining spending ($1,221/mo vs $433 budget)

### Your Challenges
- Dining spending way over budget (+$788/mo)
- "Other" category too high and needs better categorization
- Income variability makes planning difficult
- Interest charges were high (before refi)

### Your Opportunities
- Work expenses should be tax-deductible (~$689/mo)
- Camera spending might be temporary
- Could save money by cooking more vs dining out

## How to Use

The bot will now give you much better advice because it understands:
- Your real income level
- Your loan situation
- Your budget goals
- Your spending patterns
- What expenses are work-related

Just ask questions naturally in Discord and it'll have the full context!

## Example Questions You Can Ask

```
"How much am I really making per month?"
→ Bot knows to exclude the $20k loan

"Am I over budget this week?"
→ Bot knows your $470/week targets

"Can I afford to eat out tonight?"
→ Bot knows you're already $788/mo over on dining

"What expenses can I deduct on taxes?"
→ Bot knows your tech/work expenses (~$689/mo)

"Why does my spending look so high?"
→ Bot can explain camera equipment is skewing averages

"How's my cash flow?"
→ Bot gives realistic answer based on $9k income, not $15k
```

## Files Created

1. **`docs/USER_FINANCIAL_CONTEXT.md`**
   - Complete reference document with all financial context
   - Includes account structure, loan details, income sources, spending patterns
   - Can be updated as situation changes

2. **Updated:** `src/advisor/advisorBot.ts`
   - System prompt now includes financial context
   - Bot has this context in every conversation

## Updating the Context

If your situation changes (income changes, loan paid off, etc.), update:
1. `docs/USER_FINANCIAL_CONTEXT.md` (for reference)
2. `src/advisor/advisorBot.ts` system prompt (for bot's knowledge)
3. Restart the bot: `pkill -f "src/advisor" && npm run advisor:dev`

---

**Your Discord bot is now a much smarter financial advisor!** 🧠💰

