# 🚀 Quick Deploy Commands - Strato Server

## One-Liner Deployment
```bash
ssh rsftp_matchle@ssh.strato.de 'bash -s' < scripts/deploy-strato-hotfix.sh
```

## Step-by-Step (Copy-Paste Ready)

### 1️⃣ Connect & Update Code
```bash
ssh rsftp_matchle@ssh.strato.de
cd /matchleague.org
git fetch origin && git checkout dev && git pull origin dev
```

### 2️⃣ Backup & Fix DB
```bash
cd backend
pkill -f "node.*server.js"
cp sportsplatform.db sportsplatform.db.backup_$(date +%Y%m%d_%H%M%S)

sqlite3 sportsplatform.db "ALTER TABLE assets ADD COLUMN indoor BOOLEAN DEFAULT 0; ALTER TABLE assets ADD COLUMN supported_sports TEXT; ALTER TABLE assets ADD COLUMN equipment TEXT; ALTER TABLE assets ADD COLUMN amenities TEXT; ALTER TABLE assets ADD COLUMN photos TEXT; ALTER TABLE slots ADD COLUMN visibility TEXT DEFAULT 'public';"
```

### 3️⃣ Clean Leagues
```bash
sqlite3 sportsplatform.db "DELETE FROM leagues WHERE name LIKE '%Liga%' OR name LIKE 'Community%'; VACUUM; SELECT COUNT(*) FROM leagues;"
```

### 4️⃣ Restart
```bash
cd /matchleague.org/backend
npm install --production
nohup node server.js > server.log 2>&1 &
ps aux | grep "node.*server.js" | grep -v grep
```

### 5️⃣ Verify (30 seconds)
```bash
sleep 30
sqlite3 sportsplatform.db "SELECT COUNT(*) FROM leagues;"  # Should NOT increase!
curl http://localhost:5001/api/leagues?limit=5
```

## 🎯 Expected Results
- Leagues: 1-5 (not 36,000+)
- DB: 3-5 MB (not 86MB)
- API: JSON response (not 502)
- Logs: No "indoor" errors

## 🆘 If Something Breaks
```bash
cd /matchleague.org/backend
pkill -f "node.*server.js"
cp sportsplatform.db.backup_* sportsplatform.db
git checkout 7a5da4a
nohup node server.js > server.log 2>&1 &
```

---
**Full guide:** See `DEPLOY-STRATO-MANUAL.md`
