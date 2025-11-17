import OpenAI from 'openai';
import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

export class TextToSpeechService {
  private openai: OpenAI;
  private audioDir: string;
  private speed: number;

  constructor(apiKey: string, speed: number = 1.0) {
    this.openai = new OpenAI({ apiKey });
    this.audioDir = path.join(process.cwd(), 'tts_audio');
    // Speed can be 0.25 to 4.0 (1.0 is normal, higher is faster)
    this.speed = Math.max(0.25, Math.min(4.0, speed));

    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }

    logger.info(`TTS Service initialized with speed: ${this.speed}x`);
  }

  async generateSpeech(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova', customSpeed?: number): Promise<string> {
    try {
      logger.info(`Generating speech for text: ${text.substring(0, 50)}...`);

      const mp3Path = path.join(this.audioDir, `${Date.now()}.mp3`);
      const speedToUse = customSpeed !== undefined 
        ? Math.max(0.25, Math.min(4.0, customSpeed))
        : this.speed;

      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: voice,
        input: text,
        speed: speedToUse,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      await fs.promises.writeFile(mp3Path, buffer);

      logger.info(`Speech generated successfully at ${speedToUse}x speed: ${mp3Path}`);
      return mp3Path;
    } catch (error) {
      logger.error('Failed to generate speech', error);
      throw error;
    }
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.25, Math.min(4.0, speed));
    logger.info(`TTS speed updated to: ${this.speed}x`);
  }

  getSpeed(): number {
    return this.speed;
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
