const jwt = require('jsonwebtoken');
const axios = require('axios');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Verify token locally first
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = decoded;
      return next();
    } catch (jwtError) {
      // If local verification fails, try user service verification
      console.log('Local JWT verification failed, trying user service...');
    }

    // Verify with user management service
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001';
    
    try {
      const response = await axios.get(`${userServiceUrl}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 5000
      });

      req.user = response.data.user;
      next();
    } catch (serviceError) {
      console.error('User service verification failed:', serviceError.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: userRoles
      });
    }

    next();
  };
};

const validateOwnership = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const userId = req.user.id;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    // Check if user owns the video
    const videoService = require('../services/videoService');
    const video = await videoService.getVideoById(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (video.userId !== userId && !req.user.roles?.includes('admin')) {
      return res.status(403).json({ error: 'Access denied. You can only access your own videos.' });
    }

    req.video = video;
    next();
  } catch (error) {
    console.error('Ownership validation error:', error);
    res.status(500).json({ error: 'Failed to validate ownership' });
  }
};

const serviceAuth = (req, res, next) => {
  const serviceToken = req.header('x-service-auth');
  const expectedToken = process.env.SERVICE_AUTH_TOKEN || 'development-token';

  if (!serviceToken || serviceToken !== expectedToken) {
    return res.status(401).json({ error: 'Invalid service authentication' });
  }

  next();
};

module.exports = {
  authMiddleware,
  requireRole,
  validateOwnership,
  serviceAuth
};
