import { Client, Guild, TextChannel, ChannelType, Channel } from 'discord.js';
import { logger } from '../utils/logger';

export interface ChannelInfo {
  id: string;
  name: string;
  type: ChannelType;
  category?: string;
  topic?: string;
  position: number;
  purpose?: string; // Inferred from name/topic
  keywords?: string[]; // For semantic matching
}

export interface GuildStructure {
  guildId: string;
  guildName: string;
  channels: ChannelInfo[];
  categories: Map<string, ChannelInfo[]>;
  lastUpdated: Date;
}

export type MessageType = 
  | 'agent_update'
  | 'error'
  | 'warning'
  | 'success'
  | 'deployment'
  | 'finance'
  | 'goal'
  | 'project_update'
  | 'crypto'
  | 'general'
  | 'command_result'
  | 'thinking'
  | 'code';

/**
 * Discord Channel Awareness Service
 * Provides intelligent channel discovery and routing for agents
 */
export class DiscordChannelAwareness {
  private client: Client;
  private guildStructures: Map<string, GuildStructure> = new Map();
  private channelRouting: Map<MessageType, string[]> = new Map(); // message type -> preferred channel names

  constructor(client: Client) {
    this.client = client;
    this.initializeDefaultRouting();
  }

  /**
   * Initialize default channel routing preferences
   */
  private initializeDefaultRouting(): void {
    this.channelRouting.set('agent_update', ['agent-chat', 'agents', 'bot', 'automation']);
    this.channelRouting.set('error', ['errors', 'error-log', 'agent-chat', 'dev-logs']);
    this.channelRouting.set('warning', ['warnings', 'agent-chat', 'dev-logs']);
    this.channelRouting.set('success', ['agent-chat', 'updates', 'success']);
    this.channelRouting.set('deployment', ['deployments', 'dev-logs', 'agent-chat']);
    this.channelRouting.set('finance', ['finance', 'financial', 'budget', 'money']);
    this.channelRouting.set('goal', ['goals', 'productivity', 'daily', 'tasks']);
    this.channelRouting.set('project_update', ['projects', 'updates', 'dev']);
    this.channelRouting.set('crypto', ['crypto', 'crypto-alerts', 'trading']);
    this.channelRouting.set('general', ['general', 'agent-chat', 'chat']);
    this.channelRouting.set('command_result', ['agent-chat', 'results', 'output']);
    this.channelRouting.set('thinking', ['agent-chat', 'thinking', 'process']);
    this.channelRouting.set('code', ['code', 'snippets', 'dev', 'agent-chat']);
  }

  /**
   * Discover and cache the structure of a Discord guild
   */
  async discoverGuildStructure(guildId: string): Promise<GuildStructure> {
    try {
      logger.info(`🔍 Discovering structure for guild ${guildId}...`);

      const guild = await this.client.guilds.fetch(guildId);
      const channels = await guild.channels.fetch();

      const channelInfos: ChannelInfo[] = [];
      const categories = new Map<string, ChannelInfo[]>();

      for (const [channelId, channel] of channels) {
        if (!channel) continue;

        // Skip voice channels for now (can be added later)
        if (channel.type === ChannelType.GuildVoice || 
            channel.type === ChannelType.GuildStageVoice) {
          continue;
        }

        const categoryName = channel.parent?.name || 'No Category';
        
        const channelInfo: ChannelInfo = {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          category: categoryName,
          topic: channel.type === ChannelType.GuildText && 'topic' in channel 
            ? (channel.topic || undefined) 
            : undefined,
          position: channel.position || 0,
          purpose: this.inferChannelPurpose(channel.name, 
            channel.type === ChannelType.GuildText && 'topic' in channel 
              ? (channel.topic || undefined) 
              : undefined),
          keywords: this.extractKeywords(channel.name, 
            channel.type === ChannelType.GuildText && 'topic' in channel 
              ? (channel.topic || undefined) 
              : undefined)
        };

        channelInfos.push(channelInfo);

        // Group by category
        if (!categories.has(categoryName)) {
          categories.set(categoryName, []);
        }
        categories.get(categoryName)!.push(channelInfo);
      }

      const structure: GuildStructure = {
        guildId,
        guildName: guild.name,
        channels: channelInfos.sort((a, b) => a.position - b.position),
        categories,
        lastUpdated: new Date()
      };

      this.guildStructures.set(guildId, structure);
      logger.info(`✅ Discovered ${channelInfos.length} channels in ${categories.size} categories`);

      return structure;
    } catch (error) {
      logger.error(`Failed to discover guild structure for ${guildId}`, error);
      throw error;
    }
  }

  /**
   * Infer the purpose of a channel from its name and topic
   */
  private inferChannelPurpose(name: string, topic?: string): string {
    const nameLower = name.toLowerCase();
    const topicLower = topic?.toLowerCase() || '';
    const combined = `${nameLower} ${topicLower}`;

    // Agent-related
    if (combined.match(/agent|bot|automation|ai/)) {
      return 'Agent communication and updates';
    }

    // Development
    if (combined.match(/dev|code|development|programming/)) {
      return 'Development and code';
    }

    // Errors and logs
    if (combined.match(/error|bug|issue|problem/)) {
      return 'Error tracking and debugging';
    }

    if (combined.match(/log|logs|logging/)) {
      return 'System logs and monitoring';
    }

    // Finance
    if (combined.match(/finance|financial|money|budget|expense|revenue/)) {
      return 'Financial tracking and alerts';
    }

    // Goals and productivity
    if (combined.match(/goal|task|todo|productivity|daily/)) {
      return 'Goals and task management';
    }

    // Projects
    if (combined.match(/project|waterwise|intercept|lumea|geo/)) {
      return 'Project-specific updates';
    }

    // Crypto
    if (combined.match(/crypto|bitcoin|eth|trading|blockchain/)) {
      return 'Cryptocurrency and trading';
    }

    // Deployment
    if (combined.match(/deploy|deployment|release|production/)) {
      return 'Deployment and release management';
    }

    // General
    if (combined.match(/general|chat|discussion/)) {
      return 'General discussion';
    }

    return 'General purpose channel';
  }

  /**
   * Extract keywords from channel name and topic for semantic matching
   */
  private extractKeywords(name: string, topic?: string): string[] {
    const text = `${name} ${topic || ''}`.toLowerCase();
    const words = text.match(/\b\w+\b/g) || [];
    
    // Filter out common words
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    return [...new Set(words.filter(word => 
      word.length > 2 && !stopWords.has(word)
    ))];
  }

  /**
   * Find the best channel to post a message based on its type and content
   */
  async findBestChannel(
    guildId: string,
    messageType: MessageType,
    messageContent?: string,
    projectName?: string
  ): Promise<string | null> {
    try {
      // Get or discover guild structure
      let structure = this.guildStructures.get(guildId);
      if (!structure || this.isStale(structure)) {
        structure = await this.discoverGuildStructure(guildId);
      }

      // If project name is provided, look for project-specific channel first
      if (projectName) {
        const projectChannel = structure.channels.find(c => 
          c.name.toLowerCase().includes(projectName.toLowerCase()) ||
          c.keywords?.some(k => k.includes(projectName.toLowerCase()))
        );
        
        if (projectChannel) {
          logger.info(`📍 Routing to project channel: #${projectChannel.name}`);
          return projectChannel.id;
        }
      }

      // Get preferred channel names for this message type
      const preferredNames = this.channelRouting.get(messageType) || ['agent-chat', 'general'];

      // Try to find matching channel by name
      for (const preferredName of preferredNames) {
        const channel = structure.channels.find(c => 
          c.name.toLowerCase().includes(preferredName.toLowerCase())
        );
        
        if (channel) {
          logger.info(`📍 Routing ${messageType} to #${channel.name}`);
          return channel.id;
        }
      }

      // If no match, try semantic matching with message content
      if (messageContent) {
        const bestMatch = this.semanticChannelMatch(structure.channels, messageContent);
        if (bestMatch) {
          logger.info(`📍 Routing to semantically matched channel: #${bestMatch.name}`);
          return bestMatch.id;
        }
      }

      // Fallback to first agent-chat or general channel
      const fallback = structure.channels.find(c => 
        c.name.toLowerCase().includes('agent-chat') || 
        c.name.toLowerCase().includes('general')
      );

      if (fallback) {
        logger.info(`📍 Routing to fallback channel: #${fallback.name}`);
        return fallback.id;
      }

      logger.warn(`Could not find appropriate channel for ${messageType} in guild ${guildId}`);
      return null;
    } catch (error) {
      logger.error('Failed to find best channel', error);
      return null;
    }
  }

  /**
   * Semantic matching: find channel whose keywords best match message content
   */
  private semanticChannelMatch(channels: ChannelInfo[], content: string): ChannelInfo | null {
    const contentWords = content.toLowerCase().match(/\b\w+\b/g) || [];
    const contentSet = new Set(contentWords);

    let bestMatch: ChannelInfo | null = null;
    let bestScore = 0;

    for (const channel of channels) {
      if (!channel.keywords || channel.keywords.length === 0) continue;

      // Calculate overlap score
      const overlap = channel.keywords.filter(k => contentSet.has(k)).length;
      const score = overlap / channel.keywords.length;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = channel;
      }
    }

    // Only return if score is significant
    return bestScore > 0.3 ? bestMatch : null;
  }

  /**
   * Check if cached guild structure is stale (older than 1 hour)
   */
  private isStale(structure: GuildStructure): boolean {
    const oneHourAgo = new Date(Date.now() - 3600000);
    return structure.lastUpdated < oneHourAgo;
  }

  /**
   * Get all channels in a guild
   */
  async getChannels(guildId: string): Promise<ChannelInfo[]> {
    let structure = this.guildStructures.get(guildId);
    if (!structure || this.isStale(structure)) {
      structure = await this.discoverGuildStructure(guildId);
    }
    return structure.channels;
  }

  /**
   * Get channels by category
   */
  async getChannelsByCategory(guildId: string, category: string): Promise<ChannelInfo[]> {
    let structure = this.guildStructures.get(guildId);
    if (!structure || this.isStale(structure)) {
      structure = await this.discoverGuildStructure(guildId);
    }
    return structure.categories.get(category) || [];
  }

  /**
   * Get channel info by ID
   */
  async getChannelInfo(guildId: string, channelId: string): Promise<ChannelInfo | null> {
    let structure = this.guildStructures.get(guildId);
    if (!structure || this.isStale(structure)) {
      structure = await this.discoverGuildStructure(guildId);
    }
    return structure.channels.find(c => c.id === channelId) || null;
  }

  /**
   * Find channels matching a query
   */
  async searchChannels(guildId: string, query: string): Promise<ChannelInfo[]> {
    let structure = this.guildStructures.get(guildId);
    if (!structure || this.isStale(structure)) {
      structure = await this.discoverGuildStructure(guildId);
    }

    const queryLower = query.toLowerCase();
    return structure.channels.filter(c => 
      c.name.toLowerCase().includes(queryLower) ||
      c.topic?.toLowerCase().includes(queryLower) ||
      c.purpose?.toLowerCase().includes(queryLower) ||
      c.keywords?.some(k => k.includes(queryLower))
    );
  }

  /**
   * Configure custom channel routing for message types
   */
  setChannelRouting(messageType: MessageType, channelNames: string[]): void {
    this.channelRouting.set(messageType, channelNames);
    logger.info(`Updated routing for ${messageType}: ${channelNames.join(', ')}`);
  }

  /**
   * Get guild structure summary
   */
  async getGuildSummary(guildId: string): Promise<string> {
    let structure = this.guildStructures.get(guildId);
    if (!structure || this.isStale(structure)) {
      structure = await this.discoverGuildStructure(guildId);
    }

    let summary = `📋 **${structure.guildName}** (${structure.channels.length} channels)\n\n`;

    for (const [category, channels] of structure.categories) {
      summary += `**${category}:**\n`;
      for (const channel of channels.slice(0, 5)) {
        summary += `  • #${channel.name}`;
        if (channel.purpose) {
          summary += ` - ${channel.purpose}`;
        }
        summary += '\n';
      }
      if (channels.length > 5) {
        summary += `  ... and ${channels.length - 5} more\n`;
      }
      summary += '\n';
    }

    return summary;
  }

  /**
   * Clear cached structures (force refresh)
   */
  clearCache(guildId?: string): void {
    if (guildId) {
      this.guildStructures.delete(guildId);
      logger.info(`Cleared cache for guild ${guildId}`);
    } else {
      this.guildStructures.clear();
      logger.info('Cleared all guild structure caches');
    }
  }
}
