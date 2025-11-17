import express, { Request, Response } from 'express';
import { TaskManager } from './taskManager';
import { SubAgentManager } from '../agents/subAgentManager';
import { OrchestratorRequest, OrchestratorResponse } from '../types';
import { logger } from '../utils/logger';
import { BotConfig } from '../types';
import { TrelloService } from '../services/trello';

/**
 * OrchestratorServer with Multi-Agent Task Management
 *
 * Uses TaskManager for full multi-agent support:
 * - Each task gets its own isolated ToolBasedAgent
 * - Tasks can run concurrently across different channels
 * - Channel-specific notifications (no cross-contamination)
 * - Task status tracking and management
 */
export class OrchestratorServer {
  private app: express.Application;
  private taskManager: TaskManager;
  private subAgentManager: SubAgentManager;
  private config: BotConfig;
  private port: number;
  private server: any; // HTTP server instance for cleanup

  constructor(config: BotConfig, port: number = 3001, trelloService?: TrelloService) {
    this.config = config;
    this.port = port;
    this.app = express();

    // Initialize TaskManager for multi-agent support
    this.taskManager = new TaskManager(
      config.anthropicApiKey,
      config.maxConcurrentAgents,
      trelloService
    );

    logger.info('🚀 OrchestratorServer: Multi-Agent Task Management (isolated agents per task)');

    this.subAgentManager = new SubAgentManager(config);

    this.setupMiddleware();
    this.setupRoutes();
  }

  setDiscordMessageHandler(handler: (channelId: string, message: string) => Promise<void>): void {
    this.subAgentManager.setDiscordMessageHandler(handler);
    // Register handler with TaskManager for multi-agent notifications
    this.taskManager.setNotificationHandler('discord', handler);
  }

  getSubAgentManager(): SubAgentManager {
    return this.subAgentManager;
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    // API Key authentication middleware
    this.app.use((req, res, next) => {
      const apiKey = req.headers['x-api-key'];

      if (apiKey !== this.config.orchestratorApiKey) {
        logger.warn(`Unauthorized access attempt from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized' });
      }

      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} from ${req.ip}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      const taskStats = this.taskManager.getStats();
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        activeAgents: this.subAgentManager.getActiveAgentCount(),
        taskManager: {
          totalTasks: taskStats.total,
          runningTasks: taskStats.running,
          completedTasks: taskStats.completed,
          failedTasks: taskStats.failed
        }
      });
    });

    // Process command - Multi-Agent with TaskManager
    this.app.post('/command', async (req: Request, res: Response) => {
      try {
        const request: OrchestratorRequest = req.body;

        if (!request.command || !request.context) {
          return res.status(400).json({ error: 'Invalid request format' });
        }

        logger.info(`📥 Command received: ${request.command} (channel: ${request.context.channelId})`);

        // Start task with TaskManager (creates isolated agent)
        const taskId = await this.taskManager.startTask(
          {
            command: request.command,
            context: request.context
          },
          request.command,
          'discord' // Use the Discord notification handler
        );

        logger.info(`✅ Task ${taskId} started successfully`);

        // Return immediately - task runs in background with isolated agent
        res.json({
          success: true,
          message: `Agent started for task: ${request.command}`,
          taskId,
          agentIds: [taskId]
        });

        // Monitor task completion in background to send final summary
        this.monitorTaskCompletion(taskId, request.context.channelId);

      } catch (error) {
        logger.error('Error processing command', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Send error notification to channel
        try {
          await this.subAgentManager.sendToChannel(
            req.body.context?.channelId,
            `❌ **Failed to Start Task**\n\`\`\`\n${errorMessage}\n\`\`\``
          );
        } catch (notifError) {
          logger.warn('Failed to send error notification', notifError);
        }

        res.status(500).json({
          success: false,
          message: `Error: ${errorMessage}`,
          taskId: '',
          error: errorMessage
        });
      }
    });

    // Get task status (supports both TaskManager and SubAgentManager tasks)
    this.app.get('/task/:taskId', async (req: Request, res: Response) => {
      const taskId = req.params.taskId;

      // Try TaskManager first (new multi-agent tasks)
      const taskStatus = this.taskManager.getTaskStatus(taskId);
      if (taskStatus) {
        return res.json(taskStatus);
      }

      // Fallback to SubAgentManager (legacy tasks)
      const subAgentStatus = await this.subAgentManager.getTaskStatus(taskId);
      if (subAgentStatus) {
        return res.json(subAgentStatus);
      }

      return res.status(404).json({ error: 'Task not found' });
    });

    // Get all tasks (with optional filters)
    this.app.get('/tasks', async (req: Request, res: Response) => {
      const { channelId, guildId, userId, status } = req.query;

      const tasks = this.taskManager.getAllTasks({
        channelId: channelId as string | undefined,
        guildId: guildId as string | undefined,
        userId: userId as string | undefined,
        status: status as any
      });

      const stats = this.taskManager.getStats();

      res.json({
        tasks,
        stats,
        total: tasks.length
      });
    });

    // Cancel a task
    this.app.post('/task/:taskId/cancel', async (req: Request, res: Response) => {
      const taskId = req.params.taskId;
      const success = await this.taskManager.cancelTask(taskId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Task not found or cannot be cancelled'
        });
      }

      res.json({
        success: true,
        message: `Task ${taskId} cancelled successfully`
      });
    });

    // List active agents
    this.app.get('/agents', (req: Request, res: Response) => {
      const agents = this.subAgentManager.listActiveAgents();
      res.json({ agents });
    });

    // Terminate agent
    this.app.delete('/agent/:agentId', async (req: Request, res: Response) => {
      const agentId = req.params.agentId;
      const success = await this.subAgentManager.terminateAgent(agentId);

      if (!success) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      res.json({ success: true, message: 'Agent terminated' });
    });

    // Clear conversation history (no-op with ToolBasedAgent - each task is independent)
    this.app.delete('/history/:guildId/:userId', (req: Request, res: Response) => {
      logger.info('History clearing not needed with ToolBasedAgent (stateless tasks)');
      res.json({ success: true, message: 'ToolBasedAgent is stateless - no history to clear' });
    });
  }

  /**
   * Monitor task completion and send summary notification
   */
  private async monitorTaskCompletion(taskId: string, channelId: string): Promise<void> {
    // Poll task status until completion
    const checkInterval = setInterval(async () => {
      const status = this.taskManager.getTaskStatus(taskId);

      if (!status) {
        clearInterval(checkInterval);
        return;
      }

      if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
        clearInterval(checkInterval);

        // Send completion summary to channel
        try {
          const durationSeconds = status.duration ? (status.duration / 1000).toFixed(2) : 'N/A';
          const emoji = status.status === 'completed' ? '✅' : status.status === 'cancelled' ? '🛑' : '❌';

          let summary = `
${emoji} **Task ${status.status.toUpperCase()}**

**Task ID:** \`${taskId}\`
**Duration:** ${durationSeconds}s
**Description:** ${status.description}
`;

          if (status.result) {
            summary += `
**Iterations:** ${status.result.iterations}
**Tool Calls:** ${status.result.toolCalls}

**Summary:**
${status.result.message}
`;
          }

          if (status.error) {
            summary += `\n**Error:** \`${status.error}\``;
          }

          await this.subAgentManager.sendToChannel(channelId, summary.trim());
        } catch (error) {
          logger.error(`Failed to send completion notification for task ${taskId}`, error);
        }
      }
    }, 2000); // Check every 2 seconds

    // Timeout after 30 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
    }, 30 * 60 * 1000);
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port)
        .on('listening', () => {
          logger.info(`Orchestrator server listening on port ${this.port}`);
          resolve();
        })
        .on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`❌ CRITICAL: Port ${this.port} is already in use! Another instance may be running.`);
            logger.error('Please check for other running instances with: ps aux | grep "node dist/index.js"');
            reject(new Error(`Port ${this.port} is already in use. Cannot start server.`));
          } else {
            logger.error('Failed to start orchestrator server', error);
            reject(error);
          }
        });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Orchestrator server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
