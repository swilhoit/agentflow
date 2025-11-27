#!/bin/bash

# Start Unified AgentFlow System
# Now runs Main Bot, Atlas, and Advisor in a single process for efficiency.

echo "🤖 Starting Unified AgentFlow System..."
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

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ Error: ANTHROPIC_API_KEY not set in .env"
    exit 1
fi

echo "✅ Environment variables loaded"
echo "📊 System Integrity: Unified"
echo ""

if [ -n "$ATLAS_DISCORD_TOKEN" ]; then
    echo "🌏 Atlas Bot: Enabled (Integrated)"
else
    echo "⚪ Atlas Bot: Disabled (No Token)"
fi

if [ -n "$ADVISOR_DISCORD_TOKEN" ]; then
    echo "💰 Advisor Bot: Enabled (Integrated)"
else
    echo "⚪ Advisor Bot: Disabled (No Token)"
fi

echo ""
echo "🚀 Launching process..."
echo ""

# Run the unified entry point
npm run dev
