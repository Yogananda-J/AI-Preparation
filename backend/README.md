# AI CodeSkill Backend

## Setup

1. Copy env file and set values:



2. Install deps and run dev server:



## Endpoints

- GET /api/health
- POST /api/auth/register { username, email, password }
- POST /api/auth/login { email, password }
- GET /api/auth/me (Authorization: Bearer <token>)

## Notes
- Update CORS_ORIGIN in .env to match your frontend URL.
- Set JWT_SECRET to a strong value in production.
- MongoDB URI defaults to local mongodb://127.0.0.1:27017/aicodeskill.
