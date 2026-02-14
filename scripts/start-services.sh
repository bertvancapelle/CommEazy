#!/bin/bash

# CommEazy - Start All Local Services
# Opens each service in a separate Terminal window for visibility

PROJECT_DIR="/Users/bertvancapelle/Projects/CommEazy"

echo "🚀 Starting CommEazy services..."

# Terminal 1: Prosody XMPP Server
osascript -e "
tell application \"Terminal\"
    activate
    do script \"echo '=== PROSODY XMPP SERVER ===' && /opt/homebrew/bin/prosody\"
    set custom title of front window to \"Prosody XMPP\"
end tell
"

# Wait a moment before starting next service
sleep 2

# Terminal 2: Metro Bundler
osascript -e "
tell application \"Terminal\"
    do script \"echo '=== METRO BUNDLER ===' && cd $PROJECT_DIR && npx react-native start --host 10.10.15.75\"
    set custom title of front window to \"Metro Bundler\"
end tell
"

# Wait a moment before starting next service
sleep 2

# Terminal 3: Push Gateway
osascript -e "
tell application \"Terminal\"
    do script \"echo '=== PUSH GATEWAY ===' && cd $PROJECT_DIR/server/push-gateway && npm start\"
    set custom title of front window to \"Push Gateway\"
end tell
"

echo ""
echo "✅ All services started in separate Terminal windows"
echo ""
echo "Services:"
echo "  - Prosody XMPP:   port 5280"
echo "  - Metro Bundler:  port 8081 (host 10.10.15.75)"
echo "  - Push Gateway:   port 3030"
echo ""
echo "To stop: Close each Terminal window or run ./stop-services.sh"
