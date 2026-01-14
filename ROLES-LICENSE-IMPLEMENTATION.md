# Rollen & Lizenzen System - Implementierung

## Übersicht

Das System ermöglicht Benutzern, Rollen mit entsprechenden Lizenzen zu buchen. Nach der Buchung werden die entsprechenden Tools in der Navigation freigeschaltet.

## Komponenten

### Frontend

1. **SubscriptionsPage** (`frontend/src/pages/SubscriptionsPage.js`)
   - Zeigt alle verfügbaren Rollen und Lizenzpläne
   - "Jetzt buchen" Button für eingeloggte Benutzer
   - Simulierte PayPal-Zahlung beim Kauf

2. **Header** (`frontend/src/components/Header.js`)
   - Dynamische Navigation basierend auf Benutzerrollen
   - Lädt Benutzerrollen beim Mount
   - Zeigt rollenspezifische Links:
     - `location_provider` → Location Manager
     - `trainer` → Training
     - `club_admin` → Vereine

3. **CSS-Fixes**
   - `ml-header-container` hinzugefügt für korrektes Layout
   - Verhindert, dass das Burger-Menü außerhalb des Bildschirms liegt

### Backend

1. **Purchase-Endpoint** (`backend/routes/roles.js`)
   - `POST /api/roles/purchase`
   - Authentifizierung erforderlich
   - Erstellt:
     - Lizenz-Eintrag in `user_licenses`
     - Transaktions-Eintrag in `license_transactions`
     - Rollen-Zuweisung in `user_roles`

2. **Validierungen**
   - Prüft, ob Benutzer bereits aktive Lizenz für die Rolle hat
   - Verifiziert Betrag mit Lizenzplan-Preis
   - Berechnet Ablaufdatum basierend auf `duration_days`

## Workflow

### Lizenz kaufen

1. Benutzer navigiert zu `/abos`
2. Wählt einen Lizenzplan und klickt "Jetzt buchen"
3. Frontend sendet POST zu `/api/roles/purchase`:
   ```json
   {
     "license_plan_id": 1,
     "payment_method": "paypal_simulated",
     "amount": 9.99
   }
   ```
4. Backend:
   - Erstellt aktive Lizenz
   - Erstellt abgeschlossene Transaktion (simuliert)
   - Weist Rolle zu
5. Frontend:
   - Zeigt Erfolgs-Meldung
   - Lädt Seite neu, um neue Navigation anzuzeigen

### Nach dem Kauf

- Benutzer sieht neue Links in der Navigation
- Beispiel: Nach Kauf von "Location Provider Monthly":
  - Navigation zeigt "Location Manager" Link
  - Zugriff auf Location-Management-Tools

## Verfügbare Rollen

1. **Free User** - Kostenlos, keine Lizenz erforderlich
2. **Team Captain** - €9.99/Monat oder €49.99/Saison
3. **Trainer** - €29.99/Monat
4. **Club Admin** - €99.99 (Starter) oder €249.99 (Professional)
5. **Location Provider** - €79.99/Monat
6. **League Organizer** - €99.99 (Small) oder €249.99 (Large)

## API-Endpunkte

### Öffentlich

- `GET /api/roles` - Alle Rollen
- `GET /api/roles/license-plans` - Alle Lizenzpläne
- `GET /api/roles/license-plans/:planId` - Spezifischer Plan

### Authentifiziert

- `POST /api/roles/purchase` - Lizenz kaufen
- `GET /api/roles/users/:userId/roles` - Benutzerrollen
- `GET /api/roles/users/:userId/licenses` - Benutzerlizenzen

## Testing

```bash
# Backend testen
cd backend
bash scripts/test_roles.sh

# Lizenz kaufen (mit gültigem Token)
curl -X POST http://localhost:5001/api/roles/purchase \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{"license_plan_id": 1, "amount": 9.99}'
```

## Datenbank-Tabellen

- `roles` - Verfügbare Rollen
- `user_roles` - Benutzer-Rollen-Zuweisungen
- `license_plans` - Lizenzpläne mit Preisen
- `user_licenses` - Aktive Benutzerlizenzen
- `license_transactions` - Zahlungshistorie

## Features

✅ PayPal-simulierte Zahlung
✅ Automatische Rollen-Zuweisung
✅ Dynamische Navigation
✅ Lizenz-Ablaufdatum-Berechnung
✅ Preis-Validierung
✅ Duplikat-Prüfung (keine doppelten aktiven Lizenzen)
✅ Responsive Design

## Nächste Schritte

- [ ] Echte PayPal-Integration
- [ ] Automatische Verlängerung bei Ablauf
- [ ] Lizenz-Verwaltungsseite für Benutzer
- [ ] E-Mail-Benachrichtigungen bei Kauf/Ablauf
- [ ] Rechnungs-Generierung
