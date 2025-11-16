# UpSkill

UpSkill is a monorepo for a modern coding interview and practice platform. It includes:

- A React (Vite) frontend
- An Express/MongoDB backend
- An optional Python FastAPI ML service for proctored interviews (overall webcam recording + anomaly analysis)
- Optional local code execution (ACE) for running code challenges

## Tech Stack

- Frontend: React 19 + Vite 7, React Router, TailwindCSS, Axios
- Backend: Node/Express, MongoDB (Mongoose), JWT auth, Zod
- Optional services: ACE runner (for multi-case execution)

## Repository Structure

```
AI_PREP/
├─ backend/                # Node/Express API server
│  ├─ src/
│  │  ├─ app.js           # Express app binding routes, CORS, health
│  │  ├─ config/          # env & db (mongoose) config
│  │  ├─ controllers/     # business logic for routes
│  │  ├─ data/            # challenges datasets (merged_problems.json, etc.)
│  │  ├─ middleware/      # auth middleware
│  │  ├─ models/          # Mongoose models (User, Challenge, Draft, Submission, Activity)
│  │  ├─ routes/          # route definitions (auth, challenges, leaderboard, profile, interviews)
│  │  ├─ services/        # extra services/helpers
│  │  └─ ws/              # interview WebSocket server (audio/video stream endpoints)
│  ├─ ml_service/         # Python FastAPI ML service for interviews
│  │  ├─ main.py          # FastAPI application
│  │  ├─ questions.py     # Question selection logic
│  │  └─ data/            # Question databases
│  ├─ scripts/            # Utility scripts (seeding, etc.)
│  ├─ .env                # backend environment (see below)
│  └─ package.json
├─ frontend/               # React app (Vite)
│  ├─ src/
│  │  ├─ components/      # UI components
│  │  ├─ pages/           # pages (Interview, Login, Signup, Profile, Challenge, Leaderboard)
│  │  ├─ services/        # api client and domain services
│  │  ├─ utils/           # helpers
│  │  ├─ App.jsx, main.jsx, router.jsx, index.css, App.css
│  ├─ .env                # frontend environment (see below)
│  └─ package.json
├─ ace/                    # optional local code runner (ACE)
│  ├─ api/                 # ACE API service (Express, MongoDB, Redis)
│  │  ├─ src/index.js
│  │  ├─ Dockerfile
│  │  └─ package.json
│  ├─ worker/              # ACE Worker service (code execution)
│  │  ├─ src/index.js
│  │  ├─ Dockerfile
│  │  └─ package.json
│  └─ docker-compose.yml   # Docker Compose for ACE services
├─ judge0/                 # legacy Judge0 deployment assets (not used in ACE-only setup)
├─ gateway/                # API Gateway (placeholder for microservices)
├─ services/               # Microservices structure (placeholder)
│  ├─ auth-service/
│  ├─ challenge-service/
│  ├─ interview-service/
│  ├─ profile-service/
│  └─ submission-service/
├─ package.json            # root (axios dep)
└─ README.md               # this file
```

## Prerequisites

### Required
- **Node.js 18+** (server uses fetch and ESM)
- **npm 9+**
- **MongoDB** running locally (or MongoDB Atlas URI)
  - Local: `mongodb://127.0.0.1:27017/aicodeskill`
  - Atlas: Use your MongoDB Atlas connection string

### Optional (for full functionality)
- **Docker & Docker Compose** (required for ACE service)
  - Docker Desktop or Docker Engine
  - Docker Compose v2+
  - Docker daemon running
- **Python 3.9+** (required for ML service)
  - pip or poetry for package management

## Environment Variables

Backend (`backend/.env`):

```env
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/aicodeskill
JWT_SECRET=dev_secret_change_me
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175
API_PREFIX=/api

# Optional: Code execution service (ACE)
ACE_URL=http://localhost:8080
JUDGE_LOG=1

# Optional: ML Service for interview features
ML_BASE_URL=http://localhost:8001
ML_SERVICE_URL=http://localhost:8001
```

Frontend (`frontend/.env`):

```
VITE_API_BASE=http://localhost:4000/api
VITE_DEV_MODE=false
VITE_USE_MOCKS=false
```

Notes:
- Frontend reads `VITE_API_BASE_URL` or `VITE_API_BASE`. Either is fine.
- Update ports consistently if you change `PORT` on the backend.

## Quick Start

1. **Start MongoDB** (if not already running)
   ```bash
   # macOS/Linux
   mongod
   
   # Or use Docker
   docker run -d -p 27017:27017 --name mongodb mongo:6
   ```

2. **Start Backend**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

3. **Start Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Optional: Start ACE Service** (for code execution)
   ```bash
   cd ace
   docker-compose up -d
   ```

5. **Optional: Start ML Service** (for interview features)
   ```bash
   cd backend/ml_service
   pip install fastapi uvicorn pydantic
   uvicorn main:app --host 0.0.0.0 --port 8001
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:4000/api
   - Health check: http://localhost:4000/api/health

## Full Setup on a New System

This section walks through setting up **everything** on a fresh machine:

- Backend (Node/Express + MongoDB)
- Frontend (React + Vite)
- ACE code execution service (Docker)
- Optional ML service (Python FastAPI)

The examples below assume **Windows + PowerShell**, but the commands are easily adapted to macOS/Linux.

### 1. Install prerequisites

- **Node.js 18+** (includes npm)
  - Download from https://nodejs.org and install.
  - Verify in a new terminal:
    - `node -v`
    - `npm -v`
- **MongoDB**
  - Either install MongoDB Community Server locally, or use a MongoDB Atlas URI.
  - Default local URL used by this project: `mongodb://127.0.0.1:27017/aicodeskill`.
- **Docker Desktop** (for ACE)
  - Install Docker Desktop, start it, and ensure the Docker daemon is running.
  - Verify:
    - `docker -v`
    - `docker compose version` **or** `docker-compose -v` (depending on your Docker installation).
- **Python 3.9+** (for ML service; optional)
  - Install from https://www.python.org.
  - Verify: `python --version` or `python3 --version`.

### 2. Clone the repository

```powershell
git clone <repository-url>
cd AI_PREP
```

### 3. Configure backend environment

Create `backend/.env`:

```ini
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/aicodeskill
JWT_SECRET=dev_secret_change_me
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175
API_PREFIX=/api

# Optional: Code execution service (ACE)
ACE_URL=http://localhost:8080
JUDGE_LOG=1

# Optional ML service (for interview features)
ML_BASE_URL=http://localhost:8001
ML_SERVICE_URL=http://localhost:8001

# Where interview videos are stored
UPLOAD_DIR=uploads
```

You can keep `ML_BASE_URL`/`ML_SERVICE_URL` even if you don’t start the ML service yet; those endpoints are optional.

### 4. Start MongoDB

If you use **local MongoDB** on Windows and it’s not already running as a service:

```powershell
# Create data directory once
mkdir C:\data\db -ErrorAction SilentlyContinue | Out-Null

# Start mongod (adjust version/path as needed)
Start-Process -FilePath "C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe" -ArgumentList "--dbpath","C:\\data\\db"
```

If you prefer **Docker for MongoDB**:

```powershell
docker run -d -p 27017:27017 --name mongodb mongo:6
```

### 5. Install and run backend

```powershell
cd backend
npm install
npm run dev
```

Expected:

- Logs showing `MongoDB connected`.
- API listening on `http://localhost:4000/api`.
- Health check works: open `http://localhost:4000/api/health`.

Leave this terminal running.

### 6. Start ACE (Docker code execution service)

In a **new terminal**, from the project root:

```powershell
cd ace

# Start all ACE services (API, worker, MongoDB, Redis)
docker-compose up -d

# Or if your Docker uses `docker compose`:
# docker compose up -d
```

You should see containers for:

- `ace-api-1`
- `ace-worker-1`
- `ace-mongo-1`
- `ace-redis-1`

Verify ACE API is reachable:

```powershell
curl http://localhost:8080/submissions
```

It’s fine if this returns a 404 or error JSON; the key is that you **don’t** see `Failed to connect`.

Ensure `ACE_URL` in `backend/.env` matches the ACE API URL (default `http://localhost:8080`).

### 7. (Optional) Start the ML service

In another terminal:

```powershell
cd backend/ml_service

# Install minimal dependencies (or use a requirements.txt if present)
python -m pip install fastapi uvicorn pydantic

# Start the ML service
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

Verify:

- `curl http://localhost:8001/health` should return a small JSON health response.

You can skip this step if you don’t need interview/ML features immediately; the main coding challenge flow works without it.

### 8. Configure and run frontend

Create `frontend/.env`:

```ini
VITE_API_BASE=http://localhost:4000/api
VITE_DEV_MODE=false
VITE_USE_MOCKS=false
```

Then in a new terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, typically `http://localhost:5173`.

### 9. Verify end-to-end flow

From the browser:

- Visit the **Challenges** page.
- Open a challenge (e.g., “Two Sum”).
- Write a simple solution in one of the supported languages.
- Click **Run**.

In DevTools Network tab, you should see:

- `POST /api/challenges/run` returning `{ success: true, data: { verdict, passed, total, time, memory, caseResults, ... } }`.

If something fails:

- Check backend logs for errors (e.g. missing `ACE_URL`, Mongo connection issues).
- Confirm ACE containers are running: `docker-compose ps` in `ace/`.
- Use `JUDGE_LOG=1` in `backend/.env` to see detailed run/harness logs.

Once this works, the full coding challenge loop (edit → run → submit) is correctly set up on your system.

### 10. (Optional) Single command for backend + ML service

If you frequently use the ML service, you can configure a single command in `backend/` to start **both** the Node backend and the Python ML service.

1. Install `concurrently` as a dev dependency:

   ```powershell
   cd backend
   npm install --save-dev concurrently
   ```

2. Edit `backend/package.json` and add scripts (adjust `dev` if your current command is different):

   ```jsonc
   "scripts": {
     "dev": "nodemon src/index.js",              // existing backend dev script
     "dev:ml": "cd ml_service && python -m uvicorn main:app --host 0.0.0.0 --port 8001",
     "dev:all": "concurrently \"npm run dev\" \"npm run dev:ml\""
   }
   ```

3. From `backend/`, start both services with one command:

   ```powershell
   cd backend
   npm run dev:all
   ```

This will run:

- The Node backend (`npm run dev`)
- The ML service (`python -m uvicorn main:app ...`)

in parallel, with interleaved logs in the same terminal. You can still run them separately if you prefer.

## Install and Run (Local)

### 1) Backend
- Open a terminal in `backend`
- Install: `npm install`
- Start dev server: `npm run dev`
- Expected logs:
  - `MongoDB connected`
  - `API listening on http://localhost:4000/api`
- Health check: http://localhost:4000/api/health

### 2) Frontend
- Open another terminal in `frontend`
- Install: `npm install`
- Start dev server: `npm run dev`
- Open: http://localhost:5173

### 3) Optional Services

#### ACE (Local Code Execution Service)

ACE is a Docker-based code execution service that runs code in isolated containers. It supports Python 3 and Java 17, with multi-test-case execution capabilities.

**Prerequisites:**
- Docker and Docker Compose installed
- Docker daemon running
- Ports 8080 (API), 6379 (Redis) available
- **Note**: ACE uses MongoDB on port 27017. If your main backend MongoDB also uses port 27017, you may need to:
  - Use MongoDB Atlas for backend (recommended)
  - Change ACE MongoDB port in `docker-compose.yml`
  - Use separate MongoDB instances for backend and ACE

**Setup:**
```bash
# Navigate to ace directory
cd ace

# Start all ACE services (API, Worker, MongoDB, Redis)
docker-compose up -d

# Check services are running
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**ACE Architecture:**
- **API Service** (`ace/api/`): REST API for submitting code execution requests
  - Port: 8080
  - Endpoints: `POST /submissions`, `GET /submissions/:token`
  - Uses MongoDB for submission storage and Redis/BullMQ for job queue
- **Worker Service** (`ace/worker/`): Processes code execution jobs
  - Runs code in isolated Docker containers with security constraints
  - Supports Python 3.11 and Java 17
  - Uses Docker-in-Docker pattern (requires `/var/run/docker.sock` access)
  - Time limit: 5 seconds (configurable via `DEFAULT_TIME_LIMIT_SEC`)
  - Memory limit: 512MB (configurable via `DEFAULT_MEMORY_LIMIT`)

**Backend Configuration:**
Add to `backend/.env`:
```env
ACE_URL=http://localhost:8080
JUDGE_LOG=1  # Enable debug logging for code execution
```

**Testing ACE:**
```bash
# Test ACE API directly
curl -X POST http://localhost:8080/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "language_id": 71,
    "source_code": "print(\"Hello, World!\")",
    "test_cases": [{"input": "", "expected_output": "Hello, World!\n"}]
  }'

# Check submission status (use token from above response)
curl http://localhost:8080/submissions/<token>
```

**ACE Status Codes:**
- `1` - QUEUED: Submission is in queue
- `2` - PROCESSING: Submission is being executed
- `3` - ACCEPTED: All test cases passed
- `4` - WRONG_ANSWER: Output doesn't match expected
- `5` - TIME_LIMIT_EXCEEDED: Execution exceeded time limit
- `7` - RUNTIME_ERROR: Code crashed during execution
- `8` - COMPILATION_ERROR: Code failed to compile
- `13` - ERROR: General error

**Troubleshooting ACE:**
- If worker fails to start: Ensure Docker socket is accessible (`/var/run/docker.sock`)
- If submissions hang: Check worker logs (`docker-compose logs worker`)
- If MongoDB connection fails: Verify MongoDB container is running (`docker-compose ps`)
- Port conflicts: Change ports in `docker-compose.yml` and update `ACE_URL` in backend `.env`
- MongoDB port conflict: ACE uses MongoDB on port 27017. Consider using MongoDB Atlas for backend or changing ACE MongoDB port

#### ML Service (Interview AI Features)

The ML service provides AI-powered interview features. In the current UpSkill implementation it is primarily used for:

- Health checking the ML stack
- Stubbed video anomaly analysis for InterviewV2 (overall webcam recording)

**Prerequisites:**
- Python 3.9+
- pip or poetry

**Setup:**
```bash
# Navigate to ML service directory
cd backend/ml_service

# Install dependencies (if requirements.txt exists, or install manually)
pip install fastapi uvicorn pydantic

# Start the ML service
uvicorn main:app --host 0.0.0.0 --port 8001

# Or run directly
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

**Backend Configuration:**
Add to `backend/.env`:
```env
ML_BASE_URL=http://localhost:8001
ML_SERVICE_URL=http://localhost:8001
```

**ML Service Features (legacy + current):**
- Stubbed `/video_anomaly` endpoint used by InterviewV2 overall video upload:
  - Accepts `{ interview_id, question_id, video_path }`
  - Returns `{ anomalyScore, flags, summary }` where flags include multiFace/deepfakeRisk/livenessIssues/lowQuality/lipSyncIssues
  - Currently implemented as a deterministic stub (no heavy ML yet) so the full pipeline can be exercised end-to-end
- Legacy interview session management:
  - Question generation based on role and topics
  - Answer evaluation (MCQ and behavioral questions)
  - Delivery metrics tracking (WPM, filler words, eye contact)
  - Final interview scoring and feedback

**Testing ML Service:**

```bash
# Health check
curl http://localhost:8001/health

# Stubbed full-session video anomaly analysis
curl -X POST http://localhost:8001/video_anomaly \
  -H "Content-Type: application/json" \
  -d '{
    "interview_id": "example-id",
    "question_id": "overall",
    "video_path": "/path/to/uploaded/video.webm"
  }'
```

## Data and Seeding

- Challenges are auto-seeded/upserted on first hit to challenges endpoints from files in `backend/src/data/`.
- To force demo seeding (users, activities, etc.), run in `backend`:

```
npm run seed:demo
```

## Key API Endpoints (prefix `/api`)

### Health & Status
- `GET /api/health` - Health check endpoint

### Authentication
- `POST /api/auth/login` - User login (returns JWT token)
- `POST /api/auth/signup` - User registration

### Challenges
- `GET /api/challenges` - List all challenges (supports filtering, pagination)
- `GET /api/challenges/daily` - Get daily challenges
- `GET /api/challenges/:idOrSlug` - Get challenge by ID or slug
- `POST /api/challenges/run` - Run code against test cases (ACE integration)
  - Body: `{ challengeId, code, language, inputs? }`
  - Returns: `{ success, data: { verdict, passed, total, time, memory, caseResults } }`
- `POST /api/challenges/submit` - Submit solution (auth required)
  - Body: `{ challengeId, code, language }`
  - Returns: `{ success, data: { submissionId, verdict, score } }`
- `GET /api/challenges/submissions/:id` - Get submission status by ID
- `POST /api/challenges/drafts` - Save code draft (auth required)
- `GET /api/challenges/drafts/:challengeId` - Get saved draft (auth required)

### Profile
- `GET /api/profile/me` - Get current user profile and stats (auth required)

### Leaderboard
- `GET /api/leaderboard` - Get user rankings and scores

### Interviews (legacy v1)
- `POST /api/interviews/start` - Start legacy interview session (coding/behavioral)
- `GET /api/interviews/:id` - Get legacy interview session by ID
- `POST /api/interviews/answer` - Submit answer for current question
- `GET /api/interviews/next/:sessionId` - Get next question in session
- `POST /api/interviews/complete/:id` - Complete legacy interview and get report
- `GET /api/interviews/feedback/:id` - Get AI feedback for interview
- **WebSocket**: `ws://localhost:<PORT>/api/interviews/stream?sessionId=...`

### Interviews V2 (current flow)

The current production-like flow uses InterviewV2, a structured MCQ-only technical assessment with continuous webcam recording and overall video anomaly analysis.

- `POST /api/interviews-v2` – Create a new InterviewV2 session
  - Body: `{ configId?, consent: { given: boolean, at?: string }, numQuestions?, difficulty? }`
  - Returns: `{ success, data: { id, status, startedAt, config, questions, mcqCount, videoCount } }`
- `GET /api/interviews-v2/:id` – Get InterviewV2 session and questions
- `POST /api/interviews-v2/:id/responses` – Upsert response for a question (MCQ)
  - Body: `{ questionId, index, type: 'MCQ', mcqSelectedOption, timeTakenSec }`
- `POST /api/interviews-v2/:id/complete` – Finalize interview, compute MCQ score and attach any existing anomaly metrics
- `GET /api/interviews-v2/:id/report` – Get final report including:
  - MCQ accuracy and per-question breakdown
  - Overall video anomaly score (0–100)
  - Video anomaly flags (multiFace, deepfakeRisk, livenessIssues, lowQuality, lipSyncIssues)
  - Audio-visual summary text
- `POST /api/upload/interview-overall-video` – Upload a single full-session webcam recording (base64) for anomaly analysis

On the frontend, the InterviewV2 page:

- Runs a consent + hardware (camera/mic) check
- Records webcam continuously for the entire MCQ session
- Stops recording and uploads the video once at the end
- Displays MCQ performance and video anomaly summary in the final report screen

### ML Service Endpoints (port 8001)
- `GET /health` - Health check
- `POST /start_interview` - Initialize interview session with questions
- `POST /next_question` - Get next question after answer submission
- `POST /finish_interview` - Generate final interview report and scores
- `POST /asr` - Speech recognition (ASR) endpoint
- `POST /fer` - Facial expression recognition (FER) endpoint
- `WebSocket /ws` - Real-time interview streaming

### ACE Service Endpoints (port 8080)
- `POST /submissions` - Submit code for execution
  - Body: `{ language_id, source_code, test_cases: [{ input, expected_output }] }`
  - Returns: `{ token }`
- `GET /submissions/:token` - Get submission status and results
  - Returns: `{ token, status_id, test_cases, runtime_ms, ... }`

## Development Tips

### General
- **React DevTools**: https://react.dev/link/react-devtools
- If you change `.env` files, restart the respective dev servers.
- Use `JUDGE_LOG=1` only when debugging (reduces performance)

### Troubleshooting

#### Connection Issues
If you see `ERR_CONNECTION_REFUSED`:
- Ensure backend is running on the expected port (default: 4000)
- Verify MongoDB is reachable at `MONGO_URI`
- Check CORS includes your frontend origin(s)
- Verify frontend is pointing to correct `VITE_API_BASE` URL

#### Code Execution Issues
If code-execution endpoints fail:
- **ACE**: 
  - Verify ACE services are running: `docker-compose ps` (in `ace/` directory)
  - Check ACE API is accessible: `curl http://localhost:8080/submissions` (should return 404 or error, not connection refused)
  - Verify `ACE_URL` in backend `.env` matches ACE API URL
  - Check worker logs: `docker-compose logs worker`
  - Ensure Docker socket is accessible: Worker needs `/var/run/docker.sock` access

#### Interview/ML Service Issues
If interview features don't work:
- Verify ML service is running: `curl http://localhost:8001/health`
- Check `ML_BASE_URL` and `ML_SERVICE_URL` in backend `.env`
- Ensure Python dependencies are installed in `backend/ml_service/`
- Check ML service logs for errors

#### Database Issues
- Ensure MongoDB is running: `mongosh` or check connection string
- Verify database name in `MONGO_URI` matches your setup
- Check MongoDB logs for connection errors

### Code Execution Flow

1. **User submits code** via `POST /api/challenges/run`
2. **Backend processes request**:
   - Validates challenge and test cases
   - Generates code harness if needed (Two Sum, Add Two Numbers, etc.)
   - Executes code via ACE (preferred and only configured runner)
3. **ACE Execution** (if `ACE_URL` is set):
   - Backend sends submission to ACE API: `POST /submissions`
   - ACE API creates submission record and queues job
   - Worker picks up job and executes code in Docker container
   - Backend polls ACE API for results: `GET /submissions/:token`
   - Returns results with verdicts and test case details

### Language Support

#### ACE Service
- **Python 3.11** (language_id: 71)
- **Java 17** (language_id: 62)
- *More languages can be added by extending `languageToRunner()` in `ace/worker/src/index.js`*

### Performance Tips
- Use ACE for local development (faster, no API limits)
- Enable `JUDGE_LOG=1` only when debugging (reduces performance)
- Cache challenge data to reduce database queries
- Use connection pooling for MongoDB

## Current Project Progress

### Backend
- **API Infrastructure**
  - Express server with health endpoints, CORS, Helmet security, Morgan logging
  - MongoDB connection via Mongoose with configurable `MONGO_URI`
  - JWT authentication middleware with bcrypt password hashing
  - Error handling middleware and 404 handlers

- **Routes & Controllers**
  - **Auth**: Login, signup with JWT token generation
  - **Challenges**: 
    - List challenges with filtering and pagination
    - Get challenge by ID or slug
    - Daily challenges endpoint
    - Code execution with ACE/Judge0 integration
    - Submission tracking with verdicts (AC, WA, TLE, RE, CE)
    - Draft saving and retrieval per user
    - Auto-seeding from `merged_problems.json` and fallback datasets
  - **Profile**: User profile with stats (solved count, streak, accuracy, rank)
  - **Leaderboard**: User rankings based on scores and solved challenges
  - **Interviews**: 
    - Interview session management
    - Question generation and progression
    - Answer submission and evaluation
    - AI feedback and scoring
    - WebSocket streaming for real-time audio/video processing

- **Code Execution Integration**
  - **ACE Integration**: Full integration with local ACE service
    - Multi-test-case execution support
    - Language support: Python 3 (71), Java 17 (62)
    - Code harness generation for Two Sum and Add Two Numbers problems
    - Generic harness builder for other challenge types
    - Polling-based result retrieval
    - Error handling and timeout management
  - **Judge0 Integration**: Alternative execution service support
    - Supports JavaScript, Python, Java, C++
    - RapidAPI key support for hosted Judge0
    - Wait mode and polling modes
  - **Execution Features**:
    - Test case validation and comparison
    - Verdict determination (AC, WA, TLE, RE, CE)
    - Execution time and memory tracking
    - Detailed case-by-case results

- **Interview Features**
  - ML service integration for AI-powered interviews
  - Question generation based on role and experience level
  - MCQ and behavioral question support
  - Real-time metrics tracking (WPM, filler words, eye contact)
  - Delivery scoring and content evaluation
  - Final interview reports with strengths and improvements

- **WebSocket Support**
  - Interview streaming endpoint (`/api/interviews/stream`)
  - Audio transcription integration with ML service
  - Video analysis for eye contact and engagement
  - Real-time metrics broadcasting
  - Session management and transcript storage

### Frontend
- **React Application**
  - React 19 with Vite 7 build system
  - React Router for client-side routing
  - TailwindCSS for styling
  - Monaco Editor for code editing
  - Lucide React for icons

- **Pages & Components**
  - **Home**: Landing page with challenge navigation
  - **Challenge**: 
    - Code editor with syntax highlighting
    - Multiple language support (JavaScript, Python, Java, C++)
    - Test case execution and results display
    - Submission tracking and history
    - Draft auto-save functionality
  - **Interview**: 
    - Camera and microphone setup and permissions
    - Real-time video preview
    - Live transcription display
    - Metrics visualization (WPM, fillers, eye contact)
    - MCQ and behavioral question interfaces
    - Resume upload support
    - Interview session management
    - Final feedback and scoring display
  - **Profile**: User statistics and activity history
  - **Leaderboard**: User rankings and scores
  - **Auth**: Login and signup pages with form validation

- **Services & Utilities**
  - Centralized Axios client with interceptors
  - JWT token management in localStorage
  - API service wrappers for all endpoints
  - Auth service with token refresh support
  - Interview service with WebSocket integration

### ML Service (Python FastAPI)
- **Interview Management**
  - Session creation and management
  - Question generation from role-based question banks
  - MCQ and behavioral question selection
  - Answer evaluation and scoring
  - Delivery metrics aggregation

- **Features**
  - Question database with 30+ questions per role
  - Support for Software Engineer, Data Scientist, Product Manager, Marketing Manager roles
  - Point-based scoring system
  - Content relevance scoring
  - Delivery metrics (WPM, filler words, eye contact, engagement)
  - Final report generation with strengths and improvements

- **API Endpoints**
  - `POST /start_interview`: Initialize interview session
  - `POST /next_question`: Get next question after answer submission
  - `POST /finish_interview`: Generate final report and scores
  - `POST /asr`: Speech recognition (placeholder for future integration)
  - `POST /fer`: Facial expression recognition (placeholder for future integration)
  - `WebSocket /ws`: Real-time interview streaming

### ACE Service (Code Execution)
- **Architecture**
  - API service for submission management
  - Worker service for code execution
  - MongoDB for submission storage
  - Redis/BullMQ for job queue management

- **Execution Features**
  - Docker-based isolated code execution
  - Security constraints (network isolation, resource limits, read-only filesystem)
  - Multi-test-case execution support
  - Language support: Python 3.11, Java 17
  - Configurable time and memory limits
  - Status tracking (QUEUED, PROCESSING, DONE, ERROR)

- **Security**
  - Network isolation (`--network none`)
  - CPU and memory limits
  - PID limits
  - Read-only root filesystem
  - Temporary filesystem with size limits
  - No new privileges

### DevOps/Infra
- **Docker Compose**
  - ACE service orchestration (API, Worker, MongoDB, Redis)
  - Service dependencies and health checks
  - Volume management for data persistence

- **Configuration**
  - Environment variable management
  - Service discovery and networking
  - Port mapping and exposure

## Code Execution and Harnesses

- **Execution services**: Backend uses ACE to compile/run code.
- **Statuses**: AC, WA, TLE, RE (runtime error), CE (compilation error).
- **Generated source view**: When using a generic harness, logs show a “Generated source code” block. Java line numbers in errors refer to this combined file.

### Generic Harness (Java)
- **Invocation**: Reflectively calls methods in `Solution` by common names: `twoSum`, `groupAnagrams`, `solve`, etc. Falls back by arity/type compatibility.
- **Arguments**: Inputs are injected as function args, not stdin, unless the user code defines a `main` (then provided stdin is passed through).
- **Supported inputs**:
  - `int[]`, `long[]`, `double[]`, `boolean[]`, `char[]`, `String[]`
  - 2D arrays: `int[][]`
  - Linked lists: auto-build from `[1,2,3]` when the problem uses `ListNode`
- **Outputs**:
  - Arrays and numbers printed directly; floats formatted to 5 decimals.
  - Collections serialized to JSON-like strings with quotes and stable ordering.
  - Linked lists serialized to JSON-like arrays via reflection.
- **In-place ops**: If method returns `void`/`null`, mutated primary input is printed.

### Generic Harness (Python)
- **Invocation**: Calls `Solution` methods by common names or searches by arity; if code reads stdin (`input()`/`sys.stdin`), harness is skipped and stdin is used.
- **Linked lists**: Auto-build from arrays and serialize results or mutated heads.
- **Output**: Collections printed as compact JSON (no spaces) for stable comparisons.

### Comparator (expected vs actual)
- Treats JSON vs language array prints equivalently.
- Case-insensitive booleans.
- Numeric strings vs numbers considered equal.

## Example API Payloads

### Java: Group Anagrams
```json
{
  "challengeId": "49",
  "language": "java",
  "code": "import java.util.*;\nclass Solution {\n  public List<List<String>> groupAnagrams(String[] strs) {\n    Map<String,List<String>> map = new HashMap<>();\n    for (String s: strs) { char[] a = s.toCharArray(); Arrays.sort(a); String k = new String(a); map.computeIfAbsent(k, x -> new ArrayList<>()).add(s); }\n    return new ArrayList<>(map.values());\n  }\n}\n",
  "inputs": "strs = [\"eat\",\"tea\",\"tan\",\"ate\",\"nat\",\"bat\"]"
}
```

### Python: Remove Nth Node From End of List
```json
{
  "challengeId": "19",
  "language": "python",
  "code": "class Solution:\n    def removeNthFromEnd(self, head, n):\n        dummy = ListNode(0)\n        dummy.next = head\n        first = dummy\n        second = dummy\n        for _ in range(n+1):\n            first = first.next\n        while first:\n            first = first.next\n            second = second.next\n        second.next = second.next.next\n        return dummy.next\n",
  "inputs": "head = [1,2,3,4,5], n = 2"
}
```

## Dataset Tools
- **normalize_dataset.mjs**: Cleans and normalizes `backend/src/data/merged_subset.json`.
  - Usage: `node backend/scripts/normalize_dataset.mjs`
- **resync_challenges.mjs**: Syncs challenges from a source JSON into MongoDB. Accepts `merged_subset.json`.
  - Usage: `node backend/scripts/resync_challenges.mjs`
- **resync_from_sqlite.mjs**: Syncs from `backend/src/data/leetcode.db` (SQLite) into MongoDB.
  - Usage: `node backend/scripts/resync_from_sqlite.mjs [--db path/to/leetcode.db]`
- **build_easy_subset.mjs**: Generates a smaller/easy subset from the dataset.

## Troubleshooting Compiler/Interpreter Errors
- **Java CE**: Errors like `Main.java:16: error: ...` come from `javac` and point into the generated combined source. Compare with the “Generated source code” section to align lines.
- **Java RE**: Full Java stack traces are returned.
- **Python errors**: Real Python tracebacks. If harness is used, lines map to the combined code that was sent.
- **Tip**: Focus on the first error in `stderr/compile_output`; later errors are often cascades.

## Roadmap / Next Steps

### Completed Features ✅
- ✅ ACE service integration with Docker-based code execution
- ✅ Multi-test-case execution support
- ✅ Code harness generation for common problem types
- ✅ ML service integration for interview features
- ✅ WebSocket streaming for real-time interview metrics
- ✅ Interview question generation and evaluation
- ✅ Delivery metrics tracking (WPM, fillers, eye contact)
- ✅ Challenge auto-seeding from datasets
- ✅ Draft saving and retrieval
- ✅ Submission tracking with detailed verdicts

### In Progress / Planned 🚧
- 🔄 Expand ACE language support (JavaScript, C++, etc.)
- 🔄 Implement real ASR (Automatic Speech Recognition) integration
- 🔄 Implement real FER (Facial Expression Recognition) integration
- 🔄 Add more challenge problem types and harness builders
- 🔄 Improve error handling and user feedback
- 🔄 Add unit/integration tests (backend and frontend)
- 🔄 Token refresh handling for authentication
- 🔄 Better error boundaries and toast notifications
- 🔄 Expand challenge dataset with more problems
- 🔄 Improve ACE reliability and fallbacks
- 🔄 Add code execution result caching
- 🔄 Implement interview session persistence in database
- 🔄 Add interview history and analytics
- 🔄 Support for more interview question types (system design, coding)
- 🔄 Real-time collaboration features
- 🔄 Challenge difficulty adjustment based on user performance

---

For questions or contributions, open issues or PRs in this repository.
