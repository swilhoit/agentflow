#!/usr/bin/env ts-node

import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { DiscordChannelAwareness, MessageType } from '../services/discordChannelAwareness';

dotenv.config();

interface IntelligentSendOptions {
  guildId: string;
  message: string;
  messageType?: MessageType;
  projectName?: string;
}

/**
 * Send a message with intelligent channel routing
 * Usage:
 *   ts-node scripts/discord-intelligent-send.ts <guildId> <messageType> <message> [projectName]
 */
async function intelligentSend(options: IntelligentSendOptions): Promise<void> {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN not found in .env file');
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  return new Promise((resolve, reject) => {
    client.once('ready', async () => {
      try {
        console.log(`✅ Discord client ready as ${client.user?.tag}\n`);

        // Initialize channel awareness
        const channelAwareness = new DiscordChannelAwareness(client);

        // Discover server structure
        console.log(`🔍 Discovering server structure...`);
        const structure = await channelAwareness.discoverGuildStructure(options.guildId);
        console.log(`✅ Found ${structure.channels.length} channels in ${structure.categories.size} categories\n`);

        // Find best channel
        console.log(`🎯 Finding best channel for message type: ${options.messageType || 'general'}`);
        const channelId = await channelAwareness.findBestChannel(
          options.guildId,
          options.messageType || 'general',
          options.message,
          options.projectName
        );

        if (!channelId) {
          throw new Error('Could not find appropriate channel');
        }

        const channelInfo = await channelAwareness.getChannelInfo(options.guildId, channelId);
        console.log(`📍 Selected channel: #${channelInfo?.name} (${channelInfo?.purpose})\n`);

        // Send message
        const guild = await client.guilds.fetch(options.guildId);
        const channel = await guild.channels.fetch(channelId);

        if (!channel || !channel.isTextBased()) {
          throw new Error(`Channel ${channelId} is not a text channel`);
        }

        await channel.send(options.message);
        console.log(`✅ Message sent successfully!`);
        console.log(`📝 Message: ${options.message.substring(0, 100)}${options.message.length > 100 ? '...' : ''}`);

        client.destroy();
        resolve();
      } catch (error) {
        client.destroy();
        reject(error);
      }
    });

    client.on('error', (error) => {
      console.error('❌ Discord client error:', error);
      client.destroy();
      reject(error);
    });

    // Login
    client.login(process.env.DISCORD_TOKEN).catch(reject);

    // Timeout after 30 seconds
    setTimeout(() => {
      client.destroy();
      reject(new Error('Connection timeout after 30 seconds'));
    }, 30000);
  });
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Usage: ts-node discord-intelligent-send.ts <guildId> <messageType> <message> [projectName]');
    console.error('');
    console.error('Message Types:');
    console.error('  agent_update, error, warning, success, deployment, finance, goal,');
    console.error('  project_update, crypto, general, command_result, thinking, code');
    console.error('');
    console.error('Examples:');
    console.error('  ts-node discord-intelligent-send.ts 1091835283210780735 agent_update "Agent started processing task"');
    console.error('  ts-node discord-intelligent-send.ts 1091835283210780735 finance "Budget threshold exceeded"');
    console.error('  ts-node discord-intelligent-send.ts 1091835283210780735 project_update "Deployed to prod" waterwise');
    console.error('  ts-node discord-intelligent-send.ts 1091835283210780735 error "Something went wrong"');
    process.exit(1);
  }

  const [guildId, messageType, message, projectName] = args;

  // Validate message type
  const validTypes: MessageType[] = [
    'agent_update', 'error', 'warning', 'success', 'deployment', 'finance',
    'goal', 'project_update', 'crypto', 'general', 'command_result', 'thinking', 'code'
  ];

  if (!validTypes.includes(messageType as MessageType)) {
    console.error(`❌ Invalid message type: ${messageType}`);
    console.error(`Valid types: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  intelligentSend({ 
    guildId, 
    message, 
    messageType: messageType as MessageType,
    projectName 
  })
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

export { intelligentSend };

