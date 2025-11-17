import express, { Request, Response } from 'express';
import { ToolBasedAgent } from '../agents/toolBasedAgent';
import { SubAgentManager } from '../agents/subAgentManager';
import { OrchestratorRequest, OrchestratorResponse } from '../types';
import { logger } from '../utils/logger';
import { BotConfig } from '../types';
import { TrelloService } from '../services/trello';

/**
 * OrchestratorServer with Native Tool Use API
 *
 * Uses Anthropic's native tool calling - no external dependencies!
 * Claude directly calls tools (bash, Trello, etc.), sees results, and iterates.
 *
 * This is the same approach Claude Code/Cursor uses.
 */
export class OrchestratorServer {
  private app: express.Application;
  private toolBasedAgent: ToolBasedAgent;
  private subAgentManager: SubAgentManager;
  private config: BotConfig;
  private port: number;
  private server: any; // HTTP server instance for cleanup

  constructor(config: BotConfig, port: number = 3001, trelloService?: TrelloService) {
    this.config = config;
    this.port = port;
    this.app = express();

    // Initialize ToolBasedAgent with native Anthropic tool calling
    this.toolBasedAgent = new ToolBasedAgent(config.anthropicApiKey, trelloService);

    logger.info('🚀 OrchestratorServer: Native Tool Use API (Docker-ready, no CLI needed)');

    this.subAgentManager = new SubAgentManager(config);

    this.setupMiddleware();
    this.setupRoutes();
  }

  setDiscordMessageHandler(handler: (channelId: string, message: string) => Promise<void>): void {
    this.subAgentManager.setDiscordMessageHandler(handler);
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
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        activeAgents: this.subAgentManager.getActiveAgentCount()
      });
    });

    // Process command - Native Tool Use API with iterative execution
    this.app.post('/command', async (req: Request, res: Response) => {
      try {
        const request: OrchestratorRequest = req.body;

        if (!request.command || !request.context) {
          return res.status(400).json({ error: 'Invalid request format' });
        }

        logger.info(`📥 Command received: ${request.command}`);

        // Set up notification handler for the agent
        this.toolBasedAgent.setNotificationHandler(async (message: string) => {
          try {
            await this.subAgentManager.sendNotification(message);
          } catch (error) {
            logger.error('Failed to send notification', error);
          }
        });

        // Return immediately - agent runs in background
        const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        res.json({
          success: true,
          message: `Agent started for task: ${request.command}`,
          taskId,
          agentIds: [taskId]
        });

        // Execute task asynchronously with native tool calling
        logger.info(`🚀 Starting ToolBasedAgent for task: ${taskId}`);

        this.toolBasedAgent.executeTask({
          command: request.command,
          context: request.context
        })
          .then(async (result) => {
            logger.info(`✅ Task ${taskId} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);

            // Send final summary
            try {
              const summary = `
🏁 **Task Complete**

**Task ID:** \`${taskId}\`
**Status:** ${result.success ? '✅ Success' : '❌ Failed'}
**Iterations:** ${result.iterations}
**Tool Calls:** ${result.toolCalls}

**Summary:**
${result.message}

${result.error ? `**Error:** \`${result.error}\`` : ''}
              `.trim();

              await this.subAgentManager.sendNotification(summary);
            } catch (notifError) {
              logger.warn('Failed to send completion notification', notifError);
            }
          })
          .catch(async (error) => {
            logger.error(`❌ Task ${taskId} failed:`, error);

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            try {
              await this.subAgentManager.sendNotification(
                `❌ **Task Failed**\n\`\`\`\n${errorMessage}\n\`\`\`\n**Task ID:** \`${taskId}\``
              );
            } catch (notifError) {
              logger.warn('Failed to send failure notification', notifError);
            }
          });

      } catch (error) {
        logger.error('Error processing command', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        try {
          await this.subAgentManager.sendNotification(
            `❌ **Critical Error**\n\`\`\`\n${errorMessage}\n\`\`\``
          );
        } catch (notifError) {
          logger.warn('Failed to send critical error notification', notifError);
        }

        res.status(500).json({
          success: false,
          message: `Error: ${errorMessage}`,
          taskId: '',
          error: errorMessage
        });
      }
    });

    // Get task status
    this.app.get('/task/:taskId', async (req: Request, res: Response) => {
      const taskId = req.params.taskId;
      const status = await this.subAgentManager.getTaskStatus(taskId);

      if (!status) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(status);
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
