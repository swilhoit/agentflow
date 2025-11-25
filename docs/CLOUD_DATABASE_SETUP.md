# Cloud Database Setup

AgentFlow is configured for **cloud-first operation**. All data is stored in cloud databases:

- **Main App**: Google Cloud SQL (PostgreSQL)
- **Dashboard**: Supabase (PostgreSQL)

## Required Environment Variables

### Main App (Discord Bot, Agents)

```bash
# Database Configuration - defaults to cloud
DATABASE_TYPE=cloudsql

# Cloud SQL Configuration (PostgreSQL)
CLOUDSQL_INSTANCE_CONNECTION_NAME=agentflow-discord-bot:us-central1:agentflow-db
CLOUDSQL_DATABASE=agentflow
CLOUDSQL_USER=agentflow-user
CLOUDSQL_PASSWORD=<your_password>
```

### Dashboard (Next.js)

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ymxhsdtagnalxebnskst.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>

# Optional: Perplexity API for investment analysis
PERPLEXITY_API_KEY=<your_perplexity_api_key>
```

## Database Schema

### Supabase Tables (Dashboard)

The dashboard uses these Supabase tables:

| Table | Description |
|-------|-------------|
| `profiles` | User profiles and subscriptions |
| `transactions` | Financial transactions |
| `teller_accounts` | Connected bank accounts |
| `teller_enrollments` | Teller API enrollments |
| `market_data` | Stock/crypto market data |
| `market_news` | Financial news articles |
| `weekly_analysis` | Investment thesis analysis |
| `financial_goals` | User financial goals (including loans) |
| `user_watchlists` | Stock watchlist |
| `user_holdings` | Portfolio holdings |

### Cloud SQL Tables (Main App)

The Discord bot uses these Cloud SQL tables:

| Table | Description |
|-------|-------------|
| `conversations` | Discord chat history |
| `agent_logs` | Agent execution logs |
| `agent_tasks` | Agent task tracking |
| `daily_goals` | Daily productivity goals |
| `market_data` | Market data cache |
| `market_news` | News cache |
| `weekly_analysis` | AI-generated analysis |

## Local Development

For local development **without cloud databases**, you can use SQLite:

```bash
# Force SQLite mode for local development
DATABASE_TYPE=sqlite
```

Note: SQLite mode is only for development. Production should always use cloud databases.

## Verification

### Check Dashboard Connection

1. Start the dashboard: `cd dashboard && npm run dev`
2. Visit: `http://localhost:3010/diagnostics`
3. Verify "Database Connection" shows "Supabase cloud database connected"

### Check Main App Connection

Run the bot and check logs for:
```
☁️  Initializing Cloud SQL (PostgreSQL) database...
✅ Cloud SQL database initialized
```

## Troubleshooting

### "Cloud SQL credentials not configured"

Make sure all required environment variables are set:
- `CLOUDSQL_INSTANCE_CONNECTION_NAME`
- `CLOUDSQL_DATABASE`
- `CLOUDSQL_USER`
- `CLOUDSQL_PASSWORD`

### "Supabase environment variables missing"

Make sure these are set in your dashboard `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Database Table Errors

If tables don't exist, run the migration:
```bash
# For Supabase
# Apply migrations via Supabase dashboard or CLI

# For Cloud SQL
npm run migrate:cloudsql
```

## Migration from Local SQLite

If you previously used local SQLite databases:

1. Data in `agentflow.db` and `financial.db` needs to be migrated
2. Use `scripts/migrate-to-cloudsql.ts` for Cloud SQL migration
3. For Supabase, use the migration file in `supabase/migrations/`

## Security Notes

- Never commit `.env` files
- Use different credentials for development and production
- The `SUPABASE_SERVICE_ROLE_KEY` has full database access - keep it secure
- Rotate credentials if they're ever exposed

