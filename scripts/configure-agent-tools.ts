import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import * as dotenv from 'dotenv';

dotenv.config();

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID!;
const API_KEY = process.env.ELEVENLABS_API_KEY!;

/**
 * Configure server-side tools for ElevenLabs agent
 * This tells the LLM that these functions exist and should be called
 */
async function configureAgentTools() {
  console.log('🔧 Configuring ElevenLabs Agent Tools...');
  console.log(`Agent ID: ${AGENT_ID}\n`);
  
  const client = new ElevenLabsClient({ apiKey: API_KEY });
  
  try {
    // Define the tools that the agent should know about
    const tools = [
      {
        type: 'function' as const,
        function: {
          name: 'execute_task',
          description: 'Execute complex tasks like deployments, terminal commands, API calls, Trello operations, or multi-step operations. CALL THIS whenever the user asks you to DO something with GitHub, Trello, Google Cloud, or terminal commands. DO NOT say you cannot do things - you CAN do them via this function!',
          parameters: {
            type: 'object',
            properties: {
              task_description: {
                type: 'string',
                description: 'Clear description of the task to execute (e.g., "List all Trello boards", "Run gh repo list", "Deploy to Cloud Run")'
              },
              task_type: {
                type: 'string',
                enum: ['terminal', 'deployment', 'api_call', 'analysis', 'general', 'trello', 'coding', 'auto'],
                description: 'The type of task: terminal (simple shell commands), trello (Trello operations), coding (multi-step workflows), auto (auto-detect)'
              },
              parameters: {
                type: 'object',
                description: 'Any additional parameters needed for the task',
                additionalProperties: true
              }
            },
            required: ['task_description', 'task_type']
          }
        }
      },
      {
        type: 'function' as const,
        function: {
          name: 'list_cloud_services',
          description: 'List all running Google Cloud Run services in the project',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function' as const,
        function: {
          name: 'deploy_to_cloud_run',
          description: 'Deploy a Docker container to Google Cloud Run',
          parameters: {
            type: 'object',
            properties: {
              service_name: {
                type: 'string',
                description: 'Name for the Cloud Run service'
              },
              image_name: {
                type: 'string',
                description: 'Name for the Docker image'
              },
              build_context: {
                type: 'string',
                description: 'Path to build context directory (default: ".")'
              },
              env_vars: {
                type: 'object',
                description: 'Environment variables',
                additionalProperties: { type: 'string' }
              }
            },
            required: ['service_name', 'image_name']
          }
        }
      },
      {
        type: 'function' as const,
        function: {
          name: 'spawn_autonomous_agent',
          description: 'Spawn an advanced autonomous AI coding agent for complex coding tasks',
          parameters: {
            type: 'object',
            properties: {
              task_description: {
                type: 'string',
                description: 'Detailed description of what the agent should accomplish'
              },
              context_files: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional list of files to provide as context'
              },
              requirements: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional list of specific requirements or constraints'
              },
              max_iterations: {
                type: 'number',
                description: 'Maximum number of execution iterations (default: 20)'
              }
            },
            required: ['task_description']
          }
        }
      },
      {
        type: 'function' as const,
        function: {
          name: 'check_task_progress',
          description: 'Check the progress and status of currently running tasks or agents',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      }
    ];
    
    // Update the agent with tool definitions
    const result = await client.conversationalAi.agents.update(AGENT_ID, {
      conversationConfig: {
        agent: {
          tools: tools as any
        }
      } as any
    });
    
    console.log('✅ Agent tools configured successfully!');
    console.log(`📊 Tools configured: ${tools.length}`);
    console.log('\nConfigured tools:');
    tools.forEach(tool => {
      console.log(`  - ${tool.function.name}`);
    });
    
  } catch (error) {
    console.error('\n❌ Failed to configure agent tools:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

configureAgentTools();

