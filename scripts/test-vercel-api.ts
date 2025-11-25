/**
 * Test Vercel API Script
 * Test the Vercel API connection and fetch basic information
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
    logger.info('');
    logger.info('To get your Vercel API token:');
    logger.info('1. Go to https://vercel.com/account/tokens');
    logger.info('2. Create a new token');
    logger.info('3. Add it to your .env file as VERCEL_API_TOKEN');
    process.exit(1);
  }

  logger.info('🔍 Testing Vercel API connection...\n');

  const monitor = new VercelMonitor({
    token,
    teamId,
  });

  try {
    // Test 1: Fetch projects
    logger.info('Test 1: Fetching projects...');
    const projects = await monitor.getProjects();
    logger.info(`✅ Found ${projects.length} projects\n`);

    if (projects.length === 0) {
      logger.warn('⚠️  No projects found. Make sure your token has the correct permissions.');
      return;
    }

    // Display project information
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 YOUR VERCEL PROJECTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const project of projects.slice(0, 5)) { // Show first 5 projects
      console.log(`  • ${project.name}`);
      console.log(`    ID: ${project.id}`);
      if (project.framework) {
        console.log(`    Framework: ${project.framework}`);
      }
      if (project.gitRepository) {
        console.log(`    Repository: ${project.gitRepository.repo}`);
      }
      console.log('');
    }

    if (projects.length > 5) {
      console.log(`  ... and ${projects.length - 5} more projects\n`);
    }

    // Test 2: Fetch recent deployments for first project
    const firstProject = projects[0];
    logger.info(`Test 2: Fetching recent deployments for "${firstProject.name}"...`);
    const deployments = await monitor.getDeployments(firstProject.id, 5);
    logger.info(`✅ Found ${deployments.length} recent deployments\n`);

    if (deployments.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🚀 RECENT DEPLOYMENTS FOR "${firstProject.name}":`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      for (const deployment of deployments) {
        const emoji = deployment.state === 'READY' ? '✅'
                    : deployment.state === 'ERROR' ? '❌'
                    : deployment.state === 'BUILDING' ? '🔄'
                    : deployment.state === 'CANCELED' ? '⏸️'
                    : '❓';
        
        console.log(`  ${emoji} ${deployment.state}`);
        console.log(`    URL: https://${deployment.url}`);
        console.log(`    Created: ${new Date(deployment.created).toLocaleString()}`);
        
        if (deployment.meta?.githubCommitSha) {
          console.log(`    Commit: ${deployment.meta.githubCommitSha.substring(0, 7)}`);
        }
        
        if (deployment.target) {
          console.log(`    Target: ${deployment.target.toUpperCase()}`);
        }
        
        console.log('');
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    logger.info('✅ All tests passed! Vercel API is working correctly.');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Set VERCEL_ALERT_CHANNEL_ID in your .env file');
    logger.info('2. Enable monitoring: VERCEL_MONITORING_ENABLED=true');
    logger.info('3. Restart your bot to start monitoring deployments');

  } catch (error: any) {
    logger.error('❌ Test failed:', error.message);
    logger.info('');
    logger.info('Common issues:');
    logger.info('• Invalid or expired API token');
    logger.info('• Token does not have required permissions');
    logger.info('• Network connectivity issues');
    process.exit(1);
  }
}

main();

