# MatchLeague – Optimierungs-Report (2026-02-14)

## Ziel
- Skalierung: Daten nur gefiltert laden (insb. Ligen erst nach Location-Auswahl)
- Security: `npm audit` Findings reduzieren ohne Breaking Deploys
- Stabilität: Checks/Build/Tests weiterhin grün

## Umgesetzt

### 1) Location-first Loading (Skalierung)
- Ligen werden auf der Ligen-Seite nur geladen, wenn eine Stadt gewählt ist (oder aus dem Profil kommt).
- Cities werden nicht mehr global komplett vorab geladen; stattdessen lazy pro Bundesland (State) beim Expandieren.
- Sports-Seite lädt Ligen nicht mehr unfiltered und filtert dann client-side, sondern serverseitig per `sportId`.

Betroffene Dateien:
- frontend/src/pages/LeaguesPage.js
- frontend/src/components/LocationSelector.js
- frontend/src/pages/SportsPage.js
- frontend/src/pages/TeamsPage.js

### 2) Backend API – Cities List skalierbar
- `/api/cities/list` unterstützt jetzt:
  - `limit` (max 5000)
  - `q` (LIKE Suche auf name)
- Logging in Production reduziert.

Betroffene Datei:
- backend/src/routes/cities.js

### 3) Security / Dependencies
- Backend:
  - `nodemailer` auf `^8.0.1` aktualisiert
  - `tar` per npm `overrides` auf `^7.5.7` gepinnt (schließt tar-Advisories in Transitiv-Toolchain)
  - Ergebnis: `npm audit --omit=dev` => 0 Findings

- Frontend:
  - `npm audit fix --omit=dev` reduziert Findings deutlich (aktuell 4 verbleibend, keine High im zuletzt gemessenen Output außer 1 high / 3 moderate)

Betroffene Datei:
- backend/package.json
- backend/package-lock.json
- frontend/package-lock.json

## Verifikation (lokal)
- Backend Health/Smoke: PASS
- Frontend Unit Tests: PASS
- Frontend Build: SUCCESS (mit bestehenden ESLint-Warnings, nicht kritisch)

## Hinweise / Nächste sinnvolle Schritte
- Für „Millionen User“ sind zusätzlich sinnvoll:
  - harte API-Defaults (z.B. require filter oder sehr kleine Default-limits bei Listen-Endpunkten)
  - DB-Indizes + Query-Analyse (EXPLAIN), ggf. Caching (Redis) für Hot Reads
  - Cursor-Pagination für große Tabellen
  - Rate limiting + request logging/metrics
