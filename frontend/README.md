# 🚀 AI CodeSkill - Frontend

> **AI-Based Coding Skill Enhancer & Interview Prep Platform**

A modern, responsive React application built with Vite, TailwindCSS, and cutting-edge UI components for coding practice and interview preparation.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [API Integration](#api-integration)
- [Contributing](#contributing)

## ✨ Features

### 🎯 Core Features
- **Daily Coding Challenges** - AI-powered personalized challenges
- **Real-time Code Editor** - Monaco Editor integration (coming in Phase 3)
- **Mock Interviews** - AI-conducted coding interviews with instant feedback
- **Global Leaderboard** - Compete with developers worldwide
- **Progress Tracking** - Detailed analytics and skill progression
- **Responsive Design** - Mobile-first, modern UI/UX

### 🔧 Technical Features
- **Modern React** - Hooks, Context API, and functional components
- **Routing** - React Router DOM with nested routes
- **State Management** - Local state with hooks, API integration ready
- **Authentication** - JWT-based auth system (ready for backend)
- **API Services** - Modular service architecture
- **Error Handling** - Comprehensive error boundaries and validation
- **Performance** - Code splitting, lazy loading, and optimization

## 🛠 Tech Stack

### Frontend Framework
- **React 18** - Modern React with hooks and concurrent features
- **Vite** - Lightning-fast build tool and dev server
- **React Router DOM** - Client-side routing

### Styling & UI
- **TailwindCSS** - Utility-first CSS framework
- **Lucide React** - Beautiful, customizable icons
- **Custom Components** - Reusable, accessible UI components

### Development Tools
- **ESLint** - Code linting and quality
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixing

### Future Integrations
- **Monaco Editor** - VS Code-like code editor (Phase 3)
- **Axios** - HTTP client for API calls
- **JWT** - Authentication tokens

## 📁 Project Structure

```
frontend/
├── public/
│   └── index.html              # HTML template
├── src/
│   ├── assets/                 # Static assets (images, icons)
│   ├── components/             # Reusable UI components
│   │   ├── Layout.jsx         # Main layout wrapper
│   │   ├── Navbar.jsx         # Navigation component
│   │   └── Footer.jsx         # Footer component
│   ├── pages/                  # Page components
│   │   ├── Home.jsx           # Landing page
│   │   ├── Challenge.jsx      # Coding challenges
│   │   ├── Leaderboard.jsx    # Global rankings
│   │   ├── Profile.jsx        # User profile
│   │   ├── Interview.jsx      # Mock interviews
│   │   ├── Login.jsx          # Authentication
│   │   └── Signup.jsx         # User registration
│   ├── services/               # API service layer
│   │   ├── api.js             # Base API configuration
│   │   ├── authService.js     # Authentication APIs
│   │   ├── challengeService.js # Challenge APIs
│   │   ├── leaderboardService.js # Leaderboard APIs
│   │   └── interviewService.js # Interview APIs
│   ├── utils/                  # Utility functions
│   │   ├── helpers.js         # Common helper functions
│   │   └── constants.js       # Application constants
│   ├── styles/                 # Global styles
│   ├── App.jsx                # Main App component
│   ├── index.js               # Application entry point
│   ├── router.jsx             # Route configuration
│   └── index.css              # Global CSS with Tailwind
├── .env                        # Environment variables
├── .gitignore                  # Git ignore rules
├── package.json                # Dependencies and scripts
├── tailwind.config.js          # Tailwind configuration
├── postcss.config.js           # PostCSS configuration
├── vite.config.js              # Vite configuration
└── README.md                   # This file
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v16 or higher)
- **npm** or **yarn**

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AI_PREP/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5173
   ```

## 💻 Development

### Development Server
```bash
npm run dev          # Start dev server with hot reload
npm run dev -- --host # Expose to network
```

### Building
```bash
npm run build        # Build for production
npm run preview      # Preview production build
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
```

## 🔧 Environment Variables

Create a `.env` file in the root directory:

```env
# Backend API Configuration
VITE_API_BASE_URL=http://localhost:5000/api
VITE_APP_NAME=AI Coding Skill Enhancer
VITE_APP_VERSION=1.0.0

# Development Configuration
VITE_DEV_MODE=true
VITE_LOG_LEVEL=debug
```

### Available Variables
- `VITE_API_BASE_URL` - Backend API base URL
- `VITE_APP_NAME` - Application name
- `VITE_APP_VERSION` - Application version
- `VITE_DEV_MODE` - Enable development features
- `VITE_LOG_LEVEL` - Logging level

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |

## 🔌 API Integration

### Service Architecture
The application uses a modular service architecture:

- **Base API Client** (`api.js`) - Axios configuration with interceptors
- **Authentication Service** - Login, register, profile management
- **Challenge Service** - Coding challenges, submissions, progress
- **Leaderboard Service** - Rankings, statistics, user comparisons
- **Interview Service** - Mock interviews, AI feedback, analytics

### Example Usage
```javascript
import challengeService from '../services/challengeService';

// Get daily challenges
const { data, success } = await challengeService.getDailyChallenges();

// Submit solution
const result = await challengeService.submitSolution({
  challengeId: '123',
  code: 'function solution() { ... }',
  language: 'javascript'
});
```

## 🎨 UI Components

### Design System
- **Colors** - Primary blue, secondary gray, semantic colors
- **Typography** - System fonts with proper hierarchy
- **Spacing** - Consistent spacing scale
- **Components** - Reusable, accessible components

### Custom Classes
```css
.btn-primary     /* Primary button style */
.btn-secondary   /* Secondary button style */
.card           /* Card container */
.input-field    /* Form input styling */
```

## 🔄 Development Phases

### ✅ Phase 1 - Frontend Setup (Completed)
- [x] React + Vite setup
- [x] TailwindCSS configuration
- [x] Routing with React Router
- [x] Component structure
- [x] Service layer architecture

### 🚧 Phase 2 - Home Page (Next)
- [ ] Daily challenges integration
- [ ] Hero section optimization
- [ ] Statistics display

### 📋 Upcoming Phases
- **Phase 3** - Monaco Code Editor integration
- **Phase 4** - Leaderboard enhancements
- **Phase 5** - Profile management
- **Phase 6** - Interview system
- **Phase 7** - Authentication flow
- **Phase 8** - Backend integration
- **Phase 9** - CI/CD pipeline

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Use functional components with hooks
- Follow ESLint configuration
- Use TailwindCSS for styling
- Write descriptive commit messages
- Add JSDoc comments for functions

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React Team** - For the amazing framework
- **Vite Team** - For the lightning-fast build tool
- **TailwindCSS** - For the utility-first CSS framework
- **Lucide** - For the beautiful icons

---

**Built with ❤️ for developers by developers**
