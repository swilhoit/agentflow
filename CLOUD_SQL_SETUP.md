# Google Cloud SQL Database Setup

## ✅ Completed Setup

Your AgentFlow database is now running on **Google Cloud SQL (PostgreSQL)** with automatic backups!

### 📊 Database Information

- **Instance Name:** `agentflow-db`
- **Connection Name:** `agentflow-discord-bot:us-central1:agentflow-db`
- **Database:** `agentflow`
- **User:** `agentflow-user`
- **Region:** `us-central1`
- **Engine:** PostgreSQL 15
- **Instance Type:** `db-f1-micro` (shared CPU, 614 MB RAM)
- **Storage:** 10GB SSD
- **Backups:** Daily at 3:00 AM UTC (7-day retention)

### 🔐 Credentials

Database passwords are stored in: `/Volumes/LaCie/WEBDEV/agentflow/data/.db-credentials`

**IMPORTANT:** Add these credentials to your `.env` file (see Configuration below).

## 🗄️ Database Schema

The following tables have been migrated to Cloud SQL:

1. **conversations** - Discord conversation history
2. **agent_logs** - Agent execution logs
3. **agent_tasks** - Agent task tracking
4. **daily_goals** - User daily goals
5. **market_data** - Ticker prices and performance (AI Manhattan Project)
6. **market_news** - News articles for tracked tickers
7. **weekly_analysis** - AI-generated thesis analysis reports

## ⚙️ Configuration

### 1. Update Your `.env` File

Add the following to your `.env` file:

```bash
# Database Configuration
DATABASE_TYPE=cloudsql

# Cloud SQL Configuration (PostgreSQL)
CLOUDSQL_INSTANCE_CONNECTION_NAME=agentflow-discord-bot:us-central1:agentflow-db
CLOUDSQL_DATABASE=agentflow
CLOUDSQL_USER=agentflow-user
CLOUDSQL_PASSWORD=<your_password_from_.db-credentials>
```

**Get your password:**
```bash
cat data/.db-credentials
# Use the password on line 2
```

### 2. Switch Between SQLite and Cloud SQL

You can easily switch between local SQLite (for development) and Cloud SQL (for production):

**For Local Development (SQLite):**
```bash
DATABASE_TYPE=sqlite
```

**For Production/Cloud (PostgreSQL):**
```bash
DATABASE_TYPE=cloudsql
```

## 📈 Cost Estimate

Current configuration cost:

- **Cloud SQL Instance (db-f1-micro):** ~$9/month
- **10GB SSD Storage:** ~$1.70/month
- **Backups (70GB max over 7 days):** ~$0.20/month
- **Estimated Total:** ~$11/month

### Cost Optimization Tips

1. **Stop instance when not in use:**
   ```bash
   gcloud sql instances patch agentflow-db --activation-policy=NEVER
   gcloud sql instances patch agentflow-db --activation-policy=ALWAYS  # to restart
   ```

2. **Reduce backup retention** (if 7 days is too much):
   ```bash
   gcloud sql instances patch agentflow-db --retained-backups-count=3
   ```

3. **Use Cloud Run** (only runs when needed, can scale to zero)

## 🔧 Management Commands

### View Instance Details
```bash
gcloud sql instances describe agentflow-db
```

### List Databases
```bash
gcloud sql databases list --instance=agentflow-db
```

### View Backups
```bash
gcloud sql backups list --instance=agentflow-db
```

### Create Manual Backup
```bash
gcloud sql backups create --instance=agentflow-db
```

### Connect via Cloud SQL Proxy (for local development)
```bash
# Install Cloud SQL Proxy
gcloud components install cloud_sql_proxy

# Run proxy (in separate terminal)
cloud_sql_proxy agentflow-discord-bot:us-central1:agentflow-db

# Connect with psql
psql "host=127.0.0.1 sslmode=disable dbname=agentflow user=agentflow-user"
```

### Connect via psql Directly
```bash
gcloud sql connect agentflow-db --user=agentflow-user --database=agentflow
```

## 📊 Monitoring

### View Logs
```bash
gcloud sql operations list --instance=agentflow-db --limit=10
```

### Check Current Usage
```bash
gcloud sql instances describe agentflow-db --format="table(
  name,
  state,
  databaseVersion,
  currentDiskSize,
  settings.dataDiskSizeGb
)"
```

### Monitor in Google Cloud Console
Visit: https://console.cloud.google.com/sql/instances/agentflow-db/overview?project=agentflow-discord-bot

## 🔄 Data Migration

### Export Data from SQLite to Cloud SQL

If you have existing data in SQLite that you want to migrate:

```bash
# 1. Export SQLite to SQL dump
sqlite3 data/agentflow.db .dump > sqlite_dump.sql

# 2. Convert SQLite SQL to PostgreSQL format
# (Manual conversion needed - SQLite and PostgreSQL have syntax differences)

# 3. Import to Cloud SQL
gcloud sql import sql agentflow-db gs://your-bucket/postgresql_dump.sql \
  --database=agentflow
```

### Sync Data Between Local and Cloud

For development, you can periodically sync:

```bash
# Backup Cloud SQL to local file
pg_dump -h 127.0.0.1 -U agentflow-user agentflow > cloud_backup.sql

# Restore to local SQLite (after conversion)
sqlite3 data/agentflow.db < converted_backup.sql
```

## 🚨 Troubleshooting

### Connection Issues

**Error: "permission denied"**
```bash
# Ensure your Google Cloud credentials are set
gcloud auth application-default login
```

**Error: "instance not found"**
```bash
# Verify instance is running
gcloud sql instances describe agentflow-db
```

**Error: "connection timeout"**
```bash
# Check if Cloud SQL Admin API is enabled
gcloud services enable sqladmin.googleapis.com
```

### Performance Issues

**Slow queries:**
```sql
-- Check active connections
SELECT * FROM pg_stat_activity;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Need more resources:**
```bash
# Upgrade to larger instance (db-g1-small = 1.7GB RAM)
gcloud sql instances patch agentflow-db --tier=db-g1-small
```

## 🔒 Security Best Practices

1. **Never commit `.env` file** - Already in `.gitignore`
2. **Rotate passwords regularly:**
   ```bash
   gcloud sql users set-password agentflow-user \
     --instance=agentflow-db \
     --password=NEW_PASSWORD
   ```
3. **Use IAM authentication** (advanced):
   ```bash
   gcloud sql users create IAM_USER \
     --instance=agentflow-db \
     --type=cloud_iam_user
   ```
4. **Enable SSL** (for production):
   ```bash
   gcloud sql instances patch agentflow-db \
     --require-ssl
   ```

## 🎯 Next Steps

1. ✅ Cloud SQL instance created
2. ✅ Database schema migrated
3. ⏳ **Update your `.env` file** with Cloud SQL credentials
4. ⏳ **Test the connection** by running the bot
5. ⏳ **Deploy to Cloud Run** for fully cloud-hosted operation

## 📚 Additional Resources

- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Cloud SQL Pricing](https://cloud.google.com/sql/pricing)
- [PostgreSQL 15 Docs](https://www.postgresql.org/docs/15/index.html)
- [Cloud SQL Best Practices](https://cloud.google.com/sql/docs/postgres/best-practices)

---

## 🌐 Hybrid Mode (Recommended for Development)

For the best of both worlds:

- **Development:** Use `DATABASE_TYPE=sqlite` (fast, local, no cost)
- **Production/Deployment:** Use `DATABASE_TYPE=cloudsql` (reliable, backed up, accessible from anywhere)

The application will automatically use the correct database based on your `DATABASE_TYPE` environment variable!
