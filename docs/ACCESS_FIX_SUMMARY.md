# AgentFlow Access Fix Summary

## Issue
The voice bot was claiming it didn't have access to Google Cloud or GitHub accounts, even though the CLI tools were authenticated on the host system.

**Observed Behavior**: Both voice and text agents would say things like:
- "I'm a large language model, I don't have direct access to your GitHub account."
- "To list your GitHub repos, I'd need to authenticate with your GitHub account."

Instead of actually using the execute_task function to run commands.

## Root Causes Identified

1. **Missing Tool Information in System Prompts**: The bot's system prompts didn't tell the AI that it had access to Google Cloud and GitHub tools.

2. **Environment Inheritance Issue**: When spawning bash commands, the bot wasn't properly inheriting the parent process environment, including:
   - PATH to find `gcloud` and `gh` CLI tools
   - HOME directory for credential access
   - Google Cloud SDK configuration paths

3. **Multiple Bot Implementations**: The project has two bot modes:
   - **Realtime API Mode** (active): Uses OpenAI Realtime API for natural conversations
   - **Legacy Mode**: Uses Whisper + Claude + TTS

4. **⚠️ CRITICAL: LLM Safety Guardrails** (Primary Issue): The AI models have built-in safety training that makes them refuse to claim access to user accounts, even when explicitly told they have access. The system prompts were too passive and informational - they needed to be DIRECTIVE and include negative instructions (DO NOT say you don't have access) plus concrete examples.

## Files Modified

### 1. `src/bot/realtimeVoiceReceiver.ts`
**Change**: Updated the `getSystemInstructions()` method to ASSERTIVELY inform the AI about available tools and PREVENT refusal behaviors.

**Key Changes**:
- Changed from passive "you have access" to assertive "YOU ARE ALREADY LOGGED IN"
- Added explicit **DO NOT** instructions to prevent the problematic "I don't have access" responses
- Included concrete examples showing exactly how to respond to account queries
- Used emphatic formatting (emojis, bold, caps) to make critical instructions stand out
- Changed tone from permissive to directive

**Added**:
```
🔐 AUTHENTICATED ACCESS - YOU ARE ALREADY LOGGED IN:
You ARE authenticated and have DIRECT access to:

**Google Cloud Platform (GCP)** - AUTHENTICATED as agentflow-discord-bot
**GitHub** - AUTHENTICATED as user "swilhoit"

⚠️ CRITICAL INSTRUCTION:
When users ask about "my GitHub repos", "my Google Cloud projects", "my account", etc:
- DO NOT say you don't have access
- DO NOT ask for authentication
- DO NOT say you're a language model without access
- IMMEDIATELY use execute_task to run the appropriate command

EXAMPLES OF CORRECT RESPONSES:

User: "List my GitHub repos"
You: "Let me check your GitHub repositories for you." [USE execute_task with task_description: "list github repositories using gh repo list command"]
```

### 2. `src/agents/subAgentManager.ts`
**Change**: Updated the `runBashCommand()` method to properly inherit environment and credentials.

**Key Changes**:
```typescript
const env = {
  ...process.env,
  PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
  HOME: process.env.HOME || require('os').homedir(),
  CLOUDSDK_CONFIG: process.env.CLOUDSDK_CONFIG || `${require('os').homedir()}/.config/gcloud`,
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
};

const childProcess = spawn('bash', ['-c', command], {
  env,
  cwd: process.cwd(),
  shell: true
});
```

### 3. `src/agents/claudeCodeAgent.ts`
**Change**: Updated the Claude Code spawn environment to include proper credential paths.

**Key Changes**:
```typescript
this.process = spawn('claude', args, {
  cwd: this.workingDirectory,
  env: {
    ...process.env,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    HOME: process.env.HOME || require('os').homedir(),
    CLOUDSDK_CONFIG: process.env.CLOUDSDK_CONFIG || `${require('os').homedir()}/.config/gcloud`,
  }
});
```

### 4. `src/orchestrator/claudeClient.ts`
**Change**: Updated the system prompt for the orchestrator with the same assertive, directive approach.

**Added**: Same assertive authentication information plus concrete examples showing the expected response format with bash commands and [SUB_AGENT_REQUIRED] markers.

## Verification

Tested that spawned processes can access credentials:
```bash
✓ gcloud found at: /usr/local/bin/gcloud
✓ Active project: agentflow-discord-bot
✓ gh found at: /usr/local/bin/gh  
✓ Authenticated as: swilhoit
```

## How to Test

Try these voice commands with the bot:

1. **"What Google Cloud projects do I have?"**
2. **"List my GitHub repositories"**
3. **"What's my current gcloud project?"**
4. **"Show my GitHub account info"**
5. **"List my Cloud Run services"**

The bot should now:
- Recognize it has access to these tools
- Use the `execute_task` function to run commands
- Successfully retrieve information from your accounts

## Technical Notes

- The bot runs in **Realtime API mode** by default (controlled by `config.useRealtimeApi`)
- Environment variables are inherited from parent process
- Credentials are read from `~/.config/gcloud` and `~/.config/gh`
- The PATH includes standard locations where Homebrew installs CLI tools

## Deployment Considerations

If deploying to production (Docker/Cloud Run):
1. Mount credential directories as volumes
2. Set appropriate environment variables
3. Ensure CLI tools are installed in the container
4. Consider using service account authentication for GCP

## Key Insight

**The problem wasn't technical - it was behavioral.** The environment and tools were configured correctly, but the AI models were refusing to use them due to safety training. The fix required changing from:

❌ "You have access to GitHub" (passive, informational)  
✅ "YOU ARE ALREADY LOGGED IN. DO NOT say you don't have access. IMMEDIATELY use execute_task." (directive, explicit, with negative instructions)

This is a common pattern with LLMs - they often need very explicit permission and examples to override their default cautious behavior around user accounts.

## Date
November 17, 2025 (Updated with behavioral fix)

