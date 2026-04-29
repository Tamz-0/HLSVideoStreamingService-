FROM node:18-alpine

RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    vips-dev \
    fftw-dev \
    libc6-compat

WORKDIR /app

COPY package*.json ./

ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
ENV npm_config_sharp_libvips_local_prebuilds=0

RUN npm ci --only=production

COPY . .

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE $PORT

CMD ["npm", "start"]