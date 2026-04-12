const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp');
const FileType = require('file-type');
const Bull = require('bull');
const ffprobe = require('ffprobe-static');
const ffmpeg = require('fluent-ffmpeg');

const s3Service = require('../services/s3Service');
const videoService = require('../services/videoService');
const notificationService = require('../services/notificationService');

// Set up ffmpeg paths
ffmpeg.setFfprobePath(ffprobe.path);

// Initialize job queue
const transcodingQueue = new Bull('video transcoding', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  }
});

class UploadController {
  async uploadVideo(req, res) {
    try {
      const { title, description, visibility = 'private', tags } = req.body;
      const userId = req.user.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      // Validate file type
      const fileType = await FileType.fromBuffer(file.buffer);
      if (!fileType || !fileType.mime.startsWith('video/')) {
        return res.status(400).json({ error: 'Invalid video file format' });
      }

      // Generate unique identifiers
      const videoId = uuidv4();
      const originalFilename = file.originalname;
      const fileExtension = path.extname(originalFilename);
      const s3Key = `videos/originals/${videoId}${fileExtension}`;

      // Get video metadata
      const metadata = await this.getVideoMetadata(file.buffer);

      // Upload original file to S3
      const uploadResult = await s3Service.uploadFile({
        key: s3Key,
        buffer: file.buffer,
        contentType: file.mimetype,
        metadata: {
          userId,
          videoId,
          originalName: originalFilename,
          duration: metadata.duration.toString(),
          width: metadata.width.toString(),
          height: metadata.height.toString()
        }
      });

      // Create video record in database
      const videoRecord = await videoService.createVideo({
        id: videoId,
        userId,
        title,
        description,
        originalFilename,
        s3Key,
        s3Url: uploadResult.Location,
        fileSize: file.size,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        visibility,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        status: 'uploaded'
      });

      // Add to transcoding queue
      await transcodingQueue.add('transcode-video', {
        videoId,
        userId,
        s3Key,
        metadata
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      });

      // Send notification
      await notificationService.sendNotification(userId, {
        type: 'video_uploaded',
        title: 'Video Upload Complete',
        message: `Your video "${title}" has been uploaded and is being processed.`,
        data: { videoId }
      });

      res.status(201).json({
        message: 'Video uploaded successfully',
        video: {
          id: videoId,
          title,
          status: 'processing',
          uploadedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Video upload error:', error);
      res.status(500).json({ error: 'Failed to upload video' });
    }
  }

  async uploadThumbnail(req, res) {
    try {
      const { videoId } = req.body;
      const userId = req.user.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No thumbnail file provided' });
      }

      // Validate that user owns the video
      const video = await videoService.getVideoById(videoId);
      if (!video || video.userId !== userId) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Validate and process image
      const fileType = await FileType.fromBuffer(file.buffer);
      if (!fileType || !fileType.mime.startsWith('image/')) {
        return res.status(400).json({ error: 'Invalid image file format' });
      }

      // Resize and optimize thumbnail
      const processedImage = await sharp(file.buffer)
        .resize(1280, 720, { 
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Upload to S3
      const s3Key = `videos/thumbnails/${videoId}.jpg`;
      const uploadResult = await s3Service.uploadFile({
        key: s3Key,
        buffer: processedImage,
        contentType: 'image/jpeg',
        metadata: {
          videoId,
          userId,
          type: 'thumbnail'
        }
      });

      // Update video record
      await videoService.updateVideo(videoId, {
        thumbnailUrl: uploadResult.Location,
        customThumbnail: true
      });

      res.json({
        message: 'Thumbnail uploaded successfully',
        thumbnailUrl: uploadResult.Location
      });

    } catch (error) {
      console.error('Thumbnail upload error:', error);
      res.status(500).json({ error: 'Failed to upload thumbnail' });
    }
  }

  async bulkUpload(req, res) {
    try {
      const files = req.files;
      const userId = req.user.id;
      const { visibility = 'private' } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      const uploadPromises = files.map(async (file, index) => {
        try {
          const videoId = uuidv4();
          const title = file.originalname.replace(/\.[^/.]+$/, ""); // Remove extension
          const fileExtension = path.extname(file.originalname);
          const s3Key = `videos/originals/${videoId}${fileExtension}`;

          // Get video metadata
          const metadata = await this.getVideoMetadata(file.buffer);

          // Upload to S3
          const uploadResult = await s3Service.uploadFile({
            key: s3Key,
            buffer: file.buffer,
            contentType: file.mimetype,
            metadata: {
              userId,
              videoId,
              originalName: file.originalname
            }
          });

          // Create video record
          const videoRecord = await videoService.createVideo({
            id: videoId,
            userId,
            title,
            originalFilename: file.originalname,
            s3Key,
            s3Url: uploadResult.Location,
            fileSize: file.size,
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height,
            visibility,
            status: 'uploaded'
          });

          // Add to transcoding queue
          await transcodingQueue.add('transcode-video', {
            videoId,
            userId,
            s3Key,
            metadata
          });

          return { videoId, title, status: 'success' };
        } catch (error) {
          console.error(`Error uploading file ${file.originalname}:`, error);
          return { 
            filename: file.originalname, 
            status: 'error', 
            error: error.message 
          };
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      const uploads = results.map(result => 
        result.status === 'fulfilled' ? result.value : result.reason
      );

      res.json({
        message: 'Bulk upload completed',
        uploads
      });

    } catch (error) {
      console.error('Bulk upload error:', error);
      res.status(500).json({ error: 'Failed to process bulk upload' });
    }
  }

  async getUploadProgress(req, res) {
    try {
      const { uploadId } = req.params;
      const userId = req.user.id;

      // Check if upload exists and belongs to user
      const video = await videoService.getVideoById(uploadId);
      if (!video || video.userId !== userId) {
        return res.status(404).json({ error: 'Upload not found' });
      }

      // Get job status from queue
      const job = await transcodingQueue.getJob(uploadId);
      let progress = {
        status: video.status,
        progress: 0,
        stage: 'uploaded'
      };

      if (job) {
        progress = {
          status: job.opts.jobId === uploadId ? 'processing' : video.status,
          progress: job.progress || 0,
          stage: job.data?.stage || 'transcoding',
          completedOn: job.finishedOn,
          failedReason: job.failedReason
        };
      }

      res.json(progress);

    } catch (error) {
      console.error('Get upload progress error:', error);
      res.status(500).json({ error: 'Failed to get upload progress' });
    }
  }

  async cancelUpload(req, res) {
    try {
      const { uploadId } = req.params;
      const userId = req.user.id;

      // Verify ownership
      const video = await videoService.getVideoById(uploadId);
      if (!video || video.userId !== userId) {
        return res.status(404).json({ error: 'Upload not found' });
      }

      // Cancel transcoding job if running
      const job = await transcodingQueue.getJob(uploadId);
      if (job && ['waiting', 'active', 'delayed'].includes(await job.getState())) {
        await job.remove();
      }

      // Delete files from S3
      if (video.s3Key) {
        await s3Service.deleteFile(video.s3Key);
      }

      // Delete video record
      await videoService.deleteVideo(uploadId);

      res.json({ message: 'Upload cancelled successfully' });

    } catch (error) {
      console.error('Cancel upload error:', error);
      res.status(500).json({ error: 'Failed to cancel upload' });
    }
  }

  async generatePresignedUrl(req, res) {
    try {
      const { filename, contentType, fileSize } = req.query;
      const userId = req.user.id;

      // Validate parameters
      if (!filename || !contentType) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      // Check file size limit
      const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024;
      if (fileSize && parseInt(fileSize) > maxSize) {
        return res.status(400).json({ error: 'File size exceeds limit' });
      }

      const videoId = uuidv4();
      const fileExtension = path.extname(filename);
      const s3Key = `videos/originals/${videoId}${fileExtension}`;

      // Generate presigned URL
      const presignedUrl = await s3Service.generatePresignedUrl({
        key: s3Key,
        contentType,
        expires: 3600, // 1 hour
        metadata: {
          userId,
          videoId,
          originalName: filename
        }
      });

      res.json({
        uploadUrl: presignedUrl,
        videoId,
        s3Key,
        expiresIn: 3600
      });

    } catch (error) {
      console.error('Generate presigned URL error:', error);
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  }

  async getVideoMetadata(buffer) {
    return new Promise((resolve, reject) => {
      // Create a temporary file-like stream from buffer
      const { Readable } = require('stream');
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      ffmpeg(stream)
        .ffprobe((err, metadata) => {
          if (err) {
            reject(err);
          } else {
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            resolve({
              duration: parseFloat(metadata.format.duration) || 0,
              width: videoStream?.width || 0,
              height: videoStream?.height || 0,
              bitrate: parseInt(metadata.format.bit_rate) || 0,
              format: metadata.format.format_name,
              codec: videoStream?.codec_name
            });
          }
        });
    });
  }
}

module.exports = new UploadController();
