#!/bin/bash
#
# Start KNMI Proxy Server
#
# Starts the local proxy server for KNMI WMS API requests.
# The proxy adds the Authorization header that WebView/Leaflet cannot add.
#
# Usage:
#   ./scripts/knmi-proxy-start.sh
#

# Load nvm if available (for node/npm)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PROXY_DIR="$PROJECT_DIR/server/knmi-proxy"
PID_FILE="$PROXY_DIR/.proxy.pid"
LOG_FILE="$PROXY_DIR/proxy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           Starting KNMI Proxy Server                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Proxy is already running (PID: $OLD_PID)${NC}"
        echo "   Use ./scripts/knmi-proxy-stop.sh to stop it first"
        exit 1
    else
        # Stale PID file, remove it
        rm -f "$PID_FILE"
    fi
fi

# Check if node_modules exist
if [ ! -d "$PROXY_DIR/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd "$PROXY_DIR"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
    echo ""
fi

# Start the proxy in background
cd "$PROXY_DIR"
nohup node index.js > "$LOG_FILE" 2>&1 &
PROXY_PID=$!
echo "$PROXY_PID" > "$PID_FILE"

# Wait a moment and check if it's running
sleep 1

if ps -p "$PROXY_PID" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ KNMI Proxy started successfully${NC}"
    echo ""
    echo "   PID:      $PROXY_PID"
    echo "   Port:     3001"
    echo "   Log:      $LOG_FILE"
    echo ""
    echo "   Health:   http://localhost:3001/health"
    echo "   LAN:      http://10.10.15.75:3001/health"
    echo ""
    echo "   To stop:  ./scripts/knmi-proxy-stop.sh"
    echo ""
else
    echo -e "${RED}❌ Failed to start proxy${NC}"
    echo "   Check log: $LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
fi
