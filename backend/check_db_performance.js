const knex = require("knex");
const path = require("path");

const db = knex({
  client: "sqlite3",
  connection: { filename: path.join(__dirname, "sportplattform.db") },
  useNullAsDefault: true
});

async function checkDB() {
  try {
    console.log('=== DATENBANK PERFORMANCE CHECK ===\n');
    
    const tables = ['cities', 'countries', 'states', 'districts', 'teams', 'leagues', 'users', 'matches'];
    
    console.log('--- Tabellen-Größen ---');
    for (const table of tables) {
      try {
        const count = await db(table).count('* as count');
        console.log(`${table.padEnd(15)} ${count[0].count.toString().padStart(10)} Einträge`);
      } catch (e) {
        console.log(`${table.padEnd(15)} Tabelle nicht gefunden`);
      }
    }
    
    // Check indexes on cities
    console.log('\n--- Indexes auf cities ---');
    const cityIndexes = await db.raw("PRAGMA index_list('cities')");
    if (cityIndexes.length === 0) {
      console.log('⚠️  KEINE INDEXES auf cities-Tabelle!');
    } else {
      for (const idx of cityIndexes) {
        const info = await db.raw(`PRAGMA index_info('${idx.name}')`);
        console.log(`${idx.name}: ${info.map(i => i.name).join(', ')}`);
      }
    }
    
    // Check indexes on other location tables
    const locationTables = ['countries', 'states', 'districts'];
    for (const table of locationTables) {
      try {
        const indexes = await db.raw(`PRAGMA index_list('${table}')`);
        console.log(`\n--- Indexes auf ${table} ---`);
        if (indexes.length === 0) {
          console.log(`⚠️  KEINE INDEXES auf ${table}-Tabelle!`);
        } else {
          for (const idx of indexes) {
            const info = await db.raw(`PRAGMA index_info('${idx.name}')`);
            console.log(`${idx.name}: ${info.map(i => i.name).join(', ')}`);
          }
        }
      } catch (e) {
        console.log(`${table}: nicht gefunden`);
      }
    }
    
    // Sample query performance
    console.log('\n--- Query Performance Test ---');
    const start = Date.now();
    await db('cities').limit(1000);
    const time1 = Date.now() - start;
    console.log(`1000 cities ohne WHERE: ${time1}ms`);
    
    const start2 = Date.now();
    await db('cities').where('name', 'like', 'Berlin%').limit(100);
    const time2 = Date.now() - start2;
    console.log(`cities mit LIKE-Filter: ${time2}ms`);
    
  } catch (error) {
    console.error('Fehler:', error.message);
  } finally {
    await db.destroy();
  }
}

checkDB();
