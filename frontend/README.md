# HLS Streaming Platform Frontend

A beautiful, modern React/Next.js frontend for the HLS Video Streaming Platform with user management and creator dashboard.

## ✨ Features

### 🎨 Modern UI/UX
- **Beautiful Design**: Clean, modern interface with gradient backgrounds and glass morphism effects
- **Responsive**: Fully responsive design that works on all devices
- **Dark Mode Ready**: Prepared for dark mode implementation
- **Smooth Animations**: Framer Motion animations and CSS transitions
- **Custom Components**: Reusable UI components with Tailwind CSS

### 🔐 Authentication & User Management
- **Complete Auth Flow**: Login, register, forgot password, email verification
- **User Profiles**: Profile management with avatar upload
- **Role-Based Access**: Different interfaces for users, creators, moderators, and admins
- **Security**: JWT token management with automatic refresh

### 📊 Creator Dashboard
- **Analytics**: Comprehensive stats for videos, views, likes, and subscribers
- **Content Management**: Upload and manage videos
- **Performance Tracking**: Real-time performance metrics
- **Subscriber Growth**: Track subscriber growth over time

### 👑 Admin Dashboard
- **User Management**: Manage users, roles, and permissions
- **Platform Analytics**: Overview of platform statistics
- **Content Moderation**: Tools for content management
- **System Monitoring**: Platform health and performance metrics

### 🚀 Performance
- **Optimized Bundle**: Code splitting and lazy loading
- **Fast Loading**: Optimized images and assets
- **Caching**: Intelligent caching strategies
- **SEO Ready**: Meta tags and structured data

## 🛠️ Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand + React Query
- **Authentication**: JWT with cookie storage
- **UI Components**: Headless UI + Heroicons
- **Animations**: Framer Motion
- **Forms**: React Hook Form with validation
- **HTTP Client**: Axios with interceptors
- **TypeScript**: Full type safety

## 📁 Project Structure

```
frontend/
├── app/                          # Next.js app directory
│   ├── auth/                     # Authentication pages
│   │   ├── login/page.tsx        # Login page
│   │   └── register/page.tsx     # Registration page
│   ├── dashboard/                # Dashboard pages
│   │   ├── layout.tsx            # Dashboard layout
│   │   ├── page.tsx              # Dashboard home
│   │   ├── videos/               # Video management
│   │   ├── analytics/            # Analytics pages
│   │   ├── admin/                # Admin pages
│   │   └── settings/             # Settings pages
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   └── providers.tsx             # React providers
├── components/                   # Reusable components
│   ├── dashboard/                # Dashboard components
│   │   ├── Header.tsx            # Dashboard header
│   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   └── StatsCard.tsx         # Statistics cards
│   ├── ui/                       # UI components
│   │   ├── Button.tsx            # Button component
│   │   ├── Input.tsx             # Input component
│   │   ├── Modal.tsx             # Modal component
│   │   └── LoadingSpinner.tsx    # Loading spinner
│   └── forms/                    # Form components
├── lib/                          # Utilities and services
│   ├── api.ts                    # API client and services
│   ├── utils.ts                  # Utility functions
│   └── validations.ts            # Form validations
├── store/                        # State management
│   ├── auth-store.tsx            # Authentication state
│   └── ui-store.ts               # UI state
├── types/                        # TypeScript types
│   └── index.ts                  # Type definitions
├── hooks/                        # Custom React hooks
│   ├── useAuth.ts                # Authentication hook
│   ├── useApi.ts                 # API hooks
│   └── useDebounce.ts            # Debounce hook
└── public/                       # Static assets
    ├── images/                   # Images
    └── icons/                    # Icons
```

## 🎨 Design System

### Colors
- **Primary**: Blue shades (#3B82F6 - #1E3A8A)
- **Secondary**: Gray shades (#F8FAFC - #0F172A)
- **Accent**: Purple shades (#D946EF - #701A75)
- **Status Colors**: Success (Green), Warning (Yellow), Error (Red)

### Typography
- **Display**: Lexend font family for headings
- **Body**: Inter font family for text
- **Sizes**: Responsive typography scale

### Components
- **Cards**: Glass morphism effects with subtle shadows
- **Buttons**: Multiple variants (primary, secondary, ghost)
- **Inputs**: Clean design with focus states
- **Badges**: Status indicators with color coding

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Backend API running (see backend README)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hls/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NEXT_PUBLIC_WS_URL=ws://localhost:3001
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

### Build for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 📱 Features Overview

### Landing Page
- **Hero Section**: Compelling call-to-action with gradient backgrounds
- **Features**: Showcase of platform capabilities
- **Statistics**: Platform metrics and social proof
- **Navigation**: Clean header with authentication links

### Authentication
- **Login Form**: Email/password with validation
- **Registration**: Multi-step form with password strength indicator
- **Password Reset**: Secure password reset flow
- **Email Verification**: Email confirmation process

### Dashboard Layout
- **Responsive Sidebar**: Collapsible navigation with role-based menu items
- **Header**: User menu, notifications, and search
- **Breadcrumbs**: Navigation trail for better UX
- **Quick Actions**: Contextual action buttons

### User Dashboard
- **Profile Management**: Update profile information and avatar
- **Settings**: Account settings and preferences
- **Notifications**: In-app notification system
- **Activity Feed**: Recent account activity

### Creator Dashboard
- **Analytics Overview**: Video performance metrics
- **Content Library**: Manage uploaded videos
- **Upload Interface**: Drag-and-drop video upload
- **Subscriber Management**: Track and engage with subscribers

### Admin Dashboard
- **User Management**: CRUD operations for users
- **Role Management**: Assign and modify user roles
- **Content Moderation**: Review and moderate content
- **Platform Analytics**: System-wide statistics

## 🔧 Configuration

### Environment Variables

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Authentication
NEXT_PUBLIC_JWT_STORAGE_KEY=hls_access_token
NEXT_PUBLIC_REFRESH_TOKEN_KEY=hls_refresh_token

# File Upload
NEXT_PUBLIC_MAX_FILE_SIZE=50000000
NEXT_PUBLIC_ALLOWED_VIDEO_TYPES=video/mp4,video/avi,video/mov
NEXT_PUBLIC_ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/gif

# Application
NEXT_PUBLIC_APP_NAME=HLS Streaming Platform
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
```

### Tailwind Configuration
Custom design tokens and utilities are defined in `tailwind.config.js`:
- Custom color palette
- Extended animations
- Custom components
- Responsive breakpoints

### API Configuration
The API client is configured in `lib/api.ts`:
- Automatic token refresh
- Request/response interceptors
- Error handling
- Type-safe endpoints

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📦 Building & Deployment

### Docker Deployment

```bash
# Build Docker image
docker build -t hls-frontend .

# Run container
docker run -p 3000:3000 hls-frontend
```

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Manual Deployment

```bash
# Build for production
npm run build

# Export static files (if needed)
npm run export
```

## 🎯 Performance Optimization

### Code Splitting
- **Dynamic Imports**: Lazy load heavy components
- **Route-based Splitting**: Automatic code splitting by pages
- **Component Splitting**: Split large components

### Image Optimization
- **Next.js Image**: Optimized image loading
- **WebP Support**: Modern image formats
- **Lazy Loading**: Images load on scroll

### Caching Strategy
- **React Query**: Intelligent data caching
- **Service Worker**: Cache static assets
- **Browser Caching**: Leverage browser cache

## 🔒 Security

### Authentication Security
- **JWT Tokens**: Secure token-based authentication
- **Token Refresh**: Automatic token renewal
- **Secure Storage**: HTTP-only cookies for tokens

### Form Security
- **Input Validation**: Client-side and server-side validation
- **CSRF Protection**: Cross-site request forgery protection
- **XSS Prevention**: Content sanitization

### API Security
- **Request Interceptors**: Automatic token attachment
- **Error Handling**: Secure error messages
- **Rate Limiting**: Prevent API abuse

## 🌐 Internationalization

Ready for i18n implementation:
- **Text Externalization**: Prepare for translation
- **RTL Support**: Right-to-left language support
- **Locale Detection**: Automatic locale detection

## ♿ Accessibility

- **ARIA Labels**: Screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: WCAG compliant color schemes
- **Focus Management**: Proper focus handling

## 🐛 Troubleshooting

### Common Issues

1. **API Connection Failed**
   - Check backend is running on correct port
   - Verify NEXT_PUBLIC_API_URL in environment variables

2. **Authentication Not Working**
   - Clear browser cookies and local storage
   - Check JWT secret matches backend configuration

3. **Styles Not Loading**
   - Ensure Tailwind CSS is properly configured
   - Check for conflicting CSS imports

4. **Build Errors**
   - Update Node.js to latest LTS version
   - Clear node_modules and reinstall dependencies

### Development Tips

1. **Hot Reload Issues**
   ```bash
   # Clear Next.js cache
   rm -rf .next
   npm run dev
   ```

2. **TypeScript Errors**
   ```bash
   # Check types
   npm run type-check
   ```

3. **Linting Issues**
   ```bash
   # Fix linting errors
   npm run lint:fix
   ```

## 🤝 Contributing

1. **Code Style**: Follow ESLint and Prettier configurations
2. **Commits**: Use conventional commit messages
3. **Testing**: Write tests for new features
4. **Documentation**: Update README for new features

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Next.js Team**: For the amazing framework
- **Tailwind CSS**: For the utility-first CSS framework
- **Headless UI**: For accessible UI components
- **Heroicons**: For beautiful SVG icons

## 📞 Support

For support and questions:
- **Documentation**: Check the docs folder
- **Issues**: Create a GitHub issue
- **Community**: Join our Discord server

---

**Built with ❤️ using Next.js and Tailwind CSS**
