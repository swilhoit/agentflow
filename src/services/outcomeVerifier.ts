import { logger } from '../utils/logger';
import { PostgresDatabaseService } from './postgresDatabaseService';
import { getAgentFlowDatabase, isUsingPostgres } from './databaseFactory';
import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Evidence item from verification
 */
export interface VerificationEvidence {
  type: 'file' | 'url' | 'test' | 'deployment' | 'git' | 'build';
  status: 'pass' | 'fail' | 'partial' | 'skipped';
  details: string;
  metadata?: Record<string, any>;
}

/**
 * Verification result
 */
export interface VerificationResult {
  verified: boolean;
  confidence: number;  // 0.0 to 1.0
  evidence: VerificationEvidence[];
  suggestions: string[];
  summary: string;
}

/**
 * Task verification context
 */
export interface VerificationContext {
  workspacePath?: string;
  deploymentUrl?: string;
  expectedFiles?: string[];
  testCommand?: string;
  buildCommand?: string;
  expectedArtifacts?: string[];
  gitRepoUrl?: string;
  taskType?: string;
}

/**
 * OutcomeVerifier Configuration
 */
export interface OutcomeVerifierConfig {
  hetznerServerIp?: string;
  deploymentCheckTimeout: number;  // ms
  testTimeout: number;             // ms
  confidenceThreshold: number;     // Required confidence for verification
  skipFailedChecks: boolean;       // Continue verification even if some checks fail
}

const DEFAULT_CONFIG: OutcomeVerifierConfig = {
  hetznerServerIp: process.env.HETZNER_SERVER_IP || '178.156.198.233',
  deploymentCheckTimeout: 15000,
  testTimeout: 60000,
  confidenceThreshold: 0.7,
  skipFailedChecks: true
};

/**
 * Expected files for different task types
 */
const EXPECTED_FILES: Record<string, string[]> = {
  'website': ['package.json', 'index.html'],
  'nextjs': ['package.json', 'next.config.js', 'app/page.tsx'],
  'nextjs-alt': ['package.json', 'next.config.mjs', 'app/page.tsx'],
  'react': ['package.json', 'src/App.tsx', 'src/index.tsx'],
  'api': ['package.json', 'src/index.ts'],
  'node': ['package.json', 'src/index.js'],
  'python': ['requirements.txt', 'main.py'],
  'default': ['package.json', 'README.md']
};

/**
 * OutcomeVerifier - Verifies actual task outcomes, not just text responses
 *
 * Verifies:
 * - Files were created
 * - Deployment is live
 * - Tests pass
 * - Build succeeds
 * - Git commits exist
 *
 * Prevents:
 * - False completion claims
 * - Tasks marked complete without actual work
 */
export class OutcomeVerifier {
  private db: PostgresDatabaseService | null = null;
  private config: OutcomeVerifierConfig;

  constructor(config: Partial<OutcomeVerifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (isUsingPostgres()) {
      this.db = getAgentFlowDatabase();
    }
  }

  /**
   * Verify task completion
   */
  async verifyTaskCompletion(
    taskId: string,
    context: VerificationContext
  ): Promise<VerificationResult> {
    logger.info(`🔍 Verifying task completion for ${taskId}...`);

    const evidence: VerificationEvidence[] = [];
    const suggestions: string[] = [];

    // 1. Verify files exist
    if (context.workspacePath) {
      const fileEvidence = await this.verifyFiles(
        context.workspacePath,
        context.expectedFiles || this.getExpectedFiles(context.taskType)
      );
      evidence.push(...fileEvidence);
    }

    // 2. Verify deployment is live
    if (context.deploymentUrl) {
      const deploymentEvidence = await this.verifyDeployment(context.deploymentUrl);
      evidence.push(deploymentEvidence);
    }

    // 3. Verify build succeeds
    if (context.workspacePath && context.buildCommand) {
      const buildEvidence = await this.verifyBuild(
        context.workspacePath,
        context.buildCommand
      );
      evidence.push(buildEvidence);
    }

    // 4. Verify tests pass
    if (context.workspacePath && context.testCommand) {
      const testEvidence = await this.verifyTests(
        context.workspacePath,
        context.testCommand
      );
      evidence.push(testEvidence);
    }

    // 5. Verify git commits
    if (context.workspacePath) {
      const gitEvidence = await this.verifyGitCommits(context.workspacePath);
      evidence.push(gitEvidence);
    }

    // Calculate confidence and generate suggestions
    const { confidence, verificationSuggestions } = this.calculateConfidence(evidence);
    suggestions.push(...verificationSuggestions);

    const verified = confidence >= this.config.confidenceThreshold;

    // Generate summary
    const passCount = evidence.filter(e => e.status === 'pass').length;
    const failCount = evidence.filter(e => e.status === 'fail').length;
    const summary = verified
      ? `✅ Verification passed (${(confidence * 100).toFixed(0)}% confidence, ${passCount}/${evidence.length} checks passed)`
      : `❌ Verification failed (${(confidence * 100).toFixed(0)}% confidence, ${failCount}/${evidence.length} checks failed)`;

    const result: VerificationResult = {
      verified,
      confidence,
      evidence,
      suggestions,
      summary
    };

    // Save verification to database
    await this.saveVerification(taskId, result);

    logger.info(`🔍 Verification complete: ${summary}`);
    return result;
  }

  /**
   * Verify files exist in workspace
   */
  private async verifyFiles(
    workspacePath: string,
    expectedFiles: string[]
  ): Promise<VerificationEvidence[]> {
    const evidence: VerificationEvidence[] = [];

    for (const file of expectedFiles) {
      try {
        const filePath = path.join(workspacePath, file);
        const exists = await this.fileExists(filePath);

        evidence.push({
          type: 'file',
          status: exists ? 'pass' : 'fail',
          details: exists ? `✅ ${file} exists` : `❌ ${file} missing`,
          metadata: { file, workspacePath }
        });
      } catch (error) {
        evidence.push({
          type: 'file',
          status: 'fail',
          details: `❌ Failed to check ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: { file, workspacePath, error: String(error) }
        });
      }
    }

    return evidence;
  }

  /**
   * Verify deployment is live
   */
  private async verifyDeployment(url: string): Promise<VerificationEvidence> {
    try {
      // Use curl for deployment check (works in both local and container)
      const cmd = `curl -s -o /dev/null -w "%{http_code}" --max-time ${this.config.deploymentCheckTimeout / 1000} "${url}"`;
      const statusCode = execSync(cmd, { encoding: 'utf-8', timeout: this.config.deploymentCheckTimeout }).trim();

      const isLive = statusCode.startsWith('2') || statusCode === '301' || statusCode === '302';

      return {
        type: 'deployment',
        status: isLive ? 'pass' : 'fail',
        details: isLive
          ? `✅ Deployment live at ${url} (HTTP ${statusCode})`
          : `❌ Deployment not responding at ${url} (HTTP ${statusCode})`,
        metadata: { url, statusCode }
      };
    } catch (error) {
      return {
        type: 'deployment',
        status: 'fail',
        details: `❌ Deployment unreachable: ${error instanceof Error ? error.message : 'Timeout'}`,
        metadata: { url, error: String(error) }
      };
    }
  }

  /**
   * Verify build succeeds
   */
  private async verifyBuild(
    workspacePath: string,
    buildCommand: string = 'npm run build'
  ): Promise<VerificationEvidence> {
    try {
      const cmd = this.config.hetznerServerIp
        ? `ssh root@${this.config.hetznerServerIp} "cd '${workspacePath}' && ${buildCommand} 2>&1"`
        : `cd "${workspacePath}" && ${buildCommand} 2>&1`;

      const output = execSync(cmd, {
        encoding: 'utf-8',
        timeout: this.config.testTimeout
      });

      // Check for common error patterns
      const hasError = /error|failed|ERR!/i.test(output) && !/0 errors/i.test(output);

      return {
        type: 'build',
        status: hasError ? 'fail' : 'pass',
        details: hasError
          ? `❌ Build failed - check logs`
          : `✅ Build succeeded`,
        metadata: { workspacePath, buildCommand, outputSample: output.substring(0, 500) }
      };
    } catch (error) {
      return {
        type: 'build',
        status: 'fail',
        details: `❌ Build command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { workspacePath, buildCommand, error: String(error) }
      };
    }
  }

  /**
   * Verify tests pass
   */
  private async verifyTests(
    workspacePath: string,
    testCommand: string = 'npm test'
  ): Promise<VerificationEvidence> {
    try {
      const cmd = this.config.hetznerServerIp
        ? `ssh root@${this.config.hetznerServerIp} "cd '${workspacePath}' && ${testCommand} 2>&1 || true"`
        : `cd "${workspacePath}" && ${testCommand} 2>&1 || true`;

      const output = execSync(cmd, {
        encoding: 'utf-8',
        timeout: this.config.testTimeout
      });

      // Parse test results
      const passMatch = output.match(/(\d+)\s*(passing|passed|tests?\s+passed)/i);
      const failMatch = output.match(/(\d+)\s*(failing|failed|tests?\s+failed)/i);

      const passed = parseInt(passMatch?.[1] || '0');
      const failed = parseInt(failMatch?.[1] || '0');

      if (passed === 0 && failed === 0) {
        // No tests found
        return {
          type: 'test',
          status: 'skipped',
          details: `⏭️ No tests found or test output not parseable`,
          metadata: { workspacePath, testCommand }
        };
      }

      const allPassed = failed === 0;
      return {
        type: 'test',
        status: allPassed ? 'pass' : 'fail',
        details: allPassed
          ? `✅ All ${passed} tests passed`
          : `❌ ${failed}/${passed + failed} tests failed`,
        metadata: { workspacePath, testCommand, passed, failed }
      };
    } catch (error) {
      return {
        type: 'test',
        status: 'fail',
        details: `❌ Test command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { workspacePath, testCommand, error: String(error) }
      };
    }
  }

  /**
   * Verify git commits exist
   */
  private async verifyGitCommits(workspacePath: string): Promise<VerificationEvidence> {
    try {
      const cmd = this.config.hetznerServerIp
        ? `ssh root@${this.config.hetznerServerIp} "cd '${workspacePath}' && git log --oneline -n 5 2>&1 || echo 'NO_GIT'"`
        : `cd "${workspacePath}" && git log --oneline -n 5 2>&1 || echo 'NO_GIT'`;

      const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim();

      if (output === 'NO_GIT' || output.includes('not a git repository')) {
        return {
          type: 'git',
          status: 'fail',
          details: `❌ Not a git repository`,
          metadata: { workspacePath }
        };
      }

      const commitCount = output.split('\n').filter(line => line.trim()).length;

      return {
        type: 'git',
        status: commitCount > 0 ? 'pass' : 'partial',
        details: commitCount > 0
          ? `✅ ${commitCount} commit(s) found`
          : `⚠️ Git initialized but no commits`,
        metadata: { workspacePath, commitCount, recentCommits: output.split('\n').slice(0, 3) }
      };
    } catch (error) {
      return {
        type: 'git',
        status: 'fail',
        details: `❌ Git check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { workspacePath, error: String(error) }
      };
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      if (this.config.hetznerServerIp && filePath.startsWith('/opt/agentflow')) {
        const cmd = `ssh root@${this.config.hetznerServerIp} "test -e '${filePath}' && echo 'exists'"`;
        const result = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
        return result.trim() === 'exists';
      } else {
        const { existsSync } = await import('fs');
        return existsSync(filePath);
      }
    } catch {
      return false;
    }
  }

  /**
   * Get expected files for task type
   */
  private getExpectedFiles(taskType?: string): string[] {
    if (!taskType) return EXPECTED_FILES['default'];

    const type = taskType.toLowerCase();

    // Check for exact match
    if (EXPECTED_FILES[type]) {
      return EXPECTED_FILES[type];
    }

    // Check for partial match
    for (const [key, files] of Object.entries(EXPECTED_FILES)) {
      if (type.includes(key) || key.includes(type)) {
        return files;
      }
    }

    return EXPECTED_FILES['default'];
  }

  /**
   * Calculate confidence score from evidence
   */
  private calculateConfidence(evidence: VerificationEvidence[]): {
    confidence: number;
    verificationSuggestions: string[];
  } {
    const suggestions: string[] = [];

    if (evidence.length === 0) {
      return { confidence: 0, verificationSuggestions: ['No verification checks were performed'] };
    }

    // Weight different evidence types
    const weights: Record<VerificationEvidence['type'], number> = {
      file: 1.0,
      deployment: 1.5,
      test: 1.2,
      build: 1.3,
      git: 0.8,
      url: 1.0
    };

    let totalWeight = 0;
    let passedWeight = 0;

    for (const item of evidence) {
      const weight = weights[item.type] || 1.0;
      totalWeight += weight;

      if (item.status === 'pass') {
        passedWeight += weight;
      } else if (item.status === 'partial') {
        passedWeight += weight * 0.5;
      } else if (item.status === 'fail') {
        // Generate suggestions for failures
        suggestions.push(this.getSuggestionForFailure(item));
      }
      // 'skipped' items don't count against
    }

    const confidence = totalWeight > 0 ? passedWeight / totalWeight : 0;

    return {
      confidence: Math.round(confidence * 100) / 100,
      verificationSuggestions: suggestions
    };
  }

  /**
   * Generate suggestion for a failed check
   */
  private getSuggestionForFailure(evidence: VerificationEvidence): string {
    switch (evidence.type) {
      case 'file':
        return `Create missing file: ${evidence.metadata?.file || 'unknown'}`;
      case 'deployment':
        return `Check deployment logs and ensure the site is deployed correctly`;
      case 'test':
        return `Fix failing tests before marking task complete`;
      case 'build':
        return `Fix build errors and ensure project compiles`;
      case 'git':
        return `Initialize git and commit changes`;
      default:
        return `Address issue: ${evidence.details}`;
    }
  }

  /**
   * Save verification result to database
   */
  private async saveVerification(taskId: string, result: VerificationResult): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.query(`
        INSERT INTO task_verifications
          (task_id, verification_type, verified, confidence, evidence, suggestions)
        VALUES ($1, 'completion', $2, $3, $4, $5)
      `, [
        taskId,
        result.verified,
        result.confidence,
        JSON.stringify(result.evidence),
        result.suggestions
      ]);
    } catch (error) {
      logger.error(`Failed to save verification for ${taskId}:`, error);
    }
  }

  /**
   * Quick verification - just check if minimum criteria met
   */
  async quickVerify(
    taskId: string,
    workspacePath: string,
    taskType?: string
  ): Promise<boolean> {
    const expectedFiles = this.getExpectedFiles(taskType);
    const primaryFile = expectedFiles[0];  // Usually package.json or similar

    try {
      const exists = await this.fileExists(path.join(workspacePath, primaryFile));
      logger.debug(`Quick verify for ${taskId}: ${primaryFile} exists = ${exists}`);
      return exists;
    } catch {
      return false;
    }
  }

  /**
   * Extract deployment URL from text
   */
  extractDeploymentUrl(text: string): string | undefined {
    // Match common deployment URLs
    const patterns = [
      /https?:\/\/[a-zA-Z0-9-]+\.vercel\.app\/?/gi,
      /https?:\/\/[a-zA-Z0-9-]+\.netlify\.app\/?/gi,
      /https?:\/\/[a-zA-Z0-9-]+\.herokuapp\.com\/?/gi,
      /https?:\/\/[a-zA-Z0-9-]+\.railway\.app\/?/gi,
      /deployed\s+(?:to|at)\s+(https?:\/\/[^\s]+)/gi
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].replace(/deployed\s+(?:to|at)\s+/i, '');
      }
    }

    return undefined;
  }
}

// Singleton instance
let outcomeVerifierInstance: OutcomeVerifier | null = null;

export function getOutcomeVerifier(): OutcomeVerifier {
  if (!outcomeVerifierInstance) {
    outcomeVerifierInstance = new OutcomeVerifier();
  }
  return outcomeVerifierInstance;
}

export function initializeOutcomeVerifier(config?: Partial<OutcomeVerifierConfig>): OutcomeVerifier {
  outcomeVerifierInstance = new OutcomeVerifier(config);
  return outcomeVerifierInstance;
}
