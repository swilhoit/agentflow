# Multi-stage build for optimal image size
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Install tools needed for agent operations
# - git: for creating repos, pushing code
# - rsync: for file sync operations
# - openssh-client: for SSH connections
# - curl: for HTTP requests
RUN apk add --no-cache git rsync openssh-client curl

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create necessary directories
RUN mkdir -p audio temp data

# Set environment variables
ENV NODE_ENV=production
# Increase Node.js memory limit to 4GB to prevent OOM crashes during AI analysis
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Expose orchestrator port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]
