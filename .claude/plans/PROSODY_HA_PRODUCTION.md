# CommEazy — Prosody XMPP Server: High Availability Productie-Architectuur

**Document versie:** 1.0
**Datum:** 27 februari 2026
**Status:** CONCEPT — Vereist validatie vóór productie-deployment
**Auteur:** Claude Opus 4 (AI Architect) + Bert van Capelle

---

## Inhoudsopgave

1. [Management Samenvatting](#1-management-samenvatting)
2. [Huidige Development Configuratie](#2-huidige-development-configuratie)
3. [Productie-Architectuur Overzicht](#3-productie-architectuur-overzicht)
4. [Infrastructuur Topologie](#4-infrastructuur-topologie)
5. [Prosody Cluster Configuratie](#5-prosody-cluster-configuratie)
6. [Database Backend](#6-database-backend)
7. [Load Balancing & Reverse Proxy](#7-load-balancing--reverse-proxy)
8. [TLS/SSL Certificaten](#8-tlsssl-certificaten)
9. [WebSocket Configuratie](#9-websocket-configuratie)
10. [Authenticatie & Autorisatie](#10-authenticatie--autorisatie)
11. [Connection Management & Presence](#11-connection-management--presence)
12. [Push Notifications (cloud_notify)](#12-push-notifications-cloud_notify)
13. [STUN/TURN (Coturn) voor WebRTC](#13-stunturn-coturn-voor-webrtc)
14. [Monitoring & Observability](#14-monitoring--observability)
15. [Security Hardening](#15-security-hardening)
16. [Capaciteitsplanning](#16-capaciteitsplanning)
17. [Disaster Recovery & Backup](#17-disaster-recovery--backup)
18. [Deployment Strategie](#18-deployment-strategie)
19. [Migratie: Development → Productie](#19-migratie-development--productie)
20. [Productie Validatie Checklist](#20-productie-validatie-checklist)
21. [Appendix A: Volledige Productie prosody.cfg.lua](#appendix-a-volledige-productie-prosodycfglua)
22. [Appendix B: Development vs Productie Vergelijking](#appendix-b-development-vs-productie-vergelijking)
23. [Appendix C: Troubleshooting Guide](#appendix-c-troubleshooting-guide)

---

## 1. Management Samenvatting

CommEazy gebruikt Prosody als XMPP-server voor real-time messaging, presence management en call signaling. De server fungeert als **pure router** — berichten worden doorgestuurd maar nooit opgeslagen (zero server storage architectuur).

**Doelstellingen:**
- Schaalbaar tot **100.000+ gelijktijdige verbindingen**
- **99.9% uptime** (max 8.7 uur downtime per jaar)
- **< 100ms** bericht-latentie (P99)
- **< 90 seconden** presence detectie bij dode verbindingen
- **Zero message storage** op de server (privacy-first)

**Kernbeslissingen:**
- Prosody 13.0.4 (build from source op macOS; minimaal 13.0.x voor mod_smacks hibernation watchdog fix)
- PostgreSQL als shared storage backend (roster, auth)
- HAProxy als WebSocket-aware load balancer
- Coturn cluster voor STUN/TURN (WebRTC calls)
- Prometheus + Grafana voor monitoring

---

## 2. Huidige Development Configuratie

### Omgeving

| Aspect | Waarde |
|--------|--------|
| **Prosody versie** | 13.0.4 (build from source, zie sectie 2a) |
| **OS** | macOS (Apple Silicon) |
| **Locatie** | `/opt/homebrew/etc/prosody/prosody.cfg.lua` |
| **Binaries** | `/opt/homebrew/Cellar/prosody/13.0.4/bin/prosodyctl` (symlinked) |
| **Storage** | `internal` (flat files) |
| **Authenticatie** | `internal_plain` |
| **VirtualHosts** | `localhost`, `commeazy.local` |
| **Transport** | WebSocket op poort 5280 (HTTP) |
| **TLS** | Geen (development) |
| **Accounts** | Handmatig via `prosodyctl adduser` |

### Actieve Modules (Development)

```
disco, roster, saslauth, tls, blocklist, bookmarks, carbons, dialback,
limits, pep, private, smacks, vcard4, vcard_legacy, csi_simple, invites,
invites_adhoc, invites_register, ping, register, time, uptime, version,
cloud_notify, admin_adhoc, admin_shell, bosh, websocket
```

### 2a. Prosody 13.0.4 Build from Source (macOS)

Prosody 0.12.1 (Homebrew) had een kritieke bug: mod_smacks hibernation watchdog werkte niet correct,
waardoor dode sessies nooit werden opgeruimd. Prosody 13.0.4 lost dit op.

**Waarom build from source?** Homebrew had alleen 0.12.1 beschikbaar. De 13.x branch is een major
upgrade met breaking changes (o.a. `cross_domain_websocket` verwijderd).

**Build stappen (uitgevoerd 27 feb 2026):**

```bash
# 1. Dependencies
brew install lua@5.4 luarocks openssl@3

# 2. Download en build
cd /tmp
wget https://prosody.im/downloads/source/prosody-13.0.4.tar.gz
tar xzf prosody-13.0.4.tar.gz
cd prosody-13.0.4

# 3. Configure met macOS-specifieke paden
./configure \
  --ostype=macosx \
  --prefix=/opt/homebrew/Cellar/prosody/13.0.4 \
  --sysconfdir=/opt/homebrew/etc/prosody \
  --datadir=/opt/homebrew/var/lib/prosody \
  --with-lua=/opt/homebrew/opt/lua@5.4 \
  --with-lua-include=/opt/homebrew/opt/lua@5.4/include/lua5.4 \
  --cflags="-I/opt/homebrew/opt/openssl@3/include" \
  --ldflags="-L/opt/homebrew/opt/openssl@3/lib"

# 4. Patch Makefile voor macOS (geen -lrt, geen -ldl)
#    macOS gebruikt libSystem in plaats van librt/libdl
sed -i '' 's/-lrt//g; s/-ldl//g' Makefile

# 5. Build en install
make
make install

# 6. Symlink prosodyctl
ln -sf /opt/homebrew/Cellar/prosody/13.0.4/bin/prosodyctl /opt/homebrew/bin/prosodyctl

# 7. LuaRocks dependencies (onder Prosody's eigen tree)
luarocks --lua-dir=/opt/homebrew/opt/lua@5.4 install luasocket
luarocks --lua-dir=/opt/homebrew/opt/lua@5.4 install luaexpat
luarocks --lua-dir=/opt/homebrew/opt/lua@5.4 install luasec
luarocks --lua-dir=/opt/homebrew/opt/lua@5.4 install luafilesystem
```

**Config wijzigingen voor 13.0.x:**
- `cross_domain_websocket` verwijderd (deprecated, veroorzaakt warning)
- `prosodyctl_service_warnings = false` toegevoegd (geen systemd op macOS)

**Verificatie:**
```bash
prosodyctl about       # Toont versie 13.0.4
prosodyctl status      # Draait op PID
lsof -i :5280         # WebSocket luistert
```

### Lessons Learned (Development)

| Probleem | Ontdekking | Oplossing |
|----------|-----------|-----------|
| Presence blijft "away" na force-quit | Feb 2026 | `network_settings.read_timeout = 60` (was 840s default) |
| `c2s_timeout` doet NIET wat je denkt | Feb 2026 | Is alleen pre-auth timeout; `read_timeout` is de echte dead connection timer |
| `smacks_hibernation_time` default te lang | Feb 2026 | Verlaagd naar 30s (was 300s default) |
| Presence stanzas zonder `from` attribuut | Feb 2026 | Silently ignore in client-side handler |
| `cross_domain_websocket` deprecated in 13.x | Feb 2026 | Verwijderd uit config (was warning in logs) |
| mod_smacks hibernation watchdog bug (0.12.1) | Feb 2026 | Upgrade naar Prosody 13.0.4 (fix in 13.x branch) |
| iOS foreground: stale WebSocket na suspend | Feb 2026 | XMPP ping (XEP-0199) verificatie + force reconnect in App.tsx |
| Reconnect met verkeerde credentials | Feb 2026 | Credentials opslaan in ServiceContainer bij init, gebruiken bij reconnect |
| Metro bundler verliest verbinding na iOS suspend | Feb 2026 | Development-only issue; productie builds hebben geen Metro |

---

## 3. Productie-Architectuur Overzicht

### Architectuur Diagram

```
                        ┌─────────────────────┐
                        │   DNS (Route 53)     │
                        │   xmpp.commeazy.com  │
                        └──────────┬──────────┘
                                   │
                        ┌──────────▼──────────┐
                        │   CDN / WAF          │
                        │   (Cloudflare)       │
                        └──────────┬──────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      HAProxy Cluster         │
                    │   (Active-Passive / Keepalived) │
                    │   Poort 443 (WSS)            │
                    └──┬────────┬────────┬────────┘
                       │        │        │
              ┌────────▼──┐ ┌──▼────────┐ ┌──▼────────┐
              │ Prosody 1  │ │ Prosody 2  │ │ Prosody 3  │
              │ (Active)   │ │ (Active)   │ │ (Active)   │
              │ :5280 WS   │ │ :5280 WS   │ │ :5280 WS   │
              │ :5222 c2s  │ │ :5222 c2s  │ │ :5222 c2s  │
              └──────┬─────┘ └──────┬─────┘ └──────┬─────┘
                     │              │              │
                     └──────────────▼──────────────┘
                                    │
                     ┌──────────────▼──────────────┐
                     │     PostgreSQL Cluster       │
                     │  (Primary + Read Replica)    │
                     │  Roster, Auth, Presence      │
                     └──────────────────────────────┘

              ┌────────────┐  ┌────────────┐  ┌────────────┐
              │  Coturn 1   │  │  Coturn 2   │  │  Coturn 3   │
              │  STUN/TURN  │  │  STUN/TURN  │  │  STUN/TURN  │
              │  :3478/:5349│  │  :3478/:5349│  │  :3478/:5349│
              └────────────┘  └────────────┘  └────────────┘

              ┌────────────┐  ┌────────────┐
              │ Prometheus  │  │  Grafana    │
              │ :9090       │  │  :3000      │
              └────────────┘  └────────────┘
```

### Schaalmodel

| Gebruikers | Prosody Nodes | PostgreSQL | Coturn Nodes | HAProxy |
|-----------|---------------|------------|--------------|---------|
| 0 - 25K | 2 (active-active) | 1 primary + 1 replica | 2 | 1 + 1 standby |
| 25K - 50K | 3 (active-active-active) | 1 primary + 2 replicas | 3 | 2 (keepalived) |
| 50K - 100K | 4-5 nodes | 1 primary + 2 replicas | 4 | 2 (keepalived) |
| 100K+ | 6+ nodes + sharding | Dedicated cluster | 6+ | 2+ (keepalived) |

---

## 4. Infrastructuur Topologie

### Cloud Provider Aanbeveling

**Primair: Hetzner Cloud (EU) of AWS eu-west-1 (Ierland)**

Keuze gebaseerd op:
- **GDPR compliance** — Data in EU
- **Latency** — < 20ms naar Nederlandse gebruikers
- **Kosten** — Hetzner significant goedkoper bij hoge volumes

### Server Specificaties

| Rol | vCPU | RAM | Disk | Netwerk | Aantal |
|-----|------|-----|------|---------|--------|
| **Prosody** | 4 vCPU | 8 GB | 50 GB SSD | 1 Gbps | 3-5 |
| **PostgreSQL Primary** | 4 vCPU | 16 GB | 200 GB NVMe | 1 Gbps | 1 |
| **PostgreSQL Replica** | 4 vCPU | 16 GB | 200 GB NVMe | 1 Gbps | 1-2 |
| **HAProxy** | 2 vCPU | 4 GB | 20 GB SSD | 1 Gbps | 2 |
| **Coturn** | 4 vCPU | 4 GB | 20 GB SSD | 1 Gbps | 3 |
| **Monitoring** | 2 vCPU | 8 GB | 100 GB SSD | 1 Gbps | 1 |

### Prosody Sizing: Waarom 8 GB RAM per Node?

Prosody is single-threaded Lua. Elke c2s sessie verbruikt ~50-100 KB RAM:

```
100.000 gebruikers / 3 nodes = ~33.333 sessies per node
33.333 sessies × 100 KB = ~3.2 GB sessie-geheugen
+ Lua VM overhead: ~1 GB
+ OS + buffers: ~2 GB
+ Headroom (30%): ~2 GB
= ~8 GB totaal
```

### Netwerk

| Poort | Protocol | Doel | Bron |
|-------|----------|------|------|
| 443 | WSS (TLS) | Client WebSocket verbindingen | Internet |
| 5222 | XMPP c2s (TLS) | Directe XMPP clients (optioneel) | Internet |
| 5269 | XMPP s2s (TLS) | Server-naar-server federatie | XMPP servers |
| 5280 | HTTP (intern) | WebSocket (achter HAProxy) | HAProxy |
| 5347 | XMPP component | Externe components | Intern |
| 3478 | STUN/TURN UDP | Media relay | Internet |
| 5349 | STUN/TURN TLS | Media relay (TLS) | Internet |
| 49152-65535 | UDP | TURN media relay range | Internet |
| 5432 | PostgreSQL | Database | Prosody nodes |
| 9090 | HTTP | Prometheus metrics | Monitoring |

---

## 5. Prosody Cluster Configuratie

### Clustering Methode

Prosody ondersteunt **geen native clustering**. Er zijn twee strategieën:

#### Strategie A: Sticky Sessions (Aanbevolen voor CommEazy)

```
HAProxy → sticky session per gebruiker → altijd dezelfde Prosody node
```

**Voordelen:**
- Eenvoudig te implementeren
- Presence state per node (geen cross-node sync nodig)
- mod_smacks sessie-resumptie werkt correct

**Nadelen:**
- Bij node-failure verliezen alle sessies van die node de verbinding
- Client moet opnieuw verbinden (acceptabel met auto-reconnect)

#### Strategie B: mod_s2s_bidi met Interne Federatie

```
Prosody nodes federeren onderling via s2s
Elke node is een aparte "server" met gedeelde opslag
```

**Voordelen:**
- Presence wordt automatisch gesynchroniseerd via s2s
- Echt horizontaal schaalbaar

**Nadelen:**
- Complexer
- Meer latentie (cross-node hops)
- Meer resources (s2s verbindingen per node-paar)

### Aanbeveling voor CommEazy

**Strategie A (Sticky Sessions)** voor de eerste 100K gebruikers:
- Eenvoudiger operations
- CommEazy's zero-storage model vermijdt de meeste cross-node problemen
- Roster en auth via gedeelde PostgreSQL
- Presence is per-node maar dat is acceptabel omdat:
  - Elke gebruiker heeft typisch 1-3 contacten online
  - Bij reconnect naar zelfde node: presence intact
  - Bij node-failure: client reconnect + presence probe herstelt alles

### Multi-Node Presence Synchronisatie

Bij Strategie A met sticky sessions is er een subtiel probleem: als Gebruiker A op Node 1 zit en Gebruiker B op Node 2, hoe weet Node 1 de presence van B?

**Oplossing: XMPP s2s tussen nodes**

Hoewel we sticky sessions gebruiken, configureren we de Prosody nodes om via **s2s (server-to-server)** met elkaar te communiceren. Elke node draait als een aparte "server" onder hetzelfde domein via subdomein-mapping:

```
node1.xmpp.commeazy.com → Prosody Node 1
node2.xmpp.commeazy.com → Prosody Node 2
node3.xmpp.commeazy.com → Prosody Node 3
```

Presence stanzas worden automatisch gerouteerd via s2s. De HAProxy sticky session zorgt ervoor dat een gebruiker altijd op dezelfde node terechtkomt, maar roster lookups en presence updates gaan via de gedeelde PostgreSQL + s2s.

**Alternatief (eenvoudiger):** Gebruik `mod_remote_roster` of een shared Redis-based presence store via een community module. Dit vereist extra evaluatie.

---

## 6. Database Backend

### PostgreSQL Schema

Prosody slaat de volgende data op (let op: GEEN berichten vanwege zero-storage):

| Data | Tabel | Grootte per 100K users | Schrijffrequentie |
|------|-------|------------------------|-------------------|
| **Accounts** | `prosody` (type=accounts) | ~10 MB | Laag (registratie) |
| **Roster** | `prosody` (type=roster) | ~50 MB | Laag (contact toevoegen) |
| **vCards** | `prosody` (type=vcard) | ~100 MB | Zeer laag |
| **PEP data** | `prosody` (type=pep) | ~50 MB | Laag |
| **Presence** | In-memory | N/A | Hoog (real-time) |
| **Sessions** | In-memory | N/A | Hoog (real-time) |

**Totaal disk:** ~250 MB voor 100K users (zeer klein — Prosody is lightweight)

### PostgreSQL Configuratie

```sql
-- Database aanmaken
CREATE DATABASE prosody
  ENCODING 'UTF8'
  LC_COLLATE 'en_US.UTF-8'
  LC_CTYPE 'en_US.UTF-8';

CREATE USER prosody WITH ENCRYPTED PASSWORD '<STERK_WACHTWOORD>';
GRANT ALL PRIVILEGES ON DATABASE prosody TO prosody;

-- Performance tuning voor Prosody workload
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_level = replica;          -- Voor replicatie
ALTER SYSTEM SET max_wal_senders = 5;
ALTER SYSTEM SET wal_keep_size = '1GB';
```

### Prosody SQL Configuratie

```lua
-- In prosody.cfg.lua (productie)
storage = "sql"

sql = {
    driver = "PostgreSQL";
    database = "prosody";
    host = "db-primary.internal.commeazy.com";
    port = 5432;
    username = "prosody";
    password = "<STERK_WACHTWOORD>";  -- Via environment variable in productie
}
```

### Replicatie

```
PostgreSQL Primary (schrijven + lezen)
        │
        ├── Streaming Replication
        │
        ▼
PostgreSQL Replica (alleen lezen, failover)
```

**Failover:** Gebruik `Patroni` of `pg_auto_failover` voor automatische failover.

---

## 7. Load Balancing & Reverse Proxy

### HAProxy Configuratie

```haproxy
# /etc/haproxy/haproxy.cfg

global
    maxconn 100000
    log /dev/log local0
    stats socket /run/haproxy/admin.sock mode 660 level admin

defaults
    mode http
    log global
    option httplog
    option dontlognull
    timeout connect 5s
    timeout client 300s       # WebSocket idle timeout (5 min)
    timeout server 300s
    timeout tunnel 3600s      # WebSocket tunnel timeout (1 uur)
    timeout http-keep-alive 60s

# --- Frontend: WSS (poort 443) ---
frontend wss_frontend
    bind *:443 ssl crt /etc/ssl/commeazy/commeazy.com.pem alpn h2,http/1.1

    # WebSocket detectie
    acl is_websocket hdr(Upgrade) -i websocket
    acl is_xmpp_ws path_beg /xmpp-websocket

    # Route WebSocket naar Prosody backend
    use_backend prosody_ws if is_websocket is_xmpp_ws

    # Health check endpoint
    acl is_health path /health
    use_backend health_backend if is_health

    # Default: blokkeer
    default_backend blocked

# --- Backend: Prosody WebSocket ---
backend prosody_ws
    balance source              # Sticky sessions op basis van client IP
    hash-type consistent        # Minimale herverdeling bij node toevoegen/verwijderen

    option httpchk GET /health
    http-check expect status 200

    # Prosody nodes
    server prosody1 10.0.1.10:5280 check inter 5s fall 3 rise 2 weight 100
    server prosody2 10.0.1.11:5280 check inter 5s fall 3 rise 2 weight 100
    server prosody3 10.0.1.12:5280 check inter 5s fall 3 rise 2 weight 100

# --- Backend: Health ---
backend health_backend
    server local 127.0.0.1:8080

# --- Backend: Blocked ---
backend blocked
    http-request deny deny_status 403

# --- Stats ---
listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 10s
    stats admin if LOCALHOST
```

### Sticky Session Strategie

| Methode | Beschrijving | Aanbevolen? |
|---------|-------------|-------------|
| `balance source` | Hash op client IP | Ja (eenvoudig, werkt voor mobiel) |
| `balance uri` | Hash op URI | Nee (alle WS naar zelfde URI) |
| Cookie-based | HAProxy cookie | Nee (WebSocket upgrade verliest cookies) |
| `stick-table` | Session tracking | Optioneel (meer controle, meer geheugen) |

**`balance source` is voldoende** omdat:
- Mobiele clients hebben typisch een stabiel IP per sessie
- Bij IP-wissel (WiFi → 4G) reconnect de client toch opnieuw
- mod_smacks kan sessie hervatten op dezelfde node

### Keepalived (HAProxy HA)

```
HAProxy Active  (VIP: 10.0.0.100)
        │
    Keepalived VRRP
        │
HAProxy Standby (wordt Active bij failure)
```

---

## 8. TLS/SSL Certificaten

### Certificaat Strategie

| Gebruik | Type | Provider | Vernieuwing |
|---------|------|----------|-------------|
| **WSS (HAProxy)** | Wildcard `*.commeazy.com` | Let's Encrypt | Automatisch (certbot) |
| **XMPP c2s** | `xmpp.commeazy.com` | Let's Encrypt | Automatisch |
| **XMPP s2s** | `xmpp.commeazy.com` | Let's Encrypt | Automatisch |
| **Intern (node-to-node)** | Self-signed CA | Eigen CA | Manueel (jaarlijks) |

### Certbot Automatisering

```bash
# Certificaat aanvragen
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/cloudflare/credentials \
  -d xmpp.commeazy.com \
  -d *.commeazy.com

# Auto-renewal cron
0 3 * * * certbot renew --post-hook "systemctl reload haproxy && prosodyctl reload"
```

### Prosody TLS Configuratie

```lua
-- Productie TLS settings
ssl = {
    certificate = "/etc/letsencrypt/live/xmpp.commeazy.com/fullchain.pem";
    key = "/etc/letsencrypt/live/xmpp.commeazy.com/privkey.pem";

    -- Sterke cipher suites
    ciphers = "ECDHE+AESGCM:DHE+AESGCM";
    options = {
        "no_sslv2";
        "no_sslv3";
        "no_tlsv1";
        "no_tlsv1_1";
        "cipher_server_preference";
    };

    -- Minimaal TLS 1.2
    protocol = "tlsv1_2+";

    -- DH parameters
    dhparam = "/etc/prosody/certs/dh-4096.pem";
}
```

---

## 9. WebSocket Configuratie

### Productie WebSocket Settings

```lua
-- WebSocket module (productie)
http_ports = { 5280 }              -- Intern (achter HAProxy)
http_interfaces = { "0.0.0.0" }   -- Luister op alle interfaces

-- GEEN https_ports — TLS wordt door HAProxy afgehandeld
https_ports = {}

-- WebSocket specifiek
consider_websocket_secure = true   -- Vertrouw HAProxy's TLS terminatie
-- cross_domain_websocket verwijderd — deprecated sinds Prosody 13.x

-- WebSocket path
websocket_path = "/xmpp-websocket"

-- Frame size limits (voorkom abuse)
websocket_frame_buffer_limit = 32768  -- 32 KB max frame
websocket_frame_fragment_limit = 8    -- Max 8 fragmenten
```

### Client Verbinding

```
Client (iOS/Android)
    │
    │  wss://xmpp.commeazy.com/xmpp-websocket
    │
    ▼
HAProxy (:443, TLS terminatie)
    │
    │  ws://prosody-node:5280/xmpp-websocket
    │
    ▼
Prosody (mod_websocket)
```

---

## 10. Authenticatie & Autorisatie

### Development → Productie Migratie

| Aspect | Development | Productie |
|--------|------------|-----------|
| **Methode** | `internal_plain` | `internal_hashed` |
| **SASL** | PLAIN over onbeveiligd | SCRAM-SHA-256 over TLS |
| **Account creatie** | `prosodyctl adduser` | Via Firebase Auth bridge |
| **Wachtwoord opslag** | Plaintext | PBKDF2/scrypt hash |

### Firebase Auth Bridge

CommEazy gebruikt Firebase Auth voor telefoonverificatie. De bridge werkt als volgt:

```
1. Client → Firebase Auth (telefoon verificatie)
2. Firebase → Client (JWT token)
3. Client → CommEazy Backend (JWT token)
4. Backend → Prosody (account aanmaken via admin API)
5. Client → Prosody (SASL auth met gegenereerd wachtwoord)
```

### Prosody Auth Configuratie (Productie)

```lua
-- Optie A: internal_hashed (eenvoudig, aanbevolen voor start)
authentication = "internal_hashed"

-- Optie B: LDAP/custom backend (voor grotere schaal)
-- authentication = "cyrus"
-- cyrus_application_name = "xmpp"

-- Account registratie UITSCHAKELEN (accounts via backend API)
allow_registration = false

-- Admin accounts
admins = {
    "admin@commeazy.com";
}
```

### SASL Mechanisme

```lua
-- Alleen sterke mechanismen toestaan
c2s_require_encryption = true
s2s_require_encryption = true

-- Disable PLAIN auth (alleen SCRAM)
-- Let op: React Native xmpp.js MOET SCRAM-SHA-1 ondersteunen
-- Test dit GRONDIG voor productie-deployment
```

**WAARSCHUWING:** De huidige development configuratie gebruikt `internal_plain` omdat React Native's xmpp.js library mogelijk problemen heeft met SCRAM-SHA-1. Dit MOET getest worden vóór productie. Zie sectie 20 (Validatie Checklist).

---

## 11. Connection Management & Presence

### Dead Connection Detection

Dit is een **kritiek onderdeel** voor CommEazy's presence systeem. De configuratie hieronder is gebaseerd op onze development lessons learned.

```lua
-- ===========================================================
-- DEAD CONNECTION DETECTION
-- ===========================================================

-- network_settings.read_timeout
-- ─────────────────────────────
-- Dit is DE instelling voor dead connection detection op authenticated sessies.
--
-- Hoe het werkt:
-- 1. Prosody start een timer wanneer een sessie idle is
-- 2. Na read_timeout seconden, stuurt Prosody een probe:
--    - TCP verbinding: whitespace keepalive (' ')
--    - WebSocket: WebSocket ping frame (opcode 0x9)
--    - mod_smacks actief: <r/> (ack request)
-- 3. Als de probe faalt (schrijffout, geen antwoord): verbinding dood
--
-- WAARSCHUWING: c2s_timeout is NIET voor dead connection detection!
-- c2s_timeout is alleen voor pre-authenticatie sessions.
--
-- Trade-offs:
--   30s  = zeer snel, maar veel ping traffic (niet aanbevolen bij >50K users)
--   60s  = goede balans voor mobile apps (AANBEVOLEN)
--   120s = conservatief, minder traffic
--   840s = Prosody default — VEEL te traag voor presence

network_settings = {
    read_timeout = 60;     -- 60 seconden (development: 60s, productie: 60-120s)
}

-- smacks_hibernation_time
-- ───────────────────────
-- Wanneer een verbinding breekt (niet clean gesloten), parkeert mod_smacks
-- de sessie voor mogelijke hervatting. Tijdens hibernation:
--   - Gebruiker verschijnt nog als ONLINE voor contacten
--   - Berichten worden gebufferd voor hervatting
--   - Na expiry: sessie vernietigd + <presence type="unavailable"/> verzonden
--
-- Trade-offs:
--   10s  = zeer snel presence update, maar korte netwerk-hik = volledige reconnect
--   30s  = goede balans (AANBEVOLEN voor mobiel)
--   60s  = meer vergevingsgezind voor instabiele netwerken
--   300s = Prosody default — te traag

smacks_hibernation_time = 30   -- 30 seconden

-- c2s_timeout
-- ───────────
-- Pre-authenticatie timeout. Hoe lang een ongeauthenticeerde verbinding
-- mag bestaan voordat Prosody deze sluit.
-- Heeft GEEN effect op ingelogde sessies.

c2s_timeout = 300   -- 5 minuten (default)

-- TCP keepalives (OS-niveau)
-- Aanvullende bescherming via OS TCP keepalive probes
c2s_tcp_keepalives = true
s2s_tcp_keepalives = true
```

### Presence Flow (Productie)

```
App Foreground:
  Client → Prosody: <presence/>                    (available)
  Prosody → Contacts: <presence from="user@..."/>  (broadcast)

App Background (iOS suspend):
  Client → Prosody: <presence><show>away</show></presence>
  Prosody → Contacts: <presence from="user@..."><show>away</show></presence>

App Force-Quit (geen clean disconnect):
  0s:   TCP verbinding breekt (geen close frame)
  60s:  read_timeout fired → Prosody stuurt WebSocket ping
        → Schrijffout → verbinding gedetecteerd als dood
  60s:  mod_smacks hiberneert de sessie
  90s:  smacks_hibernation_time (30s) verstreken
        → Sessie vernietigd
        → Prosody broadcast: <presence type="unavailable"/>
  90s:  Contacten zien gebruiker als OFFLINE
```

### Presence Timing Samenvatting

| Scenario | Detectietijd | Methode |
|----------|-------------|---------|
| **App → background** | Instant | Client stuurt `<presence><show>away</show></presence>` |
| **Clean disconnect** | Instant | Client stuurt `</stream:stream>` + WebSocket close |
| **Force-quit** | ~90 seconden | read_timeout (60s) + smacks_hibernation (30s) |
| **Netwerk verlies** | ~90 seconden | Zelfde als force-quit |
| **Server reboot** | Instant | Alle sessies vernietigd, bulk unavailable |

### Productie-specifieke Overwegingen

**Bij 100K+ verbindingen:**
- `read_timeout = 60` genereert ~1.667 pings/seconde (~100K / 60s)
- Elke ping is een WebSocket frame van ~2 bytes
- Totale bandbreedte: ~3.3 KB/s — verwaarloosbaar
- CPU impact: minimaal (Lua event-driven)

**Overweeg `read_timeout = 120` als:**
- CPU-load op Prosody nodes > 70%
- Gebruikers klagen niet over trage presence updates
- Netwerk is stabiel (weinig force-quits)

---

## 12. Push Notifications (cloud_notify)

### Architectuur

CommEazy gebruikt `mod_cloud_notify` (XEP-0357) voor push naar iOS (APNs) en Android (FCM).

```
Prosody (mod_cloud_notify)
    │
    │  XEP-0357 push notification
    │
    ▼
Push Gateway Service (zelf-hosted)
    │
    ├── APNs (Apple Push Notification service)
    │   → iOS devices
    │
    └── FCM (Firebase Cloud Messaging)
        → Android devices
```

### Prosody Push Configuratie

```lua
-- mod_cloud_notify is al in modules_enabled

-- Push notification settings
push_notification_with_body = false    -- GEEN bericht-inhoud in push (privacy!)
push_notification_with_sender = false  -- GEEN afzender in push (privacy!)

-- Alleen een signaal dat er een nieuw bericht is
-- De app haalt het bericht zelf op via XMPP na het openen
```

### Push Gateway

De push gateway is een apart microservice die XEP-0357 notificaties ontvangt en doorstuurt naar APNs/FCM. Dit moet **zelf-hosted** zijn vanwege privacy (geen derde partij ziet push tokens).

---

## 13. STUN/TURN (Coturn) voor WebRTC

### Coturn Cluster

```lua
-- Prosody: TURN server configuratie
turn_external_host = "turn.commeazy.com"
turn_external_port = 3478
turn_external_secret = "<GEDEELD_SECRET>"  -- Zelfde in Prosody en Coturn
turn_external_ttl = 86400                  -- Credential geldigheid (24 uur)
```

### Coturn Configuratie

```ini
# /etc/turnserver.conf

# Luisterpoorten
listening-port=3478
tls-listening-port=5349
min-port=49152
max-port=65535

# Realm
realm=commeazy.com

# Shared secret (zelfde als in Prosody)
use-auth-secret
static-auth-secret=<GEDEELD_SECRET>

# TLS
cert=/etc/letsencrypt/live/turn.commeazy.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.commeazy.com/privkey.pem

# Logging
log-file=/var/log/turnserver/turn.log
verbose

# Performance
total-quota=100
bps-capacity=0          # Geen bandwidth limit
stale-nonce=600

# Security
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255    # Voorkom relay naar intern netwerk
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
```

### Coturn Sizing

| Gelijktijdige Calls | Bandbreedte per Call | Totale Bandbreedte | Coturn Nodes |
|---------------------|--------------------|--------------------|--------------|
| 1.000 | ~1 Mbps (audio+video) | ~1 Gbps | 2 |
| 5.000 | ~1 Mbps | ~5 Gbps | 4-5 |
| 10.000 | ~1 Mbps | ~10 Gbps | 8-10 |

**Let op:** De meeste calls zijn P2P (via STUN). Alleen calls achter restrictieve NAT gebruiken TURN relay. Typisch is ~20-30% van calls TURN.

---

## 14. Monitoring & Observability

### Prosody Metrics

```lua
-- Activeer statistieken module
statistics = "internal"
statistics_interval = 30  -- Elke 30 seconden

-- Expose via HTTP voor Prometheus
modules_enabled = {
    -- ... bestaande modules ...
    "http_openmetrics";    -- Prometheus metrics endpoint
}
```

### Prometheus Scrape Config

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'prosody'
    scrape_interval: 30s
    static_configs:
      - targets:
        - 'prosody1:5280'
        - 'prosody2:5280'
        - 'prosody3:5280'
    metrics_path: /metrics

  - job_name: 'haproxy'
    scrape_interval: 15s
    static_configs:
      - targets: ['haproxy:8404']

  - job_name: 'postgresql'
    scrape_interval: 30s
    static_configs:
      - targets: ['postgres-exporter:9187']
```

### Kritieke Alerts

| Metric | Drempel | Severity | Actie |
|--------|---------|----------|-------|
| `prosody_c2s_sessions` | > 40.000 per node | Warning | Scale out overwegen |
| `prosody_c2s_sessions` | > 50.000 per node | Critical | Scale out NODIG |
| `prosody_memory_used_bytes` | > 6 GB per node | Warning | Onderzoek memory leak |
| `prosody_stanza_rate` | > 10.000/s per node | Warning | Performance review |
| `haproxy_backend_up` | < 2 nodes | Critical | Node down, auto-failover |
| `pg_replication_lag_bytes` | > 10 MB | Warning | Replicatie loopt achter |
| `coturn_active_allocations` | > 5.000 per node | Warning | Scale Coturn |
| `ssl_certificate_expiry_days` | < 14 dagen | Warning | Certificaat vernieuwen |

### Grafana Dashboards

1. **Prosody Overview** — Sessies, stanzas/s, geheugen, CPU
2. **Presence Health** — Presence updates/s, hibernated sessions, dead connections detected
3. **WebSocket Health** — Active connections, ping/pong latency, connection errors
4. **PostgreSQL** — Queries/s, replication lag, connection pool
5. **Coturn** — Active allocations, bandwidth, STUN vs TURN ratio
6. **HAProxy** — Request rate, backend health, latency percentiles

### Logging (Productie)

```lua
-- Productie logging configuratie
log = {
    info = "/var/log/prosody/prosody.log";
    warn = "/var/log/prosody/prosody.warn";
    error = "/var/log/prosody/prosody.err";
    -- GEEN debug in productie (te veel output)
    -- GEEN "*console" in productie (draait als daemon)
}

-- Log rotation via logrotate
-- /etc/logrotate.d/prosody:
-- /var/log/prosody/*.log {
--     daily
--     rotate 14
--     compress
--     delaycompress
--     missingok
--     notifempty
--     postrotate
--         prosodyctl reload
--     endscript
-- }
```

---

## 15. Security Hardening

### Prosody Security

```lua
-- Verplichte encryptie
c2s_require_encryption = true
s2s_require_encryption = true
s2s_secure_auth = true

-- Registratie uitschakelen (accounts via backend)
allow_registration = false

-- Rate limiting
limits = {
    c2s = {
        rate = "10kb/s";        -- Per-verbinding bandbreedte limit
        burst = "50kb/s";       -- Burst toegestaan
    };
    s2sin = {
        rate = "30kb/s";
    };
}

-- Prevent address spoofing
modules_enabled = {
    -- ... bestaande modules ...
    "mimicking";   -- Voorkom adres-spoofing
}
```

### Firewall Regels (iptables/nftables)

```bash
# Alleen noodzakelijke poorten openzetten
# Intern netwerk: 10.0.0.0/8

# HAProxy (publiek)
-A INPUT -p tcp --dport 443 -j ACCEPT               # WSS
-A INPUT -p tcp --dport 5222 -j ACCEPT               # XMPP c2s (optioneel)

# Prosody (alleen intern + HAProxy)
-A INPUT -s 10.0.0.0/8 -p tcp --dport 5280 -j ACCEPT  # WebSocket (intern)
-A INPUT -s 10.0.0.0/8 -p tcp --dport 5269 -j ACCEPT  # s2s (intern)
-A INPUT -s 10.0.0.0/8 -p tcp --dport 5347 -j ACCEPT  # Component (intern)

# Coturn (publiek)
-A INPUT -p udp --dport 3478 -j ACCEPT               # STUN/TURN
-A INPUT -p tcp --dport 5349 -j ACCEPT               # STUN/TURN TLS
-A INPUT -p udp --dport 49152:65535 -j ACCEPT        # TURN relay range

# PostgreSQL (alleen intern)
-A INPUT -s 10.0.0.0/8 -p tcp --dport 5432 -j ACCEPT

# Monitoring (alleen intern)
-A INPUT -s 10.0.0.0/8 -p tcp --dport 9090 -j ACCEPT  # Prometheus
-A INPUT -s 10.0.0.0/8 -p tcp --dport 3000 -j ACCEPT  # Grafana

# Default deny
-A INPUT -j DROP
```

### CommEazy-Specifieke Security

| Maatregel | Reden | Implementatie |
|-----------|-------|---------------|
| **mod_mam UITGESCHAKELD** | Zero server storage | `--"mam"` (uitgecommentarieerd) |
| **Push zonder inhoud** | Privacy | `push_notification_with_body = false` |
| **Geen server-side logging van berichten** | GDPR | Geen archivering geconfigureerd |
| **E2E encryptie** | Privacy | Client-side (libsodium), niet server-side |
| **TLS 1.2+ only** | Security | `protocol = "tlsv1_2+"` |

---

## 16. Capaciteitsplanning

### Resource Verbruik per Sessie

| Resource | Per Sessie | 100K Sessies |
|----------|-----------|--------------|
| **RAM** | 50-100 KB | 5-10 GB |
| **CPU** | 0.001% van 1 core | 100% van 1 core (idle) |
| **Bandbreedte (idle)** | ~100 bytes/min (pings) | ~160 KB/s |
| **Bandbreedte (actief)** | ~2 KB/bericht | Variabel |
| **DB connecties** | Gedeeld (pool) | 50-100 connecties |

### Groeiscenario's

```
Jaar 1: 10.000 gebruikers
├── 2 Prosody nodes (4 vCPU, 8 GB)
├── 1 PostgreSQL primary + 1 replica
├── 1 HAProxy + 1 standby
├── 2 Coturn nodes
└── Kosten: ~€200-400/maand (Hetzner)

Jaar 2: 50.000 gebruikers
├── 3 Prosody nodes (4 vCPU, 8 GB)
├── 1 PostgreSQL primary + 2 replicas
├── 2 HAProxy (keepalived)
├── 3 Coturn nodes
└── Kosten: ~€600-1000/maand

Jaar 3: 100.000+ gebruikers
├── 5 Prosody nodes (8 vCPU, 16 GB)
├── PostgreSQL cluster (Patroni)
├── 2 HAProxy (keepalived)
├── 5 Coturn nodes
└── Kosten: ~€1500-2500/maand
```

### Bottleneck Analyse

| Component | Limiet | Oplossing |
|-----------|--------|-----------|
| **Prosody per node** | ~50K sessies (geheugen) | Meer nodes toevoegen |
| **PostgreSQL** | ~10K queries/s | Read replicas, connection pooling (PgBouncer) |
| **HAProxy** | ~100K concurrent connections | Keepalived cluster |
| **Coturn** | Bandbreedte-beperkt | Meer nodes, geografisch verspreid |
| **Netwerk** | 1 Gbps per node | 10 Gbps upgrade of multi-NIC |

---

## 17. Disaster Recovery & Backup

### Backup Strategie

| Data | Methode | Frequentie | Retentie |
|------|---------|-----------|----------|
| **PostgreSQL** | `pg_dump` + WAL archiving | Dagelijks + continu WAL | 30 dagen |
| **Prosody config** | Git repository | Bij elke wijziging | Onbeperkt |
| **TLS certificaten** | Encrypted backup | Wekelijks | 1 jaar |
| **HAProxy config** | Git repository | Bij elke wijziging | Onbeperkt |
| **Coturn config** | Git repository | Bij elke wijziging | Onbeperkt |

**Let op:** Prosody slaat GEEN berichten op. Er is geen "bericht backup" nodig.

### Recovery Procedures

#### Scenario 1: Enkele Prosody Node Down

```
1. HAProxy detecteert failure (5s health check interval, 3 failures)
2. HAProxy stopt met routeren naar deze node
3. Clients op deze node verliezen verbinding
4. Clients reconnecten automatisch → HAProxy routeert naar gezonde node
5. Herstel: herstart node of deploy nieuwe node
6. Na herstel: HAProxy detecteert gezonde node (2 successen)
```

**Impact:** ~33% van gebruikers (bij 3 nodes) verliest verbinding voor ~5-10 seconden.

#### Scenario 2: PostgreSQL Primary Down

```
1. Patroni detecteert primary failure
2. Patroni promoveert replica tot primary
3. Prosody nodes detecteren connection loss
4. Prosody reconnect naar nieuwe primary (via DNS of VIP)
5. Nieuwe replica opzetten
```

**Impact:** ~5-30 seconden downtime voor nieuwe roster lookups. Actieve sessies niet beïnvloed (in-memory).

#### Scenario 3: Complete Datacenter Failure

```
1. DNS failover naar backup datacenter (TTL: 60s)
2. Backup Prosody cluster + PostgreSQL replica activeren
3. Alle clients reconnecten naar nieuw cluster
4. Presence wordt opnieuw opgebouwd (probe)
```

**Impact:** 1-5 minuten downtime. Alle sessies verloren, volledige reconnect nodig.

### RPO/RTO Doelen

| Metric | Doel | Methode |
|--------|------|---------|
| **RPO** (data verlies) | 0 (voor berichten: N/A, zero storage) | WAL streaming |
| **RTO** (recovery time) | < 5 minuten (single node) | Auto-failover |
| **RTO** (full cluster) | < 30 minuten | DNS failover + standby |

---

## 18. Deployment Strategie

### Container vs Bare Metal

| Methode | Voordelen | Nadelen | Aanbevolen? |
|---------|-----------|---------|-------------|
| **Docker + K8s** | Auto-scaling, self-healing | Complexiteit, WebSocket sticky sessions lastig | Nee (initieel) |
| **Systemd op VMs** | Eenvoudig, voorspelbaar | Manueel schalen | Ja (start) |
| **Docker Compose** | Eenvoudiger dan K8s | Geen auto-scaling | Optioneel |

**Aanbeveling:** Start met **systemd op VMs**. Migreer naar Kubernetes wanneer:
- Team heeft K8s ervaring
- > 100K gebruikers vereist auto-scaling
- Multi-datacenter deployment nodig

### Deployment Procedure

```bash
# 1. Build nieuwe Prosody config
prosodyctl check config

# 2. Rolling update (één node tegelijk)
# Op HAProxy: drain node
echo "set server prosody_ws/prosody1 state drain" | socat /run/haproxy/admin.sock stdio

# 3. Wacht tot alle sessies gemigreerd (max 5 min)
# Monitor: HAProxy stats → prosody1 sessions = 0

# 4. Update Prosody
systemctl stop prosody
# ... update config/packages ...
systemctl start prosody

# 5. Health check
curl -f http://localhost:5280/health

# 6. Re-enable op HAProxy
echo "set server prosody_ws/prosody1 state ready" | socat /run/haproxy/admin.sock stdio

# 7. Herhaal voor volgende node
```

---

## 19. Migratie: Development → Productie

### Migratieplan

| Stap | Actie | Risico | Rollback |
|------|-------|--------|----------|
| 1 | Prosody 13.0.4+ installeren op productie VMs (package manager of build from source) | Laag | VM snapshot |
| 2 | PostgreSQL cluster opzetten + schema creëren | Laag | Drop database |
| 3 | HAProxy configureren + TLS certificaten | Medium | Config restore |
| 4 | Prosody productie-config deployen | Medium | Config restore + restart |
| 5 | Test met 2-3 test accounts | Laag | N/A |
| 6 | Coturn cluster opzetten | Laag | Config restore |
| 7 | Push gateway deployen | Medium | Disable push |
| 8 | DNS wijzigen naar productie | Hoog | DNS revert (TTL!) |
| 9 | Monitoring opzetten | Laag | N/A |
| 10 | Load test (10K → 50K → 100K) | Medium | Scale resources |

### Configuratie Wijzigingen (Dev → Prod)

| Setting | Development | Productie | Reden |
|---------|-------------|-----------|-------|
| `authentication` | `internal_plain` | `internal_hashed` | Security |
| `storage` | `internal` (flat files) | `sql` (PostgreSQL) | Schaalbaarheid |
| `ssl` | Geen | TLS 1.2+ verplicht | Security |
| `allow_registration` | `true` | `false` | Account beheer via backend |
| `log` | `*console` | Bestanden + logrotate | Operations |
| `statistics` | Uit | `internal` + OpenMetrics | Monitoring |
| `http_openmetrics` | Uit | Aan | Prometheus |
| `VirtualHost` | `commeazy.local` | `commeazy.com` | Productie domein |
| `admins` | Leeg | Specifieke admin accounts | Beheer |
| `s2s_secure_auth` | `true` | `true` | Behouden |
| `limits.c2s.rate` | `10kb/s` | `10kb/s` (evalueren) | DDoS bescherming |
| `network_settings.read_timeout` | `60` | `60` (evalueren naar 120) | Presence detectie |
| `smacks_hibernation_time` | `30` | `30` | Presence snelheid |

---

## 20. Productie Validatie Checklist

**Dit is de VERPLICHTE checklist die doorlopen MOET worden vóór productie-deployment.**

### A. Infrastructuur

- [ ] **Prosody versie ≥ 13.0.4** — Vereist voor mod_smacks hibernation watchdog fix + WebSocket improvements
- [ ] **PostgreSQL cluster operationeel** — Primary + minimaal 1 replica
- [ ] **Replicatie lag < 1 MB** — Streaming replication gezond
- [ ] **HAProxy health checks groen** — Alle Prosody nodes bereikbaar
- [ ] **Keepalived failover getest** — HAProxy failover gevalideerd
- [ ] **Firewall regels actief** — Alleen noodzakelijke poorten open
- [ ] **DNS correct geconfigureerd** — `xmpp.commeazy.com` → HAProxy VIP
- [ ] **TTL verlaagd** — DNS TTL = 60s (voor snelle failover)

### B. TLS & Security

- [ ] **TLS certificaten geldig** — Let's Encrypt certificaten geïnstalleerd
- [ ] **Auto-renewal geconfigureerd** — certbot cron actief
- [ ] **TLS 1.2+ only** — Geen SSLv3, TLSv1.0, TLSv1.1
- [ ] **Cipher suites sterk** — ECDHE+AESGCM, geen CBC
- [ ] **c2s_require_encryption = true** — Verplichte client encryptie
- [ ] **s2s_require_encryption = true** — Verplichte server encryptie
- [ ] **allow_registration = false** — Geen open registratie

### C. Authenticatie

- [ ] **SCRAM-SHA-1 getest met xmpp.js** — React Native client kan inloggen
- [ ] **internal_hashed werkt** — Wachtwoorden correct gehasht
- [ ] **Firebase Auth bridge operationeel** — Account creatie via backend
- [ ] **Admin accounts aangemaakt** — Minimaal 2 admin accounts

### D. Connection Management & Presence

- [ ] **network_settings.read_timeout gevalideerd** — Dead connection detectie werkt
- [ ] **smacks_hibernation_time getest** — Presence update na force-quit
- [ ] **End-to-end presence test** — App A force-quit → App B ziet offline binnen 90s
- [ ] **Reconnect test** — App A reconnect → App B ziet online binnen 5s
- [ ] **Background presence test** — App A naar background → App B ziet "away"
- [ ] **Multi-device presence** — Meerdere devices per account correct

### E. Push Notifications

- [ ] **APNs certificaat geldig** — Push naar iOS werkt
- [ ] **FCM configuratie correct** — Push naar Android werkt
- [ ] **push_notification_with_body = false** — Geen bericht-inhoud in push
- [ ] **Push gateway operationeel** — XEP-0357 flow getest

### F. WebRTC / STUN/TURN

- [ ] **Coturn operationeel** — STUN responses correct
- [ ] **TURN relay werkt** — Verbinding via relay getest
- [ ] **Shared secret synchroon** — Prosody en Coturn gebruiken zelfde secret
- [ ] **TURN credentials verlopen correct** — TTL 24h getest

### G. Monitoring

- [ ] **Prometheus scrapet alle targets** — Prosody, HAProxy, PostgreSQL, Coturn
- [ ] **Grafana dashboards operationeel** — Alle 6 dashboards zichtbaar
- [ ] **Alerts geconfigureerd** — Alle kritieke alerts actief
- [ ] **Log aggregatie actief** — Logs beschikbaar voor debugging
- [ ] **Logrotate geconfigureerd** — Disk loopt niet vol

### H. Performance & Load Testing

- [ ] **10K gelijktijdige verbindingen** — Systeem stabiel
- [ ] **50K gelijktijdige verbindingen** — Systeem stabiel, latency < 100ms P99
- [ ] **100K gelijktijdige verbindingen** — Systeem stabiel, resources < 80%
- [ ] **Node-failure test** — 1 Prosody node verwijderd, clients reconnecten
- [ ] **Database failover test** — PostgreSQL primary down, replica overneemt
- [ ] **Bericht-latency gemeten** — P50, P95, P99 gelogd
- [ ] **Memory leak test** — 24h soak test, geheugen stabiel

### I. Disaster Recovery

- [ ] **Backup procedure getest** — PostgreSQL backup + restore succesvol
- [ ] **Failover procedure getest** — Documentatie klopt met praktijk
- [ ] **Rollback procedure getest** — Vorige config snel te herstellen

### J. CommEazy-Specifiek

- [ ] **mod_mam UITGESCHAKELD** — Geen berichten opgeslagen op server
- [ ] **Zero storage audit** — Geen onverwachte data op disk
- [ ] **Privacy Manifest klopt** — Overeenkomt met daadwerkelijk gedrag
- [ ] **GDPR compliance review** — Data processing agreement voor hosting
- [ ] **US BIS encryption export** — Self-Classification Report up-to-date

---

## Appendix A: Volledige Productie prosody.cfg.lua

```lua
-- ============================================================
-- CommEazy Prosody Production Configuration
-- Version: 1.0
-- Last updated: 2026-02-27
-- ============================================================

---------- Server-wide settings ----------

pidfile = "/var/run/prosody/prosody.pid"

admins = {
    "admin@commeazy.com";
    "bert@commeazy.com";
}

plugin_paths = { "/opt/prosody-modules" }  -- Community modules

---------- Modules ----------

modules_enabled = {
    -- Core
    "disco";
    "roster";
    "saslauth";
    "tls";

    -- Recommended
    "blocklist";
    "bookmarks";
    "carbons";
    "limits";
    "pep";
    "private";
    "smacks";
    "vcard4";
    "vcard_legacy";

    -- Mobile optimizations
    "csi_simple";
    "cloud_notify";
    "ping";

    -- Admin
    "admin_adhoc";
    "admin_shell";

    -- HTTP/WebSocket
    "websocket";

    -- Security
    "mimicking";

    -- Monitoring
    "http_openmetrics";

    -- Server info
    "version";
    "uptime";
    "time";
}

modules_disabled = {
    "offline";       -- Zero storage: geen offline berichten
    "s2s";           -- Geen federatie met externe servers
}

---------- Authentication ----------

authentication = "internal_hashed"
allow_registration = false

---------- Storage ----------

storage = "sql"

sql = {
    driver = "PostgreSQL";
    database = "prosody";
    host = "db-primary.internal.commeazy.com";
    port = 5432;
    username = "prosody";
    password = os.getenv("PROSODY_DB_PASSWORD");
}

---------- TLS ----------

ssl = {
    certificate = "/etc/letsencrypt/live/xmpp.commeazy.com/fullchain.pem";
    key = "/etc/letsencrypt/live/xmpp.commeazy.com/privkey.pem";
    ciphers = "ECDHE+AESGCM:DHE+AESGCM";
    options = {
        "no_sslv2"; "no_sslv3"; "no_tlsv1"; "no_tlsv1_1";
        "cipher_server_preference";
    };
    protocol = "tlsv1_2+";
    dhparam = "/etc/prosody/certs/dh-4096.pem";
}

c2s_require_encryption = true
s2s_require_encryption = true
s2s_secure_auth = true

---------- Rate Limits ----------

limits = {
    c2s = {
        rate = "10kb/s";
        burst = "50kb/s";
    };
}

---------- HTTP / WebSocket ----------

http_ports = { 5280 }
http_interfaces = { "0.0.0.0" }
https_ports = {}                    -- TLS via HAProxy
consider_websocket_secure = true
websocket_path = "/xmpp-websocket"
websocket_frame_buffer_limit = 32768
websocket_frame_fragment_limit = 8

---------- Connection Management ----------

network_settings = {
    read_timeout = 60;              -- Dead connection detection (60s)
}

smacks_hibernation_time = 30        -- Session hibernation (30s)
c2s_timeout = 300                   -- Pre-auth timeout (5 min)
c2s_tcp_keepalives = true
s2s_tcp_keepalives = true

---------- Push Notifications ----------

push_notification_with_body = false
push_notification_with_sender = false

---------- STUN/TURN ----------

turn_external_host = "turn.commeazy.com"
turn_external_port = 3478
turn_external_secret = os.getenv("PROSODY_TURN_SECRET")
turn_external_ttl = 86400

---------- Logging ----------

log = {
    info = "/var/log/prosody/prosody.log";
    warn = "/var/log/prosody/prosody.warn";
    error = "/var/log/prosody/prosody.err";
}

---------- Statistics ----------

statistics = "internal"
statistics_interval = 30

---------- Archiving (DISABLED - zero storage) ----------

-- mod_mam is NOT in modules_enabled
-- archive_expires_after is irrelevant

---------- Virtual Hosts ----------

VirtualHost "commeazy.com"

---------- Components ----------

-- MUC (groepschat) — indien nodig
-- Component "conference.commeazy.com" "muc"
--     modules_enabled = { "muc_mam" }  -- Alleen als groepschat MAM nodig is
```

---

## Appendix B: Development vs Productie Vergelijking

| Setting | Development | Productie | Reden Verschil |
|---------|-------------|-----------|----------------|
| `pidfile` | `/opt/homebrew/var/run/...` | `/var/run/prosody/...` | OS verschil |
| `admins` | `{}` (leeg) | Specifieke accounts | Beheer |
| `authentication` | `internal_plain` | `internal_hashed` | Security |
| `storage` | `internal` | `sql` (PostgreSQL) | Schaalbaarheid |
| `ssl` | Geen/self-signed | Let's Encrypt | Security |
| `c2s_require_encryption` | Niet ingesteld | `true` | Security |
| `allow_registration` | Niet ingesteld (default true) | `false` | Beheer |
| `http_ports` | `{ 5280 }` | `{ 5280 }` | Ongewijzigd |
| `https_ports` | `{ 5281 }` | `{}` (via HAProxy) | TLS offloading |
| `http_interfaces` | `{ "*" }` | `{ "0.0.0.0" }` | Semantisch gelijk |
| `consider_websocket_secure` | `true` | `true` | Vertrouw reverse proxy |
| `cross_domain_websocket` | Verwijderd (deprecated in 13.x) | Niet aanwezig | Deprecated sinds Prosody 13.x |
| `network_settings.read_timeout` | `60` | `60` | Presence detectie |
| `smacks_hibernation_time` | `30` | `30` | Presence snelheid |
| `c2s_timeout` | `300` | `300` | Pre-auth timeout |
| `VirtualHost` | `localhost` + `commeazy.local` | `commeazy.com` | Productie domein |
| `log` | `*console` | Bestanden | Operations |
| `statistics` | Uit | `internal` + OpenMetrics | Monitoring |
| `s2s` (module) | Ingeschakeld | Uitgeschakeld | Geen federatie nodig |
| `register` | Ingeschakeld | Uitgeschakeld | Via backend |
| `invites*` | Ingeschakeld | Uitgeschakeld | Niet nodig |
| `bosh` | Ingeschakeld | Uitgeschakeld | Alleen WebSocket |
| `dialback` | Ingeschakeld | Uitgeschakeld | Geen federatie |
| `http_openmetrics` | Uit | Ingeschakeld | Monitoring |
| `mimicking` | Uit | Ingeschakeld | Security |

---

## Appendix C: Troubleshooting Guide

### Probleem 1: Presence blijft hangen op "away" of "online"

**Symptomen:** Na force-quit van de app blijft de gebruiker als "away" of "online" zichtbaar voor contacten.

**Diagnose:**
```bash
# Check actieve sessies
prosodyctl shell
> hosts:list()
> c2s:count()
> c2s:show("user@commeazy.com")

# Check smacks hibernated sessions
> smacks:show_hibernating()

# Check network_settings
> config:get("*", "network_settings")
```

**Oplossing:**
1. Controleer `network_settings.read_timeout` (moet ≤ 120s zijn)
2. Controleer `smacks_hibernation_time` (moet ≤ 60s zijn)
3. Controleer Prosody versie (≥ 13.0.4 vereist voor mod_smacks hibernation watchdog fix)
4. Check of HAProxy TCP keepalives niet interfereren

### Probleem 2: Hoge geheugengebruik

**Symptomen:** Prosody node gebruikt > 6 GB RAM.

**Diagnose:**
```bash
# Check sessie aantallen
prosodyctl shell
> c2s:count()
> s2s:count()
> smacks:show_hibernating()  -- Veel hibernated sessies = lek

# Check Lua geheugen
> debug:memory()
```

**Oplossing:**
1. Als veel hibernated sessies: verlaag `smacks_hibernation_time`
2. Controleer op memory leaks in community modules
3. Overweeg `mod_csi_simple` te verwijderen (kan geheugen ophopen)

### Probleem 3: WebSocket verbindingen falen

**Symptomen:** Clients kunnen geen WebSocket verbinding opzetten.

**Diagnose:**
```bash
# Test WebSocket endpoint
wscat -c wss://xmpp.commeazy.com/xmpp-websocket

# Check HAProxy
echo "show stat" | socat /run/haproxy/admin.sock stdio | grep prosody

# Check Prosody HTTP
curl -v http://prosody-node:5280/xmpp-websocket
```

**Oplossing:**
1. Controleer HAProxy backend health
2. Controleer `websocket_path` in Prosody config
3. Controleer TLS certificaten (geldig? correct domein?)
4. Controleer firewall regels

### Probleem 4: Database connectie verloren

**Symptomen:** Prosody logt "storage error" of "database connection failed".

**Diagnose:**
```bash
# Check PostgreSQL
psql -h db-primary.internal.commeazy.com -U prosody -d prosody -c "SELECT 1"

# Check verbindingen
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='prosody'"

# Check replicatie
psql -c "SELECT * FROM pg_stat_replication"
```

**Oplossing:**
1. Controleer PostgreSQL is bereikbaar
2. Controleer `max_connections` niet bereikt
3. Overweeg PgBouncer voor connection pooling
4. Controleer firewall tussen Prosody en PostgreSQL

### Probleem 5: Push notifications komen niet aan

**Symptomen:** Gebruikers ontvangen geen push bij nieuwe berichten.

**Diagnose:**
```bash
# Check of cloud_notify actief is
prosodyctl shell
> module:list("commeazy.com")  -- Bevat "cloud_notify"?

# Check push gateway logs
journalctl -u push-gateway -f

# Check APNs/FCM response codes
```

**Oplossing:**
1. Controleer `cloud_notify` in `modules_enabled`
2. Controleer push gateway bereikbaar
3. Controleer APNs certificaat geldigheid
4. Controleer FCM server key

---

## Document Beheer

| Versie | Datum | Auteur | Wijziging |
|--------|-------|--------|-----------|
| 1.0 | 2026-02-27 | Claude Opus 4 + Bert | Initieel document |
| 1.1 | 2026-02-27 | Claude Opus 4 + Bert | Upgrade naar Prosody 13.0.4, build-from-source instructies, iOS presence fix lessons learned |
| | | | |

**Volgende review:** Vóór eerste productie-deployment

**Verantwoordelijke:** Bert van Capelle

---

*Dit document is gegenereerd als referentie-architectuur. Alle waarden en configuraties MOETEN gevalideerd worden in een staging-omgeving vóór productie-deployment. Zie sectie 20 voor de verplichte validatie checklist.*
