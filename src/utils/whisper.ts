import OpenAI from 'openai';
import { logger } from './logger';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';

export class WhisperService {
  private client: OpenAI;
  private tempDir: string;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
    this.tempDir = path.join(process.cwd(), 'temp');

    // Ensure temp directory exists
    this.ensureTempDir();
  }

  private async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory', error);
    }
  }

  async transcribeAudio(audioPath: string): Promise<string> {
    try {
      logger.info(`Transcribing audio file: ${audioPath}`);

      // Use fs.createReadStream (from 'fs', not 'fs/promises') for OpenAI API compatibility
      const file = createReadStream(audioPath);

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
      // Write buffer to temporary file asynchronously
      await fs.writeFile(tempPath, buffer);

      const result = await this.transcribeAudio(tempPath);

      return result;
    } finally {
      // Clean up temporary file asynchronously
      try {
        await fs.unlink(tempPath);
      } catch (e) {
        // Ignore errors if file doesn't exist or can't be deleted
      }
    }
  }

  async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 3600000; // 1 hour

      // Process cleanup in parallel
      await Promise.all(files.map(async (file) => {
        try {
          const filePath = path.join(this.tempDir, file);
          const stats = await fs.stat(filePath);

          if (now - stats.mtimeMs > maxAge) {
            await fs.unlink(filePath);
            logger.debug(`Cleaned up old temp file: ${file}`);
          }
        } catch (err) {
          // Ignore errors for individual files
          logger.warn(`Failed to cleanup individual file: ${file}`, err);
        }
      }));
    } catch (error) {
      logger.error('Failed to cleanup temp files', error);
    }
  }
}
