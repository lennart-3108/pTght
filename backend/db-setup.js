module.exports = function setupTables(db) {
    console.log("[setupTables] Starting database setup...");
    
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
        is_admin INTEGER DEFAULT 0,
        city_id INTEGER,
        district_id INTEGER,
        gender TEXT
      )`, (err) => {
        if (err) console.error("[setupTables] Error creating users table:", err);
        else console.log("[setupTables] users table created/verified");
      });
  
      // --- SPORTS ---
      db.run(`CREATE TABLE IF NOT EXISTS sports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      )`, (err) => {
        if (err) console.error("[setupTables] Error creating sports table:", err);
        else console.log("[setupTables] sports table created/verified");
      });
  
      // --- USER_SPORTS ---
      db.run(`CREATE TABLE IF NOT EXISTS user_sports (
        user_id INTEGER,
        sport_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(sport_id) REFERENCES sports(id)
      )`, (err) => {
        if (err) console.error("[setupTables] Error creating user_sports table:", err);
        else console.log("[setupTables] user_sports table created/verified");
      });
  
      // --- CITIES ---
      db.run(`CREATE TABLE IF NOT EXISTS cities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      )`, (err) => {
        if (err) console.error("[setupTables] Error creating cities table:", err);
        else console.log("[setupTables] cities table created/verified");
      });
  
      // --- DISTRICTS ---
      db.run(`CREATE TABLE IF NOT EXISTS districts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        city_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY(city_id) REFERENCES cities(id)
      )`, (err) => {
        if (err) console.error("[setupTables] Error creating districts table:", err);
        else console.log("[setupTables] districts table created/verified");
      });
  
      // --- LEAGUES ---
      db.run(`CREATE TABLE IF NOT EXISTS leagues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        city_id INTEGER NOT NULL,
        sport_id INTEGER NOT NULL,
        FOREIGN KEY(city_id) REFERENCES cities(id),
        FOREIGN KEY(sport_id) REFERENCES sports(id)
      )`, (err) => {
        if (err) console.error("[setupTables] Error creating leagues table:", err);
        else console.log("[setupTables] leagues table created/verified");
      });
  
      // --- INITIAL SPORTS ---
      db.all("SELECT COUNT(*) as cnt FROM sports", (err, rows) => {
        if (!err && rows[0]?.cnt === 0) {
          console.log("[setupTables] Seeding sports...");
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
          console.log("[setupTables] Seeding cities...");
          const citiesList = ["Bremen", "Hamburg", "Berlin"];
          citiesList.forEach(city => {
            db.run("INSERT OR IGNORE INTO cities (name) VALUES (?)", [city]);
          });
        }
      });
  
      // --- INITIAL LEAGUES ---
      db.all("SELECT COUNT(*) as cnt FROM leagues", (err, rows) => {
        if (!err && rows[0]?.cnt === 0) {
          console.log("[setupTables] Seeding leagues...");
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
    
    console.log("[setupTables] Database setup complete");
  };
  
  