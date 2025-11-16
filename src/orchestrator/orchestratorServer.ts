import express, { Request, Response } from 'express';
import { ClaudeClient } from './claudeClient';
import { SubAgentManager } from '../agents/subAgentManager';
import { OrchestratorRequest, OrchestratorResponse } from '../types';
import { logger } from '../utils/logger';
import { BotConfig } from '../types';

export class OrchestratorServer {
  private app: express.Application;
  private claudeClient: ClaudeClient;
  private subAgentManager: SubAgentManager;
  private config: BotConfig;
  private port: number;

  constructor(config: BotConfig, port: number = 3001) {
    this.config = config;
    this.port = port;
    this.app = express();
    this.claudeClient = new ClaudeClient(config.anthropicApiKey);
    this.subAgentManager = new SubAgentManager(config);

    this.setupMiddleware();
    this.setupRoutes();
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

    // Process command
    this.app.post('/command', async (req: Request, res: Response) => {
      try {
        const request: OrchestratorRequest = req.body;

        if (!request.command || !request.context) {
          return res.status(400).json({ error: 'Invalid request format' });
        }

        logger.info(`Processing command: ${request.command}`);

        // Get response from Claude
        const response = await this.claudeClient.processCommand(request);

        if (!response.success) {
          return res.status(500).json(response);
        }

        // Extract bash commands if any
        const bashCommands = this.claudeClient.extractBashCommands(response.message);

        // If sub-agents are required, spawn them
        if (response.agentIds && response.agentIds.length > 0) {
          const agentTasks = response.executionPlan || [];
          const spawnedAgents = await this.subAgentManager.spawnAgents(
            response.taskId,
            agentTasks,
            bashCommands
          );

          response.agentIds = spawnedAgents.map(a => a.sessionId);
        }

        res.json(response);
      } catch (error) {
        logger.error('Error processing command', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error',
          taskId: '',
          error: error instanceof Error ? error.message : 'Unknown error'
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

    // Clear conversation history
    this.app.delete('/history/:guildId/:userId', (req: Request, res: Response) => {
      const { guildId, userId } = req.params;
      this.claudeClient.clearHistory(guildId, userId);
      res.json({ success: true, message: 'History cleared' });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        logger.info(`Orchestrator server listening on port ${this.port}`);
        resolve();
      });
    });
  }
}
