const { Pool } = require('pg');

class VideoService {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'hls_platform',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async createVideo(videoData) {
    const client = await this.pool.connect();
    try {
      const {
        id,
        userId,
        title,
        description = '',
        originalFilename,
        s3Key,
        s3Url,
        fileSize,
        duration,
        width,
        height,
        visibility = 'private',
        tags = [],
        status = 'uploaded'
      } = videoData;

      const query = `
        INSERT INTO videos (
          id, user_id, title, description, original_filename, s3_key, s3_url,
          file_size, duration, width, height, visibility, tags, status,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          NOW(), NOW()
        ) RETURNING *
      `;

      const values = [
        id, userId, title, description, originalFilename, s3Key, s3Url,
        fileSize, duration, width, height, visibility, tags, status
      ];

      const result = await client.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Create video error:', error);
      throw new Error(`Failed to create video record: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async getVideoById(videoId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT v.*, u.username, u.display_name
        FROM videos v
        JOIN users u ON v.user_id = u.id
        WHERE v.id = $1
      `;

      const result = await client.query(query, [videoId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Get video by ID error:', error);
      throw new Error(`Failed to get video: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async updateVideo(videoId, updateData) {
    const client = await this.pool.connect();
    try {
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          updateFields.push(`${this.camelToSnake(key)} = $${paramCount}`);
          values.push(updateData[key]);
          paramCount++;
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(videoId);

      const query = `
        UPDATE videos 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Update video error:', error);
      throw new Error(`Failed to update video: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async deleteVideo(videoId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete related records first
      await client.query('DELETE FROM video_analytics WHERE video_id = $1', [videoId]);
      await client.query('DELETE FROM video_comments WHERE video_id = $1', [videoId]);
      await client.query('DELETE FROM video_likes WHERE video_id = $1', [videoId]);
      await client.query('DELETE FROM playlists_videos WHERE video_id = $1', [videoId]);

      // Delete the video
      const result = await client.query('DELETE FROM videos WHERE id = $1 RETURNING *', [videoId]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Delete video error:', error);
      throw new Error(`Failed to delete video: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async getUserVideos(userId, options = {}) {
    const client = await this.pool.connect();
    try {
      const {
        status,
        visibility,
        limit = 20,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;

      let query = `
        SELECT v.*, 
               COUNT(vl.id) as likes_count,
               COUNT(vc.id) as comments_count
        FROM videos v
        LEFT JOIN video_likes vl ON v.id = vl.video_id
        LEFT JOIN video_comments vc ON v.id = vc.video_id
        WHERE v.user_id = $1
      `;

      const queryParams = [userId];
      let paramCount = 2;

      if (status) {
        query += ` AND v.status = $${paramCount}`;
        queryParams.push(status);
        paramCount++;
      }

      if (visibility) {
        query += ` AND v.visibility = $${paramCount}`;
        queryParams.push(visibility);
        paramCount++;
      }

      query += ` GROUP BY v.id`;
      query += ` ORDER BY v.${this.camelToSnake(sortBy)} ${sortOrder}`;
      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      queryParams.push(limit, offset);

      const result = await client.query(query, queryParams);
      return result.rows;
    } catch (error) {
      console.error('Get user videos error:', error);
      throw new Error(`Failed to get user videos: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async searchVideos(searchOptions = {}) {
    const client = await this.pool.connect();
    try {
      const {
        query: searchQuery,
        tags,
        userId,
        visibility = 'public',
        status = 'published',
        duration,
        limit = 20,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = searchOptions;

      let query = `
        SELECT v.*, u.username, u.display_name,
               COUNT(vl.id) as likes_count,
               COUNT(vc.id) as comments_count
        FROM videos v
        JOIN users u ON v.user_id = u.id
        LEFT JOIN video_likes vl ON v.id = vl.video_id
        LEFT JOIN video_comments vc ON v.id = vc.video_id
        WHERE v.visibility = $1 AND v.status = $2
      `;

      const queryParams = [visibility, status];
      let paramCount = 3;

      if (searchQuery) {
        query += ` AND (v.title ILIKE $${paramCount} OR v.description ILIKE $${paramCount})`;
        queryParams.push(`%${searchQuery}%`);
        paramCount++;
      }

      if (tags && tags.length > 0) {
        query += ` AND v.tags && $${paramCount}`;
        queryParams.push(tags);
        paramCount++;
      }

      if (userId) {
        query += ` AND v.user_id = $${paramCount}`;
        queryParams.push(userId);
        paramCount++;
      }

      if (duration) {
        const [min, max] = duration;
        if (min !== undefined) {
          query += ` AND v.duration >= $${paramCount}`;
          queryParams.push(min);
          paramCount++;
        }
        if (max !== undefined) {
          query += ` AND v.duration <= $${paramCount}`;
          queryParams.push(max);
          paramCount++;
        }
      }

      query += ` GROUP BY v.id, u.username, u.display_name`;
      query += ` ORDER BY v.${this.camelToSnake(sortBy)} ${sortOrder}`;
      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      queryParams.push(limit, offset);

      const result = await client.query(query, queryParams);
      return result.rows;
    } catch (error) {
      console.error('Search videos error:', error);
      throw new Error(`Failed to search videos: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async getVideoStats(videoId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          v.id,
          v.views_count,
          COUNT(DISTINCT vl.id) as likes_count,
          COUNT(DISTINCT vc.id) as comments_count,
          COUNT(DISTINCT va.id) as analytics_count
        FROM videos v
        LEFT JOIN video_likes vl ON v.id = vl.video_id
        LEFT JOIN video_comments vc ON v.id = vc.video_id
        LEFT JOIN video_analytics va ON v.id = va.video_id
        WHERE v.id = $1
        GROUP BY v.id, v.views_count
      `;

      const result = await client.query(query, [videoId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Get video stats error:', error);
      throw new Error(`Failed to get video stats: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async incrementViews(videoId) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE videos 
        SET views_count = views_count + 1,
            updated_at = NOW()
        WHERE id = $1
        RETURNING views_count
      `;

      const result = await client.query(query, [videoId]);
      return result.rows[0]?.views_count || 0;
    } catch (error) {
      console.error('Increment views error:', error);
      throw new Error(`Failed to increment views: ${error.message}`);
    } finally {
      client.release();
    }
  }

  camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

module.exports = new VideoService();
