# Multi-Agent Architecture

## Overview

AgentFlow now supports **true multi-agent orchestration** with full task isolation. You can run multiple AI agents simultaneously across different Discord channels, each working on independent tasks without interference.

## Key Features

### ✅ Full Task Isolation
- Each task gets its own dedicated `ToolBasedAgent` instance
- No shared state between agents
- Channel-specific notifications (no cross-contamination)

### ✅ Concurrent Execution
- Run up to 10 agents simultaneously (configurable via `MAX_CONCURRENT_AGENTS`)
- Tasks execute in parallel across different channels
- Independent progress tracking per task

### ✅ Channel-Aware Management
- Start tasks in any channel
- Check status from any channel
- Notifications always go to the correct channel

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Discord Bot                          │
│         (Receives commands from any channel)            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              OrchestratorServer                         │
│           (Multi-Agent Coordinator)                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 TaskManager                             │
│        (Creates isolated agents per task)               │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬──────────────┐
        ▼            ▼            ▼              ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐   ┌─────────┐
   │ Agent 1 │  │ Agent 2 │  │ Agent 3 │   │ Agent N │
   │ Task A  │  │ Task B  │  │ Task C  │   │ Task X  │
   │Channel 1│  │Channel 2│  │Channel 1│   │Channel 3│
   └─────────┘  └─────────┘  └─────────┘   └─────────┘
```

## New Components

### TaskManager (`src/orchestrator/taskManager.ts`)

Central coordinator for multi-agent tasks:

```typescript
interface ManagedTask {
  taskId: string;
  agent: ToolBasedAgent;        // Dedicated agent instance
  task: AgentTask;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  channelId: string;             // Which channel owns this task
  guildId: string;
  userId: string;
  description: string;
  startedAt: Date;
  completedAt?: Date;
  result?: AgentResult;
}
```

**Key Methods:**
- `startTask()` - Create and start a new isolated agent
- `getTaskStatus(taskId)` - Get status of specific task
- `getAllTasks(filters?)` - List tasks (optionally filtered by channel/guild/status)
- `cancelTask(taskId)` - Cancel a running task
- `getStats()` - Get system-wide statistics

### Updated OrchestratorServer

Now uses TaskManager instead of a single shared agent:

**Before (Single Agent):**
```typescript
private toolBasedAgent: ToolBasedAgent;  // Shared across all tasks ❌

// Notification handler gets overwritten on each new task
this.toolBasedAgent.setNotificationHandler(...)
```

**After (Multi-Agent):**
```typescript
private taskManager: TaskManager;  // Creates isolated agents ✅

// Each task gets its own agent with correct channel routing
const taskId = await this.taskManager.startTask(task, description, 'discord');
```

## Discord Commands

### Agent Management Commands

**`!agents` or `!tasks`**
- Lists all tasks in current channel
- Shows running, pending, completed, and failed tasks
- Add `--all` to see tasks from all channels

**`!task-status <taskId>`**
- Get detailed status of a specific task
- Shows duration, iterations, tool calls, and results
- Works across channels (can check any task from anywhere)

**`!cancel-task <taskId>`**
- Cancel a running task
- Immediately stops the agent and marks task as cancelled

**`!help`**
- Shows all available commands
- Explains multi-agent capabilities

### Example Workflow

```
Channel #dev-team
User: "refactor the authentication module"
Bot: ✅ Task task_1234 started

Channel #design-team
User: "optimize all PNG images in /assets"
Bot: ✅ Task task_5678 started

Channel #dev-team
User: !agents
Bot:
  🏃 Running (2):
  • task_1234 - refactor the authentication module (45s)
  • task_5678 - optimize all PNG images in /assets (12s)

Channel #design-team
User: !task-status task_5678
Bot:
  🏃 Task Status
  ID: task_5678
  Status: running
  Description: optimize all PNG images in /assets
  Duration: 15s (running)
```

## API Endpoints

### REST API

**`POST /command`**
- Start a new task
- Creates isolated agent with channel-specific notifications
- Returns immediately with taskId

**`GET /tasks?channelId=...&status=...`**
- List all tasks (with optional filters)
- Returns task array and statistics

**`GET /task/:taskId`**
- Get detailed task status
- Works for both TaskManager and legacy SubAgentManager tasks

**`POST /task/:taskId/cancel`**
- Cancel a running task

**`GET /health`**
- System health check
- Includes TaskManager statistics

## Configuration

**.env Variables:**

```bash
# Maximum concurrent agents (default: 10)
MAX_CONCURRENT_AGENTS=10

# Orchestrator settings
ORCHESTRATOR_URL=http://localhost:3001
ORCHESTRATOR_API_KEY=your_api_key_here

# Notification channel (where system messages go)
SYSTEM_NOTIFICATION_CHANNEL_ID=your_channel_id
```

## Task Lifecycle

1. **Task Created** → TaskManager assigns unique ID, creates isolated agent
2. **Task Running** → Agent executes with channel-specific notifications
3. **Task Monitoring** → OrchestratorServer polls status every 2s
4. **Task Completed** → Summary sent to originating channel
5. **Task Cleanup** → Old completed tasks auto-cleaned after 24h

## Benefits Over Previous Architecture

### Before (Shared Agent)
❌ One agent for all tasks
❌ Notification handler overwritten
❌ Tasks interfere with each other
❌ No channel isolation
❌ Confusing when multiple tasks running

### After (TaskManager)
✅ Isolated agent per task
✅ Channel-specific notifications
✅ True parallel execution
✅ Full task tracking
✅ Can manage agents from any channel

## Error Handling

- **Concurrent Limit Exceeded**: Returns error if max agents reached
- **Task Not Found**: Returns 404 for invalid taskIds
- **Cancelled Tasks**: Marked as cancelled with timestamp
- **Failed Tasks**: Error captured and reported to channel

## Future Enhancements

Potential improvements:
- [ ] Priority queuing for tasks when limit reached
- [ ] Task dependencies (Task B waits for Task A)
- [ ] Agent pooling/reuse for efficiency
- [ ] Persistent task storage (survive restarts)
- [ ] Web dashboard for task visualization
- [ ] Agent communication/collaboration
- [ ] Resource limits per agent (CPU/memory)

## Testing

To test the multi-agent system:

1. **Start the bot**: `npm start`
2. **In Channel #1**: Send task "create a hello world script"
3. **In Channel #2**: Send task "list all files in project"
4. **In Channel #1**: Type `!agents` to see both tasks
5. **In Channel #3**: Type `!agents --all` to see all tasks
6. **Check status**: `!task-status task_xxxxx`
7. **Verify**: Each task's notifications go to correct channel

## Troubleshooting

**Problem**: Tasks not starting
**Solution**: Check `!health` endpoint - might have hit concurrent limit

**Problem**: Notifications going to wrong channel
**Solution**: Ensure `SYSTEM_NOTIFICATION_CHANNEL_ID` is set correctly

**Problem**: Can't see tasks from other channels
**Solution**: Use `!agents --all` flag

## Architecture Diagram (Detailed)

```
User (Channel A) ──┐
User (Channel B) ──┼──> Discord Bot
User (Channel C) ──┘
                    │
                    ├──> Handle Text Message
                    │    │
                    │    └──> POST /command
                    │         (channelId: A, command: "task 1")
                    │
                    ├──> Handle Voice Command
                    │    │
                    │    └──> POST /command
                    │         (channelId: B, command: "task 2")
                    │
                    └──> Handle !agents Command
                         │
                         └──> GET /tasks?channelId=C
                              │
                              └──> Returns filtered task list

                    OrchestratorServer
                         │
                         ▼
                    TaskManager.startTask()
                         │
                    ┌────┴────┐
                    │         │
                    ▼         ▼
               Agent 1    Agent 2
               (Channel A)(Channel B)
                    │         │
                    │         │
                    └────┬────┘
                         │
                    Notifications routed
                    back to correct channels
```

---

**Built with AgentFlow** - Voice-Driven Autonomous AI Coding Platform
