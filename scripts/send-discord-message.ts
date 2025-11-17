#!/usr/bin/env ts-node

import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

interface MessageOptions {
  channelId: string;
  message: string;
  guildId?: string;
}

/**
 * Send a message to a Discord channel
 * Usage:
 *   ts-node scripts/send-discord-message.ts <channelId> <message>
 * Or programmatically:
 *   import { sendDiscordMessage } from './scripts/send-discord-message';
 *   await sendDiscordMessage({ channelId: '123', message: 'Hello!' });
 */
export async function sendDiscordMessage(options: MessageOptions): Promise<void> {
  const { channelId, message, guildId } = options;

  if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN not found in .env file');
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  return new Promise((resolve, reject) => {
    client.once('ready', async () => {
      try {
        console.log(`✅ Discord client ready as ${client.user?.tag}`);

        // Fetch the channel
        let channel;
        if (guildId) {
          const guild = await client.guilds.fetch(guildId);
          channel = await guild.channels.fetch(channelId);
        } else {
          channel = await client.channels.fetch(channelId);
        }

        if (!channel || !channel.isTextBased()) {
          throw new Error(`Channel ${channelId} not found or is not a text channel`);
        }

        // Send the message
        await (channel as TextChannel).send(message);
        console.log(`✅ Message sent to channel ${channelId}`);
        console.log(`📝 Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

        // Disconnect
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

    // Timeout after 10 seconds
    setTimeout(() => {
      client.destroy();
      reject(new Error('Connection timeout after 10 seconds'));
    }, 10000);
  });
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: ts-node send-discord-message.ts <channelId> <message> [guildId]');
    console.error('');
    console.error('Example:');
    console.error('  ts-node send-discord-message.ts 1234567890 "Hello from Cursor!"');
    console.error('  ts-node send-discord-message.ts 1234567890 "Hello!" 9876543210');
    process.exit(1);
  }

  const [channelId, message, guildId] = args;

  sendDiscordMessage({ channelId, message, guildId })
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

