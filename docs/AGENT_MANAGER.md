# Agent Manager Suite

## Overview

The **Agent Manager** is a comprehensive system for managing all agents and recurring tasks in AgentFlow. It provides:

- **Centralized Agent Registry**: Track all bots, schedulers, and services
- **Recurring Task Management**: Schedule, monitor, and execute automated tasks
- **Execution History**: Detailed logs of all task runs with success/failure tracking
- **Dashboard UI**: Beautiful web interface to manage and monitor agents
- **Task Schedulers**: Cron-based scheduling with timezone support

## Architecture

### Components

1. **AgentManagerService** (`src/services/agentManager.ts`)
   - Core service managing agents and recurring tasks
   - Database schema for agent configs, recurring tasks, and execution history
   - Task scheduling with node-cron
   - Task executor registration system

2. **Dashboard UI** (`dashboard/app/agents/`)
   - `/agents` - Main agent overview with stats
   - `/agents/tasks` - Recurring tasks management
   - `/agents/executions` - Task execution history
   - `/agents/logs` - Agent activity logs

3. **Integration Layer** (`src/services/agentManagerIntegration.ts`)
   - Connects Agent Manager with existing schedulers
   - Registers task executors for each agent type
   - Handles task routing and execution

## Registered Agents

### Discord Bots

#### Mr. Krabs (mr-krabs)
**Type:** discord-bot
**Description:** Personal finance expert using Teller API for real bank account data. Provides spending analysis, budgeting, savings goals, and financial advice.

#### Atlas (atlas)
**Type:** discord-bot
**Description:** Global markets expert and macro analyst. Covers Asian/European/EM markets, crypto, geopolitics, and cross-market dynamics.

#### Voice Agent (voice-agent)
**Type:** discord-bot
**Description:** OpenAI Realtime API voice agent for natural voice conversations in Discord.

### Schedulers

#### Market Update Scheduler (market-scheduler)
**Type:** scheduler
**Description:** Automated market updates for AI Manhattan Project thesis portfolio. Daily updates, market close summaries, news checks, and weekly analysis.

**Recurring Tasks:**
- **Daily Market Update** - 9:00 AM ET weekdays
- **Market Close Summary** - 4:05 PM ET weekdays
- **Hourly News Check** - Every hour 9 AM-4 PM ET weekdays
- **Weekly Thesis Analysis** - Sundays at 6:00 PM ET

#### Goals Scheduler (goals-scheduler)
**Type:** scheduler
**Description:** Daily goals check-in system. Prompts users for daily goals and tracks progress over time.

**Recurring Tasks:**
- **Daily Goals Check-in** - 8:00 AM PST (user-specific, configurable)

### Services

#### Supervisor Service (supervisor)
**Type:** service
**Description:** Chief of Staff for the agentic framework. Monitors task health, provides daily briefings, and nudges about forgotten tasks.

**Recurring Tasks:**
- **Morning Briefing** - 9:00 AM daily
- **Evening Wrap-up** - 6:00 PM daily
- **Hourly Health Check** - Every hour

## Database Schema

### agent_configs
Stores configuration for all agents in the system.

```sql
CREATE TABLE agent_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  agent_type TEXT NOT NULL, -- 'discord-bot', 'scheduler', 'service'
  status TEXT NOT NULL,     -- 'active', 'inactive', 'error'
  is_enabled BOOLEAN NOT NULL DEFAULT 1,
  channel_ids TEXT,         -- JSON array of monitored channels
  config TEXT,              -- JSON configuration
  last_active_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

### recurring_tasks
Stores scheduled recurring tasks.

```sql
CREATE TABLE recurring_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_name TEXT UNIQUE NOT NULL,
  agent_name TEXT NOT NULL,
  description TEXT NOT NULL,
  cron_schedule TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  is_enabled BOOLEAN NOT NULL DEFAULT 1,
  last_run_at DATETIME,
  next_run_at DATETIME,
  total_runs INTEGER NOT NULL DEFAULT 0,
  successful_runs INTEGER NOT NULL DEFAULT 0,
  failed_runs INTEGER NOT NULL DEFAULT 0,
  config TEXT,              -- JSON task-specific config
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_name) REFERENCES agent_configs(agent_name)
)
```

### task_executions
Logs every execution of recurring tasks.

```sql
CREATE TABLE task_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  task_name TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL,     -- 'success', 'failed', 'skipped'
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  duration INTEGER,         -- milliseconds
  result TEXT,              -- JSON result data
  error TEXT,
  metadata TEXT,            -- JSON additional data
  FOREIGN KEY (task_id) REFERENCES recurring_tasks(id)
)
```

## Setup & Usage

### Initial Setup

Run the setup script to initialize the Agent Manager and register all recurring tasks:

```bash
npm run setup-agent-manager
```

This will:
1. Initialize database tables
2. Register all default agents
3. Register recurring tasks for existing schedulers
4. Display a summary of configured tasks

### Integration with Main App

The Agent Manager is automatically integrated when starting AgentFlow:

```typescript
import { initializeAgentManager, registerDefaultTasks, startAgentManager } from './services/agentManagerIntegration';

// In your main() function:
const agentManager = initializeAgentManager(
  client,
  config,
  marketScheduler,
  supervisorService,
  trelloService
);

// Register default tasks (idempotent)
registerDefaultTasks(agentManager);

// Start all enabled recurring tasks
startAgentManager(agentManager);

// On shutdown:
stopAgentManager(agentManager);
```

### Task Executors

Each agent registers a task executor function that handles task execution:

```typescript
agentManager.registerTaskExecutor('market-scheduler', async (task: RecurringTask) => {
  const taskConfig = JSON.parse(task.config || '{}');

  switch (taskConfig.type) {
    case 'daily_update':
      await marketScheduler.triggerDailyUpdate();
      return { success: true, message: 'Daily market update completed' };

    case 'market_close':
      await marketScheduler.triggerMarketCloseSummary();
      return { success: true, message: 'Market close summary completed' };

    // ... more task types
  }
});
```

## Dashboard Usage

### Accessing the Dashboard

Navigate to: `http://localhost:3000/agents`

### Key Features

#### Agent Overview (`/agents`)
- Total agents count and status
- Success rate metrics
- Active vs inactive breakdown
- Recent task executions
- Agents grouped by type (bot, scheduler, service)

#### Recurring Tasks (`/agents/tasks`)
- All scheduled tasks by agent
- Task schedules (cron expressions)
- Last run times
- Success/failure counts
- Tasks needing attention (failed or stale)
- Enable/disable individual tasks

#### Task Executions (`/agents/executions`)
- Execution history for all tasks
- Activity timeline (last 24 hours)
- Recent failures with error details
- Duration and performance metrics
- Success rate tracking

#### Agent Logs (`/agents/logs`)
- Currently running agents
- Recent agent activity
- Detailed execution logs
- Error traces
- Task results

## Cron Schedule Examples

```javascript
'0 9 * * 1-5'    // Weekdays at 9:00 AM
'5 16 * * 1-5'   // Weekdays at 4:05 PM
'0 9-16 * * 1-5' // Hourly from 9 AM to 4 PM, weekdays
'0 18 * * 0'     // Sundays at 6:00 PM
'0 9 * * *'      // Daily at 9:00 AM
'0 18 * * *'     // Daily at 6:00 PM
'0 * * * *'      // Every hour
'0 8 * * *'      // Daily at 8:00 AM
```

## Timezone Support

All tasks support timezone configuration. Supported timezones:
- `America/New_York` (Eastern Time)
- `America/Los_Angeles` (Pacific Time)
- `America/Chicago` (Central Time)
- `America/Denver` (Mountain Time)
- `UTC`
- Any valid IANA timezone identifier

## Monitoring & Alerts

### Task Health Monitoring

The system automatically tracks:
- **Success rate** - Percentage of successful executions
- **Failure patterns** - Repeated failures trigger alerts
- **Stale tasks** - Tasks that haven't run when expected
- **Performance** - Execution duration tracking

### Alert Conditions

Tasks appear in "Needs Attention" when:
1. Last execution failed
2. Never run but enabled for >24 hours
3. Last run was >2 days ago (for daily tasks)

## API Reference

### AgentManagerService

#### Methods

```typescript
// Agent Management
getAllAgents(): AgentConfig[]
getAgent(agentName: string): AgentConfig | undefined
updateAgentStatus(agentName: string, status: 'active' | 'inactive' | 'error'): void
setAgentEnabled(agentName: string, isEnabled: boolean): void

// Recurring Tasks
registerRecurringTask(task: Partial<RecurringTask>): number
getAllRecurringTasks(): RecurringTask[]
getAgentRecurringTasks(agentName: string): RecurringTask[]
setRecurringTaskEnabled(taskId: number, isEnabled: boolean): void

// Task Execution
registerTaskExecutor(agentName: string, executor: TaskExecutor): void
scheduleTask(task: RecurringTask): void
unscheduleTask(taskId: number): void
startAllTasks(): void
stopAllTasks(): void

// Execution History
logTaskExecution(execution: Partial<TaskExecution>): number
getTaskExecutionHistory(taskId: number, limit?: number): TaskExecution[]
getRecentExecutions(limit?: number): TaskExecution[]

// Statistics
getTaskStats(): TaskStats
```

## Best Practices

### 1. Task Naming
- Use descriptive, action-oriented names
- Example: "Daily Market Update" not "Market Task"

### 2. Cron Schedules
- Test schedules with a cron validator
- Consider timezone when scheduling
- Avoid overlapping tasks that use the same resources

### 3. Error Handling
- Task executors should throw errors for failures
- Include detailed error messages
- Log context for debugging

### 4. Task Duration
- Keep tasks under 5 minutes when possible
- Use separate tasks for long-running operations
- Monitor execution duration

### 5. Task Configuration
- Use the `config` JSON field for task-specific settings
- Keep config minimal and focused
- Document config schema

## Troubleshooting

### Task Not Running

1. Check if task is enabled: `/agents/tasks`
2. Verify cron schedule is valid
3. Check agent status in `/agents`
4. Review execution history for errors

### Task Failing

1. Check error message in `/agents/executions`
2. Review agent logs in `/agents/logs`
3. Verify task executor is registered
4. Check dependencies (Discord client, API keys, etc.)

### Performance Issues

1. Monitor execution duration in dashboard
2. Check for resource bottlenecks
3. Consider splitting long tasks
4. Review task frequency

## Future Enhancements

- [ ] Task dependency chains
- [ ] Conditional task execution
- [ ] Email/SMS notifications for failures
- [ ] Task execution approval workflow
- [ ] Manual task trigger from dashboard
- [ ] Task templates and duplication
- [ ] Advanced scheduling (business days, holidays)
- [ ] Task priority levels
- [ ] Concurrent execution limits
- [ ] A/B testing for task configurations

## Support

For issues or questions:
1. Check execution logs in `/agents/logs`
2. Review task history in `/agents/executions`
3. Check agent status in `/agents`
4. Review this documentation
5. Check Discord bot logs

## Related Documentation

- [Agent Architecture](./MULTI_AGENT_ARCHITECTURE.md)
- [Market Updates](./MARKET_UPDATES_README.md)
- [Supervisor Service](./SUPERVISOR_README.md)
- [Goals Scheduler](./DAILY_GOALS_GUIDE.md)
