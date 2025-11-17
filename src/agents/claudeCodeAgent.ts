import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AgentTask {
  id: string;
  description: string;
  workingDirectory?: string;
  contextFiles?: string[];
  requirements?: string[];
  maxIterations?: number;
}

export interface AgentStep {
  step: number;
  action: string;
  command?: string;
  output?: string;
  decision?: string;
  nextSteps?: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: Date;
}

export interface AgentResult {
  taskId: string;
  success: boolean;
  steps: AgentStep[];
  finalOutput?: string;
  error?: string;
  testResults?: TestResult[];
  filesModified?: string[];
  duration: number;
}

export interface TestResult {
  name: string;
  passed: boolean;
  output?: string;
  error?: string;
}

/**
 * Enhanced Claude Code Agent
 *
 * Capabilities:
 * - Terminal output monitoring and analysis
 * - Multi-step reasoning and planning
 * - Autonomous decision making
 * - Testing and debugging
 * - Auto-approval mode (YOLO)
 */
export class ClaudeCodeAgent extends EventEmitter {
  private process: ChildProcess | null = null;
  private taskId: string;
  private workingDirectory: string;
  private steps: Map<number, AgentStep> = new Map();
  private currentStep: number = 0;
  private isRunning: boolean = false;
  private outputBuffer: string = '';
  private startTime: number = 0;
  private maxIterations: number = 20;
  private sendNotification?: (message: string) => Promise<void>;

  constructor(taskId: string, workingDirectory: string = process.cwd()) {
    super();
    this.taskId = taskId;
    this.workingDirectory = workingDirectory;
  }

  /**
   * Set Discord notification handler
   */
  setNotificationHandler(handler: (message: string) => Promise<void>): void {
    this.sendNotification = handler;
  }

  /**
   * Send Discord notification (if handler is set)
   */
  private async notify(message: string): Promise<void> {
    if (this.sendNotification) {
      try {
        await this.sendNotification(message);
      } catch (error) {
        logger.error('Failed to send Discord notification', error);
      }
    }
  }

  /**
   * Execute a task with full autonomous capabilities
   */
  async executeTask(task: AgentTask): Promise<AgentResult> {
    this.startTime = Date.now();
    this.isRunning = true;
    this.maxIterations = task.maxIterations || 20;

    logger.info(`🚀 Starting autonomous task: ${task.description}`);
    this.emit('task:started', { taskId: this.taskId, description: task.description });
    await this.notify(`🚀 **Agent Started**\n\`\`\`\nTask: ${task.description}\nAgent ID: ${this.taskId}\n\`\`\``);

    try {
      // Step 1: Initialize and plan
      logger.info('📋 Step 1: Planning task...');
      await this.notify(`📋 **Planning Task**\nAnalyzing requirements and creating execution plan...`);
      await this.planTask(task);
      await this.notify(`✅ **Planning Complete**\nExecution plan created. Starting implementation...`);

      // Step 2: Execute iteratively with feedback
      logger.info('⚙️ Step 2: Executing task iteratively...');
      await this.notify(`⚙️ **Executing Task**\nStarting iterative implementation (max ${this.maxIterations} iterations)...`);
      await this.executeIterative(task);

      // Step 3: Test and verify
      logger.info('🧪 Step 3: Running tests and validation...');
      await this.notify(`🧪 **Running Tests**\nValidating implementation and running test suite...`);
      const testResults = await this.runTests(task);
      
      const passedTests = testResults.filter(t => t.passed).length;
      const failedTests = testResults.length - passedTests;
      await this.notify(`📊 **Test Results**\n✅ Passed: ${passedTests}\n❌ Failed: ${failedTests}`);

      // Step 4: Generate final report
      logger.info('📊 Step 4: Generating final report...');
      const result = await this.generateResult(task, testResults);

      this.isRunning = false;
      const duration = Math.round((Date.now() - this.startTime) / 1000);
      logger.info('✅ Task completed successfully');
      this.emit('task:completed', result);
      await this.notify(`🏁 **Task Complete**\n\`\`\`\nDuration: ${duration}s\nSteps: ${this.currentStep}\nStatus: ${result.success ? 'Success' : 'Failed'}\n\`\`\``);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Task failed: ${errorMessage}`, error);
      
      // Emit detailed error information
      this.emit('error', { 
        taskId: this.taskId, 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      const result: AgentResult = {
        taskId: this.taskId,
        success: false,
        steps: Array.from(this.steps.values()),
        error: errorMessage,
        duration: Date.now() - this.startTime
      };

      this.isRunning = false;
      this.emit('task:failed', result);

      return result;
    }
  }

  /**
   * Step 1: Create execution plan with Claude Code
   */
  private async planTask(task: AgentTask): Promise<void> {
    const step = this.createStep('Planning task execution');

    const planningPrompt = `Analyze this task and create a detailed execution plan:

TASK: ${task.description}

${task.contextFiles ? `CONTEXT FILES:\n${task.contextFiles.join('\n')}` : ''}
${task.requirements ? `REQUIREMENTS:\n${task.requirements.join('\n')}` : ''}

Create a step-by-step plan with:
1. Analysis of what needs to be done
2. File/code changes required
3. Testing strategy
4. Potential issues to watch for

Provide ONLY the plan in JSON format:
{
  "analysis": "brief analysis",
  "steps": ["step 1", "step 2", ...],
  "testing": ["test approach 1", ...],
  "risks": ["risk 1", ...]
}`;

    try {
      const planOutput = await this.runClaudeCode(planningPrompt, {
        streamOutput: true,
        autoConfirm: true
      });

      step.output = planOutput;
      step.status = 'completed';

      // Parse the plan
      const planMatch = planOutput.match(/\{[\s\S]*\}/);
      if (planMatch) {
        const plan = JSON.parse(planMatch[0]);
        step.nextSteps = plan.steps;
        logger.info(`📋 Plan created with ${plan.steps.length} steps`);
      }

    } catch (error) {
      step.status = 'failed';
      step.output = error instanceof Error ? error.message : 'Planning failed';
      throw error;
    }
  }

  /**
   * Step 2: Execute iteratively with autonomous decision-making
   */
  private async executeIterative(task: AgentTask): Promise<void> {
    let iteration = 0;
    let shouldContinue = true;

    while (shouldContinue && iteration < this.maxIterations) {
      iteration++;
      logger.info(`🔄 Iteration ${iteration}/${this.maxIterations}`);
      await this.notify(`🔄 **Iteration ${iteration}/${this.maxIterations}**\nExecuting next step...`);

      const step = this.createStep(`Iteration ${iteration}: Execute and analyze`);

      // Notify what we're about to do
      await this.notify(`🤔 **Analyzing current state**\nReviewing previous steps and determining next actions...`);

      // Build context-aware prompt
      const iterativePrompt = this.buildIterativePrompt(task, iteration);

      try {
        await this.notify(`⚡ **Invoking Claude Code Agent**\nProcessing iteration ${iteration} with full context...`);
        
        const output = await this.runClaudeCode(iterativePrompt, {
          streamOutput: true,
          autoConfirm: true,
          onOutput: (data) => this.handleRealtimeOutput(data, step)
        });

        step.output = output;

        // Notify analysis phase
        await this.notify(`📊 **Analyzing Results**\nReviewing output and making decisions...`);

        // Analyze output and make decisions
        const decision = await this.analyzeOutputAndDecide(output, task);
        step.decision = decision.reasoning;
        step.nextSteps = decision.nextSteps;

        if (decision.shouldContinue) {
          step.status = 'completed';
          logger.info(`✅ Iteration ${iteration} completed. Continuing...`);
          
          // Send update with brief output preview and next steps
          const outputPreview = output.length > 300 ? output.substring(0, 300) + '...' : output;
          const nextStepsText = decision.nextSteps.length > 0 
            ? `\n**Next:** ${decision.nextSteps[0]}` 
            : '';
          await this.notify(`✅ **Step ${iteration} Complete**\n\`\`\`\n${outputPreview}\n\`\`\`${nextStepsText}`);
          
          // Add brief thinking update about decision
          await this.notify(`🤔 **Decision:** ${decision.reasoning}`);
        } else {
          step.status = 'completed';
          shouldContinue = false;
          logger.info(`🎯 Task appears complete after ${iteration} iterations`);
          await this.notify(`🎯 **Implementation Complete**\nCompleted after ${iteration} iterations. Moving to testing phase...`);
        }

      } catch (error) {
        step.status = 'failed';
        step.output = error instanceof Error ? error.message : 'Execution failed';
        
        await this.notify(`⚠️ **Error in Iteration ${iteration}**\n\`\`\`\n${step.output}\n\`\`\`\nAttempting recovery...`);

        // Try to recover from errors
        const canRecover = await this.attemptErrorRecovery(error, task);
        if (!canRecover) {
          await this.notify(`❌ **Recovery Failed**\nCannot recover from error. Task failed.`);
          throw error;
        }
        await this.notify(`✅ **Recovered from Error**\nContinuing with next iteration...`);
      }
    }

    if (iteration >= this.maxIterations) {
      logger.warn(`⚠️ Reached maximum iterations (${this.maxIterations})`);
      await this.notify(`⚠️ **Max Iterations Reached**\nCompleted ${this.maxIterations} iterations. Proceeding to validation...`);
    }
  }

  /**
   * Build context-aware prompt for each iteration
   */
  private buildIterativePrompt(task: AgentTask, iteration: number): string {
    const previousSteps = Array.from(this.steps.values())
      .slice(-3)  // Last 3 steps for context
      .map(s => `Step ${s.step}: ${s.action}\nOutput: ${s.output?.slice(0, 500)}...`)
      .join('\n\n');

    return `You are an autonomous coding agent working on this task:

TASK: ${task.description}

ITERATION: ${iteration}

PREVIOUS STEPS:
${previousSteps || 'This is the first iteration'}

📢 CRITICAL NOTIFICATION REQUIREMENT:
⚠️ THE USER CANNOT SEE YOUR TERMINAL OUTPUT! ⚠️
- You MUST send Discord messages with frequent updates about what you're doing
- After EVERY significant action (running commands, reading files, making changes), send a status update to Discord
- Use the SubAgentManager's sendNotification method to post updates
- Include what command you're running and brief results
- The user is NOT watching your terminal - Discord messages are their ONLY visibility

INSTRUCTIONS:
1. Analyze what's been done so far
2. Read any necessary files to understand current state
3. Make required changes to complete the task
4. Run tests if applicable
5. Report your progress TO DISCORD frequently

Remember:
- You have full auto-approval - take action directly
- Read terminal output carefully and adapt your approach
- If you encounter errors, debug and fix them
- Use git to check changes if needed
- Be thorough but efficient
- SEND DISCORD UPDATES FREQUENTLY - this is how the user tracks your progress

IMPORTANT: After each action:
1. Send a Discord message describing what you did and the result
2. Include relevant terminal output in your Discord updates
3. Tell the user whether the task is complete or what's next
4. Make updates concise but informative (2-3 sentences max per update)`;
  }

  /**
   * Analyze output and decide next steps autonomously
   */
  private async analyzeOutputAndDecide(
    output: string,
    task: AgentTask
  ): Promise<{
    shouldContinue: boolean;
    reasoning: string;
    nextSteps: string[];
  }> {
    // Look for completion indicators
    const completionIndicators = [
      /task.*complete/i,
      /successfully.*implemented/i,
      /all.*tests.*pass/i,
      /deployment.*successful/i,
      /no.*errors/i
    ];

    const hasCompletionIndicator = completionIndicators.some(regex =>
      regex.test(output)
    );

    // Look for error indicators
    const errorIndicators = [
      /error:/i,
      /failed/i,
      /exception/i,
      /cannot/i,
      /undefined/i,
      /null.*reference/i
    ];

    const hasError = errorIndicators.some(regex => regex.test(output));

    // Decision logic
    if (hasCompletionIndicator && !hasError) {
      return {
        shouldContinue: false,
        reasoning: 'Task appears complete with success indicators',
        nextSteps: ['Run final validation', 'Generate report']
      };
    }

    if (hasError) {
      return {
        shouldContinue: true,
        reasoning: 'Errors detected - need to debug and fix',
        nextSteps: ['Analyze error', 'Apply fix', 'Re-test']
      };
    }

    // Default: continue with next logical steps
    return {
      shouldContinue: true,
      reasoning: 'Task in progress - continuing execution',
      nextSteps: ['Continue implementation', 'Verify progress']
    };
  }

  /**
   * Attempt to recover from errors autonomously
   */
  private async attemptErrorRecovery(
    error: unknown,
    task: AgentTask
  ): Promise<boolean> {
    logger.info('🔧 Attempting error recovery...');

    const step = this.createStep('Error recovery');

    const errorMessage = error instanceof Error ? error.message : String(error);

    const recoveryPrompt = `An error occurred during task execution:

ERROR: ${errorMessage}

TASK: ${task.description}

Analyze the error and attempt to fix it:
1. Understand what went wrong
2. Identify the root cause
3. Apply a fix
4. Verify the fix works

You have full auto-approval - fix the issue directly.`;

    try {
      const output = await this.runClaudeCode(recoveryPrompt, {
        streamOutput: true,
        autoConfirm: true
      });

      step.output = output;
      step.status = 'completed';

      logger.info('✅ Error recovery successful');
      return true;

    } catch (recoveryError) {
      step.status = 'failed';
      logger.error('❌ Error recovery failed', recoveryError);
      return false;
    }
  }

  /**
   * Step 3: Run tests and validation
   */
  private async runTests(task: AgentTask): Promise<TestResult[]> {
    logger.info('🧪 Running tests and validation...');

    const step = this.createStep('Testing and validation');
    const testResults: TestResult[] = [];

    const testPrompt = `Run comprehensive tests for this task:

TASK: ${task.description}

1. Run any existing test suites (npm test, pytest, etc.)
2. Verify the implementation works as expected
3. Check for edge cases
4. Validate error handling

Provide test results in this format:
TEST: [name]
STATUS: [PASS/FAIL]
OUTPUT: [details]`;

    try {
      const output = await this.runClaudeCode(testPrompt, {
        streamOutput: true,
        autoConfirm: true
      });

      step.output = output;
      step.status = 'completed';

      // Parse test results
      const testMatches = output.matchAll(/TEST: (.+?)\nSTATUS: (PASS|FAIL)\nOUTPUT: (.+?)(?=\nTEST:|$)/gs);

      for (const match of testMatches) {
        testResults.push({
          name: match[1].trim(),
          passed: match[2] === 'PASS',
          output: match[3].trim()
        });
      }

      logger.info(`✅ Testing complete: ${testResults.filter(t => t.passed).length}/${testResults.length} passed`);

    } catch (error) {
      step.status = 'failed';
      logger.error('❌ Testing failed', error);
    }

    return testResults;
  }

  /**
   * Run Claude Code CLI with streaming output
   */
  private async runClaudeCode(
    prompt: string,
    options: {
      streamOutput?: boolean;
      autoConfirm?: boolean;
      onOutput?: (data: string) => void;
    } = {}
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '--settings', path.join(this.workingDirectory, '.claude/settings.json'),
        '--prompt', prompt
      ];

      if (options.autoConfirm) {
        args.push('--yes');
      }

      this.process = spawn('claude', args, {
        cwd: this.workingDirectory,
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          // Ensure proper PATH for CLI tools
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
          // Set home directory for credential access
          HOME: process.env.HOME || require('os').homedir(),
          // Google Cloud SDK config
          CLOUDSDK_CONFIG: process.env.CLOUDSDK_CONFIG || `${require('os').homedir()}/.config/gcloud`,
        }
      });

      let output = '';

      this.process.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;

        if (options.streamOutput) {
          logger.info(chunk);
          this.emit('output', chunk);
        }

        if (options.onOutput) {
          options.onOutput(chunk);
        }
      });

      this.process.stderr?.on('data', (data) => {
        const chunk = data.toString();
        logger.warn(`stderr: ${chunk}`);
        this.emit('error', chunk);
      });

      this.process.on('close', (code) => {
        this.process = null;

        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Claude Code exited with code ${code}`));
        }
      });

      this.process.on('error', (error) => {
        this.process = null;
        reject(error);
      });
    });
  }

  /**
   * Handle real-time output during execution
   */
  private async handleRealtimeOutput(data: string, step: AgentStep): Promise<void> {
    this.outputBuffer += data;

    // Look for important patterns in real-time and notify
    if (data.includes('error') || data.includes('Error')) {
      logger.warn('⚠️ Error detected in output');
      this.emit('warning', { type: 'error_detected', data });
      await this.notify(`⚠️ **Error Detected**\nProcessing error in real-time...`);
    }

    if (data.includes('test') && data.includes('pass')) {
      logger.info('✅ Test passed');
      this.emit('test:passed', data);
      await this.notify(`✅ **Test Passed**\nValidation successful`);
    }

    if (data.includes('Writing') || data.includes('Created')) {
      logger.info('📝 File modification detected');
      this.emit('file:modified', data);
      // Extract filename if possible
      const fileMatch = data.match(/(?:Writing|Created)\s+([^\s]+)/);
      const filename = fileMatch ? fileMatch[1] : 'file';
      await this.notify(`✍️ **Writing File:** \`${filename}\``);
    }

    if (data.includes('Reading') || data.includes('Opening')) {
      const fileMatch = data.match(/(?:Reading|Opening)\s+([^\s]+)/);
      const filename = fileMatch ? fileMatch[1] : 'file';
      await this.notify(`📖 **Reading File:** \`${filename}\``);
    }

    if (data.includes('Running') || data.includes('Executing')) {
      const cmdMatch = data.match(/(?:Running|Executing)\s+([^\n]+)/);
      const command = cmdMatch ? cmdMatch[1].substring(0, 100) : 'command';
      await this.notify(`🔧 **Running Command:** \`${command}\``);
    }

    if (data.includes('Installing') || data.includes('npm install')) {
      await this.notify(`📦 **Installing Dependencies**\nInstalling required packages...`);
    }

    if (data.includes('git commit') || data.includes('Committing')) {
      await this.notify(`💾 **Committing Changes**\nSaving changes to git...`);
    }
  }

  /**
   * Generate final result report
   */
  private async generateResult(
    task: AgentTask,
    testResults: TestResult[]
  ): Promise<AgentResult> {
    const duration = Date.now() - this.startTime;
    const allTestsPassed = testResults.length === 0 || testResults.every(t => t.passed);
    const success = allTestsPassed && this.steps.get(this.steps.size - 1)?.status === 'completed';

    const result: AgentResult = {
      taskId: this.taskId,
      success,
      steps: Array.from(this.steps.values()),
      testResults,
      duration,
      finalOutput: this.outputBuffer
    };

    logger.info(`
╔════════════════════════════════════════════════════════════╗
║                    TASK COMPLETE                           ║
╠════════════════════════════════════════════════════════════╣
║ Task: ${task.description.slice(0, 40).padEnd(40)} ║
║ Status: ${(success ? '✅ SUCCESS' : '❌ FAILED').padEnd(40)} ║
║ Duration: ${(duration / 1000).toFixed(2)}s${' '.repeat(44 - (duration / 1000).toFixed(2).length)} ║
║ Steps: ${this.steps.size.toString().padEnd(40)} ║
║ Tests: ${testResults.length > 0 ? `${testResults.filter(t => t.passed).length}/${testResults.length} passed` : 'N/A'} ║
╚════════════════════════════════════════════════════════════╝
    `);

    return result;
  }

  /**
   * Create a new step in the execution flow
   */
  private createStep(action: string): AgentStep {
    this.currentStep++;

    const step: AgentStep = {
      step: this.currentStep,
      action,
      status: 'running',
      timestamp: new Date()
    };

    this.steps.set(this.currentStep, step);
    this.emit('step:started', step);

    return step;
  }

  /**
   * Terminate the agent
   */
  async terminate(): Promise<void> {
    this.isRunning = false;

    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }

    logger.info(`Agent ${this.taskId} terminated`);
    this.emit('terminated');
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      taskId: this.taskId,
      isRunning: this.isRunning,
      currentStep: this.currentStep,
      totalSteps: this.steps.size,
      workingDirectory: this.workingDirectory
    };
  }
}
