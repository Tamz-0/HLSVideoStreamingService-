const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const streamingRoutes = require('./routes/streaming');
const analyticsRoutes = require('./routes/analytics');
const healthRoutes = require('./routes/health');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3005;

// Security middleware (modified for streaming)
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow cross-origin embedding for video
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "media-src": ["'self'", "data:", "blob:", process.env.CDN_URL || "*"],
      "connect-src": ["'self'", process.env.CDN_URL || "*"]
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting (more lenient for streaming)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Higher limit for streaming requests
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for HLS segments and manifests
    return req.path.includes('.m3u8') || req.path.includes('.ts');
  }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware (disabled for video content)
app.use(compression({
  filter: (req, res) => {
    // Don't compress video files
    if (req.headers['content-type']?.includes('video/') || 
        req.path.includes('.ts') || 
        req.path.includes('.m3u8')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Logging middleware
app.use((req, res, next) => {
  // Reduce logging for HLS segments to avoid spam
  if (!req.path.includes('.ts') && !req.path.includes('.m3u8')) {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    });
  }
  next();
});

// Routes
app.use('/api/stream', streamingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/health', healthRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info(`Video Streaming Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
