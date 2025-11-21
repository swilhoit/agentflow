import Anthropic from '@anthropic-ai/sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { TrelloService } from '../services/trello';
import { TaskDecomposer, TaskAnalysis, SubTask } from '../utils/taskDecomposer';
import { SmartIterationCalculator } from '../utils/smartIterationCalculator';
import { globalCache, isCacheable, SmartCache, startCacheCleanup } from '../utils/smartCache';
import { executeWithRetry, validateToolResult, compressResult, isRateLimited, getRetryAfter } from '../utils/resultValidator';
import { buildSystemPrompt } from '../prompts/agentPrompts';

const execAsync = promisify(exec);

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface AgentTask {
  command: string;
  context: {
    userId: string;
    guildId: string;
    channelId: string;
    conversationHistory?: string; // Recent conversation context for continuity
  };
}

export interface AgentResult {
  success: boolean;
  message: string;
  iterations: number;
  toolCalls: number;
  error?: string;
}

/**
 * Tool-based Agent using native Anthropic Tool Use API
 *
 * This is the same approach Claude Code/Cursor uses - no external CLI needed!
 * Claude directly calls tools, sees results, and iterates until task is complete.
 */
export class ToolBasedAgent {
  private client: Anthropic;
  private trelloService?: TrelloService;
  private notificationHandler?: (message: string) => Promise<void>;
  private maxIterations = 15;
  private taskDecomposer: TaskDecomposer;

  constructor(apiKey: string, trelloService?: TrelloService) {
    this.client = new Anthropic({ apiKey });
    this.trelloService = trelloService;
    this.taskDecomposer = new TaskDecomposer(apiKey);
  }

  setNotificationHandler(handler: (message: string) => Promise<void>): void {
    this.notificationHandler = handler;
  }

  private async notify(message: string): Promise<void> {
    if (this.notificationHandler) {
      try {
        logger.info(`📢 Sending notification: ${message.substring(0, 100)}...`);
        await this.notificationHandler(message);
        logger.info('✅ Notification sent successfully');
      } catch (error) {
        logger.error('❌ Failed to send notification', error);
        logger.error('Notification content:', message);
      }
    } else {
      logger.error('⚠️⚠️⚠️ NO NOTIFICATION HANDLER SET - USER WILL NOT SEE THIS! ⚠️⚠️⚠️');
      logger.error('Message that should have been sent to user:', message);
      logger.error('This indicates a serious configuration error - notifications are critical for UX!');
    }
  }

  /**
   * Define available tools
   */
  private getTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [
      {
        name: 'execute_bash',
        description: 'Execute a bash command and return the output. Use this for file operations, git commands, npm, etc.',
        input_schema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The bash command to execute'
            }
          },
          required: ['command']
        }
      }
    ];

    // Add Trello tools if service is available
    if (this.trelloService) {
      tools.push(
        {
          name: 'trello_list_boards',
          description: 'List all Trello boards',
          input_schema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'trello_get_board',
          description: 'Get a specific Trello board by name',
          input_schema: {
            type: 'object',
            properties: {
              boardName: {
                type: 'string',
                description: 'Name of the board to find'
              }
            },
            required: ['boardName']
          }
        },
        {
          name: 'trello_create_list',
          description: 'Create a new list on a Trello board',
          input_schema: {
            type: 'object',
            properties: {
              boardName: {
                type: 'string',
                description: 'Name of the board'
              },
              listName: {
                type: 'string',
                description: 'Name for the new list'
              }
            },
            required: ['boardName', 'listName']
          }
        },
        {
          name: 'trello_create_card',
          description: 'Create a new card on a Trello list',
          input_schema: {
            type: 'object',
            properties: {
              boardName: {
                type: 'string',
                description: 'Name of the board'
              },
              listName: {
                type: 'string',
                description: 'Name of the list to add the card to'
              },
              cardName: {
                type: 'string',
                description: 'Title of the card'
              },
              description: {
                type: 'string',
                description: 'Description for the card (optional)'
              }
            },
            required: ['boardName', 'listName', 'cardName']
          }
        },
        {
          name: 'trello_list_cards',
          description: 'List all cards on a Trello board',
          input_schema: {
            type: 'object',
            properties: {
              boardName: {
                type: 'string',
                description: 'Name of the board'
              }
            },
            required: ['boardName']
          }
        },
        {
          name: 'trello_update_card',
          description: 'Update an existing Trello card (name, description, due date, list, position, labels, members)',
          input_schema: {
            type: 'object',
            properties: {
              boardName: {
                type: 'string',
                description: 'Name of the board containing the card'
              },
              cardName: {
                type: 'string',
                description: 'Current name of the card to update'
              },
              newName: {
                type: 'string',
                description: 'New name for the card (optional)'
              },
              newDescription: {
                type: 'string',
                description: 'New description for the card (optional)'
              },
              newListName: {
                type: 'string',
                description: 'Name of list to move card to (optional)'
              },
              dueDate: {
                type: 'string',
                description: 'Due date in ISO format (optional)'
              }
            },
            required: ['boardName', 'cardName']
          }
        },
        {
          name: 'trello_get_lists',
          description: 'Get all lists on a Trello board',
          input_schema: {
            type: 'object',
            properties: {
              boardName: {
                type: 'string',
                description: 'Name of the board'
              }
            },
            required: ['boardName']
          }
        },
        {
          name: 'trello_search_cards',
          description: 'Search for cards across boards by text query',
          input_schema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query text'
              },
              boardName: {
                type: 'string',
                description: 'Optional board name to limit search to'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'trello_add_comment',
          description: 'Add a comment to a Trello card',
          input_schema: {
            type: 'object',
            properties: {
              boardName: {
                type: 'string',
                description: 'Name of the board'
              },
              cardName: {
                type: 'string',
                description: 'Name of the card to comment on'
              },
              comment: {
                type: 'string',
                description: 'Comment text to add'
              }
            },
            required: ['boardName', 'cardName', 'comment']
          }
        },
        {
          name: 'trello_archive_card',
          description: 'Archive (close) a Trello card',
          input_schema: {
            type: 'object',
            properties: {
              boardName: {
                type: 'string',
                description: 'Name of the board'
              },
              cardName: {
                type: 'string',
                description: 'Name of the card to archive'
              }
            },
            required: ['boardName', 'cardName']
          }
        },
        {
          name: 'trello_add_checklist',
          description: 'Add a checklist to a Trello card',
          input_schema: {
            type: 'object',
            properties: {
              boardName: {
                type: 'string',
                description: 'Name of the board'
              },
              cardName: {
                type: 'string',
                description: 'Name of the card'
              },
              checklistName: {
                type: 'string',
                description: 'Name for the checklist'
              },
              items: {
                type: 'array',
                description: 'Array of checklist item names (optional)',
                items: {
                  type: 'string'
                }
              }
            },
            required: ['boardName', 'cardName', 'checklistName']
          }
        }
      );
    }

    return tools;
  }

  /**
   * Execute a tool call (with caching, retry, and validation)
   */
  private async executeTool(toolName: string, toolInput: any): Promise<any> {
    logger.info(`🔧 Executing tool: ${toolName}`);

    // OPTIMIZATION 1: Check cache first
    const cacheability = isCacheable(toolName, toolInput);
    if (cacheability.cacheable) {
      const cacheKey = SmartCache.generateKey(toolName, toolInput);
      const cached = globalCache.get(cacheKey);
      
      if (cached) {
        logger.info(`⚡ CACHE HIT for ${toolName} - instant response!`);
        return cached;
      }
    }

    // OPTIMIZATION 2: Execute with retry logic
    try {
      const result = await executeWithRetry(
        async () => await this.executeToolInternal(toolName, toolInput),
        { maxRetries: 2, retryDelay: 1000, backoffMultiplier: 2 },
        `${toolName} call`
      );

      // OPTIMIZATION 3: Validate result
      const validation = validateToolResult(result, toolName);
      if (!validation.valid) {
        logger.warn(`[Validator] Invalid result from ${toolName}: ${validation.error}`);
      }

      // OPTIMIZATION 4: Compress large results
      const compressed = compressResult(result, 2000);

      // OPTIMIZATION 5: Cache successful results
      if (cacheability.cacheable && result.success) {
        const cacheKey = SmartCache.generateKey(toolName, toolInput);
        globalCache.set(cacheKey, compressed, cacheability.ttl);
      }

      // OPTIMIZATION 6: Handle rate limiting
      if (isRateLimited(result)) {
        const retryAfter = getRetryAfter(result);
        if (retryAfter) {
          logger.warn(`[Rate Limited] Waiting ${retryAfter}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, retryAfter));
        }
      }

      return compressed;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Tool execution failed: ${toolName}`, error);
      return { error: errorMessage, success: false };
    }
  }

  /**
   * Internal tool execution (without caching/retry)
   */
  private async executeToolInternal(toolName: string, toolInput: any): Promise<any> {
    switch (toolName) {
      case 'execute_bash':
        return await this.executeBash(toolInput.command);

      case 'trello_list_boards':
        return await this.trelloListBoards();

      case 'trello_get_board':
        return await this.trelloGetBoard(toolInput.boardName);

      case 'trello_create_list':
        // Invalidate cache on mutations
        globalCache.invalidatePattern('trello_.*');
        return await this.trelloCreateList(toolInput.boardName, toolInput.listName);

      case 'trello_create_card':
        // Invalidate cache on mutations
        globalCache.invalidatePattern('trello_.*');
        return await this.trelloCreateCard(
          toolInput.boardName,
          toolInput.listName,
          toolInput.cardName,
          toolInput.description
        );

      case 'trello_list_cards':
        return await this.trelloListCards(toolInput.boardName);

      // Extended Trello operations - for now, suggest using execute_bash with curl
      case 'trello_update_card':
      case 'trello_get_lists':
      case 'trello_search_cards':
      case 'trello_add_comment':
      case 'trello_archive_card':
      case 'trello_add_checklist':
        return {
          success: false,
          error: `Tool '${toolName}' not yet implemented. Use execute_bash with curl or Trello API for advanced operations.`,
          suggestion: `Example: execute_bash("curl -X GET 'https://api.trello.com/1/boards/...')"}`
        };

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Execute bash command with full credential access
   */
  private async executeBash(command: string): Promise<any> {
    try {
      logger.info(`Running: ${command}`);
      
      // Build environment with all necessary credentials
      const execEnv: Record<string, string> = {
        ...process.env as Record<string, string>,
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        HOME: process.env.HOME || require('os').homedir(),
      };

      // GitHub credentials
      if (process.env.GITHUB_TOKEN) {
        execEnv.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        execEnv.GH_TOKEN = process.env.GITHUB_TOKEN;
      } else if (process.env.GH_TOKEN) {
        execEnv.GH_TOKEN = process.env.GH_TOKEN;
        execEnv.GITHUB_TOKEN = process.env.GH_TOKEN;
      }

      // Google Cloud credentials
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        execEnv.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
      if (process.env.CLOUDSDK_CONFIG) {
        execEnv.CLOUDSDK_CONFIG = process.env.CLOUDSDK_CONFIG;
      } else {
        execEnv.CLOUDSDK_CONFIG = `${require('os').homedir()}/.config/gcloud`;
      }
      if (process.env.GCP_PROJECT_ID) {
        execEnv.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
        execEnv.GOOGLE_CLOUD_PROJECT = process.env.GCP_PROJECT_ID;
      }

      // Trello credentials (for CLI tools if needed)
      if (process.env.TRELLO_API_KEY) {
        execEnv.TRELLO_API_KEY = process.env.TRELLO_API_KEY;
      }
      if (process.env.TRELLO_API_TOKEN) {
        execEnv.TRELLO_API_TOKEN = process.env.TRELLO_API_TOKEN;
      }

      logger.info(`Environment prepared with credentials for: ${Object.keys(execEnv).filter(k => k.includes('TOKEN') || k.includes('KEY') || k.includes('CREDENTIALS')).join(', ')}`);

      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        env: execEnv
      });

      return {
        success: true,
        stdout: stdout || '(no output)',
        stderr: stderr || '',
        exitCode: 0
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1
      };
    }
  }

  /**
   * Trello: List boards
   */
  private async trelloListBoards(): Promise<any> {
    if (!this.trelloService) {
      return { error: 'Trello service not available', success: false };
    }

    const boards = await this.trelloService.getBoards();
    return {
      success: true,
      boards: boards.map(b => ({ id: b.id, name: b.name }))
    };
  }

  /**
   * Trello: Get board by name
   */
  private async trelloGetBoard(boardName: string): Promise<any> {
    if (!this.trelloService) {
      return { error: 'Trello service not available', success: false };
    }

    const board = await this.trelloService.findBoardByName(boardName);
    if (!board) {
      return { error: `Board not found: ${boardName}`, success: false };
    }

    return { success: true, board: { id: board.id, name: board.name } };
  }

  /**
   * Trello: Create list
   */
  private async trelloCreateList(boardName: string, listName: string): Promise<any> {
    if (!this.trelloService) {
      return { error: 'Trello service not available', success: false };
    }

    const board = await this.trelloService.findBoardByName(boardName);
    if (!board) {
      return { error: `Board not found: ${boardName}`, success: false };
    }

    // createList signature is (name, boardId) - NOT (boardId, name)!
    const list = await this.trelloService.createList(listName, board.id);
    return { success: true, list: { id: list.id, name: list.name } };
  }

  /**
   * Trello: Create card
   */
  private async trelloCreateCard(
    boardName: string,
    listName: string,
    cardName: string,
    description?: string
  ): Promise<any> {
    if (!this.trelloService) {
      return { error: 'Trello service not available', success: false };
    }

    const board = await this.trelloService.findBoardByName(boardName);
    if (!board) {
      return { error: `Board not found: ${boardName}`, success: false };
    }

    const lists = await this.trelloService.getLists(board.id);
    const list = lists.find(l => l.name.toLowerCase() === listName.toLowerCase());

    if (!list) {
      return { error: `List not found: ${listName} on board ${boardName}`, success: false };
    }

    const card = await this.trelloService.createCard({
      idList: list.id,
      name: cardName,
      desc: description || ''
    });
    return { success: true, card: { id: card.id, name: card.name, url: card.url } };
  }

  /**
   * Trello: List cards
   */
  private async trelloListCards(boardName: string): Promise<any> {
    if (!this.trelloService) {
      return { error: 'Trello service not available', success: false };
    }

    const board = await this.trelloService.findBoardByName(boardName);
    if (!board) {
      return { error: `Board not found: ${boardName}`, success: false };
    }

    const cards = await this.trelloService.getCardsOnBoard(board.id);
    return {
      success: true,
      cards: cards.map((c: any) => ({ id: c.id, name: c.name, listId: c.idList }))
    };
  }

  /**
   * Execute task with iterative tool calling
   */
  /**
   * Enhanced executeTask with automatic task decomposition
   */
  async executeTask(task: AgentTask): Promise<AgentResult> {
    // Step 1: Quick heuristic check (fast, no AI call needed for simple tasks)
    const taskType = (task as any).context?.taskType;
    const quickEstimate = SmartIterationCalculator.calculate(task.command, taskType);
    
    logger.info(`⚡ Quick Analysis: ${SmartIterationCalculator.getSummary(quickEstimate)}`);
    logger.info(`   Confidence: ${quickEstimate.confidence}, Recommended: ${quickEstimate.recommended} iterations`);
    
    // Step 2: For simple tasks with high confidence, skip expensive deep analysis
    // AGGRESSIVE OPTIMIZATION: Skip deep analysis for anything under 8 iterations with high confidence
    if (quickEstimate.recommended <= 8 && quickEstimate.confidence === 'high') {
      logger.info(`⚡ Fast path: Using ${quickEstimate.recommended} iterations (skipping deep analysis)`);
      await this.notify(`⚡ **Quick Task** (${quickEstimate.recommended} iterations)\n${quickEstimate.reasoning}`);
      return await this.executeSimpleTask(task, quickEstimate.recommended);
    }
    
    // Also skip deep analysis for medium confidence if under 6 iterations
    if (quickEstimate.recommended <= 6 && quickEstimate.confidence === 'medium') {
      logger.info(`⚡ Fast path: Using ${quickEstimate.recommended} iterations (medium confidence, skipping deep analysis)`);
      await this.notify(`⚡ **Quick Task** (${quickEstimate.recommended} iterations)\n${quickEstimate.reasoning}`);
      return await this.executeSimpleTask(task, quickEstimate.recommended);
    }
    
    // Step 3: For complex tasks or uncertain cases, do deep AI analysis
    logger.info(`🔍 Task needs deep analysis - running AI-powered complexity assessment...`);
    await this.notify(`🔍 **Analyzing Task Complexity**\nDetermining optimal execution strategy...`);
    
    const analysis = await this.taskDecomposer.analyzeTask(task.command);
    
    logger.info(`📊 Deep Analysis Result: ${analysis.complexity} complexity`);
    logger.info(`📊 Estimated iterations: ${analysis.estimatedIterations}`);
    logger.info(`📊 Requires decomposition: ${analysis.requiresDecomposition}`);
    
    // Notify user of the detailed plan
    await this.notify(
      `📊 **Task Analysis Complete**\n\n` +
      `**Complexity:** ${analysis.complexity}\n` +
      `**Estimated Iterations:** ${analysis.estimatedIterations}\n` +
      `**Strategy:** ${analysis.requiresDecomposition ? `Breaking into ${analysis.subtasks.length} subtasks` : 'Direct execution'}\n\n` +
      `**Reasoning:** ${analysis.reasoning}`
    );

    // Step 4: Execute based on complexity
    if (analysis.requiresDecomposition && analysis.subtasks.length > 0) {
      logger.info(`🔧 Decomposing task into ${analysis.subtasks.length} subtasks`);
      return await this.executeDecomposedTask(task, analysis);
    } else {
      // Direct execution with optimized iteration limit (CAP AT 15 for simple tasks)
      let iterationLimit = this.taskDecomposer.calculateIterationLimit(analysis);
      if (analysis.complexity === 'simple' || analysis.complexity === 'moderate') {
        iterationLimit = Math.min(iterationLimit, 10); // Cap simple/moderate at 10
      }
      logger.info(`⚡ Executing task directly with ${iterationLimit} iteration limit`);
      return await this.executeSimpleTask(task, iterationLimit);
    }
  }

  /**
   * Execute decomposed task as multiple subtasks
   */
  private async executeDecomposedTask(task: AgentTask, analysis: TaskAnalysis): Promise<AgentResult> {
    await this.notify(`🚀 **Starting Decomposed Execution**\n${analysis.subtasks.length} subtasks identified`);
    
    const executionBatches = this.taskDecomposer.getExecutionOrder(analysis.subtasks);
    let totalIterations = 0;
    let totalToolCalls = 0;
    const results: string[] = [];

    logger.info(`📋 Execution plan: ${executionBatches.length} batches`);
    
    for (let batchIndex = 0; batchIndex < executionBatches.length; batchIndex++) {
      const batch = executionBatches[batchIndex];
      const batchType = batch[0]?.type || 'sequential';
      
      await this.notify(
        `📦 **Batch ${batchIndex + 1}/${executionBatches.length}**\n` +
        `${batch.length} task(s) - ${batchType} execution`
      );

      if (batchType === 'parallel' && batch.length > 1) {
        // Execute in parallel
        logger.info(`⚡ Executing ${batch.length} tasks in parallel`);
        const batchResults = await Promise.all(
          batch.map(subtask => this.executeSubtask(task, subtask))
        );
        
        batchResults.forEach(result => {
          totalIterations += result.iterations;
          totalToolCalls += result.toolCalls;
          if (result.message) results.push(result.message);
        });
      } else {
        // Execute sequentially
        logger.info(`🔄 Executing ${batch.length} tasks sequentially`);
        for (const subtask of batch) {
          const result = await this.executeSubtask(task, subtask);
          totalIterations += result.iterations;
          totalToolCalls += result.toolCalls;
          if (result.message) results.push(result.message);
          
          if (!result.success) {
            logger.warn(`⚠️ Subtask failed: ${subtask.description}`);
            await this.notify(`⚠️ **Subtask Failed**\n${subtask.description}\n\nContinuing with remaining tasks...`);
          }
        }
      }
    }

    const success = results.length > 0;
    const summary = results.join('\n\n');

    return {
      success,
      message: summary || 'All subtasks completed',
      iterations: totalIterations,
      toolCalls: totalToolCalls
    };
  }

  /**
   * Execute a single subtask
   */
  private async executeSubtask(parentTask: AgentTask, subtask: SubTask): Promise<AgentResult> {
    logger.info(`📝 Executing subtask: ${subtask.description}`);
    await this.notify(`📝 **Subtask ${subtask.id}**\n${subtask.description}\n_(Est. ${subtask.estimatedIterations} iterations)_`);
    
    const subtaskCommand: AgentTask = {
      ...parentTask,
      command: subtask.description
    };
    
    // Execute with estimated iteration limit
    const result = await this.executeSimpleTask(subtaskCommand, subtask.estimatedIterations + 5);
    
    if (result.success) {
      await this.notify(`✅ **Subtask Complete:** ${subtask.id}\n${result.iterations} iterations, ${result.toolCalls} tool calls`);
    }
    
    return result;
  }

  /**
   * Execute a simple task without decomposition
   */
  private async executeSimpleTask(task: AgentTask, iterationLimit?: number): Promise<AgentResult> {
    const maxIter = iterationLimit || this.maxIterations;
    const conversationHistory: Anthropic.MessageParam[] = [];
    let iterations = 0;
    let toolCalls = 0;
    let continueLoop = true;

    // Initial user message
    conversationHistory.push({
      role: 'user',
      content: buildSystemPrompt({
        command: task.command,
        conversationHistory: task.context.conversationHistory,
        hasTrello: !!this.trelloService
      })
    });

    await this.notify(`🤖 **Agent Started**\n\`\`\`\n${task.command}\n\`\`\``);

    try {
      while (continueLoop && iterations < maxIter) {
        iterations++;
        logger.info(`🔄 Iteration ${iterations}/${maxIter}`);
        await this.notify(`🔄 **Iteration ${iterations}/${maxIter}**\nProcessing...`);

        // Call Claude with tools (WITH TIMEOUT!)
        const TIMEOUT_MS = 60000; // 60 second timeout per iteration
        const response = await Promise.race([
          this.client.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: 4096,
            tools: this.getTools(),
            messages: conversationHistory
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Iteration ${iterations} timed out after ${TIMEOUT_MS/1000}s`)), TIMEOUT_MS)
          )
        ]);

        // Add assistant response to history
        conversationHistory.push({
          role: 'assistant',
          content: response.content
        });

        // OPTIMIZATION: Early completion detection
        const textContent = response.content
          .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
          .map(block => block.text)
          .join(' ')
          .toLowerCase();

        const completionPhrases = [
          'task complete', 'task is complete', 'all done', 'finished successfully',
          'task has been completed', 'successfully completed', 'work is complete',
          'everything is done', 'task is now complete', 'completed successfully'
        ];

        const hasCompletionPhrase = completionPhrases.some(phrase => textContent.includes(phrase));
        
        // If task appears complete and we've made at least one tool call, stop early
        if (hasCompletionPhrase && toolCalls > 0 && response.stop_reason !== 'tool_use') {
          logger.info(`✅ Early completion detected at iteration ${iterations}/${maxIter} - stopping!`);
          await this.notify(`✅ **Task Complete** (early stop at iteration ${iterations}/${maxIter})`);
          continueLoop = false;
          break;
        }

        // Check if Claude wants to use tools
        if (response.stop_reason === 'tool_use') {
          const toolUses = response.content.filter(
            (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
          );

          logger.info(`🔧 Claude requested ${toolUses.length} tool call(s)`);

          // OPTIMIZATION: Execute tools in parallel for speed
          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

          // Fire all notifications at once (non-blocking)
          toolUses.forEach((toolUse, index) => {
            this.notify(
              `🔧 **Tool Call ${toolCalls + index + 1}**\n**Tool:** \`${toolUse.name}\`\n**Input:** \`\`\`json\n${JSON.stringify(toolUse.input, null, 2)}\n\`\`\``
            );
          });

          // Execute all tools in parallel!
          const toolExecutionPromises = toolUses.map(async (toolUse) => {
            toolCalls++;
            const result = await this.executeTool(toolUse.name, toolUse.input);
            
            // Send result notification (non-blocking)
            const resultPreview = JSON.stringify(result).substring(0, 300);
            this.notify(
              `✅ **Tool Result**\n\`\`\`json\n${resultPreview}${JSON.stringify(result).length > 300 ? '...' : ''}\n\`\`\``
            );

            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: JSON.stringify(result)
            };
          });

          // Wait for all tools to complete
          toolResults.push(...await Promise.all(toolExecutionPromises));

          // Send tool results back to Claude
          conversationHistory.push({
            role: 'user',
            content: toolResults
          });

        } else if (response.stop_reason === 'end_turn') {
          // Claude is done
          continueLoop = false;
          logger.info('✅ Task complete - Claude ended turn');

          // Extract final message
          const textBlocks = response.content.filter(
            (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
          );
          const finalMessage = textBlocks.map(b => b.text).join('\n');

          await this.notify(`🏁 **Task Complete**\n${finalMessage}`);

          return {
            success: true,
            message: finalMessage,
            iterations,
            toolCalls
          };
        } else if (response.stop_reason === 'max_tokens') {
          logger.warn('⚠️ Hit max tokens limit');
          continueLoop = false;

          return {
            success: false,
            message: 'Task incomplete - hit token limit',
            iterations,
            toolCalls,
            error: 'max_tokens'
          };
        }
      }

      // Hit max iterations
      if (iterations >= maxIter) {
        logger.warn(`⚠️ Hit max iterations (${maxIter})`);
        await this.notify(`⚠️ **Max Iterations Reached**\nCompleted ${iterations} iterations with ${toolCalls} tool calls.`);

        return {
          success: false,
          message: `Task incomplete - reached max iterations (${maxIter})`,
          iterations,
          toolCalls,
          error: 'max_iterations'
        };
      }

      // Shouldn't reach here
      return {
        success: false,
        message: 'Task ended unexpectedly',
        iterations,
        toolCalls,
        error: 'unexpected_end'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Agent execution failed', error);

      await this.notify(`❌ **Agent Failed**\n\`\`\`\n${errorMessage}\n\`\`\``);

      return {
        success: false,
        message: errorMessage,
        iterations,
        toolCalls,
        error: errorMessage
      };
    }
  }
}
