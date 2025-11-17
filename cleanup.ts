#!/usr/bin/env node
/**
 * AgentFlow Cleanup Utility
 * 
 * Manually clean up orphaned processes, stale tasks, and temporary files
 * 
 * Usage:
 *   npm run cleanup              # Run full cleanup
 *   npm run cleanup:status       # Check status only
 *   npm run cleanup:emergency    # Emergency kill all
 */

import { getCleanupManager } from './src/utils/cleanupManager';
import { logger } from './src/utils/logger';
import { getDatabase } from './src/services/database';

async function main() {
  const command = process.argv[2] || 'cleanup';

  const cleanupManager = getCleanupManager();

  try {
    switch (command) {
      case 'status':
      case '--status':
        await showStatus(cleanupManager);
        break;

      case 'emergency':
      case '--emergency':
        await emergencyCleanup(cleanupManager);
        break;

      case 'cleanup':
      case '--cleanup':
      default:
        await runCleanup(cleanupManager);
        break;
    }

    // Close database
    getDatabase().close();

  } catch (error) {
    logger.error('Cleanup utility failed', error);
    process.exit(1);
  }
}

async function showStatus(cleanupManager: any) {
  console.log('\n📊 AgentFlow Resource Status\n');
  console.log('═'.repeat(50));

  const status = await cleanupManager.getResourceStatus();

  console.log(`\n🔹 Running Processes: ${status.runningProcesses}`);
  console.log(`🔹 Active Agents: ${status.activeAgents}`);
  console.log(`🔹 Running Tasks (DB): ${status.runningTasks}`);
  console.log(`🔹 Temp File Size: ${(status.tempFileSize / 1024).toFixed(2)} MB`);

  // Show running tasks
  const db = getDatabase();
  const runningTasks = db.prepare(`
    SELECT agent_id, task_description, started_at
    FROM agent_tasks
    WHERE status = 'running'
    ORDER BY started_at DESC
    LIMIT 10
  `).all();

  if (runningTasks.length > 0) {
    console.log(`\n📋 Running Tasks:\n`);
    for (const task of runningTasks as any[]) {
      console.log(`   • ${task.agent_id}`);
      console.log(`     ${task.task_description.substring(0, 80)}...`);
      console.log(`     Started: ${task.started_at}`);
      console.log();
    }
  }

  console.log('═'.repeat(50));
  console.log('\n✅ Status check complete\n');
}

async function runCleanup(cleanupManager: any) {
  console.log('\n🧹 Starting AgentFlow Cleanup\n');
  console.log('═'.repeat(50));

  const report = await cleanupManager.performCleanup();

  console.log('\n📊 Cleanup Report\n');
  console.log(`🔹 Orphaned Processes: ${report.orphanedProcesses}`);
  console.log(`🔹 Orphaned Agents: ${report.orphanedAgents}`);
  console.log(`🔹 Stale DB Tasks: ${report.staleTasksInDB}`);
  console.log(`🔹 Temp Files Deleted: ${report.tempFilesDeleted}`);
  console.log(`\n🔹 Total Cleaned: ${report.totalCleaned}`);

  console.log('\n═'.repeat(50));
  console.log('\n✅ Cleanup complete\n');
}

async function emergencyCleanup(cleanupManager: any) {
  console.log('\n🚨 EMERGENCY CLEANUP\n');
  console.log('═'.repeat(50));
  console.log('\n⚠️  This will forcefully kill ALL AgentFlow processes!');
  console.log('⚠️  Use this only if normal cleanup fails.\n');

  // Wait 3 seconds to allow cancellation
  console.log('Starting in 3 seconds... (Ctrl+C to cancel)');
  await new Promise(resolve => setTimeout(resolve, 3000));

  await cleanupManager.emergencyCleanup();

  console.log('\n✅ Emergency cleanup complete');
  console.log('═'.repeat(50));
  console.log('\n💡 You can now restart AgentFlow with: npm start\n');
}

main();

