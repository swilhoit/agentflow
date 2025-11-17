import { logger } from '../utils/logger';
import { TrelloService } from '../services/trello';
import { SubAgentManager } from '../agents/subAgentManager';

export interface Step {
  id: string;
  description: string;
  type: 'trello' | 'bash' | 'api' | 'decision';
  operation: string;
  params: Record<string, any>;
  dependsOn?: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface Workflow {
  id: string;
  description: string;
  steps: Step[];
  context: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export class MultiStepOrchestrator {
  private trelloService?: TrelloService;
  private subAgentManager?: SubAgentManager;
  private workflows: Map<string, Workflow> = new Map();

  constructor(trelloService?: TrelloService, subAgentManager?: SubAgentManager) {
    this.trelloService = trelloService;
    this.subAgentManager = subAgentManager;
    logger.info('MultiStepOrchestrator initialized');
  }

  /**
   * Parse a natural language command into a workflow
   */
  async parseCommand(command: string): Promise<Workflow | null> {
    const commandLower = command.toLowerCase();

    // Trello: List/fetch cards
    if (commandLower.match(/(list|show|get|fetch|display).*(trello|cards?|tasks?)/)) {
      return this.parseTrelloListCardsWorkflow(command);
    }

    // Trello: Update/edit/modify/rename card
    if (commandLower.match(/(update|edit|modify|change|rename).*(trello\s+)?card/)) {
      return this.parseTrelloUpdateCardWorkflow(command);
    }

    // Trello: Move card
    if (commandLower.match(/move.*(trello\s+)?card/)) {
      return this.parseTrelloUpdateCardWorkflow(command);
    }

    // Trello: Create card on specific board
    if (commandLower.match(/create.*card.*on.*(board|trello)/)) {
      return this.parseTrelloCreateCardWorkflow(command);
    }

    // Trello: Create operations
    if (commandLower.includes('trello') && commandLower.match(/create|add|make/)) {
      return this.parseTrelloCreateCardWorkflow(command);
    }

    // Trello: Search operations
    if (commandLower.includes('trello') && commandLower.match(/search|find/)) {
      return this.parseTrelloSearchWorkflow(command);
    }

    // Trello: Show boards
    if (commandLower.match(/(list|show|get|display).*(trello\s+)?boards?/)) {
      return this.parseTrelloListBoardsWorkflow(command);
    }

    return null;
  }

  /**
   * Parse: "Create a card called X on Y board"
   */
  private parseTrelloCreateCardWorkflow(command: string): Workflow {
    // Extract card name
    const cardNameMatch = command.match(/(?:card|task)(?:\s+called|\s+for|\s+named)?\s+['""]?([^'""]+?)['""]?(?:\s+on|\s+to|$)/i);
    const cardName = cardNameMatch ? cardNameMatch[1].trim() : 'New Task';

    // Extract board name
    const boardMatch = command.match(/(?:on|to|in)\s+(?:the\s+)?([^'""\s]+(?:\s+board)?)/i);
    const boardName = boardMatch ? boardMatch[1].replace(/\s+board$/i, '').trim() : null;

    // Extract description if any
    const descMatch = command.match(/(?:with description|desc:|description:)\s+(.+)/i);
    const description = descMatch ? descMatch[1].trim() : undefined;

    const workflow: Workflow = {
      id: this.generateId(),
      description: `Create Trello card: ${cardName}`,
      context: {
        cardName,
        boardName,
        description,
        originalCommand: command
      },
      status: 'pending',
      steps: []
    };

    // Step 1: Get all boards
    workflow.steps.push({
      id: 'step-1',
      description: 'Fetch all Trello boards',
      type: 'trello',
      operation: 'getBoards',
      params: {},
      status: 'pending'
    });

    // Step 2: Find target board
    workflow.steps.push({
      id: 'step-2',
      description: `Find board matching: ${boardName || 'any'}`,
      type: 'decision',
      operation: 'findBoard',
      params: { boardName },
      dependsOn: ['step-1'],
      status: 'pending'
    });

    // Step 3: Get lists on board
    workflow.steps.push({
      id: 'step-3',
      description: 'Get lists on the board',
      type: 'trello',
      operation: 'getLists',
      params: {},
      dependsOn: ['step-2'],
      status: 'pending'
    });

    // Step 4: Select appropriate list
    workflow.steps.push({
      id: 'step-4',
      description: 'Select appropriate list (To Do/Backlog/First)',
      type: 'decision',
      operation: 'selectList',
      params: {},
      dependsOn: ['step-3'],
      status: 'pending'
    });

    // Step 5: Create the card
    workflow.steps.push({
      id: 'step-5',
      description: `Create card: ${cardName}`,
      type: 'trello',
      operation: 'createCard',
      params: { cardName, description },
      dependsOn: ['step-4'],
      status: 'pending'
    });

    return workflow;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflow: Workflow): Promise<any> {
    logger.info(`🚀 Starting workflow: ${workflow.description}`);
    workflow.status = 'running';
    this.workflows.set(workflow.id, workflow);

    try {
      for (const step of workflow.steps) {
        // Check dependencies
        if (step.dependsOn) {
          const dependenciesMet = step.dependsOn.every(depId => {
            const depStep = workflow.steps.find(s => s.id === depId);
            return depStep?.status === 'completed';
          });

          if (!dependenciesMet) {
            logger.warn(`⏸️ Step ${step.id} waiting for dependencies`);
            continue;
          }
        }

        logger.info(`▶️ Executing step: ${step.description}`);
        step.status = 'running';

        try {
          const result = await this.executeStep(step, workflow);
          step.result = result;
          step.status = 'completed';
          logger.info(`✅ Step completed: ${step.description}`);
        } catch (error) {
          step.status = 'failed';
          step.error = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`❌ Step failed: ${step.description}`, error);
          throw error;
        }
      }

      workflow.status = 'completed';
      logger.info(`🎉 Workflow completed: ${workflow.description}`);

      // Return final result
      const finalStep = workflow.steps[workflow.steps.length - 1];
      return finalStep.result;

    } catch (error) {
      workflow.status = 'failed';
      logger.error(`❌ Workflow failed: ${workflow.description}`, error);
      throw error;
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: Step, workflow: Workflow): Promise<any> {
    switch (step.type) {
      case 'trello':
        return await this.executeTrelloStep(step, workflow);
      
      case 'decision':
        return await this.executeDecisionStep(step, workflow);
      
      case 'bash':
        return await this.executeBashStep(step, workflow);
      
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Execute Trello operation
   */
  private async executeTrelloStep(step: Step, workflow: Workflow): Promise<any> {
    if (!this.trelloService) {
      throw new Error('Trello service not available');
    }

    switch (step.operation) {
      case 'getBoards':
        return await this.trelloService.getBoards();
      
      case 'getLists':
        const boardId = workflow.context.selectedBoardId;
        if (!boardId) throw new Error('No board selected');
        return await this.trelloService.getLists(boardId);
      
      case 'getCard':
        const cardId = step.params.cardId || workflow.context.cardId;
        if (!cardId) throw new Error('No card ID provided');
        return await this.trelloService.getCard(cardId);
      
      case 'createCard':
        const listId = workflow.context.selectedListId;
        if (!listId) throw new Error('No list selected');
        return await this.trelloService.createCard({
          idList: listId,
          name: step.params.cardName || workflow.context.cardName,
          desc: step.params.description || workflow.context.description,
          pos: 'top'
        });
      
      case 'updateCard':
        const updateCardId = workflow.context.cardId;
        if (!updateCardId) throw new Error('No card ID provided');
        const updateOptions: any = {};
        if (step.params.name || workflow.context.newName) {
          updateOptions.name = step.params.name || workflow.context.newName;
        }
        if (step.params.desc !== undefined || workflow.context.newDescription !== undefined) {
          updateOptions.desc = step.params.desc || workflow.context.newDescription;
        }
        if (step.params.idList || workflow.context.newListId) {
          updateOptions.idList = step.params.idList || workflow.context.newListId;
        }
        if (step.params.due !== undefined || workflow.context.newDue !== undefined) {
          updateOptions.due = step.params.due || workflow.context.newDue;
        }
        if (step.params.dueComplete !== undefined) {
          updateOptions.dueComplete = step.params.dueComplete;
        }
        return await this.trelloService.updateCard(updateCardId, updateOptions);
      
      case 'searchCards':
        return await this.trelloService.searchCards({ query: step.params.query });
      
      default:
        throw new Error(`Unknown Trello operation: ${step.operation}`);
    }
  }

  /**
   * Execute decision/logic step
   */
  private async executeDecisionStep(step: Step, workflow: Workflow): Promise<any> {
    switch (step.operation) {
      case 'findBoard': {
        const previousStep = workflow.steps.find(s => s.id === step.dependsOn?.[0]);
        const boards = previousStep?.result;
        
        if (!boards || !Array.isArray(boards)) {
          throw new Error('No boards data from previous step');
        }

        const boardName = step.params.boardName || workflow.context.boardName;
        
        let selectedBoard;
        if (boardName) {
          selectedBoard = boards.find(b => 
            b.name.toLowerCase().includes(boardName.toLowerCase())
          );
        }
        
        if (!selectedBoard) {
          selectedBoard = boards[0]; // Default to first board
        }

        if (!selectedBoard) {
          throw new Error('No boards available');
        }

        workflow.context.selectedBoardId = selectedBoard.id;
        workflow.context.selectedBoardName = selectedBoard.name;
        
        logger.info(`📌 Selected board: ${selectedBoard.name}`);
        return selectedBoard;
      }

      case 'selectList': {
        const previousStep = workflow.steps.find(s => s.id === step.dependsOn?.[0]);
        const lists = previousStep?.result;
        
        if (!lists || !Array.isArray(lists)) {
          throw new Error('No lists data from previous step');
        }

        if (lists.length === 0) {
          throw new Error('Board has no lists');
        }

        // Try to find To Do, Backlog, or similar list
        let selectedList = lists.find(l => 
          l.name.toLowerCase().match(/to do|todo|backlog|tasks/)
        );

        if (!selectedList) {
          selectedList = lists[0]; // Use first list as fallback
        }

        workflow.context.selectedListId = selectedList.id;
        workflow.context.selectedListName = selectedList.name;
        
        logger.info(`📝 Selected list: ${selectedList.name}`);
        return selectedList;
      }

      case 'selectCard': {
        const previousStep = workflow.steps.find(s => s.id === step.dependsOn?.[0]);
        const cards = previousStep?.result;
        
        if (!cards || !Array.isArray(cards)) {
          throw new Error('No cards data from previous step');
        }

        if (cards.length === 0) {
          throw new Error(`No cards found matching: ${step.params.searchTerm}`);
        }

        // Select the best matching card (first result for now)
        const selectedCard = cards[0];
        
        workflow.context.cardId = selectedCard.id;
        workflow.context.cardName = selectedCard.name;
        workflow.context.cardBoardId = selectedCard.idBoard;
        workflow.context.cardListId = selectedCard.idList;
        
        logger.info(`🎯 Selected card: ${selectedCard.name} (${selectedCard.id})`);
        return selectedCard;
      }

      case 'extractBoardId': {
        const previousStep = workflow.steps.find(s => s.id === step.dependsOn?.[0]);
        const card = previousStep?.result;
        
        if (!card || !card.idBoard) {
          throw new Error('No board ID found in card data');
        }

        workflow.context.selectedBoardId = card.idBoard;
        logger.info(`📌 Extracted board ID: ${card.idBoard}`);
        return card.idBoard;
      }

      case 'findList': {
        if (!this.trelloService) {
          throw new Error('Trello service not available');
        }

        const boardId = workflow.context.selectedBoardId || workflow.context.cardBoardId;
        if (!boardId) {
          throw new Error('No board ID available');
        }

        const lists = await this.trelloService.getLists(boardId);
        const listName = step.params.listName || workflow.context.newListName;
        
        const selectedList = lists.find(l => 
          l.name.toLowerCase().includes(listName.toLowerCase())
        );

        if (!selectedList) {
          throw new Error(`List not found: ${listName}. Available: ${lists.map(l => l.name).join(', ')}`);
        }

        workflow.context.newListId = selectedList.id;
        workflow.context.selectedListName = selectedList.name;
        
        logger.info(`📝 Found list: ${selectedList.name} (${selectedList.id})`);
        return selectedList;
      }

      default:
        throw new Error(`Unknown decision operation: ${step.operation}`);
    }
  }

  /**
   * Execute bash command via sub-agent
   */
  private async executeBashStep(step: Step, workflow: Workflow): Promise<any> {
    if (!this.subAgentManager) {
      throw new Error('SubAgentManager not available');
    }

    // Implementation would spawn sub-agent to execute bash command
    throw new Error('Bash step execution not yet implemented');
  }

  /**
   * Parse: "List/fetch Trello cards"
   */
  private parseTrelloListCardsWorkflow(command: string): Workflow {
    // Extract board/list name if specified
    const boardMatch = command.match(/(?:on|from|in)\s+(?:the\s+)?([^\s]+(?:\s+board)?)/i);
    const boardName = boardMatch ? boardMatch[1].replace(/\s+board$/i, '').trim() : null;

    const workflow: Workflow = {
      id: this.generateId(),
      description: boardName ? `List cards from ${boardName}` : 'List all Trello cards',
      context: { boardName, originalCommand: command },
      status: 'pending',
      steps: []
    };

    // Step 1: Get all boards
    workflow.steps.push({
      id: 'step-1',
      description: 'Fetch all Trello boards',
      type: 'trello',
      operation: 'getBoards',
      params: {},
      status: 'pending'
    });

    if (boardName) {
      // Step 2: Find target board
      workflow.steps.push({
        id: 'step-2',
        description: `Find board: ${boardName}`,
        type: 'decision',
        operation: 'findBoard',
        params: { boardName },
        dependsOn: ['step-1'],
        status: 'pending'
      });

      // Step 3: Get lists on board
      workflow.steps.push({
        id: 'step-3',
        description: 'Get lists on the board',
        type: 'trello',
        operation: 'getLists',
        params: {},
        dependsOn: ['step-2'],
        status: 'pending'
      });
    }

    return workflow;
  }

  /**
   * Parse: "Search Trello for X"
   */
  private parseTrelloSearchWorkflow(command: string): Workflow {
    const queryMatch = command.match(/(?:search|find).*(?:for|:)\s+(.+)/i);
    const query = queryMatch ? queryMatch[1].trim() : '';

    const workflow: Workflow = {
      id: this.generateId(),
      description: `Search Trello for: ${query}`,
      context: { query, originalCommand: command },
      status: 'pending',
      steps: [{
        id: 'step-1',
        description: `Search for: ${query}`,
        type: 'trello',
        operation: 'searchCards',
        params: { query },
        status: 'pending'
      }]
    };

    return workflow;
  }

  /**
   * Parse: "List Trello boards"
   */
  private parseTrelloListBoardsWorkflow(command: string): Workflow {
    const workflow: Workflow = {
      id: this.generateId(),
      description: 'List all Trello boards',
      context: { originalCommand: command },
      status: 'pending',
      steps: [{
        id: 'step-1',
        description: 'Fetch all Trello boards',
        type: 'trello',
        operation: 'getBoards',
        params: {},
        status: 'pending'
      }]
    };

    return workflow;
  }

  /**
   * Parse: "Update/rename/move Trello card"
   */
  private parseTrelloUpdateCardWorkflow(command: string): Workflow {
    // Extract card identifier (ID, name, or search term)
    const cardIdMatch = command.match(/card\s+(?:id\s+)?([a-zA-Z0-9]{24})/i);
    const cardNameMatch = command.match(/card\s+(?:called|named)\s+['""]?([^'""]+?)['""]?(?:\s|$)/i);
    
    const cardId = cardIdMatch ? cardIdMatch[1] : null;
    const cardSearchTerm = cardNameMatch ? cardNameMatch[1].trim() : null;

    // Extract what to update
    let newName: string | undefined;
    let newDescription: string | undefined;
    let newListName: string | undefined;
    let operation = 'update';

    // Rename operation
    if (command.match(/rename.*to/i)) {
      const renameMatch = command.match(/rename.*to\s+['""]?([^'""]+?)['""]?(?:\s|$)/i);
      if (renameMatch) {
        newName = renameMatch[1].trim();
        operation = 'rename';
      }
    }

    // Move operation
    if (command.match(/move.*to/i)) {
      const moveMatch = command.match(/move.*to\s+(?:list\s+)?['""]?([^'""]+?)['""]?(?:\s|$)/i);
      if (moveMatch) {
        newListName = moveMatch[1].trim();
        operation = 'move';
      }
    }

    // General update - extract name and description
    if (!newName && command.match(/name[:\s]+/i)) {
      const nameMatch = command.match(/name[:\s]+['""]?([^'""]+?)['""]?(?:\s|,|$)/i);
      if (nameMatch) newName = nameMatch[1].trim();
    }

    if (command.match(/desc(?:ription)?[:\s]+/i)) {
      const descMatch = command.match(/desc(?:ription)?[:\s]+['""]?([^'""]+?)['""]?(?:\s|$)/i);
      if (descMatch) newDescription = descMatch[1].trim();
    }

    const workflow: Workflow = {
      id: this.generateId(),
      description: `Update Trello card${cardSearchTerm ? `: ${cardSearchTerm}` : ''}`,
      context: {
        cardId,
        cardSearchTerm,
        newName,
        newDescription,
        newListName,
        operation,
        originalCommand: command
      },
      status: 'pending',
      steps: []
    };

    // If we have a direct card ID, skip search
    if (cardId) {
      workflow.steps.push({
        id: 'step-1',
        description: `Get card details: ${cardId}`,
        type: 'trello',
        operation: 'getCard',
        params: { cardId },
        status: 'pending'
      });
    } else if (cardSearchTerm) {
      // Step 1: Search for the card
      workflow.steps.push({
        id: 'step-1',
        description: `Search for card: ${cardSearchTerm}`,
        type: 'trello',
        operation: 'searchCards',
        params: { query: cardSearchTerm },
        status: 'pending'
      });

      // Step 2: Select the best matching card
      workflow.steps.push({
        id: 'step-2',
        description: 'Select matching card',
        type: 'decision',
        operation: 'selectCard',
        params: { searchTerm: cardSearchTerm },
        dependsOn: ['step-1'],
        status: 'pending'
      });
    } else {
      throw new Error('Could not identify which card to update. Please provide card ID or name.');
    }

    // If moving to a different list, need to resolve list ID
    if (newListName) {
      const prevStepId = workflow.steps[workflow.steps.length - 1].id;
      
      workflow.steps.push({
        id: `step-${workflow.steps.length + 1}`,
        description: 'Get card board ID',
        type: 'decision',
        operation: 'extractBoardId',
        params: {},
        dependsOn: [prevStepId],
        status: 'pending'
      });

      workflow.steps.push({
        id: `step-${workflow.steps.length + 1}`,
        description: `Find list: ${newListName}`,
        type: 'decision',
        operation: 'findList',
        params: { listName: newListName },
        dependsOn: [`step-${workflow.steps.length}`],
        status: 'pending'
      });
    }

    // Final step: Update the card
    const updateStepDeps = [workflow.steps[workflow.steps.length - 1].id];
    workflow.steps.push({
      id: `step-${workflow.steps.length + 1}`,
      description: `Update card${newName ? ` name to: ${newName}` : ''}${newListName ? ` → move to: ${newListName}` : ''}`,
      type: 'trello',
      operation: 'updateCard',
      params: { name: newName, desc: newDescription },
      dependsOn: updateStepDeps,
      status: 'pending'
    });

    return workflow;
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId: string): Workflow | null {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * Format workflow result for user
   */
  formatResult(workflow: Workflow): string {
    if (workflow.status === 'failed') {
      const failedStep = workflow.steps.find(s => s.status === 'failed');
      return `❌ **Workflow Failed**\n\n**Step:** ${failedStep?.description}\n**Error:** ${failedStep?.error}`;
    }

    if (workflow.status === 'completed') {
      const finalStep = workflow.steps[workflow.steps.length - 1];
      
      // Format based on operation type
      if (finalStep.operation === 'createCard' && finalStep.result) {
        const card = finalStep.result;
        return `✅ **Card Created Successfully!**\n\n` +
               `**Name:** ${card.name}\n` +
               `**Board:** ${workflow.context.selectedBoardName}\n` +
               `**List:** ${workflow.context.selectedListName}\n` +
               `**URL:** ${card.shortUrl}\n\n` +
               `*Completed in ${workflow.steps.length} steps*`;
      }

      // Format card update result
      if (finalStep.operation === 'updateCard' && finalStep.result) {
        const card = finalStep.result;
        let message = `✅ **Card Updated Successfully!**\n\n`;
        message += `**Card:** ${card.name}\n`;
        message += `**URL:** ${card.shortUrl}\n\n`;
        
        if (workflow.context.operation === 'rename' && workflow.context.newName) {
          message += `✏️ Renamed to: **${workflow.context.newName}**\n`;
        }
        if (workflow.context.operation === 'move' && workflow.context.selectedListName) {
          message += `📦 Moved to list: **${workflow.context.selectedListName}**\n`;
        }
        if (workflow.context.newDescription) {
          message += `📝 Description updated\n`;
        }
        
        message += `\n*Completed in ${workflow.steps.length} steps*`;
        return message;
      }

      // Format boards list
      if (finalStep.operation === 'getBoards' && Array.isArray(finalStep.result)) {
        const boards = finalStep.result;
        let result = `✅ **Found ${boards.length} Trello Board${boards.length !== 1 ? 's' : ''}**\n\n`;
        boards.forEach((board: any, idx: number) => {
          result += `${idx + 1}. **${board.name}**\n`;
          result += `   🔗 ${board.shortUrl}\n`;
          if (board.desc) result += `   📝 ${board.desc.substring(0, 80)}${board.desc.length > 80 ? '...' : ''}\n`;
          result += '\n';
        });
        return result;
      }

      // Format search results
      if (finalStep.operation === 'searchCards' && Array.isArray(finalStep.result)) {
        const cards = finalStep.result;
        if (cards.length === 0) {
          return `🔍 **No cards found matching:** "${workflow.context.query}"`;
        }
        let result = `🔍 **Found ${cards.length} Card${cards.length !== 1 ? 's' : ''}**\n\n`;
        cards.slice(0, 10).forEach((card: any, idx: number) => {
          result += `${idx + 1}. **${card.name}**\n`;
          result += `   📌 List: ${card.list?.name || 'Unknown'}\n`;
          result += `   🔗 ${card.shortUrl}\n\n`;
        });
        if (cards.length > 10) {
          result += `*...and ${cards.length - 10} more*\n`;
        }
        return result;
      }

      // Format lists
      if (finalStep.operation === 'getLists' && Array.isArray(finalStep.result)) {
        const lists = finalStep.result;
        let result = `✅ **Found ${lists.length} List${lists.length !== 1 ? 's' : ''} on ${workflow.context.selectedBoardName}**\n\n`;
        lists.forEach((list: any, idx: number) => {
          result += `${idx + 1}. **${list.name}**\n`;
        });
        return result;
      }

      return `✅ **Workflow Completed**\n\n${workflow.description}`;
    }

    return `⏳ **Workflow Running**\n\n${workflow.description}\n\nCompleted ${workflow.steps.filter(s => s.status === 'completed').length}/${workflow.steps.length} steps`;
  }

  private generateId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

