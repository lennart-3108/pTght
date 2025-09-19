This document explains how to deploy the frontend in dev and prod environments, and how to run locally and with Docker.

Prerequisites
- Node 18 (use nvm to install: `nvm install 18 && nvm use 18`)
- npm (installed with Node)
- Optional: Docker

Local dev
1. Install dependencies

```bash
rm -rf node_modules package-lock.json
npm ci
```

2. Start dev server

```bash
npm start
```

Build (production)

```bash
npm run build
# resulting files are in the build/ folder
```

Docker (build and run)

```bash
# Build image
docker build -t matchleague-frontend:latest .

# Run container
docker run -p 8080:80 matchleague-frontend:latest
# Open http://localhost:8080
```

Vercel
1. Create an account at https://vercel.com and connect your GitHub repo.
2. Add project, select `frontend/` as the project root (if monorepo) or the repo root.
3. Set build command: `npm run build` and output directory: `build`.
4. For dev environment, create a Preview Deployment or a separate Project pointing to the `dev` branch and map `dev.matchleague.de` to the preview.

Netlify
1. Create an account at https://netlify.com and connect GitHub.
2. Set build command `npm run build` and publish directory `build`.
3. Add custom domain and set DNS records as instructed by Netlify; create a subdomain for dev.

DNS
- Create CNAME or A-records to point `matchleague.de` to the hosting provider as instructed.
- Create `dev.matchleague.de` as a separate CNAME to the same provider for a dev site.

CI/CD (GitHub Actions example)
- See `ci/` example in this repo for a basic workflow to build and optionally upload the build artifact.

Notes
- Keep `react-scripts` at `5.0.1` and use Node 18 for best compatibility.
- Use `.env.development` and `.env.production` to switch API endpoints.
