#!/bin/bash
# Enhanced backend startup script for Match League
# Handles both test and production instances
# Install node_modules and start the backend

set -e
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Determine instance from command line argument or default to test
INSTANCE=${1:-test}
if [ "$INSTANCE" = "test" ]; then
  INSTANCE_DIR="/matchleague.org/test/backend"
  INSTANCE_PORT=5002
  INSTANCE_TYPE="test"
  LOG_DIR="/matchleague.org/test/logs"
elif [ "$INSTANCE" = "prod" ]; then
  INSTANCE_DIR="/matchleague.org/prod/backend"
  INSTANCE_PORT=5003
  INSTANCE_TYPE="production"
  LOG_DIR="/matchleague.org/prod/logs"
else
  echo "Usage: $0 [test|prod]"
  exit 1
fi

LOG_FILE="$LOG_DIR/backend.log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Log message function
log_msg() {
  echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

log_msg "=============================================="
log_msg "Starting Match League $INSTANCE backend..."
log_msg "Instance Directory: $INSTANCE_DIR"
log_msg "Instance Port: $INSTANCE_PORT"
log_msg "Instance Type: $INSTANCE_TYPE"

# Check if directory exists
if [ ! -d "$INSTANCE_DIR" ]; then
  log_msg "ERROR: Instance directory $INSTANCE_DIR does not exist!"
  exit 1
fi

cd "$INSTANCE_DIR"
log_msg "Working directory: $(pwd)"

# Check if package.json exists
if [ ! -f "package.json" ]; then
  log_msg "ERROR: package.json not found in $INSTANCE_DIR"
  exit 1
fi

# Install node_modules if not present
if [ ! -d "node_modules" ]; then
  log_msg "node_modules not found, installing dependencies..."
  npm install --production >> "$LOG_FILE" 2>&1 || {
    log_msg "ERROR: npm install failed"
    exit 1
  }
  log_msg "Dependencies installed successfully"
else
  log_msg "node_modules already exists, skipping install"
fi

# Kill any existing Node process on this port
log_msg "Checking for existing processes on port $INSTANCE_PORT..."
EXISTING_PID=$(lsof -ti:$INSTANCE_PORT 2>/dev/null || true)
if [ -n "$EXISTING_PID" ]; then
  log_msg "Found existing process $EXISTING_PID, killing it..."
  kill -9 $EXISTING_PID 2>/dev/null || true
  sleep 1
fi

# Start the backend
log_msg "Starting Node.js backend..."
PORT=$INSTANCE_PORT INSTANCE_TYPE=$INSTANCE_TYPE node server.js >> "$LOG_FILE" 2>&1 &
BACKEND_PID=$!

# Give it a moment to start
sleep 2

# Check if process is still running
if ps -p $BACKEND_PID > /dev/null; then
  log_msg "Backend started successfully (PID: $BACKEND_PID)"
else
  log_msg "ERROR: Backend failed to start. Check log: $LOG_FILE"
  exit 1
fi

log_msg "=============================================="
log_msg "Backend is running on port $INSTANCE_PORT"

# Keep the script running and monitor the process
while ps -p $BACKEND_PID > /dev/null; do
  sleep 60
done

log_msg "WARNING: Backend process $BACKEND_PID has stopped!"
