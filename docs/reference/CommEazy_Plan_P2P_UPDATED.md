# IMPLEMENTATIEPLAN

**Privacy-First Familie Communicatie Platform**

*CommEazy*

Eenvoudig • Veilig • Voor Iedereen

👵👴 Senioren + Familie | 🤖 Claude Code Development | 📱 20 weken MVP

| **Aspect** | **Details** |
|-----------------------------------|--------------------------------------|
| **Doelgroep:** | Senioren (60+) en hun familie |
| **Primaire Use Case:** | Dagelijkse familie communicatie |
| **Development Tool:** | Claude Code (78% autonomie) |
| **Timeline:** | **20 weken (MVP) - STRIPPED FOCUS** |
| **Tech Stack:** | React Native + Jitsi Prosody XMPP + P2P |
| **Features:** | Chat, Calls (ALLEEN - geen TV/Audioboeken in MVP) |
| **Architecture:** | **Device-Centric + P2P** |
| **Kosten Jaar 1:** | €600-800 (alleen server + domains) |
| **Domains:** | commeazy.com (primary), commeasy.com (redirect) |
| **Deployment:** | iOS App Store + Google Play Store |

---

## 🚨 BELANGRIJKE WIJZIGINGEN vs Vorige Versie

### ❌ VERWIJDERD uit MVP:
- ❌ Matrix Protocol → **Vervangen door XMPP + libsodium**
- ❌ Firebase Firestore → **Device-only storage**
- ❌ Firebase Storage → **Lokale media opslag + optionele backup**
- ❌ TV-kijken feature → **Post-MVP**
- ❌ Audioboeken feature → **Post-MVP**
- ❌ Cloud Functions → **Niet nodig**

### ✅ TOEGEVOEGD aan architectuur:
- ✅ **Jitsi Prosody XMPP** voor signaling + presence
- ✅ **Pure P2P** calls (geen Videobridge)
- ✅ **Device-centric** data (IndexedDB/Realm)
- ✅ **libsodium** voor E2E messaging encryptie
- ✅ **Backup/Restore** flows (user-controlled)
- ✅ **50 contacten limiet** (voldoende voor senioren)
- ✅ **1 device per user** (geen multi-device sync)

### 🎯 FOCUS: Messaging + Calls ONLY
MVP bevat ALLEEN core communicatie features. Geen entertainment (TV/Audio).

---

# Inhoudsopgave

1. Project Visie & Doelgroep
2. Waarom Dit HAALBAAR is met Claude Code
3. **NIEUWE: P2P + Device-Centric Architectuur**
4. **NIEUWE: Tech Stack (Prosody XMPP)**
5. **NIEUWE: Security Strategie (libsodium)**
6. Complete Feature Set (STRIPPED)
7. UI/UX voor Senioren
8. **NIEUWE: XMPP Messaging Systeem**
9. **NIEUWE: P2P Calls via Prosody**
10. **NIEUWE: Device Storage & Backup**
11. Claude Code Development Workflow
12. **NIEUWE: Week-bij-Week Roadmap (20 weken)**
13. Testing met Echte Senioren
14. **NIEUWE: Infrastructure (Prosody Server)**
15. **NIEUWE: Kosten Breakdown**
16. Risico's & Mitigaties
17. Success Criteria
18. Post-Launch Roadmap
19. Conclusie & Start Checklist

---

# 1. Project Visie & Doelgroep

## 1.1 Het Probleem

Senioren en hun familie willen gemakkelijk contact houden, maar:

- ❌ WhatsApp is te complex (teveel features, verwarrend)
- ❌ Privacy concerns (Facebook/Meta ownership)
- ❌ Kleine tekstjes en knoppen (niet toegankelijk)
- ❌ Te veel stappen om iets te doen (frustrerend)
- ❌ Angst om "iets kapot te maken"
- ❌ Kinderen maken zich zorgen over ouders hun privacy

## 1.2 De Oplossing: CommEazy

Een communicatie app speciaal ontworpen voor senioren:

- ✅ GROTE knoppen en tekst (makkelijk leesbaar)
- ✅ Simpele interface (niet meer dan 3 stappen)
- ✅ **Veilig door design (P2P + E2E encrypted)**
- ✅ **Privacy-first (geen centrale data opslag)**
- ✅ Alles in één app (chat, bellen, foto's)
- ✅ Familie kan helpen met setup (QR code scan)
- ✅ Gratis voor gebruikers
- ✅ **Data blijft op eigen device**

## 1.3 Doelgroep Persona's

| **Persona** | **Leeftijd** | **Needs** |
|-------------|--------------|-----------|
| Opa Jan | 72 jaar | Wil dagelijks videobellen met kleinkinderen |
| Oma Marie | 68 jaar | Wil foto's ontvangen van familie |
| Dochter Lisa | 45 jaar | Wil weten dat ouders veilig communiceren |

**🎯 Success Criterium:** Als een 70-jarige oma binnen 5 minuten een foto kan sturen naar haar kleinzoon, dan is de app geslaagd.

---

# 2. Waarom Dit HAALBAAR is met Claude Code

## 2.1 Herziene Risk Assessment

Originele aanname was FOUT:

| **Was (Te Paranoid)** | **Nu (Realistisch)** |
|----------------------|---------------------|
| Military-grade security | Veilig genoeg voor dagelijks gebruik |
| Zero-knowledge servers | **P2P + device-only storage** |
| Matrix Protocol (complex) | **XMPP + libsodium (simpeler)** |
| Self-hosted alles | **Alleen Prosody signaling server** |
| 42 weken development | **20 weken met Claude Code (STRIPPED)** |

## 2.2 Claude Code Capabilities

**🤖 Claude Code kan:** 78% van de code autonoom schrijven voor dit project. De 22% die jij doet is vooral: beslissingen maken, met senioren testen, en troubleshooting.

Wat Claude Code WEL goed kan voor CommEazy:

- ✅ React Native componenten (90% autonomie)
- ✅ **XMPP client integratie (75% met guidance)**
- ✅ UI layouts met grote knoppen (85% autonomie)
- ✅ **libsodium encryptie wrapper (80% autonomie)**
- ✅ Jitsi SDK voor calls (80% autonomie)
- ✅ **IndexedDB/Realm storage (85% autonomie)**
- ✅ **Backup/restore flows (75% autonomie)**
- ✅ Tests schrijven (70% autonomie)
- ✅ i18n implementatie (90% autonomie)

Wat JIJ moet doen (22%):

- 🧑‍💻 Architecture beslissingen (welke aanpak voor feature X?)
- 👵 Testen met echte senioren (KRITIEK voor success!)
- 🐛 Complex debugging (encryptie, XMPP, native modules)
- ⚙️ **Prosody server configuratie**
- 🚀 App Store submissions
- 📊 Performance optimalisatie
- 🔐 Security reviews

## 2.3 Vereiste Skills

Wat je MOET kunnen (of bereid zijn te leren):

| **Skill** | **Niveau** |
|-----------|-----------|
| JavaScript/TypeScript | Basis (Claude helpt met syntax) |
| React basics | Basis (concepts begrijpen) |
| Terminal/Command line | Comfortable |
| Git basics | Commit, push, pull |
| **Linux server basics** | **SSH, systemd, logs bekijken** |
| Testing op devices | Apps installeren via Xcode/Android Studio |
| English docs lezen | Technical documentation |
| Debugging | Console logs bekijken, errors googlen |

**⏱️ Time Commitment:** Je hebt **25-35 uur per week nodig voor 20 weken**. Dit is een serieus project, geen weekend hobby.

---

# 3. P2P + Device-Centric Architectuur

## 3.1 Architecture Principes

CommEazy volgt een **Device-Centric, Privacy-First** architectuur:

| **Principe** | **Betekenis** |
|--------------|---------------|
| **P1: Device is Source of Truth** | Alle data persistent op device (Realm/IndexedDB) |
| **P2: Minimal Central Dependency** | Prosody alleen voor signaling + presence |
| **P3: Privacy by Design** | E2E encrypted media (WebRTC DTLS-SRTP) |
| **P4: User Controls Data** | Gebruiker kiest waar backup staat |
| **P5: Graceful Degradation** | P2P first, TURN fallback automatisch |

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
│  │  └───────┬───────┘  │      │  └───────┬───────┘  │    │
│  │          │          │      │          │          │    │
│  │  ┌───────▼───────┐  │      │  ┌───────▼───────┐  │    │
│  │  │ WebRTC Engine │  │      │  │ WebRTC Engine │  │    │
│  │  └───────┬───────┘  │      │  └───────┬───────┘  │    │
│  │          │          │      │          │          │    │
│  │  ┌───────▼───────┐  │      │  ┌───────▼───────┐  │    │
│  │  │ Local Storage │  │      │  │ Local Storage │  │    │
│  │  │  (Realm DB)   │  │      │  │  (Realm DB)   │  │    │
│  │  └───────────────┘  │      │  └───────────────┘  │    │
│  └──────────┬───────────┘      └──────────┬─────────┘    │
│             │                             │              │
│             │    P2P Media (encrypted)    │              │
│             └─────────────────────────────┘              │
│                          │                               │
└──────────────────────────┼───────────────────────────────┘
                           │
                           │ Signaling only (WSS)
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

# 4. Tech Stack (XMPP + P2P)

## 4.1 Complete Tech Stack

### Frontend Dependencies:

```json
{
  "dependencies": {
    "react-native": "0.73+",
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/bottom-tabs": "^6.5.0",
    
    // XMPP voor messaging + signaling
    "strophe.js": "^2.0.0",
    "react-native-webrtc": "^118.0.0",
    
    // Encryptie
    "libsodium-wrappers": "^0.7.11",
    
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
| **Coturn STUN/TURN** | NAT traversal | Self-hosted |
| **Firebase FCM** | Push notifications | Free tier |
| **Firebase Auth** | Phone verification | Free tier |

### Server Requirements:

```yaml
Prosody Server:
  CPU: 2-4 cores
  RAM: 4-8 GB
  Disk: 20-50 GB SSD
  Network: 100 Mbps
  OS: Ubuntu 22.04 LTS
  
  Services:
    - Prosody XMPP (presence + signaling)
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
  profilePhoto?: string; // base64 or file path
  createdAt: Date;
  deviceId: string;
}

// Contacts (max 50)
interface Contact {
  id: string;
  xmppJID: string;
  displayName: string;
  publicKey: string; // Voor E2E encryptie
  profilePhoto?: string;
  phoneNumber?: string; // Voor fallback calling
  addedAt: Date;
  lastSeen?: Date;
  isOnline: boolean;
  verified: boolean; // QR code verificatie
}

// Messages
interface Message {
  id: string;
  conversationId: string;
  senderId: string; // xmppJID
  recipientId: string;
  type: 'text' | 'image' | 'file';
  content: string; // Encrypted payload
  timestamp: Date;
  direction: 'sent' | 'received';
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  localMediaPath?: string;
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
}
```

---

# 5. Security Strategie (libsodium)

## 5.1 Security Principes

**🔒 Security Filosofie:** Veilig GENOEG voor dagelijkse familie communicatie. Niet paranoia-level security (dat is overkill en maakt de app onbruikbaar voor senioren).

Wat we WEL doen:

- ✅ **E2E encrypted chats (libsodium box)**
- ✅ **P2P encrypted calls (DTLS-SRTP via WebRTC)**
- ✅ Encrypted local storage (Realm encryption)
- ✅ TLS 1.3 voor XMPP signaling
- ✅ **Public key verification (QR code pairing)**
- ✅ Phone number verification (Firebase Auth)
- ✅ Secure defaults (geen opt-in vereist)

Wat we bewust NIET doen (simplicity):

- ❌ Perfect forward secrecy (overkill voor familie chat)
- ❌ Double Ratchet (te complex, Signal-level)
- ❌ Zero-knowledge server (Prosody ziet metadata, that's OK)
- ❌ Custom crypto (use libsodium)
- ❌ Plausible deniability (niet nodig)

## 5.2 Encryption Details

### Message Encryption (libsodium):

```javascript
// Encrypt message met recipient public key
const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
const ciphertext = sodium.crypto_box_easy(
  plaintext,
  nonce,
  recipientPublicKey,
  senderPrivateKey
);

const encryptedMessage = {
  nonce: sodium.to_base64(nonce),
  ciphertext: sodium.to_base64(ciphertext)
};
```

### Key Exchange (QR Code Pairing):

```
User A scans User B's QR code:
┌─────────────────┐
│ █▀▀▀▀▀█ ▄▀ █▀█ │
│ █ ███ █ ██▄ ▀  │  Contains:
│ █ ▀▀▀ █ █▄▀ ▄█ │  - XMPP JID
│ ▀▀▀▀▀▀▀ ▀ ▀ ▀  │  - Public Key
└─────────────────┘  - Verification hash

→ Automatisch vertrouwd contact
→ Geen MITM mogelijk
```

## 5.3 Threat Model

Wat we beschermen TEGEN:

- ✅ Afluisteren door derde partijen op netwerk
- ✅ Data leaks bij telefoon verlies/diefstal
- ✅ Ongeautoriseerde toegang tot account
- ✅ Man-in-the-middle aanvallen (via QR verification)
- ✅ Data mining door adverteerders

Wat BUITEN scope is:

- ⚠️ Nation-state actors (NSA, AIVD)
- ⚠️ Fysieke toegang met forensics
- ⚠️ Zero-day exploits
- ⚠️ Quantum computing attacks

**Privacy Trade-offs Acceptabel:**
- Prosody server ziet: wie is online, wie belt met wie, wanneer (metadata)
- Prosody server ziet NIET: message content, media content
- TURN relay ziet: IP addresses bij fallback (maar niet content)

---

# 6. Complete Feature Set (STRIPPED MVP)

## 6.1 MVP Features (20 weken)

| **Feature** | **Beschrijving** | **Priority** |
|-------------|------------------|--------------|
| 1-op-1 Chat | E2E encrypted tekstberichten | MUST |
| Foto's Delen | Camera + galerij, lokaal opslag | MUST |
| Audio Calls | P2P voice calls via Prosody/WebRTC | MUST |
| Video Calls | P2P video calls, camera switch | MUST |
| Contact toevoegen | QR code scanning | MUST |
| Presence | Online/offline status | MUST |
| Push Notifications | Via Firebase FCM | MUST |
| Backup/Restore | Encrypted backup naar user-chosen location | MUST |
| Phone Fallback | Bel via native phone als contact offline | SHOULD |

## 6.2 EXPLICIET BUITEN MVP

Deze features komen LATER (niet in eerste 20 weken):

- ❌ Groep Chat (complexiteit te hoog)
- ❌ Groep Calls (vereist Videobridge SFU)
- ❌ Bestanden Delen (PDF, DOC)
- ❌ Video's Delen
- ❌ Voice messages
- ❌ Location sharing
- ❌ Message reactions
- ❌ Message editing
- ❌ Disappearing messages
- ❌ **TV-kijken (Post-MVP)**
- ❌ **Audioboeken (Post-MVP)**
- ❌ Desktop app
- ❌ Web app
- ❌ Dark mode
- ❌ Custom ringtones
- ❌ Status updates / Stories

**🎯 Focus:** Chat + Calls + Foto's. Dat is ALLES.

---

# 7. UI/UX voor Senioren

## 7.1 Design Principes

1. GROTE lettertype (min 18pt, headings 24pt+)
2. GROTE knoppen (min 60x60pt touch targets)
3. HOOG contrast (donker op licht, geen grijstinten)
4. SIMPELE flows (max 3 stappen)
5. DUIDELIJKE labels (geen jargon, geen iconen zonder tekst)
6. FEEDBACK (bevestiging bij elke actie)
7. UNDO mogelijk (fouten kunnen herstellen)
8. HELP teksten (contextual hints)
9. CONSISTENT (zelfde patronen overal)
10. GEDULDIG (geen timeouts, geen haast)

## 7.2 Bottom Navigation (3 Tabs)

| **Tab** | **Icon** | **Functie** |
|---------|----------|-------------|
| 1. Chats | 💬 | Messaging |
| 2. Calls | 📞 | Call History + Initiate Call |
| 3. Contacts | 👥 | Adresboek + Add Contact |

**Geen TV/Audio tabs** - die komen later.

## 7.3 Key Screens

### ChatScreen:
- Message bubbles: min 20pt font
- Input veld: 56pt hoog
- Send knop: 60x60pt, groen
- Camera knop: 60x60pt, blauw
- Online indicator: 🟢 groen bolletje (16pt diameter)

### ContactList:
- Contact photo: 80x80pt
- Name: 20pt bold
- Online status: 🟢/⚪ indicator (prominent)
- Add Contact button: Groen, floating, 70x70pt met "+"
- QR Scanner: Camera icon, 60x60pt

### Call Screen:
- Contact photo: 200x200pt (center)
- Name: 32pt bold
- Status text: 20pt ("Bellen...")
- Hangup button: 80x80pt, rood, bottom center
- Mute/Speaker: 60x60pt, zijkant

---

# 8. XMPP Messaging Systeem

## 8.1 XMPP Architecture

CommEazy gebruikt **Prosody XMPP** voor:
- Presence (online/offline status)
- Message routing (signaling, niet storage)
- Call signaling (SDP exchange)

### XMPP Connection Flow:

```javascript
// 1. Connect naar Prosody
const connection = new Strophe.Connection(
  'wss://commeazy.nl:5281/xmpp-websocket'
);

connection.connect(
  'oma@commeazy.nl',     // JID
  'password',            // Authn
  onConnectCallback
);

// 2. Send presence
connection.send($pres());

// 3. Listen voor messages
connection.addHandler(onMessage, null, 'message', 'chat');

// 4. Listen voor presence updates
connection.addHandler(onPresence, null, 'presence');
```

## 8.2 Message Sending Flow

```javascript
async function sendMessage(recipientJID, plaintext) {
  // 1. Encrypt met recipient public key
  const contact = await getContact(recipientJID);
  const encrypted = await encryptMessage(
    plaintext,
    contact.publicKey,
    myPrivateKey
  );
  
  // 2. Send via XMPP
  const msg = $msg({
    to: recipientJID,
    type: 'chat',
    id: generateUUID()
  }).c('body').t(encrypted);
  
  connection.send(msg);
  
  // 3. Save locally
  await saveMessageToRealm({
    content: encrypted,
    direction: 'sent',
    status: 'sending'
  });
}
```

## 8.3 Presence Management

Prosody tracks wie online is:

```javascript
function handlePresence(presenceStanza) {
  const from = Strophe.getBareJidFromJid(
    presenceStanza.getAttribute('from')
  );
  const type = presenceStanza.getAttribute('type');
  
  const isOnline = type !== 'unavailable';
  
  // Update contact status in Realm
  await updateContactPresence(from, isOnline);
  
  // Update UI
  dispatch({ type: 'CONTACT_PRESENCE_CHANGED', jid: from, isOnline });
}
```

---

# 9. P2P Calls via Prosody

## 9.1 Call Setup Flow

```
Oma wil Kleinzoon bellen:

1. Oma taps "Bel" → Check presence
   ├─ Online? → Continue
   └─ Offline? → "Bel via telefoon?" dialog

2. Create WebRTC PeerConnection
   - STUN: stun.commeazy.nl:3478
   - TURN: turn.commeazy.nl:3478 (fallback)

3. Create SDP offer
   const offer = await pc.createOffer();
   await pc.setLocalDescription(offer);

4. Send offer via XMPP message
   <message to="kleinzoon@commeazy.nl">
     <body>{"type":"call-offer","sdp":{...}}</body>
   </message>

5. Kleinzoon receives → Show incoming call UI
6. Accept → Create SDP answer
7. Send answer via XMPP
8. ICE candidates exchange via XMPP
9. P2P connection established
10. Media flows directly (not via Prosody!)
```

## 9.2 WebRTC Configuration

```javascript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.commeazy.nl:3478' },
    {
      urls: 'turn:turn.commeazy.nl:3478',
      username: 'temp_user',
      credential: 'temp_pass'
    }
  ]
});

// ICE candidate handling
pc.onicecandidate = (event) => {
  if (event.candidate) {
    sendViaXMPP(recipientJID, {
      type: 'ice-candidate',
      candidate: event.candidate
    });
  }
};

// Receive remote media
pc.ontrack = (event) => {
  remoteVideoRef.current.srcObject = event.streams[0];
};
```

---

# 10. Device Storage & Backup

## 10.1 Backup Creation

```javascript
async function createBackup(userPIN) {
  // 1. Verzamel alle data
  const data = {
    userProfile: await realm.objects('UserProfile').toJSON(),
    contacts: await realm.objects('Contact').toJSON(),
    messages: await realm.objects('Message').toJSON(),
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

## 10.2 Backup Destinations

User kan kiezen:

```
┌─────────────────────────────┐
│      Backup Locatie         │
├─────────────────────────────┤
│ ( ) Geen backup             │
│ (•) Google Drive            │
│ ( ) iCloud Drive            │
│ ( ) Lokale opslag           │
│ ( ) SD Kaart                │
└─────────────────────────────┘
```

## 10.3 Device Migration Flow

```
OUD DEVICE:
1. Ga naar Instellingen → Backup
2. Kies "Maak backup"
3. Voer 6-cijferige PIN in
4. Kies locatie (Google Drive)
5. ✓ Backup succesvol!

NIEUW DEVICE:
1. Install CommEazy app
2. Welkom scherm: "Backup terugzetten?"
3. Kies Google Drive
4. Login met Google account
5. Selecteer backup file
6. Voer PIN in
7. ✓ Data hersteld!
8. App klaar voor gebruik
```

---

# 11. Claude Code Development Workflow

(Identiek aan originele plan - geen wijzigingen)

---

# 12. Week-bij-Week Roadmap (20 weken)

## Phase 1: Foundation (Weken 1-4)

### Week 1: Setup & Prosody
- React Native project setup
- Prosody server opzetten (Ubuntu VPS)
- Coturn STUN/TURN configuratie
- SSL certificates (Let's Encrypt)
- Firebase project (FCM + Auth only)

### Week 2: XMPP Client
- Strophe.js integratie
- XMPP connection manager
- Presence system
- Message routing (text only)

### Week 3: Local Storage
- Realm database schema
- User profile management
- Contact CRUD operations
- Message persistence

### Week 4: Encryption
- libsodium setup
- Key generation (Ed25519)
- Message encryption/decryption
- Key storage (secure)

**Milestone 1:** Can send encrypted text message between 2 devices via XMPP

---

## Phase 2: Core Features (Weken 5-10)

### Week 5: Authentication
- Firebase phone auth
- XMPP account creation
- User onboarding flow

### Week 6: Contact Management
- QR code generation
- QR scanner (camera)
- Contact verification
- Public key exchange

### Week 7: Chat UI
- ChatScreen implementation
- Message bubbles (sent/received)
- Input field + send button
- Scroll behavior

### Week 8: Photos
- Image picker integration
- Photo compression
- Photo encryption
- Display in chat

### Week 9: Push Notifications
- FCM integration
- Notification handling
- Badge counts
- Deep linking

### Week 10: Presence System
- Online/offline indicators
- Prosody presence tracking
- UI updates (green/gray dots)

**Milestone 2:** Can chat + send photos with E2E encryption

---

## Phase 3: Calls (Weken 11-14)

### Week 11: WebRTC Setup
- react-native-webrtc integration
- PeerConnection management
- Media permissions

### Week 12: Call Signaling
- SDP exchange via XMPP
- ICE candidates routing
- Offer/Answer flow

### Week 13: Call UI
- Incoming call screen
- Active call screen
- Call controls (mute, speaker, hangup)
- **Phone fallback** (native Phone.app)

### Week 14: Call Polish
- Call history logging
- Reconnection logic
- Network quality indicators
- Testing met senioren!

**Milestone 3:** P2P voice + video calls werkend

---

## Phase 4: Backup & Polish (Weken 15-18)

### Week 15: Backup System
- Backup creation (PIN encryption)
- Google Drive integration
- iCloud integration

### Week 16: Restore System
- Backup selection UI
- Decryption + validation
- Data import to Realm

### Week 17: Settings & Polish
- Settings screen
- Notification preferences
- Font size controls
- Accessibility improvements

### Week 18: Senior Testing Round 1
- **User testing met 10 senioren**
- Verzamel feedback
- Fix critical UX issues

**Milestone 4:** App volledig functioneel + backup

---

## Phase 5: Launch Prep (Weken 19-20)

### Week 19: Testing & Fixes
- Senior testing round 2
- Bug fixes
- Performance optimization
- Security audit

### Week 20: App Store Launch
- App Store screenshots
- Descriptions (NL + EN)
- Privacy policy
- Submit to stores
- **LAUNCH! 🚀**

**Milestone 5:** CommEazy live in App Store + Play Store

---

# 13. Testing met Echte Senioren

(Identiek aan originele plan)

**Critical test scenarios:**

1. **QR Code pairing** - Kan oma QR scannen en contact toevoegen?
2. **Send photo** - Kan oma foto maken en sturen?
3. **Receive call** - Begrijpt oma de incoming call screen?
4. **Phone fallback** - Werkt "Bel via telefoon" dialog?
5. **Backup maken** - Kan oma backup maken zonder hulp?
6. **Restore** - Kan oma backup terugzetten op nieuw device?

---

# 14. Infrastructure (Prosody Server)

## 14.1 Server Requirements

```yaml
Provider: DigitalOcean / Hetzner / OVH
Location: Amsterdam (EU, GDPR)
  
Specs:
  CPU: 4 vCPU
  RAM: 8 GB
  Disk: 50 GB SSD
  Network: 1 Gbps (100 Mbps sustained)
  Cost: €20-30/maand

OS: Ubuntu 22.04 LTS

Services:
  - Prosody XMPP (port 5222, 5269, 5281 WSS)
  - Coturn STUN/TURN (port 3478, 5349)
  - Certbot (SSL auto-renew)
  - Prometheus (monitoring)
  - Grafana (dashboards)
```

## 14.2 Prosody Configuration

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
  "muc";         -- No group chat
  "mam";         -- No message archive
  "http_upload"; -- No file upload
}

-- No message storage (privacy!)
archive_expires_after = "1d"

-- SSL
ssl = {
  key = "/etc/prosody/certs/privkey.pem";
  certificate = "/etc/prosody/certs/fullchain.pem";
}

-- Virtual host
VirtualHost "commeazy.nl"
```

## 14.3 Coturn Configuration

```conf
# /etc/turnserver.conf

listening-port=3478
tls-listening-port=5349

relay-ip=SERVER_PUBLIC_IP
external-ip=SERVER_PUBLIC_IP

use-auth-secret
static-auth-secret=RANDOM_SECRET

realm=commeazy.nl

cert=/etc/letsencrypt/live/turn.commeazy.nl/fullchain.pem
pkey=/etc/letsencrypt/live/turn.commeazy.nl/privkey.pem

# No logging (privacy)
no-stdout-log
simple-log
```

---

# 15. Kosten Breakdown

## 15.1 Jaar 1 Kosten (Realistisch)

| **Item** | **Cost** | **Frequency** | **Jaar 1** |
|----------|----------|---------------|------------|
| **Domains** | | | |
| commeazy.com | €12 | Jaarlijks | €12 |
| commeasy.com | €12 | Jaarlijks | €12 |
| **Hosting** | | | |
| Prosody VPS (8GB) | €25 | Maandelijks | €300 |
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

## 15.2 Vergelijking vs Origineel Plan

| **Item** | **Was** | **Nu** | **Verschil** |
|----------|---------|--------|--------------|
| Backend | Firebase Firestore + Storage | Alleen FCM | -€400/jaar |
| Messaging | Matrix homeserver | Prosody (zelfde VPS) | €0 |
| Video Bridge | Jitsi Videobridge | GEEN (pure P2P) | -€100/jaar |
| Cloud Functions | Serverless logic | GEEN | -€200/jaar |
| **Totaal** | €1.168-1.448 | **€508-610** | **-€600/jaar** |

**🎉 Kostenbesparing: ~50% goedkoper door device-centric architectuur!**

---

# 16. Risico's & Mitigaties

## 16.1 Technical Risks

| **Risk** | **Impact** | **Probability** | **Mitigation** |
|----------|------------|-----------------|----------------|
| XMPP integration te complex | HIGH | MEDIUM | Use battle-tested Strophe.js, extensive testing |
| P2P call success rate <80% | HIGH | MEDIUM | Robust TURN fallback, test diverse networks |
| libsodium performance slow | MEDIUM | LOW | Native module optimization, async ops |
| Backup restore failures | HIGH | MEDIUM | Extensive validation, user-friendly errors |
| Prosody server downtime | CRITICAL | LOW | Monitoring + alerts, auto-restart scripts |
| QR code scanning issues | MEDIUM | MEDIUM | Fallback: manual JID entry + key verification |

## 16.2 UX Risks

| **Risk** | **Impact** | **Mitigation** |
|----------|------------|----------------|
| Senioren begrijpen QR pairing niet | HIGH | Video tutorial, family helper flow |
| Backup PIN vergeten | HIGH | Recovery via family member email |
| Device migration te moeilijk | HIGH | Step-by-step wizard, support chat |
| "Contact is offline" frustreert | MEDIUM | Clear phone fallback option |

## 16.3 Timeline Risks

20 weken is ambitieus maar haalbaar MET deze constraints:
- ✅ ALLEEN messaging + calls (geen TV/audio)
- ✅ GEEN groep features
- ✅ Claude Code doet 78% van code
- ✅ Jij werkt 30+ uur/week

**Contingency:** Als week 18 blijkt dat app niet klaar is: extend naar week 24 (4 weken buffer).

---

# 17. Success Criteria

## 17.1 Technical KPIs

- ✅ Call success rate: >90%
- ✅ P2P connection rate: >80% (rest via TURN)
- ✅ Message delivery: <2 sec avg
- ✅ Presence updates: <3 sec latency
- ✅ App crash rate: <1%
- ✅ Backup success rate: >95%

## 17.2 User KPIs

- ✅ Onboarding completion: >70%
- ✅ Daily active users: >50% van downloads
- ✅ Contact pairing success: >90%
- ✅ Senior satisfaction: NPS >40

## 17.3 Launch Criteria

App MAG NIET launchen zonder:
- ✅ Senior user testing (min 10 mensen, 65+)
- ✅ Security audit (libsodium implementation)
- ✅ Privacy policy (GDPR compliant)
- ✅ Prosody server stable (99% uptime 1 week)
- ✅ Backup/restore getest op 5 devices

---

# 18. Post-Launch Roadmap

## 18.1 Maand 1-3 na Launch

- Fix bugs from production
- Onboarding optimalisatie
- Performance tuning
- User feedback implementeren

## 18.2 Maand 4-6

**Feature: Groep Chat**
- Group messaging (max 10 personen)
- Group presence
- Group settings

## 18.3 Maand 7-12

**Feature: Media Delen**
- Video's delen (compressed)
- Bestanden delen (PDF, DOC)
- Voice memos

## 18.4 Jaar 2+

**Toekomstige Features (als er vraag is):**
- Groep calls (via Videobridge SFU)
- Desktop app
- TV-kijken (remote watch party)
- Audioboeken
- Message reactions
- Message editing

**Alleen als bewezen behoefte!**

---

# 19. Conclusie & Start Checklist

## 19.1 Is Dit Haalbaar?

**JA**, met deze voorwaarden:
- ✅ Je kunt 30+ uur/week investeren
- ✅ Je gebruikt Claude Code voor 78% van code
- ✅ Je STRIKTE focus op MVP (geen feature creep)
- ✅ Je test vroeg en vaak met senioren
- ✅ Je accepteert 20 weken → 24 weken buffer

## 19.2 Pre-Start Checklist

Voordat je begint:

**Week -2:**
- [ ] VPS huren (DigitalOcean €25/maand)
- [ ] Domains registreren (commeazy.com + .nl)
- [ ] Firebase project aanmaken (FCM only)
- [ ] Apple Developer account (€99)
- [ ] Google Play Developer (€25)

**Week -1:**
- [ ] Claude Code installeren + configureren
- [ ] React Native dev environment
- [ ] Prosody installeren op VPS
- [ ] SSL certificaten (Let's Encrypt)
- [ ] Git repo setup

**Week 0:**
- [ ] Kick-off! Start met Week 1 roadmap
- [ ] Recruit 10 senioren voor testing (week 18)

## 19.3 Final Words

CommEazy is een **ambitieus maar haalbaar** project. De device-centric, P2P architectuur maakt het technisch eenvoudiger én goedkoper dan de originele Matrix/Firebase aanpak.

**De sleutel tot success:**
1. **Focus** - Alleen messaging + calls, niets anders
2. **Testing** - Senioren feedback is GOUD
3. **Iterate** - Start simple, verbeter iteratief
4. **Claude Code** - Laat AI het zware werk doen

**Good luck! 🚀**

---

*Laatst bijgewerkt: Februari 2026*
*Versie: 2.0 (P2P + Device-Centric)*
