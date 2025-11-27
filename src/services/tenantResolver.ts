/**
 * Tenant Resolver Service
 * 
 * Maps Discord guilds to registered users and resolves their credentials.
 * This is the core of multi-tenant Discord bot architecture.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// Types for multi-tenant system
export interface TenantInfo {
  userId: string;
  guildId: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  isActive: boolean;
  features: TenantFeatures;
}

export interface TenantFeatures {
  maxAgentTasks: number;
  voiceEnabled: boolean;
  maxBankConnections: number;
  maxWatchlistSymbols: number;
  dataRetentionDays: number;
  byokEnabled: boolean; // Bring Your Own Key
}

export interface UserCredentials {
  anthropicApiKey?: string;
  elevenLabsApiKey?: string;
  elevenLabsAgentId?: string;
  tellerAccessToken?: string;
  finnhubApiKey?: string;
  trelloApiKey?: string;
  trelloApiToken?: string;
  groqApiKey?: string;
}

// Subscription tier feature limits
const TIER_FEATURES: Record<string, TenantFeatures> = {
  free: {
    maxAgentTasks: 10,
    voiceEnabled: false,
    maxBankConnections: 1,
    maxWatchlistSymbols: 5,
    dataRetentionDays: 30,
    byokEnabled: false,
  },
  pro: {
    maxAgentTasks: -1, // unlimited
    voiceEnabled: true,
    maxBankConnections: 5,
    maxWatchlistSymbols: 50,
    dataRetentionDays: 365,
    byokEnabled: true,
  },
  enterprise: {
    maxAgentTasks: -1,
    voiceEnabled: true,
    maxBankConnections: -1,
    maxWatchlistSymbols: -1,
    dataRetentionDays: -1,
    byokEnabled: true,
  },
};

export class TenantResolver {
  private supabase: SupabaseClient;
  private encryptionKey: Buffer;
  
  // Cache to avoid repeated DB lookups (TTL: 5 minutes)
  private tenantCache: Map<string, { tenant: TenantInfo; expires: number }> = new Map();
  private credentialCache: Map<string, { credentials: UserCredentials; expires: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    if (!encryptionKey || encryptionKey.length !== 64) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.encryptionKey = Buffer.from(encryptionKey, 'hex');
    
    logger.info('[TenantResolver] Initialized with Supabase connection');
  }

  /**
   * Resolve tenant info from a Discord guild ID
   */
  async resolveTenant(guildId: string): Promise<TenantInfo | null> {
    // Check cache first
    const cached = this.tenantCache.get(guildId);
    if (cached && cached.expires > Date.now()) {
      return cached.tenant;
    }

    try {
      // Look up guild registration
      const { data: registration, error } = await this.supabase
        .from('guild_registrations')
        .select(`
          user_id,
          is_active,
          profiles!inner (
            subscription_tier
          )
        `)
        .eq('guild_id', guildId)
        .single();

      if (error || !registration) {
        logger.warn(`[TenantResolver] No registration found for guild ${guildId}`);
        return null;
      }

      const tier = (registration.profiles as any).subscription_tier || 'free';
      
      const tenant: TenantInfo = {
        userId: registration.user_id,
        guildId,
        subscriptionTier: tier,
        isActive: registration.is_active,
        features: TIER_FEATURES[tier] || TIER_FEATURES.free,
      };

      // Cache the result
      this.tenantCache.set(guildId, {
        tenant,
        expires: Date.now() + this.CACHE_TTL,
      });

      return tenant;
    } catch (err) {
      logger.error(`[TenantResolver] Error resolving tenant for guild ${guildId}:`, err);
      return null;
    }
  }

  /**
   * Get decrypted credentials for a user
   */
  async getUserCredentials(userId: string): Promise<UserCredentials> {
    // Check cache first
    const cached = this.credentialCache.get(userId);
    if (cached && cached.expires > Date.now()) {
      return cached.credentials;
    }

    try {
      const { data: credentialRows, error } = await this.supabase
        .from('user_credentials')
        .select('service_name, encrypted_credentials')
        .eq('user_id', userId);

      if (error) {
        logger.error(`[TenantResolver] Error fetching credentials for user ${userId}:`, error);
        return this.getDefaultCredentials();
      }

      const credentials: UserCredentials = {};

      for (const row of credentialRows || []) {
        try {
          const decrypted = this.decryptCredential(row.encrypted_credentials);
          const parsed = JSON.parse(decrypted);

          switch (row.service_name) {
            case 'anthropic':
              credentials.anthropicApiKey = parsed.apiKey;
              break;
            case 'elevenlabs':
              credentials.elevenLabsApiKey = parsed.apiKey;
              credentials.elevenLabsAgentId = parsed.agentId;
              break;
            case 'teller':
              credentials.tellerAccessToken = parsed.accessToken;
              break;
            case 'finnhub':
              credentials.finnhubApiKey = parsed.apiKey;
              break;
            case 'trello':
              credentials.trelloApiKey = parsed.apiKey;
              credentials.trelloApiToken = parsed.apiToken;
              break;
            case 'groq':
              credentials.groqApiKey = parsed.apiKey;
              break;
          }
        } catch (decryptErr) {
          logger.error(`[TenantResolver] Failed to decrypt ${row.service_name} credentials:`, decryptErr);
        }
      }

      // Fill in platform defaults for missing credentials (free tier)
      const finalCredentials = { ...this.getDefaultCredentials(), ...credentials };

      // Cache the result
      this.credentialCache.set(userId, {
        credentials: finalCredentials,
        expires: Date.now() + this.CACHE_TTL,
      });

      return finalCredentials;
    } catch (err) {
      logger.error(`[TenantResolver] Error getting credentials for user ${userId}:`, err);
      return this.getDefaultCredentials();
    }
  }

  /**
   * Platform default credentials for free tier users
   */
  private getDefaultCredentials(): UserCredentials {
    return {
      anthropicApiKey: process.env.PLATFORM_ANTHROPIC_KEY,
      elevenLabsApiKey: undefined, // Voice not available on free tier
      elevenLabsAgentId: undefined,
      finnhubApiKey: process.env.PLATFORM_FINNHUB_KEY,
      groqApiKey: process.env.PLATFORM_GROQ_KEY,
    };
  }

  /**
   * Register a new guild for a user
   */
  async registerGuild(userId: string, guildId: string, guildName: string): Promise<boolean> {
    try {
      // Check if user exists
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!profile) {
        logger.error(`[TenantResolver] User ${userId} not found`);
        return false;
      }

      // Check guild limits based on subscription
      const { count } = await this.supabase
        .from('guild_registrations')
        .select('id', { count: 'exact' })
        .eq('user_id', userId);

      // For now, allow 1 guild per user (can be expanded with tiers)
      if ((count || 0) >= 1) {
        logger.warn(`[TenantResolver] User ${userId} has reached guild limit`);
        return false;
      }

      // Register the guild
      const { error } = await this.supabase
        .from('guild_registrations')
        .upsert({
          user_id: userId,
          guild_id: guildId,
          guild_name: guildName,
          is_active: true,
          registered_at: new Date().toISOString(),
        });

      if (error) {
        logger.error(`[TenantResolver] Failed to register guild:`, error);
        return false;
      }

      // Clear cache
      this.tenantCache.delete(guildId);

      logger.info(`[TenantResolver] Registered guild ${guildId} for user ${userId}`);
      return true;
    } catch (err) {
      logger.error(`[TenantResolver] Error registering guild:`, err);
      return false;
    }
  }

  /**
   * Unregister a guild
   */
  async unregisterGuild(guildId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('guild_registrations')
        .delete()
        .eq('guild_id', guildId);

      if (error) {
        logger.error(`[TenantResolver] Failed to unregister guild:`, error);
        return false;
      }

      // Clear cache
      this.tenantCache.delete(guildId);

      logger.info(`[TenantResolver] Unregistered guild ${guildId}`);
      return true;
    } catch (err) {
      logger.error(`[TenantResolver] Error unregistering guild:`, err);
      return false;
    }
  }

  /**
   * Check if a user can perform an action based on their subscription
   */
  async checkFeatureAccess(
    guildId: string,
    feature: keyof TenantFeatures
  ): Promise<{ allowed: boolean; limit?: number; reason?: string }> {
    const tenant = await this.resolveTenant(guildId);

    if (!tenant) {
      return { allowed: false, reason: 'Guild not registered. Visit app.agentflow.ai to connect your server.' };
    }

    if (!tenant.isActive) {
      return { allowed: false, reason: 'Subscription inactive. Please renew at app.agentflow.ai' };
    }

    const featureValue = tenant.features[feature];

    if (typeof featureValue === 'boolean') {
      return {
        allowed: featureValue,
        reason: featureValue ? undefined : `${feature} requires Pro subscription`,
      };
    }

    if (typeof featureValue === 'number') {
      return {
        allowed: featureValue === -1 || featureValue > 0,
        limit: featureValue,
      };
    }

    return { allowed: true };
  }

  /**
   * Track usage for billing
   */
  async trackUsage(
    userId: string,
    usageType: 'claude_tokens' | 'tts_characters' | 'agent_execution' | 'api_call',
    quantity: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase.from('usage_logs').insert({
        user_id: userId,
        usage_type: usageType,
        quantity,
        cost_estimate: this.estimateCost(usageType, quantity),
        metadata,
        recorded_at: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(`[TenantResolver] Failed to track usage:`, err);
    }
  }

  private estimateCost(type: string, quantity: number): number {
    const rates: Record<string, number> = {
      claude_tokens: 0.000003,
      tts_characters: 0.00003,
      agent_execution: 0.01,
      api_call: 0.0001,
    };
    return (rates[type] || 0) * quantity;
  }

  /**
   * Encryption helpers
   */
  private encryptCredential(plainText: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptCredential(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Clear caches (useful when credentials are updated)
   */
  clearCache(userId?: string, guildId?: string): void {
    if (userId) {
      this.credentialCache.delete(userId);
    }
    if (guildId) {
      this.tenantCache.delete(guildId);
    }
    if (!userId && !guildId) {
      this.tenantCache.clear();
      this.credentialCache.clear();
    }
  }

  /**
   * Get Supabase client for direct queries (scoped to user)
   */
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}

// Singleton instance
let tenantResolverInstance: TenantResolver | null = null;

export function getTenantResolver(): TenantResolver {
  if (!tenantResolverInstance) {
    tenantResolverInstance = new TenantResolver();
  }
  return tenantResolverInstance;
}






