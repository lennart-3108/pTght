CREATE TABLE leagues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city_id INTEGER NOT NULL,
  sport_id INTEGER NOT NULL,
  publicState TEXT DEFAULT 'public',
  FOREIGN KEY (city_id) REFERENCES cities (id),
  FOREIGN KEY (sport_id) REFERENCES sports (id)
);
