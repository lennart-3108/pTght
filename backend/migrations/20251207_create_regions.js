// Diese Migration wurde bereits in der DB ausgeführt, Datei war gelöscht
exports.up = async function(knex) {
  console.log('Migration bereits in DB vorhanden - überspringe');
};

exports.down = async function(knex) {
  console.log('Rollback nicht nötig - Migration war bereits ausgeführt');
};
