import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

/**
 * Retry configuration for network operations
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2
};

/**
 * Sleep helper for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, config.maxDelayMs);
}

export interface ClaudeContainerConfig {
  containerId?: string;
  serverIp: string;
  sshUser: string;
  workspacePath?: string;
  anthropicApiKey: string;
  maxIterations?: number;
  timeout?: number;
}

export interface ClaudeTaskResult {
  success: boolean;
  output: string;
  error?: string;
  containerId: string;
  duration: number;
  exitCode?: number;
}

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  created: string;
  task?: string;
}

/**
 * ClaudeContainerService - Manages Claude Code containers on Hetzner VPS
 *
 * Spawns isolated Docker containers running Claude Code in YOLO mode
 * with --dangerously-skip-permissions for fully autonomous execution.
 */
export class ClaudeContainerService extends EventEmitter {
  private serverIp: string;
  private sshUser: string;
  private sshKeyPath: string;
  private anthropicApiKey: string;
  private githubToken: string;
  private vercelToken: string;
  private activeContainers: Map<string, ChildProcess> = new Map();
  private containerOutputBuffers: Map<string, string> = new Map();

  // SSH Connection Pool settings
  private sshControlPath: string;
  private sshMasterProcess: ChildProcess | null = null;
  private sshPoolInitialized: boolean = false;
  private sshPoolInitializing: Promise<void> | null = null;

  // Retry configuration
  private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;

  // Image name for Claude Code containers
  private readonly IMAGE_NAME = 'agentflow-claude-code:latest';
  private readonly CONTAINER_PREFIX = 'claude-agent-';
  private readonly WORKSPACE_BASE = '/opt/agentflow/workspaces';

  constructor(config: {
    serverIp?: string;
    sshUser?: string;
    sshKeyPath?: string;
    anthropicApiKey?: string;
    githubToken?: string;
    vercelToken?: string;
    retryConfig?: Partial<RetryConfig>;
  } = {}) {
    super();
    this.serverIp = config.serverIp || process.env.HETZNER_SERVER_IP || '178.156.198.233';
    this.sshUser = config.sshUser || process.env.HETZNER_SSH_USER || 'root';
    this.sshKeyPath = config.sshKeyPath || process.env.SSH_KEY_PATH || '/root/.ssh/monitor_key';
    this.anthropicApiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '';
    this.githubToken = config.githubToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
    this.vercelToken = config.vercelToken || process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN || '';

    // SSH control socket path for connection multiplexing
    this.sshControlPath = `/tmp/ssh-agentflow-${this.serverIp}-${process.pid}`;

    // Merge custom retry config
    if (config.retryConfig) {
      this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig };
    }
  }

  /**
   * Initialize SSH connection pool (multiplexed master connection)
   * This creates a persistent SSH connection that subsequent commands reuse
   */
  private async initSSHPool(): Promise<void> {
    // Prevent concurrent initialization
    if (this.sshPoolInitializing) {
      return this.sshPoolInitializing;
    }

    if (this.sshPoolInitialized) {
      return;
    }

    this.sshPoolInitializing = (async () => {
      try {
        logger.info(`🔌 Initializing SSH connection pool to ${this.serverIp}...`);

        // Start SSH master connection with ControlMaster
        this.sshMasterProcess = spawn('ssh', [
          '-i', this.sshKeyPath,
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ConnectTimeout=10',
          '-o', 'ServerAliveInterval=30',
          '-o', 'ServerAliveCountMax=3',
          '-o', `ControlMaster=yes`,
          '-o', `ControlPath=${this.sshControlPath}`,
          '-o', 'ControlPersist=300', // Keep connection alive for 5 minutes after last use
          '-N', // Don't execute remote command
          `${this.sshUser}@${this.serverIp}`
        ], {
          stdio: ['ignore', 'ignore', 'pipe']
        });

        // Wait for connection to establish
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('SSH pool initialization timed out'));
          }, 15000);

          this.sshMasterProcess!.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });

          // Check if control socket is created
          const checkSocket = setInterval(async () => {
            try {
              const { stdout } = await execAsync(
                `ssh -o ControlPath=${this.sshControlPath} -O check ${this.sshUser}@${this.serverIp} 2>&1 || true`,
                { timeout: 5000 }
              );
              if (stdout.includes('Master running')) {
                clearInterval(checkSocket);
                clearTimeout(timeout);
                resolve();
              }
            } catch {
              // Still waiting
            }
          }, 500);
        });

        this.sshPoolInitialized = true;
        logger.info(`✅ SSH connection pool initialized (${this.sshControlPath})`);

        // Handle master process exit
        this.sshMasterProcess.on('exit', (code) => {
          logger.warn(`SSH master process exited with code ${code}`);
          this.sshPoolInitialized = false;
          this.sshMasterProcess = null;
        });

      } catch (error) {
        logger.warn(`⚠️ SSH pool initialization failed, falling back to individual connections: ${error}`);
        this.sshPoolInitialized = false;
      } finally {
        this.sshPoolInitializing = null;
      }
    })();

    return this.sshPoolInitializing;
  }

  /**
   * Close SSH connection pool
   */
  async closeSSHPool(): Promise<void> {
    if (this.sshMasterProcess) {
      try {
        // Send exit command to master
        await execAsync(
          `ssh -o ControlPath=${this.sshControlPath} -O exit ${this.sshUser}@${this.serverIp} 2>/dev/null || true`,
          { timeout: 5000 }
        );
      } catch {
        // Force kill if graceful exit fails
        this.sshMasterProcess.kill();
      }
      this.sshMasterProcess = null;
      this.sshPoolInitialized = false;
      logger.info('🔌 SSH connection pool closed');
    }
  }

  /**
   * Execute SSH command on Hetzner VPS with connection pooling and retry
   */
  private async sshExec(
    command: string,
    timeout: number = 300000,
    options: { retry?: boolean; retryConfig?: Partial<RetryConfig> } = {}
  ): Promise<{ stdout: string; stderr: string }> {
    const shouldRetry = options.retry !== false;
    const config = { ...this.retryConfig, ...options.retryConfig };

    // Try to use connection pool
    await this.initSSHPool();

    const executeCommand = async (): Promise<{ stdout: string; stderr: string }> => {
      // Build SSH command - use control socket if pool is available
      let sshArgs = `-o StrictHostKeyChecking=no -o ConnectTimeout=10 -i ${this.sshKeyPath}`;
      if (this.sshPoolInitialized) {
        sshArgs += ` -o ControlPath=${this.sshControlPath}`;
      }

      const sshCommand = `ssh ${sshArgs} ${this.sshUser}@${this.serverIp} "${command.replace(/"/g, '\\"')}"`;
      return execAsync(sshCommand, { timeout });
    };

    // Execute with retry logic
    if (shouldRetry) {
      return this.withRetry(executeCommand, config, `SSH: ${command.substring(0, 50)}...`);
    }

    return executeCommand();
  }

  /**
   * Generic retry wrapper with exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = this.retryConfig,
    operationName: string = 'operation'
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        const errorMsg = lastError.message.toLowerCase();
        const isNonRetryable =
          errorMsg.includes('permission denied') ||
          errorMsg.includes('authentication failed') ||
          errorMsg.includes('no such file') ||
          errorMsg.includes('command not found');

        if (isNonRetryable || attempt === config.maxAttempts) {
          logger.error(`${operationName} failed after ${attempt} attempt(s): ${lastError.message}`);
          throw lastError;
        }

        const delay = calculateBackoff(attempt, config);
        logger.warn(`${operationName} failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${Math.round(delay)}ms: ${lastError.message}`);
        await sleep(delay);
      }
    }

    throw lastError || new Error(`${operationName} failed after ${config.maxAttempts} attempts`);
  }

  /**
   * Execute command with credentials securely (via env file, not command line)
   * This prevents credentials from appearing in process lists or command history
   */
  private async sshExecWithCredentials(
    command: string,
    credentials: { GITHUB_TOKEN?: string; GH_TOKEN?: string; VERCEL_TOKEN?: string },
    timeout: number = 300000
  ): Promise<{ stdout: string; stderr: string }> {
    const envId = `env-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const envFilePath = `/tmp/${envId}`;

    // Build env file content
    const envLines: string[] = [];
    if (credentials.GITHUB_TOKEN) envLines.push(`GITHUB_TOKEN=${credentials.GITHUB_TOKEN}`);
    if (credentials.GH_TOKEN) envLines.push(`GH_TOKEN=${credentials.GH_TOKEN}`);
    if (credentials.VERCEL_TOKEN) envLines.push(`VERCEL_TOKEN=${credentials.VERCEL_TOKEN}`);

    const envContent = envLines.join('\\n');

    try {
      // Write env file securely
      await this.sshExec(`echo -e "${envContent}" > ${envFilePath} && chmod 600 ${envFilePath}`, 10000);

      // Execute command with env file sourced
      const fullCommand = `source ${envFilePath} && ${command}; EXIT_CODE=$?; rm -f ${envFilePath}; exit $EXIT_CODE`;
      return await this.sshExec(fullCommand, timeout);
    } catch (error) {
      // Ensure env file is cleaned up even on error
      await this.sshExec(`rm -f ${envFilePath}`, 5000).catch(() => {});
      throw error;
    }
  }

  /**
   * Build the Claude Code Docker image on the VPS
   */
  async buildImage(): Promise<boolean> {
    try {
      logger.info('Building Claude Code Docker image on Hetzner VPS...');

      // First, sync the Dockerfile and settings
      await execAsync(`rsync -avz Dockerfile.claude-code ${this.sshUser}@${this.serverIp}:/opt/agentflow/`);
      await execAsync(`rsync -avz .claude/ ${this.sshUser}@${this.serverIp}:/opt/agentflow/.claude/`);

      // Build the image on the VPS
      const { stdout, stderr } = await this.sshExec(
        `cd /opt/agentflow && docker build -f Dockerfile.claude-code -t ${this.IMAGE_NAME} .`,
        600000 // 10 minute timeout for build
      );

      logger.info('Claude Code image built successfully');
      this.emit('image:built', { image: this.IMAGE_NAME });
      return true;
    } catch (error) {
      logger.error('Failed to build Claude Code image:', error);
      this.emit('error', { type: 'build_failed', error });
      return false;
    }
  }

  /**
   * Spawn a new Claude Code container with a task
   */
  async spawnAgent(
    taskDescription: string,
    options: {
      workspacePath?: string;
      contextFiles?: string[];
      requirements?: string[];
      maxIterations?: number;
      timeout?: number;
      notificationHandler?: (message: string) => Promise<void>;
    } = {}
  ): Promise<{ containerId: string; streamPromise: Promise<ClaudeTaskResult> }> {
    const containerId = `${this.CONTAINER_PREFIX}${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const workspacePath = options.workspacePath || '/opt/agentflow/workspace';
    const timeout = options.timeout || 600000; // 10 minutes default

    logger.info(`Spawning Claude Code container: ${containerId}`);
    logger.info(`Task: ${taskDescription}`);

    // Build the prompt with context
    let fullPrompt = taskDescription;

    if (options.contextFiles && options.contextFiles.length > 0) {
      fullPrompt += `\n\nContext files to reference:\n${options.contextFiles.join('\n')}`;
    }

    if (options.requirements && options.requirements.length > 0) {
      fullPrompt += `\n\nRequirements:\n${options.requirements.map(r => `- ${r}`).join('\n')}`;
    }

    if (options.maxIterations) {
      fullPrompt += `\n\nMax iterations: ${options.maxIterations}`;
    }

    // Escape the prompt for shell
    const escapedPrompt = fullPrompt.replace(/'/g, "'\\''").replace(/\n/g, '\\n');

    // Create a temporary env file on the VPS with credentials (more secure than command line)
    const envFilePath = `/tmp/claude-env-${containerId}`;
    const envFileContent = [
      `ANTHROPIC_API_KEY=${this.anthropicApiKey}`,
      `CLAUDE_CODE_SKIP_PERMISSIONS=true`,
      this.githubToken ? `GITHUB_TOKEN=${this.githubToken}` : '',
      this.githubToken ? `GH_TOKEN=${this.githubToken}` : '',
      this.vercelToken ? `VERCEL_TOKEN=${this.vercelToken}` : '',
    ].filter(Boolean).join('\\n');

    // Write env file securely (only readable by root)
    await this.sshExec(`echo -e "${envFileContent}" > ${envFilePath} && chmod 600 ${envFilePath}`);

    // Docker run command with YOLO mode (credentials in env file, not command line)
    // Note: The prompt is passed as a positional argument (not -p flag)
    // The Dockerfile ENTRYPOINT already includes: --dangerously-skip-permissions --verbose --output-format stream-json --print
    // Mount SSH keys so the container can deploy to VPS and other servers
    const dockerCommand = `docker run -d --name ${containerId} \
      --rm \
      --env-file ${envFilePath} \
      -v ${workspacePath}:/workspace \
      -v /root/.ssh:/root/.ssh:ro \
      -v /opt/agentflow:/opt/agentflow:rw \
      --pids-limit 200 \
      --memory 4g \
      --cpus 2 \
      ${this.IMAGE_NAME} \
      '${escapedPrompt}' && rm -f ${envFilePath}`;

    // Start container and return immediately with stream promise
    const streamPromise = this.executeAndStream(containerId, dockerCommand, timeout, options.notificationHandler);

    // Verify container started successfully (with retry)
    const startupVerified = await this.verifyContainerStartup(containerId, 10000);
    if (!startupVerified) {
      logger.warn(`Container ${containerId} may not have started properly, but continuing to stream...`);
    }

    return { containerId, streamPromise };
  }

  /**
   * Verify a container has started successfully
   */
  private async verifyContainerStartup(containerId: string, timeout: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 500;

    while (Date.now() - startTime < timeout) {
      try {
        const { stdout } = await this.sshExec(
          `docker inspect --format='{{.State.Status}}' ${containerId} 2>/dev/null || echo "not_found"`,
          5000
        );

        const status = stdout.trim();
        if (status === 'running') {
          logger.info(`✅ Container ${containerId} verified running`);
          return true;
        } else if (status === 'exited' || status === 'dead') {
          // Container exited already - might be a quick task or error
          logger.warn(`Container ${containerId} exited immediately (status: ${status})`);
          return true; // Still return true - let the stream handle the result
        }

        // Not ready yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        logger.debug(`Startup check attempt failed: ${error}`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    logger.warn(`Container startup verification timed out for ${containerId}`);
    return false;
  }

  /**
   * Execute container and stream output
   */
  private async executeAndStream(
    containerId: string,
    dockerCommand: string,
    timeout: number,
    notificationHandler?: (message: string) => Promise<void>
  ): Promise<ClaudeTaskResult> {
    const startTime = Date.now();
    let output = '';

    try {
      // Emit event for listeners (toolBasedAgent handles notifications via event listener)
      // NOTE: Don't send notification here - toolBasedAgent listens to agent:started event
      this.emit('agent:started', { containerId });

      // Start the container
      logger.info(`Starting container on VPS: ${containerId}`);
      await this.sshExec(dockerCommand);

      // Stream logs in real-time
      const logProcess = spawn('ssh', [
        '-i', this.sshKeyPath,
        '-o', 'StrictHostKeyChecking=no',
        `${this.sshUser}@${this.serverIp}`,
        `docker logs -f ${containerId} 2>&1`
      ]);

      this.activeContainers.set(containerId, logProcess);
      this.containerOutputBuffers.set(containerId, '');

      // Process output stream
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(async () => {
          logger.warn(`Container ${containerId} timed out`);
          await this.stopAgent(containerId);
          reject(new Error(`Container timed out after ${timeout}ms`));
        }, timeout);

        // Rate limiting for Discord messages
        let lastNotificationTime = 0;
        const MIN_NOTIFICATION_INTERVAL = 500; // ms between notifications

        const throttledNotify = async (message: string) => {
          if (!notificationHandler) return;
          const now = Date.now();
          if (now - lastNotificationTime >= MIN_NOTIFICATION_INTERVAL) {
            lastNotificationTime = now;
            await notificationHandler(message);
          }
        };

        logProcess.stdout?.on('data', async (data) => {
          const chunk = data.toString();
          output += chunk;
          this.containerOutputBuffers.set(containerId, output);

          // Emit real-time output
          this.emit('agent:output', { containerId, chunk });

          // Parse streaming JSON output from Claude
          const lines = chunk.split('\n').filter((l: string) => l.trim());
          for (const line of lines) {
            // Try to parse as JSON first
            if (line.startsWith('{')) {
              try {
                const event = JSON.parse(line);
                await this.handleClaudeEvent(containerId, event, notificationHandler);
                continue;
              } catch {
                // Not valid JSON, fall through to raw output handling
              }
            }

            // Handle raw non-JSON output (actual terminal output)
            const trimmedLine = line.trim();
            if (trimmedLine.length > 0) {
              // Detect important output patterns
              if (trimmedLine.includes('npm') || trimmedLine.includes('yarn')) {
                await throttledNotify(`📦 ${trimmedLine.substring(0, 200)}`);
              } else if (trimmedLine.includes('error') || trimmedLine.includes('Error')) {
                await throttledNotify(`❌ ${trimmedLine.substring(0, 300)}`);
              } else if (trimmedLine.includes('created') || trimmedLine.includes('Created')) {
                await throttledNotify(`✅ ${trimmedLine.substring(0, 200)}`);
              } else if (trimmedLine.includes('success') || trimmedLine.includes('Success')) {
                await throttledNotify(`🎉 ${trimmedLine.substring(0, 200)}`);
              } else if (trimmedLine.startsWith('$') || trimmedLine.startsWith('>')) {
                // Shell prompt/command
                await throttledNotify(`\`\`\`\n${trimmedLine.substring(0, 300)}\n\`\`\``);
              }
            }
          }
        });

        logProcess.stderr?.on('data', (data) => {
          const chunk = data.toString();
          logger.warn(`Container stderr: ${chunk}`);
          this.emit('agent:error', { containerId, error: chunk });
        });

        logProcess.on('close', async (code) => {
          clearTimeout(timeoutId);
          this.activeContainers.delete(containerId);

          const duration = Date.now() - startTime;

          // Detect known error patterns in output that indicate failure despite exit code 0
          const errorPatterns = [
            /Error: When using --print, --output-format=stream-json requires --verbose/i,
            /Error: Missing required argument/i,
            /Error: Invalid option/i,
            /ANTHROPIC_API_KEY.*not set/i,
            /authentication failed/i,
            /rate limit exceeded/i,
            /Error: spawn/i,
            /ENOENT/i,
          ];

          let detectedError: string | undefined;
          for (const pattern of errorPatterns) {
            if (pattern.test(output)) {
              const match = output.match(pattern);
              detectedError = match ? match[0] : 'Unknown CLI error detected';
              break;
            }
          }

          // Also check if output is suspiciously short (likely a failure)
          const outputLines = output.trim().split('\n').filter(l => l.trim());
          const isSuspiciouslyShort = outputLines.length < 5 && duration < 10000; // Less than 5 lines in under 10 seconds

          // Determine actual success
          const actuallySucceeded = code === 0 && !detectedError && !isSuspiciouslyShort;

          const result: ClaudeTaskResult = {
            success: actuallySucceeded,
            output,
            containerId,
            duration,
            exitCode: code || 0
          };

          if (code !== 0) {
            result.error = `Container exited with code ${code}`;
          } else if (detectedError) {
            result.error = `Claude CLI error: ${detectedError}`;
            logger.error(`Claude agent ${containerId} failed with CLI error: ${detectedError}`);
          } else if (isSuspiciouslyShort) {
            result.error = `Agent completed too quickly with minimal output - likely failed`;
            logger.warn(`Claude agent ${containerId} may have failed: suspiciously short execution`);
          }

          // Emit completion event (toolBasedAgent handles notifications via event listener)
          // NOTE: Don't send notification here - toolBasedAgent listens to agent:completed event
          this.emit('agent:completed', { containerId, result });

          resolve(result);
        });

        logProcess.on('error', (error) => {
          clearTimeout(timeoutId);
          this.activeContainers.delete(containerId);
          reject(error);
        });
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Container ${containerId} failed:`, error);

      return {
        success: false,
        output,
        error: error instanceof Error ? error.message : 'Unknown error',
        containerId,
        duration
      };
    }
  }

  /**
   * Handle Claude streaming JSON events - Rich Discord output
   */
  private async handleClaudeEvent(
    containerId: string,
    event: any,
    notificationHandler?: (message: string) => Promise<void>
  ): Promise<void> {
    const eventType = event.type || event.event;

    // Helper to truncate long output for Discord
    const truncate = (str: string, max: number = 1800): string => {
      if (!str) return '';
      str = str.trim();
      if (str.length <= max) return str;
      return str.substring(0, max) + '\n... (truncated)';
    };

    // Helper to format code blocks
    const codeBlock = (content: string, lang: string = ''): string => {
      return `\`\`\`${lang}\n${truncate(content, 1500)}\n\`\`\``;
    };

    switch (eventType) {
      // Claude's thinking/response text
      case 'assistant':
      case 'assistant_message':
      case 'text':
      case 'content_block_delta':
        const text = event.content || event.text || event.delta?.text || '';
        if (text && text.trim()) {
          this.emit('agent:message', { containerId, message: text });
          // Only send substantial messages (not single characters from streaming)
          if (text.length > 20 && notificationHandler) {
            await notificationHandler(`💭 ${truncate(text, 500)}`);
          }
        }
        break;

      // Tool being called - show what Claude is doing
      case 'tool_use':
      case 'tool_call':
        const toolName = event.name || event.tool || 'unknown';
        const toolInput = event.input || {};
        logger.info(`Claude using tool: ${toolName}`);
        this.emit('agent:tool', { containerId, tool: toolName, input: toolInput });

        if (notificationHandler) {
          let msg = '';

          switch (toolName.toLowerCase()) {
            case 'bash':
            case 'execute_bash':
            case 'shell':
              const cmd = toolInput.command || toolInput.cmd || JSON.stringify(toolInput);
              msg = `⚡ **Running command:**\n${codeBlock(cmd, 'bash')}`;
              break;

            case 'write':
            case 'write_file':
            case 'create_file':
              const filePath = toolInput.file_path || toolInput.path || 'file';
              msg = `📝 **Writing file:** \`${filePath}\``;
              break;

            case 'edit':
            case 'edit_file':
            case 'str_replace':
              const editPath = toolInput.file_path || toolInput.path || 'file';
              msg = `✏️ **Editing:** \`${editPath}\``;
              break;

            case 'read':
            case 'read_file':
              const readPath = toolInput.file_path || toolInput.path || 'file';
              msg = `📖 **Reading:** \`${readPath}\``;
              break;

            case 'glob':
            case 'list_files':
              const pattern = toolInput.pattern || toolInput.glob || '*';
              msg = `🔍 **Searching:** \`${pattern}\``;
              break;

            case 'grep':
            case 'search':
              const searchPattern = toolInput.pattern || toolInput.query || '';
              msg = `🔎 **Grep:** \`${searchPattern}\``;
              break;

            default:
              msg = `🔧 **${toolName}**`;
              if (Object.keys(toolInput).length > 0) {
                const inputStr = JSON.stringify(toolInput, null, 2);
                if (inputStr.length < 500) {
                  msg += `\n${codeBlock(inputStr, 'json')}`;
                }
              }
          }

          await notificationHandler(msg);
        }
        break;

      // Tool result - show actual output
      case 'tool_result':
      case 'tool_output':
        const result = event.result || event.output || event.content || '';
        const toolId = event.tool_use_id || '';
        this.emit('agent:tool_result', { containerId, result, toolId });

        if (notificationHandler && result) {
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          // Only show non-empty, meaningful results
          if (resultStr.trim() && resultStr.length > 5) {
            const isError = resultStr.toLowerCase().includes('error') ||
                           resultStr.toLowerCase().includes('failed') ||
                           resultStr.toLowerCase().includes('exception');
            const emoji = isError ? '❌' : '✅';
            await notificationHandler(`${emoji} **Output:**\n${codeBlock(resultStr)}`);
          }
        }
        break;

      // System messages
      case 'system':
        const sysMsg = event.message || event.content || '';
        if (sysMsg && notificationHandler) {
          await notificationHandler(`ℹ️ ${truncate(sysMsg, 300)}`);
        }
        break;

      // Error handling
      case 'error':
        const errorMsg = event.message || event.error || 'Unknown error';
        logger.error(`Claude error: ${errorMsg}`);
        this.emit('agent:error', { containerId, error: errorMsg });
        if (notificationHandler) {
          await notificationHandler(`🚨 **Error:**\n${codeBlock(errorMsg)}`);
        }
        break;

      // Completion
      case 'done':
      case 'end':
      case 'message_stop':
        logger.info(`Claude agent ${containerId} finished`);
        if (notificationHandler) {
          await notificationHandler(`✨ **Claude Code finished processing**`);
        }
        break;

      // Content block start - often contains tool info
      case 'content_block_start':
        if (event.content_block?.type === 'tool_use') {
          const blockToolName = event.content_block.name || 'tool';
          logger.info(`Starting tool: ${blockToolName}`);
        }
        break;

      default:
        // Log unknown events for debugging but don't spam Discord
        logger.debug(`Claude event [${eventType}]:`, JSON.stringify(event).substring(0, 200));
    }
  }

  /**
   * Stop a running container
   */
  async stopAgent(containerId: string): Promise<boolean> {
    try {
      logger.info(`Stopping container: ${containerId}`);

      // Kill local log streaming process
      const logProcess = this.activeContainers.get(containerId);
      if (logProcess) {
        logProcess.kill();
        this.activeContainers.delete(containerId);
      }

      // Stop and remove container on VPS
      await this.sshExec(`docker stop ${containerId} 2>/dev/null || true`);
      await this.sshExec(`docker rm ${containerId} 2>/dev/null || true`);

      this.emit('agent:stopped', { containerId });
      return true;
    } catch (error) {
      logger.error(`Failed to stop container ${containerId}:`, error);
      return false;
    }
  }

  /**
   * Get status of a container
   */
  async getAgentStatus(containerId: string): Promise<{
    running: boolean;
    status?: string;
    output?: string;
  }> {
    try {
      const { stdout } = await this.sshExec(
        `docker inspect --format='{{.State.Status}}' ${containerId} 2>/dev/null || echo "not_found"`
      );

      const status = stdout.trim();
      const running = status === 'running';

      return {
        running,
        status,
        output: this.containerOutputBuffers.get(containerId)
      };
    } catch {
      return { running: false, status: 'not_found' };
    }
  }

  /**
   * List all Claude agent containers
   */
  async listAgents(): Promise<ContainerInfo[]> {
    try {
      const { stdout } = await this.sshExec(
        `docker ps -a --filter "name=${this.CONTAINER_PREFIX}" --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.CreatedAt}}"`
      );

      if (!stdout.trim()) {
        return [];
      }

      return stdout.trim().split('\n').map(line => {
        const [id, name, status, created] = line.split('|');
        return { id, name, status, created };
      });
    } catch (error) {
      logger.error('Failed to list containers:', error);
      return [];
    }
  }

  /**
   * Get logs from a container
   */
  async getAgentLogs(containerId: string, lines: number = 100): Promise<string[]> {
    try {
      const { stdout } = await this.sshExec(
        `docker logs --tail ${lines} ${containerId} 2>&1`
      );
      return stdout.trim().split('\n');
    } catch (error) {
      logger.error(`Failed to get logs for ${containerId}:`, error);
      return [];
    }
  }

  /**
   * Clean up all stopped Claude containers
   */
  async cleanupContainers(): Promise<number> {
    try {
      const { stdout } = await this.sshExec(
        `docker container prune -f --filter "label=agentflow-claude" 2>/dev/null || docker ps -aq --filter "name=${this.CONTAINER_PREFIX}" --filter "status=exited" | xargs -r docker rm`
      );

      const cleaned = (stdout.match(/deleted/gi) || []).length;
      logger.info(`Cleaned up ${cleaned} stopped containers`);
      return cleaned;
    } catch {
      return 0;
    }
  }

  /**
   * Check if the Claude Code image exists on VPS
   */
  async imageExists(): Promise<boolean> {
    try {
      const { stdout } = await this.sshExec(
        `docker images -q ${this.IMAGE_NAME}`
      );
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Send a message/prompt to a running container
   */
  async sendToAgent(containerId: string, message: string): Promise<boolean> {
    try {
      // Claude Code doesn't support stdin after start in headless mode
      // This would require a different architecture (e.g., websocket-based)
      logger.warn('Sending messages to running containers not supported in headless mode');
      return false;
    } catch {
      return false;
    }
  }

  // ========================================
  // GitHub / Repository Management
  // ========================================

  /**
   * Clone a GitHub repository to a workspace on the VPS
   */
  async cloneRepo(
    repoUrl: string,
    options: {
      workspaceName?: string;
      branch?: string;
      depth?: number;
    } = {}
  ): Promise<{ success: boolean; workspacePath?: string; error?: string }> {
    try {
      // Extract repo name from URL for default workspace name
      const repoMatch = repoUrl.match(/\/([^\/]+?)(\.git)?$/);
      const repoName = repoMatch ? repoMatch[1].replace('.git', '') : `repo-${Date.now()}`;
      const workspaceName = options.workspaceName || repoName;
      const workspacePath = `${this.WORKSPACE_BASE}/${workspaceName}`;

      logger.info(`Cloning ${repoUrl} to ${workspacePath}...`);

      // Ensure workspaces directory exists
      await this.sshExec(`mkdir -p ${this.WORKSPACE_BASE}`);

      // Check if workspace already exists
      const { stdout: exists } = await this.sshExec(`test -d ${workspacePath} && echo "exists" || echo "no"`);
      if (exists.trim() === 'exists') {
        logger.info(`Workspace ${workspacePath} already exists, pulling latest changes...`);
        await this.sshExec(`cd ${workspacePath} && git pull`, 120000);
        return { success: true, workspacePath };
      }

      // Build clone command
      let cloneCmd = 'git clone';
      if (options.depth) {
        cloneCmd += ` --depth ${options.depth}`;
      }
      if (options.branch) {
        cloneCmd += ` --branch ${options.branch}`;
      }

      // Use GITHUB_TOKEN for authentication if available
      let authUrl = repoUrl;
      if (this.githubToken && repoUrl.includes('github.com')) {
        // Convert HTTPS URL to use token authentication
        authUrl = repoUrl.replace('https://github.com/', `https://${this.githubToken}@github.com/`);
      }

      cloneCmd += ` '${authUrl}' '${workspacePath}'`;

      await this.sshExec(cloneCmd, 300000); // 5 minute timeout for clone

      // Configure git user in the repo
      await this.sshExec(`cd ${workspacePath} && git config user.email "claude@agentflow.ai" && git config user.name "Claude Agent"`);

      logger.info(`Successfully cloned to ${workspacePath}`);
      this.emit('repo:cloned', { repoUrl, workspacePath });

      return { success: true, workspacePath };
    } catch (error) {
      logger.error('Failed to clone repository:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a new empty workspace with git initialized
   */
  async createWorkspace(
    workspaceName: string,
    options: {
      initGit?: boolean;
      createGitHubRepo?: boolean;
      repoVisibility?: 'public' | 'private';
    } = {}
  ): Promise<{ success: boolean; workspacePath?: string; repoUrl?: string; error?: string }> {
    try {
      const workspacePath = `${this.WORKSPACE_BASE}/${workspaceName}`;

      logger.info(`Creating workspace: ${workspacePath}`);

      // Create directory
      await this.sshExec(`mkdir -p ${workspacePath}`);

      // Initialize git if requested (default: true)
      if (options.initGit !== false) {
        await this.sshExec(`cd ${workspacePath} && git init`);
        await this.sshExec(`cd ${workspacePath} && git config user.email "claude@agentflow.ai" && git config user.name "Claude Agent"`);

        // Create initial README
        await this.sshExec(`echo "# ${workspaceName}" > ${workspacePath}/README.md`);
        await this.sshExec(`cd ${workspacePath} && git add . && git commit -m "Initial commit"`);
      }

      let repoUrl: string | undefined;

      // Create GitHub repo if requested
      if (options.createGitHubRepo && this.githubToken) {
        const visibility = options.repoVisibility || 'private';
        logger.info(`Creating GitHub repository: ${workspaceName} (${visibility})`);

        // Use gh CLI to create repo (credentials via secure env file)
        const createCmd = `cd ${workspacePath} && gh repo create ${workspaceName} --${visibility} --source=. --push`;
        const { stdout } = await this.sshExecWithCredentials(
          createCmd,
          { GH_TOKEN: this.githubToken },
          60000
        );

        // Extract repo URL from output
        const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+/);
        if (urlMatch) {
          repoUrl = urlMatch[0];
        }

        this.emit('repo:created', { workspaceName, repoUrl, visibility });
      }

      logger.info(`Workspace created: ${workspacePath}`);
      return { success: true, workspacePath, repoUrl };
    } catch (error) {
      logger.error('Failed to create workspace:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List all workspaces on the VPS
   */
  async listWorkspaces(): Promise<{ name: string; path: string; hasGit: boolean; remoteUrl?: string }[]> {
    try {
      await this.sshExec(`mkdir -p ${this.WORKSPACE_BASE}`);

      const { stdout } = await this.sshExec(`ls -1 ${this.WORKSPACE_BASE} 2>/dev/null || echo ""`);

      if (!stdout.trim()) {
        return [];
      }

      const workspaces: { name: string; path: string; hasGit: boolean; remoteUrl?: string }[] = [];

      for (const name of stdout.trim().split('\n')) {
        if (!name) continue;

        const path = `${this.WORKSPACE_BASE}/${name}`;

        // Check if it has git
        const { stdout: gitCheck } = await this.sshExec(`test -d ${path}/.git && echo "yes" || echo "no"`);
        const hasGit = gitCheck.trim() === 'yes';

        let remoteUrl: string | undefined;
        if (hasGit) {
          try {
            const { stdout: remote } = await this.sshExec(`cd ${path} && git remote get-url origin 2>/dev/null || echo ""`);
            remoteUrl = remote.trim() || undefined;
          } catch {
            // No remote configured
          }
        }

        workspaces.push({ name, path, hasGit, remoteUrl });
      }

      return workspaces;
    } catch (error) {
      logger.error('Failed to list workspaces:', error);
      return [];
    }
  }

  /**
   * Delete a workspace
   */
  async deleteWorkspace(workspaceName: string): Promise<boolean> {
    try {
      const workspacePath = `${this.WORKSPACE_BASE}/${workspaceName}`;

      // Safety check - don't delete outside workspace base
      if (!workspacePath.startsWith(this.WORKSPACE_BASE)) {
        logger.error('Invalid workspace path');
        return false;
      }

      await this.sshExec(`rm -rf '${workspacePath}'`);
      logger.info(`Deleted workspace: ${workspacePath}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete workspace:', error);
      return false;
    }
  }

  /**
   * Push changes from a workspace to its remote
   */
  async pushWorkspace(
    workspaceName: string,
    options: {
      branch?: string;
      commitMessage?: string;
      force?: boolean;
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const workspacePath = `${this.WORKSPACE_BASE}/${workspaceName}`;
      const branch = options.branch || 'main';
      const commitMessage = options.commitMessage || 'Update from Claude Agent';

      // Check for changes
      const { stdout: status } = await this.sshExec(`cd ${workspacePath} && git status --porcelain`);

      if (status.trim()) {
        // Stage and commit changes
        await this.sshExec(`cd ${workspacePath} && git add -A`);
        await this.sshExec(`cd ${workspacePath} && git commit -m '${commitMessage.replace(/'/g, "'\\''")}' || true`);
      }

      // Push to remote (credentials via secure env file)
      const forceFlag = options.force ? '--force' : '';
      await this.sshExecWithCredentials(
        `cd ${workspacePath} && git push ${forceFlag} origin ${branch}`,
        { GH_TOKEN: this.githubToken, GITHUB_TOKEN: this.githubToken },
        120000
      );

      logger.info(`Pushed ${workspaceName} to ${branch}`);
      this.emit('repo:pushed', { workspaceName, branch });

      return { success: true };
    } catch (error) {
      logger.error('Failed to push workspace:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a new branch in a workspace
   */
  async createBranch(
    workspaceName: string,
    branchName: string,
    options: { checkout?: boolean; push?: boolean } = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const workspacePath = `${this.WORKSPACE_BASE}/${workspaceName}`;

      // Create the branch
      await this.sshExec(`cd ${workspacePath} && git checkout -b '${branchName}'`);

      // Push to remote if requested (credentials via secure env file)
      if (options.push !== false && this.githubToken) {
        await this.sshExecWithCredentials(
          `cd ${workspacePath} && git push -u origin '${branchName}'`,
          { GH_TOKEN: this.githubToken, GITHUB_TOKEN: this.githubToken },
          60000
        );
      }

      logger.info(`Created branch ${branchName} in ${workspaceName}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to create branch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the workspace path for a given name
   */
  getWorkspacePath(workspaceName: string): string {
    return `${this.WORKSPACE_BASE}/${workspaceName}`;
  }

  // ========================================
  // Vercel Deployment
  // ========================================

  /**
   * Deploy a workspace to Vercel
   * Requires VERCEL_TOKEN environment variable on VPS
   */
  async deployToVercel(
    workspaceName: string,
    options: {
      prod?: boolean;
      projectName?: string;
      vercelToken?: string;
    } = {}
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const workspacePath = `${this.WORKSPACE_BASE}/${workspaceName}`;
      const vercelToken = options.vercelToken || process.env.VERCEL_API_TOKEN || '';

      if (!vercelToken) {
        return {
          success: false,
          error: 'VERCEL_API_TOKEN not configured. Set it in environment variables.'
        };
      }

      logger.info(`🚀 Deploying ${workspaceName} to Vercel...`);

      // Build the vercel deploy command (credentials via secure env file)
      let deployCmd = `cd ${workspacePath} && npx vercel`;

      if (options.prod) {
        deployCmd += ' --prod';
      }

      if (options.projectName) {
        deployCmd += ` --name ${options.projectName}`;
      }

      // Add --yes to skip prompts
      deployCmd += ' --yes';

      const { stdout, stderr } = await this.sshExecWithCredentials(
        deployCmd,
        { VERCEL_TOKEN: vercelToken },
        300000 // 5 minute timeout
      );

      // Extract deployment URL from output
      const urlMatch = stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
      const deploymentUrl = urlMatch ? urlMatch[0] : undefined;

      if (deploymentUrl) {
        logger.info(`✅ Deployed to: ${deploymentUrl}`);
        this.emit('vercel:deployed', { workspaceName, url: deploymentUrl, prod: options.prod });

        return {
          success: true,
          url: deploymentUrl
        };
      }

      // Check for errors
      if (stderr && stderr.toLowerCase().includes('error')) {
        return {
          success: false,
          error: stderr
        };
      }

      return {
        success: true,
        url: deploymentUrl
      };
    } catch (error) {
      logger.error('Vercel deployment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Link a workspace to an existing Vercel project
   */
  async linkToVercel(
    workspaceName: string,
    options: {
      projectName?: string;
      vercelToken?: string;
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const workspacePath = `${this.WORKSPACE_BASE}/${workspaceName}`;
      const vercelToken = options.vercelToken || process.env.VERCEL_API_TOKEN || '';

      if (!vercelToken) {
        return {
          success: false,
          error: 'VERCEL_API_TOKEN not configured'
        };
      }

      // Build link command (credentials via secure env file)
      let linkCmd = `cd ${workspacePath} && npx vercel link --yes`;

      if (options.projectName) {
        linkCmd += ` --project ${options.projectName}`;
      }

      await this.sshExecWithCredentials(linkCmd, { VERCEL_TOKEN: vercelToken }, 60000);

      logger.info(`✅ Linked ${workspaceName} to Vercel`);
      return { success: true };
    } catch (error) {
      logger.error('Vercel link failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ========================================
  // Graceful Shutdown
  // ========================================

  /**
   * Gracefully shutdown all resources
   * - Stop all running containers
   * - Close SSH connection pool
   * - Clean up local processes
   */
  async shutdown(): Promise<void> {
    logger.info('🛑 ClaudeContainerService shutting down...');

    // Stop all active container log streams
    for (const [containerId, process] of this.activeContainers) {
      logger.info(`Stopping log stream for container: ${containerId}`);
      process.kill();
    }
    this.activeContainers.clear();

    // Stop all running Claude containers on VPS
    try {
      const containers = await this.listAgents();
      const runningContainers = containers.filter(c => c.status.includes('Up'));

      if (runningContainers.length > 0) {
        logger.info(`Stopping ${runningContainers.length} running container(s)...`);
        for (const container of runningContainers) {
          await this.stopAgent(container.id).catch(err => {
            logger.warn(`Failed to stop container ${container.id}: ${err}`);
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to cleanup remote containers:', error);
    }

    // Close SSH connection pool
    await this.closeSSHPool();

    // Clear buffers
    this.containerOutputBuffers.clear();

    logger.info('✅ ClaudeContainerService shutdown complete');
    this.emit('shutdown');
  }
}
