Titel
Sportplattform – Registrierung, Bestätigung, Profil und Ligaverwaltung

Zweck
Eine schlanke Plattform, auf der Sportbegeisterte sich registrieren, ihr Profil pflegen, Sportarten auswählen und Ligen nach Stadt und Sport entdecken können. Administratoren können Inhalte anlegen und verwalten.

Problemstellung
- Vereine/Ligen haben verteilte, uneinheitliche Informationen.
- Interessenten finden schwer passende Ligen in ihrer Stadt und Sportart.
- Onboarding ist oft manuell (E-Mail/Excel), fehleranfällig und langsam.

Zielsetzungen
- Self-Service-Registrierung mit E-Mail-Bestätigung.
- Übersichtliche Kataloge für Sportarten, Städte und Ligen.
- Einfache Profilansicht mit gewählten Sportarten.
- Administrative Inhalte (z. B. neue Ligen) über abgesicherten Bereich.
- Grundlage für spätere Erweiterungen (Beitritte, Zahlungen, Spielpläne).

Stakeholder
- Endnutzer: Sportinteressierte.
- Administratoren: Betreiber/Staff.
- Vereine/Ligen: Datenlieferanten, später direkte Pflege.
- IT/Operations: Betrieb, Monitoring, Wartung.

Geschäftsnutzen (Nutzenargumentation)
- Höhere Conversion: Einfaches Onboarding reduziert Absprünge.
- Bessere Datenqualität: Zentrale und validierte Stammdaten.
- Effizienz: Weniger manueller Aufwand (automatisierte E-Mail-Bestätigung).
- Skalierbarkeit: Leicht erweiterbar für neue Städte/Sportarten/Ligen.
- Grundlage für Monetarisierung: Premium-Features, Sponsoring, Vermittlungsgebühren.

Leistungsumfang (Scope)
- In-Scope:
  - Registrierung, Login, Logout, E-Mail-Bestätigung.
  - Profil anzeigen, Sportarten-Zuordnung.
  - Sportarten-/Ligen-/Städte-Kataloge.
  - Admin-Automatik beim Start (Demo) und Admin-Only “Create”-Bereich (Platzhalter).
  - SMTP-Integration (Mailtrap) inkl. Diagnoseendpunkte.
- Out-of-Scope (erste Iteration):
  - Bezahlfunktionen, komplexe Rollen, Spielbetriebslogik.
  - Mobile Apps, Mehrsprachigkeit jenseits Deutsch.
  - DSGVO-Features (Datenexport/Löschung) über Basis hinaus.

Nichtfunktionale Anforderungen
- Sicherheit: JWT-basierte Authentifizierung, bestätigte E-Mail.
- Datenschutz: Passwort-Hashing (bcrypt), keine Klartext-Passwörter.
- Zuverlässigkeit: Health-Endpoint, Mailer-Status, Diagnosescript.
- Wartbarkeit: Modulcluster (config, db, mailer, routes), kleine Funktionen.
- Leistung: SQLite für MVP, leicht migrierbar auf RDBMS.

Erfolgskriterien (KPIs)
- Registrierungsabschlussquote (% mit bestätigter E-Mail).
- Anzahl aktiver Nutzer pro Woche/Monat.
- Zeit bis zur E-Mail-Zustellung/Bestätigung (Median).
- Anzahl gelisteter Ligen/Städte/Sportarten.
- Fehlerraten: 5xx auf API, Bounce auf E-Mails.

Risiken
- E-Mail-Zustellbarkeit (Spam, Konfiguration).
- Datenwachstum > SQLite-Grenzen.
- Sicherheit bei falscher JWT_SECRET-Konfiguration.
- Abhängigkeit von externer SMTP-Infrastruktur.

Architektur (High-Level)
- Frontend: React-Router, geschützte Routen, einfache Banner für Systemereignisse.
- Backend: Node/Express, Cluster:
  - config: ENV/Security/CORS.
  - db: SQLite, Schema, Admin-Bootstrap.
  - mailer: SMTP (Mailtrap), Diagnose, Schema-Mail.
  - routes: Auth, Katalog, Health/Mailer.
- Kommunikation: REST über HTTP, JSON; JWT im Authorization-Header.
- Deployment: Lokale Entwicklung, später Containerisierung möglich.

Datenmodell (Kurz)
- users(id, firstname, lastname, birthday, email[unique], password_hash, is_admin, is_confirmed, confirmation_token?)
- sports(id, name)
- user_sports(user_id FK, sport_id FK)
- cities(id, name)
- leagues(id, name, city_id FK, sport_id FK)

Roadmap (Phasen)
1. MVP (heute): Registrierung/Login, E-Mail-Bestätigung, Kataloge, Admin-Bootstrap.
2. Beitrittsprozesse: “Beitreten”-Workflow, Benachrichtigungen.
3. Admin-UI: CRUD für Städte/Ligen/Sportarten.
4. Skalierung: Migration zu Postgres, Queue für E-Mails, Observability.
5. Monetarisierung: Premium-Features, Sponsoring, Partner-Integrationen.

Betriebsaspekte
- .env-gestützte Konfiguration, getrennte Secrets.
- Health-Checks, /mailer/status, Diagnosescript.
- Logging sparsam, MAIL_DEBUG toggelbar.

Abgrenzung und Annahmen
- E-Mail-Bestätigung genügt als Identitätsnachweis für MVP.
- SQLite ist ausreichend für frühe Tests.
- Admin-Bootstrap beim Start dient nur der Demo und wird später durch UI/Policy ersetzt.

Fazit
Der MVP liefert schnell nutzbaren Mehrwert: verlässliches Onboarding, durchsuchbare Kataloge und vorbereitete Admin-Funktionen. Die modulare Architektur ermöglicht fokussierte Weiterentwicklung bei niedriger Komplexität.
