const express = require('express');
const streamingController = require('../controllers/streamingController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { validateStreamAccess } = require('../middleware/validation');
const { streamingLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Public streaming endpoints (no auth required for public videos)
router.get('/hls/:videoId/playlist.m3u8',
  optionalAuth,
  validateStreamAccess,
  streamingController.getHLSPlaylist
);

router.get('/hls/:videoId/:quality/playlist.m3u8',
  optionalAuth,
  validateStreamAccess,
  streamingController.getQualityPlaylist
);

router.get('/hls/:videoId/:quality/segment_:segmentId.ts',
  optionalAuth,
  validateStreamAccess,
  streamingController.getHLSSegment
);

// Thumbnail endpoints
router.get('/thumbnail/:videoId/:thumbnailId',
  optionalAuth,
  validateStreamAccess,
  streamingController.getThumbnail
);

router.get('/thumbnails/:videoId',
  optionalAuth,
  validateStreamAccess,
  streamingController.getThumbnails
);

// Video info endpoint
router.get('/info/:videoId',
  optionalAuth,
  validateStreamAccess,
  streamingController.getVideoInfo
);

// Progressive download (fallback)
router.get('/progressive/:videoId/:quality',
  optionalAuth,
  validateStreamAccess,
  streamingController.getProgressiveVideo
);

// Stream validation and access control
router.post('/validate/:videoId',
  authMiddleware,
  streamingController.validateStreamAccess
);

// Generate streaming token for DRM content
router.post('/token/:videoId',
  authMiddleware,
  streamingController.generateStreamingToken
);

// CDN signed URLs
router.get('/cdn-url/:videoId/:resource',
  authMiddleware,
  streamingController.generateCDNUrl
);

module.exports = router;
