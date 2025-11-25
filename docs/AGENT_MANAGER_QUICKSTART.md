# Agent Manager Quick Start Guide

## What is Agent Manager?

A comprehensive system for managing all agents and their recurring tasks in AgentFlow. It provides:

- **Centralized agent registry** tracking all bots, schedulers, and services
- **Recurring task management** with cron-based scheduling
- **Execution history** with success/failure tracking
- **Beautiful dashboard UI** at `/agents`

## Setup (First Time)

### 1. Run Setup Script

```bash
npm run build
npx ts-node scripts/setup-agent-manager.ts
```

This will:
- Create database tables for agents, tasks, and execution history
- Register all 6 default agents (mr-krabs, atlas, voice-agent, market-scheduler, goals-scheduler, supervisor)
- Register 8 default recurring tasks
- Display a summary

### 2. View Dashboard

Navigate to: **http://localhost:3000/agents**

You'll see:
- All registered agents
- Recurring tasks and schedules
- Execution history
- Performance metrics

## What's Included

### Agents (6 total)

#### Discord Bots
1. **Mr. Krabs** - Personal finance advisor
2. **Atlas** - Global markets expert
3. **Voice Agent** - OpenAI Realtime API

#### Schedulers
4. **Market Scheduler** - AI Manhattan Project updates
5. **Goals Scheduler** - Daily goals check-in

#### Services
6. **Supervisor** - Task health monitoring

### Recurring Tasks (8 total)

#### Market Updates
- **Daily Market Update** - 9:00 AM ET weekdays
- **Market Close Summary** - 4:05 PM ET weekdays
- **Hourly News Check** - Every hour 9-4 PM ET weekdays
- **Weekly Thesis Analysis** - Sundays 6:00 PM ET

#### Supervisor
- **Morning Briefing** - 9:00 AM daily
- **Evening Wrap-up** - 6:00 PM daily
- **Hourly Health Check** - Every hour

#### Goals
- **Daily Goals Check-in** - 8:00 AM PST (disabled by default)

## Dashboard Pages

### `/agents` - Main Overview
- Total agents and stats
- Success rate metrics
- Recent executions
- Agent breakdown by type

### `/agents/tasks` - Recurring Tasks
- All scheduled tasks
- Cron schedules
- Success rates
- Tasks needing attention

### `/agents/executions` - Execution History
- Recent runs with duration
- 24-hour activity timeline
- Failed executions
- Performance metrics

### `/agents/logs` - Agent Activity
- Currently running agents
- Recent task logs
- Error traces
- Detailed results

## Common Tasks

### View All Agents
```typescript
import { AgentManagerService } from './services/agentManager';

const agentManager = new AgentManagerService(client);
const agents = agentManager.getAllAgents();
```

### Register a New Task
```typescript
agentManager.registerRecurringTask({
  taskName: 'My Custom Task',
  agentName: 'my-agent',
  description: 'Does something important',
  cronSchedule: '0 */6 * * *', // Every 6 hours
  timezone: 'America/New_York',
  isEnabled: true,
  config: JSON.stringify({ type: 'custom_task' })
});
```

### Get Task Stats
```typescript
const stats = agentManager.getTaskStats();
console.log(`Success rate: ${(stats.successfulExecutions / stats.totalExecutions * 100).toFixed(1)}%`);
```

### View Execution History
```typescript
const executions = agentManager.getRecentExecutions(50);
executions.forEach(exec => {
  console.log(`${exec.taskName}: ${exec.status} (${exec.duration}ms)`);
});
```

## Monitoring

### Check Task Health

The dashboard automatically highlights tasks that need attention:
- Failed last run
- Never run (but enabled >24h)
- Last run >2 days ago

### View Performance

Each task shows:
- Total runs
- Success/failure count
- Average duration
- Last run time

## Customization

### Add Your Own Agent

1. **Register agent config**:
```typescript
// In agentManager.registerDefaultAgents()
{
  agentName: 'my-agent',
  displayName: 'My Custom Agent',
  description: 'Description of what it does',
  agentType: 'discord-bot', // or 'scheduler' or 'service'
  status: 'active',
  isEnabled: true
}
```

2. **Register task executor**:
```typescript
agentManager.registerTaskExecutor('my-agent', async (task) => {
  // Your task logic here
  return { success: true, message: 'Task completed' };
});
```

3. **Create recurring tasks**:
```typescript
agentManager.registerRecurringTask({
  taskName: 'My Task',
  agentName: 'my-agent',
  description: 'What it does',
  cronSchedule: '0 9 * * *',
  timezone: 'America/New_York',
  isEnabled: true
});
```

## Cron Schedule Examples

```javascript
'0 9 * * 1-5'    // Weekdays at 9 AM
'*/15 * * * *'   // Every 15 minutes
'0 */6 * * *'    // Every 6 hours
'0 0 * * 0'      // Sundays at midnight
'30 14 * * *'    // Daily at 2:30 PM
```

## Troubleshooting

### Task Not Running

1. Check if enabled: **Dashboard → Tasks → Find task**
2. Verify cron schedule is valid
3. Check agent status is "active"
4. Review execution history for errors

### Build Errors

If you get TypeScript errors:
```bash
npm run build
```

If database errors:
```bash
rm data/agentflow.db
npx ts-node scripts/setup-agent-manager.ts
```

## Next Steps

1. **Explore the dashboard** - http://localhost:3000/agents
2. **Review task schedules** - Adjust cron timings as needed
3. **Monitor executions** - Check for failures
4. **Add custom tasks** - Extend with your own automation

## Documentation

- [Full Agent Manager Guide](./AGENT_MANAGER.md)
- [Multi-Agent Architecture](./MULTI_AGENT_ARCHITECTURE.md)
- [Market Updates](./MARKET_UPDATES_README.md)
- [Daily Goals](./DAILY_GOALS_GUIDE.md)

## Support

Having issues? Check:
1. Execution logs in `/agents/executions`
2. Agent logs in `/agents/logs`
3. Full documentation in `docs/AGENT_MANAGER.md`
