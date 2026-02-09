# Database Housekeeping Report
**Datum:** 6. Februar 2026

## Executive Summary
Die Datenbank hat 65 Tabellen, davon sind 40 leer/ungenutzt. Es wurden **3 kritische Fehler** gefunden die sofort behoben werden müssen.

---

## 🔴 KRITISCHE FEHLER (Sofort beheben!)

### 1. Fehlerhafte Foreign Keys in Match-Comment-System
**Problem:** `match_comments` und `match_likes` verweisen auf obsolete `games` Tabelle statt `matches`

```sql
-- Aktueller Zustand (FALSCH):
match_comments.matchId -> games.id
match_likes.matchId -> games.id

-- Sollte sein:
match_comments.matchId -> matches.id
match_likes.matchId -> matches.id
```

**Auswirkung:** 
- Foreign Key Constraints zeigen auf leere Tabelle
- Beim Löschen von `games` würden die Tabellen unbrauchbar
- Datenintegrität nicht gewährleistet

**Quelle:** Migration `20260115_create_match_comments_and_likes.js` (Zeilen 8 & 17)

**Lösung:** Neue Migration erstellen (siehe unten)

---

### 2. Obsolete `games` Tabelle
**Problem:** Tabelle existiert noch, ist aber leer und wurde komplett nach `matches` migriert

**Status:**
- `games`: 0 Einträge (leer)
- `matches`: 6,883 Einträge (aktiv)
- Migration `20250918_games_to_matches.js` hat alle Daten übertragen

**Schema-Vergleich:**
```
games:        7 Spalten (alt, simpel)
matches:     21 Spalten (neu, vollständig)
```

**Lösung:** Tabelle droppen nach FK-Fix

---

### 3. Fehlerhafte Migration
**Datei:** `migrations/20260115_create_match_comments_and_likes.js`

**Fehler:** Erstellt FK auf `games` statt `matches`, obwohl Migration NACH der games→matches Migration läuft

**Fix erforderlich:** Migration korrigieren

---

## 📊 Tabellen-Inventar

### Aktiv genutzte Tabellen (>100 Einträge)
| Tabelle | Einträge | Zweck |
|---------|----------|-------|
| leagues | 379,647 | Ligen/Matches Container |
| seasons | 35,507 | Saisons |
| matches | 6,883 | Spiele/Matches |
| cities | 4,128 | Städte |
| sports | 108 | Sportarten |
| counties | 51 | Landkreise |

### Kleine aktive Tabellen (1-100 Einträge)
| Tabelle | Einträge |
|---------|----------|
| user_leagues | 19 |
| slots | 17 |
| sport_categories | 17 |
| license_plans | 8 |
| result_types | 7 |
| roles | 6 |
| locations | 6 |
| assets | 6 |
| users | 5 |
| regions | 5 |
| user_sports | 4 |
| rulesets | 4 |
| match_message_reads | 3 |
| countries | 3 |
| requests | 2 |
| districts | 1 |

### Leere Tabellen (0 Einträge) - 40 Tabellen
**Features noch nicht implementiert:**
- **Booking-System:** bookings, booking_series, booking_subscriptions, subscription_bookings
- **Club-System:** clubs, club_members
- **Team-System:** teams, team_members, team_match_rosters, team_roster_players
- **Tournament-System:** tournaments, tournament_participants, tournament_matches
- **Training-System:** training_groups, training_sessions, training_attendance, training_group_members
- **Match-Kommunikation:** match_comments, match_likes, match_messages, comment_likes
- **Match-Scheduling:** match_availability_days, match_availability_windows, match_schedule_proposals, match_time_frames, match_time_options, match_time_slots
- **Billing:** invoices, subscriptions, pricing_rules, license_transactions
- **Kommunikation:** direct_chats, direct_messages, notifications
- **Sonstiges:** audit_logs, blackout_windows, results, user_licenses, user_roles, user_seasons

**Obsolet:**
- **games** ← LÖSCHEN nach FK-Fix

---

## 🔧 AKTIONSPLAN

### Phase 1: Sofortmaßnahmen (JETZT)

#### Schritt 1: Neue Migration erstellen
```bash
Datei: migrations/20260206_fix_match_comments_fk.js
```

#### Schritt 2: Migration ausführen
```bash
npm run migrate:latest
```

#### Schritt 3: `games` Tabelle droppen
Nach erfolgreicher Migration kann `games` sicher gelöscht werden.

---

### Phase 2: Mittelfristig (nächste Woche)

1. **Code-Audit:** Alle Referenzen zu `games` im Code suchen und auf `matches` ändern
2. **Testing:** Comment/Like-Features testen
3. **Dokumentation:** Schema-Dokumentation aktualisieren

---

### Phase 3: Langfristig (optional)

#### Option A: Tabellen behalten
Leere Tabellen für zukünftige Features behalten (aktueller Stand)

**Vorteile:**
- Schema ist bereit für neue Features
- Keine Breaking Changes

**Nachteile:**
- Overhead in Backups
- Unübersichtliche Struktur

#### Option B: Cleanup
Ungenutzte Tabellen in separate "future-features" Migration auslagern

**Vorteile:**
- Übersichtlichere Datenbank
- Kleinere Backups

**Nachteile:**
- Migration muss später erneut laufen
- Potenzielle Breaking Changes bei aktivem Development

**Empfehlung:** Option A (Tabellen behalten), da Features evtl. bald genutzt werden

---

## 📝 Weitere Beobachtungen

### Positive Aspekte
✅ Migrations-System funktioniert (12 Batches erfolgreich)
✅ Foreign Keys sind aktiviert und funktionieren
✅ Hauptfunktionalität (Matches, Leagues, Sports) voll funktional
✅ Gute Trennung: user vs. team matches

### Verbesserungspotenzial
⚠️ Keine Audit-Logs (audit_logs leer)
⚠️ Tournament-System implementiert aber ungenutzt
⚠️ Result-System erstellt (result_types) aber keine Ergebnisse gespeichert

---

## 🎯 Zusammenfassung

**Dringend:** 
1. ✗ Fix `match_comments` und `match_likes` Foreign Keys
2. ✗ Drop `games` Tabelle
3. ✗ Korrigiere Migration `20260115_create_match_comments_and_likes.js`

**Optional:**
- 40 leere Tabellen vorhanden (für zukünftige Features)
- Können vorerst bleiben

**Nächste Schritte:**
1. Migration `20260206_fix_match_comments_fk.js` erstellen ← JETZT
2. Migration ausführen
3. Tests durchführen
4. `games` droppen
