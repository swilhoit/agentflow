# Trello Quick Start Guide

Get your AgentFlow bot managing Trello cards in 5 minutes!

## Step 1: Get Trello Credentials (2 minutes)

1. **Visit**: [https://trello.com/app-key](https://trello.com/app-key)
2. **Copy your API Key** from the page
3. **Click "generate a token"** link on the same page
4. **Grant permissions** when prompted
5. **Copy the token** that's generated

## Step 2: Configure AgentFlow (1 minute)

Add these lines to your `.env` file:

```env
TRELLO_API_KEY=your_api_key_here
TRELLO_API_TOKEN=your_token_here
```

## Step 3: Rebuild & Restart (1 minute)

```bash
npm run rebuild
npm start
```

## Step 4: Test It! (1 minute)

In Discord, try these commands:

```
!trello-help
```

```
!trello-boards
```

```
!trello-search bug
```

## Quick Command Reference

### View Your Stuff
```
!trello-boards                    # See all boards
!trello-lists AgentFlow          # Lists on a board
!trello-cards <list-id>          # Cards on a list
```

### Create a Card
```
!trello-create
list: <list-id>
name: Fix the login bug
desc: Users can't login with OAuth
due: 2025-12-31
```

### Search
```
!trello-search authentication
```

### Update a Card
```
!trello-update
id: <card-id>
name: Updated card name
desc: New description
```

## Voice Commands

Once in a voice channel, just speak:

- "Show me my Trello boards"
- "Create a card called 'Fix navigation' on my backlog"
- "Search Trello for bug fixes"
- "What cards are on my in progress list?"

## Need Help?

See the full documentation: [TRELLO_INTEGRATION.md](./TRELLO_INTEGRATION.md)

## Common Issues

**"Trello service is not configured"**
- Make sure you added both `TRELLO_API_KEY` and `TRELLO_API_TOKEN` to `.env`
- Restart the bot after adding them

**"Failed to fetch boards"**
- Double-check your API key and token are correct
- Make sure you granted permissions when generating the token

**"Board not found"**
- Use `!trello-boards` to see the exact board names
- Board names are case-insensitive

---

That's it! You're now managing Trello with AI. 🚀

