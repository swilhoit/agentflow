#!/usr/bin/env ts-node

import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * List all channels in a Discord server (guild)
 * Usage:
 *   ts-node scripts/list-discord-channels.ts [guildId]
 * If guildId is not provided, lists all guilds the bot is in
 */
async function listDiscordChannels(guildId?: string): Promise<void> {
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

        // If no guild ID provided, list all guilds
        if (!guildId) {
          console.log('📋 Guilds (Servers) the bot is in:\n');
          const guilds = await client.guilds.fetch();
          guilds.forEach((guild) => {
            console.log(`  • ${guild.name}`);
            console.log(`    ID: ${guild.id}`);
            console.log(`    Use: ts-node scripts/list-discord-channels.ts ${guild.id}\n`);
          });
          
          if (guilds.size === 0) {
            console.log('  No guilds found. Make sure the bot has been added to a server.');
          }
          
          client.destroy();
          resolve();
          return;
        }

        // Fetch specific guild and list channels
        const guild = await client.guilds.fetch(guildId);
        console.log(`📋 Channels in "${guild.name}":\n`);

        const channels = await guild.channels.fetch();
        
        // Group by category
        const categories = new Map<string, any[]>();
        
        channels.forEach((channel) => {
          if (!channel) return;
          
          const categoryName = channel.parent?.name || 'No Category';
          if (!categories.has(categoryName)) {
            categories.set(categoryName, []);
          }
          categories.get(categoryName)!.push(channel);
        });

        // Display channels grouped by category
        categories.forEach((channelList, categoryName) => {
          console.log(`\n📁 ${categoryName}:`);
          channelList
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .forEach((channel) => {
          const typeIconMap: Record<number, string> = {
            [ChannelType.GuildText]: '#',
            [ChannelType.GuildVoice]: '🔊',
            [ChannelType.GuildCategory]: '📁',
            [ChannelType.GuildAnnouncement]: '📢',
            [ChannelType.GuildForum]: '💬',
            [ChannelType.GuildStageVoice]: '🎙️'
          };
          const typeIcon = typeIconMap[channel.type] || '❓';

              // Skip categories in the list
              if (channel.type === ChannelType.GuildCategory) return;

              console.log(`  ${typeIcon} ${channel.name}`);
              console.log(`     ID: ${channel.id}`);
              if (channel.type === ChannelType.GuildText && 'topic' in channel && channel.topic) {
                console.log(`     Topic: ${channel.topic.substring(0, 60)}${channel.topic.length > 60 ? '...' : ''}`);
              }
              console.log('');
            });
        });

        console.log('\n💡 To send a message to a channel:');
        console.log('   ts-node scripts/send-discord-message.ts <channelId> "Your message"');

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
  const guildId = args[0];

  listDiscordChannels(guildId)
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { listDiscordChannels };

