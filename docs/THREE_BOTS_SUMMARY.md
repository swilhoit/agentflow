# Three Bot Architecture - Complete Summary

## Overview

You have THREE independent Discord bots running on Hetzner VPS, each specialized for different tasks:

## 1. Main Bot - General Assistant

**Purpose**: General-purpose assistant for coding, tasks, and voice AI

**Runs**: Hetzner VPS (agentflow-bot container)
**Monitors**: All channels EXCEPT #crypto, #global-ai, #finance
**Token**: `DISCORD_TOKEN`

### Capabilities
- Voice conversations (OpenAI Realtime API)
- Autonomous coding agents (Claude Code)
- Task orchestration
- Cloud deployments (for user apps)
- Engineering tasks
- General Q&A

### Example Channels
- #general
- #agent-chat
- #goals
- #waterwise
- etc.

### Commands
```
!help - Show help
!agents - List active agents
!join - Join voice channel
!status - Show bot status
```

---

## 2. Atlas Bot - Market Intelligence

**Purpose**: Global markets expert and financial market analyst

**Runs**: Hetzner VPS (agentflow-atlas container)
**Monitors**: #crypto, #global-ai ONLY
**Token**: `ATLAS_DISCORD_TOKEN`

### Capabilities
- Real-time crypto/FX prices (CoinGecko, ExchangeRate API)
- Perplexity-powered news & analysis
- Sector analysis (uranium, AI chips, DeFi)
- Geopolitical analysis
- Earnings reports
- AI Manhattan Project portfolio tracking (30+ tickers)
- Fear & Greed Index

### Market Tools
1. `crypto_price` - BTC, ETH, SOL prices
2. `forex_rate` - Currency exchange rates
3. `market_sentiment` - Fear & Greed Index
4. `news_search` - Latest breaking news
5. `market_intelligence` - Comprehensive analysis
6. `geopolitical_analysis` - Event impacts
7. `sector_analysis` - Industry deep dives
8. `earnings_analysis` - Company earnings
9. `breaking_market_news` - Current developments
10. `portfolio_snapshot` - AI Manhattan portfolio
11. `ticker_deep_dive` - Stock analysis

### Example Queries
```
btc price?
show me the AI Manhattan portfolio
deep dive on CCJ
china economic outlook
uranium sector analysis
```

---

## 3. Financial Advisor - Personal Finance

**Purpose**: Personal finance expert using real bank account data

**Runs**: Hetzner VPS (agentflow-advisor container)
**Monitors**: #finance ONLY
**Token**: `ADVISOR_DISCORD_TOKEN`

### Capabilities
- Connect to real bank accounts (Teller API)
- Account balances & net worth
- Spending analysis by category
- Budget tracking & alerts
- Savings goal calculations
- Transaction search
- Financial advice

### Finance Tools
1. `get_accounts` - List all bank accounts
2. `get_account_details` - Account details
3. `get_balance_summary` - Net worth calculation
4. `get_transactions` - Recent transactions
5. `analyze_spending` - Spending by category
6. `budget_check` - Budget vs actual
7. `savings_goal` - Savings plan calculator

### Example Queries
```
what's my balance?
how much did I spend on dining?
can I afford a $5000 vacation in 6 months?
what's my net worth?
show recent transactions
am I over budget for groceries?
```

---

## Channel Assignment

```
                Discord Server
          "INTELLIGENCE UNLEASHED"
                     |
       +-------------+-------------+
       |             |             |
  Main Bot        Atlas       Advisor Bot
  (General)      (Market)     (Finance)
       |             |             |
#general        #crypto        #finance
#agent-chat     #global-ai
#goals
#waterwise
#mogul
... (all other)
```

---

## Infrastructure

All three bots run on a single Hetzner VPS:

```
Hetzner VPS (178.156.198.233)
+------------------------------------+
|  Docker Compose                    |
|  +-------------+                   |
|  | agentflow-  |  Port 3001       |
|  | bot         |  (Main Bot)      |
|  +-------------+                   |
|  +-------------+                   |
|  | agentflow-  |  Port 8082       |
|  | atlas       |  (Atlas)         |
|  +-------------+                   |
|  +-------------+                   |
|  | agentflow-  |  Port 8081       |
|  | advisor     |  (Advisor)       |
|  +-------------+                   |
+------------------------------------+
```

---

## Deployment Commands

### Deploy All Bots
```bash
./deploy-all-bots.sh
```

### Restart All Bots
```bash
./finish-setup.sh
```

### Check Status
```bash
./verify-bots.sh
```

### View Logs
```bash
ssh root@178.156.198.233 'docker logs agentflow-bot -f'
ssh root@178.156.198.233 'docker logs agentflow-atlas -f'
ssh root@178.156.198.233 'docker logs agentflow-advisor -f'
```

---

## Cost Breakdown

### Monthly Costs

**Hetzner VPS**: ~$10-15/month (all three bots)
**Perplexity API**: $1.50-9/month
**Anthropic API**: $3-10/month
**Teller API**: Free tier

**Total**: ~$15-35/month for 24/7 intelligent bot system

---

## Testing

### Test Main Bot (in #general)
```
!help
what's the weather?
!agents
```

### Test Atlas (in #crypto or #global-ai)
```
btc price?
show me the portfolio
china economic outlook
```

### Test Financial Advisor (in #finance)
```
what's my balance?
how much did I spend on dining?
can I afford a $5000 vacation?
```

---

## Architecture Highlights

- **Three independent bots** - No conflicts
- **Clean channel separation** - Each bot knows its place
- **Specialized capabilities** - Each bot is an expert in its domain
- **Docker deployment** - Easy to manage and update
- **Health checks** - Automatic recovery from failures
- **Supabase database** - Cloud database for persistence
- **Cost-effective** - All bots on one server

---

**All three bots work independently with zero conflicts!**

Each bot has its own:
- Discord token & credentials
- Monitored channels
- Specialized tools
- Container instance
- Purpose & personality
