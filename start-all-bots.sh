#!/bin/bash

# Start All Bots - Runs both Main Bot and Atlas Bot simultaneously
# This script starts both bots in separate processes

echo "🤖 Starting AgentFlow Bots..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    exit 1
fi

# Source environment variables
export $(grep -v '^#' .env | xargs)

# Check required environment variables
if [ -z "$DISCORD_TOKEN" ]; then
    echo "❌ Error: DISCORD_TOKEN not set in .env"
    exit 1
fi

if [ -z "$ATLAS_DISCORD_TOKEN" ]; then
    echo "❌ Error: ATLAS_DISCORD_TOKEN not set in .env"
    exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ Error: ANTHROPIC_API_KEY not set in .env"
    exit 1
fi

echo "✅ Environment variables loaded"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all bots..."
    kill $MAIN_BOT_PID 2>/dev/null
    kill $ATLAS_BOT_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start main bot
echo "🚀 Starting Main Bot (General Assistant)..."
npm start &
MAIN_BOT_PID=$!
echo "   PID: $MAIN_BOT_PID"

# Wait a moment
sleep 2

# Start Atlas bot
echo "🌏 Starting Atlas Bot (Market Intelligence)..."
npm run atlas &
ATLAS_BOT_PID=$!
echo "   PID: $ATLAS_BOT_PID"

echo ""
echo "✅ Both bots started successfully!"
echo ""
echo "📊 Status:"
echo "   Main Bot (General):  PID $MAIN_BOT_PID"
echo "   Atlas Bot (Markets): PID $ATLAS_BOT_PID"
echo ""
echo "📝 Atlas monitors these channels:"
echo "   #crypto (1339709679537750036)"
echo "   #finance (1439869363502055474)"
echo "   #global-ai (1439887464524283924)"
echo ""
echo "⚠️  Press Ctrl+C to stop both bots"
echo ""

# Wait for both processes
wait $MAIN_BOT_PID $ATLAS_BOT_PID
