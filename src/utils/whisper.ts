import OpenAI from 'openai';
import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

export class WhisperService {
  private client: OpenAI;
  private tempDir: string;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
    this.tempDir = path.join(process.cwd(), 'temp');

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async transcribeAudio(audioPath: string): Promise<string> {
    try {
      logger.info(`Transcribing audio file: ${audioPath}`);

      const file = fs.createReadStream(audioPath);

      const transcription = await this.client.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'en',
        response_format: 'text'
      });

      logger.info('Transcription completed successfully');
      return transcription as string;
    } catch (error) {
      logger.error('Failed to transcribe audio', error);
      throw new Error(`Transcription failed: ${error}`);
    }
  }

  async transcribeBuffer(buffer: Buffer, filename: string = 'audio.wav'): Promise<string> {
    const tempPath = path.join(this.tempDir, `${Date.now()}_${filename}`);

    try {
      // Write buffer to temporary file
      fs.writeFileSync(tempPath, buffer);

      const result = await this.transcribeAudio(tempPath);

      return result;
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  cleanupTempFiles(): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const maxAge = 3600000; // 1 hour

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          logger.debug(`Cleaned up old temp file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup temp files', error);
    }
  }
}
