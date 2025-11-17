import Groq from 'groq-sdk';
import { logger } from '../utils/logger';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqResponse {
  message: string;
  functionCall?: {
    name: string;
    arguments: any;
  };
  tokensUsed?: number;
  responseTime?: number;
}

/**
 * Groq Client for ultra-fast LLM inference
 * Using Llama 3.1 70B for 10-20x faster responses than Claude
 */
export class GroqClient {
  private client: Groq;
  private model: string = 'llama-3.3-70b-versatile';

  constructor(apiKey: string) {
    this.client = new Groq({
      apiKey
    });
  }

  /**
   * Fast inference for simple queries and quick responses
   */
  async processSimpleQuery(
    userMessage: string,
    systemPrompt?: string,
    conversationHistory?: GroqMessage[]
  ): Promise<GroqResponse> {
    const startTime = Date.now();

    try {
      const messages: GroqMessage[] = [];

      // Add system prompt
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      } else {
        messages.push({
          role: 'system',
          content: `You are AgentFlow, an AI assistant that helps with cloud deployments, coding, and DevOps tasks.
You are conversational, concise, and helpful. Keep responses brief and to the point since you're in a voice chat.
For simple questions, answer directly. For complex tasks, you can delegate to specialized agents.`
        });
      }

      // Add conversation history if provided
      if (conversationHistory) {
        messages.push(...conversationHistory);
      }

      // Add user message
      messages.push({
        role: 'user',
        content: userMessage
      });

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 500, // Keep responses concise for voice
        top_p: 1,
        stream: false
      });

      const responseTime = Date.now() - startTime;
      const message = completion.choices[0]?.message?.content || '';

      logger.info(`Groq response generated in ${responseTime}ms (${completion.usage?.total_tokens || 0} tokens)`);

      return {
        message,
        tokensUsed: completion.usage?.total_tokens,
        responseTime
      };
    } catch (error) {
      logger.error('Groq API error', error);
      throw error;
    }
  }

  /**
   * Process with function calling for routing decisions
   */
  async processWithFunctions(
    userMessage: string,
    functions: any[],
    systemPrompt?: string
  ): Promise<GroqResponse> {
    const startTime = Date.now();

    try {
      const messages: GroqMessage[] = [];

      // Add system prompt
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      messages.push({
        role: 'user',
        content: userMessage
      });

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: functions.map(fn => ({
          type: 'function',
          function: fn
        })),
        tool_choice: 'auto',
        temperature: 0.5,
        max_tokens: 1000
      });

      const responseTime = Date.now() - startTime;
      const choice = completion.choices[0];

      // Check if function was called
      if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCall = choice.message.tool_calls[0];
        const functionCall = {
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments)
        };

        logger.info(`Groq function call in ${responseTime}ms: ${functionCall.name}`);

        return {
          message: choice.message.content || '',
          functionCall,
          tokensUsed: completion.usage?.total_tokens,
          responseTime
        };
      }

      // No function call, return text response
      return {
        message: choice?.message?.content || '',
        tokensUsed: completion.usage?.total_tokens,
        responseTime
      };
    } catch (error) {
      logger.error('Groq API error with functions', error);
      throw error;
    }
  }

  /**
   * Classify intent: simple query vs complex task
   * Returns: 'simple' | 'complex'
   */
  async classifyIntent(userMessage: string): Promise<'simple' | 'complex'> {
    const startTime = Date.now();

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a routing classifier. Analyze the user's message and determine if it's:
- SIMPLE: Quick questions, status checks, greetings, acknowledgments, general info
- COMPLEX: Deployment tasks, code generation, multi-step operations, debugging, GitHub/GCP queries, system commands

Respond with ONLY one word: "simple" or "complex"`
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.3,
        max_tokens: 10
      });

      const classification = completion.choices[0]?.message?.content?.toLowerCase().trim() || 'complex';
      const intent = classification.includes('simple') ? 'simple' : 'complex';

      const responseTime = Date.now() - startTime;
      logger.info(`Intent classified as "${intent}" in ${responseTime}ms`);

      return intent;
    } catch (error) {
      logger.error('Intent classification error, defaulting to complex', error);
      return 'complex'; // Default to complex if error
    }
  }
}
