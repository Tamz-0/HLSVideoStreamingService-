FROM node:18-alpine

WORKDIR /app

COPY shared/ ./shared/
COPY services/user-management/package*.json ./

RUN npm ci --only=production

COPY services/user-management/ .

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE $PORT

CMD ["npm", "start"]