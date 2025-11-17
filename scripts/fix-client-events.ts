import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import * as dotenv from 'dotenv';

dotenv.config();

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID!;
const API_KEY = process.env.ELEVENLABS_API_KEY!;

async function fixClientEvents() {
  console.log('🔧 Fixing ElevenLabs Agent Client Events...');
  console.log(`Agent ID: ${AGENT_ID}\n`);
  
  const client = new ElevenLabsClient({ apiKey: API_KEY });
  
  try {
    // Get current config
    const currentAgent = await client.conversationalAi.agents.get(AGENT_ID);
    console.log('📋 Current Client Events:', currentAgent.conversationConfig?.conversation?.clientEvents);
    
    // Update with ALL necessary client events
    const result = await client.conversationalAi.agents.update(AGENT_ID, {
      conversationConfig: {
        conversation: {
          textOnly: false,
          maxDurationSeconds: 600,
          clientEvents: [
            'audio',                              // Audio events
            'interruption',                       // Interruption events (for interrupting agent)
            'agent_response',                     // Agent text responses (CRITICAL!)
            'user_transcript',                    // User speech transcriptions (CRITICAL!)
            'agent_response_correction',          // Agent response corrections
            'agent_tool_response',                // Tool/function call responses
            'conversation_initiation_metadata'    // Conversation metadata
          ]
        }
      } as any
    });
    
    console.log('\n✅ Client events fixed successfully!');
    console.log('New Client Events:', result.conversationConfig?.conversation?.clientEvents);
    console.log('\n✨ The agent should now properly send:');
    console.log('   - User transcriptions (when you speak)');
    console.log('   - Agent responses (when it speaks)');
    console.log('   - Tool call results');
    console.log('   - Interruption events');
    
  } catch (error) {
    console.error('\n❌ Failed to fix client events:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

fixClientEvents();

