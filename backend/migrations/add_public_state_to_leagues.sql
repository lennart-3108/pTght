-- Migration: Füge das Feld `publicState` zur Tabelle `leagues` hinzu
ALTER TABLE leagues
ADD COLUMN publicState TEXT DEFAULT 'public';
