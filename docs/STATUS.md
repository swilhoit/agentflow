# Three Bot System Status

## Current Status: RUNNING on Hetzner VPS

All three bots are deployed and running 24/7 on Hetzner VPS.

### Infrastructure
- **Server**: Hetzner VPS (178.156.198.233)
- **Type**: CPX31 (4 vCPU, 8GB RAM)
- **Deployment**: Docker Compose

### Bots Running

| Bot | Container | Port | Channels |
|-----|-----------|------|----------|
| Main Bot | agentflow-bot | 3001 | All except market/finance |
| Atlas | agentflow-atlas | 8082 | #crypto, #global-ai |
| Financial Advisor | agentflow-advisor | 8081 | #finance |

### Quick Commands

```bash
# Check status
./verify-bots.sh

# Deploy updates
./deploy-all-bots.sh

# Restart all
./finish-setup.sh

# View logs
ssh root@178.156.198.233 'docker logs agentflow-bot -f'
ssh root@178.156.198.233 'docker logs agentflow-atlas -f'
ssh root@178.156.198.233 'docker logs agentflow-advisor -f'
```

### Channel Configuration

```
Main Bot:       #general, #agent-chat, #goals, #waterwise, etc.
Atlas:          #crypto, #global-ai
Advisor:        #finance
```

### Testing

- **#crypto**: `btc price?`
- **#finance**: `what's my balance?`
- **#general**: `!help`

---

See `docs/DEPLOYMENT_STATUS.md` for full details.
