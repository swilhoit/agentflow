import { getPostgresDatabase } from '../src/services/postgresDatabaseService';
import { logger } from '../src/utils/logger';

async function populateAgents() {
  const db = getPostgresDatabase();
  await new Promise(resolve => setTimeout(resolve, 1000));

  const agents = [
    {
      agentName: 'mr-krabs',
      displayName: 'Mr. Krabs Financial Advisor',
      description: 'Personal finance expert using Teller API for real bank account data.',
      agentType: 'discord-bot',
      status: 'active',
      isEnabled: true
    },
    {
      agentName: 'atlas',
      displayName: 'Atlas Global Markets',
      description: 'Global markets expert and macro analyst.',
      agentType: 'discord-bot',
      status: 'active',
      isEnabled: true
    },
    {
      agentName: 'voice-agent',
      displayName: 'Voice Agent (Realtime API)',
      description: 'OpenAI Realtime API voice agent.',
      agentType: 'discord-bot',
      status: 'active',
      isEnabled: true
    },
    {
      agentName: 'market-scheduler',
      displayName: 'Market Update Scheduler',
      description: 'Automated market updates for AI Manhattan Project.',
      agentType: 'scheduler',
      status: 'active',
      isEnabled: true
    },
    {
      agentName: 'supervisor',
      displayName: 'Supervisor Service',
      description: 'Chief of Staff for the agentic framework.',
      agentType: 'service',
      status: 'active',
      isEnabled: true
    }
  ];

  logger.info('Populating agents...');
  for (const agent of agents) {
    await db.upsertAgentConfig({
      ...agent,
      agentType: agent.agentType as any,
      status: agent.status as any,
      config: '{}',
      channelIds: '[]'
    });
    logger.info(`Upserted ${agent.agentName}`);
  }

  logger.info('Done.');
  process.exit(0);
}

populateAgents();

