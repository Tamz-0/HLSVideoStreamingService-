const multer = require('multer');
const path = require('path');

// File type validation
const fileFilter = (req, file, cb) => {
  // Video file types
  const videoTypes = /mp4|avi|mov|wmv|flv|webm|mkv|m4v|3gp|mpeg|mpg/;
  // Image file types for thumbnails
  const imageTypes = /jpeg|jpg|png|gif|webp/;
  
  const extname = videoTypes.test(path.extname(file.originalname).toLowerCase()) ||
                  imageTypes.test(path.extname(file.originalname).toLowerCase());
  
  const mimetype = file.mimetype.startsWith('video/') || 
                   file.mimetype.startsWith('image/');

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only video and image files are allowed'), false);
  }
};

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024, // 500MB default
    files: 10 // Maximum 10 files for bulk upload
  },
  fileFilter: fileFilter
});

// Video-specific upload (single file)
const uploadVideo = upload.single('video');

// Thumbnail upload (single file)
const uploadThumbnail = upload.single('thumbnail');

// Bulk upload (multiple files)
const uploadMultiple = upload.array('videos', 10);

// Validation middleware
const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Check file size
  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024;
  
  if (req.file && req.file.size > maxSize) {
    return res.status(400).json({ 
      error: `File size exceeds limit of ${maxSize / (1024 * 1024)}MB` 
    });
  }

  if (req.files) {
    for (const file of req.files) {
      if (file.size > maxSize) {
        return res.status(400).json({ 
          error: `File ${file.originalname} exceeds size limit of ${maxSize / (1024 * 1024)}MB` 
        });
      }
    }
  }

  next();
};

// Video metadata validation
const validateVideoMetadata = (req, res, next) => {
  const { title, description, visibility, tags } = req.body;

  // Title validation
  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: 'Video title is required' });
  }

  if (title.length > 100) {
    return res.status(400).json({ error: 'Title must be less than 100 characters' });
  }

  // Description validation
  if (description && description.length > 2000) {
    return res.status(400).json({ error: 'Description must be less than 2000 characters' });
  }

  // Visibility validation
  const validVisibilities = ['public', 'private', 'unlisted'];
  if (visibility && !validVisibilities.includes(visibility)) {
    return res.status(400).json({ 
      error: 'Invalid visibility. Must be one of: public, private, unlisted' 
    });
  }

  // Tags validation
  if (tags) {
    const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    
    if (tagArray.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 tags allowed' });
    }

    for (const tag of tagArray) {
      if (tag.length > 20) {
        return res.status(400).json({ error: 'Each tag must be less than 20 characters' });
      }
    }
  }

  next();
};

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ 
          error: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE || '500MB'}` 
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ error: 'Too many files. Maximum 10 files allowed' });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ error: 'Unexpected file field' });
      default:
        return res.status(400).json({ error: `Upload error: ${error.message}` });
    }
  }

  if (error.message === 'Only video and image files are allowed') {
    return res.status(400).json({ error: error.message });
  }

  next(error);
};

module.exports = {
  uploadVideo,
  uploadThumbnail,
  uploadMultiple,
  validateFileUpload,
  validateVideoMetadata,
  handleMulterError
};
