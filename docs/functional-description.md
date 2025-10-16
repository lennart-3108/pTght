# Functional Description

Stand: 2025-10-16

Dieses Dokument beschreibt den fachlichen Umfang (Use Cases, Personas, Funktionen) der Sportplattform sowie die wichtigsten fachlichen Regeln und Schnittstellen. Es dient als Referenz für Produkt, Entwicklung und Test.

## Vision & Nutzen
- Spieler:innen finden lokale Ligen und Mitspieler, erstellen offene Spiele und organisieren Matches/Teams.
- Organisator:innen pflegen Ligen und Saisonstrukturen (Community-Leagues, Seasons).
- Fokus: Einfacher Einstieg, robuste Kernprozesse, spätere Erweiterbarkeit.

## Personas
- Spieler:in
  - Ziele: Sport & Liga finden, Matches spielen, kommunizieren, Ergebnisse sehen.
- Liga-Organisator:in
  - Ziele: Ligen pflegen, offene Spiele ermöglichen, Teams verwalten.
- System-Admin
  - Ziele: Betrieb, Health/Logs, Stammdatenpflege, Migrationen.

## End-to-End Use Cases
1) Anmelden und starten
	- POST /api/login → JWT Token; UI speichert Token und zeigt persönliche Inhalte.
	- Akzeptanz: Valide Credentials → 200+Token; ungültig → 401/400.

2) Sport/Liga entdecken
	- Listen: /api/sports, /api/sports/list, /api/cities/list, /api/leagues.
	- Akzeptanz: Sortierte, konsistente Listen; Ligen optional mit Sport/City.

3) Offene Matches
	- POST /api/open-matches (Auth): erstellt ein offenes Match; legt bei Bedarf „Open Matches“-Liga pro Sport/City an.
	- Akzeptanz: sportId & cityId erforderlich; 201 bei Erfolg; strukturierte Match-Antwort.

4) Eigene Spiele
	- GET /api/me/games (Auth): upcoming/completed; robust gegen unterschiedliche Schemas (matches/games).
	- Akzeptanz: Sortierung nach Zeit/Status; keine 5xx bei fehlenden Tabellen (leere Liste statt Fehler).

5) Kommunikation (1:1 Direct Chats)
	- Tabellen: direct_chats, direct_messages; Read-Tracking (userX_last_read_at).
	- Akzeptanz: Chat unique auf (user1_id, user2_id); Nachrichten chronologisch.

6) News/Feed
	- GET /api/news (Auth): Aktivitäts-Items (z. B. match_created, match_result) mit Timeout-Schutz.
	- Akzeptanz: Keine 5xx unter Normalbedingungen; 501 nur bei Timeout; Items sortiert und dedupliziert.

7) Teams & Kader
	- Teams, Team-Mitglieder (Roster), Match-Kader (Roster pro Match).
	- Akzeptanz: Tabellen vorhanden, PK/Unique-Constraints; API reagiert defensiv bei fehlenden Tabellen.

8) Öffentliche Kennzahlen
	- GET /api/public/stats: Aggregierte Counts (users, leagues, matches, teams, etc.), 60s Cache.
	- Akzeptanz: Schnelle Antwort, keine 5xx; sinnvolle Null-/Fallback-Werte.

9) Admin & Betrieb
	- Health: GET /api/healthz
	- DB-Inspektion: GET /api/admin/db-info (Quellen, Tabellen, Counts)
	- Merge-Leagues: POST /api/admin/merge-leagues (onConflict ignore)
	- Akzeptanz: Strukturierte JSON-Antworten; Merge nur als bewusster Admin-Task.

## Fachliche Bereiche & Regeln

### Authentifizierung
- Login via E-Mail/Passwort → JWT; Rolle/Flag: is_admin.
- CORS korrekt konfiguriert (CORS_ORIGIN=dev.matchleague.org).
- Regel: In Produktion eigenes JWT_SECRET verwenden (kein Default).

### Nutzerprofil
- Felder: email, firstname, lastname, open_for_matches (bool), favorite_sports (Text).
- Regeln: Felder werden bei Bedarf automatisch angelegt (Startup-Check/Migrationen).

### Stammdaten
- Sports (id, name), Cities (id, name, optional state_id/country_id), Countries/States (id, code/iso2, name).
- Regeln: Listen liefern NULLs für nicht vorhandene Spalten statt Fehler.

### Ligen
- League (id, name, sport_id, city_id), Community-Leagues/Seasons via Hintergrundjobs.
- Regeln: Leselogik robust; Merge-Funktion ermöglicht Datenkonsolidierung.

### Matches/Spiele
- Match Felder: league_id, kickoff_at, status, home/away user/team ids, scores, timestamps.
- Regeln: completed wenn beide Scores gesetzt; offene Matches erzeugen/verwenden „Open Matches“-Liga.

### Teams & Kader
- Team, TeamMember (PK team_id+user_id), TeamMatchRoster, TeamRosterPlayer.
- Regeln: Referentielle Integrität (wo möglich); defensive Erstellung/Alterierung bei Start.

### Chats
- DirectChat (unique: user1_id+user2_id), DirectMessage (chat_id, sender_id, body, created_at).
- Regeln: Read-Tracking Spalten werden bei Bedarf ergänzt.

### News
- Items aus Match-/Liga-bezogenen Ereignissen; dedupliziert und sortiert.
- Regeln: Timeout‑Schutz; defensive Fallbacks bei fehlenden Tabellen.

## API – Wichtige Endpunkte (Auszug)
- POST /api/login → { token, is_admin }
- GET  /api/healthz → { ok: true }
- GET  /api/sports, /api/sports/list → [ { id, name } ]
- GET  /api/cities/list → [ { id, name, country?, state? } ]
- GET  /api/leagues → [ { id, name, cityId, city, sportId, sport } ]
- GET  /api/me/games (Auth) → { upcoming: [...], completed: [...] }
- POST /api/open-matches (Auth) → Match
- GET  /api/news (Auth) → { items: [...] }
- GET  /api/public/stats → { users, leagues, matches, ... }
- GET  /api/admin/db-info → { sources, details }
- POST /api/admin/merge-leagues → { merged, note }

## Datenmodell (Kurzüberblick)
- User(id, email, firstname, lastname, is_admin, open_for_matches, favorite_sports)
- Sport(id, name)
- City(id, name, state_id?, country_id?)
- Country(id, code|iso2, name), State(id, code, name)
- League(id, name, sport_id, city_id)
- Match(id, league_id, kickoff_at, status, home_user_id, away_user_id, home_team_id, away_team_id, home_score, away_score, created_at, updated_at, completed_at)
- Team(id, name, league_id?, sport_id?, city_id?, captain_user_id?)
- TeamMember(team_id, user_id, is_captain)
- TeamMatchRoster(id, team_id, match_id, created_by, created_at)
- TeamRosterPlayer(id, roster_id, user_id, role, shirt_number)
- DirectChat(id, user1_id, user2_id, user1_last_read_at?, user2_last_read_at?)
- DirectMessage(id, chat_id, sender_id, body, created_at)

## Qualität & Betrieb (NFRs)
- Health: /api/healthz, Logs (error.log, info.log), defensive Fehlerbehandlung.
- Migrationen: Knex (sqlite); „Already up to date“ aktuell.
- CORS: korrekt; Trust Proxy für Caddy aktiviert.
- Stabilität: Start bricht bei Port-Konflikt (EADDRINUSE/EACCES) ab → Supervisor kann neustarten.

## Roadmap (Kurz)
- UI-Flows für Teams/Kader & Chats vervollständigen.
- Ligen-Management (CRUD) im Frontend für Organisator:innen.
- E-Mail-Flows (Bestätigungen, Benachrichtigungen) produktionsreif machen.
- Supervisor (systemd/PM2) + Runbook dokumentieren.