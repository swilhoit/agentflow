import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface DeploymentConfig {
  projectId: string;
  region: string;
  serviceName: string;
  imageName: string;
  dockerfile?: string;
  buildContext?: string;
  envVars?: Record<string, string>;
  claudeApiKey?: string;
}

export interface DeploymentResult {
  success: boolean;
  serviceUrl?: string;
  error?: string;
  logs?: string[];
}

/**
 * Google Cloud Run Deployment Service
 * Handles building and deploying Docker containers to GCP
 */
export class CloudDeploymentService {
  private projectId: string;
  private region: string;

  constructor(projectId: string, region: string = 'us-central1') {
    this.projectId = projectId;
    this.region = region;
  }

  /**
   * Check if gcloud CLI is installed and authenticated
   */
  async checkGcloudAuth(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('gcloud auth list --filter=status:ACTIVE --format="value(account)"');
      return stdout.trim().length > 0;
    } catch (error) {
      logger.error('gcloud CLI not authenticated', error);
      return false;
    }
  }

  /**
   * Deploy a Docker container to Cloud Run
   */
  async deployToCloudRun(config: DeploymentConfig): Promise<DeploymentResult> {
    const logs: string[] = [];

    try {
      // 1. Check authentication
      logs.push('Checking gcloud authentication...');
      const isAuthed = await this.checkGcloudAuth();
      if (!isAuthed) {
        return {
          success: false,
          error: 'gcloud CLI not authenticated. Run: gcloud auth login',
          logs
        };
      }

      // 2. Set project
      logs.push(`Setting GCP project to ${config.projectId}...`);
      await execAsync(`gcloud config set project ${config.projectId}`);

      // 3. Build the Docker image using Cloud Build
      const imageTag = `gcr.io/${config.projectId}/${config.imageName}:latest`;
      logs.push(`Building Docker image: ${imageTag}...`);

      const buildContext = config.buildContext || '.';
      const dockerfilePath = config.dockerfile || 'Dockerfile';

      const buildCmd = `gcloud builds submit --tag ${imageTag} ${buildContext} --gcs-log-dir=gs://${config.projectId}_cloudbuild/logs`;
      const { stdout: buildOut, stderr: buildErr } = await execAsync(buildCmd);

      if (buildErr && !buildErr.includes('WARNING')) {
        logs.push(`Build warnings: ${buildErr}`);
      }
      logs.push('Docker image built successfully');

      // 4. Deploy to Cloud Run
      logs.push(`Deploying to Cloud Run service: ${config.serviceName}...`);

      let deployCmd = `gcloud run deploy ${config.serviceName} \
        --image ${imageTag} \
        --region ${this.region} \
        --platform managed \
        --allow-unauthenticated \
        --memory 2Gi \
        --cpu 2 \
        --timeout 3600 \
        --max-instances 10`;

      // Add environment variables
      if (config.envVars || config.claudeApiKey) {
        const envVars = { ...config.envVars };
        if (config.claudeApiKey) {
          envVars['ANTHROPIC_API_KEY'] = config.claudeApiKey;
        }
        // Automatically include GitHub token if available
        if (process.env.GITHUB_TOKEN) {
          envVars['GITHUB_TOKEN'] = process.env.GITHUB_TOKEN;
        }

        const envString = Object.entries(envVars)
          .map(([key, value]) => `${key}=${value}`)
          .join(',');

        deployCmd += ` --set-env-vars="${envString}"`;
      }

      const { stdout: deployOut } = await execAsync(deployCmd);
      logs.push('Deployment successful');

      // 5. Extract service URL
      const urlMatch = deployOut.match(/Service URL: (https:\/\/[^\s]+)/);
      const serviceUrl = urlMatch ? urlMatch[1] : undefined;

      if (serviceUrl) {
        logs.push(`Service URL: ${serviceUrl}`);
      }

      return {
        success: true,
        serviceUrl,
        logs
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Deployment failed', error);

      return {
        success: false,
        error: errorMessage,
        logs
      };
    }
  }

  /**
   * Create a Dockerfile with Claude Code pre-installed
   */
  async generateDockerfileWithClaude(options: {
    baseImage?: string;
    workdir?: string;
    installNode?: boolean;
    additionalPackages?: string[];
  }): Promise<string> {
    const {
      baseImage = 'node:20-slim',
      workdir = '/app',
      installNode = true,
      additionalPackages = []
    } = options;

    const dockerfile = `# Generated Dockerfile with Claude Code
FROM ${baseImage}

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    curl \\
    git \\
    build-essential \\
    ${additionalPackages.join(' \\\n    ')} \\
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN curl -fsSL https://storage.googleapis.com/anthropic-cli/install.sh | sh

# Set working directory
WORKDIR ${workdir}

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build if needed (uncomment if you have a build step)
# RUN npm run build

# Expose port
EXPOSE 8080

# Set environment variable for Claude Code
ENV ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY}
ENV PORT=8080

# Start command
CMD ["npm", "start"]
`;

    return dockerfile;
  }

  /**
   * List running Cloud Run services
   */
  async listServices(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `gcloud run services list --region ${this.region} --project ${this.projectId} --format="value(metadata.name)"`
      );
      return stdout.trim().split('\n').filter(Boolean);
    } catch (error) {
      logger.error('Failed to list services', error);
      return [];
    }
  }

  /**
   * Delete a Cloud Run service
   */
  async deleteService(serviceName: string): Promise<boolean> {
    try {
      await execAsync(
        `gcloud run services delete ${serviceName} --region ${this.region} --project ${this.projectId} --quiet`
      );
      logger.info(`Deleted service: ${serviceName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete service: ${serviceName}`, error);
      return false;
    }
  }

  /**
   * Get service logs
   */
  async getServiceLogs(serviceName: string, limit: number = 50): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `gcloud run services logs read ${serviceName} --region ${this.region} --project ${this.projectId} --limit ${limit} --format="value(textPayload)"`
      );
      return stdout.trim().split('\n').filter(Boolean);
    } catch (error) {
      logger.error(`Failed to get logs for service: ${serviceName}`, error);
      return [];
    }
  }
}
