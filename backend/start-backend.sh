#!/bin/bash
# Auto-startup script for Match League test backend
# Installs dependencies and starts server

set -e

INSTANCE_DIR="/matchleague.org/test/backend"
LOG_FILE="/var/log/matchleague-test.log"

echo "$(date): Starting Match League test backend..." >> $LOG_FILE

cd $INSTANCE_DIR

# Install dependencies
echo "$(date): Installing dependencies..." >> $LOG_FILE
npm install --production >> $LOG_FILE 2>&1

# Start backend
echo "$(date): Starting Node.js server..." >> $LOG_FILE
PORT=5002 INSTANCE_TYPE=test node server.js >> $LOG_FILE 2>&1 &

echo "$(date): Backend started (PID: $!)" >> $LOG_FILE
