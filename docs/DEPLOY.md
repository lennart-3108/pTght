# Deployment guide (dev.leaguematch.org)

This document describes how to build and deploy the Matchleague app to a Kubernetes cluster (dev.leaguematch.org).

Required secrets (GitHub repository secrets — do NOT commit these to the repository):
- GHCR_PAT: Personal access token with write:packages scope for GitHub Container Registry (or a token with package write permissions). Do NOT commit this token.
- KUBECONFIG: The kubeconfig content for the target cluster. Store it as a GitHub repository secret. Never commit kubeconfig to the repo or a branch.
- IMAGE_PREFIX (optional): e.g. `ghcr.io/your-org`. If omitted, `ghcr.io/your-org` is used in manifests.
- JWT_SECRET, DB_URL, and any mailer credentials: these must be created as Kubernetes Secrets in the target cluster (name: `matchleague-secrets`). Do not put these values in the repository.

How to trigger the workflow:
1. Go to Actions → Build and Deploy → Run workflow.
2. Provide `image_tag` (e.g. v0.1.0 or the commit SHA).

What the workflow does:
- Builds `backend` and `frontend` Docker images and pushes them to the registry under `IMAGE_PREFIX` with the provided tag and `latest`.
- Updates `k8s/backend-deployment.yaml` and `k8s/frontend-deployment.yaml` image references to the tag.
- Applies the k8s manifests (deployment, services, ingress).

Post-deploy verification:
1. Check the pods are running:
   kubectl get pods -l app=matchleague-backend
   kubectl get pods -l app=matchleague-frontend

2. Check services:
   kubectl get svc matchleague-backend matchleague-frontend

3. Check ingress and DNS:
   kubectl get ingress matchleague-ingress
   Ensure dev.leaguematch.org resolves to the cluster ingress IP and TLS certificate is issued (cert-manager).

4. Sanity test:
   - Visit https://dev.leaguematch.org/ (frontend should load)
   - API endpoint test: https://dev.leaguematch.org/api/sports/list should return JSON.

Notes and caveats:
- The backend expects DB_URL and JWT_SECRET via k8s secret `matchleague-secrets`. Create that secret before deploying, for example:

   kubectl create secret generic matchleague-secrets \
      --from-literal=DB_URL='postgres://user:pass@host:5432/dbname' \
      --from-literal=JWT_SECRET='supersecret'

   (Adjust to your DB and credentials.)

- The ingress manifest assumes an nginx ingress controller and cert-manager with cluster issuer `letsencrypt-prod`. Adjust annotations to match your cluster.
- Do not deploy a production DB with the included SQLite file; use an external DB for multi-replica deployments.
- Never commit secrets, kubeconfig files, or credentials to the repository. Use GitHub Secrets or a secrets manager.
