module.exports = function setupTables(db) {
    db.serialize(() => {
      // --- USERS ---
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstname TEXT,
        lastname TEXT,
        birthday TEXT,
        email TEXT UNIQUE,
        password TEXT,
        is_confirmed INTEGER DEFAULT 0,
        confirmation_token TEXT,
        is_admin INTEGER DEFAULT 0
      )`);
  
      // --- SPORTS ---
      db.run(`CREATE TABLE IF NOT EXISTS sports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      )`);
  
      // --- USER_SPORTS ---
      db.run(`CREATE TABLE IF NOT EXISTS user_sports (
        user_id INTEGER,
        sport_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(sport_id) REFERENCES sports(id)
      )`);
  
      // --- CITIES ---
      db.run(`CREATE TABLE IF NOT EXISTS cities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      )`);
  
      // --- LEAGUES ---
      db.run(`CREATE TABLE IF NOT EXISTS leagues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        city_id INTEGER NOT NULL,
        sport_id INTEGER NOT NULL,
        FOREIGN KEY(city_id) REFERENCES cities(id),
        FOREIGN KEY(sport_id) REFERENCES sports(id)
      )`);
  
      // --- INITIAL SPORTS ---
      db.all("SELECT COUNT(*) as cnt FROM sports", (err, rows) => {
        if (!err && rows[0]?.cnt === 0) {
          const sportsList = [
            "Fußball", "Basketball", "Tennis", "Volleyball", "Schwimmen", "Laufen", "Handball"
          ];
          sportsList.forEach(sport => {
            db.run("INSERT OR IGNORE INTO sports (name) VALUES (?)", [sport]);
          });
        }
      });
  
      // --- INITIAL CITIES ---
      db.all("SELECT COUNT(*) as cnt FROM cities", (err, rows) => {
        if (!err && rows[0]?.cnt === 0) {
          const citiesList = ["Bremen", "Hamburg", "Berlin"];
          citiesList.forEach(city => {
            db.run("INSERT OR IGNORE INTO cities (name) VALUES (?)", [city]);
          });
        }
      });
  
      // --- INITIAL LEAGUES ---
      db.all("SELECT COUNT(*) as cnt FROM leagues", (err, rows) => {
        if (!err && rows[0]?.cnt === 0) {
          // Beispiel: Bremen Fußball Liga
          db.get(`SELECT id FROM cities WHERE name = 'Bremen'`, (err, bremenCity) => {
            db.get(`SELECT id FROM sports WHERE name = 'Fußball'`, (err, fussballSport) => {
              if (bremenCity && fussballSport) {
                db.run("INSERT INTO leagues (name, city_id, sport_id) VALUES (?, ?, ?)",
                  ["Bremen Fußball Liga", bremenCity.id, fussballSport.id]);
              }
            });
          });
  
          // Beispiel: Hamburg Basketball Liga
          db.get(`SELECT id FROM cities WHERE name = 'Hamburg'`, (err, hamburgCity) => {
            db.get(`SELECT id FROM sports WHERE name = 'Basketball'`, (err, basketballSport) => {
              if (hamburgCity && basketballSport) {
                db.run("INSERT INTO leagues (name, city_id, sport_id) VALUES (?, ?, ?)",
                  ["Hamburg Basketball Liga", hamburgCity.id, basketballSport.id]);
              }
            });
          });
        }
      });
    });
  };
  