# Dev instance quickstart

1) Create a dev branch and switch to it (optional):
   git checkout -b dev

2) Create a dev .env from the example:
   cp backend/.env.dev.example backend/.env
   Edit backend/.env and set MAIL_PASS and JWT_SECRET.

3) Prepare dev database (copy prod DB or start empty):
   cp backend/database.sqlite backend/database-dev.sqlite
   Edit backend/.env and set DB_PATH=database-dev.sqlite

4) Start dev backend locally (port in example is 5003):
   cd backend
   npm ci
   npm run start:dev

5) Build and serve frontend for dev or run dev server:
   cd frontend
   npm ci
   npm start (or npm run build + upload to dev host)

6) DNS: add dev.matchleague.org A record pointing to your host (if hosting externally)

Notes:
- Keep `.env` out of git. Use the provided `backend/.env.dev.example` as template.
- For a production-like dev server on Hostinger you can copy these steps to the host and run with PM2.

## Deployment smoke checks

After deployment, run a quick smoke test to ensure the system is responsive:

- The deploy script (`scripts/deploy-dev.sh`) automatically runs `scripts/smoke-dev.sh` when present.
- You can also run it manually:

   Environment variables (optional):
   - `BACKEND_URL` (default: http://localhost:5001)
   - `FRONTEND_URL` (optional; if set, checks `/api` proxy and `/start` HTML fallback)
   - `SMOKE_EMAIL` and `SMOKE_PASSWORD` (optional; if set, performs a real login)
   - `RETRIES` and `SLEEP` (optional; wait for backend readiness)

   Example:
   BACKEND_URL=http://127.0.0.1:5001 FRONTEND_URL=https://dev.example.org SMOKE_EMAIL=admin@example.org SMOKE_PASSWORD='test1234' bash scripts/smoke-dev.sh

The script will:
- wait for `BACKEND_URL/healthz` to return 200
- check `FRONTEND_URL/api/healthz` if a frontend URL is provided
- try `/auth/login` when credentials are passed
- validate SPA fallback returns HTML at `FRONTEND_URL/start`
