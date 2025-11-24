# Weekly Budget Updates

Comprehensive weekly budget reports for both personal and business spending.

## Overview

The Weekly Budget Service provides detailed weekly summaries of your spending across:
- **Personal spending categories**: Groceries, Dining Out, Other (shopping, transport, entertainment)
- **Business expenses**: Software, subscriptions, office costs

## Features

### Weekly Summary Report
- **Personal budget tracking** with separate categories
- **Business expense tracking** with monthly budget
- **Week-over-week comparisons** to identify trends
- **Monthly projections** based on current spending pace
- **Visual progress bars** for easy budget monitoring
- **Actionable insights and recommendations**

### Report Contents

#### Personal Spending
- Total weekly budget vs. actual spending
- Breakdown by category (Groceries, Dining, Other)
- Progress bars for each category
- Comparison with previous week
- Remaining budget per category

#### Business Expenses
- Month-to-date business spending
- Monthly business budget tracking
- This week's business expenses
- Week-over-week business spending changes

#### Analytics
- Week-over-week spending trends
- Monthly spending projections
- Budget adherence status
- Personalized recommendations

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Personal Weekly Budgets
GROCERIES_BUDGET=200          # Weekly groceries budget
DINING_BUDGET=100             # Weekly dining/restaurant budget
OTHER_BUDGET=170              # Weekly other discretionary spending

# Business Budget
MONTHLY_BUSINESS_BUDGET=500   # Monthly business expenses budget

# Schedule (optional)
WEEKLY_BUDGET_UPDATE_TIME="0 20 * * 0"  # 8 PM every Sunday (default)
```

### Schedule Format

The schedule uses cron format:
- `"0 20 * * 0"` = 8 PM every Sunday (default)
- `"0 9 * * 1"` = 9 AM every Monday
- `"0 18 * * 5"` = 6 PM every Friday

Format: `minute hour day-of-month month day-of-week`

## Usage

### Automatic Weekly Reports

Once configured, reports are automatically sent to your Discord channel based on the schedule (default: Sunday at 8 PM).

### Manual Testing

Test the weekly budget report anytime:

```bash
npx ts-node scripts/test-weekly-budget.ts
```

### Integration

The service is automatically integrated with the mr krabs financial advisor bot. It runs alongside:
- **Daily budget updates** (9 AM daily) - Quick daily spending checks
- **Weekly summaries** (8 PM Sunday) - Comprehensive weekly reports
- **Transaction sync** (2 AM daily) - Automatic transaction updates

## Report Structure

### Header
- Overall status emoji (✅/💛/⚠️/🚨)
- Week date range

### Personal Spending Section
- Total budget and spending
- Overall progress bar
- Category breakdown with:
  - Budget vs. actual spending
  - Progress bars
  - Week-over-week comparison

### Business Expenses Section
- Monthly budget tracking
- Month-to-date spending
- This week's business expenses
- Progress toward monthly budget

### Week-over-Week Comparison
- Personal spending change
- Business spending change
- Trend arrows (↑/↓)

### Insights & Recommendations
- Budget status alerts
- Spending recommendations
- Monthly projections

## Category Classification

### Personal Categories

**Groceries:**
- Whole Foods, Trader Joe's, Safeway, Target, Walmart
- Costco, Sprouts, Lassens, H Mart
- Any "grocery" or "supermarket" transactions

**Dining Out:**
- Restaurants, bars, cafes, coffee shops
- Food delivery (DoorDash, Uber Eats, Grubhub)
- Fast food chains

**Other:**
- Shopping, retail, clothing
- Transportation (Uber, Lyft, parking, gas)
- Entertainment and general spending

### Business Categories

- Software subscriptions (Claude, OpenAI, Cursor, GitHub)
- Cloud services (Vercel, AWS, Google Cloud, Heroku)
- Office utilities (phone, internet)
- Business tools (Figma, Zoom, Slack, Notion)
- Domains and hosting

## Customization

### Adjusting Budgets

Edit your `.env` file and restart the service:

```bash
GROCERIES_BUDGET=250        # Increase grocery budget
DINING_BUDGET=150           # Increase dining budget
MONTHLY_BUSINESS_BUDGET=750 # Increase business budget
```

### Changing Schedule

To receive reports on a different day/time:

```bash
# Monday at 9 AM
WEEKLY_BUDGET_UPDATE_TIME="0 9 * * 1"

# Friday at 6 PM
WEEKLY_BUDGET_UPDATE_TIME="0 18 * * 5"
```

### Custom Categories

To customize which transactions are categorized as business vs. personal, edit:
`src/services/weeklyBudgetService.ts` line 97-119

## How It Works

1. **Data Collection**: Retrieves transactions from the database for the current and previous week
2. **Categorization**: Automatically categorizes transactions based on merchant names and categories
3. **Analysis**: Calculates spending totals, comparisons, and projections
4. **Reporting**: Formats and sends a comprehensive report to Discord

## Comparison with Daily Updates

| Feature | Daily Updates | Weekly Summary |
|---------|--------------|----------------|
| Frequency | Every day at 9 AM | Every Sunday at 8 PM |
| Scope | Current week progress | Full week + comparison |
| Detail | Quick status check | Comprehensive analysis |
| Business tracking | This week only | Month-to-date |
| Recommendations | Basic | Detailed with projections |

Both services complement each other:
- **Daily updates** keep you aware of your current budget status
- **Weekly summaries** provide comprehensive insights and trends

## Troubleshooting

### Report not sent

1. Check Discord bot is running
2. Verify `FINANCIAL_ADVISOR_CHANNELS` is configured
3. Check bot has permission to send messages
4. Review logs for errors

### Wrong spending amounts

1. Ensure transaction sync is running (`npm run advisor`)
2. Verify Teller API credentials are correct
3. Check transaction categorization in the database
4. Run `npx ts-node scripts/test-weekly-budget.ts` to see current data

### Business expenses not showing

1. Check if transactions contain business keywords
2. Review categorization logic in `weeklyBudgetService.ts`
3. Ensure `MONTHLY_BUSINESS_BUDGET` is set

## Next Steps

- Review your first weekly report
- Adjust budgets if needed
- Set up custom schedules
- Configure transaction categorization for your spending patterns
