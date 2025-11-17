import { logger } from '../utils/logger';

/**
 * Direct Command Executor
 * Executes simple bash commands directly without going through Claude API or sub-agents
 */
export class DirectCommandExecutor {
  /**
   * Check if a user message is a simple command request
   */
  static isSimpleCommand(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();

    // Patterns that indicate simple command requests
    const patterns = [
      /^list\s+(my\s+)?github\s+(projects|repos?)/i,
      /^show\s+(my\s+)?github\s+(projects|repos?)/i,
      /^(get|fetch)\s+(my\s+)?github\s+(projects|repos?)/i,
      /^gh\s+repo\s+list/i,
      /^list\s+(my\s+)?gcloud\s+projects/i,
      /^gcloud\s+projects\s+list/i,
      /^git\s+status/i,
      /^git\s+log/i,
      /^pwd$/i,
      /^ls\s*/i,
      /^whoami$/i
    ];

    return patterns.some(pattern => pattern.test(lowerMessage));
  }

  /**
   * Map user message to actual bash command
   */
  static mapToCommand(message: string): string | null {
    const lowerMessage = message.toLowerCase().trim();

    // GitHub commands
    if (/list\s+(my\s+)?github\s+(projects|repos?)|show\s+(my\s+)?github|get\s+(my\s+)?github/i.test(lowerMessage)) {
      return 'gh repo list --limit 50';
    }

    // GCloud commands - expanded patterns
    if (/list\s+(my\s+)?(gcloud|google\s+cloud|gcp)\s+projects/i.test(lowerMessage)) {
      return 'gcloud projects list';
    }
    if (/show\s+(my\s+)?(gcloud|google\s+cloud|gcp)\s+projects/i.test(lowerMessage)) {
      return 'gcloud projects list';
    }

    // Git commands
    if (/git\s+status/i.test(lowerMessage)) return 'git status';
    if (/git\s+log/i.test(lowerMessage)) return 'git log --oneline -10';

    // Direct command passthrough (case-insensitive check)
    if (lowerMessage.startsWith('gh ')) return message.trim(); // Preserve original case for args
    if (lowerMessage.startsWith('gcloud ')) return message.trim();
    if (lowerMessage.startsWith('git ')) return message.trim();
    if (lowerMessage === 'pwd') return 'pwd';
    if (lowerMessage === 'whoami') return 'whoami';
    if (lowerMessage.startsWith('ls')) return message.trim();

    return null;
  }

  /**
   * Execute command directly and return output
   */
  static async execute(command: string): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      logger.info(`[DirectExecutor] Running: ${command}`);

      // Use exec for proper shell compatibility
      const { exec } = require('child_process');

      const env = {
        ...process.env,
        PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
        HOME: require('os').homedir(),
        SHELL: '/bin/bash',
        // Preserve Google Cloud and GitHub auth
        CLOUDSDK_CONFIG: process.env.CLOUDSDK_CONFIG || `${require('os').homedir()}/.config/gcloud`,
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      };

      const childProcess = exec(
        command,
        {
          env,
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024 * 5, // 5MB buffer for large outputs
          shell: '/bin/bash'
        },
        (error: Error | null, stdout: string, stderr: string) => {
          if (error) {
            const errorOutput = stderr || stdout || error.message;
            logger.error(`[DirectExecutor] Failed: ${errorOutput.substring(0, 200)}`);
            resolve({ success: false, output: errorOutput, error: errorOutput });
          } else {
            const output = stdout || stderr || '(no output)';
            logger.info(`[DirectExecutor] Success: ${output.substring(0, 100)}...`);
            resolve({ success: true, output });
          }
        }
      );
    });
  }

  /**
   * Handle a user message - check if it's a simple command and execute directly
   */
  static async handleMessage(message: string): Promise<{ handled: boolean; response?: string }> {
    if (!this.isSimpleCommand(message)) {
      return { handled: false };
    }

    const command = this.mapToCommand(message);
    if (!command) {
      return { handled: false };
    }

    const result = await this.execute(command);

    if (result.success) {
      // Truncate output for Discord (2000 char limit)
      const truncatedOutput = result.output.length > 1800
        ? result.output.substring(0, 1800) + '\n...(output truncated)'
        : result.output;

      const response = `\`\`\`bash\n${command}\n\`\`\`\n**Output:**\n\`\`\`\n${truncatedOutput}\n\`\`\``;
      return { handled: true, response };
    } else {
      const response = `❌ **Command Failed:**\n\`\`\`bash\n${command}\n\`\`\`\n**Error:**\n\`\`\`\n${result.error}\n\`\`\``;
      return { handled: true, response };
    }
  }
}
