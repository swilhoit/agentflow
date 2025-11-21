# Trello Integration for AgentFlow

## Overview

AgentFlow now includes full Trello integration, enabling the AI agent to create, read, update, and manage Trello cards for project management directly through Discord commands or voice commands.

## Features

- **View Boards, Lists, and Cards**: Browse your Trello workspace
- **Create Cards**: Add new tasks with descriptions, due dates, and more
- **Update Cards**: Modify existing cards on the fly
- **Search**: Find cards across all your boards
- **Full REST API Integration**: Complete access to Trello's API
- **Voice Command Support**: Use voice commands via Discord to manage your projects

## Setup Instructions

### 1. Get Trello API Credentials

1. Visit [https://trello.com/app-key](https://trello.com/app-key)
2. Copy your **API Key**
3. Click "generate a token" to get your **API Token**
4. Grant the necessary permissions when prompted

### 2. Configure Environment Variables

Add your Trello credentials to your `.env` file:

```bash
TRELLO_API_KEY=your_api_key_here
TRELLO_API_TOKEN=your_token_here
```

### 3. Restart AgentFlow

```bash
npm run rebuild
npm start
```

The Trello service will automatically initialize if credentials are detected.

## Discord Commands

### View Information

#### `!trello-boards`
Lists all your Trello boards.

**Example:**
```
!trello-boards
```

**Response:**
```
📋 Your Trello Boards:

1. **AgentFlow Development**
   ID: `5f8a1b2c3d4e5f6g7h8i9j0k`
   URL: https://trello.com/b/abc123

2. **Personal Projects**
   ID: `1a2b3c4d5e6f7g8h9i0j1k2l`
   URL: https://trello.com/b/def456
```

---

#### `!trello-lists <board-id-or-name>`
Lists all lists on a specific board. You can use either the board ID or board name.

**Example:**
```
!trello-lists AgentFlow Development
```

**Response:**
```
📝 Lists on "AgentFlow Development":

1. **Backlog**
   ID: `list123abc`

2. **In Progress**
   ID: `list456def`

3. **Done**
   ID: `list789ghi`
```

---

#### `!trello-cards <list-id>`
Shows all cards on a specific list.

**Example:**
```
!trello-cards list123abc
```

**Response:**
```
🎴 Cards:

1. **Integrate Trello**
   Description: Add Trello integration to AgentFlow
   ID: `card123xyz`
   URL: https://trello.com/c/xyz123

2. **Add Voice Commands**
   ID: `card456abc`
   URL: https://trello.com/c/abc456
```

---

### Create & Update

#### `!trello-create`
Creates a new card on a list.

**Format:**
```
!trello-create
list: <list-id>
name: <card-name>
desc: <description> (optional)
due: YYYY-MM-DD (optional)
```

**Example:**
```
!trello-create
list: list123abc
name: Fix authentication bug
desc: Users are unable to login with OAuth
due: 2025-11-30
```

**Response:**
```
✅ Card created successfully!

**Name:** Fix authentication bug
**ID:** `card789new`
**URL:** https://trello.com/c/new789
```

---

#### `!trello-update`
Updates an existing card.

**Format:**
```
!trello-update
id: <card-id>
name: <new-name> (optional)
desc: <new-description> (optional)
due: YYYY-MM-DD (optional)
```

**Example:**
```
!trello-update
id: card789new
name: Fix OAuth authentication bug
desc: Updated description with more details
```

**Response:**
```
✅ Card updated successfully!

**Name:** Fix OAuth authentication bug
**URL:** https://trello.com/c/new789
```

---

### Search

#### `!trello-search <query>`
Searches for cards across all your boards.

**Example:**
```
!trello-search authentication bug
```

**Response:**
```
🔍 Search results for "authentication bug":

1. **Fix OAuth authentication bug**
   Updated description with more details
   URL: https://trello.com/c/new789

2. **Authentication Documentation**
   Document the new auth flow
   URL: https://trello.com/c/doc123
```

---

### Help

#### `!trello-help`
Shows all available Trello commands with usage examples.

## Voice Commands

When connected to a voice channel, you can use natural language to manage Trello:

**Examples:**
- "Show me my Trello boards"
- "Create a card on my backlog list called 'Fix navigation bug'"
- "Search Trello for authentication"
- "Update card [ID] with description 'Updated requirements'"
- "What cards are in the In Progress list?"

The AI orchestrator will parse your command and execute the appropriate Trello operation.

## Programmatic Usage

You can also use the Trello service directly in your code:

```typescript
import { TrelloService } from './services/trello';

const trello = new TrelloService(apiKey, apiToken);

// Get all boards
const boards = await trello.getBoards();

// Create a card
const card = await trello.createCard({
  idList: 'list123',
  name: 'New Task',
  desc: 'Task description',
  due: '2025-12-31T00:00:00.000Z'
});

// Update a card
await trello.updateCard('cardId', {
  name: 'Updated Task Name',
  desc: 'Updated description'
});

// Search for cards
const results = await trello.searchCards({
  query: 'bug fix',
  idBoards: ['board123']
});

// Move a card to another list
await trello.moveCard('cardId', 'newListId', 'top');

// Add a comment
await trello.addComment('cardId', 'This is a comment');

// Add a label
await trello.addLabelToCard('cardId', 'labelId');
```

## API Methods

The `TrelloService` class provides the following methods:

### Boards
- `getBoards()` - Get all boards
- `getBoard(boardId)` - Get a specific board
- `createBoard(name, desc?)` - Create a new board
- `findBoardByName(boardName)` - Find a board by name
- `getOrCreateBoard(boardName, desc?)` - Get or create a board

### Lists
- `getLists(boardId)` - Get all lists on a board
- `getList(listId)` - Get a specific list
- `createList(name, boardId, pos?)` - Create a new list
- `findListByName(boardId, listName)` - Find a list by name
- `getOrCreateList(boardId, listName)` - Get or create a list

### Cards
- `createCard(options)` - Create a new card
- `getCard(cardId)` - Get a specific card
- `updateCard(cardId, options)` - Update a card
- `deleteCard(cardId)` - Delete a card
- `getCardsOnList(listId)` - Get all cards on a list
- `getCardsOnBoard(boardId)` - Get all cards on a board
- `searchCards(options)` - Search for cards
- `moveCard(cardId, listId, pos?)` - Move a card
- `archiveCard(cardId)` - Archive a card

### Card Details
- `addComment(cardId, text)` - Add a comment to a card
- `getComments(cardId)` - Get all comments on a card
- `addAttachment(cardId, url, name?)` - Add an attachment
- `addChecklist(cardId, name)` - Add a checklist
- `addChecklistItem(checklistId, name, checked?)` - Add checklist item

### Labels
- `getLabels(boardId)` - Get all labels on a board
- `createLabel(boardId, name, color)` - Create a new label
- `addLabelToCard(cardId, labelId)` - Add a label to a card

### Members
- `getBoardMembers(boardId)` - Get all members on a board
- `addMemberToCard(cardId, memberId)` - Add a member to a card
- `removeMemberFromCard(cardId, memberId)` - Remove a member from a card

## Integration with Claude Orchestrator

The Trello service can be called by the Claude AI orchestrator to automate project management tasks. For example:

1. **Voice Command**: "Create a task to fix the login bug on my development board"
2. **AI Processing**: Claude interprets the command and determines:
   - Action: Create card
   - Board: Development board
   - List: Backlog (default)
   - Card name: "Fix login bug"
3. **Execution**: Trello service creates the card
4. **Response**: User receives confirmation with card URL

## Security Best Practices

1. **API Key Protection**: Never commit your `.env` file
2. **Token Permissions**: Generate tokens with minimal required permissions
3. **Token Rotation**: Periodically regenerate your API token
4. **Access Control**: Use `ALLOWED_USER_IDS` to restrict bot access
5. **Rate Limiting**: Trello has API rate limits (300 requests per 10 seconds)

## Troubleshooting

### "Trello service is not configured"
- Verify `TRELLO_API_KEY` and `TRELLO_API_TOKEN` are set in `.env`
- Restart the bot after adding credentials
- Check logs for initialization errors

### "Failed to fetch boards"
- Verify API credentials are correct
- Check that token has not expired
- Ensure proper permissions were granted during token generation

### "Board not found"
- Use exact board name (case-insensitive)
- Try using board ID instead of name
- Use `!trello-boards` to see available boards

### Rate Limiting
- If you hit rate limits, implement delays between operations
- Cache board/list IDs to reduce API calls
- Use batch operations when possible

## Advanced Features

### Custom Workflows

You can create custom workflows by combining Trello operations:

```typescript
// Example: Create a bug report workflow
async function createBugReport(trello: TrelloService, bugDetails: any) {
  // Find or create bug tracking board
  const board = await trello.getOrCreateBoard('Bug Tracking');
  
  // Get or create lists
  const backlogList = await trello.getOrCreateList(board.id, 'Backlog');
  const inProgressList = await trello.getOrCreateList(board.id, 'In Progress');
  
  // Create bug card
  const card = await trello.createCard({
    idList: backlogList.id,
    name: `Bug: ${bugDetails.title}`,
    desc: `**Reporter:** ${bugDetails.reporter}\n\n${bugDetails.description}`,
    due: bugDetails.dueDate
  });
  
  // Add labels
  const labels = await trello.getLabels(board.id);
  const bugLabel = labels.find(l => l.name === 'bug');
  if (bugLabel) {
    await trello.addLabelToCard(card.id, bugLabel.id);
  }
  
  // Add checklist
  const checklist = await trello.addChecklist(card.id, 'Investigation Steps');
  await trello.addChecklistItem(checklist.id, 'Reproduce the bug');
  await trello.addChecklistItem(checklist.id, 'Identify root cause');
  await trello.addChecklistItem(checklist.id, 'Implement fix');
  await trello.addChecklistItem(checklist.id, 'Test fix');
  
  return card;
}
```

### Automation Ideas

- **Daily Standup**: Automatically create cards for daily tasks
- **Sprint Planning**: Move cards between lists based on sprint schedules
- **Bug Tracking**: Auto-create cards from error logs
- **Deployment Checklist**: Generate pre-deployment checklists
- **Progress Reports**: Aggregate card data for status reports

## Examples

### Complete Workflow Example

```bash
# 1. Check your boards
!trello-boards

# 2. View lists on a board
!trello-lists AgentFlow Development

# 3. Create a new feature card
!trello-create
list: list123abc
name: Add real-time notifications
desc: Implement WebSocket notifications for instant updates
due: 2025-12-15

# 4. Search for related cards
!trello-search notifications

# 5. Update the card with progress
!trello-update
id: card789new
desc: Implemented WebSocket server, working on client integration

# 6. View all cards on the "In Progress" list
!trello-cards list456def
```

## API Rate Limits

Trello enforces the following rate limits:
- **300 requests per 10 seconds** per API key
- **100 requests per 10 seconds** per token

The service automatically handles errors, but be mindful of rate limits when making bulk operations.

## Contributing

To extend the Trello integration:

1. Add new methods to `src/services/trello.ts`
2. Update TypeScript types in `src/types/index.ts` if needed
3. Add corresponding Discord commands in `src/bot/discordBot.ts`
4. Update this documentation

## Support

For issues or questions:
- Check the [Trello API Documentation](https://developer.atlassian.com/cloud/trello/rest/api-group-actions/)
- Review logs with `LOG_LEVEL=DEBUG`
- Create an issue in the project repository

---

**Last Updated**: November 17, 2025
**AgentFlow Version**: 1.1.0

