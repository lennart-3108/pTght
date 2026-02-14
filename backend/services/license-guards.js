function resolveKnex(dbLike) {
  if (!dbLike) return null;
  if (typeof dbLike === 'function' && dbLike.client) return dbLike;
  if (dbLike.client && typeof dbLike.raw === 'function') return dbLike;
  if (dbLike.knex && dbLike.knex.client) return dbLike.knex;
  return null;
}

function parseJsonField(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function hasLicensingTables(knex) {
  const checks = await Promise.all([
    knex.schema.hasTable('roles').catch(() => false),
    knex.schema.hasTable('license_plans').catch(() => false),
    knex.schema.hasTable('user_licenses').catch(() => false),
  ]);
  return checks.every(Boolean);
}

async function getActiveLicensesForRoles(knex, userId, roleNames) {
  const nowIso = new Date().toISOString();
  return knex('user_licenses as ul')
    .join('license_plans as lp', 'ul.license_plan_id', 'lp.id')
    .join('roles as r', 'lp.role_id', 'r.id')
    .where('ul.user_id', userId)
    .where('ul.status', 'active')
    .where('lp.is_active', true)
    .whereIn('r.name', roleNames)
    .where(function () {
      this.whereNull('ul.expires_at').orWhere('ul.expires_at', '>', nowIso);
    })
    .select('ul.id as user_license_id', 'ul.entity_id', 'ul.entity_type', 'lp.id as plan_id', 'lp.name as plan_name', 'lp.limits', 'r.name as role_name');
}

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function getTeamCreationAllowance(dbLike, userId) {
  const knex = resolveKnex(dbLike);
  if (!knex) {
    return { licensingEnabled: false, maxTeamsTotal: Number.POSITIVE_INFINITY, maxTeamsPerSport: Number.POSITIVE_INFINITY, reason: 'DB_NOT_AVAILABLE' };
  }

  const enabled = await hasLicensingTables(knex);
  if (!enabled) {
    return { licensingEnabled: false, maxTeamsTotal: Number.POSITIVE_INFINITY, maxTeamsPerSport: Number.POSITIVE_INFINITY, reason: 'LICENSING_TABLES_MISSING' };
  }

  const activeLicenses = await getActiveLicensesForRoles(knex, userId, ['team_captain', 'club_admin']);

  if (!activeLicenses.length) {
    return {
      licensingEnabled: true,
      maxTeamsTotal: 1,
      maxTeamsPerSport: 1,
      source: 'free_default',
      roleLicenses: 0,
    };
  }

  let maxTeamsTotal = 1;
  let maxTeamsPerSport = 1;
  let hasExplicitPerSportLimit = false;

  for (const license of activeLicenses) {
    const limits = parseJsonField(license.limits) || {};
    const maxTeams = toNumberOrNull(limits.max_teams);
    const maxTeamsPerSportFromPlan = toNumberOrNull(limits.max_teams_per_sport);

    if (maxTeams != null && maxTeams > maxTeamsTotal) maxTeamsTotal = maxTeams;
    if (maxTeamsPerSportFromPlan != null && maxTeamsPerSportFromPlan > maxTeamsPerSport) {
      maxTeamsPerSport = maxTeamsPerSportFromPlan;
      hasExplicitPerSportLimit = true;
    }

    if (maxTeams == null) {
      if (license.role_name === 'club_admin') maxTeamsTotal = Math.max(maxTeamsTotal, 5);
      if (license.role_name === 'team_captain') maxTeamsTotal = Math.max(maxTeamsTotal, 1);
    }
  }

  if (!hasExplicitPerSportLimit) {
    maxTeamsPerSport = maxTeamsTotal;
  } else if (maxTeamsPerSport < 1) {
    maxTeamsPerSport = 1;
  }

  return {
    licensingEnabled: true,
    maxTeamsTotal,
    maxTeamsPerSport,
    source: 'active_team_licenses',
    roleLicenses: activeLicenses.length,
  };
}

async function getTournamentCreationAllowance(dbLike, userId) {
  const knex = resolveKnex(dbLike);
  if (!knex) {
    return { licensingEnabled: false, allowedConcurrentEvents: Number.POSITIVE_INFINITY, hasOrganizerLicense: false, reason: 'DB_NOT_AVAILABLE' };
  }

  const enabled = await hasLicensingTables(knex);
  if (!enabled) {
    return { licensingEnabled: false, allowedConcurrentEvents: Number.POSITIVE_INFINITY, hasOrganizerLicense: false, reason: 'LICENSING_TABLES_MISSING' };
  }

  const activeLicenses = await getActiveLicensesForRoles(knex, userId, ['league_organizer']);
  if (!activeLicenses.length) {
    return {
      licensingEnabled: true,
      hasOrganizerLicense: false,
      allowedConcurrentEvents: 0,
      source: 'no_organizer_license',
    };
  }

  let allowedConcurrentEvents = 0;
  for (const license of activeLicenses) {
    const limits = parseJsonField(license.limits) || {};
    const maxEvents = toNumberOrNull(limits.max_events);
    if (maxEvents != null && maxEvents > 0) {
      allowedConcurrentEvents += maxEvents;
    } else {
      allowedConcurrentEvents += 1;
    }
  }

  return {
    licensingEnabled: true,
    hasOrganizerLicense: true,
    allowedConcurrentEvents,
    source: 'active_organizer_licenses',
    roleLicenses: activeLicenses.length,
  };
}

module.exports = {
  getTeamCreationAllowance,
  getTournamentCreationAllowance,
};
