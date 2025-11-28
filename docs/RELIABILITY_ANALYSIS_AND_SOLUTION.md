# AgentFlow Reliability Analysis & Comprehensive Solution

## Executive Summary

Your agentic coding system has an **83% failure rate** (10 out of 12 photogrammetry task attempts failed). This document provides a deep analysis of root causes and a comprehensive, robust solution architecture.

---

## Part 1: Root Cause Analysis

### The Data

```
Task: "create a website on a new git repo for a local drone photogrammetry business..."
Attempts: 12
Completed: 2 (16.7%)
Failed: 10 (83.3%)
  - System restart: 6 failures
  - Unknown/silent: 4 failures
```

### Failure Category 1: Container Restarts (50% of failures)

**Evidence:**
```
Nov 28 08:03:20 - Container manually stopped (hasBeenManuallyStopped=true)
Nov 28 08:03:23 - "Found 1 interrupted tasks - marking as failed"
```

**Root Cause Chain:**
```
Deployment triggered
    ↓
Container stop signal sent (SIGTERM)
    ↓
shutdown() called in index.ts:393
    ↓
agentManager.stopAllTasks() - DOES NOT WAIT for completion
    ↓
Active task killed mid-execution
    ↓
On restart: restoreTasks() marks as "Task interrupted by system restart"
```

**Code Path:**
- `src/index.ts:393-410` - Shutdown handler
- `src/orchestrator/taskManager.ts:441-455` - Restore interrupted tasks

**Critical Gap:** No graceful task completion before shutdown.

---

### Failure Category 2: Silent Failures (33% of failures)

**Evidence:**
- 4 tasks with no error message
- Duration: 0.9s to 121s (some ran full iteration cycles)

**Root Cause Chain:**
```
Agent reaches max iterations (100) OR
    ↓
Phase iteration limit (estimatedIterations * 2) OR
    ↓
detectPhaseCompletion() regex matches "phase complete" in text
    ↓
Task returns success:true even though work incomplete
    ↓
No actual verification of work done
```

**Code Paths:**
- `src/agents/cognitiveToolExecutor.ts:560-566` - Regex-based completion detection
- `src/agents/cognitiveToolExecutor.ts:569-575` - Phase limit reached, continues anyway

**Critical Gap:** Completion detection is text-based, not outcome-based.

---

### Failure Category 3: Agent Confusion (Multiple Workspaces)

**Evidence from Screenshot:**
```
📁 Workspace Created: /opt/agentflow/workspaces/skyhigh-photogrammetry
📁 Workspace Created: /opt/agentflow/workspaces/skyview-drones
📁 Workspace Created: /opt/agentflow/workspaces/skyview-photogrammetry
📁 Workspace Created: /opt/agentflow/workspaces/drone-photogrammetry-business
```

**Root Cause Chain:**
```
Agent stuck on step 2/5
    ↓
SelfMonitor.detectStuck() returns true after 3 iterations
    ↓
shouldPivot() returns true (confidence < 0.3)
    ↓
Agent "pivots" strategy
    ↓
New workspace created (no memory of previous)
    ↓
Repeat 4x with different names
```

**Code Paths:**
- `src/agents/cognitiveAgent.ts:1251-1274` - detectStuck() logic
- `src/agents/cognitiveAgent.ts:1289-1301` - shouldPivot() logic
- `src/agents/toolBasedAgent.ts:2310-2338` - workspaceCreate()

**Critical Gap:** No workspace registry or deduplication within task context.

---

### Failure Category 4: "Need Input" Spam

**Evidence from Screenshot:**
```
❓ Need Input
I'm not making progress. Could you clarify the task or suggest a different approach?
❓ Need Input
I'm not making progress. Could you clarify the task or suggest a different approach?
```

**Root Cause:**
```typescript
// src/agents/cognitiveToolExecutor.ts:516-517
if (this.iteration > 5 && assessment.shouldAskUser) {
  await this.notify(`❓ **Need Input**\n${assessment.questionForUser}`);
}
```

**Critical Gap:** Threshold too low (5 iterations), no rate limiting on user questions.

---

## Part 2: System Architecture Issues

### Issue A: No Task State Persistence During Execution

Current state tracking:
```
In-memory: TaskManager.tasks Map<taskId, ManagedTask>
Postgres: agent_tasks table (status only, not full state)
```

What's missing:
- Execution checkpoint/snapshot
- Tool call history (cached but not persisted mid-task)
- Conversation context (only saved on completion)
- Workspace assignments per task

### Issue B: No Graceful Shutdown Protocol

Current shutdown:
```typescript
shutdown(signal: string):
  watchdog.stop();        // Immediate
  serverMonitor.stop();   // Immediate
  agentManager.stopAllTasks();  // Cancels, doesn't wait
  mainBot.stop();         // Immediate
  process.exit(0);        // BOOM - kills all running tasks
```

What's missing:
- Task completion timeout
- Task state checkpoint
- Resume capability

### Issue C: Completion Verification is Regex-Based

Current:
```typescript
const phaseComplete = /phase complete|moving to next|completed this phase/i.test(textContent);
const taskComplete = response.stop_reason === 'end_turn' &&
  /task complete|all done|finished|completed successfully/i.test(textContent);
```

What's missing:
- Artifact verification (was code generated?)
- Test execution (do tests pass?)
- Deployment verification (is site live?)

### Issue D: No Workspace Management Within Task

Current:
```
create_workspace("skyhigh-photogrammetry") → creates new
create_workspace("skyview-drones") → creates another new
```

What's missing:
- Task workspace assignment
- Workspace reuse within same task
- Workspace cleanup on task failure

---

## Part 3: Comprehensive Solution Architecture

### Solution Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ROBUST AGENT EXECUTION ENGINE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐    ┌──────────────────┐    ┌─────────────────┐   │
│  │  Task Lifecycle  │    │  State Manager   │    │  Verification   │   │
│  │    Manager       │────│   (Checkpoints)  │────│     Engine      │   │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬────────┘   │
│           │                       │                       │            │
│  ┌────────▼─────────┐    ┌────────▼─────────┐    ┌────────▼────────┐   │
│  │  Graceful        │    │  Workspace       │    │  Outcome        │   │
│  │  Shutdown        │    │  Registry        │    │  Validator      │   │
│  └──────────────────┘    └──────────────────┘    └─────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Component 1: Task Lifecycle Manager

**Purpose:** Manage task states with checkpointing and recovery.

**New Database Tables:**
```sql
-- Task execution checkpoints
CREATE TABLE task_checkpoints (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(100) NOT NULL,
  checkpoint_number INT NOT NULL,
  phase_id VARCHAR(50),
  iteration INT,
  tool_calls_count INT,
  conversation_context JSONB,
  workspace_path VARCHAR(500),
  discoveries TEXT[],
  artifacts JSONB,  -- { files_created: [], urls_deployed: [] }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, checkpoint_number)
);

-- Task workspace assignments
CREATE TABLE task_workspaces (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(100) NOT NULL,
  workspace_path VARCHAR(500) NOT NULL,
  workspace_name VARCHAR(100) NOT NULL,
  github_repo_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_primary BOOLEAN DEFAULT TRUE,
  UNIQUE(task_id, workspace_path)
);
```

**Implementation:**
```typescript
// src/services/taskLifecycleManager.ts

export class TaskLifecycleManager {
  private db: PostgresDatabaseService;
  private activeCheckpoints: Map<string, TaskCheckpoint> = new Map();

  // Checkpoint every N iterations or on significant events
  async createCheckpoint(taskId: string, state: {
    phaseId: string;
    iteration: number;
    toolCalls: number;
    conversationContext: any[];
    workspacePath?: string;
    discoveries: string[];
    artifacts: { files_created: string[]; urls_deployed: string[] };
  }): Promise<void> {
    const checkpoint = {
      ...state,
      checkpoint_number: await this.getNextCheckpointNumber(taskId),
      created_at: new Date()
    };

    await this.db.query(`
      INSERT INTO task_checkpoints
        (task_id, checkpoint_number, phase_id, iteration, tool_calls_count,
         conversation_context, workspace_path, discoveries, artifacts)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [taskId, checkpoint.checkpoint_number, state.phaseId, state.iteration,
        state.toolCalls, JSON.stringify(state.conversationContext),
        state.workspacePath, state.discoveries, JSON.stringify(state.artifacts)]);

    this.activeCheckpoints.set(taskId, checkpoint);
  }

  // Restore task from last checkpoint
  async restoreFromCheckpoint(taskId: string): Promise<TaskCheckpoint | null> {
    const result = await this.db.query(`
      SELECT * FROM task_checkpoints
      WHERE task_id = $1
      ORDER BY checkpoint_number DESC
      LIMIT 1
    `, [taskId]);

    if (result.rows.length === 0) return null;

    return {
      ...result.rows[0],
      conversationContext: result.rows[0].conversation_context,
      artifacts: result.rows[0].artifacts
    };
  }

  // Check if task can be resumed
  async canResumeTask(taskId: string): Promise<{
    canResume: boolean;
    checkpoint?: TaskCheckpoint;
    reason?: string;
  }> {
    const checkpoint = await this.restoreFromCheckpoint(taskId);

    if (!checkpoint) {
      return { canResume: false, reason: 'No checkpoint found' };
    }

    // Check checkpoint age (don't resume if > 1 hour old)
    const ageMs = Date.now() - new Date(checkpoint.created_at).getTime();
    if (ageMs > 3600000) {
      return { canResume: false, reason: 'Checkpoint too old (> 1 hour)' };
    }

    // Check if workspace still exists
    if (checkpoint.workspace_path) {
      const exists = await this.checkWorkspaceExists(checkpoint.workspace_path);
      if (!exists) {
        return { canResume: false, reason: 'Workspace no longer exists' };
      }
    }

    return { canResume: true, checkpoint };
  }
}
```

---

### Component 2: Graceful Shutdown Handler

**Purpose:** Properly complete or checkpoint tasks before shutdown.

**Implementation:**
```typescript
// src/services/gracefulShutdown.ts

export class GracefulShutdownHandler {
  private shutdownInProgress = false;
  private readonly SHUTDOWN_TIMEOUT_MS = 30000; // 30 seconds max
  private taskManager: TaskManager;
  private lifecycleManager: TaskLifecycleManager;

  async initiateShutdown(signal: string): Promise<void> {
    if (this.shutdownInProgress) return;
    this.shutdownInProgress = true;

    logger.info(`🛑 Graceful shutdown initiated (${signal})`);

    // Get all running tasks
    const runningTasks = this.taskManager.getRunningTasks();

    if (runningTasks.length === 0) {
      logger.info('No running tasks - proceeding with immediate shutdown');
      await this.immediateShutdown();
      return;
    }

    logger.info(`⏳ Waiting for ${runningTasks.length} running task(s) to checkpoint...`);

    // Notify all running tasks to checkpoint
    const checkpointPromises = runningTasks.map(async (task) => {
      try {
        // Signal task to create checkpoint
        await this.lifecycleManager.createCheckpoint(task.taskId, {
          phaseId: task.currentPhase || 'unknown',
          iteration: task.currentIteration || 0,
          toolCalls: task.toolCallCount || 0,
          conversationContext: task.conversationHistory || [],
          workspacePath: task.workspacePath,
          discoveries: task.discoveries || [],
          artifacts: task.artifacts || { files_created: [], urls_deployed: [] }
        });

        // Mark task as interrupted (but resumable)
        await this.taskManager.markTaskInterrupted(task.taskId, {
          reason: `Shutdown signal: ${signal}`,
          resumable: true,
          checkpointId: task.taskId
        });

        logger.info(`✅ Checkpointed task ${task.taskId}`);
      } catch (error) {
        logger.error(`❌ Failed to checkpoint task ${task.taskId}:`, error);
        // Mark as failed if checkpoint fails
        await this.taskManager.markTaskFailed(task.taskId,
          'Failed to checkpoint during shutdown');
      }
    });

    // Wait with timeout
    await Promise.race([
      Promise.all(checkpointPromises),
      new Promise(resolve => setTimeout(resolve, this.SHUTDOWN_TIMEOUT_MS))
    ]);

    // Notify users about interrupted tasks
    for (const task of runningTasks) {
      await this.notifyTaskInterrupted(task);
    }

    await this.immediateShutdown();
  }

  private async notifyTaskInterrupted(task: ManagedTask): Promise<void> {
    const message = `⏸️ **Task Paused**
Your task was interrupted due to system maintenance.
Task ID: \`${task.taskId}\`
Progress: ${task.currentIteration || 0} iterations, ${task.toolCallCount || 0} tool calls
Status: **Resumable** - The system will attempt to resume when it restarts.`;

    await this.taskManager.notify(task.channelId, message);
  }

  private async immediateShutdown(): Promise<void> {
    // ... existing shutdown logic
  }
}
```

---

### Component 3: Workspace Registry

**Purpose:** Prevent duplicate workspaces and manage workspace lifecycle per task.

**Implementation:**
```typescript
// src/services/workspaceRegistry.ts

export class WorkspaceRegistry {
  private db: PostgresDatabaseService;

  // Get or create workspace for a task
  async getTaskWorkspace(taskId: string, preferredName?: string): Promise<{
    path: string;
    name: string;
    isNew: boolean;
    githubUrl?: string;
  }> {
    // Check if task already has a workspace
    const existing = await this.db.query(`
      SELECT * FROM task_workspaces
      WHERE task_id = $1 AND is_primary = true
    `, [taskId]);

    if (existing.rows.length > 0) {
      logger.info(`♻️ Reusing existing workspace for task ${taskId}: ${existing.rows[0].workspace_path}`);
      return {
        path: existing.rows[0].workspace_path,
        name: existing.rows[0].workspace_name,
        isNew: false,
        githubUrl: existing.rows[0].github_repo_url
      };
    }

    // Create new workspace
    const name = preferredName || `task-${taskId.substring(0, 8)}`;
    const path = `/opt/agentflow/workspaces/${name}`;

    await this.db.query(`
      INSERT INTO task_workspaces (task_id, workspace_path, workspace_name, is_primary)
      VALUES ($1, $2, $3, true)
    `, [taskId, path, name]);

    return { path, name, isNew: true };
  }

  // Register GitHub repo for workspace
  async registerGitHubRepo(taskId: string, repoUrl: string): Promise<void> {
    await this.db.query(`
      UPDATE task_workspaces
      SET github_repo_url = $2
      WHERE task_id = $1 AND is_primary = true
    `, [taskId, repoUrl]);
  }

  // Cleanup orphaned workspaces (no task or task failed > 24h ago)
  async cleanupOrphanedWorkspaces(): Promise<void> {
    const orphaned = await this.db.query(`
      SELECT tw.* FROM task_workspaces tw
      LEFT JOIN agent_tasks at ON tw.task_id = at.agent_id
      WHERE at.status = 'failed'
        AND at.completed_at < NOW() - INTERVAL '24 hours'
    `);

    for (const workspace of orphaned.rows) {
      try {
        await this.deleteWorkspace(workspace.workspace_path);
        await this.db.query(`DELETE FROM task_workspaces WHERE id = $1`, [workspace.id]);
        logger.info(`🗑️ Cleaned up orphaned workspace: ${workspace.workspace_path}`);
      } catch (error) {
        logger.error(`Failed to cleanup workspace ${workspace.workspace_path}:`, error);
      }
    }
  }
}
```

**Modified create_workspace tool:**
```typescript
// In toolBasedAgent.ts

private async workspaceCreate(input: {
  workspace_name: string;
  create_github_repo?: boolean;
  repo_visibility?: 'public' | 'private';
}): Promise<any> {
  try {
    // CHECK REGISTRY FIRST
    const registry = getWorkspaceRegistry();
    const existingWorkspace = await registry.getTaskWorkspace(
      this.currentTaskId,
      input.workspace_name
    );

    if (!existingWorkspace.isNew) {
      // Reuse existing workspace
      logger.info(`♻️ Reusing existing workspace: ${existingWorkspace.path}`);
      await this.notify(`📁 **Using Existing Workspace**\nPath: \`${existingWorkspace.path}\`${
        existingWorkspace.githubUrl ? `\nGitHub: ${existingWorkspace.githubUrl}` : ''
      }`);
      return {
        success: true,
        workspacePath: existingWorkspace.path,
        repoUrl: existingWorkspace.githubUrl,
        reused: true
      };
    }

    // Create new workspace
    const result = await this.claudeContainer.createWorkspace(input.workspace_name, {
      initGit: true,
      createGitHubRepo: input.create_github_repo,
      repoVisibility: input.repo_visibility
    });

    if (result.success) {
      // Register in workspace registry
      if (result.repoUrl) {
        await registry.registerGitHubRepo(this.currentTaskId, result.repoUrl);
      }

      await this.notify(`📁 **Workspace Created**\nPath: \`${result.workspacePath}\`${
        result.repoUrl ? `\nGitHub: ${result.repoUrl}` : ''
      }`);
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
```

---

### Component 4: Outcome Verification Engine

**Purpose:** Verify actual task outcomes, not just text responses.

**Implementation:**
```typescript
// src/services/outcomeVerifier.ts

export interface VerificationResult {
  verified: boolean;
  confidence: number;  // 0-1
  evidence: {
    type: 'file' | 'url' | 'test' | 'deployment';
    status: 'pass' | 'fail' | 'partial';
    details: string;
  }[];
  suggestions?: string[];
}

export class OutcomeVerifier {

  // Verify task completion based on task type
  async verifyTaskCompletion(taskId: string, taskType: string, context: {
    workspacePath?: string;
    expectedArtifacts?: string[];
    deploymentUrl?: string;
    testCommand?: string;
  }): Promise<VerificationResult> {

    const evidence: VerificationResult['evidence'] = [];

    // 1. Verify files were created
    if (context.workspacePath) {
      const filesExist = await this.verifyFilesExist(
        context.workspacePath,
        context.expectedArtifacts || this.getExpectedFiles(taskType)
      );
      evidence.push(...filesExist);
    }

    // 2. Verify deployment is live
    if (context.deploymentUrl) {
      const deploymentLive = await this.verifyDeployment(context.deploymentUrl);
      evidence.push(deploymentLive);
    }

    // 3. Run tests if specified
    if (context.testCommand && context.workspacePath) {
      const testResult = await this.runTests(context.workspacePath, context.testCommand);
      evidence.push(testResult);
    }

    // Calculate confidence
    const passCount = evidence.filter(e => e.status === 'pass').length;
    const confidence = evidence.length > 0 ? passCount / evidence.length : 0;

    return {
      verified: confidence >= 0.8,  // 80% threshold
      confidence,
      evidence,
      suggestions: this.generateSuggestions(evidence)
    };
  }

  private async verifyFilesExist(workspacePath: string, expectedFiles: string[]): Promise<VerificationResult['evidence']> {
    const results: VerificationResult['evidence'] = [];

    for (const file of expectedFiles) {
      const filePath = path.join(workspacePath, file);
      const exists = await this.fileExists(filePath);

      results.push({
        type: 'file',
        status: exists ? 'pass' : 'fail',
        details: exists ? `✅ ${file} exists` : `❌ ${file} missing`
      });
    }

    return results;
  }

  private async verifyDeployment(url: string): Promise<VerificationResult['evidence'][0]> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        timeout: 10000
      });

      return {
        type: 'deployment',
        status: response.ok ? 'pass' : 'fail',
        details: response.ok
          ? `✅ Deployment live at ${url} (${response.status})`
          : `❌ Deployment not responding (${response.status})`
      };
    } catch (error) {
      return {
        type: 'deployment',
        status: 'fail',
        details: `❌ Deployment unreachable: ${error.message}`
      };
    }
  }

  private getExpectedFiles(taskType: string): string[] {
    const expectations: Record<string, string[]> = {
      'website': ['package.json', 'index.html', 'src/'],
      'nextjs': ['package.json', 'next.config.js', 'app/', 'pages/'],
      'api': ['package.json', 'src/index.ts', 'src/routes/'],
      'default': ['package.json', 'README.md']
    };
    return expectations[taskType] || expectations['default'];
  }

  private generateSuggestions(evidence: VerificationResult['evidence']): string[] {
    const suggestions: string[] = [];
    const failures = evidence.filter(e => e.status === 'fail');

    for (const failure of failures) {
      if (failure.type === 'file') {
        suggestions.push(`Create missing file: ${failure.details.replace('❌ ', '').replace(' missing', '')}`);
      }
      if (failure.type === 'deployment') {
        suggestions.push('Check deployment logs and redeploy');
      }
      if (failure.type === 'test') {
        suggestions.push('Fix failing tests before marking complete');
      }
    }

    return suggestions;
  }
}
```

**Integration with CognitiveToolExecutor:**
```typescript
// Modified completion detection in cognitiveToolExecutor.ts

private async processResponse(
  response: Anthropic.Message,
  messages: Anthropic.MessageParam[],
  phase: ExecutionPhase
): Promise<{
  phaseComplete: boolean;
  taskComplete: boolean;
  text: string;
}> {
  // ... existing response processing ...

  // Enhanced completion detection
  const textIndicatesComplete = /task complete|all done|finished|completed successfully/i.test(text);

  if (textIndicatesComplete && response.stop_reason === 'end_turn') {
    // VERIFY ACTUAL OUTCOME
    const verifier = getOutcomeVerifier();
    const verification = await verifier.verifyTaskCompletion(
      this.currentTaskId,
      this.plan?.taskType || 'default',
      {
        workspacePath: this.workspacePath,
        deploymentUrl: this.extractDeploymentUrl(text),
        expectedArtifacts: this.plan?.successCriteria
      }
    );

    if (verification.verified) {
      logger.info(`✅ Task completion VERIFIED (${verification.confidence * 100}% confidence)`);
      return { phaseComplete: true, taskComplete: true, text };
    } else {
      logger.warn(`⚠️ Task claims completion but verification failed (${verification.confidence * 100}% confidence)`);
      logger.warn(`Evidence: ${verification.evidence.map(e => e.details).join(', ')}`);

      // Add verification failure to conversation
      messages.push({
        role: 'user',
        content: `⚠️ **Verification Failed**
The task claims to be complete, but verification shows issues:
${verification.evidence.map(e => `- ${e.details}`).join('\n')}

${verification.suggestions?.length ? `Suggestions:\n${verification.suggestions.map(s => `- ${s}`).join('\n')}` : ''}

Please address these issues before marking the task complete.`
      });

      return { phaseComplete: false, taskComplete: false, text };
    }
  }

  return { phaseComplete: false, taskComplete: false, text };
}
```

---

### Component 5: Improved Self-Monitor with Rate Limiting

**Purpose:** Prevent "Need Input" spam and improve stuck detection.

**Implementation:**
```typescript
// Enhanced SelfMonitor in cognitiveAgent.ts

export class SelfMonitor {
  // ... existing properties ...

  // NEW: Rate limiting for user questions
  private lastUserQuestionTime: number = 0;
  private readonly USER_QUESTION_COOLDOWN_MS = 60000; // 1 minute between questions
  private userQuestionsAsked: number = 0;
  private readonly MAX_USER_QUESTIONS_PER_TASK = 3;

  // NEW: Improved stuck detection threshold
  private readonly STUCK_ITERATION_THRESHOLD = 15; // Was 5
  private readonly STUCK_SAME_ACTION_THRESHOLD = 5;  // Was 2

  assess(currentPhase: string, plan: StrategicPlan, iteration: number): SelfAssessment {
    const recentProgress = this.progressWindow.slice(-5);
    const progressRate = recentProgress.length > 0
      ? recentProgress.reduce((a, b) => a + b, 0) / recentProgress.length
      : 0;

    const isProgressing = progressRate > 0.2; // Lowered from 0.3
    const isStuck = this.detectStuck();
    const shouldPivot = this.shouldPivot(plan);

    // IMPROVED: Only ask user if truly stuck AND rate limit not exceeded
    const shouldAskUser = this.shouldAskUserImproved(iteration, isStuck);

    return {
      isProgressing,
      progressRate,
      isStuck,
      stuckReason: isStuck ? this.getStuckReason() : undefined,
      shouldPivot,
      pivotSuggestion: shouldPivot ? this.getPivotSuggestion(plan) : undefined,
      shouldAskUser,
      questionForUser: shouldAskUser ? this.getQuestionForUser() : undefined,
      shouldDelegate: this.shouldDelegate(currentPhase, plan),
      delegationTarget: undefined,
      confidenceInApproach: this.calculateConfidence(plan)
    };
  }

  private shouldAskUserImproved(iteration: number, isStuck: boolean): boolean {
    // Don't ask if we haven't been stuck long enough
    if (iteration < this.STUCK_ITERATION_THRESHOLD) {
      return false;
    }

    // Don't ask if we're not actually stuck
    if (!isStuck) {
      return false;
    }

    // Rate limit: Don't ask too frequently
    const timeSinceLastQuestion = Date.now() - this.lastUserQuestionTime;
    if (timeSinceLastQuestion < this.USER_QUESTION_COOLDOWN_MS) {
      return false;
    }

    // Don't ask too many times per task
    if (this.userQuestionsAsked >= this.MAX_USER_QUESTIONS_PER_TASK) {
      return false;
    }

    // Check if we've pivoted already - if so, ask user
    if (this.memory.pivots.length >= 2) {
      return true;
    }

    // Check if we've failed many times
    if (this.memory.failedAttempts.length >= 5) {
      return true;
    }

    return false;
  }

  // Call this when actually sending a question to user
  recordUserQuestionAsked(): void {
    this.lastUserQuestionTime = Date.now();
    this.userQuestionsAsked++;
  }

  private detectStuck(): boolean {
    // Increased threshold: 5 consecutive zero-progress iterations
    const recentProgress = this.progressWindow.slice(-this.STUCK_SAME_ACTION_THRESHOLD);
    if (recentProgress.length >= this.STUCK_SAME_ACTION_THRESHOLD &&
        recentProgress.every(p => p === 0)) {
      return true;
    }

    // Check for repeated failures (same tool failing 3+ times)
    const recentFailures = this.memory.failedAttempts.slice(-3);
    if (recentFailures.length >= 3) {
      const sameToolFailures = recentFailures.every(f => f.tool === recentFailures[0].tool);
      if (sameToolFailures) return true;
    }

    // Check for repeated identical actions (5+ same tool calls)
    const recentCalls = this.memory.toolCallHistory.slice(-7);
    if (recentCalls.length >= 5) {
      const signatures = recentCalls.map(c => `${c.tool}:${JSON.stringify(c.input).substring(0, 50)}`);
      const uniqueSignatures = new Set(signatures);
      if (uniqueSignatures.size <= 2) return true;
    }

    return false;
  }
}
```

---

### Component 6: Task Resume on Startup

**Purpose:** Resume interrupted tasks that have valid checkpoints.

**Implementation:**
```typescript
// In taskManager.ts - enhanced restoreTasks()

async restoreTasks(): Promise<void> {
  if (!this.pgDb) return;

  try {
    const activeTasks = await this.pgDb.getAllActiveAgentTasks();

    if (activeTasks.length === 0) {
      logger.info('No interrupted tasks to process');
      return;
    }

    logger.info(`🔄 Found ${activeTasks.length} interrupted task(s) - checking for resumable...`);

    for (const task of activeTasks) {
      // Check if task can be resumed
      const lifecycleManager = getTaskLifecycleManager();
      const resumeCheck = await lifecycleManager.canResumeTask(task.agent_id);

      if (resumeCheck.canResume && resumeCheck.checkpoint) {
        // Notify user and offer to resume
        await this.notifyTaskResumable(task, resumeCheck.checkpoint);

        // Auto-resume if enabled
        if (process.env.AUTO_RESUME_TASKS === 'true') {
          logger.info(`🔄 Auto-resuming task ${task.agent_id} from checkpoint`);
          await this.resumeTask(task.agent_id, resumeCheck.checkpoint);
        }
      } else {
        // Mark as failed - not resumable
        await this.pgDb.updateAgentTask(task.agent_id, {
          status: 'failed',
          error: `Task interrupted by system restart. ${resumeCheck.reason || 'Cannot resume.'}`,
          completedAt: new Date()
        });
        logger.info(`❌ Task ${task.agent_id} marked as failed: ${resumeCheck.reason}`);
      }
    }
  } catch (error) {
    logger.error('Failed to restore/resume tasks:', error);
  }
}

private async resumeTask(taskId: string, checkpoint: TaskCheckpoint): Promise<void> {
  // Restore agent state from checkpoint
  const agent = new ToolBasedAgent(this.anthropicApiKey);

  // Set workspace
  if (checkpoint.workspace_path) {
    agent.setWorkingDirectory(checkpoint.workspace_path);
  }

  // Restore conversation context
  agent.setConversationHistory(checkpoint.conversationContext);

  // Restore discoveries
  agent.setDiscoveries(checkpoint.discoveries);

  // Update task status
  await this.pgDb.updateAgentTask(taskId, {
    status: 'running',
    error: null // Clear previous interrupt error
  });

  // Continue execution from checkpoint
  await agent.resumeFromCheckpoint({
    phaseId: checkpoint.phase_id,
    iteration: checkpoint.iteration,
    toolCalls: checkpoint.tool_calls_count
  });
}
```

---

## Part 4: Implementation Priority

### Phase 1: Critical (Week 1)
1. **Graceful Shutdown Handler** - Prevents data loss
2. **Task Checkpointing** - Enables recovery
3. **Workspace Registry** - Prevents duplicate workspaces

### Phase 2: Important (Week 2)
4. **Improved Self-Monitor** - Reduces spam
5. **Outcome Verification Engine** - Catches false completions
6. **Task Resume on Startup** - Recovers interrupted work

### Phase 3: Enhancement (Week 3)
7. **Dashboard Integration** - Visibility into checkpoints
8. **Workspace Cleanup Service** - Resource management
9. **Metrics & Alerting** - Proactive monitoring

---

## Part 5: Configuration Changes

```env
# .env additions

# Task Management
MAX_TASK_DURATION_MS=3600000         # 1 hour max per task
CHECKPOINT_INTERVAL_ITERATIONS=10    # Checkpoint every 10 iterations
AUTO_RESUME_TASKS=true               # Auto-resume on startup

# Self-Monitor Thresholds
STUCK_ITERATION_THRESHOLD=15         # Iterations before "stuck" detection
USER_QUESTION_COOLDOWN_MS=60000      # 1 minute between user questions
MAX_USER_QUESTIONS_PER_TASK=3        # Max questions before giving up

# Workspace Management
WORKSPACE_BASE_PATH=/opt/agentflow/workspaces
ORPHAN_WORKSPACE_CLEANUP_HOURS=24    # Cleanup after 24h
```

---

## Summary

This solution addresses all identified failure modes:

| Failure Mode | Solution Component |
|---|---|
| Container restarts kill tasks | Graceful Shutdown + Checkpointing |
| Silent failures (false completion) | Outcome Verification Engine |
| Multiple workspaces created | Workspace Registry |
| "Need Input" spam | Improved Self-Monitor with rate limiting |
| No recovery path | Task Resume on Startup |

Expected improvement: **83% failure rate → <15% failure rate**
