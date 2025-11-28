import { getPostgresDatabase } from '../src/services/postgresDatabaseService';
import { logger } from '../src/utils/logger';

async function checkAgents() {
  try {
    const db = getPostgresDatabase();
    await new Promise(resolve => setTimeout(resolve, 1000));

    const agents = await db.getAllAgentConfigs();
    logger.info(`Found ${agents.length} agents in DB:`);
    agents.forEach(a => logger.info(` - ${a.agent_name} (${a.status})`));

    const tasks = await db.getAllRecurringTasks();
    logger.info(`Found ${tasks.length} recurring tasks in DB.`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAgents();


