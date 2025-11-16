# Autonomous AI Coding Agents - YOLO Mode

## Overview

AgentFlow now features **ultra-powerful autonomous AI coding agents** with full Claude Code capabilities. These agents can:

- ✅ **Read terminal output in real-time** and adapt their approach
- ✅ **Auto-approve all operations** (YOLO mode - no confirmations needed)
- ✅ **Make smart decisions** autonomously based on output analysis
- ✅ **Create multi-step plans** and execute them iteratively
- ✅ **Test and debug** their own code automatically
- ✅ **Recover from errors** intelligently
- ✅ **Run for up to 20 iterations** (configurable) to complete complex tasks

## Architecture

### Components

1. **ClaudeCodeAgent** (`src/agents/claudeCodeAgent.ts`)
   - Executes tasks with full autonomy
   - Monitors terminal output in real-time
   - Makes decisions based on output analysis
   - Handles error recovery automatically

2. **SubAgentManager** (`src/agents/subAgentManager.ts`)
   - Manages multiple concurrent agents
   - Tracks agent status and progress
   - Streams output for monitoring

3. **YOLO Settings** (`.claude/settings.json`)
   - Full auto-approval for all tools
   - No confirmation prompts
   - Maximum permissions enabled

## How It Works

### Execution Flow

```
1. User makes voice request →
2. Voice bot spawns autonomous agent →
3. Agent creates execution plan →
4. Agent executes iteratively:
   - Run Claude Code command
   - Capture terminal output
   - Analyze results
   - Make decision (continue/fix/complete)
   - Repeat if needed
5. Agent runs tests and validation →
6. Returns final result with full report
```

### Decision Making

The agent autonomously decides what to do next by analyzing:

- **Success Indicators**: "successfully implemented", "tests pass", "no errors"
- **Error Indicators**: "Error:", "failed", "exception", "cannot"
- **Progress Indicators**: File modifications, test results, build output

### Error Recovery

When errors occur, the agent:

1. Analyzes the error message
2. Identifies the root cause
3. Applies a fix automatically
4. Re-runs the command
5. Continues execution

## Usage

### Voice Commands

Simply speak naturally to your Discord voice bot:

```
"Implement a user authentication system with JWT tokens"
"Fix the bug in the payment processing code"
"Refactor the database layer to use TypeORM"
"Add unit tests for the API endpoints"
"Deploy my app to Google Cloud with Claude Code enabled"
```

### Programmatic API

```typescript
import { SubAgentManager } from './agents/subAgentManager';

const manager = new SubAgentManager(config);

// Spawn an autonomous agent
const { sessionId, agent } = await manager.spawnClaudeCodeAgent(
  'task_123',
  'Implement a real-time chat feature using WebSockets',
  {
    contextFiles: ['src/server.ts', 'src/types.ts'],
    requirements: [
      'Use Socket.IO library',
      'Support private and group messages',
      'Add typing indicators'
    ],
    maxIterations: 30,
    workingDirectory: '/path/to/project'
  }
);

// Monitor progress
manager.streamAgentOutput(sessionId, (output) => {
  console.log('Agent:', output);
});

// Get status
const status = manager.getAgentStatus(sessionId);
console.log(`Step ${status.currentStep}/${status.totalSteps}`);

// Get final result
const result = await manager.getAgentResult(sessionId);
console.log(result);
```

## Agent Capabilities

### 1. Planning
The agent creates a detailed execution plan:

```json
{
  "analysis": "Need to implement WebSocket chat with Socket.IO",
  "steps": [
    "Install Socket.IO dependencies",
    "Create socket server configuration",
    "Implement message handlers",
    "Add typing indicator logic",
    "Write integration tests"
  ],
  "testing": [
    "Unit test message handlers",
    "Test typing indicators",
    "Integration test full chat flow"
  ],
  "risks": [
    "Socket.IO version compatibility",
    "Concurrent connection handling"
  ]
}
```

### 2. Iterative Execution

Each iteration:
- Executes Claude Code with streaming output
- Monitors terminal in real-time
- Analyzes output for errors/success
- Decides next action autonomously

### 3. Testing & Validation

The agent automatically:
- Runs existing test suites (npm test, pytest, etc.)
- Verifies implementation works
- Checks edge cases
- Validates error handling

### 4. Final Report

Returns comprehensive result:

```typescript
{
  taskId: "agent_1234567890_xyz",
  success: true,
  steps: [
    {
      step: 1,
      action: "Planning task execution",
      status: "completed",
      output: "...",
      timestamp: "2025-01-16T..."
    },
    // ... more steps
  ],
  testResults: [
    {
      name: "WebSocket connection test",
      passed: true,
      output: "All tests passed"
    }
  ],
  duration: 45000, // ms
  filesModified: ["src/socket/server.ts", "src/socket/handlers.ts"]
}
```

## Configuration

### YOLO Settings (`.claude/settings.json`)

```json
{
  "autoApproval": {
    "enabled": true,
    "tools": {
      "Bash": { "enabled": true, "allowAll": true },
      "Read": { "enabled": true, "allowAll": true },
      "Write": { "enabled": true, "allowAll": true },
      "Edit": { "enabled": true, "allowAll": true }
    }
  },
  "permissions": {
    "fileSystem": { "read": true, "write": true, "delete": true, "execute": true },
    "network": { "enabled": true, "allowAll": true },
    "shell": { "enabled": true, "allowAll": true }
  },
  "behavior": {
    "autoConfirm": true,
    "skipWarnings": true,
    "verboseLogging": true,
    "streamOutput": true
  }
}
```

### Environment Variables

Required in `.env`:

```bash
# Anthropic API Key (for Claude Code)
ANTHROPIC_API_KEY=sk-ant-...

# GitHub Token (for repository operations in containers)
GITHUB_TOKEN=ghp_...

# Google Cloud (for deployments)
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
```

## Voice Bot Integration

The voice bot has three new function calls:

### 1. spawn_autonomous_agent

```javascript
{
  task_description: "Build a REST API for user management",
  context_files: ["src/types.ts"],
  requirements: ["Use Express.js", "Add JWT authentication"],
  max_iterations: 25
}
```

### 2. get_agent_status

```javascript
{
  agent_id: "agent_1234567890_xyz"
}
```

### 3. get_agent_result

```javascript
{
  agent_id: "agent_1234567890_xyz"
}
```

## Example Voice Interactions

### Example 1: Feature Implementation

**User**: "Create an autonomous agent to implement a rate limiting system for my API"

**Bot**: "Autonomous agent spawned successfully. Agent ID: agent_1705419234_abc. The agent is working on your task with full autonomy."

**Agent** (autonomously):
1. Plans the implementation (API design, storage, middleware)
2. Installs dependencies (express-rate-limit)
3. Creates rate limiter configuration
4. Implements middleware
5. Adds tests
6. Runs tests (all pass ✅)
7. Returns success report

**Bot**: "Agent completed successfully. Executed 12 steps in 38.5 seconds. Tests: 8/8 passed."

### Example 2: Bug Fixing

**User**: "Spawn an agent to fix the memory leak in the WebSocket server"

**Bot**: "Autonomous agent spawned..."

**Agent** (autonomously):
1. Analyzes the WebSocket server code
2. Identifies the leak (missing event listener cleanup)
3. Implements fix (adds cleanup logic)
4. Runs memory profiler
5. Verifies leak is fixed
6. Adds tests to prevent regression

**Bot**: "Agent completed successfully. Memory leak fixed and validated."

## Advanced Features

### Real-time Output Streaming

Monitor agent output in real-time:

```typescript
manager.streamAgentOutput(sessionId, (data) => {
  if (data.includes('error')) {
    console.warn('⚠️ Error detected:', data);
  } else if (data.includes('test') && data.includes('pass')) {
    console.log('✅ Test passed');
  } else if (data.includes('Writing')) {
    console.log('📝 File modified:', data);
  }
});
```

### Event Handling

```typescript
agent.on('step:started', (step) => {
  console.log(`Step ${step.step}: ${step.action}`);
});

agent.on('warning', (warning) => {
  console.warn(`Warning: ${warning.type}`);
});

agent.on('task:completed', (result) => {
  console.log(`Task ${result.success ? 'succeeded' : 'failed'}`);
});

agent.on('file:modified', (data) => {
  console.log('File change detected:', data);
});
```

### Custom Iteration Logic

Override maximum iterations per task:

```typescript
await manager.spawnClaudeCodeAgent(
  'complex_task',
  'Refactor entire codebase to TypeScript',
  {
    maxIterations: 50  // Allow more iterations for complex tasks
  }
);
```

## Safety & Best Practices

### YOLO Mode Considerations

YOLO mode provides **maximum autonomy** but should be used carefully:

- ✅ **Safe for**: Development environments, sandboxed containers, non-production systems
- ⚠️ **Caution for**: Production systems, shared environments
- ❌ **Not recommended for**: Systems with sensitive data without additional safeguards

### Recommended Safeguards

1. **Run in containers**: Deploy agents in isolated Docker containers
2. **Limit scope**: Provide specific `workingDirectory` parameter
3. **Monitor output**: Stream and log all agent actions
4. **Set iteration limits**: Prevent infinite loops with `maxIterations`
5. **Review results**: Always review agent changes before merging/deploying

## Troubleshooting

### Agent Not Completing

If an agent doesn't complete after max iterations:

1. Check the logs for repeating errors
2. Increase `maxIterations` if task is legitimately complex
3. Provide more specific `requirements`
4. Add relevant `contextFiles` to give the agent more information

### Agent Making Wrong Decisions

If the agent chooses wrong approaches:

1. Provide clearer `task_description`
2. Add specific `requirements` array
3. Include example files in `contextFiles`
4. Review the planning step output to understand agent's thinking

### Terminal Output Not Captured

If you don't see output:

1. Ensure `streamOutput: true` in agent options
2. Check that Claude Code CLI is properly installed
3. Verify `.claude/settings.json` has `verboseLogging: true`

## Performance

Typical performance metrics:

- **Simple tasks** (add function, fix bug): 5-10 seconds, 2-4 iterations
- **Medium tasks** (implement feature): 20-60 seconds, 5-12 iterations
- **Complex tasks** (refactor system): 2-10 minutes, 15-30 iterations

## Future Enhancements

Planned features:

- 🔮 Multi-agent collaboration (agents working together)
- 🔮 Learning from past executions (memory/knowledge base)
- 🔮 Parallel execution of independent tasks
- 🔮 Integration with CI/CD pipelines
- 🔮 Web UI for monitoring agent fleet

## Summary

You now have an **ultra-powerful autonomous coding assistant** that can:

- Work completely autonomously without any confirmations
- Read and understand terminal output in real-time
- Make smart decisions about next steps
- Test and debug its own work
- Recover from errors automatically
- Complete complex multi-step tasks

Just speak to your Discord voice bot and let the autonomous agents do the heavy lifting! 🚀
