Funktionale Beschreibung des Systems
Das System ist eine webbasierte Sportplattform, die Benutzer, Ligen, Spiele, Sportarten und Städte verwaltet. Es besteht aus einem React-Frontend und einem Node.js/Express-Backend mit SQLite-Datenbank. Es unterstützt Authentifizierung via JWT, E-Mail-Versand (z. B. für Bestätigungen) und robuste Datenbankabfragen, die flexible Tabellenschemata handhaben.

Hauptfunktionen:
Benutzerverwaltung: Anmeldung/Authentifizierung; Anzeige von Benutzerprofilen mit zugehörigen Ligen und Spielen (kommend/abgeschlossen).
Ligenverwaltung: Erstellung und Beitritt zu Ligen; Anzeige von Mitgliedern, Tabellen (Standings), kommenden und abgeschlossenen Spielen; Verknüpfung mit Sportarten und Städten.
Sportarten: Liste aller Sportarten; Detailansicht mit zugehörigen Ligen.
Städte: Liste aller Städte; Detailansicht mit Ligen pro Stadt; Beitritt zu Ligen direkt aus der Übersicht.
Spiele: Anzeige von Spielterminen und Ergebnissen; Verknüpfung mit Benutzern und Ligen.
Backend-Features: REST-API für CRUD-Operationen; Authentifizierungsmiddleware; E-Mail-Benachrichtigungen (z. B. via Mailtrap); Datenbankinitialisierung mit Admin-Erstellung; CORS-Unterstützung für Frontend-Integration.
Robustheit: Flexible DB-Queries, die fehlende Tabellen/Spalten handhaben; Fehlerbehandlung für Netzwerk/DB-Probleme; Ladezustände und Benutzerfeedback im Frontend.
Das System läuft lokal (Frontend: Port 3000, Backend: Port 5001) und ist für Sportvereine oder -ligen gedacht, um Organisation und Teilnahme zu erleichtern. Es verwendet lokale Speicherung für Tokens und fetch-API für Datenabrufe.