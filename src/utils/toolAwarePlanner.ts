import { logger } from './logger';
import { ExecutionPlan, PlanMilestone } from './adaptiveExecutor';

/**
 * Tool-Aware Planner
 *
 * Creates execution plans that strategically leverage available tools.
 * Knows about tool capabilities and suggests optimal tool sequences.
 */

export interface ToolCapability {
  name: string;
  category: 'exploration' | 'creation' | 'modification' | 'deployment' | 'monitoring' | 'delegation';
  description: string;
  bestFor: string[];  // Keywords this tool is best for
  requires?: string[];  // Prerequisites (e.g., 'trello_api_key')
}

export interface ToolAwareMilestone extends PlanMilestone {
  suggestedTools: string[];
  toolStrategy?: string;
  canDelegate?: boolean;  // Can this be delegated to a sub-agent?
}

export interface ToolAwarePlan extends ExecutionPlan {
  milestones: ToolAwareMilestone[];
  toolsRequired: string[];
  delegationOpportunities: string[];
}

/**
 * Define tool capabilities and what they're best for
 */
const TOOL_REGISTRY: ToolCapability[] = [
  // Exploration tools
  {
    name: 'execute_bash',
    category: 'exploration',
    description: 'Execute shell commands for file operations, git, npm, etc.',
    bestFor: ['explore', 'find', 'search', 'list', 'read', 'analyze', 'git', 'npm', 'file', 'directory', 'code']
  },

  // Trello tools - Task management
  {
    name: 'trello_list_boards',
    category: 'exploration',
    description: 'List all Trello boards',
    bestFor: ['trello', 'boards', 'projects', 'tasks']
  },
  {
    name: 'trello_create_card',
    category: 'creation',
    description: 'Create task cards on Trello',
    bestFor: ['task', 'card', 'todo', 'create', 'track', 'plan']
  },
  {
    name: 'trello_add_checklist',
    category: 'creation',
    description: 'Add checklists to cards',
    bestFor: ['checklist', 'steps', 'subtasks', 'breakdown']
  },
  {
    name: 'trello_update_card',
    category: 'modification',
    description: 'Update card status, move between lists',
    bestFor: ['update', 'move', 'status', 'progress']
  },

  // Hetzner deployment tools
  {
    name: 'deploy_to_hetzner',
    category: 'deployment',
    description: 'Deploy Docker containers to VPS',
    bestFor: ['deploy', 'ship', 'release', 'docker', 'container', 'server']
  },
  {
    name: 'list_containers',
    category: 'monitoring',
    description: 'List running containers',
    bestFor: ['containers', 'running', 'status', 'list']
  },
  {
    name: 'get_container_logs',
    category: 'monitoring',
    description: 'Get container logs',
    bestFor: ['logs', 'debug', 'errors', 'output']
  },
  {
    name: 'restart_container',
    category: 'modification',
    description: 'Restart a container',
    bestFor: ['restart', 'refresh', 'reset']
  },

  // Claude sub-agent tools - Delegation
  {
    name: 'spawn_claude_agent',
    category: 'delegation',
    description: 'Spawn autonomous Claude agent for complex subtasks',
    bestFor: ['complex', 'implement', 'build', 'create', 'refactor', 'autonomous', 'coding']
  },
  {
    name: 'get_claude_status',
    category: 'monitoring',
    description: 'Monitor spawned agent progress',
    bestFor: ['status', 'progress', 'agent', 'monitor']
  },
  {
    name: 'wait_for_claude_agent',
    category: 'monitoring',
    description: 'Wait for agent completion',
    bestFor: ['wait', 'complete', 'finish', 'result']
  }
];

/**
 * Tool-Aware Planner Class
 */
export class ToolAwarePlanner {
  private availableTools: Set<string>;
  private hasTrello: boolean;
  private hasHetzner: boolean;
  private hasClaudeContainers: boolean;

  constructor(options: {
    hasTrello?: boolean;
    hasHetzner?: boolean;
    hasClaudeContainers?: boolean;
  } = {}) {
    this.hasTrello = options.hasTrello ?? true;
    this.hasHetzner = options.hasHetzner ?? true;
    this.hasClaudeContainers = options.hasClaudeContainers ?? true;

    // Build available tools set
    this.availableTools = new Set(['execute_bash']);

    if (this.hasTrello) {
      TOOL_REGISTRY.filter(t => t.name.startsWith('trello')).forEach(t => this.availableTools.add(t.name));
    }
    if (this.hasHetzner) {
      TOOL_REGISTRY.filter(t => ['deploy_to_hetzner', 'list_containers', 'get_container_logs', 'restart_container', 'delete_container', 'get_container_stats'].includes(t.name))
        .forEach(t => this.availableTools.add(t.name));
    }
    if (this.hasClaudeContainers) {
      TOOL_REGISTRY.filter(t => t.name.includes('claude')).forEach(t => this.availableTools.add(t.name));
    }
  }

  /**
   * Find best tools for a given task description
   */
  findBestTools(taskDescription: string): ToolCapability[] {
    const lower = taskDescription.toLowerCase();
    const matches: { tool: ToolCapability; score: number }[] = [];

    for (const tool of TOOL_REGISTRY) {
      if (!this.availableTools.has(tool.name)) continue;

      let score = 0;
      for (const keyword of tool.bestFor) {
        if (lower.includes(keyword)) {
          score += 1;
        }
      }

      if (score > 0) {
        matches.push({ tool, score });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);
    return matches.map(m => m.tool);
  }

  /**
   * Create a tool-aware execution plan
   */
  createPlan(taskDescription: string): ToolAwarePlan {
    const lower = taskDescription.toLowerCase();
    const bestTools = this.findBestTools(taskDescription);

    logger.info(`🔧 Tool analysis: Found ${bestTools.length} relevant tools`);
    bestTools.slice(0, 5).forEach(t => logger.info(`   - ${t.name}: ${t.description}`));

    // Determine task type and create appropriate plan
    const plan = this.createPlanForTaskType(taskDescription, bestTools);

    // Identify delegation opportunities
    plan.delegationOpportunities = this.findDelegationOpportunities(taskDescription, plan.milestones);

    return plan;
  }

  /**
   * Create plan based on task type
   */
  private createPlanForTaskType(taskDescription: string, tools: ToolCapability[]): ToolAwarePlan {
    const lower = taskDescription.toLowerCase();

    // Codebase analysis task
    if (this.isCodebaseAnalysis(lower)) {
      return this.createCodebaseAnalysisPlan(taskDescription, tools);
    }

    // Deployment task
    if (this.isDeploymentTask(lower)) {
      return this.createDeploymentPlan(taskDescription, tools);
    }

    // Task management task
    if (this.isTaskManagementTask(lower)) {
      return this.createTaskManagementPlan(taskDescription, tools);
    }

    // Implementation task
    if (this.isImplementationTask(lower)) {
      return this.createImplementationPlan(taskDescription, tools);
    }

    // Default exploration plan
    return this.createExplorationPlan(taskDescription, tools);
  }

  // Task type detection
  private isCodebaseAnalysis(desc: string): boolean {
    return /analyze|review|audit|examine|improve|refactor/.test(desc) &&
           /repo|codebase|code|project|architecture/.test(desc);
  }

  private isDeploymentTask(desc: string): boolean {
    return /deploy|ship|release|launch|publish/.test(desc);
  }

  private isTaskManagementTask(desc: string): boolean {
    return /trello|card|board|task|todo|plan|organize/.test(desc);
  }

  private isImplementationTask(desc: string): boolean {
    return /implement|build|create|develop|add|feature/.test(desc);
  }

  /**
   * Codebase Analysis Plan
   */
  private createCodebaseAnalysisPlan(task: string, tools: ToolCapability[]): ToolAwarePlan {
    const milestones: ToolAwareMilestone[] = [
      {
        id: 'explore_structure',
        description: 'Explore project structure and identify key directories',
        completed: false,
        suggestedTools: ['execute_bash'],
        toolStrategy: 'Use `find`, `tree`, or `ls -la` to map directory structure. Look for src/, lib/, tests/, docs/'
      },
      {
        id: 'identify_entry_points',
        description: 'Identify main entry points and configuration files',
        completed: false,
        suggestedTools: ['execute_bash'],
        toolStrategy: 'Find package.json, tsconfig.json, index.ts/js, main.ts/js. Read key configs.'
      },
      {
        id: 'analyze_architecture',
        description: 'Analyze code architecture and patterns',
        completed: false,
        suggestedTools: ['execute_bash'],
        toolStrategy: 'Use grep to find patterns: classes, interfaces, exports. Map dependencies between modules.'
      },
      {
        id: 'identify_improvements',
        description: 'Identify areas for improvement',
        completed: false,
        suggestedTools: ['execute_bash'],
        toolStrategy: 'Look for: TODOs, FIXMEs, deprecated code, large files, complex functions, missing tests.'
      },
      {
        id: 'prioritize_recommendations',
        description: 'Prioritize and document recommendations',
        completed: false,
        suggestedTools: this.hasTrello ? ['trello_create_card', 'trello_add_checklist'] : ['execute_bash'],
        toolStrategy: this.hasTrello
          ? 'Create Trello cards for each recommendation with priority labels and checklists.'
          : 'Document findings in a structured format.'
      },
      {
        id: 'present_findings',
        description: 'Present comprehensive analysis to user',
        completed: false,
        suggestedTools: [],
        toolStrategy: 'Synthesize findings into clear, actionable report.'
      }
    ];

    return {
      taskSummary: 'Codebase analysis with improvement recommendations',
      complexity: 'exploratory',
      estimatedEffort: 'substantial',
      explorationNeeded: true,
      milestones,
      toolsRequired: ['execute_bash', ...(this.hasTrello ? ['trello_create_card'] : [])],
      delegationOpportunities: []
    };
  }

  /**
   * Deployment Plan
   */
  private createDeploymentPlan(task: string, tools: ToolCapability[]): ToolAwarePlan {
    const milestones: ToolAwareMilestone[] = [
      {
        id: 'check_prerequisites',
        description: 'Check deployment prerequisites and current state',
        completed: false,
        suggestedTools: ['list_containers', 'execute_bash'],
        toolStrategy: 'List current containers, check git status, verify build readiness.'
      },
      {
        id: 'prepare_build',
        description: 'Prepare and validate build artifacts',
        completed: false,
        suggestedTools: ['execute_bash'],
        toolStrategy: 'Run build commands, check for errors, validate output.'
      },
      {
        id: 'deploy',
        description: 'Execute deployment to target environment',
        completed: false,
        suggestedTools: ['deploy_to_hetzner'],
        toolStrategy: 'Deploy container with appropriate config, env vars, and port mappings.'
      },
      {
        id: 'verify_deployment',
        description: 'Verify deployment success and health',
        completed: false,
        suggestedTools: ['get_container_logs', 'get_container_stats'],
        toolStrategy: 'Check logs for errors, verify container is running, test endpoints.'
      },
      {
        id: 'report_status',
        description: 'Report deployment status and next steps',
        completed: false,
        suggestedTools: this.hasTrello ? ['trello_update_card'] : [],
        toolStrategy: 'Update any related Trello cards, notify user of success/failure.'
      }
    ];

    return {
      taskSummary: 'Deployment to Hetzner VPS',
      complexity: 'complex',
      estimatedEffort: 'medium',
      explorationNeeded: false,
      milestones,
      toolsRequired: ['deploy_to_hetzner', 'list_containers', 'get_container_logs'],
      delegationOpportunities: []
    };
  }

  /**
   * Task Management Plan
   */
  private createTaskManagementPlan(task: string, tools: ToolCapability[]): ToolAwarePlan {
    const milestones: ToolAwareMilestone[] = [
      {
        id: 'understand_requirements',
        description: 'Understand task requirements and context',
        completed: false,
        suggestedTools: ['trello_list_boards', 'trello_list_cards'],
        toolStrategy: 'List existing boards and cards to understand current state.'
      },
      {
        id: 'execute_changes',
        description: 'Execute requested Trello changes',
        completed: false,
        suggestedTools: ['trello_create_card', 'trello_update_card', 'trello_add_checklist'],
        toolStrategy: 'Create/update cards, add checklists, organize as requested.'
      },
      {
        id: 'verify_results',
        description: 'Verify changes were applied correctly',
        completed: false,
        suggestedTools: ['trello_list_cards', 'trello_search_cards'],
        toolStrategy: 'Query Trello to confirm changes are visible.'
      }
    ];

    return {
      taskSummary: 'Trello task management',
      complexity: 'moderate',
      estimatedEffort: 'quick',
      explorationNeeded: false,
      milestones,
      toolsRequired: ['trello_list_boards', 'trello_create_card', 'trello_update_card'],
      delegationOpportunities: []
    };
  }

  /**
   * Implementation Plan - Can delegate to Claude agents
   */
  private createImplementationPlan(task: string, tools: ToolCapability[]): ToolAwarePlan {
    const canDelegate = this.hasClaudeContainers;

    const milestones: ToolAwareMilestone[] = [
      {
        id: 'analyze_requirements',
        description: 'Analyze implementation requirements',
        completed: false,
        suggestedTools: ['execute_bash'],
        toolStrategy: 'Explore existing code, understand patterns, identify integration points.'
      },
      {
        id: 'plan_implementation',
        description: 'Plan implementation approach',
        completed: false,
        suggestedTools: this.hasTrello ? ['trello_create_card', 'trello_add_checklist'] : [],
        toolStrategy: 'Break down into subtasks, create tracking cards with checklists.'
      },
      {
        id: 'implement',
        description: 'Implement the feature/changes',
        completed: false,
        suggestedTools: canDelegate ? ['spawn_claude_agent'] : ['execute_bash'],
        toolStrategy: canDelegate
          ? 'Spawn Claude agent for complex implementation. Agent runs autonomously with full coding capabilities.'
          : 'Implement directly using bash commands to create/modify files.',
        canDelegate
      },
      {
        id: 'monitor_progress',
        description: 'Monitor implementation progress',
        completed: false,
        suggestedTools: canDelegate ? ['get_claude_status', 'get_claude_output'] : [],
        toolStrategy: canDelegate
          ? 'Monitor spawned agent progress, check output for issues.'
          : 'N/A - implementation is synchronous.'
      },
      {
        id: 'verify_and_test',
        description: 'Verify implementation and run tests',
        completed: false,
        suggestedTools: ['execute_bash'],
        toolStrategy: 'Run tests, check for errors, validate functionality.'
      },
      {
        id: 'update_tracking',
        description: 'Update task tracking and report results',
        completed: false,
        suggestedTools: this.hasTrello ? ['trello_update_card', 'trello_add_comment'] : [],
        toolStrategy: 'Mark cards complete, add implementation notes.'
      }
    ];

    return {
      taskSummary: 'Feature implementation',
      complexity: 'complex',
      estimatedEffort: 'substantial',
      explorationNeeded: true,
      milestones,
      toolsRequired: canDelegate
        ? ['execute_bash', 'spawn_claude_agent', 'get_claude_status']
        : ['execute_bash'],
      delegationOpportunities: canDelegate ? ['implement'] : []
    };
  }

  /**
   * Default Exploration Plan
   */
  private createExplorationPlan(task: string, tools: ToolCapability[]): ToolAwarePlan {
    const milestones: ToolAwareMilestone[] = [
      {
        id: 'understand_request',
        description: 'Understand the request and gather context',
        completed: false,
        suggestedTools: ['execute_bash'],
        toolStrategy: 'Explore relevant files and gather information needed.'
      },
      {
        id: 'execute_task',
        description: 'Execute the requested task',
        completed: false,
        suggestedTools: tools.slice(0, 3).map(t => t.name),
        toolStrategy: `Use ${tools.slice(0, 3).map(t => t.name).join(', ')} as primary tools.`
      },
      {
        id: 'verify_and_report',
        description: 'Verify results and report to user',
        completed: false,
        suggestedTools: [],
        toolStrategy: 'Confirm task completion and present results.'
      }
    ];

    return {
      taskSummary: task.substring(0, 100),
      complexity: 'moderate',
      estimatedEffort: 'medium',
      explorationNeeded: true,
      milestones,
      toolsRequired: tools.slice(0, 5).map(t => t.name),
      delegationOpportunities: []
    };
  }

  /**
   * Find opportunities to delegate to sub-agents
   */
  private findDelegationOpportunities(task: string, milestones: ToolAwareMilestone[]): string[] {
    if (!this.hasClaudeContainers) return [];

    const opportunities: string[] = [];
    const lower = task.toLowerCase();

    // Complex coding tasks are good candidates
    if (/implement|build|refactor|create|develop/.test(lower) && /complex|large|entire|full/.test(lower)) {
      opportunities.push('Main implementation can be delegated to Claude agent');
    }

    // Multiple independent subtasks
    const delegatableMilestones = milestones.filter(m => m.canDelegate);
    delegatableMilestones.forEach(m => {
      opportunities.push(`Milestone "${m.id}" can be delegated`);
    });

    return opportunities;
  }

  /**
   * Get tool recommendation summary
   */
  getToolRecommendationSummary(plan: ToolAwarePlan): string {
    const lines = [
      `🔧 **Tool-Aware Plan**`,
      `**Required Tools:** ${plan.toolsRequired.join(', ')}`,
      '',
      `**Milestones:**`
    ];

    for (const milestone of plan.milestones) {
      lines.push(`  ${milestone.completed ? '✅' : '⬜'} ${milestone.description}`);
      if (milestone.suggestedTools.length > 0) {
        lines.push(`     Tools: ${milestone.suggestedTools.join(', ')}`);
      }
      if (milestone.toolStrategy) {
        lines.push(`     Strategy: ${milestone.toolStrategy}`);
      }
    }

    if (plan.delegationOpportunities.length > 0) {
      lines.push('');
      lines.push(`**🤖 Delegation Opportunities:**`);
      plan.delegationOpportunities.forEach(opp => lines.push(`  - ${opp}`));
    }

    return lines.join('\n');
  }
}

/**
 * Factory function
 */
export function createToolAwarePlanner(options?: {
  hasTrello?: boolean;
  hasHetzner?: boolean;
  hasClaudeContainers?: boolean;
}): ToolAwarePlanner {
  return new ToolAwarePlanner(options);
}
