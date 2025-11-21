import dotenv from 'dotenv';
import { TrelloService } from '../services/trello';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
  console.log('🧹 AgentFlow Board Reset');
  console.log('=======================');

  const apiKey = process.env.TRELLO_API_KEY;
  const apiToken = process.env.TRELLO_API_TOKEN;
  const boardId = process.env.TRELLO_BOARD_ID;
  const inboxListId = process.env.TRELLO_INBOX_LIST_ID;
  const doneListId = process.env.TRELLO_DONE_LIST_ID;

  if (!apiKey || !apiToken || !boardId) {
    console.error('❌ Error: Missing Trello credentials or Board ID in .env');
    process.exit(1);
  }

  const trello = new TrelloService(apiKey, apiToken);

  try {
    // 1. Get Board Info
    const board = await trello.getBoard(boardId);
    console.log(`✅ Target Board: "${board.name}"`);

    // 2. Get All Lists
    const lists = await trello.getLists(boardId);
    console.log(`📝 Found ${lists.length} lists.`);

    // 3. Iterate and Archive
    for (const list of lists) {
      const isInbox = list.id === inboxListId || list.name.toLowerCase() === 'inbox';
      const isDone = list.id === doneListId || list.name.toLowerCase() === 'done';

      if (isInbox || isDone) {
        console.log(`✨ KEEPING list: "${list.name}" (${list.id})`);
        
        // Archive all cards inside kept lists to make them fresh
        console.log(`   🧹 Archiving all cards in "${list.name}"...`);
        await trello.archiveAllCardsInList(list.id);
      } else {
        console.log(`🗑️  ARCHIVING list: "${list.name}" (${list.id})`);
        await trello.updateList(list.id, { closed: true });
      }
    }

    console.log('\n✅ Board reset complete! Only "Inbox" and "Done" remain (and are empty).');

  } catch (error) {
    console.error('❌ Error resetting board:', error);
    process.exit(1);
  }
}

main();

