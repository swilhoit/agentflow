import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import * as dotenv from 'dotenv';

dotenv.config();

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID!;
const API_KEY = process.env.ELEVENLABS_API_KEY!;

async function enableInterruptions() {
  console.log('🔧 Enabling interruptions for ElevenLabs Agent...');
  console.log(`Agent ID: ${AGENT_ID}`);
  
  const client = new ElevenLabsClient({ apiKey: API_KEY });
  
  try {
    // Get current agent config
    const currentAgent = await client.conversationalAi.agents.get(AGENT_ID);
    console.log('\n📋 Current Client Events:', currentAgent.conversationConfig?.conversation?.clientEvents);
    
    // Update the agent to enable interruptions and optimize turn-taking
    const result = await client.conversationalAi.agents.update(AGENT_ID, {
      conversationConfig: {
        conversation: {
          textOnly: false,
          maxDurationSeconds: 600,
          clientEvents: ['interruption', 'conversation_initiation_metadata']  // Enable interruptions!
        },
        turn: {
          mode: 'turn' as any,
          turnTimeout: 7,
          turnEagerness: 'eager' as any,  // Make agent more responsive to interruptions
          silenceEndCallTimeout: -1,
          softTimeoutConfig: {
            timeoutSeconds: -1,
            message: "Hhmmmm...yeah give me a second..."
          }
        },
        agent: {
          disableFirstMessageInterruptions: false  // Allow interruptions from the start
        }
      } as any
    });
    
    console.log('\n✅ Interruptions enabled successfully!');
    console.log('New Client Events:', result.conversationConfig?.conversation?.clientEvents);
    console.log('Turn Eagerness:', result.conversationConfig?.turn?.turnEagerness);
    console.log('Disable First Message Interruptions:', result.conversationConfig?.agent?.disableFirstMessageInterruptions);
    
  } catch (error) {
    console.error('❌ Failed to enable interruptions:', error);
    process.exit(1);
  }
}

enableInterruptions();

