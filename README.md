# HLS Video Streaming Platform

A complete, production-ready video streaming platform built with modern technologies. This platform provides everything needed to upload, process, store, and stream videos with HLS (HTTP Live Streaming) technology.

## 🌟 Features

### 🎥 Video Management
- **Upload & Processing**: Automatic video transcoding with FFmpeg
- **HLS Streaming**: Adaptive bitrate streaming for optimal performance
- **Multiple Formats**: Support for various video formats (MP4, AVI, MOV, WMV)
- **Quality Options**: Multiple resolution and bitrate options
- **Thumbnail Generation**: Automatic thumbnail creation

### 👥 User Management
- **Authentication**: JWT-based secure authentication
- **User Roles**: User, Creator, Moderator, Admin roles
- **Profile Management**: Complete profile customization
- **Avatar Upload**: Profile picture management
- **Email Verification**: Secure email confirmation

### 📊 Analytics & Dashboard
- **Creator Dashboard**: Comprehensive analytics for content creators
- **Admin Panel**: Platform-wide management and monitoring
- **Real-time Stats**: Live performance metrics
- **Growth Tracking**: Subscriber and view analytics

### 🔧 Technical Features
- **Microservices Architecture**: Scalable, maintainable codebase
- **Docker Support**: Complete containerization
- **Kubernetes Ready**: Production deployment manifests
- **Monitoring**: Prometheus metrics and Grafana dashboards
- **Caching**: Redis for performance optimization

## 🏗️ Architecture Overview

This platform consists of multiple microservices:

- **User Management Service**: Authentication and user profiles ✅ **COMPLETE**
- **Video Upload Service**: Handle video file uploads
- **Video Metadata Service**: Store and manage video information
- **Transcoding Orchestration Service**: Manage transcoding job queues
- **Video Streaming Service**: Serve HLS playlists and video segments
- **Notification Service**: Real-time notifications
- **Transcoding Workers**: Docker containers for video processing
- **Frontend Application**: Beautiful Next.js React app ✅ **COMPLETE**

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- AWS Account (for S3 storage)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hls-streaming-platform
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Configure your environment variables
   ```

3. **Database Setup**
   ```bash
   # Initialize PostgreSQL with our schema
   psql -U postgres -d hls_platform -f database/init.sql
   ```

4. **Start Backend Services**
   ```bash
   # Start User Management Service
   cd services/user-management
   npm install
   npm run dev
   ```

5. **Start Frontend**
   ```bash
   # Start the beautiful frontend
   cd frontend
   npm install
   npm run dev
   ```

6. **Access the Application**
   - Frontend: http://localhost:3000
   - User Management API: http://localhost:3001
   - API Documentation: http://localhost:3001/health

## 📁 Project Structure

- `/services/` - Microservices
- `/workers/` - Background workers
- `/infrastructure/` - Kubernetes and Terraform configs
- `/database/` - Database migrations and schemas
- `/shared/` - Shared libraries and configurations
- `/monitoring/` - Monitoring and observability
- `/frontend/` - Web application
- `/docs/` - Documentation

## Development

See individual service README files for specific development instructions.

## Deployment

Refer to `/infrastructure/` for Kubernetes and Terraform deployment configurations.
