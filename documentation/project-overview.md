# Project Overview

## Architektur

- **Backend**: Node.js + Express
- **Datenbank**: SQLite im Local/Dev, PostgreSQL geplant/prod
- **DB-Migrations**: Knex.js
- **Frontend**: React (Create React App)
- **Deployment**: Docker, Kubernetes, PM2, Nginx

## Wichtige Verzeichnisse

- `backend/`: Server, Migrations, Seeds, Services, Routes, Jobs
- `frontend/`: SPA-UI, Pages, Auto-Routing
- `docs/`: bestehende Dokumente und Business-Reports
- `documentation/`: aktives technisches Projekt-Repository-Docset
- `k8s/`: Produktions-Kubernetes-Konfigurationen
- `scripts/`: Deployment- und Dev-Skripte

## Aktueller Repository-Zustand

- Branch: `dev`
- Uncommitted Änderungen:
  - `backend/src/routes/auth.js`
  - `backend/src/routes/index.js`
  - `backend/src/services/communityLeagueService.js`
  - `backend/seeds/05_locations_and_slots.js`
- Neu hinzugefügte/andere Dateien im Workspace:
  - `backend/migrations/20260508175258_create_community_leagues_v2.js`
  - `backend/routes/communityLeagues.js`
  - `backend/src/jobs/weeklyCommunityPairing.js`
  - `frontend/src/pages/CommunityLeaguesPage.js`
  - `frontend/src/pages/CommunityLeaguesPage.css`

## Kernmodule

- `backend/src/routes/auth.js`: Authentifizierung, Login, Reset
- `backend/src/routes/index.js`: API-Router und Middleware-Registrierung
- `backend/src/services/communityLeagueService.js`: Community League Business-Logik
- `backend/src/jobs/weeklyCommunityPairing.js`: Wöchentliche Paarungen für Mini-Ligen
- `backend/src/services/LocationService.js`: Standort- und Asset-Verwaltung
- `backend/seeds/05_locations_and_slots.js`: Demo-Location-Seed

## Aktuelle Probleme / Beobachtungen

- `locations` sind lokal leer, Seed bricht wegen Schema-Mismatch
- PROD/TEST/DEV/LOCAL Zustand ist nicht synchron
- Es existiert ein `backend/sportsplatform.db.broken` Backup
- Einige Migrationen sind deaktiviert (`*.disabled`)

## Empfehlung für die Nutzung

- Verwende `documentation/README.md` als Einstieg
- Dokumentiere neue Feature-Logik hier, nicht nur in losen `.md`-Berichten
- Halte `docs/` für Business- und Prozessdokumente, `documentation/` für Projekt-/Tech-Dokumentation
