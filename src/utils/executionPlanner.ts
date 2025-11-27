import { logger } from './logger';
import Anthropic from '@anthropic-ai/sdk';
import { ExecutionPlan, PlanMilestone } from './adaptiveExecutor';

/**
 * Execution Planner - Creates intelligent execution plans for complex tasks
 *
 * This is called DURING execution, not before. The agent can use this tool
 * to create a plan after initial exploration.
 */

export interface PlanningContext {
  originalTask: string;
  explorationFindings?: string;  // What did we learn during exploration?
  availableTools?: string[];      // What tools can we use?
  constraints?: string[];         // Any limitations?
}

/**
 * Quick heuristic planner - no AI call needed for common patterns
 */
export function createQuickPlan(taskDescription: string): ExecutionPlan | null {
  const lower = taskDescription.toLowerCase();

  // Pattern: "List/Show/Get X"
  if (/^(list|show|get|fetch|display)\s/i.test(taskDescription)) {
    return {
      taskSummary: 'Information retrieval task',
      complexity: 'simple',
      estimatedEffort: 'quick',
      explorationNeeded: false,
      milestones: [
        { id: 'fetch', description: 'Fetch requested information', completed: false },
        { id: 'present', description: 'Present results to user', completed: false }
      ]
    };
  }

  // Pattern: "Create/Add X"
  if (/^(create|add|make|new)\s/i.test(taskDescription)) {
    return {
      taskSummary: 'Creation task',
      complexity: 'moderate',
      estimatedEffort: 'medium',
      explorationNeeded: false,
      milestones: [
        { id: 'validate', description: 'Validate inputs and prerequisites', completed: false },
        { id: 'create', description: 'Create the requested resource', completed: false },
        { id: 'verify', description: 'Verify creation was successful', completed: false }
      ]
    };
  }

  // Pattern: "Delete/Remove X"
  if (/^(delete|remove|destroy)\s/i.test(taskDescription)) {
    return {
      taskSummary: 'Deletion task',
      complexity: 'simple',
      estimatedEffort: 'quick',
      explorationNeeded: false,
      milestones: [
        { id: 'confirm', description: 'Confirm resource exists', completed: false },
        { id: 'delete', description: 'Delete the resource', completed: false },
        { id: 'verify', description: 'Verify deletion', completed: false }
      ]
    };
  }

  // Pattern: "Deploy X"
  if (/deploy|release|ship/i.test(lower)) {
    return {
      taskSummary: 'Deployment task',
      complexity: 'complex',
      estimatedEffort: 'substantial',
      explorationNeeded: true,
      milestones: [
        { id: 'check_status', description: 'Check current deployment status', completed: false },
        { id: 'validate', description: 'Validate deployment prerequisites', completed: false },
        { id: 'build', description: 'Build/prepare for deployment', completed: false },
        { id: 'deploy', description: 'Execute deployment', completed: false },
        { id: 'verify', description: 'Verify deployment success', completed: false }
      ]
    };
  }

  // Pattern: "Analyze/Review X" - This is key for the original failing task
  if (/analyze|review|audit|examine|assess|evaluate|improve/i.test(lower)) {
    const isCodebaseAnalysis = /repo|codebase|project|code|architecture/i.test(lower);

    if (isCodebaseAnalysis) {
      return {
        taskSummary: 'Codebase analysis task',
        complexity: 'exploratory',
        estimatedEffort: 'substantial',
        explorationNeeded: true,
        milestones: [
          { id: 'explore_structure', description: 'Explore project structure', completed: false },
          { id: 'identify_components', description: 'Identify key components', completed: false },
          { id: 'analyze_patterns', description: 'Analyze code patterns and architecture', completed: false },
          { id: 'identify_issues', description: 'Identify areas for improvement', completed: false },
          { id: 'generate_recommendations', description: 'Generate recommendations', completed: false },
          { id: 'present_findings', description: 'Present findings to user', completed: false }
        ]
      };
    }

    return {
      taskSummary: 'Analysis task',
      complexity: 'moderate',
      estimatedEffort: 'medium',
      explorationNeeded: true,
      milestones: [
        { id: 'gather', description: 'Gather relevant information', completed: false },
        { id: 'analyze', description: 'Analyze the information', completed: false },
        { id: 'synthesize', description: 'Synthesize findings', completed: false },
        { id: 'present', description: 'Present analysis results', completed: false }
      ]
    };
  }

  // No quick plan - needs AI planning
  return null;
}

/**
 * AI-powered planner for complex tasks
 */
export class ExecutionPlanner {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Create an execution plan for a task
   */
  async createPlan(context: PlanningContext): Promise<ExecutionPlan> {
    // First try quick planning
    const quickPlan = createQuickPlan(context.originalTask);
    if (quickPlan && quickPlan.complexity !== 'exploratory') {
      logger.info('📋 Using quick plan for straightforward task');
      return quickPlan;
    }

    // For complex/exploratory tasks, use AI
    logger.info('🤖 Creating AI-powered execution plan...');

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: `You are an execution planning expert. Create structured, actionable plans.

Your job:
1. Understand the task goal
2. Break it into clear milestones
3. Order milestones logically
4. Estimate complexity

RULES:
- Each milestone should be independently verifiable
- Milestones should be ordered by dependency
- Don't over-decompose (3-8 milestones typically)
- Be realistic about complexity

COMPLEXITY LEVELS:
- simple: 1-3 steps, single focus
- moderate: 3-5 steps, clear path
- complex: 5-8 steps, multiple concerns
- exploratory: Unknown scope, requires discovery

EFFORT LEVELS:
- quick: < 5 minutes
- medium: 5-15 minutes
- substantial: 15+ minutes

Respond ONLY with JSON:
{
  "taskSummary": "brief description",
  "complexity": "simple|moderate|complex|exploratory",
  "estimatedEffort": "quick|medium|substantial",
  "explorationNeeded": true|false,
  "milestones": [
    {
      "id": "snake_case_id",
      "description": "Clear action description",
      "completed": false
    }
  ]
}`,
        messages: [
          {
            role: 'user',
            content: this.buildPlanningPrompt(context)
          }
        ]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]) as ExecutionPlan;
        logger.info(`📋 Plan created: ${plan.complexity} complexity, ${plan.milestones.length} milestones`);
        return plan;
      }
    } catch (error) {
      logger.error('Failed to create AI plan, falling back to generic', error);
    }

    // Fallback to generic exploratory plan
    return {
      taskSummary: context.originalTask.substring(0, 100),
      complexity: 'exploratory',
      estimatedEffort: 'substantial',
      explorationNeeded: true,
      milestones: [
        { id: 'understand', description: 'Understand the task requirements', completed: false },
        { id: 'explore', description: 'Explore and gather information', completed: false },
        { id: 'execute', description: 'Execute the main task', completed: false },
        { id: 'verify', description: 'Verify results', completed: false },
        { id: 'report', description: 'Report findings to user', completed: false }
      ]
    };
  }

  private buildPlanningPrompt(context: PlanningContext): string {
    let prompt = `Create an execution plan for this task:\n\nTASK: ${context.originalTask}`;

    if (context.explorationFindings) {
      prompt += `\n\nFINDINGS FROM EXPLORATION:\n${context.explorationFindings}`;
    }

    if (context.availableTools?.length) {
      prompt += `\n\nAVAILABLE TOOLS: ${context.availableTools.join(', ')}`;
    }

    if (context.constraints?.length) {
      prompt += `\n\nCONSTRAINTS: ${context.constraints.join(', ')}`;
    }

    return prompt;
  }
}

/**
 * Plan progress tracker
 */
export class PlanTracker {
  private plan: ExecutionPlan;
  private startTime: number;

  constructor(plan: ExecutionPlan) {
    this.plan = plan;
    this.startTime = Date.now();
  }

  /**
   * Mark a milestone as complete
   */
  completeMilestone(milestoneId: string): boolean {
    const milestone = this.plan.milestones.find(m => m.id === milestoneId);
    if (milestone) {
      milestone.completed = true;
      logger.info(`✅ Milestone completed: ${milestone.description}`);
      return true;
    }
    return false;
  }

  /**
   * Get current progress
   */
  getProgress(): { completed: number; total: number; percentage: number; remaining: PlanMilestone[] } {
    const completed = this.plan.milestones.filter(m => m.completed).length;
    const total = this.plan.milestones.length;
    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100),
      remaining: this.plan.milestones.filter(m => !m.completed)
    };
  }

  /**
   * Get next milestone to work on
   */
  getNextMilestone(): PlanMilestone | null {
    return this.plan.milestones.find(m => !m.completed) || null;
  }

  /**
   * Check if all milestones are complete
   */
  isComplete(): boolean {
    return this.plan.milestones.every(m => m.completed);
  }

  /**
   * Get formatted progress string for notifications
   */
  getProgressString(): string {
    const progress = this.getProgress();
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);

    return `📊 **Progress: ${progress.percentage}%** (${progress.completed}/${progress.total} milestones)\n` +
           `⏱️ Elapsed: ${elapsed}s`;
  }

  /**
   * Get detailed status for logging
   */
  getDetailedStatus(): string {
    const lines = ['📋 Plan Status:'];

    this.plan.milestones.forEach((m, i) => {
      const status = m.completed ? '✅' : '⬜';
      lines.push(`   ${status} ${i + 1}. ${m.description}`);
    });

    return lines.join('\n');
  }
}
