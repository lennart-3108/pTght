exports.up = async function(knex) {
  // Add name_en to sports
  const hasSportsCol = await knex.schema.hasColumn('sports', 'name_en');
  if (!hasSportsCol) {
    await knex.schema.alterTable('sports', t => {
      t.string('name_en', 150).nullable();
    });
  }

  // Add name_en to sport_categories
  const hasCatCol = await knex.schema.hasColumn('sport_categories', 'name_en');
  if (!hasCatCol) {
    await knex.schema.alterTable('sport_categories', t => {
      t.string('name_en', 150).nullable();
    });
  }

  // Populate sport English names
  const sportTranslations = {
    'American Football': 'American Football',
    'BMX': 'BMX',
    'Badminton': 'Badminton',
    'Badminton Doppel': 'Badminton Doubles',
    'Badminton Einzel': 'Badminton Singles',
    'Badminton Mixed': 'Badminton Mixed',
    'Base Jumping': 'Base Jumping',
    'Baseball': 'Baseball',
    'Basketball': 'Basketball',
    'Basketball 3 vs 3': 'Basketball 3 vs 3',
    'Basketball 5 vs 5': 'Basketball 5 vs 5',
    'Biathlon': 'Biathlon',
    'Billard': 'Billiards',
    'Bobfahren': 'Bobsled',
    'Bodybuilding': 'Bodybuilding',
    'Bogenschießen': 'Archery',
    'Bouldern': 'Bouldering',
    'Boxen': 'Boxing',
    'Bungee Jumping': 'Bungee Jumping',
    'Cricket': 'Cricket',
    'CrossFit': 'CrossFit',
    'Curling': 'Curling',
    'Darts': 'Darts',
    'Diskuswerfen': 'Discus Throw',
    'E-Sports': 'E-Sports',
    'Eishockey': 'Ice Hockey',
    'Eiskunstlauf': 'Figure Skating',
    'Eisschnelllauf': 'Speed Skating',
    'Fallschirmspringen': 'Skydiving',
    'Fechten': 'Fencing',
    'Frisbee': 'Frisbee',
    'Fußball': 'Football (Soccer)',
    'Fußball 11 vs 11': 'Football 11 vs 11',
    'Fußball 5 vs 5': 'Football 5 vs 5',
    'Fußball 7 vs 7': 'Football 7 vs 7',
    'Gewichtheben': 'Weightlifting',
    'Go': 'Go',
    'Golf': 'Golf',
    'Hammerwerfen': 'Hammer Throw',
    'Handball': 'Handball',
    'Handball 5 vs 5': 'Handball 5 vs 5',
    'Handball 7 vs 7': 'Handball 7 vs 7',
    'Hockey': 'Hockey',
    'Judo': 'Judo',
    'Kanufahren': 'Canoeing',
    'Karate': 'Karate',
    'Kickboxen': 'Kickboxing',
    'Kitesurfen': 'Kitesurfing',
    'Klettern': 'Climbing',
    'Kraftdreikampf': 'Powerlifting',
    'Kugelstoßen': 'Shot Put',
    'Langstrecke 10000m': 'Long Distance 10000m',
    'Langstrecke 5000m': 'Long Distance 5000m',
    'Laufen': 'Running',
    'MMA': 'MMA',
    'Marathon': 'Marathon',
    'Mittelstrecke 1500m': 'Middle Distance 1500m',
    'Mittelstrecke 800m': 'Middle Distance 800m',
    'Padel': 'Padel',
    'Paragliding': 'Paragliding',
    'Parcours': 'Parkour',
    'Pickleball': 'Pickleball',
    'Poker': 'Poker',
    'Racquetball': 'Racquetball',
    'Radfahren': 'Cycling',
    'Reiten': 'Horseback Riding',
    'Ringen': 'Wrestling',
    'Rodeln': 'Luge',
    'Rudern': 'Rowing',
    'Rugby': 'Rugby',
    'Schach': 'Chess',
    'Schießsport': 'Shooting Sports',
    'Schwimmen': 'Swimming',
    'Schwimmen Brust': 'Swimming Breaststroke',
    'Schwimmen Freistil': 'Swimming Freestyle',
    'Schwimmen Rücken': 'Swimming Backstroke',
    'Schwimmen Schmetterling': 'Swimming Butterfly',
    'Segeln': 'Sailing',
    'Skateboarden': 'Skateboarding',
    'Skeleton': 'Skeleton',
    'Skifahren': 'Skiing',
    'Slacklining': 'Slacklining',
    'Snooker': 'Snooker',
    'Snowboarden': 'Snowboarding',
    'Speerwerfen': 'Javelin Throw',
    'Spikeball': 'Spikeball',
    'Sprint 100m': 'Sprint 100m',
    'Sprint 200m': 'Sprint 200m',
    'Squash': 'Squash',
    'Stand-Up Paddling': 'Stand-Up Paddling',
    'Surfen': 'Surfing',
    'Taekwondo': 'Taekwondo',
    'Tennis': 'Tennis',
    'Tennis Doppel': 'Tennis Doubles',
    'Tennis Einzel': 'Tennis Singles',
    'Tennis Mixed Doppel': 'Tennis Mixed Doubles',
    'Tischtennis': 'Table Tennis',
    'Tischtennis Doppel': 'Table Tennis Doubles',
    'Tischtennis Einzel': 'Table Tennis Singles',
    'Triathlon': 'Triathlon',
    'Turnen': 'Gymnastics',
    'Volleyball': 'Volleyball',
    'Volleyball Beach': 'Beach Volleyball',
    'Volleyball Indoor': 'Indoor Volleyball',
    'Wakeboarden': 'Wakeboarding',
    'Wandern': 'Hiking',
    'Wasserball': 'Water Polo',
    'Wasserski': 'Waterskiing',
  };

  for (const [de, en] of Object.entries(sportTranslations)) {
    await knex('sports').where('name', de).update({ name_en: en });
  }

  // Populate category English names
  const catTranslations = {
    'Ausdauersport': 'Endurance Sports',
    'Ballsport': 'Ball Sports',
    'Ballsportarten': 'Ball Sports',
    'Bar & Fun Games': 'Bar & Fun Games',
    'Denksport': 'Mind Sports',
    'Extremsport': 'Extreme Sports',
    'Kampfsportarten': 'Martial Arts',
    'Kraftsport': 'Strength Sports',
    'Leichtathletik': 'Athletics',
    'Racket Sports': 'Racket Sports',
    'Racketsportarten': 'Racket Sports',
    'Radsport': 'Cycling Sports',
    'Sonstige': 'Other',
    'Trendsport': 'Trend Sports',
    'Wassersportarten': 'Water Sports',
    'Watersports': 'Water Sports',
    'Wintersport': 'Winter Sports',
  };

  for (const [de, en] of Object.entries(catTranslations)) {
    await knex('sport_categories').where('name', de).update({ name_en: en });
  }
};

exports.down = async function(knex) {
  const hasSportsCol = await knex.schema.hasColumn('sports', 'name_en');
  if (hasSportsCol) {
    await knex.schema.alterTable('sports', t => { t.dropColumn('name_en'); });
  }
  const hasCatCol = await knex.schema.hasColumn('sport_categories', 'name_en');
  if (hasCatCol) {
    await knex.schema.alterTable('sport_categories', t => { t.dropColumn('name_en'); });
  }
};
