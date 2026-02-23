#!/bin/bash
# update-dev-ip.sh
#
# Detecteert het huidige LAN IP-adres van de Mac en update
# DEV_SERVER_LAN_IP in src/services/xmpp.ts
#
# Gebruik:
#   ./scripts/update-dev-ip.sh
#
# Dit script wordt automatisch aangeroepen bij Prosody validatie.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
XMPP_FILE="$PROJECT_ROOT/src/services/xmpp.ts"

# Detecteer LAN IP (probeer meerdere interfaces)
detect_lan_ip() {
  local ip=""

  # Probeer en0 (WiFi op Mac)
  ip=$(ipconfig getifaddr en0 2>/dev/null)
  if [ -n "$ip" ]; then
    echo "$ip"
    return 0
  fi

  # Probeer en1 (alternatieve WiFi)
  ip=$(ipconfig getifaddr en1 2>/dev/null)
  if [ -n "$ip" ]; then
    echo "$ip"
    return 0
  fi

  # Probeer bridge100 (iPhone hotspot)
  ip=$(ipconfig getifaddr bridge100 2>/dev/null)
  if [ -n "$ip" ]; then
    echo "$ip"
    return 0
  fi

  # Fallback: eerste niet-localhost IP
  ip=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
  if [ -n "$ip" ]; then
    echo "$ip"
    return 0
  fi

  return 1
}

# Haal huidige IP uit xmpp.ts
get_current_ip() {
  grep "DEV_SERVER_LAN_IP = " "$XMPP_FILE" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+"
}

# Update IP in xmpp.ts
update_ip() {
  local new_ip="$1"
  sed -i '' "s/DEV_SERVER_LAN_IP = '[^']*'/DEV_SERVER_LAN_IP = '$new_ip'/" "$XMPP_FILE"
}

# Main
main() {
  if [ ! -f "$XMPP_FILE" ]; then
    echo "❌ xmpp.ts niet gevonden: $XMPP_FILE"
    exit 1
  fi

  local current_ip=$(get_current_ip)
  local new_ip=$(detect_lan_ip)

  if [ -z "$new_ip" ]; then
    echo "❌ Kon geen LAN IP detecteren"
    exit 1
  fi

  if [ "$current_ip" = "$new_ip" ]; then
    echo "✅ DEV_SERVER_LAN_IP is al correct: $current_ip"
    exit 0
  fi

  echo "🔄 IP wijziging gedetecteerd:"
  echo "   Oud: $current_ip"
  echo "   Nieuw: $new_ip"

  update_ip "$new_ip"

  if [ $? -eq 0 ]; then
    echo "✅ DEV_SERVER_LAN_IP bijgewerkt naar: $new_ip"
  else
    echo "❌ Kon xmpp.ts niet bijwerken"
    exit 1
  fi
}

main "$@"
