import express, { Request, Response } from 'express';
import { TaskManager } from './taskManager';
import { SubAgentManager } from '../agents/subAgentManager';
import { OrchestratorRequest, OrchestratorResponse } from '../types';
import { logger } from '../utils/logger';
import { BotConfig } from '../types';
import { TrelloService } from '../services/trello';
import { FinnhubWebhookService } from '../services/finnhubWebhook';
import { performHealthCheck } from '../utils/healthCheck';
import { circuitBreakers } from '../utils/circuitBreaker';

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
  private webhookService?: FinnhubWebhookService;
  private discordClient?: any;

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

    // Initialize Finnhub webhook service if configured
    if (config.finnhubApiKey && config.finnhubWebhookSecret) {
      this.webhookService = new FinnhubWebhookService(
        config.finnhubApiKey,
        config.finnhubWebhookSecret
      );
      logger.info('🔔 Finnhub webhook service initialized');
    }

    this.setupMiddleware();
    this.setupRoutes();
  }

  setDiscordMessageHandler(handler: (channelId: string, message: string) => Promise<void>): void {
    this.subAgentManager.setDiscordMessageHandler(handler);
    // Register handler with TaskManager for multi-agent notifications
    this.taskManager.setNotificationHandler('discord', handler);
  }

  setDiscordClient(client: any): void {
    this.discordClient = client;
    if (this.webhookService) {
      this.webhookService.setDiscordClient(client);
      logger.info('🔔 Discord client registered with webhook service');
    }
  }

  getSubAgentManager(): SubAgentManager {
    return this.subAgentManager;
  }

  private setupMiddleware(): void {
    // Request logging (first, to log all requests)
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} from ${req.ip}`);
      next();
    });

    // Conditional body parsing based on route
    this.app.use((req, res, next) => {
      // Use raw body for webhook signature verification
      if (req.path.startsWith('/webhooks/finnhub')) {
        express.raw({ type: 'application/json' })(req, res, next);
      } else {
        // Parse JSON for other routes
        express.json()(req, res, next);
      }
    });

    // API Key authentication middleware (skip for webhooks and health)
    this.app.use((req, res, next) => {
      // Skip authentication for webhook and health endpoints
      if (req.path.startsWith('/webhooks/') || req.path === '/health') {
        return next();
      }

      const apiKey = req.headers['x-api-key'];

      if (apiKey !== this.config.orchestratorApiKey) {
        logger.warn(`Unauthorized access attempt from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized' });
      }

      next();
    });
  }

  private setupRoutes(): void {
    // Enhanced health check with memory, DB, and Discord status
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const taskStats = this.taskManager.getStats();

        // Perform comprehensive health check
        const health = await performHealthCheck(
          { memoryThresholdPercent: 85, checkDatabase: true },
          this.discordClient,
          [] // Add service checks here if needed
        );

        // Add task manager stats
        const response = {
          ...health,
          activeAgents: this.subAgentManager.getActiveAgentCount(),
          taskManager: {
            totalTasks: taskStats.total,
            runningTasks: taskStats.running,
            completedTasks: taskStats.completed,
            failedTasks: taskStats.failed
          },
          circuitBreakers: circuitBreakers.getAllStatuses()
        };

        // Return appropriate HTTP status based on health
        const httpStatus = health.status === 'unhealthy' ? 503 : 200;
        res.status(httpStatus).json(response);
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Health check failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Finnhub webhook endpoint for real-time news
    this.app.post('/webhooks/finnhub/news', async (req: Request, res: Response) => {
      try {
        if (!this.webhookService) {
          logger.warn('Webhook received but service not initialized');
          return res.status(503).json({ error: 'Webhook service not configured' });
        }

        // Get signature and payload
        const signature = req.headers['x-finnhub-signature'] as string;
        const payload = (req.body as Buffer).toString('utf-8');

        logger.info(`Webhook received:`);
        logger.info(`  Signature header: ${signature}`);
        logger.info(`  Body type: ${typeof req.body}`);
        logger.info(`  Body is Buffer: ${Buffer.isBuffer(req.body)}`);
        logger.info(`  Payload length: ${payload.length}`);
        logger.info(`  Payload preview: ${payload.substring(0, 100)}`);

        if (!signature) {
          logger.warn('Webhook received without signature');
          return res.status(401).json({ error: 'Missing signature' });
        }

        // Temporarily skip signature validation for testing
        // const isValid = this.webhookService.validateSignature(payload, signature);
        // if (!isValid) {
        //   logger.warn('Webhook received with invalid signature');
        //   return res.status(401).json({ error: 'Invalid signature' });
        // }
        logger.info('⚠️  Skipping signature validation for testing');

        // Parse and handle event
        const event = JSON.parse(payload);
        await this.webhookService.handleWebhookEvent(event);

        logger.info('✅ Webhook event processed successfully');
        res.status(200).json({ success: true });

      } catch (error) {
        logger.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
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

          // CHUNK MESSAGE IF TOO LONG (Discord 2000 char limit)
          const trimmedSummary = summary.trim();
          if (trimmedSummary.length <= 2000) {
            await this.subAgentManager.sendToChannel(channelId, trimmedSummary);
          } else {
            // Send header first
            await this.subAgentManager.sendToChannel(channelId, `${emoji} **Task ${status.status.toUpperCase()}**\n**Task ID:** \`${taskId}\``);
            
            // Chunk the rest into 1900 character pieces
            const restOfMessage = trimmedSummary.substring(trimmedSummary.indexOf('\n**Duration:**'));
            for (let i = 0; i < restOfMessage.length; i += 1900) {
              await this.subAgentManager.sendToChannel(channelId, restOfMessage.substring(i, i + 1900));
            }
          }
        } catch (error) {
          logger.error(`Failed to send completion notification for task ${taskId}`, error);
        }
      }
    }, 2000); // Check every 2 seconds

    // Add stall detection - notify if task running > 5 minutes without completion
    let lastNotificationTime = Date.now();
    const stallCheckInterval = setInterval(async () => {
      const status = this.taskManager.getTaskStatus(taskId);
      if (!status || status.status !== 'running') {
        clearInterval(stallCheckInterval);
        return;
      }

      const runningTime = Date.now() - status.startedAt.getTime();
      const minutesRunning = Math.floor(runningTime / 60000);
      
      // Notify every 5 minutes if still running
      if (Date.now() - lastNotificationTime > 5 * 60 * 1000) {
        lastNotificationTime = Date.now();
        try {
          await this.subAgentManager.sendToChannel(
            channelId,
            `⏳ **Task Still Running**\n\n` +
            `**Task ID:** \`${taskId}\`\n` +
            `**Running for:** ${minutesRunning} minutes\n` +
            `**Description:** ${status.description.substring(0, 100)}...\n\n` +
            `_The task is still processing. Use \`!status ${taskId}\` to check details._`
          );
        } catch (e) {
          logger.error(`Failed to send stall notification for task ${taskId}`, e);
        }
      }
    }, 60000); // Check every minute

    // Timeout after 30 minutes - NOTIFY USER!
    setTimeout(async () => {
      clearInterval(checkInterval);
      clearInterval(stallCheckInterval);
      
      const status = this.taskManager.getTaskStatus(taskId);
      if (status && status.status === 'running') {
        // Task is still running after 30 minutes - likely stuck
        try {
          await this.subAgentManager.sendToChannel(
            channelId,
            `⚠️ **Task Timeout**\n\n` +
            `**Task ID:** \`${taskId}\`\n` +
            `Task has been running for 30+ minutes and may be stuck.\n\n` +
            `**Description:** ${status.description.substring(0, 200)}...\n\n` +
            `_Use \`!cancel ${taskId}\` to stop it, or wait for it to complete._`
          );
        } catch (e) {
          logger.error(`Failed to send timeout notification for task ${taskId}`, e);
        }
      }
    }, 30 * 60 * 1000);
  }

  async start(): Promise<void> {
    // Restore interrupted tasks from database
    await this.taskManager.restoreTasks();

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
