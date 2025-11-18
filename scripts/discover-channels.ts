import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Script to discover all channels in the Discord server
 * This helps identify market-related channels for Atlas bot configuration
 */
async function discoverChannels() {
  // Use main bot token since Atlas isn't in server yet
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.MARKET_UPDATES_GUILD_ID;

  if (!token) {
    console.error('❌ DISCORD_TOKEN not found in .env');
    process.exit(1);
  }

  if (!guildId) {
    console.error('❌ MARKET_UPDATES_GUILD_ID not found in .env');
    process.exit(1);
  }

  console.log('🔍 Discovering channels in Discord server...\n');

  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once('ready', async () => {
    console.log(`✅ Connected as ${client.user?.tag}\n`);

    try {
      const guild = await client.guilds.fetch(guildId);
      const channels = await guild.channels.fetch();

      console.log(`📊 Server: ${guild.name}`);
      console.log(`📡 Total Channels: ${channels.size}\n`);

      // Filter text channels only
      const textChannels = channels.filter(
        channel => channel?.type === ChannelType.GuildText
      );

      console.log('📝 TEXT CHANNELS:');
      console.log('='.repeat(80));

      // Market-related keywords
      const marketKeywords = [
        'market', 'finance', 'crypto', 'trading', 'global', 'ai',
        'alert', 'portfolio', 'stock', 'thesis', 'analysis', 'economic'
      ];

      const marketChannels: any[] = [];
      const otherChannels: any[] = [];

      textChannels.forEach(channel => {
        if (!channel) return;

        const isMarketRelated = marketKeywords.some(keyword =>
          channel.name.toLowerCase().includes(keyword)
        );

        const channelInfo = {
          id: channel.id,
          name: channel.name,
          position: (channel as any).position
        };

        if (isMarketRelated) {
          marketChannels.push(channelInfo);
        } else {
          otherChannels.push(channelInfo);
        }
      });

      // Sort by position
      marketChannels.sort((a, b) => a.position - b.position);
      otherChannels.sort((a, b) => a.position - b.position);

      console.log('\n🌏 MARKET-RELATED CHANNELS (Recommended for Atlas):');
      console.log('-'.repeat(80));
      if (marketChannels.length === 0) {
        console.log('⚠️  No channels found with market keywords');
      } else {
        marketChannels.forEach(ch => {
          console.log(`  #${ch.name.padEnd(30)} → ${ch.id}`);
        });
      }

      console.log('\n📋 OTHER CHANNELS:');
      console.log('-'.repeat(80));
      otherChannels.forEach(ch => {
        console.log(`  #${ch.name.padEnd(30)} → ${ch.id}`);
      });

      console.log('\n' + '='.repeat(80));
      console.log('\n📝 RECOMMENDED CONFIGURATION:\n');

      if (marketChannels.length >= 3) {
        const topThree = marketChannels.slice(0, 3);
        console.log('# Add to .env:');
        console.log(`GLOBAL_MARKETS_CHANNELS=${topThree.map(ch => ch.id).join(',')}`);
        console.log('\n# Channel mapping:');
        topThree.forEach(ch => {
          console.log(`# - #${ch.name} (${ch.id})`);
        });
      } else if (marketChannels.length > 0) {
        console.log('# Add to .env:');
        console.log(`GLOBAL_MARKETS_CHANNELS=${marketChannels.map(ch => ch.id).join(',')}`);
        console.log('\n# Channel mapping:');
        marketChannels.forEach(ch => {
          console.log(`# - #${ch.name} (${ch.id})`);
        });
        console.log(`\n⚠️  Only ${marketChannels.length} market-related channels found.`);
        console.log('You mentioned 3 channels - please manually add any additional channel IDs.');
      } else {
        console.log('⚠️  No market-related channels auto-detected.');
        console.log('Please manually identify the 3 channels and add their IDs to .env');
      }

      console.log('\n✅ Discovery complete!');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

  await client.login(token);
}

discoverChannels().catch(console.error);
