import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import { getSQLiteDatabase, isUsingSupabase } from '../services/databaseFactory';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface CleanupReport {
  timestamp: Date;
  orphanedProcesses: number;
  orphanedAgents: number;
  staleTasksInDB: number;
  tempFilesDeleted: number;
  totalCleaned: number;
}

/**
 * CleanupManager - Detects and cleans up orphaned resources
 * 
 * Prevents resource leaks from:
 * - Zombie processes
 * - Orphaned agents
 * - Stale database entries
 * - Temporary files
 * - Cloud processes (Google Cloud Run user deployments)
 */
export class CleanupManager {
  private cleanupInterval?: NodeJS.Timeout;
  private isRunning: boolean = false;

  /**
   * Start automatic cleanup (runs every N minutes)
   */
  startAutoCleanup(intervalMinutes: number = 30): void {
    if (this.isRunning) {
      logger.warn('Auto-cleanup already running');
      return;
    }

    this.isRunning = true;
    logger.info(`🧹 Starting auto-cleanup (every ${intervalMinutes} minutes)`);

    // Run immediately
    this.performCleanup().catch(error => {
      logger.error('Initial cleanup failed', error);
    });

    // Then run on interval
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        logger.error('Scheduled cleanup failed', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.isRunning = false;
    logger.info('🧹 Stopped auto-cleanup');
  }

  /**
   * Perform comprehensive cleanup
   */
  async performCleanup(): Promise<CleanupReport> {
    logger.info('🧹 Starting cleanup scan...');

    const report: CleanupReport = {
      timestamp: new Date(),
      orphanedProcesses: 0,
      orphanedAgents: 0,
      staleTasksInDB: 0,
      tempFilesDeleted: 0,
      totalCleaned: 0
    };

    try {
      // 1. Clean orphaned Node processes
      report.orphanedProcesses = await this.cleanOrphanedProcesses();

      // 2. Clean stale database tasks
      report.staleTasksInDB = await this.cleanStaleTasksInDB();

      // 3. Clean temporary files
      report.tempFilesDeleted = await this.cleanTempFiles();

      // 4. Check cloud processes (if applicable)
      await this.checkCloudProcesses();

      report.totalCleaned = report.orphanedProcesses + report.staleTasksInDB + report.tempFilesDeleted;

      if (report.totalCleaned > 0) {
        logger.info(`🧹 Cleanup complete: ${report.totalCleaned} items cleaned`);
        logger.info(`   - Processes: ${report.orphanedProcesses}`);
        logger.info(`   - DB Tasks: ${report.staleTasksInDB}`);
        logger.info(`   - Temp Files: ${report.tempFilesDeleted}`);
      } else {
        logger.info('🧹 Cleanup complete: No orphaned resources found');
      }

      return report;

    } catch (error) {
      logger.error('Cleanup failed', error);
      throw error;
    }
  }

  /**
   * Clean orphaned Node.js processes
   */
  private async cleanOrphanedProcesses(): Promise<number> {
    try {
      // Find Node processes related to AgentFlow
      const { stdout } = await execAsync('ps aux | grep -E "node.*agentflow|claude.*agent" | grep -v grep || true');
      
      if (!stdout.trim()) {
        return 0;
      }

      const processes = stdout.trim().split('\n');
      let cleaned = 0;

      // Get current process PID and parent PID
      const currentPid = process.pid;
      const parentPid = process.ppid;

      for (const proc of processes) {
        const parts = proc.trim().split(/\s+/);
        const pid = parseInt(parts[1]);

        if (isNaN(pid) || pid === currentPid || pid === parentPid) {
          continue;
        }

        // Check if process is actually hung (no CPU activity for 10+ minutes)
        const isHung = await this.isProcessHung(pid);
        
        if (isHung) {
          logger.warn(`Found hung process: PID ${pid}`);
          logger.info(`Killing hung process: ${pid}`);
          
          try {
            process.kill(pid, 'SIGTERM');
            
            // Wait and check if it's still alive
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
              process.kill(pid, 0); // Check if still exists
              // Still alive, force kill
              logger.warn(`Process ${pid} didn't terminate gracefully, force killing`);
              process.kill(pid, 'SIGKILL');
            } catch {
              // Process is gone, good
            }
            
            cleaned++;
          } catch (error) {
            logger.error(`Failed to kill process ${pid}`, error);
          }
        }
      }

      return cleaned;

    } catch (error) {
      logger.error('Failed to clean orphaned processes', error);
      return 0;
    }
  }

  /**
   * Check if a process appears to be hung
   */
  private async isProcessHung(pid: number): Promise<boolean> {
    try {
      // Check process age and CPU usage
      const { stdout } = await execAsync(`ps -p ${pid} -o etime= -o %cpu= || true`);
      
      if (!stdout.trim()) {
        return false; // Process doesn't exist
      }

      const [etime, cpu] = stdout.trim().split(/\s+/);
      
      // Parse elapsed time (format: [[dd-]hh:]mm:ss)
      const timeParts = etime.split(/[-:]/);
      let totalMinutes = 0;
      
      if (timeParts.length >= 2) {
        const seconds = parseInt(timeParts[timeParts.length - 1]);
        const minutes = parseInt(timeParts[timeParts.length - 2]);
        totalMinutes = minutes + (seconds / 60);
        
        if (timeParts.length >= 3) {
          const hours = parseInt(timeParts[timeParts.length - 3]);
          totalMinutes += hours * 60;
        }
      }

      const cpuUsage = parseFloat(cpu);

      // Consider hung if:
      // - Running for >30 minutes AND
      // - CPU usage <0.1%
      return totalMinutes > 30 && cpuUsage < 0.1;

    } catch (error) {
      return false;
    }
  }

  /**
   * Clean stale tasks from database
   */
  private async cleanStaleTasksInDB(): Promise<number> {
    try {
      // Skip for Supabase mode
      if (isUsingSupabase()) {
        logger.debug('Skipping stale task cleanup in Supabase mode');
        return 0;
      }

      const dbService = getSQLiteDatabase();
      const db = dbService.getDb();
      
      // Find tasks that have been running for more than 1 hour
      const staleThreshold = Date.now() - (60 * 60 * 1000); // 1 hour ago
      const staleDate = new Date(staleThreshold).toISOString();

      const staleTasks = db.prepare(`
        SELECT agent_id, task_description, started_at
        FROM agent_tasks
        WHERE status = 'running'
        AND datetime(started_at) < datetime(?)
      `).all(staleDate);

      if (staleTasks.length === 0) {
        return 0;
      }

      logger.warn(`Found ${staleTasks.length} stale tasks in database`);

      for (const task of staleTasks as any[]) {
        logger.info(`Marking stale task as failed: ${task.agent_id}`);
        logger.info(`  Task: ${task.task_description.substring(0, 100)}...`);
        logger.info(`  Started: ${task.started_at}`);

        db.prepare(`
          UPDATE agent_tasks
          SET status = 'failed',
              completed_at = datetime('now'),
              error = 'Task timeout - cleaned up by system'
          WHERE agent_id = ?
        `).run(task.agent_id);
      }

      return staleTasks.length;

    } catch (error) {
      logger.error('Failed to clean stale database tasks', error);
      return 0;
    }
  }

  /**
   * Clean temporary files
   */
  private async cleanTempFiles(): Promise<number> {
    let cleaned = 0;

    try {
      // Clean audio files older than 1 hour
      cleaned += await this.cleanOldFiles('./audio', '.pcm', 60);
      cleaned += await this.cleanOldFiles('./audio', '.wav', 60);
      
      // Clean TTS audio older than 24 hours
      cleaned += await this.cleanOldFiles('./tts_audio', '.mp3', 60 * 24);
      
      // Clean temp directory
      cleaned += await this.cleanOldFiles('./temp', null, 60);

    } catch (error) {
      logger.error('Failed to clean temp files', error);
    }

    return cleaned;
  }

  /**
   * Clean old files in a directory
   */
  private async cleanOldFiles(dirPath: string, extension: string | null, ageMinutes: number): Promise<number> {
    try {
      const fullPath = path.resolve(process.cwd(), dirPath);
      
      // Check if directory exists
      try {
        await fs.access(fullPath);
      } catch {
        return 0; // Directory doesn't exist
      }

      const files = await fs.readdir(fullPath);
      const now = Date.now();
      const ageMs = ageMinutes * 60 * 1000;
      let deleted = 0;

      for (const file of files) {
        if (extension && !file.endsWith(extension)) {
          continue;
        }

        const filePath = path.join(fullPath, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > ageMs) {
          await fs.unlink(filePath);
          deleted++;
          logger.debug(`Deleted old file: ${file}`);
        }
      }

      if (deleted > 0) {
        logger.info(`Cleaned ${deleted} old files from ${dirPath}`);
      }

      return deleted;

    } catch (error) {
      logger.error(`Failed to clean files in ${dirPath}`, error);
      return 0;
    }
  }

  /**
   * Check for running Cloud Run processes (user deployments, not bot infrastructure)
   */
  private async checkCloudProcesses(): Promise<void> {
    try {
      // Check if gcloud is configured
      const { stdout: projectId } = await execAsync('gcloud config get-value project 2>/dev/null || echo ""');
      
      if (!projectId.trim()) {
        return; // No GCP project configured
      }

      // List running Cloud Run services
      const { stdout } = await execAsync(
        'gcloud run services list --format="value(metadata.name,status.conditions[0].status)" 2>/dev/null || true'
      );

      if (!stdout.trim()) {
        return;
      }

      const services = stdout.trim().split('\n');
      for (const service of services) {
        const [name, status] = service.split(/\s+/);
        if (name && name.includes('agentflow') || name.includes('claude')) {
          logger.info(`Cloud Run service: ${name} - Status: ${status}`);
        }
      }

    } catch (error) {
      // Silently fail - GCP might not be configured
      logger.debug('Could not check Cloud Run processes', error);
    }
  }

  /**
   * Get current resource status
   */
  async getResourceStatus(): Promise<{
    runningProcesses: number;
    activeAgents: number;
    runningTasks: number;
    tempFileSize: number;
  }> {
    try {
      // Count Node processes
      const { stdout: psOut } = await execAsync('ps aux | grep -E "node.*agentflow" | grep -v grep | wc -l || echo 0');
      const runningProcesses = parseInt(psOut.trim()) || 0;

      // Count database tasks
      let runningTaskCount = 0;
      if (!isUsingSupabase()) {
        const dbService = getSQLiteDatabase();
        const db = dbService.getDb();
        const result = db.prepare("SELECT COUNT(*) as count FROM agent_tasks WHERE status = 'running'")
          .get() as { count: number };
        runningTaskCount = result?.count || 0;
      }

      // Calculate temp file size
      let tempFileSize = 0;
      try {
        const { stdout: duOut } = await execAsync('du -sk audio tts_audio temp 2>/dev/null || echo "0"');
        tempFileSize = parseInt(duOut.split(/\s+/)[0]) || 0;
      } catch {
        tempFileSize = 0;
      }

      return {
        runningProcesses,
        activeAgents: 0, // Would need to query SubAgentManager
        runningTasks: runningTaskCount,
        tempFileSize
      };

    } catch (error) {
      logger.error('Failed to get resource status', error);
      return {
        runningProcesses: 0,
        activeAgents: 0,
        runningTasks: 0,
        tempFileSize: 0
      };
    }
  }

  /**
   * Emergency cleanup - force kill all related processes
   */
  async emergencyCleanup(): Promise<void> {
    logger.warn('🚨 EMERGENCY CLEANUP - Killing all AgentFlow processes');

    try {
      // Kill all node processes with agentflow in command
      await execAsync('pkill -9 -f "node.*agentflow" || true');
      
      // Kill all claude processes
      await execAsync('pkill -9 -f "claude.*agent" || true');

      // Clean lock files
      await execAsync('rm -f data/.agentflow.lock || true');

      logger.info('Emergency cleanup complete');

    } catch (error) {
      logger.error('Emergency cleanup failed', error);
      throw error;
    }
  }
}

// Singleton instance
let cleanupManagerInstance: CleanupManager | null = null;

export function getCleanupManager(): CleanupManager {
  if (!cleanupManagerInstance) {
    cleanupManagerInstance = new CleanupManager();
  }
  return cleanupManagerInstance;
}

