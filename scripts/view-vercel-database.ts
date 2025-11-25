/**
 * View Vercel Database Script
 * Query and view all deployment data stored in the database
 */

import * as dotenv from 'dotenv';
import { VercelDatabaseService } from '../src/services/vercelDatabase';
import { logger } from '../src/utils/logger';

dotenv.config();

async function main() {
  const db = new VercelDatabaseService();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 VERCEL DATABASE - DEPLOYMENT DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get all projects
  const projects = db.getAllProjects();
  console.log(`📦 Total Projects: ${projects.length}\n`);

  if (projects.length === 0) {
    console.log('⚠️  No projects found in database.');
    console.log('   Run a deployment check first: npm run vercel:check\n');
    return;
  }

  // Show each project with stats
  for (const project of projects) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 Project: ${project.name}`);
    console.log(`   ID: ${project.project_id}`);
    if (project.framework) {
      console.log(`   Framework: ${project.framework}`);
    }
    if (project.git_repo) {
      console.log(`   Repository: ${project.git_repo}`);
    }
    console.log(`   Last Updated: ${project.updated_at.toLocaleString()}`);
    console.log('');

    // Get stats
    const stats = db.getProjectStats(project.project_id, 7);
    console.log('   📈 Last 7 Days:');
    console.log(`      Total Deployments: ${stats.totalDeployments}`);
    console.log(`      ✅ Successful: ${stats.successfulDeployments}`);
    console.log(`      ❌ Failed: ${stats.failedDeployments}`);
    console.log(`      ⏸️  Canceled: ${stats.canceledDeployments}`);
    console.log(`      🔄 Building: ${stats.buildingDeployments}`);
    console.log(`      Success Rate: ${stats.successRate}%`);
    
    if (stats.averageDuration) {
      const avgSeconds = Math.round(stats.averageDuration / 1000);
      const avgMinutes = Math.floor(avgSeconds / 60);
      const avgSecs = avgSeconds % 60;
      console.log(`      Avg Duration: ${avgMinutes}m ${avgSecs}s`);
    }
    
    if (stats.lastDeploymentAt) {
      console.log(`      Last Deployment: ${stats.lastDeploymentAt.toLocaleString()}`);
    }
    console.log('');

    // Get recent deployments
    const deployments = db.getProjectDeployments(project.project_id, 5);
    
    if (deployments.length > 0) {
      console.log('   📋 Recent Deployments:');
      
      for (const dep of deployments) {
        const emoji = dep.state === 'READY' ? '✅'
                    : dep.state === 'ERROR' ? '❌'
                    : dep.state === 'BUILDING' ? '🔄'
                    : dep.state === 'CANCELED' ? '⏸️'
                    : '❓';
        
        console.log(`      ${emoji} ${dep.state} - ${new Date(dep.created_at).toLocaleString()}`);
        console.log(`         URL: https://${dep.url}`);
        
        if (dep.commit_sha) {
          console.log(`         Commit: ${dep.commit_sha.substring(0, 7)} by ${dep.commit_author || 'Unknown'}`);
          if (dep.commit_message) {
            const msg = dep.commit_message.length > 60 
              ? dep.commit_message.substring(0, 60) + '...'
              : dep.commit_message;
            console.log(`         Message: ${msg}`);
          }
        }
        
        if (dep.target) {
          console.log(`         Target: ${dep.target.toUpperCase()}`);
        }
        
        if (dep.duration_ms) {
          const seconds = Math.floor(dep.duration_ms / 1000);
          const minutes = Math.floor(seconds / 60);
          const secs = seconds % 60;
          console.log(`         Duration: ${minutes}m ${secs}s`);
        }
        
        if (dep.alias_error_message) {
          console.log(`         Error: ${dep.alias_error_message}`);
        }
        
        console.log('');
      }
    }
  }

  // Overall statistics
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 OVERALL STATISTICS (Last 7 Days)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const overallStats = db.getOverallStats(7);
  console.log(`Total Deployments: ${overallStats.totalDeployments}`);
  console.log(`✅ Successful: ${overallStats.successfulDeployments}`);
  console.log(`❌ Failed: ${overallStats.failedDeployments}`);
  console.log(`⏸️  Canceled: ${overallStats.canceledDeployments}`);
  console.log(`🔄 Building: ${overallStats.buildingDeployments}`);
  console.log(`Success Rate: ${overallStats.successRate}%`);
  
  if (overallStats.averageDuration) {
    const avgSeconds = Math.round(overallStats.averageDuration / 1000);
    const avgMinutes = Math.floor(avgSeconds / 60);
    const avgSecs = avgSeconds % 60;
    console.log(`Average Duration: ${avgMinutes}m ${avgSecs}s`);
  }
  
  console.log('');

  // Recent failures
  const failures = db.getRecentFailures(10);
  
  if (failures.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`❌ RECENT FAILURES (Last ${failures.length})`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const failure of failures) {
      console.log(`  • ${failure.project_name} - ${failure.state}`);
      console.log(`    Time: ${new Date(failure.created_at).toLocaleString()}`);
      console.log(`    URL: https://${failure.url}`);
      
      if (failure.commit_sha) {
        console.log(`    Commit: ${failure.commit_sha.substring(0, 7)}`);
      }
      
      if (failure.alias_error_message) {
        console.log(`    Error: ${failure.alias_error_message}`);
      }
      
      console.log('');
    }
  } else {
    console.log('✅ No recent failures! All deployments successful.\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(error => {
  logger.error('Failed to view database:', error);
  process.exit(1);
});

