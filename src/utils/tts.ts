import OpenAI from 'openai';
import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

export class TextToSpeechService {
  private openai: OpenAI;
  private audioDir: string;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    this.audioDir = path.join(process.cwd(), 'tts_audio');

    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  async generateSpeech(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'): Promise<string> {
    try {
      logger.info(`Generating speech for text: ${text.substring(0, 50)}...`);

      const mp3Path = path.join(this.audioDir, `${Date.now()}.mp3`);

      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: voice,
        input: text,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      await fs.promises.writeFile(mp3Path, buffer);

      logger.info(`Speech generated successfully: ${mp3Path}`);
      return mp3Path;
    } catch (error) {
      logger.error('Failed to generate speech', error);
      throw error;
    }
  }

  async cleanupOldFiles(maxAgeMs: number = 3600000): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.audioDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.audioDir, file);
        const stats = await fs.promises.stat(filePath);

        if (now - stats.mtimeMs > maxAgeMs) {
          await fs.promises.unlink(filePath);
          logger.info(`Cleaned up old TTS file: ${filePath}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup TTS files', error);
    }
  }
}
