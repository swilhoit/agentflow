import { spawn, ChildProcess } from 'child_process';
import { ClaudeCodeSession, SubAgentTask, BotConfig } from '../types';
import { logger } from '../utils/logger';
import Anthropic from '@anthropic-ai/sdk';
import { ClaudeCodeAgent, AgentTask, AgentResult } from './claudeCodeAgent';

export class SubAgentManager {
  private config: BotConfig;
  private activeSessions: Map<string, ClaudeCodeSession> = new Map();
  private tasks: Map<string, SubAgentTask[]> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private anthropicClient: Anthropic;
  private agents: Map<string, ClaudeCodeAgent> = new Map();
  private sendDiscordMessage?: (channelId: string, message: string) => Promise<void>;
  private notificationChannelId?: string;

  constructor(config: BotConfig) {
    this.config = config;
    this.anthropicClient = new Anthropic({ apiKey: config.anthropicApiKey });
    this.notificationChannelId = config.systemNotificationChannelId;
  }

  setDiscordMessageHandler(handler: (channelId: string, message: string) => Promise<void>): void {
    this.sendDiscordMessage = handler;
  }

  /**
   * Send notification to Discord channel (public method for orchestrator)
   */
  async sendNotification(message: string): Promise<void> {
    if (this.sendDiscordMessage && this.notificationChannelId) {
      try {
        await this.sendDiscordMessage(this.notificationChannelId, message);
        logger.info(`✅ Notification sent to channel: ${this.notificationChannelId}`);
      } catch (error) {
        logger.error('Failed to send Discord notification', error);
      }
    } else {
      logger.error('⚠️⚠️⚠️ CANNOT SEND NOTIFICATION - USER WILL NOT SEE THIS! ⚠️⚠️⚠️');
      if (!this.sendDiscordMessage) {
        logger.error('Reason: sendDiscordMessage handler not set');
      }
      if (!this.notificationChannelId) {
        logger.error('Reason: SYSTEM_NOTIFICATION_CHANNEL_ID not configured in .env');
      }
      logger.error('Message that user should have seen:', message.substring(0, 200));
    }
  }

  /**
   * Send message to a specific channel (fallback method)
   */
  async sendToChannel(channelId: string, message: string): Promise<void> {
    if (this.sendDiscordMessage) {
      try {
        await this.sendDiscordMessage(channelId, message);
        logger.info(`✅ Sent message to channel: ${channelId}`);
      } catch (error) {
        logger.error(`❌ Failed to send message to channel ${channelId}`, error);
      }
    } else {
      logger.error('⚠️ No Discord message handler configured!');
    }
  }

  async spawnAgents(
    parentTaskId: string,
    taskDescriptions: string[],
    bashCommands: string[] = []
  ): Promise<ClaudeCodeSession[]> {
    const sessions: ClaudeCodeSession[] = [];

    // Limit concurrent agents
    const currentActiveCount = this.activeSessions.size;
    const availableSlots = this.config.maxConcurrentAgents - currentActiveCount;

    if (availableSlots <= 0) {
      logger.warn('Maximum concurrent agents reached, queueing tasks');
      return [];
    }

    const tasksToSpawn = Math.min(taskDescriptions.length, availableSlots);

    for (let i = 0; i < tasksToSpawn; i++) {
      const taskDescription = taskDescriptions[i];
      const bashCommand = bashCommands[i];

      const session = await this.spawnAgent(parentTaskId, taskDescription, bashCommand);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  private async spawnAgent(
    parentTaskId: string,
    taskDescription: string,
    bashCommand?: string
  ): Promise<ClaudeCodeSession | null> {
    try {
      const sessionId = this.generateSessionId();

      const task: SubAgentTask = {
        id: sessionId,
        type: bashCommand ? 'terminal' : 'analysis',
        command: bashCommand,
        parameters: { description: taskDescription },
        status: 'pending',
      };

      const session: ClaudeCodeSession = {
        sessionId,
        createdAt: new Date(),
        status: 'active',
        parentTaskId,
        currentTask: task,
      };

      this.activeSessions.set(sessionId, session);

      if (!this.tasks.has(parentTaskId)) {
        this.tasks.set(parentTaskId, []);
      }
      this.tasks.get(parentTaskId)!.push(task);

      logger.info(`Spawned sub-agent ${sessionId} for task: ${taskDescription}`);
      await this.sendNotification(`🤖 **Sub-Agent Spawned**\n\`\`\`\nID: ${sessionId}\nType: ${task.type}\nTask: ${taskDescription}\n\`\`\``);

      // Execute the task
      if (bashCommand) {
        await this.executeTerminalTask(session, task, bashCommand);
      } else {
        await this.executeAnalysisTask(session, task, taskDescription);
      }

      return session;
    } catch (error) {
      logger.error('Failed to spawn sub-agent', error);
      return null;
    }
  }

  private async executeTerminalTask(
    session: ClaudeCodeSession,
    task: SubAgentTask,
    command: string
  ): Promise<void> {
    task.status = 'running';

    try {
      logger.info(`Executing command: ${command}`);
      
      // Notify command starting
      await this.sendNotification(`▶️ **Starting Command**\n\`\`\`bash\n${command.substring(0, 200)}\n\`\`\``);

      // Notify running status
      await this.sendNotification(`⏳ **Command Running...**\nExecuting bash command on your system`);

      const result = await this.runBashCommand(command);

      task.status = 'completed';
      task.result = result;

      session.status = 'idle';

      logger.info(`Task ${task.id} completed successfully`);

      // Send result in notification (truncate if too long for Discord)
      const truncatedResult = result.length > 1800
        ? result.substring(0, 1800) + '\n...(truncated)'
        : result;

      await this.sendNotification(
        `✅ **Command Completed**\n` +
        `\`\`\`bash\n${command}\n\`\`\`\n` +
        `**Output:**\n\`\`\`\n${truncatedResult}\n\`\`\``
      );
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';

      session.status = 'idle';

      logger.error(`Task ${task.id} failed`, error);
      await this.sendNotification(`❌ **Command Failed**\n\`\`\`\nTask: ${task.id}\nError: ${task.error}\n\`\`\``);
    }
  }

  private async executeAnalysisTask(
    session: ClaudeCodeSession,
    task: SubAgentTask,
    description: string
  ): Promise<void> {
    task.status = 'running';

    try {
      logger.info(`Executing analysis task: ${description}`);
      await this.sendNotification(`🔍 **Analysis Task Started**\n\`\`\`\n${description.substring(0, 200)}\n\`\`\``);

      const response = await this.anthropicClient.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `You are a specialized sub-agent. Please analyze and complete the following task:\n\n${description}\n\nProvide a concise analysis and any recommended actions.`
          }
        ]
      });

      const result = response.content[0].type === 'text'
        ? response.content[0].text
        : JSON.stringify(response.content[0]);

      task.status = 'completed';
      task.result = result;

      session.status = 'idle';

      logger.info(`Analysis task ${task.id} completed successfully`);
      await this.sendNotification(`✅ **Analysis Complete**\n\`\`\`\nTask: ${task.id}\n\`\`\``);
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';

      session.status = 'idle';

      logger.error(`Analysis task ${task.id} failed`, error);
      await this.sendNotification(`❌ **Analysis Failed**\n\`\`\`\nTask: ${task.id}\nError: ${task.error}\n\`\`\``);
    }
  }

  private runBashCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      logger.info(`[runBashCommand] Executing: ${command}`);

      // Use exec instead of spawn for better shell compatibility
      const { exec } = require('child_process');

      const env = {
        ...process.env,
        PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
        HOME: require('os').homedir(),
        SHELL: '/bin/bash',
        // Preserve Google Cloud and GitHub auth
        CLOUDSDK_CONFIG: process.env.CLOUDSDK_CONFIG || `${require('os').homedir()}/.config/gcloud`,
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      };

      const childProcess = exec(
        command,
        {
          env,
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024 * 5, // 5MB buffer for large outputs
          shell: '/bin/bash'
        },
        (error: Error | null, stdout: string, stderr: string) => {
          if (error) {
            // On error, combine stdout and stderr for context
            const errorOutput = stderr || stdout || error.message;
            logger.error(`[runBashCommand] Failed: ${errorOutput.substring(0, 200)}`);
            reject(new Error(`Command failed: ${errorOutput}`));
          } else {
            // Return stdout, or stderr if stdout is empty
            const output = stdout || stderr || '(no output)';
            logger.info(`[runBashCommand] Success: ${output.substring(0, 100)}...`);
            resolve(output);
          }
        }
      );

      // Store process reference for potential termination
      this.processes.set(command, childProcess);
    });
  }

  async getTaskStatus(taskId: string): Promise<SubAgentTask[] | null> {
    return this.tasks.get(taskId) || null;
  }

  getActiveAgentCount(): number {
    return this.activeSessions.size;
  }

  listActiveAgents(): ClaudeCodeSession[] {
    return Array.from(this.activeSessions.values());
  }

  async terminateAgent(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return false;
    }

    session.status = 'terminated';

    // Clean up associated tasks
    if (session.parentTaskId) {
      const tasks = this.tasks.get(session.parentTaskId);
      if (tasks) {
        const task = tasks.find(t => t.id === sessionId);
        if (task && task.status === 'running') {
          task.status = 'failed';
          task.error = 'Terminated by user';
        }
      }
    }

    this.activeSessions.delete(sessionId);

    logger.info(`Terminated agent ${sessionId}`);
    return true;
  }

  /**
   * Spawn an enhanced Claude Code agent with full autonomous capabilities
   */
  async spawnClaudeCodeAgent(
    parentTaskId: string,
    taskDescription: string,
    options?: {
      contextFiles?: string[];
      requirements?: string[];
      maxIterations?: number;
      workingDirectory?: string;
      channelId?: string; // Add channelId parameter
    }
  ): Promise<{ sessionId: string; agent: ClaudeCodeAgent }> {
    const sessionId = this.generateSessionId();
    const workingDirectory = options?.workingDirectory || process.cwd();
    const channelId = options?.channelId || this.notificationChannelId;

    logger.info(`🤖 Spawning Claude Code agent: ${sessionId} for channel: ${channelId}`);

    const agent = new ClaudeCodeAgent(sessionId, workingDirectory);

    // Set notification handler so agent can send Discord messages directly
    // Use the provided channelId if available, otherwise fall back to configured one
    agent.setNotificationHandler(async (message: string) => {
      if (channelId && this.sendDiscordMessage) {
        await this.sendDiscordMessage(channelId, message);
      } else {
        await this.sendNotification(message);
      }
    });

    // Helper to send notifications to the correct channel
    const notify = async (msg: string) => {
      if (channelId && this.sendDiscordMessage) {
        await this.sendDiscordMessage(channelId, msg);
      } else {
        await this.sendNotification(msg);
      }
    };

    // Listen to agent events
    agent.on('task:started', async (data) => {
      const msg = `🚀 **Agent Started**\n\`\`\`\nTask: ${data.description}\nAgent ID: ${sessionId}\n\`\`\``;
      logger.info(`[${sessionId}] Task started: ${data.description}`);
      await notify(msg);
    });

    agent.on('step:started', async (step) => {
      const msg = `📋 **Step ${step.step}**: ${step.action}\n\`Agent: ${sessionId}\``;
      logger.info(`[${sessionId}] Step ${step.step}: ${step.action}`);
      await notify(msg);
    });

    agent.on('output', (data) => {
      logger.info(`[${sessionId}] ${data}`);
      // Don't send every output line to avoid spam
    });

    agent.on('warning', async (warning) => {
      const msg = `⚠️ **Warning**\n\`\`\`\nType: ${warning.type}\nAgent: ${sessionId}\n\`\`\``;
      logger.warn(`[${sessionId}] Warning: ${warning.type}`);
      await notify(msg);
    });

    agent.on('error', async (errorData) => {
      const msg = `❌ **Agent Error**\n\`\`\`\nAgent: ${sessionId}\nError: ${errorData.error}\n\`\`\``;
      logger.error(`[${sessionId}] Error: ${errorData.error}`);
      await notify(msg);
    });

    agent.on('task:completed', async (result: AgentResult) => {
      const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
      const duration = (result.duration / 1000).toFixed(2);
      const msg = `🏁 **Task Completed**\n\`\`\`\nStatus: ${status}\nAgent: ${sessionId}\nDuration: ${duration}s\nSteps: ${result.steps.length}\n\`\`\``;
      logger.info(`[${sessionId}] Task completed: ${result.success ? '✅' : '❌'}`);
      await notify(msg);
    });

    agent.on('task:failed', async (result: AgentResult) => {
      const msg = `❌ **Task Failed**\n\`\`\`\nAgent: ${sessionId}\nError: ${result.error || 'Unknown error'}\nDuration: ${(result.duration / 1000).toFixed(2)}s\n\`\`\``;
      logger.error(`[${sessionId}] Task failed: ${result.error}`);
      await notify(msg);
    });

    // Store agent
    this.agents.set(sessionId, agent);

    // Create session tracking
    const session: ClaudeCodeSession = {
      sessionId,
      createdAt: new Date(),
      status: 'active',
      parentTaskId,
      currentTask: {
        id: sessionId,
        type: 'claude_code',
        parameters: {
          description: taskDescription,
          ...options
        },
        status: 'pending'
      }
    };

    this.activeSessions.set(sessionId, session);

    // Execute the task asynchronously
    const task: AgentTask = {
      id: sessionId,
      description: taskDescription,
      contextFiles: options?.contextFiles,
      requirements: options?.requirements,
      maxIterations: options?.maxIterations,
      workingDirectory
    };

    // Run in background
    agent.executeTask(task)
      .then((result) => {
        session.status = result.success ? 'idle' : 'failed';
        if (session.currentTask) {
          session.currentTask.status = result.success ? 'completed' : 'failed';
          session.currentTask.result = JSON.stringify(result);
        }
      })
      .catch((error) => {
        session.status = 'failed';
        if (session.currentTask) {
          session.currentTask.status = 'failed';
          session.currentTask.error = error instanceof Error ? error.message : 'Unknown error';
        }
      });

    return { sessionId, agent };
  }

  /**
   * Get agent result
   */
  async getAgentResult(sessionId: string): Promise<AgentResult | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.currentTask?.result) {
      return null;
    }

    try {
      return JSON.parse(session.currentTask.result);
    } catch {
      return null;
    }
  }

  /**
   * Get agent status
   */
  getAgentStatus(sessionId: string) {
    const agent = this.agents.get(sessionId);
    if (!agent) {
      return null;
    }

    return agent.getStatus();
  }

  /**
   * Stream agent output (for real-time monitoring)
   */
  streamAgentOutput(sessionId: string, callback: (data: string) => void): () => void {
    const agent = this.agents.get(sessionId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    const handler = (data: string) => callback(data);
    agent.on('output', handler);

    // Return unsubscribe function
    return () => {
      agent.off('output', handler);
    };
  }

  private generateSessionId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async cleanup(): Promise<void> {
    // Terminate all agents
    for (const [sessionId, agent] of this.agents) {
      await agent.terminate();
    }

    for (const [sessionId] of this.activeSessions) {
      await this.terminateAgent(sessionId);
    }

    this.agents.clear();
    this.processes.clear();
    this.tasks.clear();

    logger.info('Sub-agent manager cleaned up');
  }
}
