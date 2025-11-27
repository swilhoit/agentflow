# Claude Code Containers - Remote Agent Execution

This document explains how to spawn and control Claude Code agents running in isolated Docker containers on Hetzner VPS.

## Overview

The Claude Code Container system allows you to run Claude Code CLI instances in fully isolated Docker containers on your Hetzner VPS. These agents:

- Run in **YOLO mode** with `--dangerously-skip-permissions` for full autonomy
- Execute in isolated containers with resource limits
- Stream real-time output back to Discord
- Can be controlled via voice commands OR text-based agent tools

## Architecture

```
Discord Bot (local/Cloud Run)
    ↓
ClaudeContainerService
    ↓ SSH
Hetzner VPS (178.156.198.233)
    ↓
Docker Container (claude-code image)
    ↓
Claude Code CLI (YOLO mode)
```

## Available Tools

### Via Voice Commands (ElevenLabs Realtime)

| Command | Description |
|---------|-------------|
| `spawn_claude_agent` | Start a Claude Code container with a task |
| `get_claude_status` | Get container running status |
| `get_claude_output` | Get container logs/output |
| `stop_claude_agent` | Stop a running container |
| `list_claude_agents` | List all Claude containers |

### Via Text Agent (ToolBasedAgent)

All the above tools plus:
- `wait_for_claude_agent` - Wait for completion and return result

## Usage Examples

### Voice Commands

```
"Spawn a Claude agent to create a REST API with Express"
"Check status of container claude-agent-abc123"
"Stop the Claude agent"
"List all Claude agents"
```

### Text Commands (via Discord bot or agent)

```
spawn_claude_agent:
  task: "Build a simple todo API with TypeScript"
  workspace_path: "/opt/agentflow/workspace"
  timeout: 600000

get_claude_status:
  container_id: "claude-agent-1234567890-abc123"

get_claude_output:
  container_id: "claude-agent-1234567890-abc123"
  lines: 100

stop_claude_agent:
  container_id: "claude-agent-1234567890-abc123"

list_claude_agents: {}

wait_for_claude_agent:
  container_id: "claude-agent-1234567890-abc123"
  timeout: 600000
```

## Docker Image

The Claude Code container uses `Dockerfile.claude-code`:

```dockerfile
FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    git curl wget openssh-client build-essential python3 jq

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user
RUN useradd -m -u 1001 -s /bin/bash claude

# YOLO mode settings
ENV CLAUDE_CODE_SKIP_PERMISSIONS=true

# Entrypoint with YOLO mode flags
ENTRYPOINT ["claude", "--dangerously-skip-permissions", "--output-format", "stream-json"]
```

## Resource Limits

Each container runs with:
- **Memory**: 4GB
- **CPUs**: 2
- **PIDs limit**: 200
- **Default timeout**: 10 minutes

## First-Time Setup

On first use, the Docker image will be built on the VPS:

1. `Dockerfile.claude-code` is synced to VPS
2. `.claude/settings.json` (YOLO mode config) is synced
3. Image is built with `docker build -t agentflow-claude-code:latest .`

This takes 2-5 minutes and only happens once.

## YOLO Mode Settings

The `.claude/settings.json` file configures full autonomy:

```json
{
  "autoApproval": {
    "enabled": true,
    "tools": {
      "Bash": { "enabled": true, "allowAll": true },
      "Read": { "enabled": true, "allowAll": true },
      "Write": { "enabled": true, "allowAll": true },
      "Edit": { "enabled": true, "allowAll": true }
    },
    "bash": {
      "allowedCommands": ["*"],
      "allowAll": true
    }
  },
  "behavior": {
    "autoConfirm": true,
    "skipWarnings": true
  }
}
```

## Environment Variables

Required in your `.env`:

```bash
# Hetzner VPS Configuration
HETZNER_SERVER_IP=178.156.198.233
HETZNER_SSH_USER=root

# Anthropic API Key (passed to containers)
ANTHROPIC_API_KEY=sk-ant-xxx

# GitHub Token (for repo operations - passed to containers)
GITHUB_TOKEN=ghp_xxx
# or
GH_TOKEN=ghp_xxx
```

## GitHub / Workspace Management

The system includes tools for managing Git repositories on the VPS.

### Available Tools

| Tool | Description |
|------|-------------|
| `clone_repo` | Clone a GitHub repository to a workspace |
| `create_workspace` | Create a new workspace, optionally with GitHub repo |
| `list_workspaces` | List all workspaces on the VPS |
| `push_workspace` | Commit and push changes to GitHub |
| `create_branch` | Create a new git branch |
| `delete_workspace` | Delete a workspace |

### Workflow Example

1. **Clone an existing repo**:
```
clone_repo:
  repo_url: "https://github.com/user/my-project"
```

2. **Spawn Claude agent to work on it**:
```
spawn_claude_agent:
  task: "Add a new REST endpoint for user authentication"
  workspace_path: "/opt/agentflow/workspaces/my-project"
```

3. **Push changes to GitHub**:
```
push_workspace:
  workspace_name: "my-project"
  commit_message: "Add user authentication endpoint"
```

### Creating New Projects

1. **Create workspace with new GitHub repo**:
```
create_workspace:
  workspace_name: "new-api-project"
  create_github_repo: true
  repo_visibility: "private"
```

2. **Claude agent builds the project**:
```
spawn_claude_agent:
  task: "Build a REST API with Express and TypeScript"
  workspace_path: "/opt/agentflow/workspaces/new-api-project"
```

3. **Push to GitHub**:
```
push_workspace:
  workspace_name: "new-api-project"
  commit_message: "Initial API implementation"
```

### Voice Commands

```
"Clone the agentflow repo from GitHub"
"Create a new workspace called my-api with a GitHub repo"
"List all workspaces"
"Push the my-project workspace to GitHub"
```

## Monitoring

### Discord Notifications

You'll receive real-time Discord notifications for:
- Agent start
- Tool usage
- Errors
- Completion

### Container Logs

Get live output with:
```
get_claude_output:
  container_id: "claude-agent-xxx"
  lines: 100
```

### VPS Direct Access

```bash
# SSH to VPS
ssh root@178.156.198.233

# List Claude containers
docker ps -a --filter "name=claude-agent"

# View live logs
docker logs -f claude-agent-xxx

# Stop container
docker stop claude-agent-xxx
```

## Troubleshooting

### Container Won't Start

```bash
# Check VPS connectivity
ssh root@178.156.198.233 echo "connected"

# Verify image exists
ssh root@178.156.198.233 "docker images agentflow-claude-code:latest"

# Check disk space
ssh root@178.156.198.233 "df -h"
```

### Container Times Out

Increase timeout:
```
spawn_claude_agent:
  task: "Long running task..."
  timeout: 1800000  # 30 minutes
```

### No Output Received

```bash
# Check container is running
docker ps --filter "name=claude-agent"

# Get raw logs
docker logs claude-agent-xxx 2>&1
```

## Security Notes

- Containers run as non-root user `claude`
- Each container is isolated
- API keys are passed via environment variables (not stored in image)
- Containers auto-remove (`--rm`) on completion
- Resource limits prevent runaway processes

## Cost

- VPS cost only (no per-container charge)
- Containers share VPS resources
- ~$10-15/month for CPX31 server
