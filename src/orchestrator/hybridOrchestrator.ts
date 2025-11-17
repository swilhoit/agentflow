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
   */
  async processCommand(request: OrchestratorRequest): Promise<HybridResponse> {
    const startTime = Date.now();

    try {
      // If Groq is not available, fall back to Claude
      if (!this.groqClient) {
        return await this.processWithClaude(request, startTime);
      }

      // Classify intent
      const intent = await this.groqClient.classifyIntent(request.command);

      if (intent === 'simple') {
        // Use Groq for simple queries (10-20x faster!)
        return await this.processWithGroq(request, startTime);
      } else {
        // Use Claude for complex tasks (better reasoning)
        return await this.processWithClaude(request, startTime);
      }
    } catch (error) {
      logger.error('Hybrid orchestrator error', error);

      // Fall back to Claude if Groq fails
      try {
        logger.warn('Falling back to Claude due to Groq error');
        return await this.processWithClaude(request, startTime);
      } catch (claudeError) {
        return {
          success: false,
          message: '',
          model: 'claude',
          responseTime: Date.now() - startTime,
          error: claudeError instanceof Error ? claudeError.message : 'Unknown error'
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

    const systemPrompt = `You are AgentFlow, an AI assistant for cloud deployments and DevOps.
You help with deployments, monitoring, and development tasks.

Keep responses concise and conversational since this is voice chat.
For simple questions, answer directly in 1-3 sentences.`;

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
