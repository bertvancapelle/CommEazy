#!/bin/bash
#
# Stop KNMI Proxy Server
#
# Stops the local proxy server for KNMI WMS API requests.
#
# Usage:
#   ./scripts/knmi-proxy-stop.sh
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PROXY_DIR="$PROJECT_DIR/server/knmi-proxy"
PID_FILE="$PROXY_DIR/.proxy.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           Stopping KNMI Proxy Server                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if PID file exists
if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}⚠️  No PID file found${NC}"
    echo "   Proxy may not be running"

    # Try to find and kill any running proxy
    RUNNING_PID=$(pgrep -f "node.*knmi-proxy" 2>/dev/null)
    if [ -n "$RUNNING_PID" ]; then
        echo "   Found running proxy (PID: $RUNNING_PID)"
        kill "$RUNNING_PID" 2>/dev/null
        echo -e "${GREEN}✅ Proxy stopped${NC}"
    fi
    exit 0
fi

# Read PID
PROXY_PID=$(cat "$PID_FILE")

# Check if process is running
if ps -p "$PROXY_PID" > /dev/null 2>&1; then
    echo "   Stopping proxy (PID: $PROXY_PID)..."
    kill "$PROXY_PID" 2>/dev/null

    # Wait for graceful shutdown
    sleep 1

    # Force kill if still running
    if ps -p "$PROXY_PID" > /dev/null 2>&1; then
        echo "   Force killing..."
        kill -9 "$PROXY_PID" 2>/dev/null
    fi

    echo -e "${GREEN}✅ KNMI Proxy stopped${NC}"
else
    echo -e "${YELLOW}⚠️  Proxy was not running (stale PID file)${NC}"
fi

# Remove PID file
rm -f "$PID_FILE"
echo ""
