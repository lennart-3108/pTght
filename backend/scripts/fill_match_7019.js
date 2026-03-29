const users = [
  'leon.wagner+team@example.com',
  'finn.hoffmann+team@example.com',
  'elias.schuster+team@example.com',
  'paul.neumann+team@example.com',
  'luca.hartmann+team@example.com',
  'jonas.keller+team@example.com',
  'ben.vogt+team@example.com',
  'mats.kruger+team@example.com',
  'tom.richter+team@example.com',
];

const password = 'test1234';
const matchId = 7019;
const baseUrl = 'http://localhost:5001/api';

async function login(email) {
  const res = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.token;
}

async function main() {
  for (let index = 0; index < users.length; index += 1) {
    const token = await login(users[index]);
    const teamIndex = index < 4 ? 1 : 2;
    const res = await fetch(`${baseUrl}/matches/${matchId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ team_index: teamIndex }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`join failed for ${users[index]}: ${res.status} ${JSON.stringify(body)}`);
    }
  }

  const detailRes = await fetch(`${baseUrl}/matches/${matchId}`);
  const detail = await detailRes.json().catch(() => ({}));
  if (!detailRes.ok) {
    throw new Error(`detail failed: ${detailRes.status} ${JSON.stringify(detail)}`);
  }

  const participants = Array.isArray(detail.participants) ? detail.participants : [];
  const team1 = participants
    .filter((participant) => Number(participant.team_index) === 1)
    .map((participant) => participant.display_name || participant.user_id);
  const team2 = participants
    .filter((participant) => Number(participant.team_index) === 2)
    .map((participant) => participant.display_name || participant.user_id);

  console.log(JSON.stringify({
    matchId,
    joinedCount: participants.length,
    team1,
    team2,
  }, null, 2));
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
