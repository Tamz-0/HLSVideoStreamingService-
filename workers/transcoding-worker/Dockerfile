FROM node:16-alpine

# Install FFmpeg and other required packages
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create temp directory for transcoding
RUN mkdir -p /tmp/transcoding && chown -R nodejs:nodejs /tmp/transcoding

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node healthcheck.js || exit 1

CMD ["npm", "start"]
