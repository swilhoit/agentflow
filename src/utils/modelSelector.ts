import { logger } from './logger';

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      INTELLIGENT MODEL SELECTOR                            ║
 * ║                                                                            ║
 * ║  Dynamically selects the optimal AI model based on:                       ║
 * ║  • Task complexity                                                         ║
 * ║  • Execution phase                                                         ║
 * ║  • Cost/speed requirements                                                 ║
 * ║  • Model performance history                                               ║
 * ║                                                                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

export type ModelTier = 'fast' | 'balanced' | 'powerful';

export interface ModelConfig {
  id: string;
  name: string;
  tier: ModelTier;
  maxTokens: number;
  contextWindow: number;
  costPer1kInput: number;   // USD per 1k input tokens
  costPer1kOutput: number;  // USD per 1k output tokens
  avgLatencyMs: number;     // Average response latency
  strengths: string[];
  weaknesses: string[];
  bestFor: string[];
}

/**
 * Available Anthropic Models (as of late 2024/2025)
 */
export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  // FAST TIER - Haiku
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    tier: 'fast',
    maxTokens: 8192,
    contextWindow: 200000,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.005,
    avgLatencyMs: 500,
    strengths: [
      'Very fast responses',
      'Low cost',
      'Good for simple tasks',
      'Efficient for high-volume operations'
    ],
    weaknesses: [
      'Less capable at complex reasoning',
      'May miss nuances',
      'Not ideal for creative tasks'
    ],
    bestFor: [
      'Simple queries',
      'Status checks',
      'List operations',
      'Basic CRUD',
      'Format conversions',
      'Simple classifications'
    ]
  },

  // BALANCED TIER - Sonnet
  'claude-sonnet-4-5-20250929': {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    tier: 'balanced',
    maxTokens: 8192,
    contextWindow: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    avgLatencyMs: 1500,
    strengths: [
      'Good balance of speed and capability',
      'Strong coding abilities',
      'Reliable for most tasks',
      'Good at following instructions'
    ],
    weaknesses: [
      'Not as deep in reasoning as Opus',
      'May struggle with highly abstract tasks'
    ],
    bestFor: [
      'Code generation',
      'Moderate analysis',
      'Multi-step tasks',
      'API integrations',
      'Documentation',
      'Debugging'
    ]
  },

  // POWERFUL TIER - Opus
  'claude-opus-4-5-20251101': {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    tier: 'powerful',
    maxTokens: 8192,
    contextWindow: 200000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    avgLatencyMs: 3000,
    strengths: [
      'Superior reasoning',
      'Best at complex analysis',
      'Excellent at nuanced tasks',
      'Deep understanding',
      'Best code quality',
      'Strategic thinking'
    ],
    weaknesses: [
      'Higher cost',
      'Slower responses',
      'Overkill for simple tasks'
    ],
    bestFor: [
      'Complex analysis',
      'Architecture decisions',
      'Strategic planning',
      'Difficult debugging',
      'Code review',
      'Refactoring recommendations',
      'Security analysis'
    ]
  }
};

// Aliases for convenience
export const MODELS = {
  HAIKU: 'claude-3-5-haiku-20241022',
  SONNET: 'claude-sonnet-4-5-20250929',
  OPUS: 'claude-opus-4-5-20251101'
} as const;

// ============================================================================
// TASK COMPLEXITY ANALYSIS
// ============================================================================

export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert';

export interface ComplexityAnalysis {
  complexity: TaskComplexity;
  score: number;  // 0-100
  factors: ComplexityFactor[];
  recommendedTier: ModelTier;
  reasoning: string;
}

export interface ComplexityFactor {
  name: string;
  weight: number;
  score: number;
  explanation: string;
}

/**
 * Analyze task complexity to determine optimal model
 */
export function analyzeTaskComplexity(task: string, context?: {
  phase?: string;
  previousFailures?: number;
  toolsRequired?: string[];
}): ComplexityAnalysis {
  const lower = task.toLowerCase();
  const factors: ComplexityFactor[] = [];

  // Factor 1: Task length and detail
  const lengthScore = Math.min(task.length / 10, 30);
  factors.push({
    name: 'Task Detail',
    weight: 0.15,
    score: lengthScore,
    explanation: `Task length: ${task.length} chars`
  });

  // Factor 2: Action complexity
  const complexActions = ['analyze', 'review', 'audit', 'architect', 'design', 'refactor', 'optimize', 'investigate', 'debug complex', 'security'];
  const moderateActions = ['implement', 'create', 'build', 'develop', 'integrate', 'migrate', 'deploy'];
  const simpleActions = ['list', 'get', 'show', 'check', 'status', 'fetch', 'display', 'find'];

  let actionScore = 50;  // Default moderate
  if (complexActions.some(a => lower.includes(a))) {
    actionScore = 85;
  } else if (moderateActions.some(a => lower.includes(a))) {
    actionScore = 55;
  } else if (simpleActions.some(a => lower.includes(a))) {
    actionScore = 20;
  }

  factors.push({
    name: 'Action Complexity',
    weight: 0.25,
    score: actionScore,
    explanation: `Primary action type score: ${actionScore}`
  });

  // Factor 3: Scope indicators
  const broadScope = ['all', 'every', 'entire', 'whole', 'complete', 'comprehensive', 'full'];
  const narrowScope = ['this', 'single', 'one', 'specific'];

  let scopeScore = 40;
  if (broadScope.some(s => lower.includes(s))) {
    scopeScore = 75;
  } else if (narrowScope.some(s => lower.includes(s))) {
    scopeScore = 25;
  }

  factors.push({
    name: 'Scope',
    weight: 0.15,
    score: scopeScore,
    explanation: `Scope breadth: ${scopeScore > 50 ? 'broad' : 'narrow'}`
  });

  // Factor 4: Domain complexity
  const complexDomains = ['architecture', 'security', 'performance', 'scalability', 'concurrency', 'distributed'];
  const moderateDomains = ['api', 'database', 'auth', 'integration', 'deployment'];
  const simpleDomains = ['file', 'config', 'env', 'log', 'status'];

  let domainScore = 40;
  if (complexDomains.some(d => lower.includes(d))) {
    domainScore = 80;
  } else if (moderateDomains.some(d => lower.includes(d))) {
    domainScore = 50;
  } else if (simpleDomains.some(d => lower.includes(d))) {
    domainScore = 20;
  }

  factors.push({
    name: 'Domain',
    weight: 0.2,
    score: domainScore,
    explanation: `Domain complexity: ${domainScore}`
  });

  // Factor 5: Multi-step indicators
  const multiStepIndicators = [' and ', ' then ', ' after ', 'step', 'phase', 'first', 'next', 'finally'];
  const multiStepCount = multiStepIndicators.filter(i => lower.includes(i)).length;
  const multiStepScore = Math.min(multiStepCount * 15, 60);

  factors.push({
    name: 'Multi-step',
    weight: 0.15,
    score: multiStepScore,
    explanation: `Multi-step indicators: ${multiStepCount}`
  });

  // Factor 6: Context adjustments
  let contextScore = 0;
  if (context?.previousFailures) {
    contextScore += context.previousFailures * 20;  // Escalate on failures
  }
  if (context?.phase === 'exploration') {
    contextScore += 10;  // Exploration benefits from stronger models
  }
  if (context?.toolsRequired?.includes('spawn_claude_agent')) {
    contextScore += 15;  // Delegation tasks are complex
  }

  factors.push({
    name: 'Context',
    weight: 0.1,
    score: Math.min(contextScore, 50),
    explanation: `Context adjustments: +${contextScore}`
  });

  // Calculate weighted total
  const totalScore = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);

  // Determine complexity level
  let complexity: TaskComplexity;
  let recommendedTier: ModelTier;

  if (totalScore < 25) {
    complexity = 'trivial';
    recommendedTier = 'fast';
  } else if (totalScore < 40) {
    complexity = 'simple';
    recommendedTier = 'fast';
  } else if (totalScore < 60) {
    complexity = 'moderate';
    recommendedTier = 'balanced';
  } else if (totalScore < 80) {
    complexity = 'complex';
    recommendedTier = 'powerful';
  } else {
    complexity = 'expert';
    recommendedTier = 'powerful';
  }

  return {
    complexity,
    score: Math.round(totalScore),
    factors,
    recommendedTier,
    reasoning: buildComplexityReasoning(complexity, factors, totalScore)
  };
}

function buildComplexityReasoning(complexity: TaskComplexity, factors: ComplexityFactor[], score: number): string {
  const topFactors = factors
    .sort((a, b) => (b.score * b.weight) - (a.score * a.weight))
    .slice(0, 2)
    .map(f => f.name.toLowerCase());

  return `${complexity} complexity (score: ${Math.round(score)}) - primarily due to ${topFactors.join(' and ')}`;
}

// ============================================================================
// MODEL SELECTOR
// ============================================================================

export interface ModelSelection {
  model: ModelConfig;
  reason: string;
  alternatives: ModelConfig[];
  estimatedCost: string;
  canEscalate: boolean;
  escalateTo?: string;
}

export interface ModelSelectorConfig {
  preferSpeed: boolean;
  preferCost: boolean;
  preferQuality: boolean;
  allowEscalation: boolean;
  maxTier: ModelTier;
  minTier: ModelTier;
}

const DEFAULT_CONFIG: ModelSelectorConfig = {
  preferSpeed: false,
  preferCost: false,
  preferQuality: true,
  allowEscalation: true,
  maxTier: 'powerful',
  minTier: 'fast'
};

export class ModelSelector {
  private config: ModelSelectorConfig;
  private performanceHistory: Map<string, ModelPerformance> = new Map();

  constructor(config: Partial<ModelSelectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Select the optimal model for a task
   */
  selectModel(
    task: string,
    context?: {
      phase?: string;
      previousFailures?: number;
      toolsRequired?: string[];
      forceModel?: string;
    }
  ): ModelSelection {
    // Allow forcing a specific model
    if (context?.forceModel && AVAILABLE_MODELS[context.forceModel]) {
      const model = AVAILABLE_MODELS[context.forceModel];
      return {
        model,
        reason: 'Model forced by configuration',
        alternatives: [],
        estimatedCost: 'N/A',
        canEscalate: false
      };
    }

    // Analyze task complexity
    const complexity = analyzeTaskComplexity(task, context);
    logger.info(`📊 Complexity analysis: ${complexity.complexity} (score: ${complexity.score})`);

    // Get recommended tier
    let targetTier = complexity.recommendedTier;

    // Apply config constraints
    targetTier = this.applyTierConstraints(targetTier);

    // Apply preferences
    if (this.config.preferSpeed && targetTier !== 'fast') {
      // Try to use a faster model if possible
      if (complexity.complexity !== 'expert' && complexity.complexity !== 'complex') {
        targetTier = this.lowerTier(targetTier);
      }
    }

    if (this.config.preferQuality) {
      // Ensure we don't under-provision for complex tasks
      if (complexity.complexity === 'complex' || complexity.complexity === 'expert') {
        targetTier = 'powerful';
      }
    }

    // Escalate on previous failures
    if (context?.previousFailures && context.previousFailures > 0) {
      targetTier = this.escalateTier(targetTier, context.previousFailures);
      logger.info(`⬆️ Escalating model due to ${context.previousFailures} previous failure(s)`);
    }

    // Select model for tier
    const model = this.getModelForTier(targetTier);
    const alternatives = this.getAlternatives(model, complexity.recommendedTier);

    // Determine if escalation is possible
    const canEscalate = this.config.allowEscalation && targetTier !== 'powerful';
    const escalateTo = canEscalate ? this.getModelForTier(this.escalateTier(targetTier, 1)).id : undefined;

    return {
      model,
      reason: this.buildSelectionReason(complexity, targetTier, context),
      alternatives,
      estimatedCost: this.estimateCost(model, task.length),
      canEscalate,
      escalateTo
    };
  }

  /**
   * Select model specifically for a phase type
   */
  selectModelForPhase(
    phaseType: 'exploration' | 'planning' | 'execution' | 'verification' | 'reporting',
    taskComplexity: TaskComplexity
  ): ModelConfig {
    // Phase-specific recommendations
    const phaseRecommendations: Record<string, ModelTier> = {
      'exploration': taskComplexity === 'expert' ? 'powerful' : 'balanced',
      'planning': 'powerful',  // Planning benefits from strong reasoning
      'execution': taskComplexity === 'trivial' ? 'fast' : 'balanced',
      'verification': 'balanced',
      'reporting': 'fast'  // Reporting is usually simple
    };

    const tier = phaseRecommendations[phaseType] || 'balanced';
    return this.getModelForTier(this.applyTierConstraints(tier));
  }

  /**
   * Record model performance for future optimization
   */
  recordPerformance(modelId: string, success: boolean, latencyMs: number, taskComplexity: TaskComplexity): void {
    const key = `${modelId}:${taskComplexity}`;
    const existing = this.performanceHistory.get(key) || {
      successes: 0,
      failures: 0,
      totalLatency: 0,
      count: 0
    };

    existing.count++;
    existing.totalLatency += latencyMs;
    if (success) {
      existing.successes++;
    } else {
      existing.failures++;
    }

    this.performanceHistory.set(key, existing);
  }

  /**
   * Get performance stats for a model
   */
  getPerformanceStats(modelId: string): { successRate: number; avgLatency: number } | null {
    let totalSuccesses = 0;
    let totalFailures = 0;
    let totalLatency = 0;
    let count = 0;

    for (const [key, perf] of this.performanceHistory) {
      if (key.startsWith(modelId)) {
        totalSuccesses += perf.successes;
        totalFailures += perf.failures;
        totalLatency += perf.totalLatency;
        count += perf.count;
      }
    }

    if (count === 0) return null;

    return {
      successRate: totalSuccesses / (totalSuccesses + totalFailures),
      avgLatency: totalLatency / count
    };
  }

  // Helper methods

  private applyTierConstraints(tier: ModelTier): ModelTier {
    const tierOrder: ModelTier[] = ['fast', 'balanced', 'powerful'];
    const minIndex = tierOrder.indexOf(this.config.minTier);
    const maxIndex = tierOrder.indexOf(this.config.maxTier);
    const currentIndex = tierOrder.indexOf(tier);

    if (currentIndex < minIndex) return this.config.minTier;
    if (currentIndex > maxIndex) return this.config.maxTier;
    return tier;
  }

  private lowerTier(tier: ModelTier): ModelTier {
    if (tier === 'powerful') return 'balanced';
    if (tier === 'balanced') return 'fast';
    return 'fast';
  }

  private escalateTier(tier: ModelTier, failures: number): ModelTier {
    if (failures >= 2 || tier === 'fast') {
      if (tier === 'fast') return 'balanced';
      return 'powerful';
    }
    if (failures >= 1 && tier === 'balanced') {
      return 'powerful';
    }
    return tier;
  }

  private getModelForTier(tier: ModelTier): ModelConfig {
    switch (tier) {
      case 'fast':
        return AVAILABLE_MODELS[MODELS.HAIKU];
      case 'balanced':
        return AVAILABLE_MODELS[MODELS.SONNET];
      case 'powerful':
        return AVAILABLE_MODELS[MODELS.OPUS];
      default:
        return AVAILABLE_MODELS[MODELS.SONNET];
    }
  }

  private getAlternatives(selected: ModelConfig, recommendedTier: ModelTier): ModelConfig[] {
    return Object.values(AVAILABLE_MODELS)
      .filter(m => m.id !== selected.id)
      .sort((a, b) => {
        // Sort by closeness to recommended tier
        const tierOrder: ModelTier[] = ['fast', 'balanced', 'powerful'];
        const recIndex = tierOrder.indexOf(recommendedTier);
        const aDistance = Math.abs(tierOrder.indexOf(a.tier) - recIndex);
        const bDistance = Math.abs(tierOrder.indexOf(b.tier) - recIndex);
        return aDistance - bDistance;
      });
  }

  private buildSelectionReason(
    complexity: ComplexityAnalysis,
    selectedTier: ModelTier,
    context?: { previousFailures?: number }
  ): string {
    const parts: string[] = [];

    parts.push(`Task complexity: ${complexity.complexity}`);

    if (selectedTier !== complexity.recommendedTier) {
      if (context?.previousFailures) {
        parts.push(`escalated due to ${context.previousFailures} failure(s)`);
      } else if (this.config.preferSpeed) {
        parts.push('optimized for speed');
      } else if (this.config.preferCost) {
        parts.push('optimized for cost');
      }
    }

    return parts.join(', ');
  }

  private estimateCost(model: ModelConfig, inputLength: number): string {
    // Rough estimate: input tokens ≈ chars / 4, output ≈ 2x input for tasks
    const inputTokens = inputLength / 4;
    const outputTokens = inputTokens * 2;

    const cost = (inputTokens / 1000 * model.costPer1kInput) +
                 (outputTokens / 1000 * model.costPer1kOutput);

    if (cost < 0.001) return '<$0.001';
    if (cost < 0.01) return `~$${cost.toFixed(4)}`;
    return `~$${cost.toFixed(3)}`;
  }
}

interface ModelPerformance {
  successes: number;
  failures: number;
  totalLatency: number;
  count: number;
}

// ============================================================================
// SMART MODEL ROUTER
// ============================================================================

/**
 * SmartModelRouter - Automatically routes requests to optimal models
 */
export class SmartModelRouter {
  private selector: ModelSelector;
  private currentModel: ModelConfig;
  private failureCount = 0;
  private taskStartTime = 0;

  constructor(config?: Partial<ModelSelectorConfig>) {
    this.selector = new ModelSelector(config);
    this.currentModel = AVAILABLE_MODELS[MODELS.SONNET];  // Default
  }

  /**
   * Get the model to use for a new task
   */
  getModelForTask(task: string, context?: {
    phase?: string;
    toolsRequired?: string[];
  }): ModelConfig {
    this.failureCount = 0;
    this.taskStartTime = Date.now();

    const selection = this.selector.selectModel(task, {
      ...context,
      previousFailures: 0
    });

    this.currentModel = selection.model;

    logger.info(`🤖 Model selected: ${selection.model.name}`);
    logger.info(`   Reason: ${selection.reason}`);
    logger.info(`   Estimated cost: ${selection.estimatedCost}`);
    if (selection.canEscalate) {
      logger.info(`   Can escalate to: ${selection.escalateTo}`);
    }

    return selection.model;
  }

  /**
   * Get model for a specific phase within a task
   */
  getModelForPhase(
    phaseType: 'exploration' | 'planning' | 'execution' | 'verification' | 'reporting',
    taskComplexity: TaskComplexity
  ): ModelConfig {
    const model = this.selector.selectModelForPhase(phaseType, taskComplexity);

    if (model.id !== this.currentModel.id) {
      logger.info(`🔄 Switching to ${model.name} for ${phaseType} phase`);
      this.currentModel = model;
    }

    return model;
  }

  /**
   * Report a failure and potentially escalate
   */
  reportFailure(): ModelConfig | null {
    this.failureCount++;

    const selection = this.selector.selectModel('', {
      previousFailures: this.failureCount
    });

    if (selection.model.id !== this.currentModel.id) {
      logger.info(`⬆️ Escalating from ${this.currentModel.name} to ${selection.model.name}`);
      this.currentModel = selection.model;
      return selection.model;
    }

    return null;  // Already at max tier
  }

  /**
   * Report success and record performance
   */
  reportSuccess(taskComplexity: TaskComplexity): void {
    const latency = Date.now() - this.taskStartTime;
    this.selector.recordPerformance(this.currentModel.id, true, latency, taskComplexity);
  }

  /**
   * Get current model
   */
  getCurrentModel(): ModelConfig {
    return this.currentModel;
  }

  /**
   * Get the number of escalations that occurred
   */
  getEscalationCount(): number {
    return this.failureCount;
  }

  /**
   * Get model stats summary
   */
  getStatsSummary(): string {
    const lines: string[] = ['📊 Model Performance Stats:'];

    for (const modelId of Object.keys(AVAILABLE_MODELS)) {
      const stats = this.selector.getPerformanceStats(modelId);
      if (stats) {
        const model = AVAILABLE_MODELS[modelId];
        lines.push(`   ${model.name}: ${(stats.successRate * 100).toFixed(1)}% success, ${stats.avgLatency.toFixed(0)}ms avg`);
      }
    }

    return lines.length > 1 ? lines.join('\n') : 'No performance data yet';
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Quick helper to get the right model for a task
 */
export function selectModelForTask(task: string): string {
  const selector = new ModelSelector();
  const selection = selector.selectModel(task);
  return selection.model.id;
}

/**
 * Create a configured model router
 */
export function createModelRouter(config?: Partial<ModelSelectorConfig>): SmartModelRouter {
  return new SmartModelRouter(config);
}
