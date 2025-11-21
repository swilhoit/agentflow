# User Financial Context

## Account Structure

### Connected Accounts (via Teller API)

#### American Express Credit Cards (Token: token_77lfbjzhhtidtosa4rctadmclq)
1. **Blue Business Cash™**
   - Account ID: acc_pl6rkdkjovf8smf3je000
   - Type: Business Credit Card
   - Used for: Business expenses, some personal purchases

2. **Blue Business Plus Card**
   - Account ID: acc_pl6rkdkmovf8smf3jg000
   - Type: Business Credit Card
   - Used for: Business expenses, tech subscriptions, software

3. **Delta SkyMiles® Platinum Card**
   - Account ID: acc_pl6rkdkoovf8smf3ji000
   - Type: Personal Credit Card
   - Used for: Travel, dining, groceries (Apple Pay transactions)

4. **Hilton Honors Card**
   - Account ID: acc_pl6rkdkqovf8smf3jk000
   - Type: Personal Credit Card
   - Used for: Travel, hotels

#### Truist Bank (Token: token_hgpcghj7v7vaivxwoinyyggbza)
5. **Checking Account (****4536)**
   - Account ID: acc_pl814nv2ovf2cmrdje000
   - Type: Checking
   - Used for: Primary checking, deposits, bill payments

---

## Credit Card Accounting Note

**IMPORTANT:** Credit card transactions work differently than checking account transactions:

- **Credit Cards:** Purchases are **POSITIVE amounts** (they increase your balance owed)
- **Credit Cards:** Payments are **NEGATIVE amounts** (they decrease your balance)
- **Checking:** Purchases are **NEGATIVE amounts** (they decrease your balance)
- **Checking:** Deposits are **POSITIVE amounts** (they increase your balance)

When analyzing spending:
- Look at **positive amounts** on credit cards for actual purchases
- Exclude negative amounts on credit cards (those are payments, not spending)
- Look at **negative amounts** on checking for direct spending/bills
- Exclude checking transactions that are payments to credit cards

---

## Credit Card Refinancing Loan (October 2025)

### Background
User had accumulated credit card debt across multiple cards and was paying high interest rates.

### The Refinance
- **Date:** October 16, 2025
- **Amount:** $20,000.07
- **Transaction:** WIRE REF# 20251016-00010335 (visible in Truist Checking)
- **Purpose:** Consolidate and pay off credit card balances
- **New Loan Terms:** $2,000/month payment

### Important Notes
1. **The $20k deposit is NOT income** - it's a loan that must be excluded from income calculations
2. **Credit card interest charges before Oct 16** were from the old balances - these should decrease significantly after refinance
3. **Monthly loan payment:** $2,000 (part of fixed expenses)
4. **Interest charges after Oct 16** should be minimal or zero on the cards that were paid off

### Transaction IDs to Exclude from Income
When calculating income, always exclude:
- Any transaction matching ~$20,000 from checking account around Oct 16, 2025
- This was a loan disbursement, not earned income

---

## Income Sources

### Primary Income: ~$9,000/month (variable)

1. **Truist Deposits (****4601)** - ~$7,128/month (79%)
   - Description pattern: "ONLINE FROM ****4601 - TRUIST ON"
   - Likely: Paycheck deposits or transfers
   - Frequency: Semi-monthly (varies)
   - Variable amounts

2. **Intercept Sales Inc** - ~$1,134/month (13%)
   - Description pattern: "Intercept Sales Inc PAYMENT ID"
   - Type: Business/freelance income
   - Frequency: Irregular
   - Variable amounts

3. **Crypto/Transfers** - ~$667/month (7%)
   - Tetrahedron, Polygon transfers
   - Type: Investment/transfer income
   - Frequency: Occasional
   - Variable amounts

4. **Music Royalties** - ~$53/month (1%)
   - ASCAP royalties
   - DistroKid payments
   - Type: Passive income
   - Very small amounts

**Important:** Income varies month-to-month. Don't assume steady $9k - it fluctuates.

---

## Fixed Monthly Expenses

### Rent: $1,300/month
- Merchant: "Statewide/Enterprise" or "Statewide Enterp"
- Payment method: Online from checking account
- Description pattern: "WEB PMTS Statewide Enterp"
- Due: Around the 5th-6th of each month
- **Note:** User stated rent is $1,300, but database might show missed payments or variations

### Loan Payment: $2,000/month
- Started: October 2025
- Purpose: Credit card refinancing
- Type: Fixed payment
- Goes to: AMEX (to pay down the loan)
- Description pattern: "ACH PMT AMEX EPAYMENT"

### Phone/Utilities
- Various small recurring payments
- AT&T, utilities, etc.
- Variable amounts

**Total Fixed Expenses: ~$3,300/month**

---

## Spending Categories & Patterns

### Groceries (~$916/month)
- **Primary:** Whole Foods (AplPay WHOLEFDS, WHOLEFDS GLN)
- **Also:** Lassens Natural, Yucca Market, Sprouts
- **Budget:** $200/week ($866/month)
- **Reality:** Slightly over budget (+$50/mo)

### Dining Out (~$1,221/month)
- **Merchants:** TST* locations, Little Doms, Mun Korean, Shadowbrook, etc.
- **Includes:** Restaurants, bars, cafes, delivery services
- **Budget:** $100/week ($433/month)
- **Reality:** Significantly over budget (+$788/mo) 🚨

### Transportation (~$200/month)
- **Primary:** Uber, Lyft, Waymo (BT*WAYMO)
- **Pattern:** Frequent rides around LA
- **Budget:** Part of "Other" ($170/week)

### Tech/Work Expenses (~$689/month)
- **Software:** Claude.AI ($200/mo), Cursor ($50-80/mo), Perplexity, ElevenLabs
- **Cloud:** Vercel, Apollo.io
- **Purpose:** Work-related subscriptions
- **Budget:** Tracked separately (not in discretionary budget)
- **Tax Note:** Should be deductible if self-employed

### Travel (Variable, ~$711/month in past 90 days)
- **Airlines:** Delta Air Lines
- **Hotels:** Airbnb, Hilton
- **Note:** This is occasional, not monthly recurring
- **Impact:** Skews spending averages

### Camera/Photography Equipment (Variable)
- **Merchant:** OC CAMERAS
- **Past 90 days:** ~$751/month
- **Note:** Likely one-time or project-based purchases, not recurring monthly
- **Impact:** Significantly inflating "Other" category

### Shopping (~$82/month)
- Amazon, retail stores
- Relatively low spending category

---

## Budget System (November 2025)

### Weekly Budgets (Set in Discord Bot)
- 🛒 **Groceries:** $200/week
- 🍽️ **Dining Out:** $100/week
- 💵 **Other:** $170/week
- 💻 **Work/Tech:** Tracked separately

**Total Discretionary Budget:** $470/week ($2,035/month)

### Bot Alert Thresholds
- 75% of budget → Warning
- 90% of budget → Near limit
- 100% of budget → Exceeded

### Daily Updates
- Time: 9:00 AM PST
- Shows: Progress in each category
- Includes: Remaining budget per day

---

## Financial Analysis Notes

### Current Situation (as of Nov 2025)
- **Monthly Income:** ~$9,000 (variable)
- **Fixed Expenses:** $3,300 (rent + loan)
- **Lifestyle Spending:** ~$6,458 (past 90-day average)
- **Net Cash Flow:** Approximately -$370 to +$100 (varies monthly)

### Key Challenges
1. **Income variability:** Not consistent $9k every month
2. **Spending over budget:** Currently spending 2-3x the set budgets
3. **"Other" category:** $3,350/mo is too high and poorly categorized
   - Includes camera equipment (possibly one-time)
   - Includes historical CC interest (should decrease post-refi)
   - Needs better categorization

### Things to Improve
1. **Budget adherence:** Need to cut dining and "other" spending
2. **Income tracking:** Account for month-to-month variability
3. **Category clarity:** Better categorize "Other" spending
4. **Tax prep:** Track work expenses for deductions

---

## Important Transaction Patterns to Recognize

### Exclude from "Real Spending"
- **Payments to credit cards:** "ONLINE PAYMENT", "ACH PMT AMEX", "AUTOPAY PAYMENT"
- **Transfers:** "TRANSFER", "INST XFER" (between own accounts)
- **Investment contributions:** "ROBINHOOD", "DEBITS ROBINHOOD"
- **The $20k loan deposit:** WIRE REF# 20251016-00010335
- **Credit card credits:** "CREDIT" (unless it's "UBER ONE CREDIT" which offsets a charge)

### Include as Income
- "ONLINE FROM ****4601" (paychecks)
- "Intercept Sales Inc"
- "ASCAP", "DistroKid" (royalties)
- Legitimate business/freelance payments

### Work Expenses (Tax Deductible)
- Cursor, Claude.AI, Anthropic subscriptions
- Vercel, Apollo.io, Perplexity
- Any "software", "SaaS", "dev tools"
- Phone bills (if partially business use)

---

## Robinhood Investment Note

User has invested **$3,000 TOTAL** into Robinhood (not monthly, cumulative).

Transactions like "DEBITS ROBINHOOD" are transfers TO investment account, not spending on lifestyle.

Exclude these from spending calculations.

---

## Context for AI Financial Advisor

When answering user questions:

1. **Never count the $20k loan as income**
2. **Remember income varies month to month** - don't assume steady amounts
3. **Credit card purchases are positive amounts** - don't confuse with checking
4. **Exclude payments/transfers from spending analysis**
5. **Camera spending might be one-time** - check dates before saying it's $751/mo recurring
6. **Interest charges will decrease** - historical data includes pre-refinance interest
7. **User is trying to stick to $470/week budget** - support this goal
8. **Work expenses should be tracked for taxes** - remind about deductions

---

## Questions to Ask User (If Relevant)

1. Are the camera purchases ($751/mo) still happening, or were those one-time?
2. What's the actual loan interest rate and payment timeline?
3. Is income from Truist the same every month, or does it vary?
4. Are work tech expenses eligible for reimbursement?
5. Is travel for work (deductible) or personal?

---

## Last Updated
November 21, 2025

This context should be referenced when:
- Calculating income (exclude the loan!)
- Analyzing spending patterns
- Giving budget advice
- Answering questions about accounts
- Explaining cash flow

