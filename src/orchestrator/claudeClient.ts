import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { OrchestratorRequest, OrchestratorResponse } from '../types';

export class ClaudeClient {
  private client: Anthropic;
  private conversationHistory: Map<string, Anthropic.MessageParam[]> = new Map();

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async processCommand(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    try {
      const contextKey = `${request.context.guildId}_${request.context.userId}`;
      const history = this.conversationHistory.get(contextKey) || [];

      logger.info(`Processing command: ${request.command}`);

      const systemPrompt = this.buildSystemPrompt();
      const userMessage = this.buildUserMessage(request);

      history.push({
        role: 'user',
        content: userMessage
      });

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4096,
        system: systemPrompt,
        messages: history
      });

      const assistantMessage = response.content[0].type === 'text'
        ? response.content[0].text
        : JSON.stringify(response.content[0]);

      history.push({
        role: 'assistant',
        content: assistantMessage
      });

      // Keep only last 10 messages to prevent context overflow
      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }

      this.conversationHistory.set(contextKey, history);

      // Parse the response to extract execution plan
      const executionPlan = this.parseExecutionPlan(assistantMessage);
      const requiresSubAgents = this.determineSubAgentRequirement(assistantMessage);

      const taskId = this.generateTaskId();

      return {
        success: true,
        message: assistantMessage,
        taskId,
        executionPlan,
        agentIds: requiresSubAgents ? [taskId] : undefined
      };
    } catch (error) {
      logger.error('Failed to process command with Claude', error);
      return {
        success: false,
        message: 'Failed to process command',
        taskId: this.generateTaskId(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private buildSystemPrompt(): string {
    return `You are an advanced AI orchestrator integrated with a Discord voice bot. Your role is to:

1. Interpret voice commands from users and determine the appropriate actions
2. Break down complex tasks into executable steps
3. Decide when to spawn sub-agents for parallel or specialized tasks
4. Execute terminal commands, API calls, and cloud operations
5. Provide clear, concise responses back to the user

AVAILABLE TOOLS AND ACCESS:
You have access to the following tools and platforms:
- **Google Cloud Platform (GCP)**: Full access via gcloud CLI
  - Can create/manage projects, deploy to Cloud Run, manage BigQuery, configure services
  - Already authenticated and configured
- **GitHub**: Full access via gh CLI
  - Can create repos, manage PRs, push code, view repos
  - Already authenticated
- **Node.js/NPM**: Can install packages, run scripts, manage dependencies
- **Docker**: Can build and manage containers
- **Terminal**: Full bash/shell access for any system commands
- **Git**: Full git operations (init, commit, push, pull, etc.)

When you receive a command, analyze it and respond with:
- A brief acknowledgment of the task
- An execution plan (list of steps)
- Whether sub-agents are needed (indicate with [SUB_AGENT_REQUIRED])
- Any terminal commands to execute (wrap in \`\`\`bash blocks)

Format your execution plan as:
PLAN:
1. [step description]
2. [step description]
...

If you need to execute terminal commands, format them as:
\`\`\`bash
command here
\`\`\`

For complex tasks that can benefit from parallelization or require specialized handling, indicate:
[SUB_AGENT_REQUIRED: task description]

Be concise and action-oriented. Focus on what needs to be done and how to do it.`;
  }

  private buildUserMessage(request: OrchestratorRequest): string {
    const timestamp = request.context.timestamp instanceof Date
      ? request.context.timestamp.toISOString()
      : new Date(request.context.timestamp).toISOString();

    return `User Command: "${request.command}"

Context:
- User ID: ${request.context.userId}
- Guild ID: ${request.context.guildId}
- Channel ID: ${request.context.channelId}
- Timestamp: ${timestamp}
- Priority: ${request.priority || 'normal'}

Please analyze this command and provide your execution plan.`;
  }

  private parseExecutionPlan(response: string): string[] {
    const planMatch = response.match(/PLAN:\s*([\s\S]*?)(?:\n\n|\n```|$)/);
    if (!planMatch) return [];

    const planText = planMatch[1];
    const steps = planText
      .split('\n')
      .filter(line => line.trim().match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim());

    return steps;
  }

  private determineSubAgentRequirement(response: string): boolean {
    return response.includes('[SUB_AGENT_REQUIRED');
  }

  extractBashCommands(response: string): string[] {
    const bashBlocks = response.match(/```bash\n([\s\S]*?)```/g) || [];
    return bashBlocks.map(block =>
      block.replace(/```bash\n/, '').replace(/```$/, '').trim()
    );
  }

  clearHistory(guildId: string, userId: string): void {
    const contextKey = `${guildId}_${userId}`;
    this.conversationHistory.delete(contextKey);
    logger.info(`Cleared conversation history for ${contextKey}`);
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
