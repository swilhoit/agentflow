# AgentFlow Personal Management Dashboard - Implementation Plan

## 📊 Executive Summary

A Next.js dashboard that visualizes your complete personal management suite with a minimal, clean aesthetic using monospace fonts and no shadows.

---

## 🎯 Data Sources Analyzed

### 1. Financial Data (Teller API + SQLite)
- **Financial Transactions**: Bank accounts, credit cards, categorized spending
- **Income Tracking**: Multiple income sources
- **Spending Analysis**: By category, merchant, account
- **Account Balances**: Real-time syncing via Teller API

### 2. Productivity Data
- **Daily Goals**: User goals with date tracking and history
- **Trello Boards**: Cards, lists, labels, checklists, comments
- **Agent Tasks**: AI execution logs, task status, performance metrics

### 3. Investment & Market Data
- **Market Prices**: Ticker performance (30/90/365 day trends)
- **Market News**: Financial news with sentiment analysis
- **Weekly Analysis**: Thesis reports and market insights

### 4. Communication Data
- **Conversations**: Discord message history (voice/text)
- **Agent Logs**: AI activity and execution details

---

## 🎨 Design System

### Core Aesthetic
```
✓ Monospace fonts (JetBrains Mono, Fira Code, or IBM Plex Mono)
✓ No shadows
✓ Minimal, clean lines
✓ High contrast text
✓ Subtle borders (1px solid)
✓ Muted color palette
✓ Terminal/CLI inspired aesthetic
✓ Light mode default with dark mode toggle
```

### Color Palette

#### Light Mode (Default)
```
Background:     #ffffff (white)
Surface:        #f5f5f5 (light grey)
Border:         #e0e0e0 (soft grey)
Text Primary:   #0a0a0a (near black)
Text Secondary: #666666 (medium grey)
Accent:         #00aa66 (forest green)
Warning:        #ff8800 (orange)
Error:          #dd3333 (red)
Success:        #00aa66 (green)
Info:           #3377ff (blue)
```

#### Dark Mode
```
Background:     #0a0a0a (near black)
Surface:        #1a1a1a (dark grey)
Border:         #333333 (medium grey)
Text Primary:   #ffffff (white)
Text Secondary: #999999 (light grey)
Accent:         #00ff88 (matrix green)
Warning:        #ffaa00 (amber)
Error:          #ff5555 (red)
Success:        #00ff88 (green)
Info:           #5599ff (blue)
```

---

## 📐 Dashboard Architecture

### Layout Structure
```
┌──────────────────────────────────────────────────────────────┐
│  SIDEBAR          │  MAIN CONTENT AREA                       │
│  (Fixed)          │  (Scrollable)                            │
│                   │                                          │
│  > Overview       │  ┌─────────────────────────────┐       │
│  > Finances       │  │  Page Header  [🌙 Theme]    │       │
│    - Income       │  └─────────────────────────────┘       │
│    - Expenses     │                                          │
│    - Business     │  ┌────────┐ ┌────────┐                │
│  > Loans          │  │ Card 1 │ │ Card 2 │                │
│  > Investments    │  └────────┘ └────────┘                │
│  > Goals          │                                          │
│  > Tasks          │  ┌──────────────────────────┐          │
│  > Agents         │  │  Charts & Visualizations │          │
│  > Settings       │  └──────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

---

## 📱 Dashboard Pages

### 1. Overview (Dashboard Home)
**Purpose**: High-level snapshot of your life

**Widgets**:
- **Financial Summary Card**
  - Current month spending vs budget
  - Net worth trend (mini sparkline)
  - Account balances (checking/savings/credit)
  - Quick link to Income/Business/Loans

- **Loan Payoff Progress**
  - Total debt remaining
  - Months until debt-free
  - Progress bar with percentage
  - Quick link to Loan Tracker

- **Income This Month**
  - Current month income total
  - Comparison to last month (+/- %)
  - Progress toward monthly target
  - Quick link to Income Tracker

- **Business Expenses (MTD)**
  - Month-to-date business expenses
  - Comparison to last month
  - Quick link to Business Tracker

- **Goals Progress**
  - Today's goals checklist
  - 7-day goal completion rate (bar chart)
  - Current streak counter

- **Task Summary**
  - Active Trello cards count
  - Upcoming due dates (next 7 days)
  - Recently completed tasks

- **Market Snapshot**
  - Top 3 watched tickers (live prices)
  - Today's portfolio change (+/- %)
  - Latest significant news headline

- **Agent Activity**
  - Active agents count
  - Last 5 agent executions (status, time)
  - Success/failure rate (today)

**Layout**: 3-column grid on desktop, 2-column on tablet, stacked on mobile

---

### 2. Finances Overview
**Purpose**: High-level financial dashboard

**Sections**:

#### 2.1 Financial Overview (Top Cards)
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total Income │ │ Total Spent  │ │ Net Savings  │ │ Burn Rate    │
│ (this month) │ │ (this month) │ │ (this month) │ │ ($/day avg)  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

#### 2.2 Quick Links to Sub-Pages
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ 💵 Income       │ │ 💸 Expenses     │ │ 🏢 Business     │
│ Tracker         │ │ Tracker         │ │ Expenses        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

#### 2.2 Income vs Expenses (Line Chart)
- Dual-axis line chart
- Monthly view (last 12 months)
- Toggle: Weekly, Monthly, Quarterly
- Data from `financial_transactions` table

#### 2.3 Spending Breakdown (Donut Chart)
- Category-based spending
- Percentage labels
- Click to filter transactions list
- Query: `getSpendingSummary(startDate, endDate)`

#### 2.4 Category Trends (Area Chart)
- Stacked area chart
- Top 5 spending categories over time
- 90-day rolling view

#### 2.5 Recent Transactions (Table)
- Sortable, filterable table
- Columns: Date, Description, Category, Amount, Account
- Pagination (50 per page)
- Search by merchant/description
- Query: `getRecentTransactions(days, limit)`

#### 2.6 Account Balances (Bar Chart)
- Horizontal bars
- All accounts (checking, savings, credit cards)
- Real-time sync status indicator
- Last synced timestamp

---

### 3. Income Tracker
**Purpose**: Track all income sources and trends

**Sections**:

#### 3.1 Income Summary (Top Cards)
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ This Month   │ │ Last Month   │ │ YTD Total    │ │ Avg/Month    │
│ $12,450      │ │ $11,890      │ │ $142,300     │ │ $11,858      │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

#### 3.2 Income Trend (Line Chart)
- Monthly income over last 12 months
- Comparison to previous year
- Toggle view: Weekly, Monthly, Quarterly, Yearly
- Data from `financial_transactions` WHERE amount > 0

#### 3.3 Income Sources Breakdown (Donut Chart)
- By source/description
- Percentage of total income
- Click to drill down into specific source

#### 3.4 Income Sources Table
- Sortable table with columns:
  - Source/Description
  - Category (Salary, Freelance, Investment, Other)
  - This Month
  - Last Month
  - YTD
  - Average/Month
  - % of Total
- Search and filter by source name
- Export to CSV

#### 3.5 Income vs Target (Progress Bars)
- Set monthly income targets
- Visual progress bars showing % achieved
- Color coding (red < 80%, yellow 80-100%, green > 100%)

#### 3.6 Recurring Income Tracker
- Identify recurring income patterns
- Expected vs Actual
- Next expected payment dates
- Missing payment alerts

---

### 4. Business Expenses Tracker
**Purpose**: Separate business expenses from personal

**Sections**:

#### 4.1 Business Expense Summary (Top Cards)
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ This Month   │ │ This Quarter │ │ YTD Total    │ │ Tax Deduct.  │
│ $2,340       │ │ $7,120       │ │ $28,450      │ │ $25,605      │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

#### 4.2 Business Expense Categorization (Donut Chart)
- IRS tax categories:
  - Advertising & Marketing
  - Office Supplies
  - Software & Subscriptions
  - Travel & Meals (50% deductible)
  - Professional Services
  - Equipment & Depreciation
  - Home Office
  - Other Business Expenses

#### 4.3 Business Expenses by Month (Bar Chart)
- Stacked bar chart showing categories
- Last 12 months
- Trend analysis

#### 4.4 Business Transactions Table
- All transactions tagged as "Business"
- Columns: Date, Description, Category, Amount, Receipt, Tax Deductible
- Add/Edit/Tag transactions as business
- Upload receipt images
- Export for tax filing

#### 4.5 Business vs Personal Split (Stacked Area Chart)
- Visual representation of business vs personal spending over time
- Toggle between percentage and absolute values

#### 4.6 Receipt Management
- Upload and attach receipts to transactions
- OCR text extraction from receipts
- Search by receipt content
- Download all receipts for tax season

#### 4.7 Quarterly Tax Estimates
- Estimated quarterly tax owed based on business income
- Payment due dates (April 15, June 15, Sept 15, Jan 15)
- Payment history and upcoming payments

---

### 5. Loan Payback Tracker
**Purpose**: Track all loans and payoff progress

**Sections**:

#### 5.1 Loan Overview (Top Cards)
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total Owed   │ │ Monthly Pay. │ │ Payoff Date  │ │ Interest Pd. │
│ $45,230      │ │ $1,850       │ │ Jun 2028     │ │ $8,340       │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

#### 5.2 Active Loans List
- Card-based layout for each loan:
  ```
  ┌─────────────────────────────────────────┐
  │ 🏦 Personal Loan - Bank of America      │
  │                                         │
  │ Principal: $20,000    Rate: 8.5%       │
  │ Balance: $18,450      Monthly: $650    │
  │ Progress: [████████░░] 78%             │
  │ Payoff Date: Mar 2026                  │
  │                                         │
  │ [View Details] [Make Payment]          │
  └─────────────────────────────────────────┘
  ```
- Color-coded by loan type (personal, student, auto, mortgage)

#### 5.3 Payoff Progress (Area Chart)
- Stacked area chart showing balance over time for all loans
- Projected payoff trajectory with current payments
- Comparison to original loan term

#### 5.4 Payoff Scenarios Calculator
- What-if scenarios:
  - Extra $100/month → Payoff date moves to...
  - Extra $500 one-time → Saves $XXX in interest
  - Debt avalanche vs snowball comparison
- Interactive sliders to adjust extra payments

#### 5.5 Loan Amortization Schedule
- Detailed table per loan:
  - Payment #, Date, Payment Amount, Principal, Interest, Balance
  - Highlight current payment
  - Export to CSV

#### 5.6 Interest Savings Tracker
- Track how much interest you've saved with extra payments
- Comparison to original amortization schedule
- Visual progress bar

#### 5.7 Payment History
- Timeline of all loan payments
- Missed payments (if any)
- Extra payments highlighted
- Download payment receipts

#### 5.8 Debt-Free Date Countdown
- Large countdown timer to complete debt freedom
- Motivational progress visualization
- Milestone celebrations (25%, 50%, 75%, 100% paid)

---

### 6. Investments & Markets
**Purpose**: Track market performance and investment ideas

**Sections**:

#### 3.1 Portfolio Performance (Line Chart)
- Multi-line chart for tracked tickers
- Performance over 30/90/365 days
- Percentage gains/losses
- Data from `market_data` table

#### 3.2 Watchlist (Table)
- Ticker, Current Price, Change, % Change
- 30d/90d/365d performance columns
- Color coding (green/red)
- Real-time updates

#### 3.3 Market News Feed (List)
- Scrollable list of news articles
- Headline, source, timestamp
- Sentiment badges (positive/negative/neutral)
- Filter by ticker
- Data from `market_news` table

#### 3.4 Weekly Analysis (Report View)
- Latest weekly thesis report
- Key events, recommendations
- Date range selector
- Markdown rendering
- Query: `getLatestWeeklyAnalysis()`

#### 3.5 Investment Ideas Tracker
- Custom table with columns:
  - Idea/Ticker
  - Rationale
  - Entry price target
  - Status (researching, watching, entered, exited)
  - Notes
- CRUD operations
- Stored in new `investment_ideas` table

---

### 7. Goals & Productivity
**Purpose**: Track daily goals and productivity metrics

**Sections**:

#### 4.1 Daily Goals (Today)
- Input field to set today's goals
- Checklist view of goals
- Mark as complete
- Query: `getDailyGoal(userId, date)`

#### 4.2 Goal Completion Heatmap
- Calendar heatmap (GitHub-style)
- Last 90 days
- Color intensity = completion rate
- Hover shows date + goals

#### 4.3 Goal History Timeline
- Chronological list of past goals
- Date, goals text, completion status
- Search/filter by keyword
- Pagination
- Query: `getUserGoalsHistory(userId, limit)`

#### 4.4 Productivity Metrics (Cards)
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Current      │ │ Longest      │ │ This Week    │
│ Streak       │ │ Streak       │ │ Completion   │
│ 7 days       │ │ 21 days      │ │ 85%          │
└──────────────┘ └──────────────┘ └──────────────┘
```

#### 4.5 Trello Board Overview
- List all boards
- Card counts per list
- Click to view board details

#### 4.6 Trello Task Kanban
- Interactive Kanban board
- Drag-and-drop to move cards
- Filter by label, member, due date
- Real-time sync with Trello API
- Uses `TrelloService` methods

---

### 8. Tasks & Agents
**Purpose**: Monitor AI agent activity and task execution

**Sections**:

#### 5.1 Active Agents (Table)
- Agent ID, Task Description, Status, Started At
- Real-time status updates
- Click to view logs
- Query: `getAllActiveAgentTasks()`

#### 5.2 Agent Execution Timeline
- Vertical timeline
- Completed tasks (last 24 hours)
- Success/failure indicators
- Execution duration
- Query: `getAgentTask(agentId)`

#### 5.3 Agent Performance Metrics (Charts)
- Success Rate (Donut chart)
  - Completed vs Failed
- Execution Times (Bar chart)
  - Average duration by agent type
- Activity Heatmap (Calendar)
  - Tasks per day

#### 5.4 Agent Logs (Expandable List)
- Accordion-style logs per task
- Log level badges (info, warning, error, success)
- Timestamp, message, details
- Query: `getAgentLogs(agentId, limit)`

#### 5.5 Failed Tasks (Table)
- Last 24 hours
- Error messages
- Retry button
- Query: `getFailedTasks(hours)`

---

### 9. Settings
**Purpose**: Configure dashboard preferences and integrations

**Sections**:

#### 9.1 Appearance
- **Theme Toggle**: Light / Dark mode (default: Light)
- **Font Size**: Small, Medium, Large
- **Compact Mode**: Toggle for denser layouts

#### 9.2 Financial Settings
- **Monthly Budget Target**: Set overall budget goal
- **Business Expense Categories**: Customize IRS categories
- **Income Target**: Set monthly income goal
- **Loan Management**: Add/Edit/Remove loans
  - Loan Name
  - Original Amount
  - Current Balance
  - Interest Rate
  - Monthly Payment
  - Start Date
  - Payoff Date

#### 9.3 Data & Sync
- **Data Refresh Intervals**: Configure auto-refresh rates
- **Teller API Settings**: Re-authenticate, sync schedule
- **Transaction Rules**: Auto-categorization rules
  - If description contains X → Category Y
  - If merchant contains X → Tag as Business

#### 9.4 Integrations
- **Trello**: API configuration, board selection
- **Discord**: Notification channel setup
- **Market Data**: API keys for market feeds

#### 9.5 Notifications
- **Budget Alerts**: Email/Discord when budget exceeded
- **Loan Reminders**: Payment due date reminders
- **Goal Reminders**: Daily goal prompts
- **Agent Failures**: Alert on failed tasks

#### 9.6 Export & Backup
- **Export Data**: Download CSV/JSON exports
- **Backup Database**: Download SQLite database
- **Tax Documents**: Generate year-end reports

---

## 🛠️ Technical Stack

### Frontend
```
- Next.js 15 (App Router)
- TypeScript
- shadcn/ui components
- Tailwind CSS
- Recharts (charts library)
- React Query (data fetching)
- Zustand (state management)
- next-themes (light/dark mode)
```

### Backend
```
- Next.js API Routes
- SQLite database (existing agentflow.db)
- Teller API integration (financial data)
- Trello API integration
- Market data APIs (existing services)
- New tables: loans, business_expenses, income_targets
```

### New Database Schema Required

#### Loans Table
```sql
CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  original_amount REAL NOT NULL,
  current_balance REAL NOT NULL,
  interest_rate REAL NOT NULL,
  monthly_payment REAL NOT NULL,
  start_date TEXT NOT NULL,
  payoff_date TEXT,
  loan_type TEXT CHECK(loan_type IN ('personal', 'student', 'auto', 'mortgage', 'credit', 'other')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paid_off', 'deferred')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loan_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  payment_amount REAL NOT NULL,
  principal REAL NOT NULL,
  interest REAL NOT NULL,
  remaining_balance REAL NOT NULL,
  transaction_id TEXT,
  FOREIGN KEY (loan_id) REFERENCES loans(id)
);
```

#### Income Targets Table
```sql
CREATE TABLE IF NOT EXISTS income_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  month TEXT NOT NULL, -- Format: YYYY-MM
  target_amount REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Transaction Categories Update
```sql
-- Add business_expense flag to financial_transactions table
ALTER TABLE financial_transactions ADD COLUMN is_business_expense BOOLEAN DEFAULT 0;
ALTER TABLE financial_transactions ADD COLUMN tax_category TEXT;
ALTER TABLE financial_transactions ADD COLUMN receipt_url TEXT;
```

### Fonts
```
- JetBrains Mono (primary monospace)
- Fallback: Fira Code, Courier New
```

---

## 🔧 Implementation Steps

### Phase 1: Project Setup
1. Create Next.js app in `/agentflow/dashboard` directory
2. Install shadcn/ui
3. Configure Tailwind with custom theme (no shadows, monospace fonts)
4. Set up folder structure

### Phase 2: Database & API Layer
1. Create API routes to query SQLite database
2. Build data fetching hooks with React Query
3. Implement Teller API integration
4. Implement Trello API integration
5. Add error handling and loading states

### Phase 3: Core Layout & Navigation
1. Build sidebar navigation
2. Create page layouts
3. Implement responsive design
4. Add breadcrumbs and page headers

### Phase 4: Dashboard Pages (Priority Order)
1. **Overview** - High-level snapshot
2. **Finances Overview** - Main financial dashboard
3. **Income Tracker** - Track all income sources
4. **Business Expenses** - Separate business spending
5. **Loan Payback Tracker** - Debt payoff progress
6. **Investments** - Market tracking
7. **Goals** - Daily productivity tracking
8. **Tasks** - Agent monitoring
9. **Settings** - Configuration with loan management

### Phase 5: Charts & Visualizations
1. Configure Recharts with custom theme
2. Build reusable chart components
3. Implement all chart types per spec above
4. Add interactive features (tooltips, filters)

### Phase 6: Polish & Optimization
1. Add loading skeletons
2. Implement error boundaries
3. Optimize data queries
4. Add caching strategies
5. Performance testing

---

## 📊 Chart Components Library

### Custom Chart Components to Build

1. **LineChart** (Income/Expenses, Portfolio Performance)
   - No grid lines
   - Minimal axes
   - Monospace labels
   - Clean tooltips

2. **BarChart** (Account Balances, Category Trends)
   - Horizontal or vertical
   - No background fill
   - 1px borders

3. **DonutChart** (Spending Breakdown, Agent Success Rate)
   - Center text with total
   - Segment labels
   - Legend below

4. **AreaChart** (Category Trends)
   - Stacked areas
   - Subtle opacity
   - Clean lines

5. **Heatmap** (Goal Completion Calendar)
   - Custom color scale
   - Hover tooltips
   - Date labels

6. **Sparkline** (Mini trend indicators)
   - Inline mini charts
   - 7-day trends
   - Used in cards

---

## 🗄️ Database Queries Reference

### Financial Data
```typescript
// Income vs Expenses
getTransactionsByDateRange(startDate, endDate)

// Spending by Category
getSpendingSummary(startDate, endDate)

// Recent Transactions
getRecentTransactions(days, limit)

// Account Balance
getTransactionBalance(accountId?)

// Categories
getTransactionCategories()
```

### Goals Data
```typescript
// Today's Goal
getDailyGoal(userId, date)

// Goal History
getUserGoalsHistory(userId, limit)
```

### Market Data
```typescript
// Market Prices
getMarketDataByDateRange(startDate, endDate)

// Market News
getMarketNewsByDateRange(startDate, endDate)

// Weekly Analysis
getLatestWeeklyAnalysis(analysisType?)
```

### Agent Data
```typescript
// Active Tasks
getAllActiveAgentTasks()

// Failed Tasks
getFailedTasks(hours)

// Agent Logs
getAgentLogs(agentId, limit)

// Task Details
getAgentTask(agentId)
```

### Trello Data (via TrelloService)
```typescript
// Boards
trelloService.getBoards()
trelloService.getBoard(boardId)

// Lists
trelloService.getLists(boardId)

// Cards
trelloService.getCardsOnBoard(boardId)
trelloService.getCardsOnList(listId)
trelloService.searchCards(options)
```

---

## 🎯 Key Features

### Real-time Updates
- WebSocket connections for live data
- Auto-refresh intervals (configurable)
- Real-time agent status updates

### Data Export
- CSV export for transactions
- PDF reports for weekly analysis
- JSON export for backup

### Search & Filtering
- Global search across all data
- Per-page filters (date range, category, etc.)
- Saved filter presets

### Responsive Design
- Desktop-first (primary use case)
- Mobile-responsive fallback
- Tablet-optimized layouts

---

## 🚀 Folder Structure

```
agentflow/
├── dashboard/                    # New Next.js app
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx       # Dashboard layout with sidebar + theme toggle
│   │   │   ├── page.tsx         # Overview page
│   │   │   ├── finances/
│   │   │   │   ├── page.tsx     # Finances overview
│   │   │   │   ├── income/
│   │   │   │   │   └── page.tsx # Income tracker
│   │   │   │   └── business/
│   │   │   │       └── page.tsx # Business expenses
│   │   │   ├── loans/
│   │   │   │   └── page.tsx     # Loan payback tracker
│   │   │   ├── investments/
│   │   │   │   └── page.tsx
│   │   │   ├── goals/
│   │   │   │   └── page.tsx
│   │   │   ├── tasks/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   └── api/
│   │       ├── finances/
│   │       ├── income/
│   │       ├── business/
│   │       ├── loans/
│   │       ├── goals/
│   │       ├── market/
│   │       ├── agents/
│   │       └── trello/
│   ├── components/
│   │   ├── charts/              # Custom chart components
│   │   ├── cards/               # Data cards
│   │   ├── tables/              # Data tables
│   │   ├── ui/                  # shadcn/ui components
│   │   └── layout/              # Layout components
│   ├── lib/
│   │   ├── database.ts          # Database client
│   │   ├── api-client.ts        # API helpers
│   │   └── utils.ts             # Utility functions
│   ├── hooks/
│   │   ├── use-finances.ts
│   │   ├── use-goals.ts
│   │   ├── use-market.ts
│   │   └── use-agents.ts
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   ├── styles/
│   │   └── globals.css          # Global styles
│   └── public/
│       └── fonts/               # Monospace fonts
├── src/                          # Existing backend
│   ├── services/
│   │   ├── database.ts          # Reuse this
│   │   ├── trello.ts            # Reuse this
│   │   └── ...
│   └── ...
└── data/
    └── agentflow.db             # Existing SQLite database
```

---

## 🎨 Component Design Examples

### Metric Card
```tsx
<Card className="border border-border bg-surface p-4">
  <div className="font-mono text-sm text-secondary">TOTAL INCOME</div>
  <div className="font-mono text-3xl text-primary mt-2">$12,450</div>
  <div className="font-mono text-xs text-success mt-1">+8.2% vs last month</div>
</Card>
```

### Data Table
```tsx
<Table className="border border-border">
  <TableHeader>
    <TableRow className="border-b border-border bg-surface">
      <TableHead className="font-mono text-xs uppercase">Date</TableHead>
      <TableHead className="font-mono text-xs uppercase">Description</TableHead>
      <TableHead className="font-mono text-xs uppercase">Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody className="font-mono text-sm">
    {/* rows */}
  </TableBody>
</Table>
```

### Chart Container
```tsx
<div className="border border-border bg-surface p-6">
  <h3 className="font-mono text-sm uppercase text-secondary mb-4">
    Spending by Category
  </h3>
  <ResponsiveContainer width="100%" height={300}>
    <DonutChart data={data} />
  </ResponsiveContainer>
</div>
```

---

## 🔐 Security Considerations

- API keys in environment variables
- Server-side data fetching for sensitive data
- Rate limiting on API routes
- Authentication (future: add user login)

---

## 📈 Success Metrics

- **Load Time**: < 2s for initial page load
- **Data Freshness**: Auto-refresh every 60s
- **Chart Render**: < 500ms per chart
- **Mobile Performance**: Lighthouse score > 90

---

## 🚧 Future Enhancements

- **AI Insights**: Natural language queries via Claude
- **Predictive Analytics**: Spending forecasts
- **Budget Alerts**: Discord notifications for overspending
- **Mobile App**: React Native companion app
- **Multi-user**: Support for family/team dashboards
- **Data Export**: Automated weekly reports via email

---

## 🎯 Next Steps

1. **Review this plan** - Confirm scope and priorities
2. **Create Next.js project** - Set up dashboard folder
3. **Install dependencies** - shadcn/ui, Recharts, React Query
4. **Build API routes** - Connect to SQLite database
5. **Implement pages** - Start with Overview, then Finances

---

**Ready to build this? Let's start with Phase 1: Project Setup!**
