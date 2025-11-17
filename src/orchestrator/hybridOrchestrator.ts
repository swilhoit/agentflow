import { GroqClient } from './groqClient';
import { ClaudeClient } from './claudeClient';
import { logger } from '../utils/logger';
import { OrchestratorRequest } from '../types';

export interface HybridResponse {
  success: boolean;
  message: string;
  model: 'groq' | 'claude';
  responseTime: number;
  functionCall?: {
    name: string;
    arguments: any;
  };
  taskId?: string;
  agentIds?: string[];
  executionPlan?: string[];
  error?: string;
}

/**
 * Hybrid Orchestrator - Routes between Groq (fast) and Claude (quality)
 *
 * Routing Strategy:
 * 1. Simple queries → Groq (10-20x faster)
 * 2. Function calls/commands → Groq (fast routing)
 * 3. Complex reasoning → Claude (higher quality)
 */
export class HybridOrchestrator {
  private groqClient: GroqClient | null;
  private claudeClient: ClaudeClient;
  private useGroq: boolean;

  constructor(anthropicApiKey: string, groqApiKey?: string) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
    this.groqClient = groqApiKey ? new GroqClient(groqApiKey) : null;
    this.useGroq = !!this.groqClient;

    if (this.useGroq) {
      logger.info('🚀 Hybrid Orchestrator enabled with Groq for fast inference');
    } else {
      logger.info('Using Claude-only orchestrator (Groq not configured)');
    }
  }

  /**
   * Process command with smart routing
   *
   * IMPORTANT: For multi-step tasks, GitHub/Trello operations, or anything requiring
   * conversation context, we ALWAYS use Claude (not Groq) because:
   * - Claude has conversation history (remembers previous context)
   * - Claude has Trello/GitHub tool access
   * - Claude can execute multi-step workflows
   *
   * Groq is ONLY for truly simple queries like "what's the weather" or "hello"
   */
  async processCommand(request: OrchestratorRequest): Promise<HybridResponse> {
    const startTime = Date.now();

    try {
      logger.info(`🔄 Processing: "${request.command.substring(0, 100)}..."`);

      // If Groq is not available, fall back to Claude
      if (!this.groqClient) {
        return await this.processWithClaude(request, startTime);
      }

      // Classify intent
      const intent = await this.groqClient.classifyIntent(request.command);

      // OVERRIDE: Always use Claude for anything that might need context or tools
      const commandLower = request.command.toLowerCase();
      const requiresClaude =
        commandLower.includes('trello') ||
        commandLower.includes('github') ||
        commandLower.includes('create') ||
        commandLower.includes('list') ||
        commandLower.includes('show') ||
        commandLower.includes('get') ||
        commandLower.includes('repo') ||
        commandLower.includes('card') ||
        commandLower.includes('board') ||
        commandLower.includes('deploy') ||
        commandLower.includes('run') ||
        commandLower.includes('execute') ||
        commandLower.includes('analyze') ||
        commandLower.includes('fetch') ||
        commandLower.includes('go through') ||
        commandLower.includes('my ') || // "my repos", "my boards", etc.
        intent === 'complex';

      if (requiresClaude) {
        logger.info('🧠 Using Claude (requires context/tools)');
        return await this.processWithClaude(request, startTime);
      } else {
        // Use Groq ONLY for truly simple queries
        logger.info('⚡ Using Groq (simple query)');
        return await this.processWithGroq(request, startTime);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Hybrid orchestrator error:', errorMessage);

      // Fall back to Claude if Groq fails
      try {
        logger.warn('⚠️ Falling back to Claude due to error');
        return await this.processWithClaude(request, startTime);
      } catch (claudeError) {
        const claudeErrorMsg = claudeError instanceof Error ? claudeError.message : 'Unknown error';
        logger.error('❌ Both Groq and Claude failed:', claudeErrorMsg);

        return {
          success: false,
          message: `I encountered an error while processing your request: ${claudeErrorMsg}`,
          model: 'claude',
          responseTime: Date.now() - startTime,
          error: claudeErrorMsg
        };
      }
    }
  }

  /**
   * Process with Groq (fast path)
   */
  private async processWithGroq(
    request: OrchestratorRequest,
    startTime: number
  ): Promise<HybridResponse> {
    if (!this.groqClient) {
      throw new Error('Groq client not initialized');
    }

    logger.info('⚡ Using Groq (fast path)');

    const systemPrompt = `You are AgentFlow, a command executor for the user's system.

USER'S SYSTEM HAS: gh CLI (GitHub authenticated as swilhoit), gcloud CLI (GCP authenticated).

When user asks about "my GitHub repos" or "my Google Cloud projects":
- DO NOT say you lack access
- DO NOT ask for authentication
- Say: "Let me run that command" and describe what you'd run (e.g., "gh repo list")

For simple questions, answer directly in 1-2 sentences.
Keep responses concise and helpful.`;

    const response = await this.groqClient.processSimpleQuery(
      request.command,
      systemPrompt
    );

    return {
      success: true,
      message: response.message,
      model: 'groq',
      responseTime: Date.now() - startTime
    };
  }

  /**
   * Process with Claude (quality path)
   */
  private async processWithClaude(
    request: OrchestratorRequest,
    startTime: number
  ): Promise<HybridResponse> {
    logger.info('🧠 Using Claude (quality path)');

    const response = await this.claudeClient.processCommand(request);

    return {
      ...response,
      model: 'claude',
      responseTime: Date.now() - startTime
    };
  }

  /**
   * Process with function calling (Groq for speed, Claude for complex)
   */
  async processWithFunctions(
    userMessage: string,
    functions: any[]
  ): Promise<HybridResponse> {
    const startTime = Date.now();

    try {
      if (!this.groqClient) {
        // No Groq, use Claude
        logger.info('Using Claude for function calling (Groq not available)');
        const systemPrompt = 'You are a helpful AI assistant. Use the provided functions when appropriate.';
        const response = await this.claudeClient.processCommand({
          command: userMessage,
          context: {
            userId: 'system',
            guildId: 'system',
            channelId: 'system',
            timestamp: new Date()
          }
        });

        return {
          ...response,
          model: 'claude',
          responseTime: Date.now() - startTime
        };
      }

      // Use Groq for fast function calling
      logger.info('⚡ Using Groq for function routing');

      const systemPrompt = `You are AgentFlow's function router. Analyze the user's request and call the appropriate function.
If the request is a simple query that doesn't need a function, respond directly.`;

      const response = await this.groqClient.processWithFunctions(
        userMessage,
        functions,
        systemPrompt
      );

      return {
        success: true,
        message: response.message,
        model: 'groq',
        functionCall: response.functionCall,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Function processing error', error);
      return {
        success: false,
        message: '',
        model: 'groq',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
