# League & Team Module - V1 Implementation Summary

## Status: ✅ Production Ready

Date: 7. Dezember 2025

---

## Backend Endpoints - Complete ✓

### LEAGUES API (`/api/leagues`)

#### Public Endpoints
- ✅ `GET /api/leagues` - List all active leagues with city/sport info
- ✅ `GET /api/leagues/:id` - League detail with metadata
- ✅ `GET /api/leagues/:id/standings` - Standings table (supports `?format=table&seasonId=X`)
- ✅ `GET /api/leagues/:id/games` - Upcoming & completed matches
- ✅ `GET /api/leagues/:id/teams` - Teams list with members
- ✅ `GET /api/leagues/:id/members` - League members list
- ✅ `GET /api/leagues/:id/seasons` - Available seasons

#### Authenticated Endpoints
- ✅ `POST /api/leagues/:id/join` - Join league (auto-match pairing)
- ✅ `POST /api/leagues/:id/leave` - Leave league
- ✅ `GET /api/leagues/:id/my-open-match` - User's open match
- ✅ `GET /api/leagues/:id/my-weekly-status` - Weekly match status
- ✅ `POST /api/leagues/:id/match-search` - Manual match pairing

### TEAMS API (`/api/teams`)

#### Public Endpoints
- ✅ `GET /api/teams` - List teams (filters: `?league_id=X&sport_id=Y&city_id=Z`)
- ✅ `GET /api/teams/:id` - Team detail with members list
- ✅ `GET /api/teams/:id/rosters` - Match rosters history

#### Authenticated Endpoints
- ✅ `POST /api/teams` - Create team (requires: `name`, `league_id`)
- ✅ `POST /api/teams/:id/members` - Add member (captain/co-captain only)
- ✅ `DELETE /api/teams/:id/members` - Remove member (captain/co-captain only)
- ✅ `POST /api/teams/:id/members/:user_id/promote` - Make co-captain
- ✅ `POST /api/teams/:id/members/:user_id/demote` - Remove co-captain flag
- ✅ `POST /api/teams/:id/roster` - Submit match roster (validates team size)
- ✅ `DELETE /api/teams/:id` - Delete team (primary captain/admin only)

---

## Frontend Pages - Complete ✓

### League Pages

#### **LeaguesPage** (`/leagues`)
- **Purpose**: Browse all available leagues
- **Features**:
  - Filter by city, sport, search query
  - "My Leagues" toggle for authenticated users
  - Auto-selects user's city on load
  - Displays member counts per league
  - Links to league detail page
- **Route**: `/leagues` (also `/ligen` for DE)

#### **LeagueDetailPage** (`/league/:leagueId`)
- **Purpose**: View league details and participate
- **Features**:
  - League metadata (name, sport, city)
  - **Join League** button (auto-match pairing on join)
  - **Tabs/Sections**:
    - **Overview**: Basic info, join button
    - **Standings**: Table with W/D/L/Points (season filter)
    - **Matches**: Upcoming & completed games
    - **Teams**: All teams with member lists
  - **Authenticated Actions**:
    - Join/Leave league
    - Create team button
    - Link to team management (if captain)
    - View/propose matches
- **Route**: `/league/:leagueId`

### Team Pages

#### **TeamsPage** (`/teams`)
- **Purpose**: Browse teams across all leagues
- **Features**:
  - Filter by league, sport, city
  - Display member counts
  - Links to team detail page
- **Route**: `/teams`

#### **CreateTeamPage** (`/teams/create`)
- **Purpose**: Create new team
- **Features**:
  - Form: name, league selection, sport, city
  - Auto-adds creator as captain
  - Redirects to team detail after creation
- **Route**: `/teams/create`

#### **TeamDetailPage** (`/teams/:id`)
- **Purpose**: Team management and roster submission
- **Features**:
  - Team name, league, sport info
  - **Members List**:
    - Display all members with avatars
    - Show captain badges
  - **Captain Actions** (primary + co-captains):
    - Add/remove members
    - Promote/demote co-captains
    - Submit match rosters
  - **Roster Submission**:
    - Select match from dropdown
    - Assign roles: Starter, Sub, Reserve
    - Client-side validation (team size + subs)
    - Submit to `/api/teams/:id/roster`
- **Route**: `/teams/:id`

---

## App.js Routes - Registered ✓

```javascript
// Public routes
<Route path="/leagues" element={<LeaguesPage />} />
<Route path="/ligen" element={<LeaguesPage />} />
<Route path="/league/:leagueId" element={<LeagueDetailPage />} />

// Team routes
<Route path="/teams" element={<TeamsPage />} />
<Route path="/teams/create" element={<CreateTeamPage />} />
<Route path="/teams/:id" element={<TeamDetailPage />} />
```

---

## User Flow

### 1. Browse Leagues
**User Path**: `/ → /leagues`

1. User visits **LeaguesPage** (`/leagues`)
2. Filters by city/sport (optional)
3. Sees list of all leagues with:
   - League name, sport, city
   - Member count
   - Link to detail page

### 2. Join League & Auto-Match
**User Path**: `/leagues → /league/:id → Join`

1. User clicks league → **LeagueDetailPage** (`/league/:id`)
2. Views:
   - League overview (sport, city, metadata)
   - Standings table (W/D/L/Points)
   - Matches (upcoming & completed)
   - Teams in league
3. **Authenticated User**:
   - Clicks **"Join League"** button
   - Backend auto-pairs with open opponent OR creates open match
   - User immediately assigned to a match (1v1) or team match
4. User can now:
   - View their match in "Matches" tab
   - Create/join a team
   - View standings

### 3. Create Team
**User Path**: `/league/:id → Create Team → /teams/create`

1. From **LeagueDetailPage**, authenticated user clicks **"Create Team"**
2. Redirected to **CreateTeamPage** (`/teams/create`)
3. Fills form:
   - Team name (required)
   - League selection (pre-filled from context)
   - Sport, city (optional)
4. Submits → `POST /api/teams`
5. Redirected to **TeamDetailPage** (`/teams/:id`)
6. User is now **Primary Captain** of the team

### 4. Manage Team
**User Path**: `/teams/:id`

1. Captain visits **TeamDetailPage** (`/teams/:id`)
2. Views:
   - Team name, sport, league
   - All team members (with captain badges)
3. **Captain Actions**:
   - **Add Member**: Enter user ID → `POST /api/teams/:id/members`
   - **Remove Member**: Click remove → `DELETE /api/teams/:id/members`
   - **Promote to Co-Captain**: Click promote → `POST /api/teams/:id/members/:user_id/promote`
   - **Demote Co-Captain**: Click demote → `POST /api/teams/:id/members/:user_id/demote`
4. **Submit Match Roster**:
   - Select match from dropdown (from league's matches)
   - Assign roles to members:
     - **Starter**: Max = team size (e.g., 11 for football)
     - **Sub**: Up to substitutes limit (e.g., 7)
     - **Reserve**: Additional players
   - Client validates counts before submission
   - Submit → `POST /api/teams/:id/roster`
   - Success: Roster saved, can view in `/api/teams/:id/rosters`

### 5. View Standings & Matches
**User Path**: `/league/:id → Standings/Matches tabs`

1. User views **Standings** tab:
   - Table with: Rank, Name, Played, Won, Drawn, Lost, GF, GA, GD, Points
   - Season filter dropdown (if multiple seasons exist)
   - Can switch between "Current Season" and "Overall"
2. User views **Matches** tab:
   - **Upcoming**: Matches without scores
   - **Completed**: Matches with final scores
   - Displays home vs away, kickoff time, location

---

## Error Handling

### 401 Unauthorized
- **Trigger**: Invalid/expired JWT token
- **Action**: Redirect to `/login` with message "Deine Sitzung ist abgelaufen. Bitte erneut einloggen."
- **Implementation**: Global fetch wrapper in `App.js` via `NavigationGuard` component

### 403 Forbidden
- **Trigger**: User tries captain-only action without permission
- **Action**: Display error message "Keine Berechtigung" or "FORBIDDEN"
- **Example**: Non-captain tries to add team member

### 404 Not Found
- **Trigger**: League/team doesn't exist
- **Action**: Display "Liga nicht gefunden" or "Team nicht gefunden"
- **Fallback**: Show empty state with link back to list page

### 400 Bad Request
- **Trigger**: Missing required fields, invalid data
- **Action**: Display validation error messages
- **Examples**:
  - "MISSING_FIELDS" → "Name und Liga erforderlich"
  - "TOO_MANY_STARTERS" → "Zu viele Starter: X (erlaubt: Y)"
  - "ALREADY_MEMBER" → "Bereits Mitglied"

---

## Database Schema

### Core Tables
- ✅ `leagues` - League metadata (name, sport_id, city_id, publicState, joinPolicy)
- ✅ `seasons` - Seasons per league (name, start_date, end_date)
- ✅ `user_leagues` - User-league membership (user_id, league_id, joined_at)
- ✅ `user_seasons` - User-season enrollment (user_id, season_id)
- ✅ `matches` - Matches (league_id, season_id, home_user_id, away_user_id, home_team_id, away_team_id, scores, status)
- ✅ `teams` - Teams (name, league_id, sport_id, city_id, captain_user_id)
- ✅ `team_members` - Team membership (team_id, user_id, is_captain)
- ✅ `team_match_rosters` - Roster submissions (team_id, match_id, created_by)
- ✅ `team_roster_players` - Roster players (roster_id, user_id, role, shirt_number)
- ✅ `sports` - Sports metadata (name, team_size, substitutes, win_points, draw_points, loss_points)
- ✅ `cities` - Cities for filtering

### Migrations Applied
- All league/team/season migrations executed successfully
- Defensive column checks in place (columnInfo guards)
- Supports both SQLite and PostgreSQL

---

## Build Status

### Frontend Build
```bash
npm run build
```
**Result**: ✅ **Compiled successfully with warnings** (only unused vars, no errors)

### Backend Server
```bash
PORT=5001 node backend/server.js
```
**Result**: ✅ **Running on http://localhost:5001**

### Database
**Active File**: `backend/sportplattform.db`
**Migrations**: 37 applied (batches 1-6)
**Tables**: All league/team tables present and aligned

---

## Key Features Implemented

### Backend
1. ✅ Auto-match pairing on league join
2. ✅ Season-based standings filtering
3. ✅ Team size validation in roster submissions
4. ✅ Captain/co-captain permission system
5. ✅ Defensive column checks (no crashes on missing columns)
6. ✅ JWT authentication with global 401 handling

### Frontend
1. ✅ Dynamic city/sport filtering with normalization
2. ✅ Responsive design (mobile-first with `useResponsive` hook)
3. ✅ Real-time member counts and standings
4. ✅ Avatar components for user display
5. ✅ Global 401 handling with NavigationGuard
6. ✅ Client-side roster validation before submission

---

## Testing Checklist

### Manual Test Scenarios

#### League Flow
- [x] Browse leagues at `/leagues`
- [x] Filter by city and sport
- [x] View league detail at `/league/:id`
- [x] Join league as authenticated user
- [x] View auto-created match in "Matches" tab
- [x] View standings table with season filter
- [x] Leave league

#### Team Flow
- [x] Create team from league detail page
- [x] Add members as captain
- [x] Promote member to co-captain
- [x] Demote co-captain
- [x] Remove member from team
- [x] Submit match roster with role assignments
- [x] View roster history

#### Error Scenarios
- [x] Attempt captain action without permission → 403
- [x] Access non-existent league → 404
- [x] Try to add member twice → "ALREADY_MEMBER"
- [x] Submit roster with too many starters → validation error
- [x] Expired JWT → redirect to login

---

## Production Readiness

### ✅ Complete
- All required endpoints implemented and tested
- Frontend pages compile and render correctly
- Error handling in place
- Database migrations applied
- JWT authentication working
- Global 401 handling prevents stale tokens

### ⚠️ Optional Enhancements (V2)
- Unit tests for critical endpoints
- E2E tests with Playwright/Cypress
- Rate limiting on API endpoints
- Email notifications on match pairing
- Team logo uploads
- Match result submission UI
- League creation UI for admins
- Advanced statistics dashboard

---

## Deployment Notes

### Frontend
```bash
cd frontend
npm run build
# Serve build/ folder with nginx or serve -s build
```

### Backend
```bash
cd backend
PORT=5001 SQLITE_FILE=backend/sportplattform.db node server.js
# Or use PM2: pm2 start server.js --name pTght-api
```

### Environment Variables
```env
# backend/.env
PORT=5001
SQLITE_FILE=/path/to/backend/sportplattform.db
JWT_SECRET=your-secret-here
SESSION_EPOCH=1
```

---

## Summary

**Status**: ✅ **V1 Production Ready**

The League & Team module is fully functional and ready for user testing. All core features are implemented:
- Users can browse, join, and leave leagues
- Auto-match pairing creates 1v1 matches on join
- Users can create teams and manage members
- Captains can submit match rosters with role validation
- Standings tables show W/D/L/Points with season filtering
- Error handling ensures smooth UX with invalid tokens or permissions

**Next Steps**: Deploy to staging environment and conduct user acceptance testing.
