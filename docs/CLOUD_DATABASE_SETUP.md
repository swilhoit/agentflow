# Cloud Database Setup

AgentFlow uses **Supabase** as the unified cloud database for all services:

- **Main App (Discord Bots)**: Supabase (PostgreSQL)
- **Dashboard**: Supabase (PostgreSQL)

## Required Environment Variables

### All Services (Bot + Dashboard)

```bash
# Database Configuration - defaults to Supabase
DATABASE_TYPE=supabase

# Supabase Configuration (PostgreSQL)
SUPABASE_URL=https://ymxhsdtagnalxebnskst.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>

# Dashboard also uses these (public keys)
NEXT_PUBLIC_SUPABASE_URL=https://ymxhsdtagnalxebnskst.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>

# Optional: Perplexity API for investment analysis
PERPLEXITY_API_KEY=<your_perplexity_api_key>
```

## Database Schema

### Supabase Tables

All services share these Supabase tables:

| Table | Description |
|-------|-------------|
| `profiles` | User profiles and subscriptions |
| `guild_registrations` | Discord server → User mappings |
| `user_credentials` | Encrypted API keys |
| `conversations` | Discord chat history |
| `agent_tasks` | Agent task tracking |
| `agent_logs` | Agent execution logs |
| `financial_transactions` | Financial transactions |
| `bank_accounts` | Connected bank accounts |
| `teller_accounts` | Teller API accounts |
| `daily_goals` | Daily productivity goals |
| `market_data` | Stock/crypto market data |
| `market_news` | Financial news articles |
| `weekly_analysis` | Investment thesis analysis |
| `user_watchlists` | Stock watchlist |
| `user_holdings` | Portfolio holdings |
| `usage_logs` | Usage tracking for billing |

## Local Development

For local development **without cloud databases**, you can use SQLite:

```bash
# Force SQLite mode for local development
DATABASE_TYPE=sqlite
```

Note: SQLite mode is only for development. Production should always use Supabase.

## Verification

### Check Dashboard Connection

1. Start the dashboard: `cd dashboard && npm run dev`
2. Visit: `http://localhost:3010/diagnostics`
3. Verify "Database Connection" shows "Supabase cloud database connected"

### Check Main App Connection

Run the bot and check logs for:
```
☁️  Initializing Supabase (PostgreSQL) database...
✅ Supabase database initialized
   URL: https://ymxhsdtagnalxebnskst.supabase.co
```

## Troubleshooting

### "Supabase credentials not configured"

Make sure all required environment variables are set:
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`

For the dashboard, also set:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Database Table Errors

If tables don't exist, run the migrations via Supabase:
```bash
# Apply migrations via Supabase CLI
npx supabase db push

# Or apply manually via Supabase dashboard SQL editor
# using files in supabase/migrations/
```

## Security Notes

- Never commit `.env` files
- Use different credentials for development and production
- The `SUPABASE_SERVICE_ROLE_KEY` has full database access - keep it secure
- Rotate credentials if they're ever exposed








