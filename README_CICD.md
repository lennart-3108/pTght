CI/CD Quickstart (GitHub Actions)

This repository includes a simple CI/CD workflow that builds the React frontend and deploys it to your Hostinger account when commits are pushed to the `dev` branch.

What the workflow does
- On push to `dev`: checks out code, installs Node deps, builds `frontend`, and uploads `frontend/build` to `public_html` on your Hostinger server via FTP(S).
- Performs a quick smoke test (curl HEAD request) after deploy.

Required repository secrets (GitHub Settings → Repository → Secrets → Actions):
- FTP_HOST — FTP host (e.g. 82.25.102.248)
- FTP_USERNAME — your FTP user (e.g. u334105738)
- FTP_PASSWORD — your FTP password

How to extend for production
- Create a new branch `main` (or use `main`) and duplicate the workflow file to trigger on push to `main`.
- Use a different set of secrets in the workflow (FTP_PROD_HOST, FTP_PROD_USERNAME, FTP_PROD_PASSWORD) and reference them for the production deploy step.
- Optionally, add a backend deployment job (SSH/rsync or Docker push) if your backend runs on a VPS or container platform.

Local deploy helper
- There's a small helper `scripts/deploy-frontend-local.sh` which uses `lftp` to upload the `build/` folder to your Hostinger instance. Use it locally when you want to deploy without pushing to GitHub.

Security notes
- Don't store secrets in the repo. Use GitHub Secrets or environment variables in your CI.
- Prefer FTPS or SFTP if possible. The example uses FTPS via the action. If your host supports SFTP, prefer that.

Questions? edit this README and we can improve the workflow (add cache, tests, backend deploys).
