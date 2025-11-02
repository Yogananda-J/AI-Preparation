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
- **Node.js** (v18 or higher)
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

## 🧩 Full-Stack Quickstart (Windows)

This project has a backend (`backend/`) and a frontend (`frontend/`). Follow these steps to run everything locally on Windows PowerShell.

### 1) Prereqs
- **Node.js 18+** (includes npm). Verify with `node -v` and `npm -v` in a NEW PowerShell window.
- **MongoDB Community** (local) or a cloud MongoDB URI.
- Optional for code execution (Judge0):
  - Docker Desktop (for local Judge0), or
  - RapidAPI account/key for Judge0 CE.

### 2) Backend setup
From the project root `AI_PREP/`:

Create `backend/.env` (copy from example and fill values):

```ini
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/aicodeskill
JWT_SECRET=dev_secret_change_me
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175
API_PREFIX=/api

# Choose ONE Judge0 option
# Option A: RapidAPI
# JUDGE0_URL=https://judge0-ce.p.rapidapi.com
# JUDGE0_RAPIDAPI_KEY=<your_rapidapi_key>
# JUDGE0_LOG=1

# Option B: Local Judge0 (Docker)
# JUDGE0_URL=http://localhost:2358
# JUDGE0_LOG=1
```

Install and run the backend:

```powershell
npm install --prefix backend
npm run dev --prefix backend
# Expect: API listening on http://localhost:5000/api
```

MongoDB tips:
- If MongoDB isn’t running as a Windows service, you can start it manually:
  ```powershell
  # One-time data folder
  mkdir C:\\data\\db -ErrorAction SilentlyContinue | Out-Null
  # Start mongod (adjust version path if different)
  Start-Process -FilePath "C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe" -ArgumentList "--dbpath","C:\\data\\db"
  ```

### 3) Frontend setup

Create `frontend/.env`:

```ini
VITE_API_BASE_URL=http://localhost:5000/api
VITE_APP_NAME=AI Coding Skill Enhancer
VITE_APP_VERSION=1.0.0
VITE_DEV_MODE=true
VITE_LOG_LEVEL=debug
```

Install and run the frontend:

```powershell
cd frontend
npm install
npm run dev
# Open the printed URL, e.g., http://localhost:5173
```

### 4) Judge0 options (to get Actual outputs)

- Option A: RapidAPI (no Docker)
  1. Subscribe to “Judge0 CE” on RapidAPI (free tier ok).
  2. Set `JUDGE0_URL` and `JUDGE0_RAPIDAPI_KEY` in `backend/.env`.
  3. Restart the backend.

- Option B: Local Judge0 (Docker)
  ```powershell
  docker run -d -p 2358:2358 judge0/judge0:latest
  ```
  Set `JUDGE0_URL=http://localhost:2358` in `backend/.env` and restart backend.

### 5) Verify integration

- **CORS**: Ensure your frontend origin(s) exist in `CORS_ORIGIN` and restart backend if edited.
- **API**: Browser → DevTools → Network → `GET /api/challenges/daily` returns 200.
- **Run challenge**: Open “Two Sum” and click Run. In `POST /api/challenges/run`, `data.details[].actual` should be populated when Judge0 is working.

## 🧪 Backend Endpoints (quick reference)

- `GET /api/health`
- `POST /api/auth/register` `{ username, email, password }`
- `POST /api/auth/login` `{ email, password }`
- `GET /api/auth/me` (Header: `Authorization: Bearer <token>`)

## 🛠 Troubleshooting

- **Node/npm not found in VS Code terminal**
  - Cause: VS Code launched before PATH update. Solution: close VS Code and reopen; verify `node -v`, `npm -v` in a new terminal.
  - Ensure User PATH contains `C:\\Program Files\\nodejs` (and optionally `C:\\Users\\<you>\\AppData\\Roaming\\npm`). As a fallback, run per-terminal: `$env:PATH += ';C:\\Program Files\\nodejs'`.

- **MongoDB connection refused (127.0.0.1:27017)**
  - Start the Windows service or run `mongod.exe` manually with `--dbpath C:\\data\\db`.
  - Confirm Compass connection: `mongodb://127.0.0.1:27017`, database `aicodeskill`, collection `users`.

- **CORS blocked**
  - Add exact frontend origin(s) to `CORS_ORIGIN` in `backend/.env` and restart backend.

- **Judge0 errors / empty Actual outputs**
  - RapidAPI: verify subscription and `JUDGE0_RAPIDAPI_KEY`.
  - Docker: ensure the Judge0 container is running and `JUDGE0_URL` points to it.

- **.env changes not applied**
  - Restart the backend process after editing `backend/.env`.
  
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
