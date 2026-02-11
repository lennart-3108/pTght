#!/usr/bin/env bash
# Comprehensive Frontend Check - runs full build to catch all errors
# This is slower but catches all compilation issues
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

color() { local c="$1"; shift; case "$c" in green) echo -e "\033[32m$*\033[0m";; red) echo -e "\033[31m$*\033[0m";; yellow) echo -e "\033[33m$*\033[0m";; *) echo "$*";; esac; }

echo ""
color yellow "=== Frontend Build Check ==="
echo ""

cd "$ROOT_DIR/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  color yellow "Installing dependencies first..."
  npm ci || npm install
fi

# Run production build to catch all errors
color yellow "Running production build..."
echo ""

BUILD_OUTPUT=$(mktemp)
BUILD_STATUS=0

# Capture both stdout and stderr
if npm run build > "$BUILD_OUTPUT" 2>&1; then
  BUILD_STATUS=0
else
  BUILD_STATUS=$?
fi

# Show output
cat "$BUILD_OUTPUT"

# Cleanup
rm -f "$BUILD_OUTPUT"

echo ""
if [ $BUILD_STATUS -eq 0 ]; then
  color green "✓ Frontend build successful!"
  
  # Cleanup build folder
  if [ -d "build" ]; then
    color yellow "Cleaning up build folder..."
    rm -rf build
  fi
  
  exit 0
else
  color red "✗ Frontend build FAILED!"
  color red ""
  color red "This means there are syntax or compilation errors in the frontend code."
  color red "Please fix the errors shown above before deploying."
  exit 1
fi
