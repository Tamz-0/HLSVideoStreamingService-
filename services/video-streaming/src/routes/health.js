const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'video-streaming',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

router.get('/ready', async (req, res) => {
  try {
    // Check database connectivity
    const dbService = require('../services/databaseService');
    await dbService.checkConnection();
    
    // Check Redis connectivity
    const cacheService = require('../services/cacheService');
    await cacheService.checkConnection();
    
    // Check S3 connectivity
    const s3Service = require('../services/s3Service');
    await s3Service.checkConnection();
    
    res.json({
      status: 'ready',
      service: 'video-streaming',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        cache: 'connected',
        storage: 'connected'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      service: 'video-streaming',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
