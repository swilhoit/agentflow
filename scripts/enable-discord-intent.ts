import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

/**
 * Enable MESSAGE_CONTENT intent for Atlas bot
 * This script uses Discord API to automatically enable the required privileged intent
 */
async function enableMessageContentIntent() {
  const botToken = process.env.ATLAS_DISCORD_TOKEN;
  const clientId = process.env.ATLAS_DISCORD_CLIENT_ID;

  if (!botToken || !clientId) {
    console.error('❌ Missing ATLAS_DISCORD_TOKEN or ATLAS_DISCORD_CLIENT_ID in .env');
    process.exit(1);
  }

  console.log('🔧 Enabling MESSAGE_CONTENT intent for Atlas bot...');
  console.log(`   Client ID: ${clientId}`);
  console.log('');

  try {
    // Get current bot configuration
    const response = await fetch(`https://discord.com/api/v10/applications/${clientId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to fetch bot configuration:', error);
      console.log('');
      console.log('⚠️  You need to enable MESSAGE_CONTENT intent manually:');
      console.log('   1. Go to https://discord.com/developers/applications');
      console.log(`   2. Select Atlas app (ID: ${clientId})`);
      console.log('   3. Bot → Privileged Gateway Intents');
      console.log('   4. Enable MESSAGE CONTENT INTENT');
      console.log('   5. Save Changes');
      process.exit(1);
    }

    const appData: any = await response.json();
    console.log(`✅ Found bot: ${appData.name}`);
    console.log('');

    // Note: The Discord API doesn't allow programmatic enabling of privileged intents
    // They must be enabled through the Developer Portal
    console.log('⚠️  MESSAGE_CONTENT is a privileged intent.');
    console.log('   Discord requires manual approval through the Developer Portal.');
    console.log('');
    console.log('📝 Please enable it manually:');
    console.log('   1. Go to https://discord.com/developers/applications');
    console.log(`   2. Select: ${appData.name} (${clientId})`);
    console.log('   3. Click "Bot" in left sidebar');
    console.log('   4. Scroll to "Privileged Gateway Intents"');
    console.log('   5. Toggle ON: "MESSAGE CONTENT INTENT"');
    console.log('   6. Click "Save Changes"');
    console.log('');
    console.log('✅ Then run: ./complete-atlas-setup.sh');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

enableMessageContentIntent();
