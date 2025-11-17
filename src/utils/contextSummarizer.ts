import { logger } from './logger';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Context Summarizer
 * Summarizes older conversation messages to reduce token count
 */

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export class ContextSummarizer {
  private client: Anthropic;
  private summarizationCache: Map<string, string> = new Map();

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Summarize older messages, keep recent ones full
   */
  async summarizeContext(
    messages: Message[],
    keepRecentCount: number = 10
  ): Promise<Message[]> {
    if (messages.length <= keepRecentCount) {
      logger.info('[Summarizer] No summarization needed - message count within limit');
      return messages;
    }

    const oldMessages = messages.slice(0, -keepRecentCount);
    const recentMessages = messages.slice(-keepRecentCount);

    // Check cache
    const cacheKey = this.generateCacheKey(oldMessages);
    let summary = this.summarizationCache.get(cacheKey);

    if (!summary) {
      logger.info(`[Summarizer] Summarizing ${oldMessages.length} old messages...`);
      summary = await this.generateSummary(oldMessages);
      this.summarizationCache.set(cacheKey, summary);
    } else {
      logger.info('[Summarizer] Using cached summary');
    }

    // Return: [summary message] + [recent messages]
    return [
      {
        role: 'user',
        content: `📝 CONVERSATION SUMMARY (${oldMessages.length} messages):\n\n${summary}\n\n--- Recent messages below (full context) ---`
      },
      ...recentMessages
    ];
  }

  /**
   * Generate summary using Claude
   */
  private async generateSummary(messages: Message[]): Promise<string> {
    try {
      const conversationText = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Please provide a concise summary of this conversation, focusing on:
1. Key topics discussed
2. Important decisions made
3. Tasks completed
4. Current context/state

Conversation:
${conversationText}

Summary (be concise but capture all important context):`
          }
        ]
      });

      const summaryText = response.content
        .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      logger.info(`[Summarizer] Generated summary (${summaryText.length} characters)`);
      return summaryText;
    } catch (error) {
      logger.error('[Summarizer] Failed to generate summary:', error);
      // Fallback: Simple truncation
      return messages
        .map(m => `${m.role}: ${m.content.substring(0, 100)}...`)
        .join('\n');
    }
  }

  /**
   * Generate cache key from messages
   */
  private generateCacheKey(messages: Message[]): string {
    // Use first + last message content + count as cache key
    const first = messages[0]?.content.substring(0, 50) || '';
    const last = messages[messages.length - 1]?.content.substring(0, 50) || '';
    return `${first}|${last}|${messages.length}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.summarizationCache.clear();
    logger.info('[Summarizer] Cache cleared');
  }
}

/**
 * Fast summarization for conversation context
 * Uses pattern matching instead of AI for speed
 */
export function quickSummarize(messages: Message[], maxLength: number = 500): string {
  const important: string[] = [];

  for (const msg of messages) {
    const content = msg.content.toLowerCase();
    
    // Extract important information
    if (content.includes('task complete') || content.includes('completed')) {
      important.push(`✅ Completed: ${msg.content.substring(0, 100)}`);
    } else if (content.includes('error') || content.includes('failed')) {
      important.push(`❌ Error: ${msg.content.substring(0, 100)}`);
    } else if (content.includes('found') || content.includes('created')) {
      important.push(`📊 Result: ${msg.content.substring(0, 100)}`);
    }
  }

  let summary = important.join('\n');
  
  // Truncate if too long
  if (summary.length > maxLength) {
    summary = summary.substring(0, maxLength) + '...';
  }

  return summary || 'Previous conversation context available.';
}

