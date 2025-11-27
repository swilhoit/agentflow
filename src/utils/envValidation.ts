import { logger } from './logger';

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate required and optional environment variables
 */
export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Required for Discord bot
  if (!process.env.DISCORD_TOKEN) {
    missing.push('DISCORD_TOKEN');
  }

  // Required for Claude API
  if (!process.env.ANTHROPIC_API_KEY) {
    missing.push('ANTHROPIC_API_KEY');
  }

  // Required for Hetzner VPS
  if (!process.env.HETZNER_SERVER_IP) {
    warnings.push('HETZNER_SERVER_IP not set - using default 178.156.198.233');
  }

  // GitHub token - required for repo operations
  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    warnings.push('GITHUB_TOKEN/GH_TOKEN not set - Git operations will fail');
  }

  // ElevenLabs - required for voice
  if (!process.env.ELEVENLABS_API_KEY) {
    warnings.push('ELEVENLABS_API_KEY not set - Voice features disabled');
  }

  // Vercel - optional
  if (!process.env.VERCEL_API_TOKEN) {
    warnings.push('VERCEL_API_TOKEN not set - Vercel monitoring disabled');
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

/**
 * Log validation results and optionally exit on failure
 */
export function validateAndLog(exitOnFailure: boolean = true): boolean {
  const result = validateEnvironment();

  if (result.warnings.length > 0) {
    logger.warn('⚠️  Environment warnings:');
    result.warnings.forEach(w => logger.warn(`   - ${w}`));
  }

  if (!result.valid) {
    logger.error('❌ Missing required environment variables:');
    result.missing.forEach(m => logger.error(`   - ${m}`));

    if (exitOnFailure) {
      logger.error('Exiting due to missing required configuration.');
      process.exit(1);
    }
    return false;
  }

  logger.info('✅ Environment validation passed');
  return true;
}

/**
 * Check if a specific feature is available based on env vars
 */
export function isFeatureAvailable(feature: 'voice' | 'github' | 'vercel' | 'hetzner'): boolean {
  switch (feature) {
    case 'voice':
      return !!process.env.ELEVENLABS_API_KEY;
    case 'github':
      return !!(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
    case 'vercel':
      return !!process.env.VERCEL_API_TOKEN;
    case 'hetzner':
      return !!process.env.HETZNER_SERVER_IP;
    default:
      return false;
  }
}
