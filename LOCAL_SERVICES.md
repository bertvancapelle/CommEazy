# CommEazy Lokale Services

## Overzicht

| Service | Poort | Doel |
|---------|-------|------|
| Metro Bundler | 8081 | React Native JavaScript bundler |
| Prosody | 5280 | XMPP server (WebSocket) |
| Push Gateway | 3030 | FCM push notifications |

---

## 1. Metro Bundler (React Native)

**Start** (voor fysiek device op LAN):
```bash
cd /Users/bertvancapelle/Projects/CommEazy
npx react-native start --host 10.10.15.75
```

**Stop:** `Ctrl+C` in terminal

---

## 2. Prosody XMPP Server

**Start:**
```bash
/opt/homebrew/bin/prosody
```

**Stop:**
```bash
pkill -f prosody
```

**Status check:**
```bash
pgrep -l prosody
```

**Config locatie:**
```
/opt/homebrew/etc/prosody/prosody.cfg.lua
```

---

## 3. Push Gateway (FCM)

**Start:**
```bash
cd /Users/bertvancapelle/Projects/CommEazy/server/push-gateway
npm start
```

**Stop:** `Ctrl+C` in terminal

**Health check:**
```bash
curl http://localhost:3030/health
```

**Test push sturen:**
```bash
curl -X POST http://localhost:3030/test-push \
  -H "Content-Type: application/json" \
  -d '{"token": "FCM_TOKEN_HIER"}'
```

---

## Volledige Start Sequence

Open 3 terminal windows:

### Terminal 1 - Prosody
```bash
/opt/homebrew/bin/prosody
```

### Terminal 2 - Metro
```bash
cd /Users/bertvancapelle/Projects/CommEazy
npx react-native start --host 10.10.15.75
```

### Terminal 3 - Push Gateway
```bash
cd /Users/bertvancapelle/Projects/CommEazy/server/push-gateway
npm start
```

---

## Volledige Stop Sequence

```bash
# Stop Prosody
pkill -f prosody

# Metro en Push Gateway: Ctrl+C in hun terminals
```

---

## Quick Status Check

```bash
# Prosody draait?
pgrep -l prosody

# Metro draait? (check poort 8081)
lsof -i :8081

# Push Gateway draait? (check poort 3030)
curl -s http://localhost:3030/health
```

---

## Test Devices

| Device | User | JID |
|--------|------|-----|
| iPhone 17 Pro (simulator) | Ik | ik@commeazy.local |
| iPhone 16e (simulator) | Oma | oma@commeazy.local |
| iPhone 14 (fysiek) | Test | test@commeazy.local |

---

## Troubleshooting

### Metro kan device niet bereiken
- Check dat Mac en iPhone op hetzelfde WiFi netwerk zitten
- Mac IP moet 10.10.15.75 zijn (of pas aan in code)

### Prosody start niet
- Check of poort 5280 vrij is: `lsof -i :5280`
- Check config syntax: `/opt/homebrew/bin/prosodyctl check config`

### Push notifications komen niet aan
1. FCM token ophalen uit Metro logs: `[FCM] Device token (FULL): ...`
2. Test via gateway: `curl -X POST http://localhost:3030/test-push -H "Content-Type: application/json" -d '{"token": "TOKEN"}'`
3. Check iPhone Settings > CommEazyTemp > Notifications
