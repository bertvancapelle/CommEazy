# CommEazy Lokale Services

**Laatste update:** 27 februari 2026

## Overzicht

| Service | Poort | Doel | Status |
|---------|-------|------|--------|
| Metro Bundler | 8081 | React Native JavaScript bundler | Handmatig starten |
| Prosody XMPP | 5280 (WebSocket) | XMPP server — routing only, zero storage | `prosodyctl start` |
| Push Gateway | 5282 | VoIP Push (APNs) + Message Push (FCM) | `node server.js` |

---

## 1. Prosody XMPP Server

**Versie:** 13.0.4 (build from source)
**Installatie:** `/opt/homebrew/Cellar/prosody/13.0.4/`
**Config:** `/opt/homebrew/etc/prosody/prosody.cfg.lua`

### Commando's

```bash
prosodyctl start      # Start Prosody
prosodyctl stop       # Stop Prosody
prosodyctl status     # Check status
prosodyctl restart    # Herstart Prosody
prosodyctl shell      # Admin shell (debug)
```

### Custom Modules

Locatie: `/opt/homebrew/etc/prosody/modules/`

| Module | Doel |
|--------|------|
| `mod_push_http.lua` | Vangt `cloud_notify/push` events op en stuurt HTTP POST naar Push Gateway. Routeert op basis van push registration JID (`voip.push.*` → service=voip, `push.*` → service=fcm). |
| `mod_push_call_always.lua` | Bypassed mod_cloud_notify volledig voor inkomende call stanzas (`<call xmlns="urn:commeazy:call:1">`). Leest VoIP tokens uit cloud_notify store en stuurt HTTP POST direct naar Push Gateway. Nodig omdat mod_cloud_notify push overslaat wanneer de XMPP sessie "actief" is, en niet werkt zonder mod_offline/mod_mam. |

### Actieve Modules

```
disco, roster, saslauth, tls, blocklist, bookmarks, carbons, dialback,
limits, pep, private, smacks, vcard4, vcard_legacy, csi_simple, invites,
invites_adhoc, invites_register, ping, register, time, uptime, version,
cloud_notify, push_http, push_call_always,
admin_adhoc, admin_shell, bosh, websocket
```

### Kritieke Config Settings

```lua
-- Dead connection detection (60s i.p.v. default 840s)
network_settings = { read_timeout = 60 }

-- Session hibernation (30s i.p.v. default 300s)
smacks_hibernation_time = 30

-- Push Gateway endpoint
push_http_url = "http://127.0.0.1:5282/push"
push_http_secret = "commeazy-dev-push-secret-2024"

-- WebSocket op alle interfaces
http_ports = { 5280 }
http_interfaces = { "*" }
consider_websocket_secure = true

-- Domein
VirtualHost "commeazy.local"
```

### Test Accounts

```bash
prosodyctl adduser ik@commeazy.local       # Password: test123
prosodyctl adduser oma@commeazy.local      # Password: test123
prosodyctl adduser test@commeazy.local     # Password: test123
prosodyctl adduser jeanine@commeazy.local  # Password: test123
prosodyctl adduser ipad@commeazy.local     # Password: test123
```

---

## 2. Push Gateway (Node.js)

**Locatie:** `/Users/bertvancapelle/Projects/CommEazy/server/push-gateway/`
**Poort:** 5282 (gekozen om conflict met Prosody HTTPS 5281 te voorkomen)
**Config:** `.env` bestand in de push-gateway directory

### Commando's

```bash
# Start
cd /Users/bertvancapelle/Projects/CommEazy/server/push-gateway
node server.js

# Health check
curl http://127.0.0.1:5282/health

# Prometheus metrics
curl http://127.0.0.1:5282/metrics
```

### Push Routing Architectuur

De Push Gateway ontvangt HTTP POST requests van twee Prosody modules:

```
Pad 1: Berichten (mod_cloud_notify → mod_push_http → gateway)
  Prosody ontvangt bericht voor offline user
  → mod_cloud_notify genereert push event
  → mod_push_http vangt event op, bepaalt service uit push registration JID
  → HTTP POST naar :5282/push met { node, secret, type, service, jid }
  → Gateway routeert: service=fcm + type=message → FCM push

Pad 2: Inkomende calls (mod_push_call_always → gateway, bypassed cloud_notify)
  Prosody ontvangt call stanza (type=offer)
  → mod_push_call_always leest VoIP tokens uit cloud_notify store
  → HTTP POST naar :5282/push met { node, secret, type=call, service=voip, jid }
  → Gateway routeert: service=voip + type=call → APNs VoIP Push → PushKit → CallKit
```

### Push Types

| Conditie | Handler | Resultaat |
|----------|---------|-----------|
| `service=voip` + `type=call` | APNs VoIP Push | PushKit → CallKit belscherm |
| `service=fcm` + `type=message` | FCM data message | Notificatie banner |
| Andere combinaties | Geen actie (gelogd als debug) | — |

### Environment Variables (.env)

```bash
PORT=5282
HOST=127.0.0.1
LOG_LEVEL=debug
PUSH_SECRET=commeazy-dev-push-secret-2024    # Moet matchen met prosody.cfg.lua

# APNs VoIP Push
APNS_KEY_PATH=./keys/AuthKey_N3R8379HRZ.p8
APNS_KEY_ID=N3R8379HRZ
APNS_TEAM_ID=LKVEVZHQV2
APNS_BUNDLE_ID=org.reactjs.native.example.CommEazyTemp
APNS_ENVIRONMENT=development

# FCM (nog niet geconfigureerd)
# GOOGLE_APPLICATION_CREDENTIALS=./keys/firebase-service-account.json
```

### Dependencies

| Package | Versie | Doel |
|---------|--------|------|
| `express` | ^4.18.0 | HTTP server |
| `apns2` | ^12.2.0 | APNs VoIP Push (ESM, HTTP/2) |
| `firebase-admin` | ^12.0.0 | FCM push |
| `express-rate-limit` | ^7.0.0 | Rate limiting (100 req/s) |
| `dotenv` | ^16.4.0 | Environment variable loading |

---

## 3. Metro Bundler (React Native)

**Start** (voor zowel simulators als fysiek device op LAN):
```bash
cd /Users/bertvancapelle/Projects/CommEazy
npx react-native start --reset-cache --host 0.0.0.0 2>&1 | tee /tmp/metro.log
```

**Stop:** `Ctrl+C` in terminal

### Netwerk

| Interface | Adres | Wie gebruikt het |
|-----------|-------|------------------|
| Loopback | `127.0.0.1:8081` | Simulators (iPhone + iPad) |
| LAN | `10.10.15.75:8081` | Fysieke devices |

---

## Volledige Start Sequence

Open 3 terminal vensters:

### Terminal 1 — Prosody
```bash
prosodyctl start
prosodyctl status        # Verifieer: Running
lsof -i :5280 | head -3  # Verifieer: WebSocket luistert
```

### Terminal 2 — Push Gateway
```bash
cd /Users/bertvancapelle/Projects/CommEazy/server/push-gateway
node server.js
# Verwacht: "Push Gateway listening on 127.0.0.1:5282"
# Verwacht: "APNs client initialized (apns2)" of "APNs key not found"
```

### Terminal 3 — Metro
```bash
cd /Users/bertvancapelle/Projects/CommEazy
npx react-native start --reset-cache --host 0.0.0.0 2>&1 | tee /tmp/metro.log
```

Dan in Xcode: `Cmd+R` om de app te builden en te runnen.

---

## Volledige Stop Sequence

```bash
prosodyctl stop                     # Stop Prosody
# Metro en Push Gateway: Ctrl+C in hun terminals
```

---

## Quick Status Check

```bash
# Prosody draait?
prosodyctl status

# WebSocket luistert?
lsof -i :5280 | head -3

# Push Gateway draait?
curl -s http://127.0.0.1:5282/health | python3 -m json.tool

# Metro draait?
lsof -i :8081 | head -3
```

---

## Test Devices

| Device | User | JID | Type | iOS |
|--------|------|-----|------|-----|
| iPhone 17 Pro | Ik | ik@commeazy.local | Simulator | iOS 26 |
| iPhone 16e | Oma | oma@commeazy.local | Simulator | iOS 26 |
| iPad (any) | iPad | ipad@commeazy.local | Simulator | iOS 26 |
| iPhone 14 (Bert) | Test | test@commeazy.local | Fysiek | iOS 26.4 beta |
| iPhone (Jeanine) | Jeanine | jeanine@commeazy.local | Fysiek | iOS 26.3 |

---

## Troubleshooting

### Prosody start niet
```bash
lsof -i :5280              # Poort al in gebruik?
prosodyctl check config    # Config syntax fout?
```

### Push Gateway: "APNs key not found"
- Check of `.env` APNS_KEY_PATH correct is
- Check of het `.p8` bestand bestaat in `server/push-gateway/keys/`

### Push notifications komen niet aan
1. Check Push Gateway logs: zoek "VoIP push sent" of "VoIP push error"
2. Check Prosody logs (`*console`): zoek "push_call_always" entries
3. Verifieer VoIP push registratie: check `cloud_notify/*.dat` bestanden
4. Test directe push:
   ```bash
   curl -X POST http://127.0.0.1:5282/push \
     -H "Content-Type: application/json" \
     -d '{"node":"DEVICE_TOKEN","secret":"commeazy-dev-push-secret-2024","type":"call","service":"voip"}'
   ```

### Metro kan device niet bereiken
- Check dat Mac en device op hetzelfde WiFi netwerk zitten
- Mac IP moet `10.10.15.75` zijn (of pas aan in start commando)

### Prosody WebSocket verbinding mislukt
- Check of `consider_websocket_secure = true` in config staat
- Check of `http_interfaces = { "*" }` (niet alleen localhost)
