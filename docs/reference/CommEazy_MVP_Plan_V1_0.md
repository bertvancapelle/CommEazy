# COMMEAZY MVP V1.0 - IMPLEMENTATIEPLAN

**Privacy-First Familie Communicatie Platform**

*CommEazy*

Eenvoudig • Veilig • Voor Iedereen

👵👴 Senioren + Familie | 🤖 Claude Code Development | 📱 23 weken MVP

| **Aspect** | **Details** |
|-----------------------------------|--------------------------------------|
| **Versie:** | MVP V1.0 |
| **Doelgroep:** | Senioren (60+) en hun familie |
| **Primaire Use Case:** | Dagelijkse familie communicatie |
| **Development Tool:** | Claude Code (78% autonomie) |
| **Timeline:** | **23 weken MVP** |
| **Tech Stack:** | React Native + Jitsi Prosody XMPP + P2P |
| **Features:** | 1-op-1 + Groepschat (max 30), Calls, Foto's |
| **Architecture:** | **Device-Centric + P2P + ZERO SERVER STORAGE** |
| **Kosten Jaar 1:** | €700-900 (server + domains) |
| **Abonnement:** | €0,25/maand of €2,50/jaar per gebruiker |
| **Domains:** | commeazy.com (primary), commeasy.com (redirect) |
| **Deployment:** | iOS App Store + Google Play Store |

---

## 🎉 V1.0 FEATURES

### ✅ TOEGEVOEGD in V1.0:
- ✅ **Groepschat (max 30 personen)** - NIEUW!
- ✅ **Shared-key encryptie** voor efficient groepsberichten
- ✅ **Auto-mute voor grote groepen** (>15 leden)
- ✅ **Prosody MUC** (Multi-User Chat) integratie
- ✅ **ZERO SERVER STORAGE** - Prosody slaat NIKS op! 🔒
- ✅ **Client-side Outbox** - Member-to-member delivery
- ✅ **Transparent delivery status** - "5/8 delivered"
- ✅ **1-op-1 Chat** - E2E encrypted tekstberichten
- ✅ **Foto's Delen** - Camera + galerij, lokaal opslag
- ✅ **Audio/Video Calls** - P2P via Prosody/WebRTC
- ✅ **QR code pairing** - Contacten toevoegen
- ✅ **Presence tracking** - Online/offline status
- ✅ **Push Notifications** - Via Firebase FCM
- ✅ **Backup/Restore** - Encrypted, user-controlled

### ❌ EXPLICIET BUITEN MVP V1.0:
- ❌ Groep video/audio calls (vereist SFU server)
- ❌ Voice messages
- ❌ Bestanden delen (PDF, DOC)
- ❌ Video's delen
- ❌ Message reactions
- ❌ Message editing
- ❌ TV-kijken
- ❌ Audioboeken
- ❌ Desktop app
- ❌ Web app

---

# Inhoudsopgave

1. Project Visie & Doelgroep
2. Waarom Dit HAALBAAR is met Claude Code
3. P2P + Device-Centric Architectuur
4. Tech Stack (Prosody XMPP + MUC)
5. Security Strategie (Dual Encryption)
6. Complete Feature Set
7. **NIEUW: Groepschat Specificaties**
8. UI/UX voor Senioren
9. XMPP Messaging + MUC Systeem
10. P2P Calls via Prosody
11. Device Storage & Backup
12. Claude Code Development Workflow
13. **NIEUW: Week-bij-Week Roadmap (23 weken)**
14. Testing met Echte Senioren
15. Infrastructure (Prosody Server)
16. Kosten Breakdown
17. Risico's & Mitigaties
18. Success Criteria
19. Post-Launch Roadmap
20. Conclusie & Start Checklist

---

# 1. Project Visie & Doelgroep

## 1.1 Het Probleem

Senioren en hun familie willen gemakkelijk contact houden, maar:

- ❌ WhatsApp is te complex (teveel features, verwarrend)
- ❌ Privacy concerns (Facebook/Meta ownership)
- ❌ **Groepschats zijn rommelig** (teveel berichten, wie zei wat?)
- ❌ Kleine tekstjes en knoppen (niet toegankelijk)
- ❌ Te veel stappen om iets te doen (frustrerend)
- ❌ Angst om "iets kapot te maken"

## 1.2 De Oplossing: CommEazy

Een communicatie app speciaal ontworpen voor senioren:

- ✅ GROTE knoppen en tekst (makkelijk leesbaar)
- ✅ **Groepen tot 30 personen** (hele familie past erin!)
- ✅ **Duidelijk wie wat zegt** (naam boven elk bericht)
- ✅ Simpele interface (max 3 stappen)
- ✅ Veilig door design (P2P + E2E encrypted)
- ✅ Privacy-first (geen centrale data opslag)
- ✅ Alles in één app (chat, groepen, bellen, foto's)
- ✅ Familie kan helpen met setup (QR code scan)
- ✅ **Betaalbaar** (€2,50/jaar per persoon)
- ✅ Data blijft op eigen device

## 1.3 Doelgroep Persona's

| **Persona** | **Leeftijd** | **Needs** | **Use Case** |
|-------------|--------------|-----------|--------------|
| Opa Jan | 72 jaar | Wil dagelijks videobellen + **familie groep** | BBQ planning groep met 12 mensen |
| Oma Marie | 68 jaar | Wil foto's ontvangen + **groep nieuwtjes** | Seniorenclub groep (18 leden) |
| Dochter Lisa | 45 jaar | Wil **familie communicatie centraliseren** | Eén groep voor alles i.p.v. 8 aparte chats |

**🎯 Success Criterium:** Als Oma Marie binnen 2 minuten een groep kan maken met 12 familieleden en een foto kan sturen die iedereen ziet, dan is de app geslaagd.

---

# 2. Waarom Dit HAALBAAR is met Claude Code

## 2.1 Herziene Risk Assessment

| **Was (Te Paranoid)** | **Nu (Realistisch)** |
|----------------------|---------------------|
| Military-grade security | Veilig genoeg voor dagelijks gebruik |
| Zero-knowledge servers | **P2P + device-only storage** |
| Matrix Protocol (complex) | **XMPP + MUC (standaard)** |
| Self-hosted alles | **Alleen Prosody signaling server** |
| Geen groepen (te complex) | **Groepen met 30 max (pragmatisch)** |
| 42 weken development | **23 weken met Claude Code** |

## 2.2 Claude Code Capabilities voor Groepen

**🤖 Claude Code kan:** 78% van de groepschat code autonoom schrijven.

| **Component** | **Claude Code %** | **Jouw Rol** |
|---------------|-------------------|--------------|
| Realm schema (Group + GroupMessage) | 85% | Review, validate |
| Prosody MUC configuratie | 50% | Handmatige config, testing |
| Shared-key encryptie logica | 80% | Security review |
| Group UI componenten | 90% | UX decisions, senior testing |
| MUC join/leave flows | 75% | Edge case handling |
| Member selection UI | 85% | Design feedback |
| Auto-mute logic | 90% | Threshold tuning |
| Offline sync (groepen) | 60% | Complex debugging |

**Gemiddeld: 77% autonomie** - zeer haalbaar!

## 2.3 Vereiste Skills

Wat je MOET kunnen (of bereid zijn te leren):

| **Skill** | **Niveau** |
|-----------|-----------|
| JavaScript/TypeScript | Basis (Claude helpt met syntax) |
| React Native basics | Basis (concepts begrijpen) |
| **XMPP basics** | **Lezen van docs (Prosody MUC)** |
| Terminal/Command line | Comfortable |
| Git basics | Commit, push, pull |
| Linux server basics | SSH, systemd, logs bekijken |
| Testing op devices | Apps installeren via Xcode/Android Studio |
| **Cryptografie begrip** | **Symmetric vs asymmetric** |
| Debugging | Console logs, errors googlen |

**⏱️ Time Commitment:** Je hebt **30-35 uur per week nodig voor 23 weken**. Dit is een serieus project.

---

# 3. P2P + Device-Centric Architectuur

## 3.1 Architecture Principes

CommEazy volgt een **Device-Centric, Privacy-First** architectuur:

| **Principe** | **Betekenis** |
|--------------|---------------|
| **P1: Device is Source of Truth** | Alle data persistent op device (Realm/IndexedDB) |
| **P2: Minimal Central Dependency** | Prosody alleen voor signaling + presence + MUC routing |
| **P3: Privacy by Design** | E2E encrypted messages (1-op-1 + groepen) |
| **P4: User Controls Data** | Gebruiker kiest waar backup staat |
| **P5: Graceful Degradation** | P2P first, TURN fallback automatisch |
| **P6: Efficient Encryption** | **Shared-key voor groepen >8 leden** |
| **P7: Zero Server Storage** | **Prosody slaat GEEN berichten op - pure router** |

## 3.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GEBRUIKER DEVICES                         │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │   Oma's Tablet       │      │  Kleinzoon's Phone   │    │
│  │                      │      │                      │    │
│  │  ┌───────────────┐  │      │  ┌───────────────┐  │    │
│  │  │ CommEazy App  │  │      │  │ CommEazy App  │  │    │
│  │  └───────┬───────┘  │      │  └───────┬───────┘  │    │
│  │          │          │      │          │          │    │
│  │  ┌───────▼───────┐  │      │  ┌───────▼───────┐  │    │
│  │  │ XMPP Client   │  │      │  │ XMPP Client   │  │    │
│  │  │ (Strophe.js)  │  │      │  │ (Strophe.js)  │  │    │
│  │  │ + MUC Support │  │      │  │ + MUC Support │  │    │
│  │  └───────┬───────┘  │      │  └───────┬───────┘  │    │
│  │          │          │      │          │          │    │
│  │  ┌───────▼───────┐  │      │  ┌───────▼───────┐  │    │
│  │  │ WebRTC Engine │  │      │  │ WebRTC Engine │  │    │
│  │  └───────┬───────┘  │      │  └───────┬───────┘  │    │
│  │          │          │      │          │          │    │
│  │  ┌───────▼───────┐  │      │  ┌───────▼───────┐  │    │
│  │  │ Local Storage │  │      │  │ Local Storage │  │    │
│  │  │  (Realm DB)   │  │      │  │  (Realm DB)   │  │    │
│  │  │               │  │      │  │               │  │    │
│  │  │ • Contacts    │  │      │  │ • Contacts    │  │    │
│  │  │ • Messages    │  │      │  │ • Messages    │  │    │
│  │  │ • Groups      │  │      │  │ • Groups      │  │    │  ← NIEUW
│  │  │ • GroupMsgs   │  │      │  │ • GroupMsgs   │  │    │  ← NIEUW
│  │  └───────────────┘  │      │  └───────────────┘  │    │
│  └──────────┬───────────┘      └──────────┬─────────┘    │
│             │                             │              │
│             │    P2P Media (encrypted)    │              │
│             └─────────────────────────────┘              │
│                          │                               │
└──────────────────────────┼───────────────────────────────┘
                           │
                           │ Signaling + MUC Routing (WSS)
                           │
              ┌────────────▼────────────┐
              │   CENTRALE SIGNALING    │
              │                         │
              │  ┌──────────────────┐  │
              │  │ Jitsi Prosody    │  │
              │  │ XMPP Server      │  │
              │  │                  │  │
              │  │ • Presence       │  │
              │  │ • SDP routing    │  │
              │  │ • ICE routing    │  │
              │  │ • MUC (groepen)  │  │  ← NIEUW
              │  └──────────────────┘  │
              │                         │
              │  ┌──────────────────┐  │
              │  │ MUC Component    │  │  ← NIEUW
              │  │ conference.      │  │
              │  │ commeazy.nl      │  │
              │  │                  │  │
              │  │ Max 30 members   │  │
              │  │ ⚠️ ZERO STORAGE  │  │  ← NO MESSAGE ARCHIVING!
              │  └──────────────────┘  │
              │                         │
              │  ┌──────────────────┐  │
              │  │ STUN Server      │  │
              │  │ (NAT discovery)  │  │
              │  └──────────────────┘  │
              │                         │
              │  ┌──────────────────┐  │
              │  │ TURN Server      │  │
              │  │ (P2P fallback)   │  │
              │  └──────────────────┘  │
              │                         │
              │  ┌──────────────────┐  │
              │  │ Firebase FCM     │  │
              │  │ (Push only)      │  │
              │  └──────────────────┘  │
              └─────────────────────────┘
                    
              ┌─────────────────────────┐
              │   OPTIONELE BACKUP      │
              │                         │
              │ • Google Drive          │
              │ • iCloud                │
              │ • Lokale NAS            │
              │ • SD Card/USB           │
              │                         │
              │ (gebruiker bepaalt)     │
              └─────────────────────────┘
```

---

# 4. Tech Stack (Prosody XMPP + MUC)

## 4.1 Complete Tech Stack

### Frontend Dependencies:

```json
{
  "dependencies": {
    "react-native": "0.73+",
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/bottom-tabs": "^6.5.0",
    
    // XMPP voor messaging + signaling + MUC
    "strophe.js": "^2.0.0",
    "strophejs-plugin-muc": "^1.0.0",
    "react-native-webrtc": "^118.0.0",
    
    // Encryptie
    "libsodium-wrappers": "^0.7.11",
    "crypto-js": "^4.2.0",
    
    // Lokale opslag
    "realm": "^12.0.0",
    
    // Firebase (ALLEEN FCM + Auth)
    "@react-native-firebase/app": "^18.0.0",
    "@react-native-firebase/auth": "^18.0.0",
    "@react-native-firebase/messaging": "^18.0.0",
    
    // Media
    "react-native-image-picker": "^5.0.0",
    "react-native-document-picker": "^9.0.0",
    "react-native-fs": "^2.20.0",
    
    // UI
    "react-i18next": "^13.0.0"
  }
}
```

### Backend Services:

| **Service** | **Purpose** | **Cost** |
|-------------|-------------|----------|
| **Jitsi Prosody XMPP** | Signaling + Presence | Self-hosted |
| **Prosody MUC Component** | **Groepschat routing** | **Self-hosted** |
| **Coturn STUN/TURN** | NAT traversal | Self-hosted |
| **Firebase FCM** | Push notifications | Free tier |
| **Firebase Auth** | Phone verification | Free tier |

### Server Requirements:

```yaml
Prosody Server:
  CPU: 4 vCPU
  RAM: 6 GB (was 4 GB, +2 GB voor MUC)
  Disk: 50 GB SSD
  Network: 100 Mbps
  OS: Ubuntu 22.04 LTS
  
  Services:
    - Prosody XMPP (presence + signaling)
    - Prosody MUC (groepschat)
    - Coturn (STUN/TURN)
    - Certbot (SSL certificates)
    - Prometheus + Grafana (monitoring)
```

## 4.2 Data Architecture

### Realm DB Schema (Device-Only):

```typescript
// User Profile (singleton)
interface UserProfile {
  userId: string;
  xmppJID: string;  // oma@commeazy.nl
  displayName: string;
  privateKey: string; // libsodium Ed25519 private key (encrypted)
  publicKey: string;  // libsodium Ed25519 public key
  profilePhoto?: string;
  createdAt: Date;
  deviceId: string;
}

// Contacts (max 50)
interface Contact {
  id: string;
  xmppJID: string;
  displayName: string;
  publicKey: string;
  profilePhoto?: string;
  phoneNumber?: string;
  addedAt: Date;
  lastSeen?: Date;
  isOnline: boolean;
  verified: boolean;
}

// Groups (NIEUW!)
interface Group {
  id: string; // UUID
  name: string;
  creatorId: string; // xmppJID
  createdAt: Date;
  members: string[]; // Array van xmppJIDs (max 30)
  groupPhoto?: string;
  mutedBy: string[]; // Wie heeft groep gemuted
  mucRoomJID: string; // bijv: "groep-abc123@conference.commeazy.nl"
  encryptionMethod: 'encrypt-to-all' | 'shared-key'; // ≤8: encrypt-to-all, >8: shared-key
}

// Direct Messages
interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string; // xmppJID
  recipientId: string;
  type: 'text' | 'image';
  content: string; // Encrypted payload
  timestamp: Date;
  direction: 'sent' | 'received';
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  localMediaPath?: string;
}

// Group Messages (NIEUW!)
interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string; // xmppJID
  type: 'text' | 'image' | 'system'; // system = "Lisa heeft groep gemaakt"
  content: string; // Encrypted payload (shared-key of encrypt-to-all)
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  localMediaPath?: string;
  deliveredCount?: number; // Hoeveel leden ontvangen (voor UI)
  totalMembers?: number; // Totaal aantal leden (voor UI)
  encryptionKeys?: {[jid: string]: string}; // Voor shared-key: encrypted AES keys
}

// Outbox Messages (NIEUW! - Voor offline delivery)
interface OutboxMessage {
  id: string; // Same as GroupMessage.id
  groupId: string;
  content: string; // Already encrypted
  timestamp: Date;
  recipients: string[]; // All group members
  deliveredTo: string[]; // Who ACK'd
  pendingTo: string[]; // Still pending
  expiresAt: Date; // 7 days from send
  retryCount: number;
}

// Conversations (uitgebreid)
interface Conversation {
  id: string;
  type: 'direct' | 'group'; // ← NIEUW
  
  // Voor direct:
  participantId?: string;
  
  // Voor groepen:
  groupId?: string;
  
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
}

// Call History
interface CallLog {
  id: string;
  contactId: string;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing';
  status: 'completed' | 'missed' | 'declined' | 'failed';
  startTime: Date;
  duration: number; // seconds
  quality?: 'excellent' | 'good' | 'fair' | 'poor';
}

// Settings
interface Settings {
  notifications: boolean;
  autoBackup: boolean;
  backupLocation: 'none' | 'googledrive' | 'icloud' | 'local';
  backupFrequency: 'manual' | 'daily' | 'weekly';
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  lastBackupAt?: Date;
  groupAutoMuteThreshold: number; // Default: 15
}
```

---

# 5. Security Strategie (Dual Encryption)

## 5.1 Security Principes

**🔒 Security Filosofie:** Veilig GENOEG voor dagelijkse familie communicatie.

Wat we WEL doen:

- ✅ **E2E encrypted 1-op-1 chats (libsodium box)**
- ✅ **E2E encrypted groepschats (dual strategie)**
- ✅ P2P encrypted calls (DTLS-SRTP via WebRTC)
- ✅ Encrypted local storage (Realm encryption)
- ✅ TLS 1.3 voor XMPP signaling
- ✅ Public key verification (QR code pairing)
- ✅ Phone number verification (Firebase Auth)
- ✅ Secure defaults (geen opt-in vereist)

Wat we bewust NIET doen:

- ❌ Perfect forward secrecy (overkill voor familie chat)
- ❌ Double Ratchet (te complex, Signal-level)
- ❌ Zero-knowledge server (Prosody ziet metadata, acceptable)
- ❌ Custom crypto (use battle-tested libraries)

## 5.2 Dual Encryption Strategy

### Voor Kleine Groepen (≤8 leden): Encrypt-to-All

```javascript
// Simpel: encrypt voor elk lid apart
async function encryptToAll(message, members) {
  const payloads = {};
  
  for (const memberJID of members) {
    const contact = await getContact(memberJID);
    const encrypted = sodium.crypto_box_easy(
      message,
      nonce,
      contact.publicKey,
      myPrivateKey
    );
    payloads[memberJID] = sodium.to_base64(encrypted);
  }
  
  return {
    type: 'encrypt-to-all',
    payloads: payloads
  };
}
```

**Voordeel:** Simpel, battle-tested
**Nadeel:** Bericht grootte × aantal leden

### Voor Grote Groepen (>8 leden): Shared-Key

```javascript
// Efficient: één keer encrypten, keys delen
async function encryptSharedKey(message, members) {
  // 1. Genereer random AES-256 key
  const messageKey = crypto.randomBytes(32);
  
  // 2. Encrypt message EENMAAL met symmetric key
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', messageKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(message, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  
  // 3. Encrypt messageKey voor elk lid met hun public key
  const encryptedKeys = {};
  for (const memberJID of members) {
    const contact = await getContact(memberJID);
    encryptedKeys[memberJID] = sodium.crypto_box_easy(
      messageKey,
      nonce,
      contact.publicKey,
      myPrivateKey
    );
  }
  
  return {
    type: 'shared-key',
    encryptedContent: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encryptedKeys: encryptedKeys // 30 × ~100 bytes = 3 KB
  };
}
```

**Voordeel:** Efficient (1.2 MB voor foto, ongeacht groepsgrootte!)
**Nadeel:** Iets complexer, geen Perfect Forward Secrecy

## 5.3 Bandwidth Comparison

| **Scenario** | **Encrypt-to-All** | **Shared-Key** |
|--------------|-------------------|----------------|
| Text (8 leden) | ~4 KB | ~4 KB (vergelijkbaar) |
| Photo (8 leden) | ~10 MB | ~1.2 MB (8× kleiner!) |
| Text (30 leden) | ~15 KB | ~5 KB (3× kleiner) |
| Photo (30 leden) | ~36 MB | ~1.2 MB (30× kleiner!) |

**Conclusie:** Shared-key is ESSENTIEEL voor groepen >8.

## 5.4 Threat Model

Wat we beschermen TEGEN:

- ✅ Afluisteren door derde partijen
- ✅ Data leaks bij telefoon verlies
- ✅ Ongeautoriseerde toegang
- ✅ Man-in-the-middle aanvallen (via QR verification)
- ✅ Data mining door adverteerders
- ✅ **Server data breaches (zero storage!)**

Wat BUITEN scope is:

- ⚠️ Nation-state actors (NSA, AIVD)
- ⚠️ Fysieke toegang met forensics
- ⚠️ Zero-day exploits
- ⚠️ Quantum computing attacks

**Privacy Model (Zero Server Storage):**
- ✅ Prosody server ziet: wie in welke groep zit, wie is online (metadata)
- ✅ Prosody server ziet NIET: message content, media content
- ✅ **Prosody server slaat GEEN berichten op** - pure router
- ✅ Messages blijven op sender's device (outbox) tot delivered
- ✅ **Marketing claim:** "Wij slaan NIKS op de server!"

---

# 6. Complete Feature Set

## 6.1 MVP V1.0 Features (23 weken)

| **Feature** | **Beschrijving** | **Priority** |
|-------------|------------------|--------------|
| 1-op-1 Chat | E2E encrypted tekstberichten | MUST |
| **Groepschat** | **E2E encrypted, max 30 personen** | **MUST** |
| **Groep aanmaken** | **Naam + leden selecteren** | **MUST** |
| **Groep beheren** | **Verlaat groep, mute notificaties** | **MUST** |
| Foto's Delen | Camera + galerij, lokaal opslag (1-op-1 + groepen) | MUST |
| Audio Calls | P2P voice calls (ALLEEN 1-op-1) | MUST |
| Video Calls | P2P video calls (ALLEEN 1-op-1) | MUST |
| Contact toevoegen | QR code scanning | MUST |
| Presence | Online/offline status | MUST |
| Push Notifications | Via Firebase FCM (1-op-1 + groepen) | MUST |
| Backup/Restore | Encrypted backup (inclusief groepen) | MUST |
| Phone Fallback | Bel via native phone als contact offline | SHOULD |

## 6.2 EXPLICIET BUITEN MVP V1.0

Deze features komen LATER:

- ❌ **Groep audio/video calls** (vereist Videobridge SFU - complex!)
- ❌ Bestanden Delen (PDF, DOC)
- ❌ Video's Delen
- ❌ Voice messages
- ❌ Location sharing
- ❌ Message reactions
- ❌ Message editing
- ❌ Disappearing messages
- ❌ @mentions in groepen
- ❌ Threaded replies
- ❌ TV-kijken
- ❌ Audioboeken
- ❌ Desktop app
- ❌ Web app
- ❌ Dark mode
- ❌ Custom ringtones
- ❌ Status updates / Stories

**🎯 Focus:** 1-op-1 + Groepschat + Calls + Foto's. Dat is ALLES.

---

# 7. Groepschat Specificaties

## 7.1 Constraints (Simplicity voor Senioren)

| **Aspect** | **Constraint** | **Waarom** |
|------------|----------------|------------|
| Max groepsgrootte | **30 personen** | Fits extended families, efficient encryption |
| Groep aanmaken | **Alleen creator** | Voorkomt chaos |
| Leden toevoegen | **Alleen uit bestaande contacten** | Veiligheid |
| Groep verlaten | **Simpele "Verlaat" knop** | No complex admin |
| Groep verwijderen | **Alleen creator, of laatste lid** | Clear ownership |
| Groep naam wijzigen | **Alleen creator** | Voorkomt naam-chaos |
| Groep foto | **Optioneel, alleen creator** | Visuele herkenning |
| Notificaties | **Auto-mute >15 leden** | Prevent fatigue |
| Admin roles | **GEEN** | Te complex |
| Kick members | **GEEN** | Avoid drama |
| Join links | **GEEN** | Veiligheidsrisico |
| @mentions | **GEEN** | Niet nodig bij 30 |

## 7.2 User Flows

### Flow 1: Groep Aanmaken

```
Lisa wil groep maken:

1. Chats tab → Tik ➕ (rechtsboven)
2. Menu:
   [👤 Nieuw 1-op-1 gesprek]
   [👥 Nieuwe groep]
   
3. Tik "Nieuwe groep"
4. Voer naam in: "BBQ Familie 2026"
5. Selecteer leden (checkboxes):
   [✓] Opa Jan
   [✓] Oma Marie
   [✓] Tom
   [✓] Opa Piet
   [✓] Oma Els
   [✓] Mark
   [✓] Sophie
   
   7/30 leden geselecteerd
   
6. Tik "Maak groep"
7. ✅ Groep gemaakt!
```

**Time: <2 minuten**

### Flow 2: Groepsbericht Sturen

```
Oma Marie stuurt foto in BBQ groep:

1. Chats tab → Tik groep "BBQ Familie 2026"
2. Chat screen toont:
   - Namen boven berichten
   - "Oma Marie (jij)" voor eigen berichten
3. Tik 📷 → Maak foto → Gebruik
4. Tik →
5. Foto verstuurd naar alle 7 anderen
```

**Encryption:**
- 7 leden (≤8) → Encrypt-to-all (7 × 1.2 MB = 8.4 MB)
- Upload time: ~8 sec op 4G ✅ Acceptabel

### Flow 3: Grote Groep (Seniorenclub)

```
Oma Marie maakt seniorenclub groep (18 leden):

1. Maak groep "Seniorenclub De Parel"
2. Selecteer 17 anderen (18 totaal)
3. Groep gemaakt → Auto-mute dialog:
   
   ┌─────────────────────────────────┐
   │  💡 Grote groep gemaakt         │
   ├─────────────────────────────────┤
   │  Notificaties zijn automatisch  │
   │  uitgezet om teveel meldingen   │
   │  te voorkomen.                  │
   │                                 │
   │  Je kunt ze aanzetten in        │
   │  groep instellingen.            │
   │                                 │
   │  [Begrepen]                     │
   └─────────────────────────────────┘

4. Marie stuurt foto
```

**Encryption:**
- 18 leden (>8) → Shared-key (1.2 MB + 2 KB keys)
- Upload time: ~1.2 sec op 4G ✅ Excellent!

---

# 8. UI/UX voor Senioren

## 8.1 Design Principes

1. GROTE lettertype (min 18pt, headings 24pt+)
2. GROTE knoppen (min 60x60pt touch targets)
3. HOOG contrast (donker op licht)
4. SIMPELE flows (max 3 stappen)
5. DUIDELIJKE labels (geen jargon)
6. **DUIDELIJK wie wat zegt** (naam boven elk groepsbericht)
7. FEEDBACK (bevestiging bij elke actie)
8. UNDO mogelijk
9. CONSISTENT (zelfde patronen overal)
10. GEDULDIG (geen timeouts)

## 8.2 Bottom Navigation (3 Tabs)

| **Tab** | **Icon** | **Functie** |
|---------|----------|-------------|
| 1. Chats | 💬 | 1-op-1 + Groepen (alles in één lijst) |
| 2. Calls | 📞 | Call History + Initiate Call |
| 3. Contacts | 👥 | Adresboek + Add Contact |

## 8.3 Groep vs 1-op-1 Visual Differences

### In Chats List:

```
┌─────────────────────────────────────┐
│  💬 Chats                      [+]  │
├─────────────────────────────────────┤
│  👥 BBQ Familie 2026                │  ← Groep (icoon)
│     Marie: Klinkt goed!             │
│     12:34                       (2) │
│                                     │
│  👤 Opa Jan                         │  ← 1-op-1 (icoon)
│     Dag lieverd                     │
│     11:20                           │
│                                     │
│  👥 Seniorenclub De Parel           │  ← Groep
│     Els: Tot morgen!                │
│     10:15  🔇                   (5) │  ← Muted
└─────────────────────────────────────┘
```

**Verschillen:**
- Icon: 👥 (groep) vs 👤 (persoon)
- Sender getoond: "Marie:" (groep) vs geen sender (1-op-1)
- Mute icon: 🔇 (als gemuted)

### In Chat Screen:

**1-op-1:**
```
┌─────────────────────────────────────┐
│  [←]  🟢 Opa Jan            [⋮]    │
│       Online nu                     │
├─────────────────────────────────────┤
│  ┌──────────────────┐               │
│  │ Hoi!             │               │  ← Grijs (ander)
│  └──────────────────┘               │
│     09:02                           │
│                                     │
│               ┌──────────────────┐  │
│               │ Hoi pa!          │  │  ← Groen (jij)
│               └──────────────────┘  │
│                     09:03  ✓✓      │
```

**Groep:**
```
┌─────────────────────────────────────┐
│  [←]  👥 BBQ Familie 2026   [⋮]    │
│       8 leden                       │
├─────────────────────────────────────┤
│  Marie                      12:30   │  ← Naam erboven
│  ┌──────────────────┐               │
│  │ Hi! Zondag BBQ   │               │
│  └──────────────────┘               │
│                                     │
│  Piet                       12:31   │
│  ┌──────────────────┐               │
│  │ Wij komen! 👍    │               │
│  └──────────────────┘               │
│                                     │
│  Oma Marie (jij)            12:32   │  ← Jouw bericht
│               ┌──────────────────┐  │
│               │ Super!           │  │
│               └──────────────────┘  │
```

**Key UX points:**
- Naam **boven** bubble (14pt)
- Eigen: "Oma Marie (jij)"
- Anderen: Alleen voornaam
- Kleuren blijven: grijs (anderen), groen (jij)

## 8.4 Groep Info Screen

```
┌─────────────────────────────────────┐
│  [←]  👥 BBQ Familie 2026           │
├─────────────────────────────────────┤
│         (Groep foto)                │
│                                     │
│  📋 Leden (8)                       │
│                                     │
│  👤 Lisa de Vries (maker)           │
│     🟢 Online nu                    │
│                                     │
│  👤 Opa Jan                         │
│     🟢 Online nu                    │
│                                     │
│  👤 Oma Marie (jij)                 │
│     🟢 Online nu                    │
│                                     │
│  👤 Tom                             │
│     ⚪ Offline                      │
│     Laatst gezien: 2 uur geleden    │
│                                     │
│  ... (4 meer, scroll)               │
│                                     │
│  [🔇 Notificaties: UIT]             │
│  [🚪 Verlaat groep]                 │
│                                     │
└─────────────────────────────────────┘
```

---

# 9. XMPP Messaging + MUC Systeem

## 9.1 XMPP Architecture

CommEazy gebruikt **Prosody XMPP** voor:
- Presence (online/offline status)
- Message routing (1-op-1)
- **MUC (Multi-User Chat) voor groepen**
- Call signaling (SDP exchange)

## 9.2 Prosody MUC Configuration

```lua
-- /etc/prosody/prosody.cfg.lua

-- Enable MUC component
Component "conference.commeazy.nl" "muc"
  name = "CommEazy Groepen"
  restrict_room_creation = "local" -- Alleen registered users
  
  -- Room settings
  muc_room_locking = false
  muc_room_default_public = false
  muc_room_default_members_only = true
  muc_room_default_persistent = true
  max_history_messages = 50 -- Voor offline sync
  
  -- Message archiving (24h retention)
  modules_enabled = { "muc_mam" }
  muc_log_expires_after = "1d" -- Auto-delete after 24h
  
  -- Limits
  max_occupants = 30 -- Max 30 leden per groep
```

## 9.3 Group Message Flow

### Small Group (≤8): Encrypt-to-All

```javascript
async function sendGroupMessage(groupId, plaintext) {
  const group = await getGroup(groupId);
  
  if (group.members.length <= 8) {
    // Encrypt-to-all
    const encrypted = await encryptToAll(plaintext, group.members);
    
    const message = $msg({
      to: group.mucRoomJID,
      type: 'groupchat'
    }).c('body').t(JSON.stringify({
      type: 'group-message',
      encryptionMethod: 'encrypt-to-all',
      groupId: groupId,
      senderId: myJID,
      timestamp: Date.now(),
      payloads: encrypted.payloads
    }));
    
    connection.send(message);
  }
}
```

### Large Group (>8): Shared-Key

```javascript
async function sendGroupMessage(groupId, plaintext) {
  const group = await getGroup(groupId);
  
  if (group.members.length > 8) {
    // Shared-key encryption
    const encrypted = await encryptSharedKey(plaintext, group.members);
    
    const message = $msg({
      to: group.mucRoomJID,
      type: 'groupchat'
    }).c('body').t(JSON.stringify({
      type: 'group-message',
      encryptionMethod: 'shared-key',
      groupId: groupId,
      senderId: myJID,
      timestamp: Date.now(),
      encryptedContent: encrypted.encryptedContent,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      encryptedKeys: encrypted.encryptedKeys
    }));
    
    connection.send(message);
  }
}
```

## 9.4 MUC Presence

```javascript
// Join groep
function joinGroup(group) {
  const presence = $pres({
    to: `${group.mucRoomJID}/${myDisplayName}`
  }).c('x', {xmlns: 'http://jabber.org/protocol/muc'});
  
  connection.send(presence);
}

// Receive member presence
connection.addHandler((pres) => {
  const from = pres.getAttribute('from');
  const roomJID = Strophe.getBareJidFromJid(from);
  const memberNick = Strophe.getResourceFromJid(from);
  const type = pres.getAttribute('type');
  
  if (type === 'unavailable') {
    // Member left or went offline
    updateMemberStatus(roomJID, memberNick, 'offline');
  } else {
    // Member joined or online
    updateMemberStatus(roomJID, memberNick, 'online');
  }
}, null, 'presence');
```

## 9.5 Offline Message Delivery (Zero Server Storage)

**Architectuur Keuze:** CommEazy slaat GEEN berichten op de server.

### Waarom Geen Server Storage?

| **Aspect** | **Reden** |
|------------|-----------|
| Privacy | Consistent met "data op device" principe |
| GDPR | Geen server storage = geen data processor verplichtingen |
| Marketing | "Wij slaan NIKS op de server!" = differentiator |
| Trust | Senioren waarderen transparantie |

### Hoe Offline Delivery Werkt:

```javascript
// Step 1: Send + Save to Outbox
async function sendGroupMessage(groupId, plaintext) {
  const encrypted = await encryptMessage(plaintext, group);
  const msgId = generateUUID();
  
  // Save in LOCAL outbox FIRST
  await realm.create('OutboxMessage', {
    id: msgId,
    groupId: groupId,
    content: encrypted,
    recipients: group.members,
    deliveredTo: [],
    pendingTo: group.members,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  
  // Send via MUC
  const msg = $msg({
    to: group.mucRoomJID,
    type: 'groupchat',
    id: msgId
  }).c('body').t(encrypted);
  
  connection.send(msg);
}

// Step 2: Receive + ACK
connection.addHandler((msg) => {
  const msgId = msg.getAttribute('id');
  const from = msg.getAttribute('from');
  const body = msg.getElementsByTagName('body')[0].textContent;
  
  // Decrypt and save
  await saveGroupMessage(body);
  
  // Send ACK back to sender (direct, NOT via MUC)
  const ack = $msg({
    to: Strophe.getBareJidFromJid(from),
    type: 'chat'
  }).c('received', {
    xmlns: 'urn:xmpp:receipts',
    id: msgId
  });
  
  connection.send(ack);
}, null, 'message', 'groupchat');

// Step 3: Handle ACKs
connection.addHandler((msg) => {
  const receivedEl = msg.getElementsByTagName('received')[0];
  const msgId = receivedEl.getAttribute('id');
  const from = msg.getAttribute('from');
  
  // Update outbox
  const outboxMsg = await getOutboxMessage(msgId);
  if (outboxMsg) {
    outboxMsg.deliveredTo.push(from);
    outboxMsg.pendingTo = outboxMsg.pendingTo.filter(jid => jid !== from);
    
    // All delivered? Remove from outbox
    if (outboxMsg.pendingTo.length === 0) {
      await realm.delete(outboxMsg);
    }
  }
}, null, 'message', 'chat');

// Step 4: Offline Member Sync
async function onMemberBackOnline(memberJID, groupId) {
  // Member broadcasts: "I'm back, any missed messages?"
  const syncRequest = $msg({
    to: `${groupId}@conference.commeazy.nl`,
    type: 'groupchat'
  }).c('sync-request', {
    xmlns: 'commeazy:sync',
    from: myJID,
    since: await getLastSeenTimestamp(groupId)
  });
  
  connection.send(syncRequest);
}

// Step 5: Respond to Sync Requests
connection.addHandler((msg) => {
  const syncReq = msg.getElementsByTagName('sync-request')[0];
  if (syncReq) {
    const requestingMember = syncReq.getAttribute('from');
    const since = syncReq.getAttribute('since');
    
    // Check outbox for pending messages
    const pendingMsgs = await realm.objects('OutboxMessage')
      .filtered('pendingTo CONTAINS $0 AND timestamp > $1', 
                requestingMember, new Date(since));
    
    // Resend directly (P2P via Prosody routing)
    for (const msg of pendingMsgs) {
      const resend = $msg({
        to: requestingMember,
        type: 'chat',
        id: msg.id
      }).c('body').t(msg.content);
      
      connection.send(resend);
    }
  }
}, null, 'message', 'groupchat');

// Step 6: Expiry Cleanup
async function cleanupExpiredOutbox() {
  const expired = await realm.objects('OutboxMessage')
    .filtered('expiresAt < $0', new Date());
  
  for (const msg of expired) {
    if (msg.pendingTo.length > 0) {
      // Notify user
      showNotification({
        title: 'Bericht niet afgeleverd',
        body: `Je bericht is niet bij ${msg.pendingTo.length} leden aangekomen (>7 dagen offline).`
      });
    }
    await realm.delete(msg);
  }
}
```

### UI Delivery Status

```
Senior-vriendelijke status berichten:

"✓ Verzonden aan 15/18"              ← In progress
"✓✓ Afgeleverd aan iedereen"         ← Success
"⚠️ 3 leden nog offline"              ← Transparency
"❌ Niet aangekomen bij 2 leden"     ← After 7 days expiry
```

**Voordelen:**
- ✅ ZERO server storage (pure P2P)
- ✅ Transparent delivery tracking
- ✅ User knows exactly what's happening
- ✅ Privacy maximaal

**Trade-off:**
- ⚠️ Sender moet online blijven tot delivery (of binnen 7 dagen)
- ⚠️ Als sender's app uninstalled → outbox berichten verloren
- ✅ Maar: dit is acceptabel voor privacy-first approach

---

# 10. P2P Calls via Prosody

(Identiek aan vorige versie - GEEN wijzigingen)

**BELANGRIJK:** Groep calls (audio/video conference) zijn NIET in MVP V1.0.
Alleen 1-op-1 calls zijn supported.

Voor groep calls is een SFU (Selective Forwarding Unit) nodig zoals Jitsi Videobridge.
Dit komt in Post-MVP.

---

# 11. Device Storage & Backup

## 11.1 Backup Creation (inclusief Groepen)

```javascript
async function createBackup(userPIN) {
  // 1. Verzamel alle data (INCLUSIEF GROEPEN)
  const data = {
    userProfile: await realm.objects('UserProfile').toJSON(),
    contacts: await realm.objects('Contact').toJSON(),
    directMessages: await realm.objects('DirectMessage').toJSON(),
    groups: await realm.objects('Group').toJSON(), // ← NIEUW
    groupMessages: await realm.objects('GroupMessage').toJSON(), // ← NIEUW
    callHistory: await realm.objects('CallLog').toJSON(),
    settings: await realm.objects('Settings').toJSON()
  };
  
  // 2. Encrypt met PIN
  const salt = crypto.randomBytes(16);
  const key = await deriveKeyFromPIN(userPIN, salt);
  const encrypted = await encryptData(JSON.stringify(data), key);
  
  // 3. Create backup file
  const backupBlob = {
    version: '1.0',
    timestamp: Date.now(),
    deviceId: settings.deviceId,
    salt: salt.toString('base64'),
    data: encrypted.toString('base64')
  };
  
  return backupBlob;
}
```

**Backup bevat:**
- ✅ Alle 1-op-1 chats
- ✅ Alle groepschats
- ✅ Groep metadata (leden, namen)
- ✅ Contacten + public keys
- ✅ Call history
- ✅ Settings

---

# 12. Claude Code Development Workflow

(Identiek aan vorige versie - geen wijzigingen)

---

# 13. Week-bij-Week Roadmap (23 weken)

## Phase 1: Foundation (Weken 1-4)

### Week 1: Setup & Prosody
- React Native project setup
- Prosody server opzetten (Ubuntu VPS)
- **Prosody MUC component enable**
- Coturn STUN/TURN configuratie
- SSL certificates (Let's Encrypt)
- Firebase project (FCM + Auth only)

### Week 2: XMPP Client + MUC
- Strophe.js integratie
- **strophejs-plugin-muc setup**
- XMPP connection manager
- Presence system
- **MUC join/leave basic flows**
- Message routing (text only)

### Week 3: Local Storage
- Realm database schema
- User profile management
- Contact CRUD operations
- Message persistence
- **Group + GroupMessage schema**

### Week 4: Encryption
- libsodium setup
- Key generation (Ed25519)
- **1-op-1 message encryption** (libsodium box)
- **Encrypt-to-all logic** (kleine groepen)
- **Shared-key encryption** (grote groepen)
- Key storage (secure)

**Milestone 1:** Can send encrypted text message 1-op-1 + basic MUC setup done

---

## Phase 2: Core Features (Weken 5-8)

### Week 5: Authentication
- Firebase phone auth
- XMPP account creation
- User onboarding flow

### Week 6: Contact Management
- QR code generation
- QR scanner (camera)
- Contact verification
- Public key exchange

### Week 7: Chat UI (1-op-1)
- ChatScreen implementation
- Message bubbles (sent/received)
- Input field + send button
- Scroll behavior
- Online/offline indicators

### Week 8: Photos (1-op-1)
- Image picker integration
- Photo compression
- Photo encryption (libsodium)
- Display in chat

**Milestone 2:** Complete 1-op-1 chat + photos werkend

---

## Phase 3: Groups (Weken 9-11) ← NIEUW!

### Week 9: Group Creation & UI
- GroupCreateScreen (naam + member selection)
- GroupList component (in Chats tab)
- Group vs 1-op-1 visual differences
- Member selection UI (max 30 checkboxes)
- Auto-mute logic (>15 members)
- Group info screen

### Week 10: Group Messaging
- GroupChatScreen implementation
- Sender names boven berichten
- Encrypt-to-all implementatie (<8 members)
- Shared-key encryption implementatie (>8 members)
- MUC message send/receive
- Group photo support

### Week 11: Group Features Complete
- **Outbox implementation** (client-side message queue)
- **Member-to-member offline sync protocol**
- ACK handling (delivery receipts)
- Sync request/response flows
- Group leave flow
- Group mute/unmute
- Group member presence tracking
- Typing indicators (groepen)
- Push notifications (groepen)
- **Expiry handling** (7 days outbox retention)

**Milestone 3:** Groepschat volledig werkend (30 leden, E2E encrypted, zero server storage)

---

## Phase 4: Calls (Weken 12-15)

### Week 12: WebRTC Setup
- react-native-webrtc integration
- PeerConnection management
- Media permissions

### Week 13: Call Signaling
- SDP exchange via XMPP
- ICE candidates routing
- Offer/Answer flow

### Week 14: Call UI
- Incoming call screen
- Active call screen
- Call controls (mute, speaker, hangup)
- Phone fallback (native Phone.app)

### Week 15: Call Polish
- Call history logging
- Reconnection logic
- Network quality indicators
- Testing met senioren!

**Milestone 4:** P2P voice + video calls (1-op-1) werkend

---

## Phase 5: Backup & Polish (Weken 16-19)

### Week 16: Backup System
- Backup creation (PIN encryption)
- **Groepen included in backup**
- Google Drive integration
- iCloud integration

### Week 17: Restore System
- Backup selection UI
- Decryption + validation
- Data import to Realm
- **Group restore support**

### Week 18: Settings & Senior Testing
- Settings screen
- Notification preferences
- Font size controls
- **Senior testing round 1 (10 senioren)**
- **Test groepen met 8, 15, 25 leden**
- Collect feedback

### Week 19: Bug Fixes & Polish
- Fix bugs from senior testing
- Performance optimization
- UI polish
- Accessibility improvements

**Milestone 5:** App volledig functioneel + backup + tested

---

## Phase 6: Launch Prep (Weken 20-23)

### Week 20: Testing Round 2
- Senior testing (10 senioren)
- **Groep scenario's testen**
- Bug fixes
- Performance tuning

### Week 21: Documentation & Assets
- App Store screenshots
- Descriptions (NL + EN)
- Privacy policy
- **Groepen in marketing** ("Tot 30 personen!")

### Week 22: Final Testing
- Security audit
- Load testing (30-member groep)
- Encryption verification
- Bandwidth testing

### Week 23: App Store Launch
- Submit to Apple App Store
- Submit to Google Play Store
- Press release
- **LAUNCH! 🚀**

**Milestone 6:** CommEazy V1.0 live met groepschat!

---

# 14. Testing met Echte Senioren

## 14.1 Test Scenarios (Week 18 & 20)

**Scenario 1: Groep Aanmaken**
- Senior maakt groep met 8 familieleden
- Time to complete: <2 min
- Success rate: >80%

**Scenario 2: Groepsbericht Sturen**
- Senior stuurt tekst in groep
- Alle leden ontvangen binnen 3 sec
- Success rate: >90%

**Scenario 3: Groepsfoto Delen**
- Senior stuurt foto in groep (18 leden)
- Foto upload <10 sec (shared-key!)
- Success rate: >85%

**Scenario 4: Grote Groep (25 leden)**
- Test notification fatigue
- Verify auto-mute werkt
- Verify shared-key efficiency

**Scenario 5: Groep Verlaten**
- Senior verlaat groep
- Begrijpt dat berichten weg zijn
- Success rate: >90%

## 14.2 Critical Test Metrics

| **Metric** | **Target** |
|------------|------------|
| Groep aanmaken tijd | <2 min |
| Message delivery (groep) | <3 sec |
| Photo upload (8 leden) | <10 sec (encrypt-to-all) |
| Photo upload (30 leden) | <2 sec (shared-key!) |
| Senior task completion | >80% |
| Frustration level | <2/5 |
| "Wie zei wat?" confusion | <20% |
| Notification fatigue complaints | <10% (met auto-mute) |

---

# 15. Infrastructure (Prosody Server)

## 15.1 Server Requirements (Updated voor MUC)

```yaml
Provider: DigitalOcean / Hetzner / OVH
Location: Amsterdam (EU, GDPR)
  
Specs:
  CPU: 4 vCPU
  RAM: 6 GB (was 4 GB, +2 GB voor MUC state)
  Disk: 50 GB SSD
  Network: 1 Gbps (100 Mbps sustained)
  Cost: €25/maand (was €20)

OS: Ubuntu 22.04 LTS

Services:
  - Prosody XMPP (port 5222, 5269, 5281 WSS)
  - Prosody MUC (conference.commeazy.nl)
  - Coturn STUN/TURN (port 3478, 5349)
  - Certbot (SSL auto-renew)
  - Prometheus (monitoring)
  - Grafana (dashboards)
```

## 15.2 Prosody Configuration (Zero Storage)

```lua
-- /etc/prosody/prosody.cfg.lua

-- Minimal modules
modules_enabled = {
  "roster";      -- Contact lists
  "presence";    -- Online/offline
  "ping";        -- Keepalive
  "tls";         -- SSL/TLS
  "saslauth";    -- Authentication
  "smacks";      -- Stream management
}

modules_disabled = {
  "muc";         -- No MUC here (separate component)
  "mam";         -- NO message archive
  "http_upload"; -- No file upload
}

-- ⚠️ CRITICAL: NO message storage (privacy!)
archive_expires_after = "never" -- We don't archive at all

-- SSL
ssl = {
  key = "/etc/prosody/certs/privkey.pem";
  certificate = "/etc/prosody/certs/fullchain.pem";
}

-- Virtual host
VirtualHost "commeazy.nl"
  authentication = "internal_plain"

-- ⚠️ MUC Component (ZERO STORAGE!)
Component "conference.commeazy.nl" "muc"
  name = "CommEazy Groepen"
  restrict_room_creation = "local"
  
  -- Room settings
  muc_room_locking = false
  muc_room_default_public = false
  muc_room_default_members_only = true
  muc_room_default_persistent = true
  
  -- ⚠️ CRITICAL: ZERO MESSAGE STORAGE
  max_history_messages = 0  -- No history retention
  
  -- ⚠️ CRITICAL: NO MAM
  -- modules_enabled = {}  -- Empty! No archiving modules!
  
  -- Limits
  max_occupants = 30
  
  -- Room defaults
  muc_room_default_language = "nl"
  muc_room_default_history_length = 0  -- No history
```

**Result:** 
- ✅ Prosody = stateless message router
- ✅ ZERO server storage
- ✅ Privacy maximaal
- ✅ GDPR ultra-compliant

---

# 16. Kosten Breakdown

## 16.1 Jaar 1 Kosten (Met Groepen)

| **Item** | **Cost** | **Frequency** | **Jaar 1** |
|----------|----------|---------------|------------|
| **Domains** | | | |
| commeazy.com | €12 | Jaarlijks | €12 |
| commeasy.com | €12 | Jaarlijks | €12 |
| **Hosting** | | | |
| Prosody VPS (6GB) | €25 | Maandelijks | €300 |
| Backup storage | €5 | Maandelijks | €60 |
| **SSL** | | | |
| Let's Encrypt | €0 | Gratis | €0 |
| **Development** | | | |
| Apple Developer | €99 | Jaarlijks | €99 |
| Google Play | €25 | Eenmalig | €25 |
| **Services** | | | |
| Firebase (FCM + Auth) | €0 | Gratis tier | €0 |
| Monitoring (Grafana Cloud) | €0 | Gratis tier | €0 |
| **TOTAAL** | | | **€508/jaar** |

**Met buffer (20%):** €610/jaar

## 16.2 Vergelijking met Origineel Plan

| **Item** | **Was (zonder groepen)** | **Nu (met groepen)** | **Delta** |
|----------|--------------------------|----------------------|-----------|
| VPS RAM | 4 GB (€20/maand) | 6 GB (€25/maand) | +€60/jaar |
| Timeline | 20 weken | 23 weken | +3 weken |
| Features | 1-op-1 only | 1-op-1 + Groepen (30) | Huge value! |
| **Totaal cost** | €600/jaar | **€660/jaar** | +€60/jaar |

**Extra €60/jaar voor groepschat = absoluut de moeite waard!**

---

# 17. Risico's & Mitigaties

## 17.1 Technical Risks (Groepen Specifiek)

| **Risk** | **Impact** | **Probability** | **Mitigation** |
|----------|------------|-----------------|----------------|
| Shared-key encryptie bugs | HIGH | MEDIUM | Extensive unit tests, crypto lib battle-tested |
| **Outbox sync race conditions** | **HIGH** | **MEDIUM** | **Use message IDs, sequence tracking, thorough testing** |
| Groep foto >10 MB fails | MEDIUM | LOW | Compress to max 800 KB voor groepen |
| 30 simultane typers = lag | LOW | LOW | Debounce, show max 3 typing indicators |
| **Sender offline >7 days = lost messages** | **MEDIUM** | **LOW** | **Educate users, show clear expiry warnings** |
| **ACK delivery failures** | **MEDIUM** | **MEDIUM** | **Retry logic, fallback to sync-request** |

## 17.2 UX Risks (Groepen Specifiek)

| **Risk** | **Impact** | **Mitigation** |
|----------|------------|----------------|
| Senioren confused door eigen naam | MEDIUM | "(jij)" label, extensive testing |
| Notification fatigue grote groepen | HIGH | Auto-mute >15, educatie |
| "Wie zei wat?" verwarring | MEDIUM | Naam boven bubble (14pt), testen |
| Groep verlaten per ongeluk | LOW | Confirmation dialog |

## 17.3 Timeline Risks

| **Risk** | **Impact** | **Mitigation** |
|----------|------------|----------------|
| Groep features >3 weken | CRITICAL | Early testing week 11, buffer in planning |
| MUC configuratie complex | MEDIUM | Start week 1, use default settings |
| Senior testing reveals UX issues | HIGH | Prototype test week 12 (4 senioren) |

---

# 18. Success Criteria

## 18.1 Technical KPIs

- ✅ **Groep message delivery: >95% binnen 3 sec (voor online members)**
- ✅ **Offline sync success: >90% binnen 10 sec of member back online**
- ✅ **Outbox ACK tracking: 100% accurate**
- ✅ **Shared-key foto upload (30 leden): <5 sec**
- ✅ Call success rate: >90%
- ✅ P2P connection rate: >80%
- ✅ App crash rate: <1%
- ✅ Backup success rate: >95%
- ✅ **Zero server storage verified: 100%**

## 18.2 User KPIs (Groepen)

- ✅ **Groep aanmaken completion: >80%**
- ✅ **"Wie zei wat?" confusion: <20%**
- ✅ **Notification fatigue complaints: <10%**
- ✅ Onboarding completion: >70%
- ✅ Daily active users: >50%
- ✅ Senior satisfaction: NPS >40

## 18.3 Launch Criteria

App MAG NIET launchen zonder:

- ✅ Senior user testing (min 10 mensen, 65+)
- ✅ **Groepen getest met 8, 15, 25 leden**
- ✅ Security audit (encryptie beide methodes)
- ✅ **Offline delivery getest** (sender offline, member sync)
- ✅ **Zero storage verified** (Prosody logs checken: geen message storage)
- ✅ **Outbox expiry tested** (7 dagen scenario)
- ✅ **MUC load test** (100 groepen, 30 leden each)
- ✅ Privacy policy (GDPR compliant)
- ✅ Prosody server stable (99% uptime 1 week)
- ✅ Backup/restore getest op 5 devices

---

# 19. Post-Launch Roadmap

## 19.1 Maand 1-3 na Launch

- Fix bugs from production
- **Groep features optimalisatie** (based on usage data)
- Onboarding optimalisatie
- Performance tuning
- User feedback implementeren

## 19.2 Maand 4-6

**Feature: Groep Audio/Video Calls**
- Videobridge SFU opzetten
- Max 8 personen audio/video conference
- Groep call UI

## 19.3 Maand 7-12

**Feature: Advanced Groep Features**
- @mentions in groepen
- Reply to specific message
- Group polls (vote)
- Group photo album

**Feature: Media Delen**
- Video's delen (compressed)
- Bestanden delen (PDF, DOC)
- Voice memos

## 19.4 Jaar 2+

**Toekomstige Features:**
- Desktop app
- TV-kijken (remote watch party)
- Audioboeken
- Message reactions
- Message editing
- Dark mode

**Alleen als bewezen behoefte!**

---

# 20. Conclusie & Start Checklist

## 20.1 Is Dit Haalbaar?

**JA**, met deze voorwaarden:

- ✅ Je kunt 30+ uur/week investeren
- ✅ Je gebruikt Claude Code voor 78% van code
- ✅ Je STRIKTE focus op MVP features
- ✅ Je test vroeg en vaak met senioren
- ✅ **Je accepteert dat groepen de #1 priority zijn**
- ✅ Je accepteert 23 weken timeline

## 20.2 Pre-Start Checklist

**Week -2:**
- [ ] VPS huren (€25/maand, 6 GB RAM)
- [ ] Domains registreren (commeazy.com + .nl)
- [ ] Firebase project aanmaken (FCM only)
- [ ] Apple Developer account (€99)
- [ ] Google Play Developer (€25)

**Week -1:**
- [ ] Claude Code installeren + configureren
- [ ] React Native dev environment
- [ ] Prosody installeren op VPS
- [ ] **Prosody MUC component enable**
- [ ] SSL certificaten (Let's Encrypt)
- [ ] Git repo setup

**Week 0:**
- [ ] Kick-off! Start met Week 1 roadmap
- [ ] Recruit 10 senioren voor testing (week 18)
- [ ] **Plan groep test scenarios**

## 20.3 Final Words

CommEazy V1.0 met **groepschat (max 30 personen)** en **zero server storage** is een **ambitieus maar haalbaar** project.

**De sleutel tot success:**

1. **Focus** - Messaging + Groepen + Calls, NIETS anders
2. **Privacy First** - ZERO server storage = marketing goud
3. **Dual Encryption** - Efficient voor zowel kleine als grote groepen
4. **Transparent Delivery** - "5/8 delivered" status = user trust
5. **Testing** - Senioren feedback is GOUD (vooral voor groepen UX!)
6. **Iterate** - Start simple, verbeter iteratief
7. **Claude Code** - Laat AI het zware werk doen (78% autonomie)

**Key Differentiators:**

1. **"Wij slaan NIKS op de server!"** - Unieke privacy positioning
2. **Groepen tot 30 personen** met senior-friendly UX
3. **Transparent delivery tracking** - Users weten precies wat er gebeurt
4. **Device-centric** - Data blijft echt op eigen device
5. **Betaalbaar** - €2,50/jaar per persoon

**Timeline:** 23 weken = 5.5 maanden  
**Cost:** €660/jaar operational  
**Value:** Complete WhatsApp replacement met BETERE privacy!

**Good luck! 🚀**

---

*Laatst bijgewerkt: Februari 2026*
*Versie: MVP V1.0 (Met Groepschat + Zero Server Storage)*
*Status: FINAL - Ready for Implementation*
