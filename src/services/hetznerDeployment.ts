import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface HetznerDeploymentConfig {
  serviceName: string;
  imageName: string;
  dockerfile?: string;
  buildContext?: string;
  port?: number;
  envVars?: Record<string, string>;
  volumes?: string[];
}

export interface DeploymentResult {
  success: boolean;
  serviceUrl?: string;
  containerId?: string;
  error?: string;
  logs?: string[];
}

/**
 * Hetzner VPS Deployment Service
 * Handles building and deploying Docker containers to Hetzner VPS
 */
export class HetznerDeploymentService {
  private serverIp: string;
  private sshUser: string;
  private projectDir: string;
  private notificationCallback?: (event: {
    type: 'started' | 'progress' | 'completed' | 'failed';
    serviceName: string;
    message: string;
    details?: string;
    url?: string;
  }) => Promise<void>;

  constructor(
    serverIp: string = '178.156.198.233',
    sshUser: string = 'root',
    projectDir: string = '/opt/deployments'
  ) {
    this.serverIp = serverIp;
    this.sshUser = sshUser;
    this.projectDir = projectDir;
  }

  /**
   * Set callback for deployment notifications
   */
  setNotificationCallback(
    callback: (event: {
      type: 'started' | 'progress' | 'completed' | 'failed';
      serviceName: string;
      message: string;
      details?: string;
      url?: string;
    }) => Promise<void>
  ): void {
    this.notificationCallback = callback;
  }

  /**
   * Execute SSH command on Hetzner VPS
   */
  private async sshExec(command: string): Promise<{ stdout: string; stderr: string }> {
    const sshCommand = `ssh -o StrictHostKeyChecking=no -o BatchMode=yes -i /root/.ssh/id_ed25519 ${this.sshUser}@${this.serverIp} "${command.replace(/"/g, '\\"')}"`;
    return execAsync(sshCommand, { timeout: 300000 }); // 5 minute timeout
  }

  /**
   * Check if SSH connection is working
   */
  async checkConnection(): Promise<boolean> {
    try {
      const { stdout } = await this.sshExec('echo "connected"');
      return stdout.trim() === 'connected';
    } catch (error) {
      logger.error('SSH connection failed', error);
      return false;
    }
  }

  /**
   * Deploy a Docker container to Hetzner VPS
   */
  async deployToHetzner(config: HetznerDeploymentConfig): Promise<DeploymentResult> {
    const logs: string[] = [];
    const port = config.port || 8080;

    try {
      // Notify deployment started
      await this.notificationCallback?.({
        type: 'started',
        serviceName: config.serviceName,
        message: `Starting deployment to Hetzner VPS`,
        details: `Server: ${this.serverIp}\nPort: ${port}`
      });

      // 1. Check SSH connection
      logs.push('Checking SSH connection...');
      const isConnected = await this.checkConnection();
      if (!isConnected) {
        await this.notificationCallback?.({
          type: 'failed',
          serviceName: config.serviceName,
          message: 'Deployment failed: Cannot connect to Hetzner VPS',
          details: `Server: ${this.serverIp}`
        });
        return {
          success: false,
          error: `Cannot connect to Hetzner VPS at ${this.serverIp}`,
          logs
        };
      }
      logs.push('SSH connection successful');

      // 2. Create deployment directory
      const deployDir = `${this.projectDir}/${config.serviceName}`;
      logs.push(`Creating deployment directory: ${deployDir}`);
      await this.sshExec(`mkdir -p ${deployDir}`);

      // 3. Sync code if buildContext is provided
      if (config.buildContext) {
        await this.notificationCallback?.({
          type: 'progress',
          serviceName: config.serviceName,
          message: 'Syncing code to Hetzner VPS...',
          details: `Source: ${config.buildContext}`
        });

        logs.push('Syncing code to VPS...');
        const rsyncCmd = `rsync -avz --progress --exclude 'node_modules' --exclude '.git' ${config.buildContext}/ ${this.sshUser}@${this.serverIp}:${deployDir}/`;
        await execAsync(rsyncCmd, { timeout: 300000 });
        logs.push('Code synced successfully');
      }

      // 4. Build Docker image on VPS
      await this.notificationCallback?.({
        type: 'progress',
        serviceName: config.serviceName,
        message: 'Building Docker image on Hetzner VPS...',
        details: `Image: ${config.imageName}`
      });

      logs.push(`Building Docker image: ${config.imageName}...`);
      const dockerfilePath = config.dockerfile ? `-f ${config.dockerfile}` : '';
      const buildCmd = `cd ${deployDir} && docker build ${dockerfilePath} -t ${config.imageName} .`;

      try {
        await this.sshExec(buildCmd);
        logs.push('Docker image built successfully');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Build failed';
        logs.push(`Build error: ${errorMsg}`);
        throw new Error(`Docker build failed: ${errorMsg}`);
      }

      // 5. Stop existing container if running
      logs.push(`Stopping existing container: ${config.serviceName}...`);
      await this.sshExec(`docker stop ${config.serviceName} 2>/dev/null || true`);
      await this.sshExec(`docker rm ${config.serviceName} 2>/dev/null || true`);

      // 6. Start new container
      await this.notificationCallback?.({
        type: 'progress',
        serviceName: config.serviceName,
        message: 'Starting container...',
        details: `Port: ${port}`
      });

      logs.push(`Starting container: ${config.serviceName}...`);

      // Build docker run command
      let runCmd = `docker run -d --name ${config.serviceName} --restart unless-stopped -p ${port}:${port}`;

      // Add environment variables
      if (config.envVars) {
        for (const [key, value] of Object.entries(config.envVars)) {
          runCmd += ` -e ${key}="${value}"`;
        }
      }

      // Add volumes
      if (config.volumes) {
        for (const volume of config.volumes) {
          runCmd += ` -v ${volume}`;
        }
      }

      runCmd += ` ${config.imageName}`;

      const { stdout: containerId } = await this.sshExec(runCmd);
      logs.push(`Container started: ${containerId.trim().substring(0, 12)}`);

      // 7. Wait for container to be healthy
      logs.push('Waiting for container to start...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 8. Verify container is running
      const { stdout: status } = await this.sshExec(`docker ps --filter name=${config.serviceName} --format "{{.Status}}"`);
      if (!status.includes('Up')) {
        const { stdout: errorLogs } = await this.sshExec(`docker logs ${config.serviceName} --tail 50`);
        throw new Error(`Container failed to start. Logs: ${errorLogs}`);
      }

      const serviceUrl = `http://${this.serverIp}:${port}`;
      logs.push(`Service URL: ${serviceUrl}`);

      // Notify deployment completed
      await this.notificationCallback?.({
        type: 'completed',
        serviceName: config.serviceName,
        message: `Deployment completed successfully! Service is now live.`,
        details: `Container: ${config.serviceName}\nPort: ${port}`,
        url: serviceUrl
      });

      return {
        success: true,
        serviceUrl,
        containerId: containerId.trim(),
        logs
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Deployment failed', error);

      // Notify deployment failed
      await this.notificationCallback?.({
        type: 'failed',
        serviceName: config.serviceName,
        message: 'Deployment failed',
        details: errorMessage
      });

      return {
        success: false,
        error: errorMessage,
        logs
      };
    }
  }

  /**
   * List running containers on Hetzner VPS
   */
  async listContainers(): Promise<Array<{ name: string; status: string; ports: string }>> {
    try {
      const { stdout } = await this.sshExec(
        'docker ps --format "{{.Names}}|{{.Status}}|{{.Ports}}"'
      );

      return stdout.trim().split('\n').filter(Boolean).map(line => {
        const [name, status, ports] = line.split('|');
        return { name, status, ports: ports || 'none' };
      });
    } catch (error) {
      logger.error('Failed to list containers', error);
      return [];
    }
  }

  /**
   * Stop and remove a container
   */
  async deleteContainer(containerName: string): Promise<boolean> {
    try {
      await this.sshExec(`docker stop ${containerName}`);
      await this.sshExec(`docker rm ${containerName}`);
      logger.info(`Deleted container: ${containerName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete container: ${containerName}`, error);
      return false;
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(containerName: string, limit: number = 50): Promise<string[]> {
    try {
      const { stdout } = await this.sshExec(
        `docker logs ${containerName} --tail ${limit} 2>&1`
      );
      return stdout.trim().split('\n').filter(Boolean);
    } catch (error) {
      logger.error(`Failed to get logs for container: ${containerName}`, error);
      return [];
    }
  }

  /**
   * Restart a container
   */
  async restartContainer(containerName: string): Promise<boolean> {
    try {
      await this.sshExec(`docker restart ${containerName}`);
      logger.info(`Restarted container: ${containerName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to restart container: ${containerName}`, error);
      return false;
    }
  }

  /**
   * Get container stats (CPU, memory usage)
   */
  async getContainerStats(containerName: string): Promise<{
    cpu: string;
    memory: string;
    memoryLimit: string;
  } | null> {
    try {
      const { stdout } = await this.sshExec(
        `docker stats ${containerName} --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}"`
      );
      const [cpu, memUsage] = stdout.trim().split('|');
      const [memory, memoryLimit] = memUsage.split(' / ');
      return { cpu, memory, memoryLimit };
    } catch (error) {
      logger.error(`Failed to get stats for container: ${containerName}`, error);
      return null;
    }
  }

  /**
   * Create a new Hetzner server (for isolated deployments)
   */
  async createServer(serverName: string, serverType: string = 'cpx11'): Promise<{
    success: boolean;
    ip?: string;
    error?: string;
  }> {
    try {
      // Check if hcloud CLI is available
      await execAsync('hcloud version');

      // Create server
      const { stdout } = await execAsync(
        `hcloud server create --name ${serverName} --type ${serverType} --image docker-ce --location ash --ssh-key default`
      );

      // Extract IP from output
      const ipMatch = stdout.match(/IPv4:\s+(\d+\.\d+\.\d+\.\d+)/);
      const ip = ipMatch ? ipMatch[1] : undefined;

      return { success: true, ip };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create Hetzner server', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * List Hetzner servers
   */
  async listServers(): Promise<Array<{ name: string; ip: string; status: string; type: string }>> {
    try {
      const { stdout } = await execAsync(
        'hcloud server list --output columns=name,ipv4,status,server_type'
      );

      const lines = stdout.trim().split('\n').slice(1); // Skip header
      return lines.map(line => {
        const [name, ip, status, type] = line.split(/\s+/);
        return { name, ip, status, type };
      });
    } catch (error) {
      logger.error('Failed to list Hetzner servers', error);
      return [];
    }
  }

  /**
   * Delete a Hetzner server
   */
  async deleteServer(serverName: string): Promise<boolean> {
    try {
      await execAsync(`hcloud server delete ${serverName} --yes`);
      logger.info(`Deleted Hetzner server: ${serverName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete Hetzner server: ${serverName}`, error);
      return false;
    }
  }
}
