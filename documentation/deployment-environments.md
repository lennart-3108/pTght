# Deployment & Environment Strategy

## Ziel

Sicherstellen, dass PROD stabil bleibt und dass LOCAL, DEV und TEST klar getrennte Umgebungen sind.

## Umgebungstrennung

### PROD
- Live-System
- nur stabile Releases deployen
- keine Seeds oder Test-Skripte auf PROD laufen lassen
- Datenbank-Migrationen nur nach Review und Backup durchführen

### TEST / STAGING
- sollte möglichst nahe am PROD-Stand sein
- gleiche Branch-Basis wie PROD, aber in isolierter Umgebung
- eigene Datenbankinstanz mit ähnlichem Schema

### DEV
- Arbeitsbranch für aktive Entwicklung
- kann neue Features vor PROD enthalten
- sollte aber nicht direkt auf PROD deployen
- sollte regelmäßig mit PROD/MAIN synchronisiert werden

### LOCAL
- lokale Entwicklungsinstanz
- eigene DB-Kopie, z. B. `backend/sportsplatform.local.db`
- eigene `.env`-Datei
- ideal: Kopie des PROD-Schemas, aber keine PROD-Daten

## Empfohlener Branch-Workflow

1. `main` oder `prod` = stabiler Produktionszweig
2. `release/*` = Release-Kandidaten, vor Deployments testen
3. `dev` = aktive Entwicklung, Feature-Merges
4. `feature/*` = einzelne Features oder Bugfixes

## Schritte bei Drift zwischen Umgebungen

1. Finde den aktuellen PROD-Commit
   - Producer deployet vermutlich einen bestimmten Branch oder Tag
   - ggf. `git rev-parse HEAD` auf PROD-Host prüfen
2. Vergleiche `prod` mit `dev`
   - `git diff prod..dev`
   - `git log --oneline prod..dev`
3. Dokumentiere fehlende Migrationsstände
   - `knex migrate:status --knexfile backend/knexfile.js`
4. Bereinige lokale Änderungen in einem Feature-Branch
   - `git checkout -b feature/community-leagues-v2`
   - committe oder stash nach Bedarf
5. Synchronisiere `dev` mit `prod` nur nach Review

## Wichtige Regeln

- `knex migrate:latest` nur in DEV / TEST / PROD nach Review
- `knex seed:run` nur in NON-PROD Umgebungen
- `backend/sportsplatform.db` in LOCAL sollte eine Kopie sein, kein PROD-Hauptdatenbestand
- `backend/sportsplatform.db.broken` nicht als Arbeitsdatenbank nutzen

## Konkreter Vorschlag für deinen Fall

1. Erstelle einen Feature-Branch aus dem aktuellen `dev`-Zweig:
   - `git checkout -b feature/community-leagues-v2`
2. Mache den aktuellen Arbeitsstand sauber:
   - `git add` / `git commit`
   - oder `git stash` bei experimentellen Änderungen
3. Prüfe den echten PROD-Standpunkt:
   - `git fetch origin`
   - `git diff origin/main..dev`
4. Synchronisiere `TEST` mit dem PROD-Branch
   - `git checkout test` / `git merge origin/main`
5. Führe lokale Tests mit Kopie der DB aus:
   - `cp backend/sportsplatform.db backend/sportsplatform.local.db`
   - `.env` auf lokale DB zeigen lassen

## ToDo für saubere Umgebung

- Dokumentiere PROD-Branch und Release-Tag in `documentation/`
- Richte `documentation/release-process.md` ein, falls nötig
- Pflege das `documentation/`-Verzeichnis als zentrale Quelle
