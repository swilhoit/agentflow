#!/bin/bash

# AgentFlow Quick Start Script
# This script helps you set up AgentFlow quickly

set -e

echo "======================================="
echo "   AgentFlow Quick Start Setup"
echo "======================================="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Error: Node.js version 20 or higher is required"
    echo "   Current version: $(node -v)"
    echo "   Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js version $(node -v) detected"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: You need to edit .env and add your API keys!"
    echo ""
    echo "Required API keys:"
    echo "1. DISCORD_TOKEN - Get from https://discord.com/developers/applications"
    echo "2. DISCORD_CLIENT_ID - Get from Discord Developer Portal"
    echo "3. OPENAI_API_KEY - Get from https://platform.openai.com/api-keys"
    echo "4. ANTHROPIC_API_KEY - Get from https://console.anthropic.com/settings/keys"
    echo ""
    echo "Generate a secure orchestrator API key:"
    ORCHESTRATOR_KEY=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "   Suggested ORCHESTRATOR_API_KEY: $ORCHESTRATOR_KEY"
    echo ""

    read -p "Press Enter to open .env file in your default editor, or Ctrl+C to exit..."

    if [ -n "$EDITOR" ]; then
        $EDITOR .env
    elif command -v nano &> /dev/null; then
        nano .env
    elif command -v vim &> /dev/null; then
        vim .env
    else
        echo "Please edit .env file manually with your preferred editor"
    fi
else
    echo "✅ .env file already exists"
fi
echo ""

# Build the project
echo "Building project..."
npm run build
echo "✅ Project built successfully"
echo ""

echo "======================================="
echo "   Setup Complete!"
echo "======================================="
echo ""
echo "To start AgentFlow:"
echo "  npm start         # Production mode"
echo "  npm run dev       # Development mode (with auto-reload)"
echo ""
echo "Discord commands:"
echo "  !join    - Join voice channel"
echo "  !leave   - Leave voice channel"
echo "  !status  - Check bot status"
echo ""
echo "Next steps:"
echo "1. Make sure you've configured all API keys in .env"
echo "2. Invite the bot to your Discord server"
echo "3. Run 'npm start' to start the bot"
echo "4. Use '!join' in Discord to connect the bot to a voice channel"
echo ""
echo "For detailed setup instructions, see SETUP_GUIDE.md"
echo ""
