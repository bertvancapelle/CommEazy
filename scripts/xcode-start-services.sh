#!/bin/bash

# CommEazy - Xcode Pre-Build Script
# Starts services only if they're not already running

PROJECT_DIR="/Users/bertvancapelle/Projects/CommEazy"

# Function to check if a port is in use
port_in_use() {
    lsof -i :$1 > /dev/null 2>&1
}

# Function to check if prosody is running
prosody_running() {
    pgrep -f prosody > /dev/null 2>&1
}

# Start Prosody if not running
if ! prosody_running; then
    osascript -e "
    tell application \"Terminal\"
        activate
        do script \"echo '=== PROSODY XMPP SERVER ===' && /opt/homebrew/bin/prosody\"
    end tell
    " &
    echo "Started Prosody"
else
    echo "Prosody already running"
fi

# Start Metro if not running (port 8081)
if ! port_in_use 8081; then
    osascript -e "
    tell application \"Terminal\"
        do script \"echo '=== METRO BUNDLER ===' && cd $PROJECT_DIR && npx react-native start --host 10.10.15.75\"
    end tell
    " &
    echo "Started Metro"
else
    echo "Metro already running on port 8081"
fi

# Start Push Gateway if not running (port 3030)
if ! port_in_use 3030; then
    osascript -e "
    tell application \"Terminal\"
        do script \"echo '=== PUSH GATEWAY ===' && cd $PROJECT_DIR/server/push-gateway && npm start\"
    end tell
    " &
    echo "Started Push Gateway"
else
    echo "Push Gateway already running on port 3030"
fi

exit 0
