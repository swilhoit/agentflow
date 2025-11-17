import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import * as dotenv from 'dotenv';

dotenv.config();

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID!;
const API_KEY = process.env.ELEVENLABS_API_KEY!;

async function optimizeResponseSpeed() {
  console.log('🚀 Optimizing ElevenLabs Agent for faster responses...');
  console.log(`Agent ID: ${AGENT_ID}\n`);
  
  const client = new ElevenLabsClient({ apiKey: API_KEY });
  
  try {
    const result = await client.conversationalAi.agents.update(AGENT_ID, {
      conversationConfig: {
        asr: {
          quality: 'high',  // Keep high quality
          provider: 'elevenlabs',
          userInputAudioFormat: 'pcm_16000',
          keywords: []
        },
        turn: {
          mode: 'turn' as any,
          turnTimeout: 5,  // Reduced from 7 for faster responses
          turnEagerness: 'eager' as any,  // Keep eager for interruptions
          silenceEndCallTimeout: -1,
          softTimeoutConfig: {
            timeoutSeconds: -1,
            message: "Give me just a moment..."
          }
        },
        tts: {
          modelId: 'eleven_turbo_v2',  // Fastest model
          voiceId: process.env.ELEVENLABS_VOICE_ID || 'cjVigY5qzO86Huf0OWal',
          agentOutputAudioFormat: 'pcm_16000',
          optimizeStreamingLatency: 4,  // Maximum optimization (0-4, 4 is fastest)
          stability: 0.4,  // Slightly lower for faster generation
          speed: 1.1,  // Slightly faster speech (1.0-1.5)
          similarityBoost: 0.7,  // Lower for faster generation
          text_normalisation_type: 'system_prompt'
        }
      } as any
    });
    
    console.log('\n✅ Agent optimized for speed!');
    console.log('\n📊 Speed Optimizations:');
    console.log('   - Turn timeout: 5s (was 7s)');
    console.log('   - Streaming latency: Maximum (4)');
    console.log('   - Speech speed: 1.1x');
    console.log('   - TTS model: eleven_turbo_v2 (fastest)');
    console.log('   - Stability: 0.4 (faster generation)');
    console.log('\n🎯 Expected improvements:');
    console.log('   - Faster response initiation');
    console.log('   - Lower latency audio streaming');
    console.log('   - Quicker turn-taking');
    
  } catch (error) {
    console.error('\n❌ Failed to optimize agent:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

optimizeResponseSpeed();

