/**
 * Vercel Health Summary Script
 * Display a health summary of all Vercel deployments
 */

import * as dotenv from 'dotenv';
import { VercelMonitor } from '../src/services/vercelMonitor';
import { logger } from '../src/utils/logger';

dotenv.config();

async function main() {
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token) {
    logger.error('❌ VERCEL_API_TOKEN not configured in .env');
    process.exit(1);
  }

  logger.info('📊 Fetching Vercel deployment health...');

  const monitor = new VercelMonitor({
    token,
    teamId,
  });

  try {
    const health = await monitor.getDeploymentHealth();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 VERCEL DEPLOYMENT HEALTH SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log(`📦 Total Projects: ${health.totalProjects}`);
    console.log(`🚀 Recent Deployments (7d): ${health.recentDeployments}`);
    console.log(`❌ Failed Deployments: ${health.failedDeployments}`);
    console.log(`✅ Success Rate: ${health.successRate}%\n`);

    if (health.projects.length > 0) {
      console.log('📋 PROJECT STATUS:\n');
      
      for (const project of health.projects) {
        const emoji = project.lastDeployment?.state === 'READY' ? '✅'
                    : project.lastDeployment?.state === 'ERROR' ? '❌'
                    : project.lastDeployment?.state === 'BUILDING' ? '🔄'
                    : project.lastDeployment?.state === 'CANCELED' ? '⏸️'
                    : '❓';
        
        const status = project.lastDeployment?.state || 'NO DEPLOYMENTS';
        const time = project.lastDeployment?.created 
          ? project.lastDeployment.created.toLocaleString()
          : 'N/A';
        
        console.log(`  ${emoji} ${project.name}`);
        console.log(`     Status: ${status}`);
        console.log(`     Last Deployed: ${time}`);
        
        if (project.lastDeployment?.url) {
          console.log(`     URL: https://${project.lastDeployment.url}`);
        }
        
        console.log('');
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    logger.error('Failed to fetch health summary:', error.message);
    process.exit(1);
  }
}

main();

