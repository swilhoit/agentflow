# AgentFlow Dashboard - Key Features Summary

## 🎨 Theme & Design
- **Light Mode (Default)**: Clean white background with dark text
- **Dark Mode**: Optional terminal/CLI aesthetic
- **Toggle**: Moon/sun icon in header
- **Monospace Fonts**: JetBrains Mono throughout
- **No Shadows**: Flat, minimal design
- **Subtle Borders**: 1px solid lines

---

## 📊 New Financial Trackers

### 1. 💵 Income Tracker
**Location**: `/finances/income`

**Features**:
- Monthly income trends (line chart)
- Income sources breakdown (donut chart)
- Detailed income sources table with YTD totals
- Income vs target progress bars
- Recurring income identification
- Missing payment alerts
- Export to CSV for tax purposes

**Data Source**:
- `financial_transactions` table WHERE `amount > 0`
- Excludes transfers and loan deposits
- Categorizes by description patterns

---

### 2. 🏢 Business Expenses Tracker
**Location**: `/finances/business`

**Features**:
- IRS-compliant tax categories
- Quarterly tax estimate calculator
- Receipt upload and management
- OCR text extraction from receipts
- Business vs personal expense split visualization
- Tax deduction tracking (e.g., 50% for meals)
- Export all receipts for tax filing
- Tag transactions as "business" with category

**Data Source**:
- `financial_transactions` table with `is_business_expense = 1`
- New field: `tax_category` (IRS categories)
- New field: `receipt_url` (cloud storage links)

**Tax Categories**:
- Advertising & Marketing
- Office Supplies
- Software & Subscriptions
- Travel & Meals (50% deductible)
- Professional Services
- Equipment & Depreciation
- Home Office
- Other Business Expenses

**Quarterly Tax Reminders**:
- April 15, June 15, September 15, January 15
- Auto-calculate estimated tax owed
- Payment tracking

---

### 3. 💳 Loan Payback Tracker
**Location**: `/loans`

**Features**:
- Visual loan cards with progress bars
- Total debt remaining + months until debt-free
- Payoff scenario calculator:
  - What if I pay extra $X/month?
  - Debt avalanche vs snowball comparison
  - Interest savings calculator
- Amortization schedule per loan
- Payment history timeline
- Debt-free countdown timer
- Milestone celebrations (25%, 50%, 75%, 100%)

**Data Source**:
- New `loans` table with all loan details
- New `loan_payments` table for payment history
- Links to `financial_transactions` for actual payments

**Loan Types Supported**:
- Personal Loan
- Student Loan
- Auto Loan
- Mortgage
- Credit Card
- Other

**Calculations**:
- Interest saved with extra payments
- Projected payoff date
- Total interest paid vs original schedule
- Monthly payment breakdown (principal vs interest)

---

## 🎯 Dashboard Pages Overview

### Page Structure:
```
1. Overview              [Home dashboard]
2. Finances              [Main financial overview]
   ├── Income            [💵 Income Tracker]
   └── Business          [🏢 Business Expenses]
3. Loans                 [💳 Loan Payback Tracker]
4. Investments           [Market data & portfolio]
5. Goals                 [Daily goals & productivity]
6. Tasks                 [Trello & Agent monitoring]
7. Settings              [Config + Loan Management]
```

---

## 🔧 Settings Enhancements

### Loan Management Section
- Add new loans with full details:
  - Loan name (e.g., "Personal Loan - BofA")
  - Original amount
  - Current balance
  - Interest rate (%)
  - Monthly payment
  - Start date
  - Expected payoff date
  - Loan type (dropdown)
- Edit existing loans
- Mark loans as paid off
- Delete loans

### Transaction Rules
- Auto-categorization rules:
  - If description contains "UBER" → Business: Travel
  - If merchant contains "AMAZON AWS" → Business: Software
  - If description contains "VENMO" → Personal: Exclude
- Create custom rules via UI
- Apply rules to historical transactions

### Income Targets
- Set monthly income goals
- Track progress toward targets
- Historical target vs actual comparison

---

## 💡 Smart Features

### Auto-Detection & Tagging
- **Income Detection**: Automatically identifies deposits as income
- **Recurring Payments**: Detects loan payments and categorizes them
- **Business Patterns**: Suggests transactions to tag as business based on patterns
- **Tax Categories**: Auto-suggests IRS categories for business expenses

### Insights & Alerts
- **Budget Alerts**: Discord/Email when spending exceeds budget
- **Loan Reminders**: Payment due dates (1 day before)
- **Income Anomalies**: Alert when expected income doesn't arrive
- **Business Expense Threshold**: Alert when nearing quarterly tax payment due
- **Goal Streaks**: Celebrate goal completion milestones

### Exportable Reports
- **Income Report**: Monthly/quarterly/yearly income summary
- **Business Expenses**: Tax-ready export with all receipts
- **Loan Statements**: Payment history and amortization schedule
- **Net Worth Statement**: Assets, liabilities, net worth trend
- **Year-End Tax Package**: All business expenses + receipts in one ZIP

---

## 🎨 Theme Implementation

### Light Mode (Default)
```css
:root {
  --background: 0 0% 100%;        /* #ffffff */
  --foreground: 0 0% 4%;          /* #0a0a0a */
  --surface: 0 0% 96%;            /* #f5f5f5 */
  --border: 0 0% 88%;             /* #e0e0e0 */
  --accent: 150 100% 33%;         /* #00aa66 */
}
```

### Dark Mode
```css
[data-theme="dark"] {
  --background: 0 0% 4%;          /* #0a0a0a */
  --foreground: 0 0% 100%;        /* #ffffff */
  --surface: 0 0% 10%;            /* #1a1a1a */
  --border: 0 0% 20%;             /* #333333 */
  --accent: 150 100% 50%;         /* #00ff88 */
}
```

### Theme Toggle Component
```tsx
import { useTheme } from 'next-themes'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
```

---

## 📈 Priority Implementation Order

### Phase 1: Core Setup (Week 1)
1. Create Next.js project
2. Install dependencies (shadcn/ui, Recharts, next-themes)
3. Set up Tailwind with light/dark mode
4. Create database migrations for new tables
5. Build main layout with sidebar + theme toggle

### Phase 2: Financial Trackers (Week 2-3)
1. **Income Tracker** - Most impactful
2. **Loan Payback Tracker** - High priority
3. **Business Expenses Tracker** - Tax compliance

### Phase 3: Existing Integrations (Week 4)
1. Finances overview page
2. Investments & market data
3. Goals & productivity
4. Tasks & agents

### Phase 4: Polish & Advanced Features (Week 5+)
1. Receipt upload and OCR
2. Payoff scenario calculator
3. Tax estimate calculator
4. Notification system
5. Export reports
6. Mobile optimization

---

## 🚀 Ready to Build

All specs are ready. Next steps:
1. Create Next.js project structure
2. Set up database migrations
3. Build core layout with theme toggle
4. Start with Overview + Income Tracker

**Let's start building!**
