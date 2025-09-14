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
- Registrierungsabschlussquote: Ziel >80% (gemessen via Tracking-Pixel in Bestätigungs-E-Mail; Tool: Google Analytics oder eigenes Logging).
- Anzahl aktiver Nutzer: Ziel 500+ pro Monat (gemessen via tägliche Login-Events in DB; Tool: SQL-Queries).
- Zeit bis zur E-Mail-Zustellung/Bestätigung: Median <5 Minuten (gemessen via Mailer-Logs; Tool: Log-Analyse).
- Anzahl gelisteter Ligen/Städte/Sportarten: Ziel 100+ Ligen, 50+ Städte, 20+ Sportarten (gemessen via DB-Counts; Tool: Admin-Dashboard).
- Fehlerraten: <5% 5xx auf API, <2% Bounce auf E-Mails (gemessen via Server-Logs und SMTP-Reports; Tool: Monitoring wie Prometheus).

Risiken
- E-Mail-Zustellbarkeit (Spam, Konfiguration): Mitigation – Fallback auf alternative SMTP-Provider (z. B. SendGrid); regelmäßige SPF/DKIM-Checks; Test-E-Mails vor Launch.
- Datenwachstum > SQLite-Grenzen: Mitigation – Monitoring von DB-Größe; Plan für Migration zu PostgreSQL bei >1GB Daten; Backup-Strategie.
- Sicherheit bei falscher JWT_SECRET-Konfiguration: Mitigation – ENV-Validierung beim Start; Warnungen in Logs; regelmäßige Security-Audits.
- Abhängigkeit von externer SMTP-Infrastruktur: Mitigation – Lokaler Mail-Queue als Buffer; Multi-Provider-Support; Offline-Modus für kritische Funktionen.

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
- users(id PRIMARY KEY, firstname TEXT NOT NULL, lastname TEXT NOT NULL, birthday DATE, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, is_admin BOOLEAN DEFAULT FALSE, is_confirmed BOOLEAN DEFAULT FALSE, confirmation_token TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)
- sports(id PRIMARY KEY, name TEXT UNIQUE NOT NULL)
- user_sports(user_id INTEGER FK users(id), sport_id INTEGER FK sports(id), PRIMARY KEY(user_id, sport_id))
- cities(id PRIMARY KEY, name TEXT UNIQUE NOT NULL)
- leagues(id PRIMARY KEY, name TEXT NOT NULL, city_id INTEGER FK cities(id), sport_id INTEGER FK sports(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)
- user_leagues(league_id INTEGER FK leagues(id), user_id INTEGER FK users(id), joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(league_id, user_id))

Marktanalyse
- Zielmarkt: Sportbegeisterte in Deutschland/Österreich (geschätzt 10M+ aktive Sportler; Quelle: DOSB-Statistiken).
- Wettbewerb: Lokale Vereinsseiten (z. B. myVerein), globale Plattformen (z. B. Meetup), aber keine spezifische Liga-Finder-App; Differenzierung durch Fokus auf Ligen/Städte.
- Marktgröße: Potenziell 1-5% Marktanteil in ersten 2 Jahren (ca. 100K-500K Nutzer); Wachstum durch virale Effekte in Communities.

Kosten-Nutzen-Analyse
- Entwicklungskosten (MVP): €50K-100K (Schätzung: 6 Monate Entwicklungszeit, 2-3 Entwickler; inkl. Tools wie Mailtrap).
- Betriebskosten (jährlich): €10K-20K (Hosting, SMTP, Monitoring; skalierbar mit Nutzerwachstum).
- Erwarteter Nutzen/ROI: Break-even nach 1 Jahr bei 10K aktiven Nutzern (Monetarisierung via Premium-Features €5/Monat/Nutzer); ROI >200% in 2 Jahren durch Effizienzgewinne und Skalierung.

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
