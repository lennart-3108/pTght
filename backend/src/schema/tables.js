module.exports = {
  users: {
    columns: {
      id: "integer PK",
      name: "text",
      email: "text unique",
      password_hash: "text",
      is_admin: "boolean",
      city_id: "integer -> cities.id",
      created_at: "datetime",
      updated_at: "datetime",
    },
  },
  cities: { columns: { id: "integer PK", name: "text unique", country: "text" } },
  sports: { columns: { id: "integer PK", name: "text unique" } },
  leagues: {
    columns: {
      id: "integer PK",
      name: "text",
      city_id: "integer -> cities.id",
      sport_id: "integer -> sports.id",
      season_year: "integer",
      start_date: "date",
      end_date: "date",
    },
  },
  games: {
    columns: {
      id: "integer PK",
      league_id: "integer -> leagues.id",
      kickoff_at: "datetime",
      city: "text",
      // Variante C: genau eine von user/team pro Seite
      home_user_id: "integer -> users.id",
      home_team_id: "integer -> teams.id",
      away_user_id: "integer -> users.id",
      away_team_id: "integer -> teams.id",
    },
  },
  user_sports: { columns: { user_id: "integer -> users.id", sport_id: "integer -> sports.id" } },
  user_leagues: { columns: { user_id: "integer -> users.id", league_id: "integer -> leagues.id" } },
  teams: {
    columns: {
      id: "integer PK",
      name: "text unique",
      sport_id: "integer -> sports.id",
      league_id: "integer -> leagues.id",
      city_id: "integer -> cities.id",
    },
  },
};