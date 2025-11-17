export interface VoiceCommand {
  userId: string;
  guildId: string;
  channelId: string;
  transcript: string;
  timestamp: Date;
  audioUrl?: string;
}

export interface OrchestratorRequest {
  command: string;
  context: {
    userId: string;
    guildId: string;
    channelId: string;
    timestamp: Date;
  };
  priority?: 'low' | 'normal' | 'high';
  requiresSubAgents?: boolean;
}

export interface OrchestratorResponse {
  success: boolean;
  message: string;
  taskId: string;
  agentIds?: string[];
  executionPlan?: string[];
  error?: string;
}

export interface SubAgentTask {
  id: string;
  type: 'terminal' | 'api' | 'analysis' | 'deployment' | 'claude_code';
  command?: string;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface ClaudeCodeSession {
  sessionId: string;
  createdAt: Date;
  status: 'active' | 'idle' | 'terminated' | 'failed';
  parentTaskId?: string;
  currentTask?: SubAgentTask;
}

export interface BotConfig {
  discordToken: string;
  discordClientId: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  groqApiKey?: string;
  orchestratorUrl: string;
  orchestratorApiKey: string;
  allowedUserIds: string[];
  maxConcurrentAgents: number;
  useRealtimeApi?: boolean;
  systemNotificationGuildId?: string;
  systemNotificationChannelId?: string;
}
