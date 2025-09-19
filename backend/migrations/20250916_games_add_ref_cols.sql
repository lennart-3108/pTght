-- Migration: Füge Referenzspalten für User/Team zu games hinzu (nur falls noch nicht vorhanden)
ALTER TABLE games ADD COLUMN home_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE games ADD COLUMN home_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE games ADD COLUMN away_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE games ADD COLUMN away_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;

-- SQLite unterstützt ALTER TABLE ... ADD CONSTRAINT nicht direkt.
-- Die Checks müssen ggf. per Umweg (Tabelle neu anlegen/kopieren) hinzugefügt werden.
-- Für reine Migration reicht das Hinzufügen der Spalten.
