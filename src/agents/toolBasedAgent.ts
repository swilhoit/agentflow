import Anthropic from '@anthropic-ai/sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { TrelloService } from '../services/trello';

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

  constructor(apiKey: string, trelloService?: TrelloService) {
    this.client = new Anthropic({ apiKey });
    this.trelloService = trelloService;
  }

  setNotificationHandler(handler: (message: string) => Promise<void>): void {
    this.notificationHandler = handler;
  }

  private async notify(message: string): Promise<void> {
    if (this.notificationHandler) {
      try {
        await this.notificationHandler(message);
      } catch (error) {
        logger.error('Failed to send notification', error);
      }
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
        }
      );
    }

    return tools;
  }

  /**
   * Execute a tool call
   */
  private async executeTool(toolName: string, toolInput: any): Promise<any> {
    logger.info(`🔧 Executing tool: ${toolName}`);

    try {
      switch (toolName) {
        case 'execute_bash':
          return await this.executeBash(toolInput.command);

        case 'trello_list_boards':
          return await this.trelloListBoards();

        case 'trello_get_board':
          return await this.trelloGetBoard(toolInput.boardName);

        case 'trello_create_list':
          return await this.trelloCreateList(toolInput.boardName, toolInput.listName);

        case 'trello_create_card':
          return await this.trelloCreateCard(
            toolInput.boardName,
            toolInput.listName,
            toolInput.cardName,
            toolInput.description
          );

        case 'trello_list_cards':
          return await this.trelloListCards(toolInput.boardName);

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Tool execution failed: ${toolName}`, error);
      return { error: errorMessage, success: false };
    }
  }

  /**
   * Execute bash command
   */
  private async executeBash(command: string): Promise<any> {
    try {
      logger.info(`Running: ${command}`);
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
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

    const list = await this.trelloService.createList(board.id, listName);
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
  async executeTask(task: AgentTask): Promise<AgentResult> {
    const conversationHistory: Anthropic.MessageParam[] = [];
    let iterations = 0;
    let toolCalls = 0;
    let continueLoop = true;

    // Initial user message
    conversationHistory.push({
      role: 'user',
      content: this.buildInitialPrompt(task)
    });

    await this.notify(`🤖 **Agent Started**\n\`\`\`\n${task.command}\n\`\`\``);

    try {
      while (continueLoop && iterations < this.maxIterations) {
        iterations++;
        logger.info(`🔄 Iteration ${iterations}/${this.maxIterations}`);
        await this.notify(`🔄 **Iteration ${iterations}/${this.maxIterations}**\nProcessing...`);

        // Call Claude with tools
        const response = await this.client.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 4096,
          tools: this.getTools(),
          messages: conversationHistory
        });

        // Add assistant response to history
        conversationHistory.push({
          role: 'assistant',
          content: response.content
        });

        // Check if Claude wants to use tools
        if (response.stop_reason === 'tool_use') {
          const toolUses = response.content.filter(
            (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
          );

          logger.info(`🔧 Claude requested ${toolUses.length} tool call(s)`);

          // Execute each tool
          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

          for (const toolUse of toolUses) {
            toolCalls++;

            await this.notify(
              `🔧 **Tool Call ${toolCalls}**\n**Tool:** \`${toolUse.name}\`\n**Input:** \`\`\`json\n${JSON.stringify(toolUse.input, null, 2)}\n\`\`\``
            );

            const result = await this.executeTool(toolUse.name, toolUse.input);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result)
            });

            // Send result notification
            const resultPreview = JSON.stringify(result).substring(0, 300);
            await this.notify(
              `✅ **Tool Result**\n\`\`\`json\n${resultPreview}${JSON.stringify(result).length > 300 ? '...' : ''}\n\`\`\``
            );
          }

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
      if (iterations >= this.maxIterations) {
        logger.warn(`⚠️ Hit max iterations (${this.maxIterations})`);
        await this.notify(`⚠️ **Max Iterations Reached**\nCompleted ${iterations} iterations with ${toolCalls} tool calls.`);

        return {
          success: false,
          message: `Task incomplete - reached max iterations (${this.maxIterations})`,
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

  /**
   * Build initial system prompt
   */
  private buildInitialPrompt(task: AgentTask): string {
    let prompt = `You are an autonomous AI agent. Execute this task:

${task.command}

Available tools:
- execute_bash: Run bash commands (git, npm, file operations, etc.)`;

    if (this.trelloService) {
      prompt += `
- trello_list_boards: List all Trello boards
- trello_get_board: Get a specific board
- trello_create_list: Create a list on a board
- trello_create_card: Create a card on a list
- trello_list_cards: List all cards on a board`;
    }

    prompt += `

Important:
1. Use tools iteratively - call tools, check results, then decide next steps
2. If a tool fails, analyze the error and try a different approach
3. Break complex tasks into smaller steps
4. When you've completed the task, provide a summary of what was done
5. The user gets Discord notifications for each tool call, so they can see your progress

Execute the task now using the available tools.`;

    return prompt;
  }
}
