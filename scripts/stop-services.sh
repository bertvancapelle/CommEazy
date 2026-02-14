#!/bin/bash

# CommEazy - Stop All Local Services

echo "🛑 Stopping CommEazy services..."

# Stop Prosody
pkill -f prosody 2>/dev/null && echo "  ✓ Prosody stopped" || echo "  - Prosody was not running"

# Stop Metro (node process on port 8081)
lsof -ti :8081 | xargs kill 2>/dev/null && echo "  ✓ Metro stopped" || echo "  - Metro was not running"

# Stop Push Gateway (node process on port 3030)
lsof -ti :3030 | xargs kill 2>/dev/null && echo "  ✓ Push Gateway stopped" || echo "  - Push Gateway was not running"

echo ""
echo "✅ All services stopped"
