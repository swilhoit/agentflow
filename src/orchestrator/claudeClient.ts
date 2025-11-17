import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { OrchestratorRequest, OrchestratorResponse } from '../types';
import { TrelloService } from '../services/trello';
import { TaskDecomposer, TaskAnalysis } from '../utils/taskDecomposer';

export class ClaudeClient {
  private client: Anthropic;
  private conversationHistory: Map<string, Anthropic.MessageParam[]> = new Map();
  private trelloService?: TrelloService;
  private taskDecomposer: TaskDecomposer;
  private taskAnalysisCache: Map<string, TaskAnalysis> = new Map();

  constructor(apiKey: string, trelloService?: TrelloService) {
    this.client = new Anthropic({ apiKey });
    this.trelloService = trelloService;
    this.taskDecomposer = new TaskDecomposer(apiKey);
  }

  async processCommand(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    try {
      const contextKey = `${request.context.guildId}_${request.context.userId}`;
      const history = this.conversationHistory.get(contextKey) || [];

      logger.info(`📝 Processing command: ${request.command.substring(0, 100)}...`);

      // PROACTIVE: Check if the USER'S command requires a sub-agent BEFORE asking Claude
      const commandRequiresAgent = this.doesCommandRequireAgent(request.command);

      if (commandRequiresAgent) {
        logger.info('🤖 User command requires ClaudeCodeAgent - will spawn after getting initial response');
      }

      const systemPrompt = this.buildSystemPrompt();
      const userMessage = this.buildUserMessage(request);

      history.push({
        role: 'user',
        content: userMessage
      });

      // Add timeout to prevent hanging
      const timeoutMs = 45000; // 45 seconds
      const responsePromise = this.client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        messages: history
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Claude API request timed out after 45 seconds')), timeoutMs);
      });

      logger.info('⏳ Waiting for Claude API response...');
      const response = await Promise.race([responsePromise, timeoutPromise]);

      logger.info('✅ Received Claude API response');

      const assistantMessage = response.content[0].type === 'text'
        ? response.content[0].text
        : JSON.stringify(response.content[0]);

      history.push({
        role: 'assistant',
        content: assistantMessage
      });

      // Keep only last 10 messages to prevent context overflow
      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }

      this.conversationHistory.set(contextKey, history);

      // Parse the response to extract execution plan
      const executionPlan = this.parseExecutionPlan(assistantMessage);

      // Check BOTH user command AND Claude's response for sub-agent requirement
      const responseRequiresAgent = this.determineSubAgentRequirement(assistantMessage);
      const requiresSubAgents = commandRequiresAgent || responseRequiresAgent;

      const taskId = this.generateTaskId();

      if (requiresSubAgents) {
        logger.info(`🚀 Will spawn ClaudeCodeAgent (command: ${commandRequiresAgent}, response: ${responseRequiresAgent})`);
      }

      logger.info(`✅ Command processed successfully (requires sub-agents: ${!!requiresSubAgents})`);

      return {
        success: true,
        message: assistantMessage,
        taskId,
        executionPlan,
        agentIds: requiresSubAgents ? [taskId] : undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Failed to process command with Claude: ${errorMessage}`, error);
      return {
        success: false,
        message: `I encountered an error: ${errorMessage}. Please try again or rephrase your request.`,
        taskId: this.generateTaskId(),
        error: errorMessage
      };
    }
  }

  private buildSystemPrompt(): string {
    const trelloStatus = this.trelloService 
      ? `✅ **TRELLO REST API SERVICE AVAILABLE** - Use [TRELLO_API_CALL] instead of CLI commands`
      : `❌ Trello not configured`;

    return `You are an advanced AI orchestrator integrated with a Discord voice bot. Your role is to:

1. Interpret voice commands from users and determine the appropriate actions
2. Break down complex tasks into executable steps
3. Decide when to spawn sub-agents for parallel or specialized tasks
4. Execute terminal commands, API calls, and cloud operations on the USER'S system
5. Provide clear, concise responses back to the user

📢 CRITICAL: DISCORD NOTIFICATION REQUIREMENTS
⚠️ THE USER CANNOT SEE YOUR TERMINAL OUTPUT! ⚠️
- All sub-agents automatically send Discord messages with frequent updates about what they're doing
- The user receives Discord notifications showing terminal commands being run and their outputs
- You do NOT need to see terminal output yourself - the user gets it via Discord
- After spawning sub-agents, acknowledge that the task is running and the user will get updates in Discord
- DO NOT assume the user can see what's happening in the terminal
- Sub-agents are configured to send progress updates to the Discord channel automatically

🛠️ YOUR ROLE: SYSTEM COMMAND ORCHESTRATOR
You help users execute commands on THEIR OWN computer/server where THEY are already logged in to their accounts.

The user's system has these tools installed and authenticated:
- **gcloud CLI** (Google Cloud) - User logged in as agentflow-discord-bot
- **gh CLI** (GitHub) - User logged in as swilhoit
- **Terminal/Shell** - Full bash access
- **Node.js/NPM, Docker, Git** - All available
- ${trelloStatus}

🎯 **TRELLO INTEGRATION - IMPORTANT:**
${this.trelloService ? `
For ANY Trello-related commands (boards, lists, cards, search), you have a BUILT-IN REST API SERVICE.
DO NOT use Trello CLI commands. Instead, use the REST API by marking your response with [TRELLO_API_CALL].

TRELLO COMMAND PATTERNS:
User: "Show my Trello boards" or "List Trello boards"
Response: "I'll fetch your Trello boards using the REST API."
[TRELLO_API_CALL: getBoards]

User: "Create a Trello card called 'Fix bug' on my backlog"
Response: "I'll create a Trello card using the REST API."
[TRELLO_API_CALL: createCard - name: Fix bug, list: backlog]

User: "Go to the AgentFlow board and create a card for DISCORD BOT"
Response: "I'll create a card on your AgentFlow board."
[TRELLO_API_CALL: createCard - name: DISCORD BOT, board: AgentFlow]

User: "Search Trello for authentication"
Response: "I'll search your Trello cards."
[TRELLO_API_CALL: searchCards - query: authentication]

User: "What cards are in my In Progress list?"
Response: "I'll fetch cards from your In Progress list."
[TRELLO_API_CALL: getCardsOnList - list: In Progress]

IMPORTANT: For card creation, you can specify EITHER:
- "list: <list-name>" if you know the list name
- "board: <board-name>" if you want to use the first list on that board

AVAILABLE TRELLO API OPERATIONS:
- getBoards() - List all boards
- getLists(boardId) - Get lists on a board
- getCardsOnList(listId) - Get cards on a list
- createCard({name, idList, desc, due}) - Create a card
- updateCard(cardId, {name, desc, due}) - Update a card
- searchCards({query}) - Search for cards
- moveCard(cardId, listId) - Move a card
` : `
Trello is not configured. If user asks about Trello, inform them to set TRELLO_API_KEY and TRELLO_API_TOKEN.
`}

YOUR JOB: When users ask to check/list/view THEIR OWN data, generate the appropriate CLI command and spawn a sub-agent to execute it on THEIR system.

⚠️ CRITICAL: You are NOT accessing external accounts. You are orchestrating command execution on the user's local machine where they already have active login sessions.

🔧 **AUTO-INSTALL MISSING TOOLS:**
If a command requires a CLI tool that's not installed (e.g., trello-cli, jq, curl), you can install it automatically:
\`\`\`bash
# Check if tool exists, install if missing
if ! command -v trello &> /dev/null; then
  npm install -g trello-cli  # or brew install, apt-get, etc.
fi
\`\`\`

REQUIRED BEHAVIOR:
When user asks: "List my GitHub repos" or "Check my GitHub" or "What repos do I have?"
- DO NOT say: "I don't have access"
- DO NOT say: "I cannot access your account"
- DO NOT ask for authentication
- INSTEAD: Generate the command and spawn a sub-agent

EXAMPLES - COPY THIS EXACT PATTERN:

User: "List my GitHub repos"
Response: "I'll list your GitHub repositories."
PLAN:
1. Execute gh repo list command on user's system
\`\`\`bash
gh repo list --limit 100
\`\`\`
[SUB_AGENT_REQUIRED: Execute GitHub repo list command]

User: "What Google Cloud projects do I have?"
Response: "Let me check your Google Cloud projects."
PLAN:
1. Execute gcloud projects list command
\`\`\`bash
gcloud projects list
\`\`\`
[SUB_AGENT_REQUIRED: Execute gcloud projects list]

User: "Check my GitHub account"
Response: "Checking your GitHub authentication status."
PLAN:
1. Run gh auth status
\`\`\`bash
gh auth status
\`\`\`
[SUB_AGENT_REQUIRED: Execute gh auth status]

REMEMBER:
- You're orchestrating commands on the USER'S machine
- The USER is logged in, not you  
- Your job is to generate and execute the right commands
- ALWAYS provide bash commands and spawn sub-agents

When you receive a command, analyze it and respond with:
- A brief acknowledgment of the task
- An execution plan (list of steps)
- Terminal commands to execute (wrap in \`\`\`bash blocks)
- [SUB_AGENT_REQUIRED] marker for execution

Format your execution plan as:
PLAN:
1. [step description]
\`\`\`bash
command here
\`\`\`

Be ACTION-ORIENTED. Generate commands immediately!`;
  }

  private buildUserMessage(request: OrchestratorRequest): string {
    const timestamp = request.context.timestamp instanceof Date
      ? request.context.timestamp.toISOString()
      : new Date(request.context.timestamp).toISOString();

    return `User Command: "${request.command}"

Context:
- User ID: ${request.context.userId}
- Guild ID: ${request.context.guildId}
- Channel ID: ${request.context.channelId}
- Timestamp: ${timestamp}
- Priority: ${request.priority || 'normal'}

Please analyze this command and provide your execution plan.`;
  }

  private parseExecutionPlan(response: string): string[] {
    const planMatch = response.match(/PLAN:\s*([\s\S]*?)(?:\n\n|\n```|$)/);
    if (!planMatch) return [];

    const planText = planMatch[1];
    const steps = planText
      .split('\n')
      .filter(line => line.trim().match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim());

    return steps;
  }

  /**
   * Check if the USER'S command requires a ClaudeCodeAgent (proactive detection)
   */
  private doesCommandRequireAgent(command: string): boolean {
    const commandLower = command.toLowerCase();

    // GitHub operations
    if (commandLower.includes('github') || commandLower.includes('repo')) {
      return true;
    }

    // Multi-step Trello operations
    if (commandLower.includes('trello') && (
      commandLower.includes('all') ||
      commandLower.includes('multiple') ||
      commandLower.includes('each') ||
      commandLower.includes('go through') ||
      commandLower.includes('for my') ||
      commandLower.match(/\d+\s+(project|repo|card|list)/)) // "5 projects", "3 cards", etc.
    ) {
      return true;
    }

    // Analyze/fetch operations
    if ((commandLower.includes('analyze') || commandLower.includes('fetch')) &&
        (commandLower.includes('repo') || commandLower.includes('project') || commandLower.includes('code'))) {
      return true;
    }

    // "Go through" + action indicates iteration
    if (commandLower.includes('go through') || commandLower.includes('for each')) {
      return true;
    }

    return false;
  }

  /**
   * Determine if this task requires spawning a ClaudeCodeAgent for execution
   * (based on Claude's RESPONSE)
   *
   * ClaudeCodeAgent should be used for:
   * - Multi-step operations requiring bash commands
   * - GitHub operations (gh CLI)
   * - Complex Trello workflows (multiple cards/lists)
   * - File operations combined with API calls
   * - Any task requiring iterative execution with feedback
   */
  private determineSubAgentRequirement(response: string): boolean {
    // Explicit markers (legacy)
    if (response.includes('[SUB_AGENT_REQUIRED') || response.includes('[TRELLO_API_CALL')) {
      return true;
    }

    const responseLower = response.toLowerCase();

    // Multi-step indicators
    const multiStepIndicators = [
      'first', 'then', 'next', 'after that', 'finally',
      'step 1', 'step 2', '1.', '2.', '3.',
      'let me', "i'll need to", "i'll start by"
    ];
    const hasMultiStep = multiStepIndicators.some(indicator => responseLower.includes(indicator));

    // Tool/Command indicators
    const requiresTools =
      responseLower.includes('gh repo') ||
      responseLower.includes('gh pr') ||
      responseLower.includes('gh issue') ||
      responseLower.includes('gcloud') ||
      responseLower.includes('kubectl') ||
      responseLower.includes('docker') ||
      responseLower.includes('npm') ||
      responseLower.includes('git ') ||
      responseLower.includes('analyze') ||
      responseLower.includes('fetch') && responseLower.includes('repo') ||
      responseLower.includes('create') && (responseLower.includes('card') || responseLower.includes('list')) ||
      responseLower.includes('multiple') ||
      responseLower.includes('all') && (responseLower.includes('repo') || responseLower.includes('project'));

    // Code block indicators (bash commands)
    const hasCodeBlocks = response.includes('```bash') || response.includes('```sh');

    // Return true if it's a multi-step task OR requires tools OR has code blocks
    return hasMultiStep || requiresTools || hasCodeBlocks;
  }

  extractBashCommands(response: string): string[] {
    const bashBlocks = response.match(/```bash\n([\s\S]*?)```/g) || [];
    return bashBlocks.map(block =>
      block.replace(/```bash\n/, '').replace(/```$/, '').trim()
    );
  }

  /**
   * Extract and execute Trello API calls from response
   */
  async handleTrelloApiCalls(response: string): Promise<string | null> {
    try {
      if (!this.trelloService) {
        logger.warn('Trello service not available');
        return null;
      }

      const trelloCallMatch = response.match(/\[TRELLO_API_CALL:\s*([^\]]+)\]/);
      if (!trelloCallMatch) {
        logger.debug('No Trello API call marker found in response');
        return null;
      }

      const callDetails = trelloCallMatch[1].trim();
      logger.info(`🔧 Executing Trello API call: ${callDetails}`);

      try {
      // Parse the API call details
      if (callDetails.startsWith('getBoards')) {
        const boards = await this.trelloService.getBoards();
        const boardList = boards.map((b, i) => 
          `${i + 1}. **${b.name}**\n   ID: \`${b.id}\`\n   URL: ${b.shortUrl}`
        ).join('\n\n');
        return `📋 **Your Trello Boards:**\n\n${boardList}`;
      }

      if (callDetails.startsWith('getLists')) {
        const boardMatch = callDetails.match(/boardId:\s*(\S+)/);
        if (boardMatch) {
          const lists = await this.trelloService.getLists(boardMatch[1]);
          const listText = lists.map((l, i) => 
            `${i + 1}. **${l.name}** (ID: \`${l.id}\`)`
          ).join('\n');
          return `📝 **Lists:**\n\n${listText}`;
        }
      }

      if (callDetails.includes('searchCards')) {
        const queryMatch = callDetails.match(/query:\s*([^,\]]+)/);
        if (queryMatch) {
          const query = queryMatch[1].trim();
          const cards = await this.trelloService.searchCards({ query });
          if (cards.length === 0) {
            return `No cards found matching "${query}"`;
          }
          const cardList = cards.slice(0, 10).map((c, i) => 
            `${i + 1}. **${c.name}**\n   ${c.desc ? c.desc.substring(0, 100) + '...' : 'No description'}\n   URL: ${c.shortUrl}`
          ).join('\n\n');
          return `🔍 **Search Results for "${query}":**\n\n${cardList}${cards.length > 10 ? `\n\n_...and ${cards.length - 10} more results_` : ''}`;
        }
      }

      if (callDetails.includes('getCardsOnList')) {
        const listMatch = callDetails.match(/list:\s*([^,\]]+)/);
        if (listMatch) {
          const listName = listMatch[1].trim();
          // Try to find the list by name across all boards
          const boards = await this.trelloService.getBoards();
          for (const board of boards) {
            const list = await this.trelloService.findListByName(board.id, listName);
            if (list) {
              const cards = await this.trelloService.getCardsOnList(list.id);
              if (cards.length === 0) {
                return `No cards found in "${listName}" list.`;
              }
              const cardList = cards.map((c, i) => 
                `${i + 1}. **${c.name}**${c.desc ? '\n   ' + c.desc.substring(0, 80) : ''}`
              ).join('\n\n');
              return `🎴 **Cards in "${listName}":**\n\n${cardList}`;
            }
          }
          return `Could not find list "${listName}". Use !trello-lists to see available lists.`;
        }
      }

      if (callDetails.includes('createCard')) {
        const nameMatch = callDetails.match(/name:\s*([^,\]]+)/);
        const listMatch = callDetails.match(/list:\s*([^,\]]+)/);
        const boardMatch = callDetails.match(/board:\s*([^,\]]+)/);
        
        if (!nameMatch) {
          return `❌ Card name is required for createCard`;
        }
        
        const cardName = nameMatch[1].trim();
        const boards = await this.trelloService.getBoards();
        
        // If board is specified, find that board and use its first list
        if (boardMatch) {
          const boardName = boardMatch[1].trim().toLowerCase();
          const board = boards.find(b => b.name.toLowerCase().includes(boardName));
          
          if (!board) {
            return `❌ Could not find board matching "${boardName}". Available boards: ${boards.map(b => b.name).join(', ')}`;
          }
          
          const lists = await this.trelloService.getLists(board.id);
          if (lists.length === 0) {
            return `❌ Board "${board.name}" has no lists`;
          }
          
          // Use first list or find 'To Do' / 'Backlog'
          let targetList = lists.find(l => l.name.toLowerCase().match(/to do|backlog|todo/)) || lists[0];
          
          const descMatch = callDetails.match(/desc:\s*([^,\]]+)/);
          const card = await this.trelloService.createCard({
            idList: targetList.id,
            name: cardName,
            desc: descMatch ? descMatch[1].trim() : undefined,
            pos: 'top'
          });
          
          return `✅ **Card Created!**\n\n**Name:** ${card.name}\n**Board:** ${board.name}\n**List:** ${targetList.name}\n**URL:** ${card.shortUrl}`;
        }
        
        // If list is specified, find it across all boards
        if (listMatch) {
          const listName = listMatch[1].trim();
          
          for (const board of boards) {
            const list = await this.trelloService.findListByName(board.id, listName);
            if (list) {
              const descMatch = callDetails.match(/desc:\s*([^,\]]+)/);
              const card = await this.trelloService.createCard({
                idList: list.id,
                name: cardName,
                desc: descMatch ? descMatch[1].trim() : undefined,
                pos: 'top'
              });
              return `✅ **Card Created!**\n\n**Name:** ${card.name}\n**Board:** ${board.name}\n**List:** ${listName}\n**URL:** ${card.shortUrl}`;
            }
          }
          return `❌ Could not find list "${listName}". Use !trello-lists <board> to see available lists.`;
        }
        
        return `❌ Please specify either "list: <name>" or "board: <name>" for card creation`;
      }

        return `Executed Trello API call: ${callDetails}`;
      } catch (innerError) {
        logger.error('❌ Error executing Trello API operation:', innerError);
        throw innerError;
      }
    } catch (error) {
      logger.error('❌ Failed to handle Trello API call:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return `❌ Trello operation failed: ${errorMsg}`;
    }
  }

  clearHistory(guildId: string, userId: string): void {
    const contextKey = `${guildId}_${userId}`;
    this.conversationHistory.delete(contextKey);
    logger.info(`Cleared conversation history for ${contextKey}`);
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getTrelloService(): TrelloService | undefined {
    return this.trelloService;
  }

  /**
   * Analyze task complexity and get decomposition if needed
   */
  async analyzeTaskComplexity(taskDescription: string): Promise<TaskAnalysis> {
    // Check cache first
    const cacheKey = taskDescription.toLowerCase().trim();
    if (this.taskAnalysisCache.has(cacheKey)) {
      logger.info('📋 Using cached task analysis');
      return this.taskAnalysisCache.get(cacheKey)!;
    }

    logger.info('🔍 Analyzing task complexity...');
    const analysis = await this.taskDecomposer.analyzeTask(taskDescription);
    
    // Cache the result
    this.taskAnalysisCache.set(cacheKey, analysis);

    logger.info(`📊 Task Analysis: ${analysis.complexity} complexity, ${analysis.estimatedIterations} iterations`);
    if (analysis.requiresDecomposition) {
      logger.info(`🔧 Task will be decomposed into ${analysis.subtasks.length} subtasks`);
      analysis.subtasks.forEach((st, i) => {
        logger.info(`   ${i + 1}. ${st.description} (${st.estimatedIterations} iterations)`);
      });
    }

    return analysis;
  }

  /**
   * Get optimal iteration limit for a task
   */
  getIterationLimit(analysis: TaskAnalysis): number {
    return this.taskDecomposer.calculateIterationLimit(analysis);
  }

  /**
   * Get execution batches for subtasks
   */
  getSubtaskExecutionOrder(analysis: TaskAnalysis): typeof analysis.subtasks[] {
    return this.taskDecomposer.getExecutionOrder(analysis.subtasks);
  }
}
