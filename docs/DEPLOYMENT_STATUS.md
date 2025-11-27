# Three-Bot System Deployment Status

## Current Status: LIVE on Hetzner VPS

**Last Updated**: November 26, 2025

---

## Bot Status Overview

### 1. Main Bot (General Assistant)
- **Status**: Running on Hetzner VPS
- **Container**: agentflow-bot
- **Port**: 3001
- **Purpose**: General tasks, coding, voice AI
- **Channels**: All except #crypto, #global-ai, #finance

### 2. Atlas Bot (Market Intelligence)
- **Status**: Running on Hetzner VPS
- **Container**: agentflow-atlas
- **Port**: 8082 (internal)
- **Purpose**: Market analysis, crypto, global markets
- **Channels**: #crypto, #global-ai

### 3. Financial Advisor Bot (Personal Finance)
- **Status**: Running on Hetzner VPS
- **Container**: agentflow-advisor
- **Port**: 8081 (internal)
- **Purpose**: Personal finance using real bank account data
- **Channels**: #finance

---

## Infrastructure

**Server**: Hetzner VPS
- **IP**: 178.156.198.233
- **Type**: CPX31 (4 vCPU, 8GB RAM)
- **Location**: Ashburn, VA
- **OS**: Docker on Ubuntu

**Deployment**:
- Docker Compose (docker-compose.production.yml)
- All 3 bots run as separate containers
- Automatic restart on failure
- Health checks for monitoring

---

## Useful Commands

### Check Status
```bash
# Run verification script
./verify-bots.sh

# Or manually check containers
ssh root@178.156.198.233 'docker ps'
```

### View Logs
```bash
ssh root@178.156.198.233 'docker logs agentflow-bot -f'
ssh root@178.156.198.233 'docker logs agentflow-atlas -f'
ssh root@178.156.198.233 'docker logs agentflow-advisor -f'
```

### Restart Services
```bash
# Restart all
./finish-setup.sh

# Or restart specific container
ssh root@178.156.198.233 'docker restart agentflow-bot'
```

### Deploy Updates
```bash
# Full deployment with rebuild
./deploy-all-bots.sh

# Or quick restart
./finish-setup.sh
```

---

## Testing Commands

### Main Bot (in #general or any non-market channel)
```
!help
!status
!agents
```

### Atlas (in #crypto or #global-ai)
```
btc price?
show me the AI Manhattan portfolio
deep dive on CCJ
china economic outlook
uranium sector analysis
```

### Financial Advisor (in #finance)
```
what's my balance?
how much did I spend on dining?
can I afford a $5000 vacation in 6 months?
what's my net worth?
```

---

## Architecture

```
Hetzner VPS (178.156.198.233)
├── agentflow-bot      (Main Bot)      → Port 3001
├── agentflow-atlas    (Atlas)         → Port 8082
└── agentflow-advisor  (Advisor)       → Port 8081
```

All bots share:
- Same .env file
- Same Supabase database
- Same network (agentflow-network)

---

## Cost Summary

**Hetzner VPS**: ~$10-15/month (CPX31)
- All three bots on one server
- Much more cost-effective than Cloud Run
- Fixed monthly cost

**APIs**:
- Perplexity API: $1.50-9/month
- Anthropic API: $3-10/month

**Total**: ~$15-35/month for 24/7 intelligent bot system

---

## Troubleshooting

### Container won't start
```bash
# Check logs
ssh root@178.156.198.233 'docker logs agentflow-bot --tail 100'

# Rebuild and restart
./deploy-all-bots.sh
```

### Health check failing
```bash
# Check health endpoint
curl http://178.156.198.233:3001/health

# Check internal health
ssh root@178.156.198.233 'docker exec agentflow-atlas wget -q -O- http://localhost:8082/health'
```

### Bot not responding in Discord
1. Check container is running: `./verify-bots.sh`
2. Check logs for errors
3. Verify Discord tokens in .env
4. Restart containers: `./finish-setup.sh`
