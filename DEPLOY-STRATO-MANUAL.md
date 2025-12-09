# Manual Deployment Guide - Strato Server Hotfix

## ⚠️ CRITICAL ISSUE FIXED
- Auto-creation of 36,000+ leagues every 60 seconds
- Missing DB columns causing 502 errors
- Frontend timeout issues

## 🔧 SSH Connection Info
```bash
Host: ssh.strato.de
User: rsftp_matchle
Path: /matchleague.org
```

## 📋 Deployment Steps

### Step 1: SSH to Server
```bash
ssh rsftp_matchle@ssh.strato.de
cd /matchleague.org
```

### Step 2: Pull Latest Code
```bash
git fetch origin
git checkout dev
git pull origin dev
```

**Verify:** Latest commit should be `c8ec507` with message "fix: Disable auto-creation of 36k+ leagues"

### Step 3: Backup Database
```bash
cd backend
cp sportsplatform.db sportsplatform.db.backup_$(date +%Y%m%d_%H%M%S)
ls -lh *.db*
```

### Step 4: Fix Database Schema (CRITICAL)
```bash
# Stop backend first!
pkill -f "node.*server.js"
sleep 2

# Add missing columns
sqlite3 sportsplatform.db <<'SQL'
ALTER TABLE assets ADD COLUMN indoor BOOLEAN DEFAULT 0;
ALTER TABLE assets ADD COLUMN supported_sports TEXT;
ALTER TABLE assets ADD COLUMN equipment TEXT;
ALTER TABLE assets ADD COLUMN amenities TEXT;
ALTER TABLE assets ADD COLUMN photos TEXT;
ALTER TABLE slots ADD COLUMN visibility TEXT DEFAULT 'public';
.quit
SQL
```

**If you get "duplicate column name" errors, that's OK - columns already exist**

### Step 5: Clean Up Auto-Generated Leagues
```bash
# Check current count
sqlite3 sportsplatform.db "SELECT COUNT(*) FROM leagues;"

# Delete Community leagues
sqlite3 sportsplatform.db <<'SQL'
DELETE FROM leagues WHERE name LIKE '%Liga%' OR name LIKE 'Community%';
VACUUM;
SELECT 'Remaining leagues:', COUNT(*) FROM leagues;
.quit
SQL
```

**Expected:** Should go from 20k-40k leagues down to 1-5 real leagues

### Step 6: Install Dependencies
```bash
cd /matchleague.org/backend
npm install --production

cd /matchleague.org/frontend  
npm install --production
```

### Step 7: Restart Backend
```bash
cd /matchleague.org/backend

# Stop old process
pkill -f "node.*server.js"
sleep 2

# Start new process (adjust PORT if needed)
nohup node server.js > server.log 2>&1 &

# Verify it's running
ps aux | grep "node.*server.js" | grep -v grep
```

### Step 8: Verify Deployment
```bash
# Check league count (should stay constant!)
watch -n 5 'sqlite3 /matchleague.org/backend/sportsplatform.db "SELECT COUNT(*) FROM leagues;"'
# Press Ctrl+C after 30 seconds - count should NOT increase

# Check logs
tail -50 /matchleague.org/backend/server.log

# Test API
curl http://localhost:5001/api/leagues?limit=5
```

### Step 9: Test Frontend (from your local machine)
```bash
# From your Mac:
curl https://matchleague.org/api/leagues?limit=5
open https://matchleague.org/leagues
```

## 🎯 Success Criteria

✅ Backend process running  
✅ No "SQLITE_ERROR: table assets has no column named indoor" in logs  
✅ League count stays constant (not increasing every 60s)  
✅ `/api/leagues` returns JSON (not 502)  
✅ Frontend `/leagues` page loads in <2 seconds  
✅ DB size reasonable (<10MB)  

## 🚨 Rollback Plan (if something breaks)

```bash
cd /matchleague.org/backend

# Stop backend
pkill -f "node.*server.js"

# Restore backup
ls -lt *.db* | head -5  # Find latest backup
cp sportsplatform.db.backup_YYYYMMDD_HHMMSS sportsplatform.db

# Rollback code
git checkout 7a5da4a  # Previous commit before hotfix

# Restart
nohup node server.js > server.log 2>&1 &
```

## 📊 What Changed

**server.js:**
- Disabled `ensureCommunityLeagues()` - was creating leagues every 60s
- Disabled `ensureTestLocation()` - was creating test data on startup
- Disabled `autoPairCommunity()` - not needed

**Database:**
- Added `assets.indoor` column (BOOLEAN)
- Added `assets.supported_sports` column (TEXT)
- Added `assets.equipment` column (TEXT)
- Added `assets.amenities` column (TEXT)
- Added `assets.photos` column (TEXT)
- Added `slots.visibility` column (TEXT)
- Removed 36,000+ auto-generated "Community Liga" entries

**Performance Impact:**
- DB size: 86MB → 3.4MB (after VACUUM)
- Leagues: 36,709 → 1
- API response: 502 errors → instant JSON
- Page load: timeout → <1 second

## 🔍 Monitoring After Deployment

Run this every 5 minutes for the first hour:
```bash
ssh rsftp_matchle@ssh.strato.de << 'ENDSSH'
echo "=== $(date) ==="
cd /matchleague.org/backend
echo "Leagues: $(sqlite3 sportsplatform.db 'SELECT COUNT(*) FROM leagues;')"
echo "DB size: $(du -h sportsplatform.db | cut -f1)"
echo "Backend: $(pgrep -f 'node.*server.js' && echo 'RUNNING' || echo 'STOPPED')"
echo ""
ENDSSH
```

If league count starts increasing → backend is still running old code!

## 📞 Support

If you encounter issues:
1. Check `backend/server.log` for error messages
2. Verify Git is on commit `c8ec507`
3. Confirm leagues are not auto-increasing
4. Test with: `curl http://localhost:5001/api/me`
