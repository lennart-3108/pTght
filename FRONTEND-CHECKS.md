# Frontend Quality Checks

Automatische Tests um Fehler frühzeitig zu erkennen.

## Verfügbare Checks

### 1. Syntax Check (Schnell)
Prüft alle JS/JSX-Dateien auf Syntax-Fehler und analysiert die Dev-Server-Logs.

```bash
cd backend
npm run check:syntax
```

**Was wird geprüft:**
- ✓ Alle `.js` und `.jsx` Dateien sind syntax-valide
- ✓ React Dev Server kompiliert ohne Fehler
- ✓ Keine JSX-Fragment-Fehler
- ✓ Keine fehlenden Closing-Tags

**Dauer:** ~1-2 Sekunden

---

### 2. Runtime Check (Mittel)
Lädt die App in einem Headless-Browser und prüft ob alles korrekt rendert.

```bash
cd backend
npm run check:frontend
```

**Was wird geprüft:**
- ✓ HTTP 200 Response
- ✓ `<div id="root">` existiert
- ✓ React hat gerendert (root div hat Content)
- ✓ Keine JavaScript Console Errors
- ✓ CSS ist geladen (Background-Color)
- ✓ Sichtbarer Text vorhanden

**Dauer:** ~5-10 Sekunden

---

### 3. Build Check (Gründlich)
Führt einen kompletten Production-Build durch.

```bash
bash scripts/check-frontend-build.sh
```

**Was wird geprüft:**
- ✓ Alle Dependencies sind installiert
- ✓ Production Build läuft durch
- ✓ Webpack kompiliert ohne Errors
- ✓ Alle Imports sind korrekt
- ✓ TypeScript/ESLint Checks (falls konfiguriert)

**Dauer:** ~30-60 Sekunden

---

### 4. Alle Checks (Komplett)
Führt Syntax + Runtime Check aus.

```bash
cd backend
npm run check:all
```

**Dauer:** ~10-15 Sekunden

---

## Integration in Workflow

### Beim lokalen Starten
Das Dev-Start-Skript führt automatisch Checks aus:

```bash
bash scripts/dev-start.sh
```

Führt aus:
1. Backend & Frontend starten
2. **Syntax Check** - bei Fehler: Abbruch
3. **Runtime Check** - bei Fehler: Warnung

### Vor dem Deployment
Immer vor dem Deployment den Build-Check ausführen:

```bash
bash scripts/check-frontend-build.sh
```

Falls Fehler: **NICHT deployen!**

### In CI/CD Pipeline
Füge die Checks in deine CI/CD Pipeline ein:

```yaml
# Beispiel GitHub Actions
- name: Syntax Check
  run: cd backend && npm run check:syntax

- name: Build Check
  run: bash scripts/check-frontend-build.sh
```

---

## Typische Fehler die erkannt werden

### JSX Syntax Errors
```javascript
// ❌ Fehler: Closing Tag fehlt
<LeaguesFeature>
  <div>Content</div>
// ❌ </LeaguesFeature> vergessen

// ✓ Korrekt:
<LeaguesFeature>
  <div>Content</div>
</LeaguesFeature>
```

### Adjacent JSX Elements
```javascript
// ❌ Fehler: Mehrere Root-Elemente
return (
  <div>Item 1</div>
  <div>Item 2</div>
);

// ✓ Korrekt: Mit Fragment wrappen
return (
  <>
    <div>Item 1</div>
    <div>Item 2</div>
  </>
);
```

### Import Errors
```javascript
// ❌ Fehler: Import existiert nicht
import { NonExistent } from './config';

// ✓ Korrekt:
import { FEATURES } from './config';
```

### Missing Dependencies
```javascript
// ❌ Fehler: Package nicht in package.json
import something from 'not-installed';

// ✓ Korrekt: npm install not-installed
```

---

## Troubleshooting

### "Frontend log file not found"
→ Frontend Dev Server läuft nicht. Starte mit `bash scripts/dev-start.sh`

### "Cannot find module 'puppeteer'"
→ Dependencies installieren: `cd backend && npm install`

### "Compiled with warnings"
→ Nicht kritisch, aber sollte behoben werden. Siehe Warning-Details in den Logs.

### Build schlägt fehl aber Dev Server läuft
→ Prod Build hat strengere Checks. Behebe alle ESLint-Warnings.

---

## Performance

| Check | Dauer | Wann verwenden |
|-------|-------|----------------|
| Syntax Check | 1-2s | Nach jeder Änderung |
| Runtime Check | 5-10s | Vor Commit |
| Build Check | 30-60s | Vor Deployment |

---

## NPM Scripts Übersicht

```json
{
  "check:syntax": "Frontend Syntax-Check",
  "check:frontend": "Frontend Runtime-Check mit Puppeteer",
  "check:all": "Syntax + Runtime Check",
}
```

Zusätzlich:
```bash
bash scripts/check-frontend-build.sh  # Full Production Build
bash scripts/dev-start.sh              # Start mit Auto-Checks
```

---

## Konfiguration

### Timeouts anpassen
In `backend/scripts/frontend-runtime-check.js`:
```javascript
const TIMEOUT = parseInt(process.env.TIMEOUT || '10000', 10);
```

Überschreiben mit:
```bash
TIMEOUT=20000 npm run check:frontend
```

### Browser anpassen
Puppeteer Standard: Headless Chrome
Für Debugging mit sichtbarem Browser:

```javascript
// In frontend-runtime-check.js ändern:
browser = await puppeteer.launch({
  headless: false,  // Browser anzeigen
  // ...
});
```

---

## Fazit

✅ **Syntax Check** = Schnell, nach jeder Änderung  
✅ **Runtime Check** = Medium, vor jedem Commit  
✅ **Build Check** = Langsam, vor jedem Deployment  

**Empfohlen:** Alle drei in CI/CD Pipeline integrieren!
