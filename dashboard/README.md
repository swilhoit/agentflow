# AgentFlow Dashboard

A Next.js dashboard for managing personal finances, tracking goals, monitoring investments, and visualizing your complete personal management suite.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3010](http://localhost:3010) in your browser.

## 🎨 Features

### Financial Trackers
- **Income Tracker**: Track all income sources with trends and targets
- **Business Expenses**: Separate business expenses for tax purposes with IRS categories
- **Loan Payback Tracker**: Monitor loan balances, payoff dates, and interest savings
- **Spending Analysis**: Category-based expense tracking

### Productivity Tools
- **Daily Goals**: Track and visualize goal completion
- **Trello Integration**: Sync with Trello boards for task management
- **Agent Monitoring**: View AI agent execution logs and performance

### Investment & Market Data
- **Portfolio Tracking**: Monitor stock performance over time
- **Market News**: Curated financial news with sentiment analysis
- **Weekly Analysis**: Thesis reports and market insights

## 🎨 Design System

### Theme
- **Light Mode**: Default clean, minimal aesthetic with white background
- **Dark Mode**: Terminal-inspired with matrix green accents
- **Toggle**: Moon/sun icon in header to switch themes

### Typography
- **Font**: JetBrains Mono (monospace throughout)
- **No shadows**: Flat, minimal design
- **Subtle borders**: 1px solid lines

### Color Palette

#### Light Mode (Default)
- Background: `#ffffff`
- Surface: `#f5f5f5`
- Border: `#e0e0e0`
- Accent: `#00aa66` (forest green)

#### Dark Mode
- Background: `#0a0a0a`
- Surface: `#1a1a1a`
- Border: `#333333`
- Accent: `#00ff88` (matrix green)

## 📁 Project Structure

```
dashboard/
├── app/                          # Next.js app directory
│   ├── (dashboard)/             # Dashboard routes (with layout)
│   │   ├── layout.tsx           # Dashboard layout + sidebar
│   │   ├── page.tsx             # Overview/home page
│   │   ├── finances/            # Financial pages
│   │   │   ├── page.tsx         # Finances overview
│   │   │   ├── income/          # Income tracker
│   │   │   └── business/        # Business expenses
│   │   ├── loans/               # Loan payback tracker
│   │   ├── investments/         # Market & portfolio
│   │   ├── goals/               # Goals & productivity
│   │   ├── tasks/               # Tasks & agents
│   │   └── settings/            # Settings
│   ├── api/                     # API routes
│   │   ├── finances/
│   │   ├── loans/
│   │   └── ...
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing page
│   └── globals.css              # Global styles + theme
├── components/                  # Reusable components
│   ├── theme-provider.tsx       # Next-themes provider
│   ├── theme-toggle.tsx         # Light/dark mode toggle
│   ├── charts/                  # Custom chart components
│   ├── cards/                   # Data cards
│   └── ui/                      # shadcn/ui components
├── lib/                         # Utility functions
│   └── utils.ts                 # Helpers (cn, formatCurrency, etc.)
├── hooks/                       # Custom React hooks
├── types/                       # TypeScript types
└── public/                      # Static assets
```

## 🔧 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **State**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Theme**: next-themes
- **Icons**: Lucide React
- **Database**: SQLite (parent agentflow.db)

## 📊 API Routes

### Finances
- `GET /api/finances` - Financial overview
- `GET /api/finances/transactions` - Recent transactions
- `GET /api/finances/income` - Income data
- `GET /api/finances/business` - Business expenses

### Loans
- `GET /api/loans` - All loans
- `GET /api/loans/[id]` - Single loan details
- `POST /api/loans` - Create/update loan
- `GET /api/loans/[id]/amortization` - Amortization schedule

### Goals
- `GET /api/goals` - User goals
- `GET /api/goals/[date]` - Goals for specific date
- `POST /api/goals` - Create/update goal

### Market
- `GET /api/market/prices` - Market prices
- `GET /api/market/news` - Market news
- `GET /api/market/analysis` - Weekly analysis

## 🗄️ Database

The dashboard connects to the existing AgentFlow SQLite database (`../data/agentflow.db`).

### New Tables Required

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
  loan_type TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Business Expenses (Update existing financial_transactions)
```sql
ALTER TABLE financial_transactions ADD COLUMN is_business_expense BOOLEAN DEFAULT 0;
ALTER TABLE financial_transactions ADD COLUMN tax_category TEXT;
ALTER TABLE financial_transactions ADD COLUMN receipt_url TEXT;
```

## 🎯 Development Roadmap

### Phase 1: Core Setup ✅
- [x] Create Next.js project
- [x] Install dependencies
- [x] Set up Tailwind with light/dark mode
- [x] Create theme toggle
- [x] Build landing page

### Phase 2: Financial Trackers (In Progress)
- [ ] Income Tracker page
- [ ] Business Expenses page
- [ ] Loan Payback Tracker page
- [ ] API routes for financial data
- [ ] Database migrations

### Phase 3: Dashboard Pages
- [ ] Overview page with metrics
- [ ] Finances overview page
- [ ] Investments page
- [ ] Goals page
- [ ] Tasks page
- [ ] Settings page

### Phase 4: Charts & Visualizations
- [ ] Line charts (income/expenses)
- [ ] Donut charts (spending breakdown)
- [ ] Area charts (trends)
- [ ] Bar charts (comparisons)
- [ ] Heatmaps (goal completion)

### Phase 5: Advanced Features
- [ ] Receipt upload and OCR
- [ ] Payoff scenario calculator
- [ ] Tax estimate calculator
- [ ] Notification system
- [ ] Export reports

## 🚀 Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 📝 Environment Variables

Create a `.env.local` file:

```env
# Database
DATABASE_PATH=../data/agentflow.db

# Teller API (for financial data)
TELLER_API_KEY=your_key_here

# Trello API
TRELLO_API_KEY=your_key_here
TRELLO_API_TOKEN=your_token_here

# Discord (for notifications)
DISCORD_WEBHOOK_URL=your_webhook_url_here
```

## 🎨 Customization

### Adding New Charts
Create chart components in `components/charts/` using Recharts with the theme colors.

### Adding New Pages
1. Create page in `app/(dashboard)/[section]/page.tsx`
2. Add API route in `app/api/[section]/route.ts`
3. Create custom hook in `hooks/use-[section].ts`
4. Add link to sidebar navigation

## 📚 Documentation

- [Full Dashboard Plan](/DASHBOARD_PLAN.md)
- [Feature Summary](/DASHBOARD_FEATURES.md)
- [AgentFlow Main README](../README.md)

## 🤝 Contributing

This is a personal project, but suggestions are welcome!

## 📄 License

MIT

---

**Built with 💚 using Next.js, Tailwind CSS, and TypeScript**
