const AWS = require('aws-sdk');

class S3Service {
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.bucketName = process.env.S3_BUCKET_NAME || 'hls-video-platform';
  }

  async uploadFile({ key, buffer, contentType, metadata = {} }) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
        ServerSideEncryption: 'AES256'
      };

      const result = await this.s3.upload(params).promise();
      return result;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload to S3: ${error.message}`);
    }
  }

  async deleteFile(key) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      await this.s3.deleteObject(params).promise();
      return true;
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error(`Failed to delete from S3: ${error.message}`);
    }
  }

  async deleteFiles(keys) {
    try {
      if (keys.length === 0) return true;

      const params = {
        Bucket: this.bucketName,
        Delete: {
          Objects: keys.map(key => ({ Key: key })),
          Quiet: false
        }
      };

      const result = await this.s3.deleteObjects(params).promise();
      
      if (result.Errors && result.Errors.length > 0) {
        console.error('S3 bulk delete errors:', result.Errors);
        throw new Error('Some files failed to delete');
      }

      return true;
    } catch (error) {
      console.error('S3 bulk delete error:', error);
      throw new Error(`Failed to delete files from S3: ${error.message}`);
    }
  }

  async getFile(key) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      const result = await this.s3.getObject(params).promise();
      return result;
    } catch (error) {
      console.error('S3 get file error:', error);
      throw new Error(`Failed to get file from S3: ${error.message}`);
    }
  }

  async getFileUrl(key, expires = 3600) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expires
      };

      const url = await this.s3.getSignedUrlPromise('getObject', params);
      return url;
    } catch (error) {
      console.error('S3 get signed URL error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  async generatePresignedUrl({ key, contentType, expires = 3600, metadata = {} }) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expires,
        ContentType: contentType,
        Metadata: metadata
      };

      const url = await this.s3.getSignedUrlPromise('putObject', params);
      return url;
    } catch (error) {
      console.error('S3 generate presigned URL error:', error);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  async copyFile(sourceKey, destinationKey) {
    try {
      const params = {
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey
      };

      const result = await this.s3.copyObject(params).promise();
      return result;
    } catch (error) {
      console.error('S3 copy file error:', error);
      throw new Error(`Failed to copy file in S3: ${error.message}`);
    }
  }

  async listFiles(prefix = '', maxKeys = 1000) {
    try {
      const params = {
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys
      };

      const result = await this.s3.listObjectsV2(params).promise();
      return result.Contents || [];
    } catch (error) {
      console.error('S3 list files error:', error);
      throw new Error(`Failed to list files from S3: ${error.message}`);
    }
  }

  async getFileMetadata(key) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      const result = await this.s3.headObject(params).promise();
      return {
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        lastModified: result.LastModified,
        etag: result.ETag,
        metadata: result.Metadata
      };
    } catch (error) {
      console.error('S3 get metadata error:', error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  async fileExists(key) {
    try {
      await this.getFileMetadata(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  generatePublicUrl(key) {
    return `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  }
}

module.exports = new S3Service();
