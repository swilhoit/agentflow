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
  elevenLabsApiKey: string;
  elevenLabsAgentId: string;
  groqApiKey?: string;
  orchestratorUrl: string;
  orchestratorApiKey: string;
  allowedUserIds: string[];
  maxConcurrentAgents: number;
  useRealtimeApi?: boolean;
  systemNotificationGuildId?: string;
  systemNotificationChannelId?: string;
  ttsSpeed?: number; // 0.25 to 4.0, default 1.0, higher is faster
  trelloApiKey?: string;
  trelloApiToken?: string;
  // Market updates configuration
  marketUpdatesEnabled?: boolean;
  marketUpdatesGuildId?: string;
  marketUpdatesDailyCron?: string;
  marketUpdatesCloseCron?: string;
  marketUpdatesNewsCron?: string;
  marketUpdatesWeeklyCron?: string;
  marketUpdatesTimezone?: string;
  // News monitoring
  finnhubApiKey?: string;
  finnhubWebhookSecret?: string;
  // Perplexity API for AI-powered news analysis
  perplexityApiKey?: string;
  // Database configuration
  databaseType?: 'sqlite' | 'supabase' | 'cloudsql';
  cloudSqlInstanceConnectionName?: string;
  cloudSqlDatabase?: string;
  cloudSqlUser?: string;
  cloudSqlPassword?: string;
  // Global Markets Agent configuration
  globalMarketsChannels?: string[];
  // Financial Advisor configuration
  financialAdvisorChannels?: string[];
  // Orchestrator configuration
  orchestratorChannels?: string[];
  // Trello configuration (Project Management)
  trelloBoardId?: string;
  trelloBacklogListId?: string;
  trelloInProgressListId?: string;
  trelloNeedsInputListId?: string;
  trelloDoneListId?: string;
  // Deployment tracking configuration
  deploymentsChannelId?: string;
  deploymentTrackingEnabled?: boolean;
  vercelTrackingEnabled?: boolean;
  githubTrackingEnabled?: boolean;
  githubRepos?: string[];
  githubWorkflowFilter?: string[];
  deploymentCheckInterval?: string;
}

export interface TrelloTaskRequest {
  action: 'create' | 'update' | 'read' | 'delete' | 'search' | 'move';
  boardName?: string;
  listName?: string;
  cardId?: string;
  cardName?: string;
  description?: string;
  dueDate?: string;
  labels?: string[];
  members?: string[];
  query?: string;
}
