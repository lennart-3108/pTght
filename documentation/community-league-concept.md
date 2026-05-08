# Community League Concept

## Kernidee

Das Community League Konzept ist das soziale Herzstück von MatchLeague. Es verbindet lokale Sportgemeinschaften, Spieler, Teams, Locations und Event-Manager in einer kontinuierlichen, fairen Plattformstruktur.

### Zweck

- Lokale Sportangebote digital organisieren
- Spiele und Ligen einfach buchbar machen
- Community-Interaktion stärken
- Aufstieg und Wettbewerb innerhalb einer Liga-Pyramide ermöglichen

## Grundprinzipien

- **Play**: Spiele organisieren und antreten
- **Connect**: Mit anderen Spielern, Clubs und Locations vernetzen
- **Improve**: Statistiken, Ratings und Promotion-System
- **Promote**: Sichtbarkeit, Events und Community-Wachstum

## League-Struktur

1. **City League**
   - Einstiegsebene für Freizeit- und Amateurteams
   - Saison mit Double Round Robin
2. **Country League**
   - Aufstieg der besten Teams aus Stadtligen
3. **World League**
   - Qualifikationsturniere für Landesmeister
   - Ziel: Community World Champion

## Saison-Regeln

- Ein Spiel pro Woche pro Team
- Fester Spielplan mit Urlaubsjoker
- Ergebnispflicht vor dem nächsten Spieltag
- Auf- und Abstieg am Saisonende
- Mid-Season-Ausstieg blockiert Platzbelegung

## Rollen im System

- **Free User**: Standardspieler, Match-Suche, Buchung, Stats
- **Team Captain**: Teams gründen, Kader verwalten, Ligenanmeldung
- **Club Owner**: mehrere Teams, Finanzen, interne Events
- **Event Manager**: Turniere organisieren, Regeln festlegen
- **Location Manager**: Plätze / Slots verwalten, Werbung
- **Community Host**: Städte-League-Organisator, lokale Kommunikation
- **Trainer**: Trainingsgruppen, Spielerentwicklung

## MatchFlow

### Heute
- Gegner finden, Termine klären, Plätze buchen – manuell

### In MatchLeague
- **Gegner finden**: Match-Suche, Challenge, Community-Feeds
- **Termin wählen**: automatische Slot-Auswahl
- **Platz buchen**: dynamisches Buchungssystem
- **Ergebnis bestätigen**: integrierte Resultatverwaltung

## Monetarisierung

- Rollenbasierte Abos
- Buchungsprovisionen
- Event- und Liga-Anmeldegebühren
- Werbung & Sponsoring
- Microtransactions

## Projektstatus in diesem Repo

- Community League v2 ist als Feature im Backend/Frontend implementiert
- Kernfunktionen sind:
  - Lazy Creation von Community-Ligen
  - Mini-Ligen mit Maximalgröße
  - 6-Monats-Saisons
  - Wöchentliche Paarungen
- Der lokale Zustand muss noch mit PROD/TEST/DEV abgeglichen werden

## Nächste Schritte für das Feature

- Basis-Dokumentation hier im Repo pflegen
- Release-Branch oder `feature/community-leagues-v2` nutzen
- Migrations- und Seed-Status genau dokumentieren
- Produktiv-Sync prüfen, bevor Änderungen live gehen
