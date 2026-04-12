-- Database initialization script
-- This script will be run when PostgreSQL container starts

-- Create the main database
CREATE DATABASE hls_platform;

-- Connect to the database
\c hls_platform;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'creator', 'admin')),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create videos table
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  original_filename VARCHAR(255),
  duration INTEGER, -- in seconds
  file_size BIGINT,
  status VARCHAR(20) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'failed')),
  upload_path VARCHAR(500),
  thumbnail_url VARCHAR(500),
  views_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create video transcodes table
CREATE TABLE video_transcodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  resolution VARCHAR(10) NOT NULL, -- 1080p, 720p, 480p, 360p
  bitrate INTEGER NOT NULL,
  codec VARCHAR(20) DEFAULT 'h264',
  hls_playlist_path VARCHAR(500),
  segment_duration INTEGER DEFAULT 10, -- in seconds
  total_segments INTEGER,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_size BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create thumbnails table
CREATE TABLE thumbnails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  thumbnail_path VARCHAR(500) NOT NULL,
  timestamp_seconds INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create transcoding jobs table
CREATE TABLE transcoding_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  job_type VARCHAR(20) NOT NULL CHECK (job_type IN ('transcode', 'thumbnail', 'preview')),
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  worker_id VARCHAR(50),
  priority INTEGER DEFAULT 5, -- 1-10, higher is more priority
  progress_percentage INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  job_data JSONB, -- Additional job configuration
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create video analytics table
CREATE TABLE video_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('view', 'play', 'pause', 'seek', 'complete')),
  timestamp_seconds INTEGER, -- Position in video when event occurred
  session_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  quality_level VARCHAR(10), -- Resolution being watched
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create user sessions table
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create video playlists table
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create playlist items table
CREATE TABLE playlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(playlist_id, video_id)
);

-- Create indexes for better performance
CREATE INDEX idx_videos_creator_id ON videos(creator_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_video_transcodes_video_id ON video_transcodes(video_id);
CREATE INDEX idx_video_transcodes_status ON video_transcodes(status);
CREATE INDEX idx_transcoding_jobs_status ON transcoding_jobs(status);
CREATE INDEX idx_transcoding_jobs_video_id ON transcoding_jobs(video_id);
CREATE INDEX idx_video_analytics_video_id ON video_analytics(video_id);
CREATE INDEX idx_video_analytics_created_at ON video_analytics(created_at);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_transcodes_updated_at BEFORE UPDATE ON video_transcodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transcoding_jobs_updated_at BEFORE UPDATE ON transcoding_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user
INSERT INTO users (username, email, password_hash, role, is_verified) 
VALUES ('admin', 'admin@example.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', TRUE);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
