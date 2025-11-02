# AI_PREP

A monorepo for an AI coding interview and practice platform. It includes a React (Vite) frontend and an Express/MongoDB backend, with optional local code execution (ACE) and Judge0 support.

## Tech Stack

- Frontend: React 19 + Vite 7, React Router, TailwindCSS, Axios
- Backend: Node/Express, MongoDB (Mongoose), JWT auth, Zod
- Optional services: ACE runner (for multi-case execution), Judge0 (code execution API)

## Repository Structure

```
AI_PREP/
├─ backend/                # Express API server
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
│  ├─ scripts/
│  │  └─ seed_demo.js     # optional seeding
│  ├─ .env                # backend environment (see below)
│  └─ package.json
├─ frontend/               # React app (Vite)
│  ├─ src/
│  │  ├─ components/      # UI components
│  │  ├─ pages/           # pages (Interview, Login, Signup, Profile, Challenge, Leaderboard)
│  │  ├─ services/        # api client and domain services
│  │  ├─ utils/           # helpers
│  │  ├─ App.jsx, main.jsx, router.jsx, index.css, App.css
│  ├─ .env                 # frontend environment (see below)
│  └─ package.json
├─ ace/                    # optional local code runner (ACE)
│  ├─ api/
│  ├─ worker/
│  └─ docker-compose.yml
├─ judge0/                 # optional Judge0 deployment assets
├─ package.json            # root (axios dep)
└─ README.md               # this file
```

## Prerequisites

- Node.js 18+ (server uses fetch and ESM)
- npm 9+
- MongoDB running locally (or MongoDB Atlas URI)
- Optional: Docker (for ACE/Judge0), or local instances running on their default ports

## Environment Variables

Backend (`backend/.env`):

```
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/aicodeskill
JWT_SECRET=dev_secret_change_me
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175
API_PREFIX=/api

# Optional local runner (ACE)
ACE_URL=http://localhost:8080

# Optional Judge0
JUDGE0_URL=http://localhost:2358
JUDGE_LOG=1
# JUDGE0_RAPIDAPI_KEY=...
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

## Install and Run (Local)

1) Backend
- Open a terminal in `backend`
- Install: `npm install`
- Start dev server: `npm run dev`
- Expected logs:
  - `MongoDB connected`
  - `API listening on http://localhost:4000/api`
- Health check: http://localhost:4000/api/health

2) Frontend
- Open another terminal in `frontend`
- Install: `npm install`
- Start dev server: `npm run dev`
- Open: http://localhost:5173

3) Optional services
- ACE: ensure `ACE_URL` is reachable (see `ace/docker-compose.yml` or your setup)
- Judge0: ensure `JUDGE0_URL` is reachable or set RapidAPI key if using hosted

## Data and Seeding

- Challenges are auto-seeded/upserted on first hit to challenges endpoints from files in `backend/src/data/`.
- To force demo seeding (users, activities, etc.), run in `backend`:

```
npm run seed:demo
```

## Key API Endpoints (prefix `/api`)

- Health: `GET /api/health`
- Auth: `POST /api/auth/login`, `POST /api/auth/signup`
- Challenges:
  - `GET /api/challenges`
  - `GET /api/challenges/daily`
  - `GET /api/challenges/:idOrSlug`
  - `POST /api/challenges/run` (optional ACE/Judge0 integration)
  - `POST /api/challenges/submit` (auth required)
  - `GET /api/challenges/submissions/:id`
  - Drafts (auth): `POST /api/challenges/drafts`, `GET /api/challenges/drafts/:challengeId`
- Profile: `GET /api/profile/me` (auth)
- Leaderboard: `GET /api/leaderboard`
- Interviews: `POST /api/interviews/start`, `POST /api/interviews/answer`, `POST /api/interviews/complete`, `GET /api/interviews/next/:sessionId`
  - WS stream: `ws://localhost:<PORT>/api/interviews/stream?sessionId=...`

## Development Tips

- React DevTools: https://react.dev/link/react-devtools
- If you change `.env` files, restart the respective dev servers.
- If you see `ERR_CONNECTION_REFUSED`, ensure:
  - Backend is running on the expected port.
  - MongoDB is reachable at `MONGO_URI`.
  - CORS includes your frontend origin(s).
- If code-execution endpoints fail, verify ACE/Judge0 availability and env vars.

## Current Project Progress

- Backend
  - API bootstrapped with health, CORS, Helmet, logging, and JSON body parsing
  - Mongo connection via Mongoose with configurable `MONGO_URI`
  - Routes implemented: auth, challenges (list/detail/daily/run/submit/drafts), profile, leaderboard
  - Interview flow endpoints and WebSocket stream path registered
  - Auto-seeding of challenges from `merged_problems.json` (or fallback datasets)
  - Optional ACE and Judge0 execution paths integrated

- Frontend
  - Vite React app with routes for Login, Signup, Profile, Challenge, Leaderboard, Interview
  - Centralized Axios client with interceptors; uses `VITE_API_BASE_URL` or `VITE_API_BASE`
  - Interview page supports camera/mic checks, live transcript, and WS streaming hooks
  - Basic styling via Tailwind

- DevOps/Infra
  - Optional ACE docker compose present
  - Judge0 assets included

## Roadmap / Next Steps

- Authentication UX polish; token refresh handling
- Better error boundaries and toast notifications
- Expand challenge dataset; add more languages
- Improve Judge0/ACE reliability and fallbacks
- Add unit/integration tests (backend and frontend)

---

For questions or contributions, open issues or PRs in this repository.
