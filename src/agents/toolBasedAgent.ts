import Anthropic from '@anthropic-ai/sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { TrelloService } from '../services/trello';
import { HetznerDeploymentService } from '../services/hetznerDeployment';
import { ClaudeContainerService, ClaudeTaskResult } from '../services/claudeContainerService';
import { TaskDecomposer, TaskAnalysis, SubTask } from '../utils/taskDecomposer';
import { SmartIterationCalculator } from '../utils/smartIterationCalculator';
import { globalCache, isCacheable, SmartCache, startCacheCleanup } from '../utils/smartCache';
import { executeWithRetry, validateToolResult, compressResult, isRateLimited, getRetryAfter } from '../utils/resultValidator';
import { buildSystemPrompt } from '../prompts/agentPrompts';
import { IntentClassifier } from '../utils/intentClassifier';
import { PostgresDatabaseService } from '../services/postgresDatabaseService';
import { isUsingPostgres, getAgentFlowDatabase } from '../services/databaseFactory';
import { AdaptiveExecutor, createExecutorForTask, ContinuationDecision } from '../utils/adaptiveExecutor';
import { ExecutionPlanner, createQuickPlan, PlanTracker } from '../utils/executionPlanner';
import { ToolAwarePlanner, createToolAwarePlanner, ToolAwarePlan } from '../utils/toolAwarePlanner';
import { CognitiveToolExecutor, createCognitiveToolExecutor } from './cognitiveToolExecutor';
import { SmartModelRouter, createModelRouter, analyzeTaskComplexity } from '../utils/modelSelector';

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
  private hetznerDeployment: HetznerDeploymentService;
  private claudeContainer: ClaudeContainerService;
  private notificationHandler?: (message: string) => Promise<void>;
  private maxIterations = 15;
  private taskDecomposer: TaskDecomposer;

  // COGNITIVE SYSTEM - Enables strategic planning and self-awareness
  private cognitiveExecutor: CognitiveToolExecutor;
  private useCognitiveMode = true;  // Enable by default

  // SMART MODEL ROUTER - Selects optimal model based on task complexity
  private modelRouter: SmartModelRouter;

  // PostgreSQL database for logging (optional)
  private pgDb: PostgresDatabaseService | null = null;
  private currentTaskId: string | null = null;
  private currentAgentId: string | null = null;
  private currentGuildId: string | null = null;
  private currentChannelId: string | null = null;

  // Track active Claude Code container tasks
  private activeClaudeTasks: Map<string, Promise<ClaudeTaskResult>> = new Map();

  constructor(apiKey: string, trelloService?: TrelloService) {
    this.client = new Anthropic({ apiKey });
    this.trelloService = trelloService;
    this.taskDecomposer = new TaskDecomposer(apiKey);

    // Initialize COGNITIVE EXECUTOR with tool execution capability
    this.cognitiveExecutor = createCognitiveToolExecutor(
      apiKey,
      async (toolName: string, input: any) => this.executeTool(toolName, input)
    );

    // Initialize SMART MODEL ROUTER for fallback execution mode
    this.modelRouter = createModelRouter();

    // Initialize PostgreSQL database if configured
    if (isUsingPostgres()) {
      this.pgDb = getAgentFlowDatabase();
      logger.info('📊 ToolBasedAgent: PostgreSQL logging enabled');
    }

    // Initialize Hetzner Deployment Service
    const hetznerIp = process.env.HETZNER_SERVER_IP || '178.156.198.233';
    const hetznerUser = process.env.HETZNER_SSH_USER || 'root';
    this.hetznerDeployment = new HetznerDeploymentService(hetznerIp, hetznerUser);

    // Initialize Claude Container Service for remote Claude Code execution
    this.claudeContainer = new ClaudeContainerService({
      serverIp: hetznerIp,
      sshUser: hetznerUser,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      githubToken: process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    });

    // Set up event listeners for Claude container events
    this.setupClaudeContainerEvents();

    logger.info('🧠 ToolBasedAgent: Cognitive mode enabled');
  }

  /**
   * Enable or disable cognitive mode
   */
  setCognitiveMode(enabled: boolean): void {
    this.useCognitiveMode = enabled;
    logger.info(`🧠 Cognitive mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Set the current task context for logging
   */
  setTaskContext(taskId: string, guildId: string, channelId: string): void {
    this.currentTaskId = taskId;
    this.currentAgentId = taskId; // Using taskId as agentId for now
    this.currentGuildId = guildId;
    this.currentChannelId = channelId;
  }

  /**
   * Log agent activity to PostgreSQL
   */
  private async logActivity(
    logType: 'info' | 'warning' | 'error' | 'success' | 'step' | 'tool_call' | 'tool_result',
    message: string,
    details?: any
  ): Promise<void> {
    if (!this.pgDb || !this.currentAgentId || !this.currentGuildId || !this.currentChannelId) {
      return; // Skip if no database or no context
    }
    
    try {
      await this.pgDb.logAgentActivity({
        agentId: this.currentAgentId,
        taskId: this.currentTaskId || undefined,
        guildId: this.currentGuildId,
        channelId: this.currentChannelId,
        logType,
        message,
        details
      });
    } catch (error) {
      logger.error('Failed to log agent activity to PostgreSQL:', error);
    }
  }

  /**
   * Log tool execution to PostgreSQL
   */
  private async logToolExecution(
    toolName: string,
    toolInput: any,
    toolOutput: any,
    success: boolean,
    durationMs: number,
    error?: string
  ): Promise<void> {
    if (!this.pgDb || !this.currentTaskId || !this.currentAgentId) {
      return;
    }
    
    try {
      await this.pgDb.logToolExecution({
        taskId: this.currentTaskId,
        agentId: this.currentAgentId,
        toolName,
        toolInput,
        toolOutput: typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput).substring(0, 5000),
        success,
        error,
        durationMs
      });
    } catch (error) {
      logger.error('Failed to log tool execution to PostgreSQL:', error);
    }
  }

  /**
   * Set up event listeners for Claude container events
   */
  private setupClaudeContainerEvents(): void {
    this.claudeContainer.on('agent:started', async ({ containerId }) => {
      await this.notify(`🚀 **Claude Agent Started**\nContainer: \`${containerId}\``);
    });

    this.claudeContainer.on('agent:tool', async ({ containerId, tool }) => {
      await this.notify(`🔧 **Claude Using Tool:** ${tool}`);
    });

    this.claudeContainer.on('agent:error', async ({ containerId, error }) => {
      await this.notify(`⚠️ **Claude Agent Error**\n\`${containerId}\`: ${error}`);
    });

    this.claudeContainer.on('agent:completed', async ({ containerId, result }) => {
      const emoji = result.success ? '✅' : '❌';
      await this.notify(
        `${emoji} **Claude Agent ${result.success ? 'Completed' : 'Failed'}**\n` +
        `Container: \`${containerId}\`\n` +
        `Duration: ${(result.duration / 1000).toFixed(1)}s`
      );
    });
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

    // Add Hetzner deployment tools (always available)
    tools.push(
      {
        name: 'deploy_to_hetzner',
        description: 'Deploy a Docker container to Hetzner VPS. Syncs code, builds image, and starts container.',
        input_schema: {
          type: 'object',
          properties: {
            service_name: {
              type: 'string',
              description: 'Name for the container (e.g., "my-api-server")'
            },
            image_name: {
              type: 'string',
              description: 'Name for the Docker image (defaults to service_name)'
            },
            build_context: {
              type: 'string',
              description: 'Path to the build context directory (defaults to ".")'
            },
            port: {
              type: 'number',
              description: 'Port to expose (default: 8080)'
            },
            env_vars: {
              type: 'object',
              description: 'Environment variables to set in the container',
              additionalProperties: { type: 'string' }
            }
          },
          required: ['service_name']
        }
      },
      {
        name: 'list_containers',
        description: 'List all running Docker containers on Hetzner VPS',
        input_schema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_container_logs',
        description: 'Get recent logs from a Docker container on Hetzner VPS',
        input_schema: {
          type: 'object',
          properties: {
            container_name: {
              type: 'string',
              description: 'Name of the container to get logs from'
            },
            limit: {
              type: 'number',
              description: 'Number of log entries to retrieve (default: 50)'
            }
          },
          required: ['container_name']
        }
      },
      {
        name: 'delete_container',
        description: 'Stop and remove a Docker container on Hetzner VPS',
        input_schema: {
          type: 'object',
          properties: {
            container_name: {
              type: 'string',
              description: 'Name of the container to delete'
            }
          },
          required: ['container_name']
        }
      },
      {
        name: 'restart_container',
        description: 'Restart a Docker container on Hetzner VPS',
        input_schema: {
          type: 'object',
          properties: {
            container_name: {
              type: 'string',
              description: 'Name of the container to restart'
            }
          },
          required: ['container_name']
        }
      },
      {
        name: 'get_container_stats',
        description: 'Get CPU and memory usage stats for a container on Hetzner VPS',
        input_schema: {
          type: 'object',
          properties: {
            container_name: {
              type: 'string',
              description: 'Name of the container'
            }
          },
          required: ['container_name']
        }
      }
    );

    // Add Claude Code container tools (for running Claude Code in isolated containers)
    tools.push(
      {
        name: 'spawn_claude_agent',
        description: 'Spawn a Claude Code agent in an isolated Docker container on Hetzner VPS. The agent runs in YOLO mode with full permissions and can execute any coding task autonomously. Returns immediately with a container ID - use get_claude_status to monitor progress.',
        input_schema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'The task description for Claude Code to execute (e.g., "Create a REST API with Express")'
            },
            workspace_path: {
              type: 'string',
              description: 'Path to the workspace directory on the VPS (default: /opt/agentflow/workspace)'
            },
            context_files: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of file paths to provide as context to Claude'
            },
            requirements: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of requirements/constraints for the task'
            },
            max_iterations: {
              type: 'number',
              description: 'Maximum number of iterations (default: unlimited)'
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 600000 = 10 minutes)'
            }
          },
          required: ['task']
        }
      },
      {
        name: 'get_claude_status',
        description: 'Get the current status of a Claude Code container agent',
        input_schema: {
          type: 'object',
          properties: {
            container_id: {
              type: 'string',
              description: 'The container ID returned from spawn_claude_agent'
            }
          },
          required: ['container_id']
        }
      },
      {
        name: 'get_claude_output',
        description: 'Get the current output/logs from a Claude Code container agent',
        input_schema: {
          type: 'object',
          properties: {
            container_id: {
              type: 'string',
              description: 'The container ID returned from spawn_claude_agent'
            },
            lines: {
              type: 'number',
              description: 'Number of lines to retrieve (default: 100)'
            }
          },
          required: ['container_id']
        }
      },
      {
        name: 'stop_claude_agent',
        description: 'Stop a running Claude Code container agent',
        input_schema: {
          type: 'object',
          properties: {
            container_id: {
              type: 'string',
              description: 'The container ID to stop'
            }
          },
          required: ['container_id']
        }
      },
      {
        name: 'list_claude_agents',
        description: 'List all Claude Code container agents (running and stopped)',
        input_schema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'wait_for_claude_agent',
        description: 'Wait for a Claude Code container agent to complete and return the final result. Use this after spawn_claude_agent if you need to wait for completion.',
        input_schema: {
          type: 'object',
          properties: {
            container_id: {
              type: 'string',
              description: 'The container ID to wait for'
            },
            timeout: {
              type: 'number',
              description: 'Maximum time to wait in milliseconds (default: 600000 = 10 minutes)'
            }
          },
          required: ['container_id']
        }
      }
    );

    // Add GitHub/Workspace management tools
    tools.push(
      {
        name: 'clone_repo',
        description: 'Clone a GitHub repository to a workspace on the VPS. The workspace can then be used by spawn_claude_agent.',
        input_schema: {
          type: 'object',
          properties: {
            repo_url: {
              type: 'string',
              description: 'The GitHub repository URL (e.g., "https://github.com/user/repo")'
            },
            workspace_name: {
              type: 'string',
              description: 'Name for the workspace (defaults to repo name)'
            },
            branch: {
              type: 'string',
              description: 'Branch to clone (default: default branch)'
            }
          },
          required: ['repo_url']
        }
      },
      {
        name: 'create_workspace',
        description: 'Create a new empty workspace with git initialized. Optionally create a new GitHub repository.',
        input_schema: {
          type: 'object',
          properties: {
            workspace_name: {
              type: 'string',
              description: 'Name for the workspace'
            },
            create_github_repo: {
              type: 'boolean',
              description: 'Create a new GitHub repository (default: false)'
            },
            repo_visibility: {
              type: 'string',
              enum: ['public', 'private'],
              description: 'Repository visibility (default: private)'
            }
          },
          required: ['workspace_name']
        }
      },
      {
        name: 'list_workspaces',
        description: 'List all workspaces on the VPS with their git status',
        input_schema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'push_workspace',
        description: 'Commit and push changes from a workspace to GitHub',
        input_schema: {
          type: 'object',
          properties: {
            workspace_name: {
              type: 'string',
              description: 'Name of the workspace'
            },
            commit_message: {
              type: 'string',
              description: 'Commit message (default: "Update from Claude Agent")'
            },
            branch: {
              type: 'string',
              description: 'Branch to push to (default: main)'
            }
          },
          required: ['workspace_name']
        }
      },
      {
        name: 'create_branch',
        description: 'Create a new git branch in a workspace',
        input_schema: {
          type: 'object',
          properties: {
            workspace_name: {
              type: 'string',
              description: 'Name of the workspace'
            },
            branch_name: {
              type: 'string',
              description: 'Name for the new branch'
            },
            push: {
              type: 'boolean',
              description: 'Push the branch to remote (default: true)'
            }
          },
          required: ['workspace_name', 'branch_name']
        }
      },
      {
        name: 'delete_workspace',
        description: 'Delete a workspace from the VPS',
        input_schema: {
          type: 'object',
          properties: {
            workspace_name: {
              type: 'string',
              description: 'Name of the workspace to delete'
            }
          },
          required: ['workspace_name']
        }
      }
    );

    // Add Vercel deployment tools
    tools.push(
      {
        name: 'deploy_to_vercel',
        description: 'Deploy a workspace to Vercel. Use after pushing code changes.',
        input_schema: {
          type: 'object',
          properties: {
            workspace_name: {
              type: 'string',
              description: 'Name of the workspace to deploy'
            },
            prod: {
              type: 'boolean',
              description: 'Deploy to production (default: false for preview)'
            },
            project_name: {
              type: 'string',
              description: 'Vercel project name (auto-detected if linked)'
            }
          },
          required: ['workspace_name']
        }
      },
      {
        name: 'link_to_vercel',
        description: 'Link a workspace to an existing Vercel project',
        input_schema: {
          type: 'object',
          properties: {
            workspace_name: {
              type: 'string',
              description: 'Name of the workspace to link'
            },
            project_name: {
              type: 'string',
              description: 'Vercel project name to link to'
            }
          },
          required: ['workspace_name']
        }
      }
    );

    return tools;
  }

  /**
   * Execute a tool call (with caching, retry, validation, and PostgreSQL logging)
   */
  private async executeTool(toolName: string, toolInput: any): Promise<any> {
    logger.info(`🔧 Executing tool: ${toolName}`);
    const startTime = Date.now();

    // Log tool call start
    await this.logActivity('tool_call', `Executing tool: ${toolName}`, { toolInput });

    // OPTIMIZATION 1: Check cache first
    const cacheability = isCacheable(toolName, toolInput);
    if (cacheability.cacheable) {
      const cacheKey = SmartCache.generateKey(toolName, toolInput);
      const cached = globalCache.get(cacheKey);
      
      if (cached) {
        logger.info(`⚡ CACHE HIT for ${toolName} - instant response!`);
        const durationMs = Date.now() - startTime;
        await this.logToolExecution(toolName, toolInput, cached, true, durationMs);
        await this.logActivity('tool_result', `Cache hit for ${toolName}`, { cached: true, durationMs });
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

      const durationMs = Date.now() - startTime;

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

      // Log successful tool execution to PostgreSQL
      const success = result.success !== false;
      await this.logToolExecution(toolName, toolInput, compressed, success, durationMs);
      await this.logActivity('tool_result', `Tool ${toolName} completed in ${durationMs}ms`, { 
        success, 
        durationMs,
        resultPreview: JSON.stringify(compressed).substring(0, 200)
      });

      return compressed;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const durationMs = Date.now() - startTime;
      logger.error(`Tool execution failed: ${toolName}`, error);
      
      // Log failed tool execution to PostgreSQL
      await this.logToolExecution(toolName, toolInput, null, false, durationMs, errorMessage);
      await this.logActivity('error', `Tool ${toolName} failed: ${errorMessage}`, { durationMs, error: errorMessage });
      
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

      // Hetzner deployment tools
      case 'deploy_to_hetzner':
        return await this.hetznerDeployToVPS(toolInput);

      case 'list_containers':
        return await this.hetznerListContainers();

      case 'get_container_logs':
        return await this.hetznerGetLogs(toolInput.container_name, toolInput.limit || 50);

      case 'delete_container':
        return await this.hetznerDeleteContainer(toolInput.container_name);

      case 'restart_container':
        return await this.hetznerRestartContainer(toolInput.container_name);

      case 'get_container_stats':
        return await this.hetznerGetStats(toolInput.container_name);

      // Claude Code container tools
      case 'spawn_claude_agent':
        return await this.claudeSpawnAgent(toolInput);

      case 'get_claude_status':
        return await this.claudeGetStatus(toolInput.container_id);

      case 'get_claude_output':
        return await this.claudeGetOutput(toolInput.container_id, toolInput.lines || 100);

      case 'stop_claude_agent':
        return await this.claudeStopAgent(toolInput.container_id);

      case 'list_claude_agents':
        return await this.claudeListAgents();

      case 'wait_for_claude_agent':
        return await this.claudeWaitForAgent(toolInput.container_id, toolInput.timeout || 600000);

      // GitHub/Workspace management tools
      case 'clone_repo':
        return await this.workspaceCloneRepo(toolInput);

      case 'create_workspace':
        return await this.workspaceCreate(toolInput);

      case 'list_workspaces':
        return await this.workspaceList();

      case 'push_workspace':
        return await this.workspacePush(toolInput);

      case 'create_branch':
        return await this.workspaceCreateBranch(toolInput);

      case 'delete_workspace':
        return await this.workspaceDelete(toolInput.workspace_name);

      // Vercel deployment tools
      case 'deploy_to_vercel':
        return await this.vercelDeploy(toolInput);

      case 'link_to_vercel':
        return await this.vercelLink(toolInput);

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
   * Hetzner: Deploy to VPS
   */
  private async hetznerDeployToVPS(input: {
    service_name: string;
    image_name?: string;
    build_context?: string;
    port?: number;
    env_vars?: Record<string, string>;
  }): Promise<any> {
    try {
      // Set up notification callback
      this.hetznerDeployment.setNotificationCallback(async (event) => {
        await this.notify(`🚀 **${event.type.toUpperCase()}**: ${event.message}\n${event.details || ''}`);
      });

      const result = await this.hetznerDeployment.deployToHetzner({
        serviceName: input.service_name,
        imageName: input.image_name || input.service_name,
        buildContext: input.build_context || '.',
        port: input.port || 8080,
        envVars: input.env_vars || {}
      });

      return result;
    } catch (error) {
      logger.error('Hetzner deployment failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Hetzner: List containers
   */
  private async hetznerListContainers(): Promise<any> {
    try {
      const containers = await this.hetznerDeployment.listContainers();
      return {
        success: true,
        message: containers.length > 0
          ? `Found ${containers.length} container(s)`
          : 'No containers found',
        containers
      };
    } catch (error) {
      logger.error('Failed to list containers', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Hetzner: Get container logs
   */
  private async hetznerGetLogs(containerName: string, limit: number): Promise<any> {
    try {
      const logs = await this.hetznerDeployment.getContainerLogs(containerName, limit);
      return {
        success: true,
        message: `Retrieved ${logs.length} log entries`,
        logs
      };
    } catch (error) {
      logger.error('Failed to get container logs', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Hetzner: Delete container
   */
  private async hetznerDeleteContainer(containerName: string): Promise<any> {
    try {
      const success = await this.hetznerDeployment.deleteContainer(containerName);
      if (success) {
        return {
          success: true,
          message: `Successfully deleted container: ${containerName}`
        };
      } else {
        return {
          success: false,
          error: `Failed to delete container: ${containerName}`
        };
      }
    } catch (error) {
      logger.error('Failed to delete container', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Hetzner: Restart container
   */
  private async hetznerRestartContainer(containerName: string): Promise<any> {
    try {
      const success = await this.hetznerDeployment.restartContainer(containerName);
      if (success) {
        return {
          success: true,
          message: `Successfully restarted container: ${containerName}`
        };
      } else {
        return {
          success: false,
          error: `Failed to restart container: ${containerName}`
        };
      }
    } catch (error) {
      logger.error('Failed to restart container', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Hetzner: Get container stats
   */
  private async hetznerGetStats(containerName: string): Promise<any> {
    try {
      const stats = await this.hetznerDeployment.getContainerStats(containerName);
      if (stats) {
        return {
          success: true,
          message: `Container ${containerName} stats`,
          stats
        };
      } else {
        return {
          success: false,
          error: `Failed to get stats for container: ${containerName}`
        };
      }
    } catch (error) {
      logger.error('Failed to get container stats', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ========================================
  // Claude Code Container Tools
  // ========================================

  /**
   * Claude Container: Spawn a new Claude Code agent
   */
  private async claudeSpawnAgent(input: {
    task: string;
    workspace_path?: string;
    context_files?: string[];
    requirements?: string[];
    max_iterations?: number;
    timeout?: number;
  }): Promise<any> {
    try {
      logger.info(`🤖 Spawning Claude Code agent for task: ${input.task}`);

      // Check if image exists, build if needed
      const imageExists = await this.claudeContainer.imageExists();
      if (!imageExists) {
        logger.info('Building Claude Code Docker image...');
        await this.notify('🔨 **Building Claude Code Image**\nFirst-time setup, this may take a few minutes...');
        const buildSuccess = await this.claudeContainer.buildImage();
        if (!buildSuccess) {
          return {
            success: false,
            error: 'Failed to build Claude Code Docker image. Check VPS logs for details.'
          };
        }
      }

      // Spawn the agent
      const { containerId, streamPromise } = await this.claudeContainer.spawnAgent(
        input.task,
        {
          workspacePath: input.workspace_path,
          contextFiles: input.context_files,
          requirements: input.requirements,
          maxIterations: input.max_iterations,
          timeout: input.timeout,
          notificationHandler: async (msg) => await this.notify(msg)
        }
      );

      // Store the stream promise so we can wait for it later
      this.activeClaudeTasks.set(containerId, streamPromise);

      return {
        success: true,
        message: `Claude Code agent spawned successfully`,
        containerId,
        task: input.task,
        status: 'running',
        note: 'Use get_claude_status to monitor progress, or wait_for_claude_agent to wait for completion'
      };
    } catch (error) {
      logger.error('Failed to spawn Claude agent', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Claude Container: Get agent status
   */
  private async claudeGetStatus(containerId: string): Promise<any> {
    try {
      const status = await this.claudeContainer.getAgentStatus(containerId);
      return {
        success: true,
        containerId,
        ...status
      };
    } catch (error) {
      logger.error(`Failed to get Claude agent status: ${containerId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Claude Container: Get agent output/logs
   */
  private async claudeGetOutput(containerId: string, lines: number): Promise<any> {
    try {
      const logs = await this.claudeContainer.getAgentLogs(containerId, lines);
      return {
        success: true,
        containerId,
        lineCount: logs.length,
        output: logs.join('\n')
      };
    } catch (error) {
      logger.error(`Failed to get Claude agent output: ${containerId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Claude Container: Stop a running agent
   */
  private async claudeStopAgent(containerId: string): Promise<any> {
    try {
      const success = await this.claudeContainer.stopAgent(containerId);
      this.activeClaudeTasks.delete(containerId);

      if (success) {
        return {
          success: true,
          message: `Successfully stopped Claude agent: ${containerId}`
        };
      } else {
        return {
          success: false,
          error: `Failed to stop Claude agent: ${containerId}`
        };
      }
    } catch (error) {
      logger.error(`Failed to stop Claude agent: ${containerId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Claude Container: List all agents
   */
  private async claudeListAgents(): Promise<any> {
    try {
      const agents = await this.claudeContainer.listAgents();
      return {
        success: true,
        message: agents.length > 0
          ? `Found ${agents.length} Claude Code agent(s)`
          : 'No Claude Code agents found',
        agents
      };
    } catch (error) {
      logger.error('Failed to list Claude agents', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Claude Container: Wait for agent to complete
   */
  private async claudeWaitForAgent(containerId: string, timeout: number): Promise<any> {
    try {
      // Check if we have a tracked task
      const taskPromise = this.activeClaudeTasks.get(containerId);

      if (taskPromise) {
        // Wait for the existing task
        const result = await Promise.race([
          taskPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout waiting for agent after ${timeout}ms`)), timeout)
          )
        ]);

        this.activeClaudeTasks.delete(containerId);

        return {
          success: result.success,
          containerId,
          duration: result.duration,
          exitCode: result.exitCode,
          output: result.output.substring(0, 5000), // Truncate large outputs
          error: result.error
        };
      }

      // If no tracked task, check if container is still running
      const status = await this.claudeContainer.getAgentStatus(containerId);

      if (!status.running) {
        // Container already finished, get logs
        const logs = await this.claudeContainer.getAgentLogs(containerId, 500);
        return {
          success: true,
          containerId,
          status: 'completed',
          output: logs.join('\n').substring(0, 5000)
        };
      }

      // Container is running but we don't have the promise - poll until done
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds
        const currentStatus = await this.claudeContainer.getAgentStatus(containerId);

        if (!currentStatus.running) {
          const logs = await this.claudeContainer.getAgentLogs(containerId, 500);
          return {
            success: true,
            containerId,
            status: 'completed',
            duration: Date.now() - startTime,
            output: logs.join('\n').substring(0, 5000)
          };
        }
      }

      return {
        success: false,
        error: `Timeout waiting for agent ${containerId} after ${timeout}ms`
      };
    } catch (error) {
      logger.error(`Failed to wait for Claude agent: ${containerId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ========================================
  // Workspace / GitHub Management Tools
  // ========================================

  /**
   * Clone a repository to a workspace
   */
  private async workspaceCloneRepo(input: {
    repo_url: string;
    workspace_name?: string;
    branch?: string;
  }): Promise<any> {
    try {
      const result = await this.claudeContainer.cloneRepo(input.repo_url, {
        workspaceName: input.workspace_name,
        branch: input.branch
      });

      if (result.success) {
        await this.notify(`📦 **Repository Cloned**\n\`${input.repo_url}\`\nWorkspace: \`${result.workspacePath}\``);
      }

      return result;
    } catch (error) {
      logger.error('Failed to clone repository', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a new workspace
   */
  private async workspaceCreate(input: {
    workspace_name: string;
    create_github_repo?: boolean;
    repo_visibility?: 'public' | 'private';
  }): Promise<any> {
    try {
      const result = await this.claudeContainer.createWorkspace(input.workspace_name, {
        initGit: true,
        createGitHubRepo: input.create_github_repo,
        repoVisibility: input.repo_visibility
      });

      if (result.success) {
        let msg = `📁 **Workspace Created**\nPath: \`${result.workspacePath}\``;
        if (result.repoUrl) {
          msg += `\nGitHub: ${result.repoUrl}`;
        }
        await this.notify(msg);
      }

      return result;
    } catch (error) {
      logger.error('Failed to create workspace', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List all workspaces
   */
  private async workspaceList(): Promise<any> {
    try {
      const workspaces = await this.claudeContainer.listWorkspaces();
      return {
        success: true,
        message: workspaces.length > 0
          ? `Found ${workspaces.length} workspace(s)`
          : 'No workspaces found',
        workspaces
      };
    } catch (error) {
      logger.error('Failed to list workspaces', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Push workspace changes to GitHub
   */
  private async workspacePush(input: {
    workspace_name: string;
    commit_message?: string;
    branch?: string;
  }): Promise<any> {
    try {
      const result = await this.claudeContainer.pushWorkspace(input.workspace_name, {
        commitMessage: input.commit_message,
        branch: input.branch
      });

      if (result.success) {
        await this.notify(`🚀 **Changes Pushed**\nWorkspace: \`${input.workspace_name}\`\nBranch: \`${input.branch || 'main'}\``);
      }

      return result;
    } catch (error) {
      logger.error('Failed to push workspace', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a new branch in a workspace
   */
  private async workspaceCreateBranch(input: {
    workspace_name: string;
    branch_name: string;
    push?: boolean;
  }): Promise<any> {
    try {
      const result = await this.claudeContainer.createBranch(
        input.workspace_name,
        input.branch_name,
        { push: input.push }
      );

      if (result.success) {
        await this.notify(`🌿 **Branch Created**\nWorkspace: \`${input.workspace_name}\`\nBranch: \`${input.branch_name}\``);
      }

      return result;
    } catch (error) {
      logger.error('Failed to create branch', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete a workspace
   */
  private async workspaceDelete(workspaceName: string): Promise<any> {
    try {
      const success = await this.claudeContainer.deleteWorkspace(workspaceName);

      if (success) {
        return {
          success: true,
          message: `Successfully deleted workspace: ${workspaceName}`
        };
      } else {
        return {
          success: false,
          error: `Failed to delete workspace: ${workspaceName}`
        };
      }
    } catch (error) {
      logger.error('Failed to delete workspace', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ========================================
  // Vercel Deployment Tools
  // ========================================

  /**
   * Deploy a workspace to Vercel
   */
  private async vercelDeploy(input: {
    workspace_name: string;
    prod?: boolean;
    project_name?: string;
  }): Promise<any> {
    try {
      const result = await this.claudeContainer.deployToVercel(input.workspace_name, {
        prod: input.prod,
        projectName: input.project_name
      });

      if (result.success && result.url) {
        await this.notify(
          `🚀 **Deployed to Vercel**\n` +
          `Workspace: \`${input.workspace_name}\`\n` +
          `URL: ${result.url}\n` +
          `Environment: ${input.prod ? 'Production' : 'Preview'}`
        );
      }

      return result;
    } catch (error) {
      logger.error('Failed to deploy to Vercel', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Link a workspace to Vercel
   */
  private async vercelLink(input: {
    workspace_name: string;
    project_name?: string;
  }): Promise<any> {
    try {
      const result = await this.claudeContainer.linkToVercel(input.workspace_name, {
        projectName: input.project_name
      });

      if (result.success) {
        await this.notify(`🔗 **Linked to Vercel**\nWorkspace: \`${input.workspace_name}\``);
      }

      return result;
    } catch (error) {
      logger.error('Failed to link to Vercel', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Enhanced executeTask with COGNITIVE EXECUTION
   * Uses strategic planning, context awareness, and self-monitoring
   */
  async executeTask(task: AgentTask): Promise<AgentResult> {
    // Step 0: INTENT CLASSIFICATION - Check if this is conversational or an actual task
    const intentResult = IntentClassifier.classify(task.command);
    logger.info(`🎯 Intent Classification: ${IntentClassifier.getClassificationSummary(task.command)}`);

    // Handle conversational messages IMMEDIATELY without task execution
    if (!intentResult.shouldExecuteTask) {
      logger.info(`💬 Conversational message detected (${intentResult.intent}) - responding directly`);

      const response = intentResult.suggestedResponse || "What can I help you with?";
      await this.notify(response);

      return {
        success: true,
        message: response,
        iterations: 0,
        toolCalls: 0
      };
    }

    // COGNITIVE MODE: Use full strategic planning and self-monitoring
    if (this.useCognitiveMode) {
      return await this.executeCognitive(task);
    }

    // FALLBACK: Use adaptive execution (simpler, faster for basic tasks)
    const taskAnalysis = AdaptiveExecutor.analyzeTaskComplexity(task.command);

    logger.info(`🧠 Adaptive Analysis: ${taskAnalysis.reasoning}`);
    logger.info(`   Needs exploration: ${taskAnalysis.needsExploration}`);
    logger.info(`   Needs planning: ${taskAnalysis.needsPlanning}`);

    await this.notify(
      `🚀 **Starting Task**\n` +
      `**Mode:** Adaptive (progress-based)\n` +
      `**Analysis:** ${taskAnalysis.reasoning}`
    );

    return await this.executeSimpleTask(task);
  }

  /**
   * Execute task using the COGNITIVE SYSTEM
   * Full strategic planning, context awareness, tool orchestration, and self-monitoring
   */
  private async executeCognitive(task: AgentTask): Promise<AgentResult> {
    logger.info(`\n${'═'.repeat(70)}`);
    logger.info(`🧠 COGNITIVE EXECUTION MODE`);
    logger.info(`${'═'.repeat(70)}`);

    // Set up notification handler for cognitive executor
    this.cognitiveExecutor.setNotificationHandler(async (msg) => this.notify(msg));

    // Set task context for logging
    const taskId = `cognitive_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.setTaskContext(taskId, task.context.guildId, task.context.channelId);

    // Log task start
    await this.logActivity('info', `Cognitive task started: ${task.command.substring(0, 100)}`, {
      command: task.command,
      executionMode: 'cognitive',
      userId: task.context.userId
    });

    try {
      // Execute with cognitive system
      const result = await this.cognitiveExecutor.execute(
        task.command,
        this.getToolsAsAnthropicFormat(),
        {
          hasTrello: !!this.trelloService,
          conversationHistory: task.context.conversationHistory
        }
      );

      // Log completion
      await this.logActivity(
        result.success ? 'success' : 'warning',
        result.success ? 'Cognitive task completed' : 'Cognitive task incomplete',
        {
          iterations: result.iterations,
          toolCalls: result.toolCalls,
          phasesCompleted: result.phasesCompleted,
          totalPhases: result.totalPhases,
          approach: result.approach,
          confidence: result.confidence,
          discoveries: result.discoveries.length
        }
      );

      // Final notification
      if (result.success) {
        await this.notify(
          `🏁 **Task Complete**\n` +
          `**Approach:** ${result.approach}\n` +
          `**Phases:** ${result.phasesCompleted}/${result.totalPhases}\n` +
          `**Iterations:** ${result.iterations}\n` +
          `**Tool Calls:** ${result.toolCalls}\n` +
          (result.discoveries.length > 0 ? `**Discoveries:** ${result.discoveries.slice(0, 3).join(', ')}` : '')
        );
      }

      return {
        success: result.success,
        message: result.message,
        iterations: result.iterations,
        toolCalls: result.toolCalls
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`🚨 Cognitive execution failed: ${errorMessage}`);

      await this.logActivity('error', `Cognitive execution failed: ${errorMessage}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      await this.notify(`❌ **Cognitive Execution Failed**\n${errorMessage}`);

      return {
        success: false,
        message: errorMessage,
        iterations: 0,
        toolCalls: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Convert tools to Anthropic format for cognitive executor
   */
  private getToolsAsAnthropicFormat(): Anthropic.Tool[] {
    return this.getTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema as Anthropic.Tool['input_schema']
    }));
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
   * NOW USES ADAPTIVE EXECUTOR + TOOL-AWARE PLANNING!
   */
  private async executeSimpleTask(task: AgentTask, iterationLimit?: number): Promise<AgentResult> {
    // Create adaptive executor configured for this task
    const executor = createExecutorForTask(task.command);
    const conversationHistory: Anthropic.MessageParam[] = [];
    let toolCalls = 0;
    let continueLoop = true;

    // Create TOOL-AWARE execution plan that knows about available tools
    const toolPlanner = createToolAwarePlanner({
      hasTrello: !!this.trelloService,
      hasHetzner: true,  // Always have Hetzner
      hasClaudeContainers: true  // Always have Claude containers
    });

    const toolAwarePlan = toolPlanner.createPlan(task.command);
    const planTracker = new PlanTracker(toolAwarePlan);
    executor.setPlan(toolAwarePlan);

    logger.info(`📋 Tool-Aware Plan: ${toolAwarePlan.complexity} - ${toolAwarePlan.milestones.length} milestones`);
    logger.info(`🔧 Required tools: ${toolAwarePlan.toolsRequired.join(', ')}`);
    if (toolAwarePlan.delegationOpportunities.length > 0) {
      logger.info(`🤖 Delegation opportunities: ${toolAwarePlan.delegationOpportunities.join(', ')}`);
    }

    // Set task context for logging
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.setTaskContext(taskId, task.context.guildId, task.context.channelId);

    // SMART MODEL SELECTION - Choose optimal model based on task complexity
    this.modelRouter = createModelRouter();  // Reset for fresh task
    const taskComplexity = analyzeTaskComplexity(task.command);
    const selectedModel = this.modelRouter.getModelForTask(task.command);

    logger.info(`🎯 Model Selection: ${selectedModel.name} (complexity: ${taskComplexity.complexity}, score: ${taskComplexity.score})`);

    // Log task start
    await this.logActivity('info', `Task started: ${task.command.substring(0, 100)}`, {
      command: task.command,
      executionMode: 'adaptive-tool-aware',
      complexity: toolAwarePlan.complexity,
      taskComplexityScore: taskComplexity.score,
      taskComplexityLevel: taskComplexity.complexity,
      selectedModel: selectedModel.name,
      toolsRequired: toolAwarePlan.toolsRequired,
      milestones: toolAwarePlan.milestones.length,
      userId: task.context.userId
    });

    // Initial user message
    conversationHistory.push({
      role: 'user',
      content: buildSystemPrompt({
        command: task.command,
        conversationHistory: task.context.conversationHistory,
        hasTrello: !!this.trelloService
      })
    });

    // Build tool-aware notification
    const toolInfo = toolAwarePlan.toolsRequired.length > 0
      ? `**Tools:** ${toolAwarePlan.toolsRequired.slice(0, 4).join(', ')}${toolAwarePlan.toolsRequired.length > 4 ? '...' : ''}`
      : '';

    const delegationInfo = toolAwarePlan.delegationOpportunities.length > 0
      ? `\n🤖 **Can delegate:** ${toolAwarePlan.delegationOpportunities[0]}`
      : '';

    await this.notify(
      `🤖 **Agent Started**\n` +
      `**Task ID:** \`${taskId}\`\n` +
      `**Complexity:** ${toolAwarePlan.complexity} (${taskComplexity.score}/100)\n` +
      `**Model:** ${selectedModel.name}\n` +
      `**Plan:** ${toolAwarePlan.milestones.length} milestones\n` +
      `${toolInfo}${delegationInfo}\n` +
      `**Command:**\n\`\`\`\n${task.command.substring(0, 400)}${task.command.length > 400 ? '...' : ''}\n\`\`\`\n` +
      `_Adaptive execution with smart model selection._`
    );

    try {
      // ADAPTIVE LOOP - continues based on progress, not arbitrary limits
      let decision: ContinuationDecision;

      do {
        executor.recordIteration();
        const iterations = executor.getState().iterations;

        logger.info(`🔄 Iteration ${iterations} (adaptive mode)`);

        // Check if we should continue BEFORE processing
        decision = executor.shouldContinue();
        if (!decision.shouldContinue) {
          logger.info(`⏹️ Stopping: ${decision.reason}`);
          break;
        }

        // Show progress with plan status if available
        const progressMsg = planTracker
          ? `🔄 **Iteration ${iterations}**\n${planTracker.getProgressString()}`
          : `🔄 **Iteration ${iterations}** (progress markers: ${executor.getState().progressMarkers.size})`;
        await this.notify(progressMsg);

        // Log iteration start
        await this.logActivity('step', `Iteration ${iterations} started (adaptive)`, {
          iteration: iterations,
          progressMarkers: executor.getState().progressMarkers.size
        });

        // Call Claude with tools (WITH TIMEOUT AND SMART MODEL!)
        const TIMEOUT_MS = 60000; // 60 second timeout per iteration
        const currentModel = this.modelRouter.getCurrentModel();
        const maxTokens = currentModel.tier === 'powerful' ? 8192 : 4096;

        const response = await Promise.race([
          this.client.messages.create({
            model: currentModel.id,
            max_tokens: maxTokens,
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

        // ADAPTIVE: Detect completion signals from response text
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

        // Record completion signal if detected
        if (hasCompletionPhrase) {
          executor.recordCompletionSignal();
        }

        // If task appears complete and we've made at least one tool call, stop early
        if (hasCompletionPhrase && toolCalls > 0 && response.stop_reason !== 'tool_use') {
          const iterations = executor.getState().iterations;
          logger.info(`✅ Completion detected at iteration ${iterations} - stopping!`);
          await this.notify(`✅ **Task Complete** (iteration ${iterations})`);
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
            const success = !result.error && !result.failed;

            // ADAPTIVE: Record tool call for progress tracking
            executor.recordToolCall(toolUse.name, toolUse.input, result, success);

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
          executor.recordCompletionSignal();
          const iterations = executor.getState().iterations;
          logger.info('✅ Task complete - Claude ended turn');

          // Extract final message
          const textBlocks = response.content.filter(
            (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
          );
          const finalMessage = textBlocks.map(b => b.text).join('\n');

          // Show final plan status if available
          const completionMsg = planTracker
            ? `🏁 **Task Complete**\n${planTracker.getProgressString()}\n\n${finalMessage}`
            : `🏁 **Task Complete**\n${finalMessage}`;
          await this.notify(completionMsg);

          // Log successful completion
          await this.logActivity('success', `Task completed successfully`, {
            iterations,
            toolCalls,
            progressMarkers: executor.getState().progressMarkers.size,
            finalMessagePreview: finalMessage.substring(0, 200)
          });

          logger.info(executor.getSummary());

          return {
            success: true,
            message: finalMessage,
            iterations,
            toolCalls
          };
        } else if (response.stop_reason === 'max_tokens') {
          const iterations = executor.getState().iterations;
          logger.warn('⚠️ Hit max tokens limit');
          continueLoop = false;

          // Send detailed notification
          await this.notify(
            `⚠️ **Token Limit Reached**\n\n` +
            `The response was cut off due to the token limit.\n\n` +
            `**Progress:**\n` +
            `• Iterations: ${iterations}\n` +
            `• Tool calls: ${toolCalls}\n` +
            `• Progress markers: ${executor.getState().progressMarkers.size}\n\n` +
            `_The task may need to be simpler or broken into parts._`
          );

          // Log max tokens error
          await this.logActivity('warning', 'Task incomplete - hit token limit', { iterations, toolCalls });

          return {
            success: false,
            message: 'Task incomplete - hit token limit',
            iterations,
            toolCalls,
            error: 'max_tokens'
          };
        }

        // Check continuation decision at end of each iteration
        decision = executor.shouldContinue();
        if (decision.warning) {
          await this.notify(`⚠️ ${decision.warning}`);
        }
      } while (decision.shouldContinue && continueLoop);

      // ADAPTIVE: Handle the reason we stopped
      const finalState = executor.getState();
      const iterations = finalState.iterations;

      if (decision.suggestedAction === 'complete' || executor.detectCompletion()) {
        // Task completed successfully via adaptive detection
        logger.info('✅ Task completed (adaptive detection)');
        logger.info(executor.getSummary());

        return {
          success: true,
          message: `Task completed after ${iterations} iterations with ${toolCalls} tool calls`,
          iterations,
          toolCalls
        };
      }

      // Handle stall or other stop reasons
      const stopReason = decision.reason;
      logger.warn(`⚠️ Task stopped: ${stopReason}`);

      await this.notify(
        `⚠️ **Execution Stopped**\n\n` +
        `**Reason:** ${stopReason}\n\n` +
        `**Progress:**\n` +
        `• Iterations: ${iterations}\n` +
        `• Tool calls: ${toolCalls}\n` +
        `• Progress markers: ${finalState.progressMarkers.size}\n` +
        `• Last progress at: iteration ${finalState.lastMeaningfulProgress}\n\n` +
        (planTracker ? planTracker.getDetailedStatus() + '\n\n' : '') +
        `_${decision.suggestedAction === 'ask_user' ? 'The task may need clarification or a different approach.' : 'Try breaking the task into smaller steps.'}_`
      );

      // Log stop reason
      await this.logActivity('warning', `Task stopped: ${stopReason}`, {
        iterations,
        toolCalls,
        progressMarkers: finalState.progressMarkers.size,
        lastMeaningfulProgress: finalState.lastMeaningfulProgress,
        suggestedAction: decision.suggestedAction
      });

      return {
        success: false,
        message: `Task incomplete - ${stopReason}`,
        iterations,
        toolCalls,
        error: decision.suggestedAction || 'adaptive_stop'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : '';
      const iterations = executor.getState().iterations;
      logger.error('❌ Agent execution failed', error);

      // Try to escalate model before giving up
      const escalatedModel = this.modelRouter.reportFailure();
      if (escalatedModel) {
        logger.info(`⬆️ Model escalated to ${escalatedModel.name} - consider retrying`);
        await this.notify(
          `⚠️ **Execution Error - Model Escalated**\n\n` +
          `**Error:** ${errorMessage}\n\n` +
          `**Model escalated:** ${escalatedModel.name}\n` +
          `_Task may succeed with the more powerful model. Try again!_`
        );
      }

      // Send detailed error notification to Discord
      await this.notify(
        `❌ **Agent Failed**\n\n` +
        `**Error:** ${errorMessage}\n\n` +
        `**Model used:** ${this.modelRouter.getCurrentModel().name}\n` +
        `**Progress at failure:**\n` +
        `• Iterations completed: ${iterations}\n` +
        `• Tool calls made: ${toolCalls}\n` +
        `• Progress markers: ${executor.getState().progressMarkers.size}\n\n` +
        `**Stack trace:**\n\`\`\`\n${errorStack || 'No stack trace available'}\n\`\`\`\n\n` +
        `_Please try again or simplify your request._`
      );

      // Log error to PostgreSQL
      await this.logActivity('error', `Agent execution failed: ${errorMessage}`, {
        iterations,
        toolCalls,
        progressMarkers: executor.getState().progressMarkers.size,
        modelUsed: this.modelRouter.getCurrentModel().name,
        modelEscalated: escalatedModel?.name || null,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      logger.info(executor.getSummary());

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
