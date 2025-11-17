import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  due?: string | null;
  dueComplete?: boolean;
  idList: string;
  idBoard: string;
  idLabels?: string[];
  labels?: TrelloLabel[];
  pos: number;
  url: string;
  shortUrl: string;
  dateLastActivity: string;
  idMembers?: string[];
  badges?: {
    attachments: number;
    checkItems: number;
    checkItemsChecked: number;
    comments: number;
    description: boolean;
    due?: string | null;
    dueComplete?: boolean;
  };
}

export interface TrelloList {
  id: string;
  name: string;
  idBoard: string;
  pos: number;
  closed: boolean;
}

export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  url: string;
  shortUrl: string;
  closed: boolean;
  idOrganization?: string;
  lists?: TrelloList[];
}

export interface TrelloLabel {
  id: string;
  idBoard: string;
  name: string;
  color: string;
}

export interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
  avatarUrl?: string;
}

export interface CreateCardOptions {
  name: string;
  idList: string;
  desc?: string;
  due?: string;
  pos?: 'top' | 'bottom' | number;
  idLabels?: string[];
  idMembers?: string[];
}

export interface UpdateCardOptions {
  name?: string;
  desc?: string;
  due?: string | null;
  dueComplete?: boolean;
  idList?: string;
  pos?: 'top' | 'bottom' | number;
  idLabels?: string[];
  idMembers?: string[];
  closed?: boolean;
}

export interface SearchCardsOptions {
  query: string;
  idBoards?: string[];
  idLists?: string[];
  modelTypes?: string[];
  partial?: boolean;
}

export class TrelloService {
  private apiKey: string;
  private apiToken: string;
  private client: AxiosInstance;
  private baseUrl = 'https://api.trello.com/1';

  constructor(apiKey: string, apiToken: string) {
    if (!apiKey || !apiToken) {
      throw new Error('Trello API key and token are required');
    }

    this.apiKey = apiKey;
    this.apiToken = apiToken;

    this.client = axios.create({
      baseURL: this.baseUrl,
      params: {
        key: this.apiKey,
        token: this.apiToken
      }
    });

    logger.info('TrelloService initialized');
  }

  // ==================== BOARDS ====================

  /**
   * Get all boards for the authenticated user
   */
  async getBoards(): Promise<TrelloBoard[]> {
    try {
      const response = await this.client.get('/members/me/boards');
      logger.info(`Retrieved ${response.data.length} boards`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching boards:', error);
      throw error;
    }
  }

  /**
   * Get a specific board by ID
   */
  async getBoard(boardId: string): Promise<TrelloBoard> {
    try {
      const response = await this.client.get(`/boards/${boardId}`, {
        params: { lists: 'open' }
      });
      logger.info(`Retrieved board: ${response.data.name}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching board ${boardId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new board
   */
  async createBoard(name: string, desc?: string): Promise<TrelloBoard> {
    try {
      const response = await this.client.post('/boards', null, {
        params: { name, desc }
      });
      logger.info(`Created board: ${response.data.name} (${response.data.id})`);
      return response.data;
    } catch (error) {
      logger.error('Error creating board:', error);
      throw error;
    }
  }

  // ==================== LISTS ====================

  /**
   * Get all lists on a board
   */
  async getLists(boardId: string): Promise<TrelloList[]> {
    try {
      const response = await this.client.get(`/boards/${boardId}/lists`);
      logger.info(`Retrieved ${response.data.length} lists from board ${boardId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching lists for board ${boardId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific list by ID
   */
  async getList(listId: string): Promise<TrelloList> {
    try {
      const response = await this.client.get(`/lists/${listId}`);
      logger.info(`Retrieved list: ${response.data.name}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching list ${listId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new list on a board
   */
  async createList(name: string, boardId: string, pos?: 'top' | 'bottom'): Promise<TrelloList> {
    try {
      const response = await this.client.post('/lists', null, {
        params: { name, idBoard: boardId, pos }
      });
      logger.info(`Created list: ${response.data.name} (${response.data.id})`);
      return response.data;
    } catch (error) {
      logger.error('Error creating list:', error);
      throw error;
    }
  }

  // ==================== CARDS ====================

  /**
   * Create a new card
   */
  async createCard(options: CreateCardOptions): Promise<TrelloCard> {
    try {
      const response = await this.client.post('/cards', null, {
        params: options
      });
      logger.info(`Created card: ${response.data.name} (${response.data.id})`);
      return response.data;
    } catch (error) {
      logger.error('Error creating card:', error);
      throw error;
    }
  }

  /**
   * Get a specific card by ID
   */
  async getCard(cardId: string): Promise<TrelloCard> {
    try {
      const response = await this.client.get(`/cards/${cardId}`, {
        params: {
          fields: 'all',
          labels: true,
          members: true
        }
      });
      logger.info(`Retrieved card: ${response.data.name}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching card ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing card
   */
  async updateCard(cardId: string, options: UpdateCardOptions): Promise<TrelloCard> {
    try {
      const response = await this.client.put(`/cards/${cardId}`, null, {
        params: options
      });
      logger.info(`Updated card: ${response.data.name} (${cardId})`);
      return response.data;
    } catch (error) {
      logger.error(`Error updating card ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a card
   */
  async deleteCard(cardId: string): Promise<void> {
    try {
      await this.client.delete(`/cards/${cardId}`);
      logger.info(`Deleted card: ${cardId}`);
    } catch (error) {
      logger.error(`Error deleting card ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * Get all cards on a list
   */
  async getCardsOnList(listId: string): Promise<TrelloCard[]> {
    try {
      const response = await this.client.get(`/lists/${listId}/cards`);
      logger.info(`Retrieved ${response.data.length} cards from list ${listId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching cards for list ${listId}:`, error);
      throw error;
    }
  }

  /**
   * Get all cards on a board
   */
  async getCardsOnBoard(boardId: string): Promise<TrelloCard[]> {
    try {
      const response = await this.client.get(`/boards/${boardId}/cards`);
      logger.info(`Retrieved ${response.data.length} cards from board ${boardId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching cards for board ${boardId}:`, error);
      throw error;
    }
  }

  /**
   * Search for cards
   */
  async searchCards(options: SearchCardsOptions): Promise<TrelloCard[]> {
    try {
      const params: any = {
        query: options.query,
        modelTypes: options.modelTypes?.join(',') || 'cards',
        partial: options.partial ?? true
      };

      if (options.idBoards) {
        params.idBoards = options.idBoards.join(',');
      }
      if (options.idLists) {
        params.idLists = options.idLists.join(',');
      }

      const response = await this.client.get('/search', { params });
      const cards = response.data.cards || [];
      logger.info(`Found ${cards.length} cards matching query: ${options.query}`);
      return cards;
    } catch (error) {
      logger.error('Error searching cards:', error);
      throw error;
    }
  }

  /**
   * Move a card to a different list
   */
  async moveCard(cardId: string, listId: string, pos?: 'top' | 'bottom' | number): Promise<TrelloCard> {
    try {
      return await this.updateCard(cardId, { idList: listId, pos });
    } catch (error) {
      logger.error(`Error moving card ${cardId} to list ${listId}:`, error);
      throw error;
    }
  }

  /**
   * Archive a card
   */
  async archiveCard(cardId: string): Promise<TrelloCard> {
    try {
      return await this.updateCard(cardId, { closed: true });
    } catch (error) {
      logger.error(`Error archiving card ${cardId}:`, error);
      throw error;
    }
  }

  // ==================== CARD DETAILS ====================

  /**
   * Add a comment to a card
   */
  async addComment(cardId: string, text: string): Promise<any> {
    try {
      const response = await this.client.post(`/cards/${cardId}/actions/comments`, null, {
        params: { text }
      });
      logger.info(`Added comment to card ${cardId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error adding comment to card ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * Get all comments on a card
   */
  async getComments(cardId: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/cards/${cardId}/actions`, {
        params: { filter: 'commentCard' }
      });
      logger.info(`Retrieved ${response.data.length} comments from card ${cardId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching comments for card ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * Add an attachment to a card
   */
  async addAttachment(cardId: string, url: string, name?: string): Promise<any> {
    try {
      const response = await this.client.post(`/cards/${cardId}/attachments`, null, {
        params: { url, name }
      });
      logger.info(`Added attachment to card ${cardId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error adding attachment to card ${cardId}:`, error);
      throw error;
    }
  }

  // ==================== LABELS ====================

  /**
   * Get all labels on a board
   */
  async getLabels(boardId: string): Promise<TrelloLabel[]> {
    try {
      const response = await this.client.get(`/boards/${boardId}/labels`);
      logger.info(`Retrieved ${response.data.length} labels from board ${boardId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching labels for board ${boardId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new label on a board
   */
  async createLabel(boardId: string, name: string, color: string): Promise<TrelloLabel> {
    try {
      const response = await this.client.post('/labels', null, {
        params: { idBoard: boardId, name, color }
      });
      logger.info(`Created label: ${response.data.name} (${response.data.id})`);
      return response.data;
    } catch (error) {
      logger.error('Error creating label:', error);
      throw error;
    }
  }

  /**
   * Add a label to a card
   */
  async addLabelToCard(cardId: string, labelId: string): Promise<any> {
    try {
      const response = await this.client.post(`/cards/${cardId}/idLabels`, null, {
        params: { value: labelId }
      });
      logger.info(`Added label ${labelId} to card ${cardId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error adding label to card ${cardId}:`, error);
      throw error;
    }
  }

  // ==================== MEMBERS ====================

  /**
   * Get all members on a board
   */
  async getBoardMembers(boardId: string): Promise<TrelloMember[]> {
    try {
      const response = await this.client.get(`/boards/${boardId}/members`);
      logger.info(`Retrieved ${response.data.length} members from board ${boardId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching members for board ${boardId}:`, error);
      throw error;
    }
  }

  /**
   * Add a member to a card
   */
  async addMemberToCard(cardId: string, memberId: string): Promise<any> {
    try {
      const response = await this.client.post(`/cards/${cardId}/idMembers`, null, {
        params: { value: memberId }
      });
      logger.info(`Added member ${memberId} to card ${cardId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error adding member to card ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a member from a card
   */
  async removeMemberFromCard(cardId: string, memberId: string): Promise<void> {
    try {
      await this.client.delete(`/cards/${cardId}/idMembers/${memberId}`);
      logger.info(`Removed member ${memberId} from card ${cardId}`);
    } catch (error) {
      logger.error(`Error removing member from card ${cardId}:`, error);
      throw error;
    }
  }

  // ==================== CHECKLISTS ====================

  /**
   * Add a checklist to a card
   */
  async addChecklist(cardId: string, name: string): Promise<any> {
    try {
      const response = await this.client.post(`/cards/${cardId}/checklists`, null, {
        params: { name }
      });
      logger.info(`Added checklist "${name}" to card ${cardId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error adding checklist to card ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * Add an item to a checklist
   */
  async addChecklistItem(checklistId: string, name: string, checked?: boolean): Promise<any> {
    try {
      const response = await this.client.post(`/checklists/${checklistId}/checkItems`, null, {
        params: { name, checked }
      });
      logger.info(`Added item "${name}" to checklist ${checklistId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error adding item to checklist ${checklistId}:`, error);
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Find a list by name on a board
   */
  async findListByName(boardId: string, listName: string): Promise<TrelloList | null> {
    try {
      const lists = await this.getLists(boardId);
      return lists.find(list => list.name.toLowerCase() === listName.toLowerCase()) || null;
    } catch (error) {
      logger.error(`Error finding list by name on board ${boardId}:`, error);
      throw error;
    }
  }

  /**
   * Find a board by name
   */
  async findBoardByName(boardName: string): Promise<TrelloBoard | null> {
    try {
      const boards = await this.getBoards();
      return boards.find(board => board.name.toLowerCase() === boardName.toLowerCase()) || null;
    } catch (error) {
      logger.error('Error finding board by name:', error);
      throw error;
    }
  }

  /**
   * Get or create a board
   */
  async getOrCreateBoard(boardName: string, desc?: string): Promise<TrelloBoard> {
    try {
      const existingBoard = await this.findBoardByName(boardName);
      if (existingBoard) {
        logger.info(`Found existing board: ${boardName}`);
        return existingBoard;
      }
      logger.info(`Creating new board: ${boardName}`);
      return await this.createBoard(boardName, desc);
    } catch (error) {
      logger.error('Error in getOrCreateBoard:', error);
      throw error;
    }
  }

  /**
   * Get or create a list on a board
   */
  async getOrCreateList(boardId: string, listName: string): Promise<TrelloList> {
    try {
      const existingList = await this.findListByName(boardId, listName);
      if (existingList) {
        logger.info(`Found existing list: ${listName}`);
        return existingList;
      }
      logger.info(`Creating new list: ${listName}`);
      return await this.createList(listName, boardId);
    } catch (error) {
      logger.error('Error in getOrCreateList:', error);
      throw error;
    }
  }
}

