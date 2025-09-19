.headers on
.mode column
-- Anzahl prüfen
SELECT COUNT(*) AS cities_count FROM cities;
SELECT COUNT(*) AS leagues_count FROM leagues;

-- Alle Datensätze (menschenlesbar)
SELECT * FROM cities;
SELECT * FROM leagues;

-- Falls du CSV möchtest, alternativ ausführen (deaktiviere die oberen SELECTs dann):
-- .mode csv
-- .output cities.csv
-- SELECT * FROM cities;
-- .output leagues.csv
-- SELECT * FROM leagues;
-- .output stdout

.quit
