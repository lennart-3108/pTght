# Subscription Purchase mit PayPal Simulation - Dokumentation

## Implementierung

### Frontend (SubscriptionsPage.js)

**PayPal-Popup-Modal:**
- Wird beim Klick auf "Jetzt buchen" geöffnet
- Zeigt PayPal-Logo und Zahlungsdetails an
- Simulierte PayPal-Oberfläche mit:
  - Artikel (Lizenzname)
  - Rolle
  - Zeitraum (Monatlich/Saisonal/Jährlich)
  - Gesamtbetrag
- Hinweis, dass es sich um eine Simulation handelt
- Buttons: "Abbrechen" und "Jetzt bezahlen"

**Nach erfolgreicher "Zahlung":**
- Bestätigungsmeldung wird angezeigt
- Hinweis auf Email-Versand
- Seite wird nach 2 Sekunden neu geladen
- Header zeigt automatisch neue Rollen-Links an

### Backend (routes/roles.js)

**POST /api/roles/purchase:**
- Authentifizierung erforderlich (isAuthenticated)
- Prüft Lizenzplan-Existenz
- Validiert Betrag
- Prüft auf bestehende aktive Lizenzen
- Erstellt:
  - user_licenses Eintrag (status: 'active')
  - license_transactions Eintrag (status: 'completed')
  - user_roles Eintrag (oder reaktiviert bestehende)
- **Sendet Bestätigungs-Email** mit:
  - Lizenzname
  - Rolle
  - Betrag
  - Gültigkeitsdauer
  - Transaktions-ID

### Email-Versand

- Nutzt Nodemailer mit Mailhog (localhost:1025)
- Email-Template mit:
  - Titel: "Lizenz erfolgreich gebucht"
  - Alle Lizenz-Details
  - Freundliche Formatierung

## Features

✅ PayPal-Simulations-Popup beim Klick auf "Jetzt buchen"
✅ Realistische PayPal-Oberfläche mit Logo
✅ Zahlungsdetails-Anzeige
✅ Bestätigungs-Email nach Kauf
✅ Automatische Rollen-Zuweisung
✅ Header zeigt neue Tools nach Kauf
✅ Responsive Design (Mobile-optimiert)

## Testen

1. Öffne http://localhost:3000/abos
2. Wähle eine Lizenz
3. Klicke "Jetzt buchen"
4. PayPal-Modal öffnet sich
5. Klicke "Jetzt bezahlen"
6. Erfolgsmeldung erscheint
7. Prüfe Mailhog: http://localhost:1025 für die Email
8. Nach Reload: Header zeigt neue Rollen-Links (z.B. "Location Manager", "Training", "Clubs")

## Technische Details

- **Modal-Animation:** fadeIn + slideUp
- **PayPal-Logo:** Offizielles PayPal-Logo (URL)
- **Simulation-Hinweis:** Gelber Kasten mit Warnung
- **Transaktions-ID:** SIMULATED_[timestamp]_[random]
- **Email-Template:** renderEmailTemplate() Funktion
- **Auto-Reload:** window.location.reload() nach 2s

## Datenbank

Nach Kauf werden folgende Tabellen aktualisiert:
- `user_licenses` - Neue Lizenz
- `license_transactions` - Zahlungs-Transaktion
- `user_roles` - Rolle zugewiesen

## Frontend-CSS

PayPal-Modal-Styling:
- Overlay: rgba(0, 0, 0, 0.85)
- Modal: Weiß, rounded, Box-Shadow
- PayPal-Header: Blauer Gradient (#0070ba → #003087)
- Buttons: PayPal-Blau (#0070ba) mit Hover-Effekten
