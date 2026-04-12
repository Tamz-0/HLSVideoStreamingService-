const Queue = require('bull');
const AWS = require('aws-sdk');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
const { Pool } = require('pg');
const logger = require('./utils/logger');

require('dotenv').config();

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Configure database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Configure Redis queue
const transcodingQueue = new Queue('transcoding', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

// HLS transcoding profiles
const TRANSCODING_PROFILES = [
  { 
    name: '1080p', 
    width: 1920, 
    height: 1080, 
    bitrate: '5000k',
    audioBitrate: '192k'
  },
  { 
    name: '720p', 
    width: 1280, 
    height: 720, 
    bitrate: '2500k',
    audioBitrate: '128k'
  },
  { 
    name: '480p', 
    width: 854, 
    height: 480, 
    bitrate: '1000k',
    audioBitrate: '96k'
  },
  { 
    name: '360p', 
    width: 640, 
    height: 360, 
    bitrate: '500k',
    audioBitrate: '64k'
  }
];

// Worker ID for tracking
const WORKER_ID = `worker-${Math.random().toString(36).substr(2, 9)}`;

// Process transcoding jobs
transcodingQueue.process('transcode-video', 3, async (job) => {
  const { videoId, inputPath, outputBasePath } = job.data;
  
  try {
    logger.info(`Starting transcoding job for video ${videoId}`, { videoId, workerId: WORKER_ID });
    
    // Update job status
    await updateJobStatus(job.id, 'processing', WORKER_ID);
    
    // Create temporary directory
    const tempDir = path.join('/tmp/transcoding', videoId);
    await fs.ensureDir(tempDir);
    
    // Download video from S3
    const inputFile = path.join(tempDir, 'input.mp4');
    await downloadFromS3(inputPath, inputFile);
    
    // Get video metadata
    const metadata = await getVideoMetadata(inputFile);
    logger.info(`Video metadata: ${JSON.stringify(metadata)}`, { videoId });
    
    // Transcode to different resolutions
    const transcodedFiles = [];
    for (const profile of TRANSCODING_PROFILES) {
      // Skip if input resolution is lower than target
      if (metadata.height < profile.height) {
        logger.info(`Skipping ${profile.name} - input resolution too low`, { videoId });
        continue;
      }
      
      await job.progress(Math.round((transcodedFiles.length / TRANSCODING_PROFILES.length) * 100));
      
      const hlsOutput = await transcodeToHLS(inputFile, profile, tempDir, job);
      if (hlsOutput) {
        transcodedFiles.push({
          profile,
          ...hlsOutput
        });
        
        // Upload HLS files to S3
        await uploadHLSToS3(hlsOutput, `${outputBasePath}/${profile.name}`, videoId);
        
        // Save transcode info to database
        await saveTranscodeInfo(videoId, profile, hlsOutput);
      }
    }
    
    // Generate master playlist
    if (transcodedFiles.length > 0) {
      const masterPlaylist = generateMasterPlaylist(transcodedFiles);
      const masterPlaylistPath = path.join(tempDir, 'master.m3u8');
      await fs.writeFile(masterPlaylistPath, masterPlaylist);
      
      // Upload master playlist
      await uploadToS3(masterPlaylistPath, `${outputBasePath}/master.m3u8`);
    }
    
    // Generate thumbnails
    await generateThumbnails(inputFile, videoId, outputBasePath, tempDir);
    
    // Update video status
    await updateVideoStatus(videoId, 'ready');
    
    // Clean up temp directory
    await fs.remove(tempDir);
    
    logger.info(`Transcoding completed for video ${videoId}`, { videoId, profiles: transcodedFiles.length });
    
    return { 
      success: true, 
      videoId,
      profilesProcessed: transcodedFiles.length
    };
    
  } catch (error) {
    logger.error(`Transcoding failed for video ${videoId}:`, error);
    await updateVideoStatus(videoId, 'failed', error.message);
    await updateJobStatus(job.id, 'failed', WORKER_ID, error.message);
    throw error;
  }
});

// Helper functions
async function downloadFromS3(s3Path, localPath) {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: s3Path
  };
  
  const data = await s3.getObject(params).promise();
  await fs.writeFile(localPath, data.Body);
}

async function uploadToS3(localPath, s3Path) {
  const fileContent = await fs.readFile(localPath);
  
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: s3Path,
    Body: fileContent,
    ContentType: getContentType(s3Path)
  };
  
  return s3.upload(params).promise();
}

async function getVideoMetadata(inputFile) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputFile, (err, metadata) => {
      if (err) reject(err);
      else {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        resolve({
          duration: metadata.format.duration,
          width: videoStream.width,
          height: videoStream.height,
          bitrate: metadata.format.bit_rate
        });
      }
    });
  });
}

async function transcodeToHLS(inputFile, profile, outputDir, job) {
  const outputPath = path.join(outputDir, profile.name);
  await fs.ensureDir(outputPath);
  
  const playlistPath = path.join(outputPath, 'playlist.m3u8');
  const segmentPattern = path.join(outputPath, 'segment_%03d.ts');
  
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputFile)
      .videoCodec('libx264')
      .audioCodec('aac')
      .size(`${profile.width}x${profile.height}`)
      .videoBitrate(profile.bitrate)
      .audioBitrate(profile.audioBitrate)
      .outputOptions([
        '-hls_time 10',
        '-hls_list_size 0',
        '-hls_segment_filename', segmentPattern,
        '-f hls'
      ])
      .output(playlistPath);
    
    command.on('progress', (progress) => {
      if (job && progress.percent) {
        job.progress(Math.round(progress.percent));
      }
    });
    
    command.on('end', async () => {
      try {
        const segments = await fs.readdir(outputPath);
        const segmentFiles = segments.filter(f => f.endsWith('.ts'));
        
        resolve({
          playlistPath,
          segmentFiles: segmentFiles.map(f => path.join(outputPath, f)),
          segmentCount: segmentFiles.length
        });
      } catch (err) {
        reject(err);
      }
    });
    
    command.on('error', reject);
    command.run();
  });
}

async function uploadHLSToS3(hlsOutput, s3BasePath, videoId) {
  // Upload playlist
  await uploadToS3(hlsOutput.playlistPath, `${s3BasePath}/playlist.m3u8`);
  
  // Upload segments
  for (const segmentFile of hlsOutput.segmentFiles) {
    const segmentName = path.basename(segmentFile);
    await uploadToS3(segmentFile, `${s3BasePath}/${segmentName}`);
  }
}

function generateMasterPlaylist(transcodedFiles) {
  let playlist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';
  
  for (const file of transcodedFiles) {
    const bandwidth = parseInt(file.profile.bitrate.replace('k', '')) * 1000;
    playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${file.profile.width}x${file.profile.height}\n`;
    playlist += `${file.profile.name}/playlist.m3u8\n\n`;
  }
  
  return playlist;
}

async function generateThumbnails(inputFile, videoId, outputBasePath, tempDir) {
  const thumbnailDir = path.join(tempDir, 'thumbnails');
  await fs.ensureDir(thumbnailDir);
  
  // Generate thumbnails at different timestamps
  const timestamps = ['00:00:01', '25%', '50%', '75%'];
  
  for (let i = 0; i < timestamps.length; i++) {
    const thumbnailPath = path.join(thumbnailDir, `thumb_${i + 1}.jpg`);
    
    await new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .seekInput(timestamps[i])
        .outputOptions('-vframes 1')
        .size('320x180')
        .output(thumbnailPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    // Upload to S3
    const s3Path = `${outputBasePath}/thumbnails/thumb_${i + 1}.jpg`;
    await uploadToS3(thumbnailPath, s3Path);
    
    // Save to database
    await saveThumbnail(videoId, s3Path, i * 25, i === 0); // First thumbnail as primary
  }
}

async function updateJobStatus(jobId, status, workerId, errorMessage = null) {
  const query = `
    UPDATE transcoding_jobs 
    SET status = $1, worker_id = $2, error_message = $3, updated_at = NOW()
    WHERE id = $4
  `;
  await pool.query(query, [status, workerId, errorMessage, jobId]);
}

async function updateVideoStatus(videoId, status, errorMessage = null) {
  const query = `
    UPDATE videos 
    SET status = $1, updated_at = NOW()
    WHERE id = $2
  `;
  await pool.query(query, [status, videoId]);
}

async function saveTranscodeInfo(videoId, profile, hlsOutput) {
  const query = `
    INSERT INTO video_transcodes (video_id, resolution, bitrate, codec, hls_playlist_path, total_segments, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;
  
  const bitrate = parseInt(profile.bitrate.replace('k', ''));
  const playlistPath = `transcoded/${videoId}/${profile.name}/playlist.m3u8`;
  
  await pool.query(query, [
    videoId,
    profile.name,
    bitrate,
    'h264',
    playlistPath,
    hlsOutput.segmentCount,
    'completed'
  ]);
}

async function saveThumbnail(videoId, thumbnailPath, timestampSeconds, isPrimary) {
  const query = `
    INSERT INTO thumbnails (video_id, thumbnail_path, timestamp_seconds, width, height, is_primary)
    VALUES ($1, $2, $3, $4, $5, $6)
  `;
  
  await pool.query(query, [videoId, thumbnailPath, timestampSeconds, 320, 180, isPrimary]);
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.m3u8': 'application/x-mpegURL',
    '.ts': 'video/MP2T',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.mp4': 'video/mp4'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await transcodingQueue.close();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await transcodingQueue.close();
  await pool.end();
  process.exit(0);
});

logger.info(`Transcoding worker ${WORKER_ID} started and waiting for jobs`);

module.exports = transcodingQueue;
