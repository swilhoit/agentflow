import { logger } from './logger';
import Anthropic from '@anthropic-ai/sdk';

export interface SubTask {
  id: string;
  description: string;
  estimatedIterations: number;
  dependencies: string[]; // IDs of tasks that must complete first
  priority: number; // 1-10, higher = more important
  type: 'sequential' | 'parallel';
}

export interface TaskAnalysis {
  complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  estimatedIterations: number;
  requiresDecomposition: boolean;
  subtasks: SubTask[];
  reasoning: string;
}

/**
 * TaskDecomposer - Automatically analyzes and breaks down complex tasks
 * 
 * This helps agents handle tasks that would exceed iteration limits by:
 * 1. Detecting task complexity
 * 2. Breaking into manageable subtasks
 * 3. Estimating resource requirements
 * 4. Creating execution plan with dependencies
 */
export class TaskDecomposer {
  private anthropicClient: Anthropic;

  constructor(apiKey: string) {
    this.anthropicClient = new Anthropic({ apiKey });
  }

  /**
   * Analyze a task and determine if it needs decomposition
   */
  async analyzeTask(taskDescription: string): Promise<TaskAnalysis> {
    logger.info(`🔍 Analyzing task complexity: ${taskDescription.substring(0, 100)}...`);

    // Quick heuristic check first
    const quickAnalysis = this.quickComplexityCheck(taskDescription);
    
    if (quickAnalysis.complexity === 'simple') {
      logger.info('✅ Task is simple, no decomposition needed');
      return quickAnalysis;
    }

    // For moderate to complex tasks, use Claude for detailed analysis
    logger.info('🤖 Using Claude for detailed task analysis...');
    
    try {
      const response = await this.anthropicClient.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: `You are a task analysis expert. Analyze tasks and break them down into optimal subtasks.
        
Your job:
1. Assess task complexity (simple/moderate/complex/very_complex)
2. Estimate iterations needed (1 iteration ≈ 1-3 operations)
3. Break complex tasks into subtasks
4. Identify dependencies between subtasks
5. Prioritize subtasks

COMPLEXITY LEVELS:
- simple: 1-5 iterations, single operation (e.g., "list my repos")
- moderate: 6-15 iterations, few steps (e.g., "create 3 Trello cards")
- complex: 16-40 iterations, many steps (e.g., "analyze 5 repos and create cards")
- very_complex: 40+ iterations, requires decomposition (e.g., "process all repos, create full project plan")

DECOMPOSITION RULES:
- Each subtask should be independently executable
- Each subtask should take ≤15 iterations
- Minimize dependencies for parallel execution
- Group related operations together

Respond in JSON format only:
{
  "complexity": "simple|moderate|complex|very_complex",
  "estimatedIterations": <number>,
  "requiresDecomposition": <boolean>,
  "reasoning": "<brief explanation>",
  "subtasks": [
    {
      "id": "subtask_1",
      "description": "<clear description>",
      "estimatedIterations": <number>,
      "dependencies": ["<other_subtask_ids>"],
      "priority": <1-10>,
      "type": "sequential|parallel"
    }
  ]
}`,
        messages: [
          {
            role: 'user',
            content: `Analyze this task and determine if it needs decomposition:\n\nTASK: ${taskDescription}\n\nProvide your analysis in JSON format.`
          }
        ]
      });

      const analysisText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';

      // Extract JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('Failed to parse Claude analysis, falling back to heuristic');
        return quickAnalysis;
      }

      const analysis: TaskAnalysis = JSON.parse(jsonMatch[0]);
      
      logger.info(`📊 Analysis complete: ${analysis.complexity} (${analysis.estimatedIterations} iterations, ${analysis.subtasks.length} subtasks)`);
      logger.info(`💡 Reasoning: ${analysis.reasoning}`);

      return analysis;

    } catch (error) {
      logger.error('Failed to analyze task with Claude, using heuristic', error);
      return quickAnalysis;
    }
  }

  /**
   * Quick heuristic-based complexity check (no API call)
   */
  private quickComplexityCheck(taskDescription: string): TaskAnalysis {
    const desc = taskDescription.toLowerCase();
    let estimatedIterations = 5;
    let complexity: TaskAnalysis['complexity'] = 'simple';
    let requiresDecomposition = false;
    const subtasks: SubTask[] = [];

    // Count complexity indicators
    const complexityFactors = {
      // Iteration multipliers
      multiple: (desc.match(/\d+/) ? parseInt(desc.match(/\d+/)![0]) : 1),
      actions: (desc.match(/and|then|create|analyze|fetch|update|delete/g) || []).length,
      repositories: desc.includes('repo') || desc.includes('github') ? 1 : 0,
      iteration: desc.includes('each') || desc.includes('all') || desc.includes('every') ? 2 : 1,
      api: (desc.match(/trello|github|gcloud|api/g) || []).length,
      complexity: desc.includes('analyze') ? 3 : 1
    };

    // Calculate estimated iterations
    estimatedIterations = Math.max(
      5,
      complexityFactors.multiple * 
      complexityFactors.actions * 
      complexityFactors.iteration * 
      complexityFactors.complexity +
      complexityFactors.api * 2
    );

    // Determine complexity level
    if (estimatedIterations <= 5) {
      complexity = 'simple';
    } else if (estimatedIterations <= 15) {
      complexity = 'moderate';
    } else if (estimatedIterations <= 40) {
      complexity = 'complex';
      requiresDecomposition = true;
    } else {
      complexity = 'very_complex';
      requiresDecomposition = true;
    }

    // Auto-decompose if needed
    if (requiresDecomposition) {
      subtasks.push(...this.autoDecompose(taskDescription, estimatedIterations));
    }

    return {
      complexity,
      estimatedIterations,
      requiresDecomposition,
      subtasks,
      reasoning: `Heuristic analysis: ${complexityFactors.multiple} items × ${complexityFactors.actions} actions × ${complexityFactors.iteration} iteration factor ≈ ${estimatedIterations} iterations`
    };
  }

  /**
   * Automatic task decomposition using pattern matching
   */
  private autoDecompose(taskDescription: string, totalIterations: number): SubTask[] {
    const desc = taskDescription.toLowerCase();
    const subtasks: SubTask[] = [];

    // Pattern: "Go through X and do Y and Z"
    if (desc.includes('go through') || desc.includes('for each')) {
      const match = desc.match(/(\d+)/);
      const count = match ? parseInt(match[0]) : 5;

      // Subtask 1: Fetch items
      subtasks.push({
        id: 'fetch_items',
        description: `Fetch the ${count} items from the source`,
        estimatedIterations: 3,
        dependencies: [],
        priority: 10,
        type: 'sequential'
      });

      // Subtask 2: Process each item
      for (let i = 1; i <= Math.min(count, 10); i++) {
        subtasks.push({
          id: `process_item_${i}`,
          description: `Process item ${i}/${count}`,
          estimatedIterations: Math.ceil(totalIterations / count),
          dependencies: ['fetch_items'],
          priority: 5,
          type: 'parallel'
        });
      }

      return subtasks;
    }

    // Pattern: Multiple independent operations
    if (desc.includes('and')) {
      const parts = desc.split('and').map(p => p.trim());
      parts.forEach((part, i) => {
        subtasks.push({
          id: `task_${i + 1}`,
          description: part,
          estimatedIterations: Math.ceil(totalIterations / parts.length),
          dependencies: i > 0 ? [`task_${i}`] : [],
          priority: 10 - i,
          type: 'sequential'
        });
      });
      return subtasks;
    }

    // Default: Split into equal chunks
    const numChunks = Math.ceil(totalIterations / 15);
    for (let i = 0; i < numChunks; i++) {
      subtasks.push({
        id: `chunk_${i + 1}`,
        description: `${taskDescription} (Part ${i + 1}/${numChunks})`,
        estimatedIterations: Math.ceil(totalIterations / numChunks),
        dependencies: i > 0 ? [`chunk_${i}`] : [],
        priority: 10 - i,
        type: 'sequential'
      });
    }

    return subtasks;
  }

  /**
   * Calculate optimal iteration limit for a task
   */
  calculateIterationLimit(analysis: TaskAnalysis): number {
    const baseLimit = 15;
    
    switch (analysis.complexity) {
      case 'simple':
        return baseLimit;
      case 'moderate':
        return baseLimit + 5;
      case 'complex':
        return baseLimit + 10;
      case 'very_complex':
        return baseLimit + 15;
      default:
        return baseLimit;
    }
  }

  /**
   * Get execution order for subtasks based on dependencies
   */
  getExecutionOrder(subtasks: SubTask[]): SubTask[][] {
    const batches: SubTask[][] = [];
    const completed = new Set<string>();
    const remaining = [...subtasks];

    while (remaining.length > 0) {
      const batch = remaining.filter(task => 
        task.dependencies.every(dep => completed.has(dep))
      );

      if (batch.length === 0) {
        logger.warn('Circular dependency detected in subtasks, breaking loop');
        batches.push(remaining);
        break;
      }

      // Sort by priority within batch
      batch.sort((a, b) => b.priority - a.priority);
      batches.push(batch);

      // Mark as completed and remove from remaining
      batch.forEach(task => completed.add(task.id));
      remaining.splice(0, remaining.length, ...remaining.filter(t => !batch.includes(t)));
    }

    return batches;
  }
}

