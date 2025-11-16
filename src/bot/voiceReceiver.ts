import {
  VoiceConnection,
  EndBehaviorType,
  getVoiceConnection
} from '@discordjs/voice';
import { VoiceCommand } from '../types';
import { WhisperService } from '../utils/whisper';
import { logger } from '../utils/logger';
import * as prism from 'prism-media';
import { pipeline } from 'stream';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const pipelineAsync = promisify(pipeline);

export class VoiceReceiver {
  private whisperService: WhisperService;
  private recording: Map<string, any> = new Map();
  private audioDir: string;
  private commandCallback?: (command: VoiceCommand) => Promise<void>;

  constructor(whisperService: WhisperService) {
    this.whisperService = whisperService;
    this.audioDir = path.join(process.cwd(), 'audio');

    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  setCommandCallback(callback: (command: VoiceCommand) => Promise<void>): void {
    this.commandCallback = callback;
  }

  startListening(connection: VoiceConnection, guildId: string): void {
    const receiver = connection.receiver;

    receiver.speaking.on('start', (userId) => {
      // Skip if already recording for this user
      if (this.recording.has(userId)) {
        logger.info(`Already recording for user ${userId}, skipping`);
        return;
      }

      logger.info(`User ${userId} started speaking in guild ${guildId}`);

      const audioStream = receiver.subscribe(userId);
      logger.info(`Subscribed to audio stream for user ${userId}`);

      const oggStream = new prism.opus.Decoder({
        frameSize: 960,
        channels: 2,
        rate: 48000
      });

      const filename = `${userId}_${Date.now()}.pcm`;
      const outputPath = path.join(this.audioDir, filename);
      const outputStream = fs.createWriteStream(outputPath);

      // Auto-close stream after 10 seconds of recording
      const closeTimer = setTimeout(() => {
        if (audioStream && !audioStream.destroyed) {
          logger.info(`Auto-closing audio stream for user ${userId} after timeout`);
          audioStream.push(null);
        }
      }, 10000); // 10 seconds max recording

      // Store recording info
      this.recording.set(userId, {
        stream: outputStream,
        path: outputPath,
        audioStream,
        closeTimer
      });

      pipeline(audioStream, oggStream, outputStream, async (err) => {
        clearTimeout(closeTimer);
        if (err) {
          logger.error(`Pipeline error for user ${userId}`, err);
        } else {
          logger.info(`Audio saved for user ${userId}: ${outputPath}`);
          await this.processAudio(userId, guildId, outputPath);
        }
        this.recording.delete(userId);
      });
    });
  }

  private async processAudio(
    userId: string,
    guildId: string,
    audioPath: string
  ): Promise<void> {
    try {
      logger.info(`Processing audio for user ${userId}: ${audioPath}`);

      // Convert PCM to WAV for Whisper
      const wavPath = audioPath.replace('.pcm', '.wav');
      await this.convertPCMtoWAV(audioPath, wavPath);
      logger.info(`Converted PCM to WAV: ${wavPath}`);

      const transcript = await this.whisperService.transcribeAudio(wavPath);
      logger.info(`Transcription for user ${userId}: ${transcript}`);

      // Clean up audio files
      fs.unlinkSync(audioPath);
      fs.unlinkSync(wavPath);

      if (transcript.trim().length === 0) {
        logger.warn('Empty transcription, ignoring');
        return;
      }

      const command: VoiceCommand = {
        userId,
        guildId,
        channelId: '', // Will be set by the bot
        transcript,
        timestamp: new Date()
      };

      // Call the callback if set
      if (this.commandCallback) {
        logger.info(`Calling command callback with transcript: ${transcript}`);
        await this.commandCallback(command);
      } else {
        logger.warn('No command callback set, ignoring voice command');
      }
    } catch (error) {
      logger.error('Failed to process audio', error);
    }
  }

  private async convertPCMtoWAV(pcmPath: string, wavPath: string): Promise<void> {
    // This is a simplified conversion - you may need ffmpeg for better quality
    const pcmData = fs.readFileSync(pcmPath);

    // WAV header for 48kHz, 16-bit, stereo
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcmData.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk size
    header.writeUInt16LE(1, 20); // Audio format (PCM)
    header.writeUInt16LE(2, 22); // Num channels
    header.writeUInt32LE(48000, 24); // Sample rate
    header.writeUInt32LE(48000 * 2 * 2, 28); // Byte rate
    header.writeUInt16LE(4, 32); // Block align
    header.writeUInt16LE(16, 34); // Bits per sample
    header.write('data', 36);
    header.writeUInt32LE(pcmData.length, 40);

    const wavData = Buffer.concat([header, pcmData]);
    fs.writeFileSync(wavPath, wavData);
  }

  stopListening(guildId: string): void {
    const connection = getVoiceConnection(guildId);
    if (connection) {
      connection.receiver.speaking.removeAllListeners();
      logger.info(`Stopped listening in guild ${guildId}`);
    }
  }
}
