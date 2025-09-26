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
