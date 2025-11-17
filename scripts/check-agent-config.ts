import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import * as dotenv from 'dotenv';

dotenv.config();

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID!;
const API_KEY = process.env.ELEVENLABS_API_KEY!;

async function checkAgentConfig() {
  console.log('🔍 Checking ElevenLabs Agent Configuration...');
  console.log(`Agent ID: ${AGENT_ID}`);
  
  const client = new ElevenLabsClient({ apiKey: API_KEY });
  
  try {
    const agent = await client.conversationalAi.agents.get(AGENT_ID);
    
    console.log('\n📋 Agent Configuration:');
    console.log('Name:', agent.name);
    console.log('\n🎤 ASR (Speech Recognition) Settings:');
    console.log(JSON.stringify(agent.conversationConfig?.asr, null, 2));
    console.log('\n🔄 Turn Detection Settings:');
    console.log(JSON.stringify(agent.conversationConfig?.turn, null, 2));
    console.log('\n📝 Agent Prompt (first 200 chars):');
    console.log((agent.conversationConfig?.agent?.prompt as any)?.prompt?.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('❌ Failed to get agent config:', error);
    process.exit(1);
  }
}

checkAgentConfig();

