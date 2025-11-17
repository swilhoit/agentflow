#!/bin/bash

# Discord Utility Script
# Convenient wrapper for Discord channel operations

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function show_help() {
    echo -e "${BLUE}Discord Utility Script${NC}"
    echo ""
    echo "Usage:"
    echo "  ./scripts/discord.sh channels [guildId]              - List Discord channels"
    echo "  ./scripts/discord.sh send <channelId> <msg>          - Send a message to specific channel"
    echo "  ./scripts/discord.sh smart <guildId> <type> <msg>    - Send with intelligent routing"
    echo "  ./scripts/discord.sh help                            - Show this help"
    echo ""
    echo "Message Types (for smart routing):"
    echo "  agent_update, error, warning, success, deployment, finance,"
    echo "  goal, project_update, crypto, general, command_result, thinking, code"
    echo ""
    echo "Examples:"
    echo "  ./scripts/discord.sh channels                                    # List all servers"
    echo "  ./scripts/discord.sh channels 1234567890                         # List channels in server"
    echo "  ./scripts/discord.sh send 1234567890 'Hello World!'              # Send to specific channel"
    echo "  ./scripts/discord.sh smart 1091835283210780735 error 'Error!'    # Auto-route error message"
    echo "  ./scripts/discord.sh smart 1091835283210780735 finance 'Alert'   # Auto-route to #finance"
}

case "$1" in
    channels|list|ls)
        echo -e "${GREEN}Listing Discord channels...${NC}"
        node "$PROJECT_ROOT/dist/scripts/list-discord-channels.js" "$2"
        ;;
    send|message|msg)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo -e "${RED}Error: Channel ID and message are required${NC}"
            echo "Usage: ./scripts/discord.sh send <channelId> <message>"
            exit 1
        fi
        echo -e "${GREEN}Sending message to Discord...${NC}"
        node "$PROJECT_ROOT/dist/scripts/send-discord-message.js" "$2" "$3" "$4"
        ;;
    smart|intelligent|auto)
        if [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ]; then
            echo -e "${RED}Error: Guild ID, message type, and message are required${NC}"
            echo "Usage: ./scripts/discord.sh smart <guildId> <messageType> <message> [projectName]"
            exit 1
        fi
        echo -e "${GREEN}Sending with intelligent routing...${NC}"
        node "$PROJECT_ROOT/dist/scripts/discord-intelligent-send.js" "$2" "$3" "$4" "$5"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

