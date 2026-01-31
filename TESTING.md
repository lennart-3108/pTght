# Health Check & Testing System

## Automatische Tests beim Start

Das System führt automatisch Health Checks aus um sicherzustellen, dass alle kritischen Komponenten funktionieren.

## Verwendung

### 1. Manuelle Tests ausführen

```bash
# Im Backend-Verzeichnis
cd backend
npm run health
```

### 2. Tests mit Start kombiniert

```bash
# Von Root-Verzeichnis
bash scripts/start-with-tests.sh
```

### 3. Automatische Tests nach Start

Tests laufen automatisch nach `npm start` (via poststart hook)

## Getestete Komponenten

### Backend API
- ✅ Health Check Endpoint
- ✅ Admin Routes (Auth-Check)
- ✅ Sports API
- ✅ Leagues API
- ✅ Locations API

### Frontend
- ✅ React App lädt korrekt
- ✅ Routing funktioniert
- ✅ Static Assets verfügbar

## Exit Codes

- `0` - Alle Tests bestanden
- `0` - Einige Tests fehlgeschlagen, aber System funktioniert
- `1` - Kritische Tests fehlgeschlagen (System nicht betriebsbereit)

## Kritische Endpoints

Diese müssen immer funktionieren:
- Health Check
- Home Page
- Sports List

Bei Ausfall dieser Endpoints wird Exit Code 1 zurückgegeben.

## Test-Ergebnisse

Das Script zeigt:
- ✓ Erfolgreiche Tests (grün)
- ✗ Fehlgeschlagene Tests (rot)
- ⚠ Warnungen (gelb)
- Durchschnittliche Response-Zeit
- Success Rate in %

## Anpassung

Weitere Tests können in `backend/scripts/health-check.js` hinzugefügt werden:

```javascript
await testEndpoint('Neuer Test', `${BACKEND_URL}/api/endpoint`);
```
