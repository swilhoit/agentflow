# Orchestrator Credentials Access Audit

## Current Status

### ✅ What the Orchestrator HAS Access To

1. **Trello API** ✅
   - Passed via `TrelloService` to `ToolBasedAgent`
   - Has full CRUD operations via REST API
   - Keys: `TRELLO_API_KEY` and `TRELLO_API_TOKEN`

2. **Anthropic API (Claude)** ✅
   - Passed to `ToolBasedAgent` constructor
   - Used for Claude Sonnet 4.5 reasoning
   - Key: `ANTHROPIC_API_KEY`

3. **GitHub CLI (`gh`)** ⚠️ **PARTIAL**
   - CLI commands work via `execute_bash` tool
   - BUT: Relies on user's local `gh auth status`
   - No explicit token passed to orchestrator
   - **Problem**: In Docker/cloud deployments, `gh` won't be authenticated!

4. **Google Cloud CLI (`gcloud`)** ⚠️ **PARTIAL**
   - CLI commands work via `execute_bash` tool
   - BUT: Relies on user's local `gcloud auth status`
   - No explicit credentials passed
   - **Problem**: In Docker/cloud deployments, `gcloud` won't be authenticated!

### ❌ What the Orchestrator is MISSING

1. **GitHub API Token** ❌
   - Not passed to orchestrator
   - Should have `GITHUB_TOKEN` or `GH_TOKEN` available
   - Needed for programmatic GitHub API access

2. **Google Cloud Service Account** ❌
   - Not passed to orchestrator
   - Should have `GOOGLE_APPLICATION_CREDENTIALS` or service account JSON
   - Needed for programmatic GCP API access

3. **Environment Variables Not Propagated** ❌
   - When `execute_bash` runs, it doesn't inherit all necessary env vars
   - GitHub and GCloud authentication may not work

## The Problem

When you run commands like:
- `gh repo list`
- `gcloud projects list`

They work on YOUR LOCAL machine because:
1. You've run `gh auth login`
2. You've run `gcloud auth login`
3. Your shell has those credentials cached

But when the orchestrator runs `execute_bash("gh repo list")`, it:
- Runs in a subprocess with limited environment
- May not have access to your `~/.config/gh` or `~/.config/gcloud` directories
- Won't work in Docker containers

## The Solution

### Option 1: Pass Environment Variables (Quick Fix)

Ensure bash commands inherit necessary environment variables:

```typescript
// In toolBasedAgent.ts, executeBash method
const { stdout, stderr } = await execAsync(command, {
  cwd: process.cwd(),
  timeout: 30000,
  maxBuffer: 1024 * 1024 * 10,
  env: {
    ...process.env,  // Inherit all environment variables
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    GH_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    CLOUDSDK_CONFIG: process.env.CLOUDSDK_CONFIG || `${require('os').homedir()}/.config/gcloud`
  }
});
```

### Option 2: Add API Client Tools (Better)

Instead of relying on CLI tools, add native API clients:

```typescript
// New tools to add:
- github_list_repos: Use @octokit/rest
- github_get_repo: Use @octokit/rest  
- github_clone_repo: Use @octokit/rest
- gcp_list_projects: Use @google-cloud/resource-manager
- gcp_deploy: Use @google-cloud/run
```

### Option 3: Docker-Ready Credentials (Production)

For Docker deployments, properly mount credentials:

```dockerfile
# Pass as environment variables
ENV GITHUB_TOKEN=${GITHUB_TOKEN}
ENV GOOGLE_APPLICATION_CREDENTIALS=/secrets/gcp-key.json

# Mount secrets
VOLUME /secrets
```

## Recommended Fix NOW

Let's implement **Option 1** immediately to fix the current environment:

