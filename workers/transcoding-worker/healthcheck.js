const http = require('http');
const redis = require('redis');

// Health check for transcoding worker
async function healthCheck() {
  try {
    // Check Redis connection
    const redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    await redisClient.connect();
    await redisClient.ping();
    await redisClient.disconnect();
    
    // Check if FFmpeg is available
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec('ffmpeg -version', (error, stdout, stderr) => {
        if (error) {
          reject(new Error('FFmpeg not available'));
        } else {
          resolve(stdout);
        }
      });
    });
    
    console.log('Health check passed');
    process.exit(0);
    
  } catch (error) {
    console.error('Health check failed:', error.message);
    process.exit(1);
  }
}

// Run health check
if (require.main === module) {
  healthCheck();
}

module.exports = healthCheck;
