const s3Service = require('../services/s3Service');
const videoService = require('../services/videoService');
const cacheService = require('../services/cacheService');
const analyticsService = require('../services/analyticsService');
const cdnService = require('../services/cdnService');
const logger = require('../utils/logger');
const rangeParser = require('range-parser');

class StreamingController {
  async getHLSPlaylist(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user?.id;

      // Get video metadata and check access
      const video = await videoService.getVideoForStreaming(videoId, userId);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      if (!this.canAccessVideo(video, userId)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Check cache first
      const cacheKey = `hls:master:${videoId}`;
      let playlist = await cacheService.get(cacheKey);

      if (!playlist) {
        playlist = await this.generateMasterPlaylist(video);
        await cacheService.set(cacheKey, playlist, 300); // Cache for 5 minutes
      }

      // Record view if this is the first request
      if (req.query.start !== 'false') {
        await analyticsService.recordView(videoId, {
          userId,
          sessionId: req.headers['x-session-id'],
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          timestamp: new Date()
        });
      }

      res.set({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Length'
      });

      res.send(playlist);
    } catch (error) {
      logger.error('Get HLS playlist error:', error);
      res.status(500).json({ error: 'Failed to get playlist' });
    }
  }

  async getQualityPlaylist(req, res) {
    try {
      const { videoId, quality } = req.params;
      const userId = req.user?.id;

      // Validate access
      const video = await videoService.getVideoForStreaming(videoId, userId);
      if (!video || !this.canAccessVideo(video, userId)) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Check cache
      const cacheKey = `hls:quality:${videoId}:${quality}`;
      let playlist = await cacheService.get(cacheKey);

      if (!playlist) {
        const s3Key = `transcoded/${videoId}/${quality}/playlist.m3u8`;
        
        try {
          const playlistData = await s3Service.getFile(s3Key);
          playlist = playlistData.Body.toString();
          
          // Cache the playlist
          await cacheService.set(cacheKey, playlist, 300);
        } catch (s3Error) {
          if (s3Error.statusCode === 404) {
            return res.status(404).json({ error: 'Quality not available' });
          }
          throw s3Error;
        }
      }

      res.set({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*'
      });

      res.send(playlist);
    } catch (error) {
      logger.error('Get quality playlist error:', error);
      res.status(500).json({ error: 'Failed to get quality playlist' });
    }
  }

  async getHLSSegment(req, res) {
    try {
      const { videoId, quality, segmentId } = req.params;
      const userId = req.user?.id;

      // Validate access
      const video = await videoService.getVideoForStreaming(videoId, userId);
      if (!video || !this.canAccessVideo(video, userId)) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const s3Key = `transcoded/${videoId}/${quality}/segment_${segmentId}.ts`;
      
      // Generate CDN URL if CDN is enabled
      if (process.env.CDN_ENABLED === 'true') {
        const cdnUrl = await cdnService.generateSignedUrl(s3Key, 3600);
        return res.redirect(cdnUrl);
      }

      // Serve directly from S3 with range support
      const range = req.headers.range;
      
      try {
        if (range) {
          const segmentMetadata = await s3Service.getFileMetadata(s3Key);
          const ranges = rangeParser(segmentMetadata.contentLength, range);
          
          if (ranges && ranges.length === 1 && ranges !== -1 && ranges !== -2) {
            const { start, end } = ranges[0];
            const segmentData = await s3Service.getFileRange(s3Key, start, end);
            
            res.status(206);
            res.set({
              'Content-Type': 'video/mp2t',
              'Content-Length': end - start + 1,
              'Content-Range': `bytes ${start}-${end}/${segmentMetadata.contentLength}`,
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': '*'
            });
            
            return res.send(segmentData.Body);
          }
        }

        // Serve complete segment
        const segmentData = await s3Service.getFile(s3Key);
        
        res.set({
          'Content-Type': 'video/mp2t',
          'Content-Length': segmentData.ContentLength,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        });

        res.send(segmentData.Body);
      } catch (s3Error) {
        if (s3Error.statusCode === 404) {
          return res.status(404).json({ error: 'Segment not found' });
        }
        throw s3Error;
      }
    } catch (error) {
      logger.error('Get HLS segment error:', error);
      res.status(500).json({ error: 'Failed to get segment' });
    }
  }

  async getThumbnail(req, res) {
    try {
      const { videoId, thumbnailId } = req.params;
      const userId = req.user?.id;

      // Validate access
      const video = await videoService.getVideoForStreaming(videoId, userId);
      if (!video || !this.canAccessVideo(video, userId)) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const s3Key = `thumbnails/${videoId}/thumbnail_${thumbnailId}.jpg`;
      
      try {
        const thumbnailData = await s3Service.getFile(s3Key);
        
        res.set({
          'Content-Type': 'image/jpeg',
          'Content-Length': thumbnailData.ContentLength,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        });

        res.send(thumbnailData.Body);
      } catch (s3Error) {
        if (s3Error.statusCode === 404) {
          return res.status(404).json({ error: 'Thumbnail not found' });
        }
        throw s3Error;
      }
    } catch (error) {
      logger.error('Get thumbnail error:', error);
      res.status(500).json({ error: 'Failed to get thumbnail' });
    }
  }

  async getThumbnails(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user?.id;

      // Validate access
      const video = await videoService.getVideoForStreaming(videoId, userId);
      if (!video || !this.canAccessVideo(video, userId)) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const thumbnails = await s3Service.listFiles(`thumbnails/${videoId}/`);
      
      const thumbnailList = thumbnails.map((thumbnail, index) => ({
        id: index,
        url: `/api/stream/thumbnail/${videoId}/${index}`,
        timestamp: (video.duration / thumbnails.length) * index
      }));

      res.json({ thumbnails: thumbnailList });
    } catch (error) {
      logger.error('Get thumbnails error:', error);
      res.status(500).json({ error: 'Failed to get thumbnails' });
    }
  }

  async getVideoInfo(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user?.id;

      const video = await videoService.getVideoForStreaming(videoId, userId);
      if (!video || !this.canAccessVideo(video, userId)) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Get available qualities
      const qualities = await this.getAvailableQualities(videoId);

      const videoInfo = {
        id: video.id,
        title: video.title,
        description: video.description,
        duration: video.duration,
        createdAt: video.createdAt,
        creator: {
          id: video.creatorId,
          username: video.creatorUsername,
          displayName: video.creatorDisplayName
        },
        qualities: qualities,
        thumbnailUrl: `/api/stream/thumbnail/${videoId}/0`,
        hlsUrl: `/api/stream/hls/${videoId}/playlist.m3u8`,
        views: video.viewsCount || 0
      };

      res.json(videoInfo);
    } catch (error) {
      logger.error('Get video info error:', error);
      res.status(500).json({ error: 'Failed to get video info' });
    }
  }

  async getProgressiveVideo(req, res) {
    try {
      const { videoId, quality } = req.params;
      const userId = req.user?.id;

      // Validate access
      const video = await videoService.getVideoForStreaming(videoId, userId);
      if (!video || !this.canAccessVideo(video, userId)) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const s3Key = `transcoded/${videoId}/${quality}/progressive.mp4`;
      
      // Generate signed URL for progressive download
      const signedUrl = await s3Service.getFileUrl(s3Key, 3600);
      
      res.redirect(signedUrl);
    } catch (error) {
      logger.error('Get progressive video error:', error);
      res.status(500).json({ error: 'Failed to get progressive video' });
    }
  }

  async validateStreamAccess(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user.id;

      const video = await videoService.getVideoForStreaming(videoId, userId);
      const hasAccess = video && this.canAccessVideo(video, userId);

      res.json({
        hasAccess,
        video: hasAccess ? {
          id: video.id,
          title: video.title,
          duration: video.duration
        } : null
      });
    } catch (error) {
      logger.error('Validate stream access error:', error);
      res.status(500).json({ error: 'Failed to validate access' });
    }
  }

  async generateStreamingToken(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user.id;

      const video = await videoService.getVideoForStreaming(videoId, userId);
      if (!video || !this.canAccessVideo(video, userId)) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Generate time-limited streaming token
      const token = await this.createStreamingToken(videoId, userId, 3600);

      res.json({
        token,
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
      });
    } catch (error) {
      logger.error('Generate streaming token error:', error);
      res.status(500).json({ error: 'Failed to generate token' });
    }
  }

  async generateCDNUrl(req, res) {
    try {
      const { videoId, resource } = req.params;
      const userId = req.user.id;

      const video = await videoService.getVideoForStreaming(videoId, userId);
      if (!video || !this.canAccessVideo(video, userId)) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const cdnUrl = await cdnService.generateSignedUrl(resource, 3600);

      res.json({
        url: cdnUrl,
        expiresIn: 3600
      });
    } catch (error) {
      logger.error('Generate CDN URL error:', error);
      res.status(500).json({ error: 'Failed to generate CDN URL' });
    }
  }

  // Helper methods
  canAccessVideo(video, userId) {
    // Public videos are accessible to everyone
    if (video.visibility === 'public') {
      return true;
    }

    // Private videos require authentication and ownership
    if (video.visibility === 'private') {
      return userId && video.creatorId === userId;
    }

    // Unlisted videos are accessible with direct link
    if (video.visibility === 'unlisted') {
      return true;
    }

    return false;
  }

  async generateMasterPlaylist(video) {
    const qualities = await this.getAvailableQualities(video.id);
    
    let playlist = '#EXTM3U\n';
    playlist += '#EXT-X-VERSION:3\n';
    
    for (const quality of qualities) {
      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${quality.bandwidth},RESOLUTION=${quality.resolution}\n`;
      playlist += `${quality.name}/playlist.m3u8\n`;
    }

    return playlist;
  }

  async getAvailableQualities(videoId) {
    try {
      const qualities = [];
      const qualityConfigs = [
        { name: '1080p', resolution: '1920x1080', bandwidth: 5000000 },
        { name: '720p', resolution: '1280x720', bandwidth: 3000000 },
        { name: '480p', resolution: '854x480', bandwidth: 1500000 },
        { name: '360p', resolution: '640x360', bandwidth: 800000 },
        { name: '240p', resolution: '426x240', bandwidth: 400000 }
      ];

      for (const config of qualityConfigs) {
        const s3Key = `transcoded/${videoId}/${config.name}/playlist.m3u8`;
        
        if (await s3Service.fileExists(s3Key)) {
          qualities.push(config);
        }
      }

      return qualities;
    } catch (error) {
      logger.error('Get available qualities error:', error);
      return [];
    }
  }

  async createStreamingToken(videoId, userId, expiresIn) {
    const jwt = require('jsonwebtoken');
    
    const payload = {
      videoId,
      userId,
      type: 'streaming',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresIn
    };

    return jwt.sign(payload, process.env.JWT_SECRET);
  }
}

module.exports = new StreamingController();
