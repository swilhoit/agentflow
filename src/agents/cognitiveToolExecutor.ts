import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import {
  CognitiveAgent,
  ContextEngine,
  StrategicPlanner,
  SelfMonitor,
  EnvironmentContext,
  ToolInventory,
  StrategicPlan,
  ExecutionPhase,
  ToolCallRecord,
  COGNITIVE_TOOL_REGISTRY
} from './cognitiveAgent';
import {
  SmartModelRouter,
  createModelRouter,
  analyzeTaskComplexity,
  ComplexityAnalysis,
  ModelConfig,
  MODELS
} from '../utils/modelSelector';

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    COGNITIVE TOOL EXECUTOR                                 ║
 * ║                                                                            ║
 * ║  Bridges the Cognitive Agent's strategic planning with actual tool        ║
 * ║  execution. Provides the "hands" for the cognitive "brain".               ║
 * ║                                                                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

export interface CognitiveExecutionResult {
  success: boolean;
  message: string;
  iterations: number;
  toolCalls: number;
  phasesCompleted: number;
  totalPhases: number;
  discoveries: string[];
  approach: string;
  confidence: number;
  // Smart model routing stats
  modelUsage?: {
    primaryModel: string;
    escalations: number;
    complexityTier: string;
    complexityScore: number;
  };
}

export interface ToolExecutor {
  (toolName: string, input: any): Promise<any>;
}

/**
 * The CognitiveToolExecutor combines strategic planning with actual tool execution
 */
export class CognitiveToolExecutor {
  private client: Anthropic;
  private planner: StrategicPlanner;
  private monitor: SelfMonitor;
  private toolExecutor: ToolExecutor;
  private notificationHandler?: (message: string) => Promise<void>;

  // Smart Model Router - Selects optimal model based on task complexity
  private modelRouter: SmartModelRouter;
  private taskComplexity: ComplexityAnalysis | null = null;

  // Execution state
  private context: EnvironmentContext | null = null;
  private plan: StrategicPlan | null = null;
  private currentPhaseIndex = 0;
  private iteration = 0;
  private toolCalls = 0;

  // Configuration
  private config = {
    maxIterationsPerPhase: 20,
    maxTotalIterations: 100,
    progressCheckInterval: 3,
    enableDelegation: true,
    enablePivoting: true,
    verboseLogging: true,
    enableSmartModelSwitching: true,  // Use dynamic model selection
    maxContextTokens: 150000,  // Leave room for response (200k limit)
    contextTruncationStrategy: 'smart' as 'smart' | 'simple'
  };

  constructor(apiKey: string, toolExecutor: ToolExecutor) {
    this.client = new Anthropic({ apiKey });
    this.planner = new StrategicPlanner(apiKey);
    this.monitor = new SelfMonitor();
    this.toolExecutor = toolExecutor;
    this.modelRouter = createModelRouter();  // Initialize smart model router
  }

  /**
   * Set notification handler
   */
  setNotificationHandler(handler: (message: string) => Promise<void>): void {
    this.notificationHandler = handler;
  }

  /**
   * Execute a task with full cognitive capabilities
   */
  async execute(
    task: string,
    tools: Anthropic.Tool[],
    options?: {
      workingDir?: string;
      hasTrello?: boolean;
      conversationHistory?: string;
    }
  ): Promise<CognitiveExecutionResult> {
    // Reset state
    this.monitor = new SelfMonitor();
    this.modelRouter = createModelRouter();  // Reset model router for fresh task
    this.currentPhaseIndex = 0;
    this.iteration = 0;
    this.toolCalls = 0;

    logger.info(`\n${'═'.repeat(70)}`);
    logger.info(`🧠 COGNITIVE TOOL EXECUTOR - STARTING`);
    logger.info(`${'═'.repeat(70)}`);

    // ======================================================================
    // PHASE 0: TASK COMPLEXITY ANALYSIS & MODEL SELECTION
    // ======================================================================
    if (this.config.enableSmartModelSwitching) {
      this.taskComplexity = analyzeTaskComplexity(task);
      const selectedModel = this.modelRouter.getModelForTask(task);

      logger.info(`🎯 Task Complexity Analysis:`);
      logger.info(`   Score: ${this.taskComplexity.score}/100`);
      logger.info(`   Level: ${this.taskComplexity.complexity}`);
      logger.info(`   Factors: ${this.taskComplexity.factors.map(f => f.name).join(', ')}`);
      logger.info(`   Selected Model: ${selectedModel.name} (${selectedModel.tier})`);

      await this.notify(
        `🎯 **Model Selection**\n` +
        `Complexity: ${this.taskComplexity.score}/100 (${this.taskComplexity.complexity})\n` +
        `Model: **${selectedModel.name}**`
      );
    }

    try {
      // ======================================================================
      // PHASE 1: CONTEXT GATHERING
      // ======================================================================
      await this.notify(`🔍 **Gathering Context**\nAnalyzing environment and project structure...`);

      this.context = await ContextEngine.gatherContext(options?.workingDir);

      logger.info(`📊 Context: ${this.context.projectType} project in ${this.context.workingDirectory}`);
      logger.info(`   Key files: ${this.context.keyFiles.slice(0, 5).join(', ')}`);

      // ======================================================================
      // PHASE 2: STRATEGIC PLANNING
      // ======================================================================
      await this.notify(`🧠 **Strategic Planning**\nDetermining optimal approach...`);

      const toolInventory = this.buildToolInventory(tools, options?.hasTrello ?? false);
      this.plan = await this.planner.createStrategicPlan(task, this.context, toolInventory);

      logger.info(`📋 Plan created:`);
      logger.info(`   Approach: ${this.plan.approach.approach}`);
      logger.info(`   Confidence: ${(this.plan.approach.confidence * 100).toFixed(0)}%`);
      logger.info(`   Phases: ${this.plan.phases.length}`);
      logger.info(`   Complexity: ${this.plan.estimatedComplexity}`);

      await this.notify(this.formatPlanNotification());

      // ======================================================================
      // PHASE 3: EXECUTION WITH SELF-MONITORING
      // ======================================================================
      const result = await this.executeWithMonitoring(task, tools, options?.conversationHistory);

      // ======================================================================
      // FINAL SUMMARY
      // ======================================================================
      logger.info(`\n${this.monitor.getSummary()}`);

      return {
        success: result.success,
        message: result.message,
        iterations: this.iteration,
        toolCalls: this.toolCalls,
        phasesCompleted: this.monitor.getMemory().completedPhases.length,
        totalPhases: this.plan.phases.length,
        discoveries: this.monitor.getMemory().discoveredFacts,
        approach: this.plan.approach.approach,
        confidence: this.plan.approach.confidence,
        modelUsage: this.config.enableSmartModelSwitching && this.taskComplexity ? {
          primaryModel: this.modelRouter.getCurrentModel().name,
          escalations: this.modelRouter.getEscalationCount(),
          complexityTier: this.taskComplexity.complexity,
          complexityScore: this.taskComplexity.score
        } : undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`🚨 Cognitive execution failed: ${errorMessage}`);

      await this.notify(`❌ **Execution Failed**\n${errorMessage}`);

      return {
        success: false,
        message: errorMessage,
        iterations: this.iteration,
        toolCalls: this.toolCalls,
        phasesCompleted: this.monitor.getMemory().completedPhases.length,
        totalPhases: this.plan?.phases.length || 0,
        discoveries: this.monitor.getMemory().discoveredFacts,
        approach: this.plan?.approach.approach || 'unknown',
        confidence: 0,
        modelUsage: this.config.enableSmartModelSwitching && this.taskComplexity ? {
          primaryModel: this.modelRouter.getCurrentModel().name,
          escalations: this.modelRouter.getEscalationCount(),
          complexityTier: this.taskComplexity.complexity,
          complexityScore: this.taskComplexity.score
        } : undefined
      };
    }
  }

  /**
   * Execute the plan with continuous self-monitoring
   */
  private async executeWithMonitoring(
    task: string,
    tools: Anthropic.Tool[],
    conversationHistory?: string
  ): Promise<{ success: boolean; message: string }> {
    const messages: Anthropic.MessageParam[] = [];

    // Build cognitive system prompt
    messages.push({
      role: 'user',
      content: this.buildCognitiveSystemPrompt(task, conversationHistory)
    });

    // Execute phase by phase
    for (let phaseIdx = 0; phaseIdx < this.plan!.phases.length; phaseIdx++) {
      this.currentPhaseIndex = phaseIdx;
      const phase = this.plan!.phases[phaseIdx];

      logger.info(`\n${'─'.repeat(50)}`);
      logger.info(`📍 PHASE ${phaseIdx + 1}/${this.plan!.phases.length}: ${phase.name}`);
      logger.info(`${'─'.repeat(50)}`);

      await this.notify(
        `🔄 **Phase ${phaseIdx + 1}/${this.plan!.phases.length}: ${phase.name}**\n` +
        `${phase.description}\n` +
        `_Tools: ${phase.tools.join(', ') || 'reasoning'}_`
      );

      // Execute phase iterations
      const phaseResult = await this.executePhase(phase, messages, tools);

      if (phaseResult.taskComplete) {
        return { success: true, message: phaseResult.finalMessage || 'Task completed' };
      }

      if (!phaseResult.phaseComplete && !phaseResult.continueToNext) {
        // Phase failed and shouldn't continue
        return { success: false, message: phaseResult.failureReason || 'Phase failed' };
      }

      this.monitor.completePhase(phase.id);
    }

    // All phases complete
    return { success: true, message: 'All phases completed successfully' };
  }

  /**
   * Estimate token count for messages (rough approximation: 4 chars ≈ 1 token)
   */
  private estimateTokens(messages: Anthropic.MessageParam[]): number {
    let totalChars = 0;
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if ('text' in block) {
            totalChars += block.text.length;
          } else if ('content' in block && typeof block.content === 'string') {
            totalChars += block.content.length;
          }
        }
      }
    }
    return Math.ceil(totalChars / 4);
  }

  /**
   * Manage context to stay within token limits
   * CRITICAL: Must preserve tool_use/tool_result pairs - they must stay together!
   */
  private manageContext(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
    const estimatedTokens = this.estimateTokens(messages);

    if (estimatedTokens <= this.config.maxContextTokens) {
      return messages;  // No truncation needed
    }

    logger.warn(`⚠️ Context too large (${estimatedTokens} tokens), truncating...`);

    const managed: Anthropic.MessageParam[] = [];

    // Always keep the first message (contains task context)
    if (messages.length > 0) {
      managed.push(messages[0]);
    }

    // Find safe truncation point - we need to keep tool_use/tool_result pairs together
    // Work backwards to find complete assistant/user pairs
    const keepCount = Math.min(20, messages.length - 1);  // Keep last ~10 exchanges
    let startIdx = messages.length - keepCount;

    // Ensure we start at a user message (after any tool_result for previous assistant)
    // If startIdx lands on an assistant message with tool_use, move forward to include its tool_result
    while (startIdx > 1 && startIdx < messages.length) {
      const msg = messages[startIdx];
      const prevMsg = messages[startIdx - 1];

      // Check if previous message has tool_use that needs a tool_result
      if (prevMsg.role === 'assistant' && Array.isArray(prevMsg.content)) {
        const hasToolUse = prevMsg.content.some((block: any) => block.type === 'tool_use');
        if (hasToolUse) {
          // We can't start here - would orphan the tool_use
          // Move forward to skip this tool_result
          startIdx++;
          continue;
        }
      }

      // Safe to start here if current is user message
      if (msg.role === 'user') {
        break;
      }
      startIdx++;
    }

    // Add summary of truncated content
    const truncatedCount = startIdx - 1;
    if (truncatedCount > 0) {
      managed.push({
        role: 'user',
        content: `[CONTEXT SUMMARY: ${truncatedCount} previous messages were truncated. Key discoveries: ${this.monitor.getMemory().discoveredFacts.slice(-5).join('; ') || 'None'}. Continue the analysis.]`
      });

      // Need an assistant acknowledgment to maintain alternation
      managed.push({
        role: 'assistant',
        content: 'Understood. Continuing the analysis with the context preserved.'
      });
    }

    // Add remaining messages, truncating large tool results
    for (let i = startIdx; i < messages.length; i++) {
      const msg = messages[i];

      if (typeof msg.content !== 'string' && Array.isArray(msg.content)) {
        const truncatedContent = msg.content.map((block: any) => {
          // Truncate large tool_result content but keep the structure
          if (block.type === 'tool_result' && typeof block.content === 'string' && block.content.length > 8000) {
            return {
              ...block,
              content: block.content.substring(0, 6000) + '\n\n[...OUTPUT TRUNCATED from ' + block.content.length + ' chars...]'
            };
          }
          // Truncate large text blocks
          if (block.type === 'text' && block.text && block.text.length > 8000) {
            return {
              ...block,
              text: block.text.substring(0, 6000) + '\n\n[...TRUNCATED...]'
            };
          }
          return block;
        });
        managed.push({ ...msg, content: truncatedContent as any });
      } else if (typeof msg.content === 'string' && msg.content.length > 8000) {
        managed.push({ ...msg, content: msg.content.substring(0, 6000) + '\n\n[...TRUNCATED...]' });
      } else {
        managed.push(msg);
      }
    }

    const newTokens = this.estimateTokens(managed);
    logger.info(`   Context reduced: ${estimatedTokens} → ${newTokens} tokens (kept ${messages.length - startIdx} messages)`);

    return managed;
  }

  /**
   * Execute a single phase with iterations
   */
  private async executePhase(
    phase: ExecutionPhase,
    messages: Anthropic.MessageParam[],
    tools: Anthropic.Tool[]
  ): Promise<{
    phaseComplete: boolean;
    taskComplete: boolean;
    continueToNext: boolean;
    finalMessage?: string;
    failureReason?: string;
  }> {
    let phaseIterations = 0;
    const maxPhaseIter = Math.min(phase.estimatedIterations * 2, this.config.maxIterationsPerPhase);

    while (phaseIterations < maxPhaseIter && this.iteration < this.config.maxTotalIterations) {
      this.iteration++;
      phaseIterations++;

      logger.info(`   Iteration ${phaseIterations}/${maxPhaseIter} (total: ${this.iteration})`);

      // Self-assessment check
      if (this.iteration % this.config.progressCheckInterval === 0) {
        const assessment = this.monitor.assess(phase.id, this.plan!);

        if (assessment.isStuck) {
          logger.warn(`   ⚠️ Stuck detected: ${assessment.stuckReason}`);
          await this.notify(`⚠️ **Progress Check**\n${assessment.stuckReason}`);

          if (assessment.shouldPivot && this.config.enablePivoting) {
            await this.handlePivot(assessment.pivotSuggestion || 'Try different approach');
          }

          if (assessment.shouldAskUser) {
            await this.notify(`❓ **Need Guidance**\n${assessment.questionForUser}`);
          }
        }

        // Check for delegation opportunity
        if (assessment.shouldDelegate && phase.canDelegate && this.config.enableDelegation) {
          logger.info(`   🤖 Delegation opportunity: ${assessment.delegationTarget}`);
          // For now, just note it - actual delegation handled by tool calls
        }
      }

      // Call Claude with cognitive context
      const response = await this.callClaudeWithCognition(messages, tools, phase);

      // Process response
      const result = await this.processResponse(response, messages, phase);

      if (result.taskComplete) {
        return {
          phaseComplete: true,
          taskComplete: true,
          continueToNext: false,
          finalMessage: result.text
        };
      }

      if (result.phaseComplete) {
        return {
          phaseComplete: true,
          taskComplete: false,
          continueToNext: true
        };
      }

      // Check for completion signals in text
      if (this.detectPhaseCompletion(result.text, phase)) {
        return {
          phaseComplete: true,
          taskComplete: false,
          continueToNext: true
        };
      }
    }

    // Phase didn't complete but we can try to continue
    logger.warn(`   Phase ${phase.id} reached iteration limit`);
    return {
      phaseComplete: false,
      taskComplete: false,
      continueToNext: true  // Try next phase anyway
    };
  }

  /**
   * Call Claude with cognitive enhancements and smart model selection
   */
  private async callClaudeWithCognition(
    messages: Anthropic.MessageParam[],
    tools: Anthropic.Tool[],
    phase: ExecutionPhase
  ): Promise<Anthropic.Message> {
    // Determine the optimal model for this phase
    let modelToUse: ModelConfig;

    if (this.config.enableSmartModelSwitching) {
      // Map phase type to model selection
      const phaseType = this.mapPhaseToType(phase);
      modelToUse = this.modelRouter.getModelForPhase(
        phaseType,
        this.taskComplexity?.complexity || 'moderate'
      );

      logger.info(`   🤖 Using model: ${modelToUse.name} for ${phase.name}`);
    } else {
      // Fallback to Sonnet
      modelToUse = this.modelRouter.getCurrentModel();
    }

    try {
      // CRITICAL: Manage context to prevent token overflow
      const managedMessages = this.manageContext(messages);

      const response = await this.client.messages.create({
        model: modelToUse.id,
        max_tokens: modelToUse.tier === 'powerful' ? 8192 : 4096,  // More tokens for powerful model
        tools,
        messages: managedMessages
      });

      // Report success to the model router
      if (this.config.enableSmartModelSwitching && this.taskComplexity) {
        this.modelRouter.reportSuccess(this.taskComplexity.complexity);
      }

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if it's a token limit error OR tool_use/tool_result mismatch - try aggressive truncation
      if (errorMessage.includes('too long') || errorMessage.includes('tokens') || errorMessage.includes('tool_use') || errorMessage.includes('tool_result')) {
        logger.warn(`   ⚠️ Context error, applying aggressive truncation...`);

        // Aggressive but safe truncation - preserve tool pairs
        const aggressiveManaged: Anthropic.MessageParam[] = [];
        if (messages.length > 0) {
          aggressiveManaged.push(messages[0]);  // Keep system prompt
        }

        // Add context summary
        aggressiveManaged.push({
          role: 'user',
          content: `[CONTEXT RESET: Previous context was truncated due to size limits. Key discoveries: ${this.monitor.getMemory().discoveredFacts.slice(-3).join('; ') || 'None'}. Please continue the task concisely.]`
        });
        aggressiveManaged.push({
          role: 'assistant',
          content: 'Understood. I will continue the task with the context provided.'
        });

        // Find last safe starting point - must be a user message not containing tool_result for orphaned tool_use
        let safeStart = messages.length - 6;  // Try last 3 exchanges
        while (safeStart > 1) {
          const msg = messages[safeStart];
          if (msg.role === 'user') {
            // Check this isn't a tool_result for a truncated tool_use
            if (!Array.isArray(msg.content) || !msg.content.some((b: any) => b.type === 'tool_result')) {
              break;  // Safe to start here
            }
          }
          safeStart++;
        }

        // If we found a safe start, add those messages
        if (safeStart < messages.length) {
          for (let i = safeStart; i < messages.length; i++) {
            const msg = messages[i];
            // Heavily truncate content
            if (typeof msg.content === 'string') {
              aggressiveManaged.push({ ...msg, content: msg.content.substring(0, 2000) });
            } else if (Array.isArray(msg.content)) {
              const truncated = msg.content.map((block: any) => {
                if (block.type === 'tool_result' && typeof block.content === 'string') {
                  return { ...block, content: block.content.substring(0, 2000) + '\n[TRUNCATED]' };
                }
                if (block.type === 'text' && block.text) {
                  return { ...block, text: block.text.substring(0, 2000) };
                }
                return block;
              });
              aggressiveManaged.push({ ...msg, content: truncated as any });
            } else {
              aggressiveManaged.push(msg);
            }
          }
        }

        return await this.client.messages.create({
          model: modelToUse.id,
          max_tokens: modelToUse.tier === 'powerful' ? 8192 : 4096,
          tools,
          messages: aggressiveManaged
        });
      }

      // On failure, try escalating to a more powerful model
      if (this.config.enableSmartModelSwitching) {
        const escalatedModel = this.modelRouter.reportFailure();

        if (escalatedModel && escalatedModel.id !== modelToUse.id) {
          logger.warn(`   ⬆️ Escalating model: ${modelToUse.name} → ${escalatedModel.name}`);
          await this.notify(`⬆️ **Model Escalation**\n${modelToUse.name} → ${escalatedModel.name}`);

          const managedMessages = this.manageContext(messages);
          // Retry with escalated model
          return await this.client.messages.create({
            model: escalatedModel.id,
            max_tokens: escalatedModel.tier === 'powerful' ? 8192 : 4096,
            tools,
            messages: managedMessages
          });
        }
      }

      // If no escalation possible, re-throw
      throw error;
    }
  }

  /**
   * Map execution phase to model selector phase type
   */
  private mapPhaseToType(phase: ExecutionPhase): 'exploration' | 'planning' | 'execution' | 'verification' | 'reporting' {
    const name = phase.name.toLowerCase();

    if (name.includes('explor') || name.includes('discover') || name.includes('analyze') || name.includes('gather')) {
      return 'exploration';
    }
    if (name.includes('plan') || name.includes('design') || name.includes('architect')) {
      return 'planning';
    }
    if (name.includes('valid') || name.includes('test') || name.includes('verify') || name.includes('check')) {
      return 'verification';
    }
    if (name.includes('report') || name.includes('summar') || name.includes('conclud')) {
      return 'reporting';
    }
    // Default to execution
    return 'execution';
  }

  /**
   * Process Claude's response
   */
  private async processResponse(
    response: Anthropic.Message,
    messages: Anthropic.MessageParam[],
    phase: ExecutionPhase
  ): Promise<{
    phaseComplete: boolean;
    taskComplete: boolean;
    text: string;
  }> {
    // Add assistant response to history
    messages.push({ role: 'assistant', content: response.content });

    // Extract text
    const textBlocks = response.content.filter(
      (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
    );
    const text = textBlocks.map(b => b.text).join('\n');

    // Check for tool use
    if (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
      );

      logger.info(`   🔧 ${toolUses.length} tool call(s)`);

      // Execute tools and collect results
      const toolResults: Anthropic.MessageCreateParams['messages'][0] = {
        role: 'user',
        content: []
      };

      for (const toolUse of toolUses) {
        this.toolCalls++;
        const startTime = Date.now();

        await this.notify(`🔧 **Tool: ${toolUse.name}**`);

        try {
          const result = await this.toolExecutor(toolUse.name, toolUse.input);
          const duration = Date.now() - startTime;
          const success = !result.error && !result.failed;

          // Record for self-monitoring
          const insights = this.extractInsights(result, toolUse.name);
          this.monitor.recordToolCall({
            tool: toolUse.name,
            input: toolUse.input,
            output: result,
            success,
            timestamp: Date.now(),
            duration,
            insightsGained: insights
          });

          // Record discoveries
          insights.forEach(insight => this.monitor.recordDiscovery(insight));

          (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result)
          });

          await this.notify(`✅ Tool completed (${duration}ms)`);

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.monitor.recordFailure(phase.id, toolUse.name, errorMsg);

          (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: errorMsg }),
            is_error: true
          });

          await this.notify(`❌ Tool failed: ${errorMsg}`);
        }
      }

      messages.push(toolResults);

      return { phaseComplete: false, taskComplete: false, text };
    }

    // Check for task completion
    if (response.stop_reason === 'end_turn') {
      const isComplete = /task complete|all done|finished|completed successfully/i.test(text);
      if (isComplete) {
        await this.notify(`🏁 **Task Complete**\n${text.substring(0, 500)}`);
        return { phaseComplete: true, taskComplete: true, text };
      }
    }

    return { phaseComplete: false, taskComplete: false, text };
  }

  /**
   * Extract insights from tool results
   */
  private extractInsights(result: any, toolName: string): string[] {
    const insights: string[] = [];

    if (toolName === 'execute_bash') {
      // Extract file discoveries
      const output = result.output || result.stdout || '';
      if (output.includes('package.json')) insights.push('Found package.json');
      if (output.includes('src/')) insights.push('Has src directory');
      if (output.includes('.ts')) insights.push('TypeScript project');
      if (output.includes('test')) insights.push('Has tests');
    }

    if (toolName.startsWith('trello_')) {
      if (result.cards) insights.push(`Found ${result.cards.length} Trello cards`);
      if (result.boards) insights.push(`Found ${result.boards.length} Trello boards`);
    }

    if (toolName === 'list_containers') {
      if (result.containers) insights.push(`${result.containers.length} containers running`);
    }

    return insights;
  }

  /**
   * Detect if phase is complete based on text
   */
  private detectPhaseCompletion(text: string, phase: ExecutionPhase): boolean {
    const lower = text.toLowerCase();
    const completionPhrases = [
      'phase complete',
      'moving to next phase',
      'completed this phase',
      'phase finished',
      `${phase.name.toLowerCase()} complete`
    ];

    return completionPhrases.some(phrase => lower.includes(phrase));
  }

  /**
   * Handle strategy pivot
   */
  private async handlePivot(suggestion: string): Promise<void> {
    logger.info(`   🔄 Pivoting: ${suggestion}`);
    this.monitor.recordPivot(
      this.plan!.approach.approach,
      'alternative',
      suggestion
    );
    await this.notify(`🔄 **Strategy Pivot**\n${suggestion}`);
  }

  /**
   * Build tool inventory from Anthropic tools
   */
  private buildToolInventory(tools: Anthropic.Tool[], hasTrello: boolean): ToolInventory {
    const available = COGNITIVE_TOOL_REGISTRY.filter(tool => {
      // Check if tool is in the provided tools list
      const inTools = tools.some(t => t.name === tool.name);
      // Filter out Trello if not configured
      if (tool.name.startsWith('trello_') && !hasTrello) return false;
      return inTools || tool.name === 'execute_bash';  // Always include bash
    });

    return {
      available,
      configured: available.map(t => t.name),
      recommended: []
    };
  }

  /**
   * Build the cognitive system prompt
   */
  private buildCognitiveSystemPrompt(task: string, conversationHistory?: string): string {
    const ctx = this.context!;
    const plan = this.plan!;

    return `# COGNITIVE AGENT EXECUTION

## YOUR COGNITIVE CAPABILITIES
You are a Cognitive Agent with enhanced awareness and strategic thinking:
1. **Context Awareness**: You understand the project environment
2. **Strategic Planning**: You follow a well-thought-out plan
3. **Self-Monitoring**: You track your own progress
4. **Adaptive Execution**: You can pivot if needed

## ENVIRONMENT CONTEXT
\`\`\`
Working Directory: ${ctx.workingDirectory}
Project Type: ${ctx.projectType}${ctx.projectName ? ` (${ctx.projectName})` : ''}
Git: ${ctx.hasGit ? `${ctx.gitBranch} - ${ctx.gitStatus}` : 'Not a git repo'}
Docker: ${ctx.hasDocker ? 'Available' : 'Not configured'}
Key Files: ${ctx.keyFiles.slice(0, 8).join(', ')}
Recently Modified: ${ctx.recentlyModified.slice(0, 5).join(', ')}
\`\`\`

## YOUR STRATEGIC PLAN
**Understanding**: ${plan.taskUnderstanding}
**Approach**: ${plan.approach.approach} (${(plan.approach.confidence * 100).toFixed(0)}% confidence)
**Reasoning**: ${plan.approach.reasoning}
${plan.approach.fallbackStrategy ? `**Fallback**: ${plan.approach.fallbackStrategy}` : ''}

## EXECUTION PHASES
${plan.phases.map((p, i) => `
### Phase ${i + 1}: ${p.name}
- **Goal**: ${p.description}
- **Tools**: ${p.tools.join(', ') || 'Reasoning only'}
- **Complete When**: ${p.completionCriteria}
${p.toolStrategies && Object.keys(p.toolStrategies).length > 0 ?
  `- **Strategy**: ${Object.values(p.toolStrategies).join('; ')}` : ''}`).join('\n')}

## TOOL STRATEGY
- **Primary Tools**: ${plan.toolStrategy.primary.join(', ')}
${plan.toolStrategy.secondary.length > 0 ? `- **Secondary**: ${plan.toolStrategy.secondary.join(', ')}` : ''}
${plan.toolStrategy.avoidUsing.length > 0 ? `- **Avoid**: ${plan.toolStrategy.avoidUsing.join(', ')}` : ''}

## RISK AWARENESS
Risk Level: ${plan.riskAssessment.level}
${plan.riskAssessment.concerns.length > 0 ? `Concerns: ${plan.riskAssessment.concerns.join(', ')}` : ''}
${plan.riskAssessment.mitigations.length > 0 ? `Mitigations: ${plan.riskAssessment.mitigations.join(', ')}` : ''}

## SUCCESS CRITERIA
${plan.successCriteria.map(c => `✓ ${c}`).join('\n')}

${conversationHistory ? `## CONVERSATION CONTEXT\n${conversationHistory}\n` : ''}

## YOUR TASK
${task}

## EXECUTION INSTRUCTIONS
1. Work through each phase systematically
2. Use the recommended tools strategically
3. When you complete a phase, say "Phase complete"
4. If you get stuck, describe what's blocking you
5. When the entire task is done, summarize your findings and say "Task complete"

Begin with Phase 1: ${plan.phases[0]?.name || 'Execute'}`;
  }

  /**
   * Format plan notification for Discord
   */
  private formatPlanNotification(): string {
    const plan = this.plan!;
    const phases = plan.phases.map((p, i) => `${i + 1}. ${p.name}`).join('\n');

    return `📋 **Strategic Plan**

**Approach:** ${plan.approach.approach}
**Confidence:** ${(plan.approach.confidence * 100).toFixed(0)}%
**Complexity:** ${plan.estimatedComplexity}
**Risk:** ${plan.riskAssessment.level}

**Phases:**
${phases}

**Primary Tools:** ${plan.toolStrategy.primary.slice(0, 4).join(', ')}

_${plan.approach.reasoning}_`;
  }

  /**
   * Send notification
   */
  private async notify(message: string): Promise<void> {
    if (this.notificationHandler) {
      await this.notificationHandler(message);
    }
    if (this.config.verboseLogging) {
      // Clean up for console
      const clean = message.replace(/\*\*/g, '').replace(/`/g, '').substring(0, 150);
      logger.info(`📢 ${clean}`);
    }
  }
}

/**
 * Factory function
 */
export function createCognitiveToolExecutor(
  apiKey: string,
  toolExecutor: ToolExecutor
): CognitiveToolExecutor {
  return new CognitiveToolExecutor(apiKey, toolExecutor);
}
