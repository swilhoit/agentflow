import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface GeneratedImage {
  success: boolean;
  localPath?: string;
  publicUrl?: string;
  error?: string;
  prompt: string;
  timestamp: Date;
}

/**
 * Image Generation Service using Google Gemini "Nano Banana"
 *
 * Nano Banana is the codename for Google's Gemini image generation models:
 * - Nano Banana = Gemini 2.5 Flash Image (gemini-2.0-flash-exp with image output)
 * - Nano Banana Pro = Gemini 3 Pro Image (coming soon)
 *
 * Generates images from text prompts and saves them to the workspace.
 */
export class ImageGenerationService {
  private genAI: GoogleGenerativeAI | null = null;
  private outputDir: string;
  private publicBaseUrl: string;

  constructor(config?: {
    apiKey?: string;
    outputDir?: string;
    publicBaseUrl?: string;
  }) {
    const apiKey = config?.apiKey || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      logger.info('🎨 ImageGenerationService initialized with Gemini API');
    } else {
      logger.warn('⚠️ ImageGenerationService: No GOOGLE_AI_API_KEY or GEMINI_API_KEY found');
    }

    // Default output to workspace images directory
    this.outputDir = config?.outputDir || process.env.IMAGE_OUTPUT_DIR || '/workspace/public/images/generated';
    this.publicBaseUrl = config?.publicBaseUrl || process.env.IMAGE_PUBLIC_URL || '/images/generated';
  }

  /**
   * Check if the service is available
   */
  isAvailable(): boolean {
    return this.genAI !== null;
  }

  /**
   * Generate an image using Gemini Imagen
   */
  async generateImage(
    prompt: string,
    options?: {
      filename?: string;
      width?: number;
      height?: number;
      style?: 'photorealistic' | 'artistic' | 'digital-art' | 'sketch';
      outputDir?: string;
    }
  ): Promise<GeneratedImage> {
    if (!this.genAI) {
      return {
        success: false,
        error: 'Image generation not configured. Set GOOGLE_AI_API_KEY or GEMINI_API_KEY.',
        prompt,
        timestamp: new Date()
      };
    }

    try {
      logger.info(`🎨 Generating image: "${prompt.substring(0, 50)}..."`);

      // Use Nano Banana (Gemini 2.5 Flash Image) for image generation
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
        generationConfig: {
          // @ts-ignore - responseModalities is valid for image generation
          responseModalities: ['TEXT', 'IMAGE']
        }
      });

      // Enhance prompt with style if specified
      let enhancedPrompt = prompt;
      if (options?.style) {
        const stylePrompts: Record<string, string> = {
          'photorealistic': 'photorealistic, high quality photograph, professional lighting',
          'artistic': 'artistic illustration, painterly style, creative',
          'digital-art': 'digital art, modern design, clean vectors',
          'sketch': 'pencil sketch, hand-drawn style, artistic'
        };
        enhancedPrompt = `${prompt}, ${stylePrompts[options.style]}`;
      }

      // Generate the image
      const result = await model.generateContent(enhancedPrompt);
      const response = result.response;

      // Extract image data from response
      let imageData: Buffer | null = null;
      let mimeType = 'image/png';

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageData = Buffer.from(part.inlineData.data, 'base64');
          mimeType = part.inlineData.mimeType || 'image/png';
          break;
        }
      }

      if (!imageData) {
        // Fallback: Try using Imagen directly if available
        return await this.generateWithImagen(prompt, options);
      }

      // Generate filename
      const hash = crypto.createHash('md5').update(prompt).digest('hex').substring(0, 8);
      const extension = mimeType.includes('jpeg') ? 'jpg' : 'png';
      const filename = options?.filename || `generated-${hash}-${Date.now()}.${extension}`;

      // Ensure output directory exists
      const outputDir = options?.outputDir || this.outputDir;
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Save the image
      const localPath = path.join(outputDir, filename);
      fs.writeFileSync(localPath, imageData);

      const publicUrl = `${this.publicBaseUrl}/${filename}`;

      logger.info(`✅ Image generated and saved: ${localPath}`);

      return {
        success: true,
        localPath,
        publicUrl,
        prompt,
        timestamp: new Date()
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Image generation failed: ${errorMsg}`);

      return {
        success: false,
        error: errorMsg,
        prompt,
        timestamp: new Date()
      };
    }
  }

  /**
   * Fallback: Generate using Nano Banana Pro (Gemini 3 Pro Image)
   */
  private async generateWithImagen(
    prompt: string,
    options?: {
      filename?: string;
      outputDir?: string;
    }
  ): Promise<GeneratedImage> {
    if (!this.genAI) {
      return {
        success: false,
        error: 'Gemini API not configured',
        prompt,
        timestamp: new Date()
      };
    }

    try {
      // Try Nano Banana Pro (Gemini 3 Pro Image) as fallback
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3-pro-image-preview',
        generationConfig: {
          // @ts-ignore
          responseModalities: ['TEXT', 'IMAGE']
        }
      });

      const result = await model.generateContent(prompt);
      const response = result.response;

      // Extract image from response
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const imageData = Buffer.from(part.inlineData.data, 'base64');
          const hash = crypto.createHash('md5').update(prompt).digest('hex').substring(0, 8);
          const filename = options?.filename || `imagen-${hash}-${Date.now()}.png`;

          const outputDir = options?.outputDir || this.outputDir;
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const localPath = path.join(outputDir, filename);
          fs.writeFileSync(localPath, imageData);

          return {
            success: true,
            localPath,
            publicUrl: `${this.publicBaseUrl}/${filename}`,
            prompt,
            timestamp: new Date()
          };
        }
      }

      return {
        success: false,
        error: 'No image data in Imagen response',
        prompt,
        timestamp: new Date()
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Imagen fallback failed: ${errorMsg}`,
        prompt,
        timestamp: new Date()
      };
    }
  }

  /**
   * Generate multiple images for a batch of prompts
   */
  async generateBatch(
    prompts: { prompt: string; filename?: string }[],
    options?: {
      outputDir?: string;
      style?: 'photorealistic' | 'artistic' | 'digital-art' | 'sketch';
      delayMs?: number;
    }
  ): Promise<GeneratedImage[]> {
    const results: GeneratedImage[] = [];
    const delayMs = options?.delayMs || 1000; // Rate limiting

    for (const item of prompts) {
      const result = await this.generateImage(item.prompt, {
        filename: item.filename,
        outputDir: options?.outputDir,
        style: options?.style
      });
      results.push(result);

      // Rate limit to avoid API throttling
      if (prompts.indexOf(item) < prompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }
}

// Singleton instance
let imageGenerationService: ImageGenerationService | null = null;

export function getImageGenerationService(): ImageGenerationService {
  if (!imageGenerationService) {
    imageGenerationService = new ImageGenerationService();
  }
  return imageGenerationService;
}

export function initializeImageGeneration(config?: {
  apiKey?: string;
  outputDir?: string;
  publicBaseUrl?: string;
}): ImageGenerationService {
  imageGenerationService = new ImageGenerationService(config);
  return imageGenerationService;
}
