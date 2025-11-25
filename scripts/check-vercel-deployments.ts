/**
 * Check Vercel Deployments Script
 * Manually trigger a check for failed Vercel deployments
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

  logger.info('🔍 Checking Vercel deployments...');

  const monitor = new VercelMonitor({
    token,
    teamId,
  });

  // Reset to check last 24 hours
  monitor.resetLastChecked(24);

  try {
    const failures = await monitor.checkFailedDeployments();

    if (failures.length === 0) {
      logger.info('✅ No failed deployments found in the last 24 hours');
    } else {
      logger.warn(`⚠️  Found ${failures.length} failed deployments:`);
      
      for (const failure of failures) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Project: ${failure.project.name}`);
        console.log(`Deployment ID: ${failure.deployment.uid}`);
        console.log(`Status: ${failure.deployment.state}`);
        console.log(`URL: https://${failure.deployment.url}`);
        console.log(`Time: ${failure.errorTime.toLocaleString()}`);
        
        if (failure.deployment.meta?.githubCommitSha) {
          console.log(`Commit: ${failure.deployment.meta.githubCommitSha.substring(0, 7)}`);
          console.log(`Author: ${failure.deployment.meta.githubCommitAuthorName}`);
          console.log(`Message: ${failure.deployment.meta.githubCommitMessage}`);
        }
        
        if (failure.deployment.aliasError) {
          console.log(`Error: ${failure.deployment.aliasError.message}`);
        }
        
        if (failure.duration) {
          const seconds = Math.floor(failure.duration / 1000);
          console.log(`Duration: ${seconds}s`);
        }
      }
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

  } catch (error: any) {
    logger.error('Failed to check deployments:', error.message);
    process.exit(1);
  }
}

main();

