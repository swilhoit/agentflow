# AgentFlow Hetzner Deployment Guide

This guide explains how to deploy Docker containers to Hetzner VPS, directly from your voice bot or via scripts.

## Quick Start

### 1. Install Hetzner Cloud CLI

```bash
# macOS
brew install hcloud

# Or download from:
# https://github.com/hetznercloud/cli/releases
```

### 2. Configure hcloud

```bash
# Create a context (one-time setup)
hcloud context create agentflow

# Enter your API token when prompted
# Get token from: https://console.hetzner.cloud/projects/YOUR_PROJECT/security/tokens
```

### 3. Your VPS is Already Running

The AgentFlow bots are deployed on:

```
Server IP: 178.156.198.233
Server Type: CPX31 (4 vCPU, 8GB RAM)
Location: Ashburn, VA
```

## Deploy via Voice Bot

Just say:

```
"Deploy my-app to Hetzner"
"List my containers on Hetzner"
"Show logs for my-app"
"Delete the test-container"
```

## Deploy via Scripts

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

## Manual Deployment

### Deploy a New Container

```bash
# SSH into the server
ssh root@178.156.198.233

# Navigate to deployment directory
cd /opt/deployments/my-app

# Build and run
docker build -t my-app .
docker run -d --name my-app --restart unless-stopped -p 8080:8080 my-app
```

### Sync Code and Deploy

```bash
# Sync code to server
rsync -avz --exclude 'node_modules' --exclude '.git' . root@178.156.198.233:/opt/deployments/my-app/

# SSH and build
ssh root@178.156.198.233 "cd /opt/deployments/my-app && docker build -t my-app . && docker stop my-app || true && docker rm my-app || true && docker run -d --name my-app --restart unless-stopped -p 8080:8080 my-app"
```

## Managing Containers

### List Running Containers

```bash
ssh root@178.156.198.233 'docker ps'
```

### View Logs

```bash
ssh root@178.156.198.233 'docker logs my-app -f'
```

### Restart Container

```bash
ssh root@178.156.198.233 'docker restart my-app'
```

### Stop and Remove

```bash
ssh root@178.156.198.233 'docker stop my-app && docker rm my-app'
```

## Environment Variables

Add these to your `.env`:

```bash
# Hetzner VPS Configuration
HETZNER_SERVER_IP=178.156.198.233
HETZNER_SSH_USER=root
```

## Current Deployments

| Container | Port | Purpose |
|-----------|------|---------|
| agentflow-bot | 3001 | Main voice bot |
| agentflow-atlas | 8082 | Market intelligence |
| agentflow-advisor | 8081 | Financial advisor |

## Cost

- **CPX31**: ~$10-15/month
- Fixed cost, no per-request charges
- All three bots on one server

## Troubleshooting

### Can't SSH to Server

```bash
# Check SSH key is added
ssh-add -l

# Test connection
ssh -v root@178.156.198.233 echo "connected"
```

### Container Won't Start

```bash
# Check logs
ssh root@178.156.198.233 'docker logs my-app --tail 100'

# Check if port is in use
ssh root@178.156.198.233 'netstat -tlnp | grep 8080'
```

### Out of Disk Space

```bash
# Clean up Docker
ssh root@178.156.198.233 'docker system prune -a'
```

## Creating a New Server

If you need a new isolated server:

```bash
# Create server
hcloud server create --name my-new-server --type cpx11 --image docker-ce --location ash --ssh-key default

# Get IP
hcloud server ip my-new-server
```

## Security

- SSH key authentication only (no passwords)
- Firewall rules configured via Hetzner console
- Containers run with `--restart unless-stopped`
- Health checks in docker-compose.production.yml
