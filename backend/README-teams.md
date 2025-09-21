Teams & Rosters API

This file documents the Teams and roster endpoints added to the backend and how to run the provided smoke test.

Main endpoints

- POST /teams
  - Create a new team. Request body: { name, league_id, sport_id }
  - Requires authentication. The creating user becomes the team's captain by default.

- GET /teams/:id
  - Returns team details including members (array `members` with user display information when available).

- POST /teams/:id/members
  - Add a member to the team. Body: { user_id }
  - Only allowed for the team captain or an admin.

- DELETE /teams/:id/members
  - Remove a member from the team. Body: { user_id }
  - Only allowed for the team captain or an admin.

- POST /teams/:id/roster
  - Submit (create/replace) a roster for a match for the team.
  - Body: { match_id, players: [{ user_id, role }] }
  - Validation rules enforced by server:
    - role must be one of 'starter', 'sub', 'reserve'
    - number of starters must match the sport's team_size (fallback 11)
    - total players (starters+subs) must not exceed team_size + substitutes (substitutes from sports.substitutes or 5 fallback)
    - caller must be team captain or admin

User search (autocomplete)

- GET /users?search=term
  - Returns up to 20 matching users with fields: id, firstname, lastname, email, displayName
  - Used by the frontend autocomplete to add members by selecting a user.

Smoke test (Node)

A small Node script is provided to run a smoke flow: login, create a team, add a member, submit a roster.

Run:

  node backend/test/smoke-teams.js --email admin@example.com --password secret

The script expects the backend to be running at http://localhost:5001 by default. You can override the API base by setting API_BASE env var.


Notes & caveats

- The server uses sqlite; migrations must be applied to the active DB file (typically ./sportplattform.db). See knexfile.js for configuration.
- The frontend includes a small UserSearch component that queries /users?search= and returns a select list. It is used in `frontend/src/components/TeamForm.js`.

