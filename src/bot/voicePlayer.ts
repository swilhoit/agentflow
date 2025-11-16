import {
  VoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  getVoiceConnection
} from '@discordjs/voice';
import { logger } from '../utils/logger';
import * as fs from 'fs';

export class VoicePlayer {
  private players: Map<string, any> = new Map();

  async playAudio(guildId: string, audioPath: string): Promise<void> {
    try {
      const connection = getVoiceConnection(guildId);

      if (!connection) {
        logger.warn(`No voice connection for guild ${guildId}`);
        return;
      }

      logger.info(`Playing audio file: ${audioPath}`);

      // Create or get audio player for this guild
      let player = this.players.get(guildId);
      if (!player) {
        player = createAudioPlayer();
        this.players.set(guildId, player);
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
          logger.info('Audio playback finished');
        });

        player.on('error', (error: Error) => {
          logger.error('Audio player error', error);
        });
      }

      // Create audio resource from file
      const resource = createAudioResource(audioPath);
      player.play(resource);

      logger.info('Audio playback started');

      // Wait for playback to finish
      await new Promise<void>((resolve) => {
        const checkIdle = () => {
          if (player.state.status === AudioPlayerStatus.Idle) {
            resolve();
          } else {
            setTimeout(checkIdle, 100);
          }
        };
        checkIdle();
      });

      // Clean up the audio file after playback
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
        logger.info(`Cleaned up audio file: ${audioPath}`);
      }
    } catch (error) {
      logger.error('Failed to play audio', error);
    }
  }

  stopPlayback(guildId: string): void {
    const player = this.players.get(guildId);
    if (player) {
      player.stop();
      logger.info(`Stopped playback for guild ${guildId}`);
    }
  }

  cleanup(guildId: string): void {
    const player = this.players.get(guildId);
    if (player) {
      player.stop();
      this.players.delete(guildId);
      logger.info(`Cleaned up player for guild ${guildId}`);
    }
  }
}
