import Anthropic from '@anthropic-ai/sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         COGNITIVE AGENT SYSTEM                             ║
 * ║                                                                            ║
 * ║  A fully self-aware, strategic, tool-orchestrating AI agent that:         ║
 * ║                                                                            ║
 * ║  1. UNDERSTANDS CONTEXT - Gathers environment, project, and history       ║
 * ║  2. THINKS STRATEGICALLY - Plans HOW to approach problems                 ║
 * ║  3. ORCHESTRATES TOOLS - Selects and sequences tools intelligently        ║
 * ║  4. MONITORS ITSELF - Detects stalls, pivots, asks for help               ║
 * ║  5. DELEGATES WISELY - Spawns sub-agents for complex subtasks             ║
 * ║  6. LEARNS & ADAPTS - Adjusts strategy based on what's working            ║
 * ║                                                                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface EnvironmentContext {
  workingDirectory: string;
  projectType: 'node' | 'python' | 'go' | 'rust' | 'mixed' | 'unknown';
  projectName?: string;
  hasGit: boolean;
  gitBranch?: string;
  gitStatus?: 'clean' | 'dirty' | 'unknown';
  hasDocker: boolean;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'cargo' | 'go';
  mainEntryPoint?: string;
  keyFiles: string[];
  recentlyModified: string[];
}

export interface ToolInventory {
  available: ToolInfo[];
  configured: string[];  // Tools that are ready to use (have API keys, etc.)
  recommended: string[];  // Tools recommended for current task
}

export interface ToolInfo {
  name: string;
  category: ToolCategory;
  description: string;
  capabilities: string[];
  prerequisites: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  sideEffects: boolean;  // Does this tool change state?
}

export type ToolCategory =
  | 'exploration'      // Reading, searching, understanding
  | 'creation'         // Creating new things
  | 'modification'     // Changing existing things
  | 'execution'        // Running commands, scripts
  | 'deployment'       // Shipping to production
  | 'monitoring'       // Checking status, logs
  | 'communication'    // Trello, notifications
  | 'delegation';      // Sub-agents

export interface ThinkingStyle {
  approach: 'explore-first' | 'plan-first' | 'execute-direct' | 'delegate';
  confidence: number;  // 0-1
  reasoning: string;
  fallbackStrategy?: string;
}

export interface StrategicPlan {
  taskUnderstanding: string;
  approach: ThinkingStyle;
  phases: ExecutionPhase[];
  toolStrategy: ToolStrategy;
  riskAssessment: RiskAssessment;
  successCriteria: string[];
  estimatedComplexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';
}

export interface ExecutionPhase {
  id: string;
  name: string;
  description: string;
  type: 'exploration' | 'planning' | 'execution' | 'verification' | 'reporting';
  tools: string[];
  toolStrategies: { [tool: string]: string };  // How to use each tool
  canParallelize: boolean;
  canDelegate: boolean;
  estimatedIterations: number;
  completionCriteria: string;
  dependencies: string[];
}

export interface ToolStrategy {
  primary: string[];           // Main tools for this task
  secondary: string[];         // Backup tools
  avoidUsing: string[];        // Tools that shouldn't be used
  sequencing: ToolSequence[];  // Recommended tool order
}

export interface ToolSequence {
  phase: string;
  tools: string[];
  rationale: string;
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  concerns: string[];
  mitigations: string[];
}

export interface SelfAssessment {
  isProgressing: boolean;
  progressRate: number;  // 0-1
  isStuck: boolean;
  stuckReason?: string;
  shouldPivot: boolean;
  pivotSuggestion?: string;
  shouldAskUser: boolean;
  questionForUser?: string;
  shouldDelegate: boolean;
  delegationTarget?: string;
  confidenceInApproach: number;  // 0-1
}

export interface ExecutionMemory {
  toolCallHistory: ToolCallRecord[];
  discoveredFacts: string[];
  completedPhases: string[];
  failedAttempts: FailedAttempt[];
  pivots: PivotRecord[];
  delegations: DelegationRecord[];
}

export interface ToolCallRecord {
  tool: string;
  input: any;
  output: any;
  success: boolean;
  timestamp: number;
  duration: number;
  insightsGained: string[];
}

export interface FailedAttempt {
  phase: string;
  tool: string;
  error: string;
  timestamp: number;
}

export interface PivotRecord {
  fromStrategy: string;
  toStrategy: string;
  reason: string;
  timestamp: number;
}

export interface DelegationRecord {
  subtask: string;
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

export interface CognitiveState {
  context: EnvironmentContext;
  tools: ToolInventory;
  plan: StrategicPlan;
  memory: ExecutionMemory;
  currentPhase: string;
  iteration: number;
  selfAssessment: SelfAssessment;
}

// ============================================================================
// CONTEXT ENGINE - Understanding the Environment
// ============================================================================

export class ContextEngine {
  /**
   * Gather comprehensive context about the current environment
   */
  static async gatherContext(workingDir?: string): Promise<EnvironmentContext> {
    const cwd = workingDir || process.cwd();
    logger.info(`🔍 Context Engine: Analyzing environment at ${cwd}`);

    const [
      projectType,
      gitInfo,
      keyFiles,
      recentFiles
    ] = await Promise.all([
      this.detectProjectType(cwd),
      this.getGitInfo(cwd),
      this.findKeyFiles(cwd),
      this.findRecentlyModified(cwd)
    ]);

    const context: EnvironmentContext = {
      workingDirectory: cwd,
      projectType: projectType.type,
      projectName: projectType.name,
      hasGit: gitInfo.hasGit,
      gitBranch: gitInfo.branch,
      gitStatus: gitInfo.status,
      hasDocker: await this.hasDocker(cwd),
      packageManager: projectType.packageManager,
      mainEntryPoint: projectType.entryPoint,
      keyFiles,
      recentlyModified: recentFiles
    };

    logger.info(`📊 Context gathered: ${context.projectType} project, ${context.keyFiles.length} key files`);
    return context;
  }

  private static async detectProjectType(cwd: string): Promise<{
    type: EnvironmentContext['projectType'];
    name?: string;
    packageManager?: EnvironmentContext['packageManager'];
    entryPoint?: string;
  }> {
    try {
      // Check for package.json (Node)
      const { stdout: pkgCheck } = await execAsync(`test -f "${cwd}/package.json" && echo "exists"`, { timeout: 5000 }).catch(() => ({ stdout: '' }));
      if (pkgCheck.includes('exists')) {
        const { stdout: pkgContent } = await execAsync(`cat "${cwd}/package.json"`, { timeout: 5000 });
        const pkg = JSON.parse(pkgContent);
        return {
          type: 'node',
          name: pkg.name,
          packageManager: 'npm',
          entryPoint: pkg.main || 'index.js'
        };
      }

      // Check for pyproject.toml or requirements.txt (Python)
      const { stdout: pyCheck } = await execAsync(`test -f "${cwd}/pyproject.toml" -o -f "${cwd}/requirements.txt" && echo "exists"`, { timeout: 5000 }).catch(() => ({ stdout: '' }));
      if (pyCheck.includes('exists')) {
        return { type: 'python', packageManager: 'pip' };
      }

      // Check for go.mod (Go)
      const { stdout: goCheck } = await execAsync(`test -f "${cwd}/go.mod" && echo "exists"`, { timeout: 5000 }).catch(() => ({ stdout: '' }));
      if (goCheck.includes('exists')) {
        return { type: 'go', packageManager: 'go' };
      }

      // Check for Cargo.toml (Rust)
      const { stdout: rustCheck } = await execAsync(`test -f "${cwd}/Cargo.toml" && echo "exists"`, { timeout: 5000 }).catch(() => ({ stdout: '' }));
      if (rustCheck.includes('exists')) {
        return { type: 'rust', packageManager: 'cargo' };
      }

      return { type: 'unknown' };
    } catch {
      return { type: 'unknown' };
    }
  }

  private static async getGitInfo(cwd: string): Promise<{
    hasGit: boolean;
    branch?: string;
    status?: 'clean' | 'dirty' | 'unknown';
  }> {
    try {
      const { stdout: branch } = await execAsync(`cd "${cwd}" && git rev-parse --abbrev-ref HEAD`, { timeout: 5000 });
      const { stdout: status } = await execAsync(`cd "${cwd}" && git status --porcelain`, { timeout: 5000 });

      return {
        hasGit: true,
        branch: branch.trim(),
        status: status.trim() === '' ? 'clean' : 'dirty'
      };
    } catch {
      return { hasGit: false };
    }
  }

  private static async hasDocker(cwd: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`test -f "${cwd}/Dockerfile" -o -f "${cwd}/docker-compose.yml" && echo "exists"`, { timeout: 5000 });
      return stdout.includes('exists');
    } catch {
      return false;
    }
  }

  private static async findKeyFiles(cwd: string): Promise<string[]> {
    const keyPatterns = [
      'package.json', 'tsconfig.json', 'README.md',
      'src/index.ts', 'src/index.js', 'src/main.ts',
      'Dockerfile', 'docker-compose.yml',
      '.env.example', 'config/*'
    ];

    const keyFiles: string[] = [];

    for (const pattern of keyPatterns) {
      try {
        const { stdout } = await execAsync(`cd "${cwd}" && ls ${pattern} 2>/dev/null || true`, { timeout: 5000 });
        if (stdout.trim()) {
          keyFiles.push(...stdout.trim().split('\n').filter(Boolean));
        }
      } catch {
        // Pattern not found, continue
      }
    }

    return keyFiles.slice(0, 20);  // Limit to 20 files
  }

  private static async findRecentlyModified(cwd: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `cd "${cwd}" && find . -type f -name "*.ts" -o -name "*.js" -o -name "*.py" 2>/dev/null | head -50 | xargs ls -t 2>/dev/null | head -10`,
        { timeout: 10000 }
      );
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

// ============================================================================
// TOOL REGISTRY - Complete Tool Inventory
// ============================================================================

export const COGNITIVE_TOOL_REGISTRY: ToolInfo[] = [
  // Exploration Tools
  {
    name: 'execute_bash',
    category: 'exploration',
    description: 'Execute shell commands for file operations, searching, git, npm, etc.',
    capabilities: ['read files', 'search code', 'run commands', 'git operations', 'npm/package management'],
    prerequisites: [],
    complexity: 'simple',
    sideEffects: true
  },

  // Trello Tools - Communication/Organization
  {
    name: 'trello_list_boards',
    category: 'communication',
    description: 'List all available Trello boards',
    capabilities: ['view boards', 'understand project organization'],
    prerequisites: ['trello_api_key'],
    complexity: 'simple',
    sideEffects: false
  },
  {
    name: 'trello_create_card',
    category: 'communication',
    description: 'Create task cards for tracking work',
    capabilities: ['create tasks', 'organize work', 'track progress'],
    prerequisites: ['trello_api_key'],
    complexity: 'simple',
    sideEffects: true
  },
  {
    name: 'trello_add_checklist',
    category: 'communication',
    description: 'Add checklists to cards for subtask tracking',
    capabilities: ['break down tasks', 'track subtasks'],
    prerequisites: ['trello_api_key'],
    complexity: 'simple',
    sideEffects: true
  },
  {
    name: 'trello_update_card',
    category: 'communication',
    description: 'Update card status, move between lists',
    capabilities: ['update status', 'move cards', 'track progress'],
    prerequisites: ['trello_api_key'],
    complexity: 'simple',
    sideEffects: true
  },
  {
    name: 'trello_add_comment',
    category: 'communication',
    description: 'Add comments to cards for documentation',
    capabilities: ['document progress', 'add notes'],
    prerequisites: ['trello_api_key'],
    complexity: 'simple',
    sideEffects: true
  },

  // Deployment Tools
  {
    name: 'deploy_to_hetzner',
    category: 'deployment',
    description: 'Deploy Docker containers to Hetzner VPS',
    capabilities: ['deploy containers', 'ship code', 'production deployment'],
    prerequisites: ['hetzner_ssh_key'],
    complexity: 'complex',
    sideEffects: true
  },
  {
    name: 'list_containers',
    category: 'monitoring',
    description: 'List running Docker containers',
    capabilities: ['view deployments', 'check running services'],
    prerequisites: ['hetzner_ssh_key'],
    complexity: 'simple',
    sideEffects: false
  },
  {
    name: 'get_container_logs',
    category: 'monitoring',
    description: 'Get logs from running containers',
    capabilities: ['debug issues', 'view output', 'monitor health'],
    prerequisites: ['hetzner_ssh_key'],
    complexity: 'simple',
    sideEffects: false
  },
  {
    name: 'restart_container',
    category: 'execution',
    description: 'Restart a running container',
    capabilities: ['restart services', 'apply changes'],
    prerequisites: ['hetzner_ssh_key'],
    complexity: 'simple',
    sideEffects: true
  },
  {
    name: 'get_container_stats',
    category: 'monitoring',
    description: 'Get CPU/memory stats for containers',
    capabilities: ['monitor resources', 'check performance'],
    prerequisites: ['hetzner_ssh_key'],
    complexity: 'simple',
    sideEffects: false
  },

  // Delegation Tools - Sub-agents
  {
    name: 'spawn_claude_agent',
    category: 'delegation',
    description: 'Spawn an autonomous Claude Code agent for complex subtasks',
    capabilities: ['autonomous coding', 'complex implementations', 'parallel work'],
    prerequisites: ['anthropic_api_key', 'hetzner_ssh_key'],
    complexity: 'complex',
    sideEffects: true
  },
  {
    name: 'get_claude_status',
    category: 'monitoring',
    description: 'Check status of spawned Claude agent',
    capabilities: ['monitor sub-agent', 'track progress'],
    prerequisites: [],
    complexity: 'simple',
    sideEffects: false
  },
  {
    name: 'wait_for_claude_agent',
    category: 'delegation',
    description: 'Wait for Claude agent to complete and get results',
    capabilities: ['synchronize agents', 'get results'],
    prerequisites: [],
    complexity: 'simple',
    sideEffects: false
  },
  {
    name: 'stop_claude_agent',
    category: 'delegation',
    description: 'Stop a running Claude agent',
    capabilities: ['cancel work', 'abort agent'],
    prerequisites: [],
    complexity: 'simple',
    sideEffects: true
  }
];

// ============================================================================
// STRATEGIC PLANNER - Thinking About HOW to Think
// ============================================================================

export class StrategicPlanner {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Create a comprehensive strategic plan for a task
   */
  async createStrategicPlan(
    task: string,
    context: EnvironmentContext,
    tools: ToolInventory
  ): Promise<StrategicPlan> {
    logger.info(`🧠 Strategic Planner: Analyzing task...`);

    // First, determine the thinking approach
    const approach = await this.determineApproach(task, context);
    logger.info(`   Approach: ${approach.approach} (confidence: ${(approach.confidence * 100).toFixed(0)}%)`);

    // Create phases based on approach
    const phases = await this.createPhases(task, context, tools, approach);
    logger.info(`   Phases: ${phases.length}`);

    // Determine tool strategy
    const toolStrategy = this.createToolStrategy(task, phases, tools);
    logger.info(`   Primary tools: ${toolStrategy.primary.join(', ')}`);

    // Assess risks
    const riskAssessment = this.assessRisks(task, phases, tools);

    // Define success criteria
    const successCriteria = this.defineSuccessCriteria(task, phases);

    // Estimate complexity
    const complexity = this.estimateComplexity(phases, approach);

    return {
      taskUnderstanding: await this.summarizeTaskUnderstanding(task, context),
      approach,
      phases,
      toolStrategy,
      riskAssessment,
      successCriteria,
      estimatedComplexity: complexity
    };
  }

  /**
   * Determine the best thinking approach for this task
   */
  private async determineApproach(task: string, context: EnvironmentContext): Promise<ThinkingStyle> {
    const lower = task.toLowerCase();

    // Explore-first: Unknown scope, need to understand before acting
    if (this.needsExploration(lower)) {
      return {
        approach: 'explore-first',
        confidence: 0.9,
        reasoning: 'Task requires understanding codebase/context before execution',
        fallbackStrategy: 'If exploration reveals simpler scope, switch to execute-direct'
      };
    }

    // Delegate: Complex implementation that benefits from autonomous agent
    if (this.shouldDelegate(lower, context)) {
      return {
        approach: 'delegate',
        confidence: 0.85,
        reasoning: 'Complex implementation task suitable for autonomous Claude agent',
        fallbackStrategy: 'If delegation fails, fall back to plan-first with manual execution'
      };
    }

    // Plan-first: Known scope but multi-step
    if (this.needsPlanning(lower)) {
      return {
        approach: 'plan-first',
        confidence: 0.85,
        reasoning: 'Multi-step task with clear scope - benefits from upfront planning',
        fallbackStrategy: 'If plan proves incorrect, pause and re-plan'
      };
    }

    // Execute-direct: Simple, clear task
    return {
      approach: 'execute-direct',
      confidence: 0.95,
      reasoning: 'Straightforward task with clear objective - no planning overhead needed',
      fallbackStrategy: 'If task proves more complex, switch to plan-first'
    };
  }

  private needsExploration(task: string): boolean {
    const explorationTriggers = [
      /analyze|review|audit|examine|understand|investigate|assess|evaluate/,
      /how does|what is|explain|describe/,
      /improve|optimize|refactor|fix.*issues/,
      /codebase|repo|project|architecture/
    ];
    return explorationTriggers.some(pattern => pattern.test(task));
  }

  private shouldDelegate(task: string, context: EnvironmentContext): boolean {
    const delegationTriggers = [
      /implement|build|create|develop/,
      /full|complete|entire|comprehensive/,
      /feature|system|module|service/
    ];

    const hasImplementation = delegationTriggers.some(p => p.test(task));
    const isComplex = task.length > 100 || task.includes(' and ');

    return hasImplementation && isComplex;
  }

  private needsPlanning(task: string): boolean {
    const planningTriggers = [
      / and |then |after |step|phase/,
      /multiple|several|all|each/,
      /deploy|migrate|upgrade/
    ];
    return planningTriggers.some(pattern => pattern.test(task));
  }

  /**
   * Create execution phases based on approach
   */
  private async createPhases(
    task: string,
    context: EnvironmentContext,
    tools: ToolInventory,
    approach: ThinkingStyle
  ): Promise<ExecutionPhase[]> {
    const phases: ExecutionPhase[] = [];

    switch (approach.approach) {
      case 'explore-first':
        phases.push(...this.createExplorationPhases(task, context, tools));
        break;

      case 'delegate':
        phases.push(...this.createDelegationPhases(task, context, tools));
        break;

      case 'plan-first':
        phases.push(...this.createPlannedPhases(task, context, tools));
        break;

      case 'execute-direct':
        phases.push(...this.createDirectPhases(task, context, tools));
        break;
    }

    return phases;
  }

  private createExplorationPhases(task: string, context: EnvironmentContext, tools: ToolInventory): ExecutionPhase[] {
    const lower = task.toLowerCase();
    const isCodebaseAnalysis = /codebase|repo|project|architecture/.test(lower);

    if (isCodebaseAnalysis) {
      return [
        {
          id: 'understand_structure',
          name: 'Understand Project Structure',
          description: 'Map the project layout, identify key directories and patterns',
          type: 'exploration',
          tools: ['execute_bash'],
          toolStrategies: {
            'execute_bash': 'Use tree, find, ls to explore. Look at package.json, entry points, src structure.'
          },
          canParallelize: false,
          canDelegate: false,
          estimatedIterations: 3,
          completionCriteria: 'Have clear mental model of project structure',
          dependencies: []
        },
        {
          id: 'identify_components',
          name: 'Identify Key Components',
          description: 'Find main modules, services, utilities and their relationships',
          type: 'exploration',
          tools: ['execute_bash'],
          toolStrategies: {
            'execute_bash': 'Read key files, grep for exports/imports, understand module boundaries'
          },
          canParallelize: false,
          canDelegate: false,
          estimatedIterations: 5,
          completionCriteria: 'Identified all major components and dependencies',
          dependencies: ['understand_structure']
        },
        {
          id: 'deep_analysis',
          name: 'Deep Code Analysis',
          description: 'Analyze code quality, patterns, potential issues',
          type: 'exploration',
          tools: ['execute_bash'],
          toolStrategies: {
            'execute_bash': 'Look for TODOs, FIXMEs, complex functions, missing tests, code smells'
          },
          canParallelize: true,
          canDelegate: true,
          estimatedIterations: 8,
          completionCriteria: 'Comprehensive understanding of code quality and issues',
          dependencies: ['identify_components']
        },
        {
          id: 'synthesize_findings',
          name: 'Synthesize Findings',
          description: 'Organize discoveries into actionable insights',
          type: 'planning',
          tools: tools.configured.includes('trello') ? ['trello_create_card', 'trello_add_checklist'] : [],
          toolStrategies: {
            'trello_create_card': 'Create cards for each recommendation category',
            'trello_add_checklist': 'Add specific action items as checklist items'
          },
          canParallelize: false,
          canDelegate: false,
          estimatedIterations: 3,
          completionCriteria: 'Organized list of findings and recommendations',
          dependencies: ['deep_analysis']
        },
        {
          id: 'present_results',
          name: 'Present Results',
          description: 'Format and communicate findings to user',
          type: 'reporting',
          tools: [],
          toolStrategies: {},
          canParallelize: false,
          canDelegate: false,
          estimatedIterations: 1,
          completionCriteria: 'User has received comprehensive analysis',
          dependencies: ['synthesize_findings']
        }
      ];
    }

    // Generic exploration phases
    return [
      {
        id: 'gather_context',
        name: 'Gather Context',
        description: 'Understand the current state and what we\'re working with',
        type: 'exploration',
        tools: ['execute_bash'],
        toolStrategies: {
          'execute_bash': 'Explore relevant files and gather information'
        },
        canParallelize: false,
        canDelegate: false,
        estimatedIterations: 3,
        completionCriteria: 'Sufficient context to proceed',
        dependencies: []
      },
      {
        id: 'analyze',
        name: 'Analyze',
        description: 'Analyze gathered information',
        type: 'exploration',
        tools: ['execute_bash'],
        toolStrategies: {},
        canParallelize: false,
        canDelegate: false,
        estimatedIterations: 4,
        completionCriteria: 'Analysis complete',
        dependencies: ['gather_context']
      },
      {
        id: 'report',
        name: 'Report Findings',
        description: 'Present analysis results',
        type: 'reporting',
        tools: [],
        toolStrategies: {},
        canParallelize: false,
        canDelegate: false,
        estimatedIterations: 1,
        completionCriteria: 'User informed of findings',
        dependencies: ['analyze']
      }
    ];
  }

  private createDelegationPhases(task: string, context: EnvironmentContext, tools: ToolInventory): ExecutionPhase[] {
    return [
      {
        id: 'prepare_delegation',
        name: 'Prepare for Delegation',
        description: 'Gather context and prepare clear instructions for sub-agent',
        type: 'planning',
        tools: ['execute_bash'],
        toolStrategies: {
          'execute_bash': 'Gather relevant file paths, understand current state'
        },
        canParallelize: false,
        canDelegate: false,
        estimatedIterations: 3,
        completionCriteria: 'Clear task description and context files identified',
        dependencies: []
      },
      {
        id: 'spawn_agent',
        name: 'Spawn Claude Agent',
        description: 'Launch autonomous agent with prepared task',
        type: 'execution',
        tools: ['spawn_claude_agent'],
        toolStrategies: {
          'spawn_claude_agent': 'Provide clear task, workspace path, context files, and requirements'
        },
        canParallelize: false,
        canDelegate: false,
        estimatedIterations: 1,
        completionCriteria: 'Agent spawned and running',
        dependencies: ['prepare_delegation']
      },
      {
        id: 'monitor_agent',
        name: 'Monitor Agent Progress',
        description: 'Track agent progress and handle any issues',
        type: 'verification',
        tools: ['get_claude_status', 'get_claude_output'],
        toolStrategies: {
          'get_claude_status': 'Check every few seconds for completion',
          'get_claude_output': 'Review output for errors or issues'
        },
        canParallelize: false,
        canDelegate: false,
        estimatedIterations: 10,
        completionCriteria: 'Agent completed or failed',
        dependencies: ['spawn_agent']
      },
      {
        id: 'verify_results',
        name: 'Verify Results',
        description: 'Check that agent completed task correctly',
        type: 'verification',
        tools: ['execute_bash'],
        toolStrategies: {
          'execute_bash': 'Run tests, check for expected changes, validate output'
        },
        canParallelize: false,
        canDelegate: false,
        estimatedIterations: 3,
        completionCriteria: 'Results verified and acceptable',
        dependencies: ['monitor_agent']
      },
      {
        id: 'report_completion',
        name: 'Report Completion',
        description: 'Inform user of results and any follow-up needed',
        type: 'reporting',
        tools: tools.configured.includes('trello') ? ['trello_update_card', 'trello_add_comment'] : [],
        toolStrategies: {},
        canParallelize: false,
        canDelegate: false,
        estimatedIterations: 1,
        completionCriteria: 'User informed of completion',
        dependencies: ['verify_results']
      }
    ];
  }

  private createPlannedPhases(task: string, context: EnvironmentContext, tools: ToolInventory): ExecutionPhase[] {
    const lower = task.toLowerCase();

    // Deployment task
    if (/deploy|ship|release/.test(lower)) {
      return [
        {
          id: 'pre_deploy_check',
          name: 'Pre-Deployment Checks',
          description: 'Verify prerequisites and current state',
          type: 'verification',
          tools: ['execute_bash', 'list_containers'],
          toolStrategies: {
            'execute_bash': 'Check git status, run tests, verify build',
            'list_containers': 'Check current running containers'
          },
          canParallelize: true,
          canDelegate: false,
          estimatedIterations: 3,
          completionCriteria: 'All checks pass',
          dependencies: []
        },
        {
          id: 'build',
          name: 'Build',
          description: 'Build the application',
          type: 'execution',
          tools: ['execute_bash'],
          toolStrategies: {
            'execute_bash': 'Run npm build or equivalent'
          },
          canParallelize: false,
          canDelegate: false,
          estimatedIterations: 2,
          completionCriteria: 'Build succeeds',
          dependencies: ['pre_deploy_check']
        },
        {
          id: 'deploy',
          name: 'Deploy',
          description: 'Deploy to target environment',
          type: 'execution',
          tools: ['deploy_to_hetzner'],
          toolStrategies: {
            'deploy_to_hetzner': 'Deploy with appropriate config, env vars, ports'
          },
          canParallelize: false,
          canDelegate: false,
          estimatedIterations: 2,
          completionCriteria: 'Deployment command succeeds',
          dependencies: ['build']
        },
        {
          id: 'verify_deploy',
          name: 'Verify Deployment',
          description: 'Confirm deployment is healthy',
          type: 'verification',
          tools: ['get_container_logs', 'get_container_stats', 'execute_bash'],
          toolStrategies: {
            'get_container_logs': 'Check for startup errors',
            'get_container_stats': 'Verify resource usage is normal',
            'execute_bash': 'Test endpoints if applicable'
          },
          canParallelize: true,
          canDelegate: false,
          estimatedIterations: 3,
          completionCriteria: 'Container healthy and responding',
          dependencies: ['deploy']
        },
        {
          id: 'report_deploy',
          name: 'Report Status',
          description: 'Notify of deployment status',
          type: 'reporting',
          tools: tools.configured.includes('trello') ? ['trello_update_card'] : [],
          toolStrategies: {},
          canParallelize: false,
          canDelegate: false,
          estimatedIterations: 1,
          completionCriteria: 'Status communicated',
          dependencies: ['verify_deploy']
        }
      ];
    }

    // Generic multi-step task
    return [
      {
        id: 'understand_task',
        name: 'Understand Task',
        description: 'Parse and understand all requirements',
        type: 'planning',
        tools: [],
        toolStrategies: {},
        canParallelize: false,
        canDelegate: false,
        estimatedIterations: 1,
        completionCriteria: 'Clear understanding of requirements',
        dependencies: []
      },
      {
        id: 'execute_steps',
        name: 'Execute Steps',
        description: 'Execute each step of the task',
        type: 'execution',
        tools: ['execute_bash'],
        toolStrategies: {},
        canParallelize: false,
        canDelegate: true,
        estimatedIterations: 5,
        completionCriteria: 'All steps complete',
        dependencies: ['understand_task']
      },
      {
        id: 'verify',
        name: 'Verify Results',
        description: 'Confirm task completed correctly',
        type: 'verification',
        tools: ['execute_bash'],
        toolStrategies: {},
        canParallelize: false,
        canDelegate: false,
        estimatedIterations: 2,
        completionCriteria: 'Results verified',
        dependencies: ['execute_steps']
      }
    ];
  }

  private createDirectPhases(task: string, context: EnvironmentContext, tools: ToolInventory): ExecutionPhase[] {
    return [
      {
        id: 'execute',
        name: 'Execute Task',
        description: 'Directly execute the requested task',
        type: 'execution',
        tools: this.selectToolsForTask(task, tools),
        toolStrategies: {},
        canParallelize: false,
        canDelegate: false,
        estimatedIterations: 3,
        completionCriteria: 'Task complete',
        dependencies: []
      },
      {
        id: 'confirm',
        name: 'Confirm Completion',
        description: 'Verify and report results',
        type: 'verification',
        tools: [],
        toolStrategies: {},
        canParallelize: false,
        canDelegate: false,
        estimatedIterations: 1,
        completionCriteria: 'Results confirmed',
        dependencies: ['execute']
      }
    ];
  }

  private selectToolsForTask(task: string, tools: ToolInventory): string[] {
    const lower = task.toLowerCase();
    const selected: string[] = [];

    // Always have bash
    selected.push('execute_bash');

    // Trello keywords
    if (/trello|card|board|list/.test(lower)) {
      selected.push(...tools.available.filter(t => t.name.startsWith('trello_')).map(t => t.name));
    }

    // Deployment keywords
    if (/deploy|container|docker/.test(lower)) {
      selected.push('deploy_to_hetzner', 'list_containers');
    }

    // Monitoring keywords
    if (/logs|status|stats/.test(lower)) {
      selected.push('get_container_logs', 'get_container_stats', 'list_containers');
    }

    return [...new Set(selected)];
  }

  private createToolStrategy(task: string, phases: ExecutionPhase[], tools: ToolInventory): ToolStrategy {
    const allPhaseTools = phases.flatMap(p => p.tools);
    const uniqueTools = [...new Set(allPhaseTools)];

    // Determine primary tools (used in multiple phases or critical phases)
    const toolUsage = new Map<string, number>();
    for (const tool of allPhaseTools) {
      toolUsage.set(tool, (toolUsage.get(tool) || 0) + 1);
    }

    const primary = uniqueTools.filter(t => (toolUsage.get(t) || 0) >= 2 || t === 'execute_bash');
    const secondary = uniqueTools.filter(t => !primary.includes(t));

    // Tools to avoid (not configured or risky for this task)
    const avoidUsing: string[] = [];
    if (!task.toLowerCase().includes('deploy')) {
      avoidUsing.push('deploy_to_hetzner');
    }
    if (!task.toLowerCase().includes('agent') && !task.toLowerCase().includes('implement')) {
      avoidUsing.push('spawn_claude_agent');
    }

    // Create sequencing
    const sequencing: ToolSequence[] = phases.map(phase => ({
      phase: phase.id,
      tools: phase.tools,
      rationale: phase.toolStrategies[phase.tools[0]] || 'Standard tool usage'
    }));

    return { primary, secondary, avoidUsing, sequencing };
  }

  private assessRisks(task: string, phases: ExecutionPhase[], tools: ToolInventory): RiskAssessment {
    const concerns: string[] = [];
    const mitigations: string[] = [];

    // Check for deployment risk
    if (phases.some(p => p.tools.includes('deploy_to_hetzner'))) {
      concerns.push('Deployment affects production environment');
      mitigations.push('Verify build before deploying, check logs after');
    }

    // Check for delegation risk
    if (phases.some(p => p.tools.includes('spawn_claude_agent'))) {
      concerns.push('Delegated agent operates autonomously');
      mitigations.push('Monitor agent progress, set timeout, verify results');
    }

    // Check for data modification risk
    if (phases.some(p => p.type === 'execution' && p.tools.some(t => {
      const info = tools.available.find(ti => ti.name === t);
      return info?.sideEffects;
    }))) {
      concerns.push('Task involves state-changing operations');
      mitigations.push('Verify changes after each operation');
    }

    const level = concerns.length === 0 ? 'low' : concerns.length <= 2 ? 'medium' : 'high';

    return { level, concerns, mitigations };
  }

  private defineSuccessCriteria(task: string, phases: ExecutionPhase[]): string[] {
    const criteria: string[] = [];

    // Phase completion
    criteria.push(`All ${phases.length} phases completed successfully`);

    // Task-specific criteria
    const lower = task.toLowerCase();
    if (/analyze|review/.test(lower)) {
      criteria.push('Comprehensive analysis delivered');
      criteria.push('Actionable recommendations provided');
    }
    if (/deploy/.test(lower)) {
      criteria.push('Container running and healthy');
      criteria.push('No errors in logs');
    }
    if (/create|build|implement/.test(lower)) {
      criteria.push('Implementation complete');
      criteria.push('Tests pass (if applicable)');
    }

    // General criteria
    criteria.push('User satisfied with results');

    return criteria;
  }

  private estimateComplexity(phases: ExecutionPhase[], approach: ThinkingStyle): StrategicPlan['estimatedComplexity'] {
    const totalIterations = phases.reduce((sum, p) => sum + p.estimatedIterations, 0);
    const hasDelegation = phases.some(p => p.canDelegate);
    const hasDeployment = phases.some(p => p.tools.includes('deploy_to_hetzner'));

    if (totalIterations <= 3) return 'trivial';
    if (totalIterations <= 8 && !hasDelegation && !hasDeployment) return 'simple';
    if (totalIterations <= 15) return 'moderate';
    if (totalIterations <= 30 || hasDelegation) return 'complex';
    return 'very_complex';
  }

  private async summarizeTaskUnderstanding(task: string, context: EnvironmentContext): Promise<string> {
    const parts: string[] = [];

    parts.push(`Task: ${task.substring(0, 100)}${task.length > 100 ? '...' : ''}`);
    parts.push(`Project: ${context.projectType} (${context.projectName || 'unnamed'})`);

    if (context.hasGit) {
      parts.push(`Git: ${context.gitBranch} (${context.gitStatus})`);
    }

    return parts.join(' | ');
  }
}

// ============================================================================
// SELF-MONITOR - Continuous Self-Assessment
// ============================================================================

export class SelfMonitor {
  private memory: ExecutionMemory;
  private progressWindow: number[] = [];  // Recent progress scores

  // IMPROVED: Higher thresholds to reduce premature stuck detection
  private stuckThreshold = 5;  // Iterations without progress before considered stuck (was 3)
  private stuckSameActionThreshold = 5;  // Same action repetitions before stuck (was implicit 2)

  // NEW: Rate limiting for user questions to prevent spam
  private lastUserQuestionTime: number = 0;
  private readonly USER_QUESTION_COOLDOWN_MS = parseInt(process.env.USER_QUESTION_COOLDOWN_MS || '60000');  // 1 minute
  private userQuestionsAsked: number = 0;
  private readonly MAX_USER_QUESTIONS_PER_TASK = parseInt(process.env.MAX_USER_QUESTIONS_PER_TASK || '3');

  // NEW: Iteration tracking for smarter decisions
  private currentIteration: number = 0;
  private readonly STUCK_ITERATION_THRESHOLD = parseInt(process.env.STUCK_ITERATION_THRESHOLD || '15');

  constructor() {
    this.memory = {
      toolCallHistory: [],
      discoveredFacts: [],
      completedPhases: [],
      failedAttempts: [],
      pivots: [],
      delegations: []
    };
  }

  /**
   * Set current iteration (called by executor)
   */
  setIteration(iteration: number): void {
    this.currentIteration = iteration;
  }

  /**
   * Record a tool call
   */
  recordToolCall(record: ToolCallRecord): void {
    this.memory.toolCallHistory.push(record);

    // Update progress window
    const progressScore = record.success && record.insightsGained.length > 0 ? 1 : 0;
    this.progressWindow.push(progressScore);
    if (this.progressWindow.length > 10) {
      this.progressWindow.shift();
    }
  }

  /**
   * Record a discovered fact
   */
  recordDiscovery(fact: string): void {
    if (!this.memory.discoveredFacts.includes(fact)) {
      this.memory.discoveredFacts.push(fact);
      logger.info(`💡 Discovery: ${fact}`);
    }
  }

  /**
   * Mark a phase as complete
   */
  completePhase(phaseId: string): void {
    if (!this.memory.completedPhases.includes(phaseId)) {
      this.memory.completedPhases.push(phaseId);
      logger.info(`✅ Phase complete: ${phaseId}`);
    }
  }

  /**
   * Record a failed attempt
   */
  recordFailure(phase: string, tool: string, error: string): void {
    this.memory.failedAttempts.push({
      phase,
      tool,
      error,
      timestamp: Date.now()
    });
    logger.warn(`❌ Failed attempt in ${phase}: ${tool} - ${error}`);
  }

  /**
   * Perform self-assessment
   */
  assess(currentPhase: string, plan: StrategicPlan): SelfAssessment {
    const recentProgress = this.progressWindow.slice(-5);
    const progressRate = recentProgress.length > 0
      ? recentProgress.reduce((a, b) => a + b, 0) / recentProgress.length
      : 0;

    const isProgressing = progressRate > 0.3;
    const isStuck = this.detectStuck();
    const shouldPivot = this.shouldPivot(plan);
    const shouldAskUser = this.shouldAskUser();
    const shouldDelegate = this.shouldDelegate(currentPhase, plan);

    const assessment: SelfAssessment = {
      isProgressing,
      progressRate,
      isStuck,
      stuckReason: isStuck ? this.getStuckReason() : undefined,
      shouldPivot,
      pivotSuggestion: shouldPivot ? this.getPivotSuggestion(plan) : undefined,
      shouldAskUser,
      questionForUser: shouldAskUser ? this.getQuestionForUser() : undefined,
      shouldDelegate,
      delegationTarget: shouldDelegate ? this.getDelegationTarget(currentPhase, plan) : undefined,
      confidenceInApproach: this.calculateConfidence(plan)
    };

    return assessment;
  }

  private detectStuck(): boolean {
    // IMPROVED: Only check if we've been running for a reasonable number of iterations
    if (this.currentIteration < 5) {
      return false;  // Too early to determine stuck
    }

    // Check for repeated failures with same tool (3+ consecutive failures)
    const recentFailures = this.memory.failedAttempts.slice(-4);
    if (recentFailures.length >= 4) {
      const sameToolFailures = recentFailures.every(f => f.tool === recentFailures[0].tool);
      if (sameToolFailures) return true;
    }

    // IMPROVED: Check for lack of progress (require more iterations)
    const recentProgress = this.progressWindow.slice(-this.stuckThreshold);
    if (recentProgress.length >= this.stuckThreshold && recentProgress.every(p => p === 0)) {
      return true;
    }

    // IMPROVED: Check for repeated tool calls with same input (higher threshold)
    const recentCalls = this.memory.toolCallHistory.slice(-7);
    if (recentCalls.length >= this.stuckSameActionThreshold) {
      const signatures = recentCalls.map(c => `${c.tool}:${JSON.stringify(c.input).substring(0, 100)}`);
      const uniqueSignatures = new Set(signatures);
      // Only consider stuck if 2 or fewer unique actions in last 7 calls
      if (uniqueSignatures.size <= 2) return true;
    }

    return false;
  }

  private getStuckReason(): string {
    const recentFailures = this.memory.failedAttempts.slice(-3);
    if (recentFailures.length >= 3) {
      return `Repeated failures with ${recentFailures[0].tool}: ${recentFailures[0].error}`;
    }

    if (this.progressWindow.slice(-3).every(p => p === 0)) {
      return 'No meaningful progress in recent iterations';
    }

    return 'Repeating same actions without results';
  }

  private shouldPivot(plan: StrategicPlan): boolean {
    // Pivot if stuck and have a fallback
    if (this.detectStuck() && plan.approach.fallbackStrategy) {
      return true;
    }

    // Pivot if confidence dropped significantly
    if (this.calculateConfidence(plan) < 0.3) {
      return true;
    }

    return false;
  }

  private getPivotSuggestion(plan: StrategicPlan): string {
    if (plan.approach.fallbackStrategy) {
      return plan.approach.fallbackStrategy;
    }

    // Suggest based on what's failing
    const recentFailures = this.memory.failedAttempts.slice(-3);
    if (recentFailures.some(f => f.tool === 'spawn_claude_agent')) {
      return 'Delegation failing - try direct execution instead';
    }

    return 'Try a different approach or break task into smaller pieces';
  }

  private shouldAskUser(): boolean {
    // RATE LIMITING: Don't ask if we haven't been running long enough
    if (this.currentIteration < this.STUCK_ITERATION_THRESHOLD) {
      return false;
    }

    // RATE LIMITING: Don't ask too frequently
    const timeSinceLastQuestion = Date.now() - this.lastUserQuestionTime;
    if (this.lastUserQuestionTime > 0 && timeSinceLastQuestion < this.USER_QUESTION_COOLDOWN_MS) {
      return false;
    }

    // RATE LIMITING: Don't ask too many times per task
    if (this.userQuestionsAsked >= this.MAX_USER_QUESTIONS_PER_TASK) {
      return false;
    }

    // Only ask if actually stuck
    if (!this.detectStuck()) {
      return false;
    }

    // Ask if we've failed multiple times and pivoted already
    if (this.memory.pivots.length >= 2) {
      return true;
    }

    // Ask if we're stuck and no clear pivot path
    if (this.memory.failedAttempts.length >= 5) {
      return true;
    }

    return false;
  }

  /**
   * Record that a user question was asked (for rate limiting)
   */
  recordUserQuestionAsked(): void {
    this.lastUserQuestionTime = Date.now();
    this.userQuestionsAsked++;
    logger.info(`📝 User question asked (${this.userQuestionsAsked}/${this.MAX_USER_QUESTIONS_PER_TASK})`);
  }

  /**
   * Check if we can ask user (for external callers)
   */
  canAskUser(): boolean {
    const timeSinceLastQuestion = Date.now() - this.lastUserQuestionTime;
    return this.userQuestionsAsked < this.MAX_USER_QUESTIONS_PER_TASK &&
           (this.lastUserQuestionTime === 0 || timeSinceLastQuestion >= this.USER_QUESTION_COOLDOWN_MS);
  }

  private getQuestionForUser(): string {
    const recentFailures = this.memory.failedAttempts.slice(-3);
    if (recentFailures.length > 0) {
      return `I'm having trouble with ${recentFailures[0].tool}. Should I try a different approach, or can you provide more guidance?`;
    }

    return 'I\'m not making progress. Could you clarify the task or suggest a different approach?';
  }

  private shouldDelegate(currentPhase: string, plan: StrategicPlan): boolean {
    const phase = plan.phases.find(p => p.id === currentPhase);
    if (!phase || !phase.canDelegate) return false;

    // Delegate if the phase is complex and we haven't tried yet
    const existingDelegation = this.memory.delegations.find(d => d.subtask === phase.id);
    if (existingDelegation) return false;  // Already tried

    return phase.estimatedIterations > 5;
  }

  private getDelegationTarget(currentPhase: string, plan: StrategicPlan): string {
    const phase = plan.phases.find(p => p.id === currentPhase);
    return phase?.description || currentPhase;
  }

  private calculateConfidence(plan: StrategicPlan): number {
    let confidence = plan.approach.confidence;

    // Reduce confidence based on failures
    confidence -= this.memory.failedAttempts.length * 0.05;

    // Reduce based on pivots
    confidence -= this.memory.pivots.length * 0.1;

    // Increase based on completed phases
    confidence += this.memory.completedPhases.length * 0.05;

    // Increase based on discoveries
    confidence += Math.min(this.memory.discoveredFacts.length * 0.02, 0.1);

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get memory for logging/debugging
   */
  getMemory(): ExecutionMemory {
    return { ...this.memory };
  }

  /**
   * Record a strategy pivot
   */
  recordPivot(fromStrategy: string, toStrategy: string, reason: string): void {
    this.memory.pivots.push({
      fromStrategy,
      toStrategy,
      reason,
      timestamp: Date.now()
    });
    logger.info(`🔄 Strategy pivot: ${fromStrategy} → ${toStrategy} (${reason})`);
  }

  /**
   * Get execution summary
   */
  getSummary(): string {
    return [
      `📊 Execution Summary:`,
      `   Tool calls: ${this.memory.toolCallHistory.length}`,
      `   Discoveries: ${this.memory.discoveredFacts.length}`,
      `   Phases completed: ${this.memory.completedPhases.length}`,
      `   Failed attempts: ${this.memory.failedAttempts.length}`,
      `   Strategy pivots: ${this.memory.pivots.length}`,
      `   Delegations: ${this.memory.delegations.length}`,
      `   User questions asked: ${this.userQuestionsAsked}/${this.MAX_USER_QUESTIONS_PER_TASK}`
    ].join('\n');
  }

  /**
   * Get state for checkpointing
   */
  getStateForCheckpoint(): {
    toolCallHistory: any[];
    failedAttempts: any[];
    pivots: any[];
    completedPhases: string[];
    discoveries: string[];
    userQuestionsAsked: number;
    currentIteration: number;
  } {
    return {
      toolCallHistory: this.memory.toolCallHistory.slice(-20),  // Keep last 20
      failedAttempts: this.memory.failedAttempts,
      pivots: this.memory.pivots,
      completedPhases: this.memory.completedPhases,
      discoveries: this.memory.discoveredFacts,
      userQuestionsAsked: this.userQuestionsAsked,
      currentIteration: this.currentIteration
    };
  }

  /**
   * Restore state from checkpoint (for task resume)
   */
  restoreFromCheckpoint(state: {
    toolCallHistory?: any[];
    failedAttempts?: any[];
    pivots?: any[];
    completedPhases?: string[];
    discoveries?: string[];
    userQuestionsAsked?: number;
    currentIteration?: number;
  }): void {
    if (state.toolCallHistory) {
      this.memory.toolCallHistory = state.toolCallHistory;
    }
    if (state.failedAttempts) {
      this.memory.failedAttempts = state.failedAttempts;
    }
    if (state.pivots) {
      this.memory.pivots = state.pivots;
    }
    if (state.completedPhases) {
      this.memory.completedPhases = state.completedPhases;
    }
    if (state.discoveries) {
      this.memory.discoveredFacts = state.discoveries;
    }
    if (state.userQuestionsAsked !== undefined) {
      this.userQuestionsAsked = state.userQuestionsAsked;
    }
    if (state.currentIteration !== undefined) {
      this.currentIteration = state.currentIteration;
    }

    // Rebuild progress window from tool call history
    this.progressWindow = this.memory.toolCallHistory.slice(-10).map(tc =>
      tc.success && tc.insightsGained?.length > 0 ? 1 : 0
    );

    logger.info(`🔄 SelfMonitor state restored: iteration ${this.currentIteration}, ${this.memory.toolCallHistory.length} tool calls`);
  }

  /**
   * Reset the monitor for a new task
   */
  reset(): void {
    this.memory = {
      toolCallHistory: [],
      discoveredFacts: [],
      completedPhases: [],
      failedAttempts: [],
      pivots: [],
      delegations: []
    };
    this.progressWindow = [];
    this.lastUserQuestionTime = 0;
    this.userQuestionsAsked = 0;
    this.currentIteration = 0;
  }
}

// ============================================================================
// COGNITIVE AGENT - The Unified System
// ============================================================================

export class CognitiveAgent {
  private client: Anthropic;
  private planner: StrategicPlanner;
  private monitor: SelfMonitor;
  private state: CognitiveState | null = null;
  private notificationHandler?: (message: string) => Promise<void>;

  // Configuration
  private config = {
    maxIterations: 100,
    softCap: 50,
    progressCheckInterval: 5,
    delegationEnabled: true,
    autoRetryOnFailure: true,
    maxRetries: 2
  };

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.planner = new StrategicPlanner(apiKey);
    this.monitor = new SelfMonitor();
  }

  /**
   * Set notification handler for user communication
   */
  setNotificationHandler(handler: (message: string) => Promise<void>): void {
    this.notificationHandler = handler;
  }

  /**
   * Execute a task with full cognitive capabilities
   */
  async execute(task: string, options?: {
    workingDir?: string;
    hasTrello?: boolean;
    userId?: string;
    channelId?: string;
    guildId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    iterations: number;
    toolCalls: number;
    phases: number;
    discoveries: string[];
  }> {
    logger.info(`\n${'═'.repeat(60)}`);
    logger.info(`🧠 COGNITIVE AGENT STARTING`);
    logger.info(`${'═'.repeat(60)}`);
    logger.info(`Task: ${task}`);

    try {
      // Phase 1: Gather Context
      await this.notify(`🔍 **Phase 1: Gathering Context**\nAnalyzing environment...`);
      const context = await ContextEngine.gatherContext(options?.workingDir);

      // Phase 2: Build Tool Inventory
      const tools = this.buildToolInventory(options?.hasTrello ?? false);

      // Phase 3: Create Strategic Plan
      await this.notify(`🧠 **Phase 2: Strategic Planning**\nDetermining best approach...`);
      const plan = await this.planner.createStrategicPlan(task, context, tools);

      // Initialize state
      this.state = {
        context,
        tools,
        plan,
        memory: this.monitor.getMemory(),
        currentPhase: plan.phases[0]?.id || '',
        iteration: 0,
        selfAssessment: {
          isProgressing: true,
          progressRate: 1,
          isStuck: false,
          shouldPivot: false,
          shouldAskUser: false,
          shouldDelegate: false,
          confidenceInApproach: plan.approach.confidence
        }
      };

      // Notify plan
      await this.notify(
        `📋 **Strategic Plan Created**\n` +
        `**Approach:** ${plan.approach.approach}\n` +
        `**Confidence:** ${(plan.approach.confidence * 100).toFixed(0)}%\n` +
        `**Phases:** ${plan.phases.length}\n` +
        `**Complexity:** ${plan.estimatedComplexity}\n` +
        `**Primary Tools:** ${plan.toolStrategy.primary.join(', ')}\n` +
        (plan.riskAssessment.level !== 'low' ? `\n⚠️ **Risk:** ${plan.riskAssessment.level}\n${plan.riskAssessment.concerns.join(', ')}` : '')
      );

      // Phase 4: Execute Plan
      const result = await this.executePlan(task, plan, context, tools);

      // Final summary
      logger.info(this.monitor.getSummary());

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`🚨 Cognitive Agent failed: ${errorMessage}`);

      await this.notify(`❌ **Agent Failed**\n${errorMessage}`);

      return {
        success: false,
        message: errorMessage,
        iterations: this.state?.iteration || 0,
        toolCalls: this.monitor.getMemory().toolCallHistory.length,
        phases: this.monitor.getMemory().completedPhases.length,
        discoveries: this.monitor.getMemory().discoveredFacts
      };
    }
  }

  private buildToolInventory(hasTrello: boolean): ToolInventory {
    const available = COGNITIVE_TOOL_REGISTRY.filter(tool => {
      if (tool.name.startsWith('trello_') && !hasTrello) return false;
      return true;
    });

    const configured = available.map(t => t.name);
    const recommended: string[] = [];  // Will be set based on task

    return { available, configured, recommended };
  }

  private async executePlan(
    task: string,
    plan: StrategicPlan,
    context: EnvironmentContext,
    tools: ToolInventory
  ): Promise<{
    success: boolean;
    message: string;
    iterations: number;
    toolCalls: number;
    phases: number;
    discoveries: string[];
  }> {
    const conversationHistory: Anthropic.MessageParam[] = [];
    let iteration = 0;

    // Build enhanced system prompt
    const systemPrompt = this.buildCognitivePrompt(task, plan, context, tools);
    conversationHistory.push({ role: 'user', content: systemPrompt });

    // Execute phases
    for (const phase of plan.phases) {
      this.state!.currentPhase = phase.id;

      await this.notify(
        `🔄 **Phase: ${phase.name}**\n` +
        `${phase.description}\n` +
        `Tools: ${phase.tools.join(', ') || 'reasoning only'}`
      );

      // Execute phase with iterations
      let phaseComplete = false;
      let phaseIterations = 0;
      const maxPhaseIterations = phase.estimatedIterations * 2;

      while (!phaseComplete && phaseIterations < maxPhaseIterations && iteration < this.config.maxIterations) {
        iteration++;
        phaseIterations++;
        this.state!.iteration = iteration;

        // Self-assessment check - LOG ONLY, no Discord spam
        if (iteration % this.config.progressCheckInterval === 0) {
          const assessment = this.monitor.assess(phase.id, plan);
          this.state!.selfAssessment = assessment;

          if (assessment.isStuck) {
            logger.warn(`⚠️ Stuck detected: ${assessment.stuckReason}`);
            // Log pivots but don't spam Discord
            if (assessment.shouldPivot && assessment.pivotSuggestion) {
              logger.info(`🔄 Pivoting strategy: ${assessment.pivotSuggestion}`);
              this.monitor.recordPivot(plan.approach.approach, 'alternative', assessment.pivotSuggestion);
            }
            // Only ask user if TRULY stuck (10+ iterations)
            if (assessment.shouldAskUser && iteration > 10) {
              await this.notify(`❓ **Need Input**\n${assessment.questionForUser}`);
            }
          }

          // Log delegation opportunities (no notification)
          if (assessment.shouldDelegate && this.config.delegationEnabled) {
            logger.info(`🤖 Delegation opportunity detected`);
          }
        }

        // Execute iteration
        const response = await this.executeIteration(conversationHistory, phase, plan);

        // Check for phase completion
        if (response.phaseComplete) {
          phaseComplete = true;
          this.monitor.completePhase(phase.id);
        }

        // Check for task completion
        if (response.taskComplete) {
          return {
            success: true,
            message: response.finalMessage || 'Task completed successfully',
            iterations: iteration,
            toolCalls: this.monitor.getMemory().toolCallHistory.length,
            phases: this.monitor.getMemory().completedPhases.length,
            discoveries: this.monitor.getMemory().discoveredFacts
          };
        }
      }

      if (!phaseComplete) {
        logger.warn(`⚠️ Phase ${phase.id} did not complete within iteration limit`);
      }
    }

    return {
      success: true,
      message: 'All phases completed',
      iterations: iteration,
      toolCalls: this.monitor.getMemory().toolCallHistory.length,
      phases: this.monitor.getMemory().completedPhases.length,
      discoveries: this.monitor.getMemory().discoveredFacts
    };
  }

  private async executeIteration(
    history: Anthropic.MessageParam[],
    phase: ExecutionPhase,
    plan: StrategicPlan
  ): Promise<{
    phaseComplete: boolean;
    taskComplete: boolean;
    finalMessage?: string;
  }> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: history
    });

    // Add response to history
    history.push({ role: 'assistant', content: response.content });

    // Extract text content
    const textContent = response.content
      .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Check for completion signals
    const phaseComplete = /phase complete|moving to next|completed this phase/i.test(textContent);
    const taskComplete = response.stop_reason === 'end_turn' &&
      /task complete|all done|finished|completed successfully/i.test(textContent);

    return {
      phaseComplete,
      taskComplete,
      finalMessage: taskComplete ? textContent : undefined
    };
  }

  private buildCognitivePrompt(
    task: string,
    plan: StrategicPlan,
    context: EnvironmentContext,
    tools: ToolInventory
  ): string {
    return `# COGNITIVE AGENT SYSTEM PROMPT

## YOUR IDENTITY
You are a Cognitive Agent - a self-aware, strategic AI that thinks deeply about problems before acting.
You don't just execute tasks; you UNDERSTAND them, PLAN intelligently, and ADAPT dynamically.

## CURRENT CONTEXT
- **Working Directory:** ${context.workingDirectory}
- **Project Type:** ${context.projectType}
- **Git Status:** ${context.hasGit ? `${context.gitBranch} (${context.gitStatus})` : 'No git'}
- **Key Files:** ${context.keyFiles.slice(0, 5).join(', ')}

## YOUR STRATEGIC PLAN
${plan.taskUnderstanding}

**Approach:** ${plan.approach.approach} (${(plan.approach.confidence * 100).toFixed(0)}% confidence)
**Reasoning:** ${plan.approach.reasoning}
${plan.approach.fallbackStrategy ? `**Fallback:** ${plan.approach.fallbackStrategy}` : ''}

## EXECUTION PHASES
${plan.phases.map((p, i) => `${i + 1}. **${p.name}**
   - ${p.description}
   - Tools: ${p.tools.join(', ') || 'None (reasoning only)'}
   - Completion: ${p.completionCriteria}`).join('\n')}

## TOOL STRATEGY
**Primary Tools:** ${plan.toolStrategy.primary.join(', ')}
**Avoid Using:** ${plan.toolStrategy.avoidUsing.join(', ') || 'None'}

## YOUR TASK
${task}

## INSTRUCTIONS
1. Follow your strategic plan phase by phase
2. Use tools strategically, not reactively
3. Record discoveries and insights as you go
4. If stuck, consider pivoting strategy
5. When a phase is complete, explicitly say "Phase complete"
6. When the entire task is done, summarize your findings

## SUCCESS CRITERIA
${plan.successCriteria.map(c => `- ${c}`).join('\n')}

Begin execution. Start with Phase 1: ${plan.phases[0]?.name || 'Execute'}.`;
  }

  private async notify(message: string): Promise<void> {
    if (this.notificationHandler) {
      await this.notificationHandler(message);
    }
    logger.info(message.replace(/\*\*/g, '').replace(/\n/g, ' | '));
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createCognitiveAgent(apiKey: string): CognitiveAgent {
  return new CognitiveAgent(apiKey);
}
