import { logger } from './logger';

/**
 * Adaptive Executor - Smart execution engine that replaces static iteration limits
 *
 * KEY INSIGHT: Don't limit iterations - detect STALLS and COMPLETION
 *
 * A task that's making progress should continue.
 * A task that's spinning wheels should stop.
 */

export interface ToolCall {
  name: string;
  input: any;
  output: any;
  success: boolean;
  timestamp: number;
}

export interface ExecutionState {
  iterations: number;
  toolCalls: ToolCall[];
  progressMarkers: Set<string>;  // Unique things accomplished
  lastMeaningfulProgress: number;  // Iteration when we last made progress
  completionSignals: number;
  stallIndicators: number;
  planMilestones?: PlanMilestone[];
  currentPhase: 'exploring' | 'planning' | 'executing' | 'completing';
}

export interface PlanMilestone {
  id: string;
  description: string;
  completed: boolean;
  requiredFor?: string[];  // Dependencies
}

export interface ExecutionPlan {
  taskSummary: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'exploratory';
  milestones: PlanMilestone[];
  estimatedEffort: 'quick' | 'medium' | 'substantial';
  explorationNeeded: boolean;
}

export interface ContinuationDecision {
  shouldContinue: boolean;
  reason: string;
  suggestedAction?: 'continue' | 'pivot' | 'ask_user' | 'complete' | 'abort';
  warning?: string;
}

/**
 * Configuration for the adaptive executor
 */
export interface AdaptiveConfig {
  // Minimum iterations before we consider stopping (always give it a chance)
  minIterations: number;

  // Stop if no progress for this many iterations
  maxStallIterations: number;

  // Soft cap - notify user but continue
  softCap: number;

  // Hard cap - absolute maximum (safety valve)
  hardCap: number;

  // Enable verbose logging
  verbose: boolean;
}

const DEFAULT_CONFIG: AdaptiveConfig = {
  minIterations: 5,
  maxStallIterations: 5,
  softCap: 40,
  hardCap: 100,
  verbose: true
};

export class AdaptiveExecutor {
  private config: AdaptiveConfig;
  private state: ExecutionState;
  private recentToolSignatures: string[] = [];  // Track recent tool calls for stall detection

  constructor(config: Partial<AdaptiveConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  private createInitialState(): ExecutionState {
    return {
      iterations: 0,
      toolCalls: [],
      progressMarkers: new Set(),
      lastMeaningfulProgress: 0,
      completionSignals: 0,
      stallIndicators: 0,
      currentPhase: 'exploring'
    };
  }

  /**
   * Reset state for a new task
   */
  reset(): void {
    this.state = this.createInitialState();
    this.recentToolSignatures = [];
  }

  /**
   * Get current execution state
   */
  getState(): ExecutionState {
    return { ...this.state };
  }

  /**
   * Record a new iteration
   */
  recordIteration(): void {
    this.state.iterations++;
  }

  /**
   * Record a tool call and analyze for progress/stall
   */
  recordToolCall(name: string, input: any, output: any, success: boolean): void {
    const toolCall: ToolCall = {
      name,
      input,
      output,
      success,
      timestamp: Date.now()
    };

    this.state.toolCalls.push(toolCall);

    // Create signature for stall detection
    const signature = this.createToolSignature(name, input);
    this.recentToolSignatures.push(signature);

    // Keep only last 10 signatures
    if (this.recentToolSignatures.length > 10) {
      this.recentToolSignatures.shift();
    }

    // Check if this is meaningful progress
    if (this.isProgressfulToolCall(toolCall)) {
      this.markProgress(`tool:${name}:${this.state.toolCalls.length}`);
    }
  }

  /**
   * Check if a tool call represents meaningful progress
   */
  private isProgressfulToolCall(toolCall: ToolCall): boolean {
    // Failed calls aren't progress
    if (!toolCall.success) return false;

    // Reading new files is progress
    if (toolCall.name.includes('read') || toolCall.name.includes('file')) {
      return true;
    }

    // Successful API calls are progress
    if (toolCall.name.includes('api') || toolCall.name.includes('fetch')) {
      return true;
    }

    // Creating/modifying things is progress
    if (['create', 'update', 'delete', 'write', 'execute', 'run'].some(
      action => toolCall.name.toLowerCase().includes(action)
    )) {
      return true;
    }

    // Check if output contains new information
    const outputStr = JSON.stringify(toolCall.output);
    if (outputStr.length > 100) {
      return true;  // Got substantial output
    }

    return false;
  }

  /**
   * Create a signature for tool call deduplication
   */
  private createToolSignature(name: string, input: any): string {
    const inputKey = typeof input === 'object'
      ? JSON.stringify(input).substring(0, 200)
      : String(input);
    return `${name}:${inputKey}`;
  }

  /**
   * Mark that we made meaningful progress
   */
  markProgress(marker: string): void {
    if (!this.state.progressMarkers.has(marker)) {
      this.state.progressMarkers.add(marker);
      this.state.lastMeaningfulProgress = this.state.iterations;

      if (this.config.verbose) {
        logger.info(`📈 Progress marker: ${marker} (iteration ${this.state.iterations})`);
      }
    }
  }

  /**
   * Record a completion signal (agent saying "done", "complete", etc.)
   */
  recordCompletionSignal(): void {
    this.state.completionSignals++;
    if (this.config.verbose) {
      logger.info(`✅ Completion signal #${this.state.completionSignals}`);
    }
  }

  /**
   * Record a stall indicator (confusion, repetition, error)
   */
  recordStallIndicator(reason: string): void {
    this.state.stallIndicators++;
    if (this.config.verbose) {
      logger.warn(`⚠️ Stall indicator #${this.state.stallIndicators}: ${reason}`);
    }
  }

  /**
   * Set execution plan with milestones
   */
  setPlan(plan: ExecutionPlan): void {
    this.state.planMilestones = plan.milestones;
    this.state.currentPhase = 'executing';

    if (this.config.verbose) {
      logger.info(`📋 Plan set with ${plan.milestones.length} milestones`);
    }
  }

  /**
   * Mark a milestone as complete
   */
  completeMilestone(milestoneId: string): void {
    if (this.state.planMilestones) {
      const milestone = this.state.planMilestones.find(m => m.id === milestoneId);
      if (milestone) {
        milestone.completed = true;
        this.markProgress(`milestone:${milestoneId}`);

        if (this.config.verbose) {
          logger.info(`🎯 Milestone completed: ${milestone.description}`);
        }
      }
    }
  }

  /**
   * Detect if we're in a stall (repeating same actions)
   */
  detectStall(): boolean {
    if (this.recentToolSignatures.length < 3) return false;

    // Check for repeated identical calls
    const last3 = this.recentToolSignatures.slice(-3);
    if (last3[0] === last3[1] && last3[1] === last3[2]) {
      this.recordStallIndicator('Same tool called 3x consecutively');
      return true;
    }

    // Check for oscillation (A-B-A-B pattern)
    const last4 = this.recentToolSignatures.slice(-4);
    if (last4.length === 4 && last4[0] === last4[2] && last4[1] === last4[3]) {
      this.recordStallIndicator('Tool call oscillation detected');
      return true;
    }

    return false;
  }

  /**
   * Detect completion based on signals and state
   */
  detectCompletion(): boolean {
    // Multiple completion signals
    if (this.state.completionSignals >= 2) {
      return true;
    }

    // All milestones complete
    if (this.state.planMilestones && this.state.planMilestones.length > 0) {
      const allComplete = this.state.planMilestones.every(m => m.completed);
      if (allComplete) {
        return true;
      }
    }

    return false;
  }

  /**
   * THE MAIN DECISION: Should we continue executing?
   */
  shouldContinue(): ContinuationDecision {
    const { iterations, lastMeaningfulProgress, completionSignals, stallIndicators } = this.state;
    const iterationsSinceProgress = iterations - lastMeaningfulProgress;

    // 1. Always run minimum iterations
    if (iterations < this.config.minIterations) {
      return {
        shouldContinue: true,
        reason: `Still in warmup (${iterations}/${this.config.minIterations})`,
        suggestedAction: 'continue'
      };
    }

    // 2. Check for completion
    if (this.detectCompletion()) {
      return {
        shouldContinue: false,
        reason: `Task completed (${completionSignals} completion signals)`,
        suggestedAction: 'complete'
      };
    }

    // 3. Check for stall
    if (this.detectStall()) {
      return {
        shouldContinue: false,
        reason: 'Execution stalled (repeated tool calls)',
        suggestedAction: 'pivot',
        warning: 'Agent appears stuck in a loop'
      };
    }

    // 4. Check progress-based stall
    if (iterationsSinceProgress > this.config.maxStallIterations) {
      return {
        shouldContinue: false,
        reason: `No progress for ${iterationsSinceProgress} iterations`,
        suggestedAction: 'ask_user',
        warning: 'Task may need user guidance'
      };
    }

    // 5. Hard cap (safety valve)
    if (iterations >= this.config.hardCap) {
      return {
        shouldContinue: false,
        reason: `Hard cap reached (${this.config.hardCap} iterations)`,
        suggestedAction: 'abort',
        warning: 'Maximum iterations exceeded'
      };
    }

    // 6. Soft cap (warning but continue)
    if (iterations === this.config.softCap) {
      return {
        shouldContinue: true,
        reason: `Soft cap reached but still making progress`,
        suggestedAction: 'continue',
        warning: `Running long (${iterations} iterations) - will continue if making progress`
      };
    }

    // 7. All good - continue
    return {
      shouldContinue: true,
      reason: `Making progress (${this.state.progressMarkers.size} markers, last at iteration ${lastMeaningfulProgress})`,
      suggestedAction: 'continue'
    };
  }

  /**
   * Analyze task to determine if it needs exploration/planning
   */
  static analyzeTaskComplexity(taskDescription: string): {
    needsExploration: boolean;
    needsPlanning: boolean;
    suggestedConfig: Partial<AdaptiveConfig>;
    reasoning: string;
  } {
    const lower = taskDescription.toLowerCase();

    // Exploration indicators
    const explorationKeywords = [
      'analyze', 'review', 'audit', 'examine', 'explore',
      'understand', 'investigate', 'assess', 'evaluate',
      'what', 'how', 'why', 'improve', 'optimize', 'refactor',
      'codebase', 'repo', 'repository', 'project', 'architecture'
    ];

    // Planning indicators
    const planningKeywords = [
      'implement', 'build', 'create', 'develop', 'design',
      'multiple', 'several', 'all', 'each', 'every',
      'step', 'phase', 'then', 'after', 'finally',
      'feature', 'system', 'integration'
    ];

    // Simple task indicators
    const simpleKeywords = [
      'list', 'show', 'get', 'fetch', 'status', 'check',
      'delete', 'remove', 'stop', 'start', 'restart'
    ];

    const explorationScore = explorationKeywords.filter(k => lower.includes(k)).length;
    const planningScore = planningKeywords.filter(k => lower.includes(k)).length;
    const simpleScore = simpleKeywords.filter(k => lower.includes(k)).length;

    // Determine needs
    const needsExploration = explorationScore >= 2 || lower.includes('repo') || lower.includes('codebase');
    const needsPlanning = planningScore >= 2 && simpleScore < 2;

    // Suggest config based on analysis
    let suggestedConfig: Partial<AdaptiveConfig> = {};
    let reasoning = '';

    if (needsExploration && needsPlanning) {
      suggestedConfig = {
        minIterations: 10,
        maxStallIterations: 8,
        softCap: 60,
        hardCap: 150
      };
      reasoning = 'Complex exploratory task requiring extensive analysis and multi-step execution';
    } else if (needsExploration) {
      suggestedConfig = {
        minIterations: 8,
        maxStallIterations: 6,
        softCap: 50,
        hardCap: 100
      };
      reasoning = 'Exploratory task requiring codebase analysis';
    } else if (needsPlanning) {
      suggestedConfig = {
        minIterations: 6,
        maxStallIterations: 5,
        softCap: 40,
        hardCap: 80
      };
      reasoning = 'Multi-step task requiring planned execution';
    } else {
      suggestedConfig = {
        minIterations: 3,
        maxStallIterations: 4,
        softCap: 20,
        hardCap: 40
      };
      reasoning = 'Straightforward task with clear objective';
    }

    return {
      needsExploration,
      needsPlanning,
      suggestedConfig,
      reasoning
    };
  }

  /**
   * Generate execution summary
   */
  getSummary(): string {
    const { iterations, toolCalls, progressMarkers, completionSignals, stallIndicators } = this.state;
    const successfulTools = toolCalls.filter(t => t.success).length;

    return [
      `📊 Execution Summary:`,
      `   Iterations: ${iterations}`,
      `   Tool calls: ${toolCalls.length} (${successfulTools} successful)`,
      `   Progress markers: ${progressMarkers.size}`,
      `   Completion signals: ${completionSignals}`,
      `   Stall indicators: ${stallIndicators}`,
      `   Phase: ${this.state.currentPhase}`,
      this.state.planMilestones
        ? `   Milestones: ${this.state.planMilestones.filter(m => m.completed).length}/${this.state.planMilestones.length}`
        : ''
    ].filter(Boolean).join('\n');
  }
}

/**
 * Factory function to create an executor configured for a specific task
 */
export function createExecutorForTask(taskDescription: string): AdaptiveExecutor {
  const analysis = AdaptiveExecutor.analyzeTaskComplexity(taskDescription);

  logger.info(`🧠 Task Analysis: ${analysis.reasoning}`);
  logger.info(`   Needs exploration: ${analysis.needsExploration}`);
  logger.info(`   Needs planning: ${analysis.needsPlanning}`);

  return new AdaptiveExecutor(analysis.suggestedConfig);
}
