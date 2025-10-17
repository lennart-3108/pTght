/**
 * Migration: Fügt hierarchische Struktur zu sports hinzu (parent_id, category)
 */

exports.up = async function (knex) {
  const hasSports = await knex.schema.hasTable('sports');
  if (!hasSports) return;

  // Füge parent_id und category zu sports hinzu
  const hasParentId = await knex.schema.hasColumn('sports', 'parent_id');
  const hasCategory = await knex.schema.hasColumn('sports', 'category');
  
  if (!hasParentId || !hasCategory) {
    await knex.schema.table('sports', (t) => {
      if (!hasParentId) {
        t.integer('parent_id')
          .nullable()
          .references('id')
          .inTable('sports')
          .onDelete('CASCADE')
          .comment('Referenz zur Eltern-Sportart für hierarchische Struktur');
      }
      if (!hasCategory) {
        t.string('category')
          .nullable()
          .comment('Kategorie der Sportart (z.B. "Einzel", "Doppel", "Team")');
      }
    });
  }

  // Erweitere die Sportarten-Daten mit hierarchischer Struktur
  const existingSports = await knex('sports').select('id', 'name');
  
  // Finde Tennis ID
  const tennis = existingSports.find(s => s.name === 'Tennis');
  if (tennis) {
    // Erstelle Tennis-Varianten
    await knex('sports').insert([
      { name: 'Tennis Einzel', parent_id: tennis.id, category: 'Einzel' },
      { name: 'Tennis Doppel', parent_id: tennis.id, category: 'Doppel' },
      { name: 'Tennis Mixed Doppel', parent_id: tennis.id, category: 'Mixed' }
    ]);
  }

  // Finde Fußball ID
  const fussball = existingSports.find(s => s.name === 'Fußball');
  if (fussball) {
    // Erstelle Fußball-Varianten
    await knex('sports').insert([
      { name: 'Fußball 11 vs 11', parent_id: fussball.id, category: 'Vollfeld' },
      { name: 'Fußball 7 vs 7', parent_id: fussball.id, category: 'Kleinfeld' },
      { name: 'Fußball 5 vs 5', parent_id: fussball.id, category: 'Futsal' }
    ]);
  }

  // Finde Basketball ID
  const basketball = existingSports.find(s => s.name === 'Basketball');
  if (basketball) {
    await knex('sports').insert([
      { name: 'Basketball 5 vs 5', parent_id: basketball.id, category: 'Vollfeld' },
      { name: 'Basketball 3 vs 3', parent_id: basketball.id, category: 'Streetball' }
    ]);
  }

  // Finde Volleyball ID
  const volleyball = existingSports.find(s => s.name === 'Volleyball');
  if (volleyball) {
    await knex('sports').insert([
      { name: 'Volleyball Indoor', parent_id: volleyball.id, category: 'Halle' },
      { name: 'Volleyball Beach', parent_id: volleyball.id, category: 'Beach' }
    ]);
  }

  // Finde Handball ID
  const handball = existingSports.find(s => s.name === 'Handball');
  if (handball) {
    await knex('sports').insert([
      { name: 'Handball 7 vs 7', parent_id: handball.id, category: 'Vollfeld' },
      { name: 'Handball 5 vs 5', parent_id: handball.id, category: 'Kleinfeld' }
    ]);
  }

  // Füge weitere Hauptsportarten hinzu
  await knex('sports').insert([
    // Kampfsport
    { name: 'Kampfsport', parent_id: null, category: null },
    // Wassersport  
    { name: 'Wassersport', parent_id: null, category: null },
    // Radsport
    { name: 'Radsport', parent_id: null, category: null },
    // Wintersport
    { name: 'Wintersport', parent_id: null, category: null },
    // Leichtathletik
    { name: 'Leichtathletik', parent_id: null, category: null }
  ]);

  // Dann die spezifischen Varianten
  const newSports = await knex('sports').select('id', 'name').whereIn('name', [
    'Kampfsport', 'Wassersport', 'Radsport', 'Wintersport', 'Leichtathletik'
  ]);

  const kampfsport = newSports.find(s => s.name === 'Kampfsport');
  if (kampfsport) {
    await knex('sports').insert([
      { name: 'Boxen', parent_id: kampfsport.id, category: 'Schlagen' },
      { name: 'Judo', parent_id: kampfsport.id, category: 'Ringen' },
      { name: 'Karate', parent_id: kampfsport.id, category: 'Schlagen' },
      { name: 'Taekwondo', parent_id: kampfsport.id, category: 'Treten' },
      { name: 'MMA', parent_id: kampfsport.id, category: 'Mixed' }
    ]);
  }

  const wassersport = newSports.find(s => s.name === 'Wassersport');
  if (wassersport) {
    await knex('sports').insert([
      { name: 'Schwimmen Freistil', parent_id: wassersport.id, category: 'Schwimmen' },
      { name: 'Schwimmen Brust', parent_id: wassersport.id, category: 'Schwimmen' },
      { name: 'Schwimmen Rücken', parent_id: wassersport.id, category: 'Schwimmen' },
      { name: 'Schwimmen Schmetterling', parent_id: wassersport.id, category: 'Schwimmen' },
      { name: 'Wasserball', parent_id: wassersport.id, category: 'Team' },
      { name: 'Surfen', parent_id: wassersport.id, category: 'Board' }
    ]);
  }

  const radsport = newSports.find(s => s.name === 'Radsport');
  if (radsport) {
    await knex('sports').insert([
      { name: 'Rennrad', parent_id: radsport.id, category: 'Straße' },
      { name: 'Mountainbike', parent_id: radsport.id, category: 'Gelände' },
      { name: 'BMX', parent_id: radsport.id, category: 'Freestyle' },
      { name: 'Bahnradsport', parent_id: radsport.id, category: 'Bahn' }
    ]);
  }

  const leichtathletik = newSports.find(s => s.name === 'Leichtathletik');
  if (leichtathletik) {
    await knex('sports').insert([
      { name: 'Sprint 100m', parent_id: leichtathletik.id, category: 'Lauf' },
      { name: 'Mittelstrecke 800m', parent_id: leichtathletik.id, category: 'Lauf' },
      { name: 'Langstrecke Marathon', parent_id: leichtathletik.id, category: 'Lauf' },
      { name: 'Hochsprung', parent_id: leichtathletik.id, category: 'Sprung' },
      { name: 'Weitsprung', parent_id: leichtathletik.id, category: 'Sprung' },
      { name: 'Kugelstoßen', parent_id: leichtathletik.id, category: 'Wurf' },
      { name: 'Speerwerfen', parent_id: leichtathletik.id, category: 'Wurf' }
    ]);
  }
};

exports.down = async function (knex) {
  const hasSports = await knex.schema.hasTable('sports');
  if (!hasSports) return;

  // Lösche alle Child-Sportarten (mit parent_id)
  await knex('sports').whereNotNull('parent_id').del();

  // Entferne die neuen Spalten
  const hasParentId = await knex.schema.hasColumn('sports', 'parent_id');
  const hasCategory = await knex.schema.hasColumn('sports', 'category');
  
  if (hasParentId || hasCategory) {
    await knex.schema.table('sports', (t) => {
      if (hasParentId) t.dropColumn('parent_id');
      if (hasCategory) t.dropColumn('category');
    });
  }
};