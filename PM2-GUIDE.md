# PM2 Process Management Guide

## Installation

```bash
# On server
npm install -g pm2
```

## Start All Instances

```bash
cd /matchleague.org
pm2 start ecosystem.config.json
```

## Management Commands

### Status
```bash
pm2 status
pm2 list
```

Expected output:
```
┌─────┬────────────────────┬─────────────┬─────────┬─────────┬──────────┐
│ id  │ name               │ mode        │ ↺       │ status  │ cpu      │
├─────┼────────────────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0   │ matchleague-dev    │ fork        │ 0       │ online  │ 0%       │
│ 1   │ matchleague-test   │ fork        │ 0       │ online  │ 0%       │
│ 2   │ matchleague-prod   │ fork        │ 0       │ online  │ 0%       │
└─────┴────────────────────┴─────────────┴─────────┴─────────┴──────────┘
```

### Logs
```bash
# All instances
pm2 logs

# Specific instance
pm2 logs matchleague-test
pm2 logs matchleague-prod

# Last 100 lines
pm2 logs --lines 100

# Stop logging
CTRL + C
```

### Restart
```bash
# Single instance
pm2 restart matchleague-test
pm2 restart matchleague-prod

# All instances
pm2 restart all
```

### Stop
```bash
pm2 stop matchleague-test
pm2 stop matchleague-prod
pm2 stop all
```

### Reload (Zero-downtime)
```bash
pm2 reload matchleague-test
pm2 reload matchleague-prod
```

### Delete
```bash
pm2 delete matchleague-test
pm2 delete all
```

## Monitoring

```bash
# Real-time monitoring dashboard
pm2 monit

# Detailed info
pm2 show matchleague-test
pm2 show matchleague-prod
```

## Startup Script (Auto-start after reboot)

```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save

# Restore saved processes
pm2 resurrect
```

## Deployment Integration

Update deployment scripts to use PM2:

### deploy-test-instance.sh
```bash
# Instead of:
# PORT=5002 nohup node server.js > logs/test-server.log 2>&1 &

# Use:
pm2 restart matchleague-test || pm2 start ecosystem.config.json --only matchleague-test
```

### deploy-prod-instance.sh
```bash
pm2 restart matchleague-prod || pm2 start ecosystem.config.json --only matchleague-prod
```

## Useful Commands

```bash
# CPU & Memory usage
pm2 list --watch

# Flush logs
pm2 flush

# Update PM2
npm install -g pm2
pm2 update

# Environment info
pm2 info matchleague-test
```

## Benefits vs nohup

✅ Auto-restart on crash  
✅ Log management built-in  
✅ Zero-downtime reload  
✅ Process monitoring  
✅ Startup script generation  
✅ Easy multi-instance management  
✅ Memory limit enforcement  

## Troubleshooting

### Process won't start
```bash
pm2 logs matchleague-test --err
```

### High memory usage
```bash
pm2 list
# Check memory column
# If near limit, restart:
pm2 restart matchleague-test
```

### Check if PM2 is running
```bash
pm2 ping
# Should respond: pong
```
