# Command Execution Bug Fix

## Issue Summary
The agent was saying it would execute bash commands (like `gh repo list`) but never actually running them. The agent would respond with "I'll execute this command now..." but then nothing would happen - no sub-agent would spawn and no command would execute.

## Root Cause
Found in `src/orchestrator/orchestratorServer.ts:88-98`

**The Problem:**
When `[SUB_AGENT_REQUIRED]` was detected in the Claude response, the code would:
1. Extract `executionPlan` (array of step descriptions like "Execute gh repo list command")
2. Extract `bashCommands` (array of actual bash commands like `gh repo list --limit 100`)
3. Pass both arrays to `spawnAgents()`

However, these two arrays were **misaligned**:
- `executionPlan` might have 3 items: ["Analyze request", "Execute command", "Report results"]
- `bashCommands` might have 1 item: ["gh repo list --limit 100"]

When `spawnAgents()` tried to pair them up by index, it would create:
- Agent 1: task="Analyze request", command=`gh repo list --limit 100` ✅ (worked)
- Agent 2: task="Execute command", command=`undefined` ❌ (failed silently)
- Agent 3: task="Report results", command=`undefined` ❌ (failed silently)

The agents with `undefined` commands would be created but do nothing.

## The Fix
Changed `orchestratorServer.ts` to:
1. Only spawn agents when bash commands are actually extracted
2. Create task descriptions directly from the bash commands themselves
3. Ensure 1:1 mapping between task descriptions and bash commands
4. Add logging to show when agents are spawned and when commands are missing

**Before:**
```typescript
if (response.agentIds && response.agentIds.length > 0) {
  const agentTasks = response.executionPlan || [];
  const spawnedAgents = await this.subAgentManager.spawnAgents(
    response.taskId,
    agentTasks,      // <- Misaligned with bashCommands!
    bashCommands
  );
}
```

**After:**
```typescript
if (response.agentIds && response.agentIds.length > 0 && bashCommands.length > 0) {
  // Create task descriptions for each bash command
  const taskDescriptions = bashCommands.map((cmd, idx) =>
    `Execute command: ${cmd.substring(0, 100)}${cmd.length > 100 ? '...' : ''}`
  );

  logger.info(`Spawning ${bashCommands.length} sub-agent(s) for command execution`);

  const spawnedAgents = await this.subAgentManager.spawnAgents(
    response.taskId,
    taskDescriptions,  // <- Now aligned 1:1 with bashCommands!
    bashCommands
  );

  logger.info(`✅ Spawned ${spawnedAgents.length} sub-agent(s) successfully`);
} else if (response.agentIds && response.agentIds.length > 0 && bashCommands.length === 0) {
  logger.warn('⚠️ Sub-agents required but no bash commands extracted from response');
}
```

## Testing Instructions

### Test 1: Simple Command Execution
Send to Discord bot:
```
list my github projects
```

**Expected behavior:**
1. Bot responds: "I'll list your GitHub repositories."
2. Bot extracts command: `gh repo list --limit 100`
3. Bot spawns 1 sub-agent
4. Sub-agent executes the command
5. Bot returns the list of repositories

**How to verify:**
- Check logs for: `Spawning 1 sub-agent(s) for command execution`
- Check logs for: `✅ Spawned 1 sub-agent(s) successfully`
- Check logs for: `Executing command: gh repo list --limit 100`
- Bot should actually return repository data

### Test 2: Multiple Commands
Send to Discord bot:
```
check my github auth status and list my repos
```

**Expected behavior:**
1. Bot responds with plan for 2 commands
2. Bot extracts 2 bash commands
3. Bot spawns 2 sub-agents
4. Both commands execute
5. Bot returns combined results

### Test 3: Command with No Bash
Send to Discord bot:
```
what is 2 + 2
```

**Expected behavior:**
1. Bot responds directly with answer
2. No sub-agents spawned (no bash commands needed)
3. Simple response returned

## Monitoring
Watch the log file to see the fix in action:
```bash
tail -f /tmp/agentflow.log | grep -E "(Spawning|sub-agent|Executing command)"
```

## Files Modified
- `src/orchestrator/orchestratorServer.ts` - Fixed agent spawning logic

## Status
- ✅ Bug identified
- ✅ Root cause analyzed
- ✅ Fix implemented
- ✅ Code rebuilt
- ✅ Bot restarted
- ⏳ Ready for testing

## Next Steps
1. Test with "list my github projects" command
2. Verify sub-agent spawns and executes
3. Confirm command output is returned
4. Test with other bash commands (gcloud, git, etc.)
