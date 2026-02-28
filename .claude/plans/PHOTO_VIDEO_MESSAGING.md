# Foto/Video Messaging — Implementatieplan

> **Status:** Planning afgerond, wacht op implementatie
> **Datum:** 2026-02-28
> **PNA Beslissingen:** 11/11 afgerond

---

## 1. Overzicht

Dit plan beschrijft de implementatie van foto/video messaging voor CommEazy. De functionaliteit bestaat uit drie geïntegreerde modules:

1. **Camera Module** — Foto/video capture met preview
2. **Berichten Module** — Media versturen en ontvangen in chats
3. **Foto Album Module** — Media beheer en organisatie

### Architectuur Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    React Native Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ CameraScreen │  │ ChatScreen   │  │ AlbumScreen  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│  ┌──────┴─────────────────┴─────────────────┴──────┐           │
│  │              MediaContext (State)                │           │
│  └──────────────────────┬──────────────────────────┘           │
│                         │                                       │
│  ┌──────────────────────┴──────────────────────────┐           │
│  │                  Services Layer                  │           │
│  ├──────────────┬──────────────┬──────────────────┤           │
│  │ mediaService │ webrtcMedia  │ mediaStorage     │           │
│  │ (compress,   │ Service      │ Service          │           │
│  │  encrypt)    │ (P2P)        │ (local DB)       │           │
│  └──────────────┴──────────────┴──────────────────┘           │
├─────────────────────────────────────────────────────────────────┤
│                    Native Layer (iOS/Android)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ CameraModule │  │ MediaPicker  │  │ VideoTrimmer │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. PNA Beslissingen Samenvatting

| # | Hiaat | Beslissing |
|---|-------|------------|
| 1 | Groepschats | Max 8 leden, generiek model voor tekst + media |
| 2 | Queue Management | Parallel versturen, timestamp sortering bij ontvanger |
| 3 | Video Limieten | Max 2 min, trim in album, waarschuwing bij grote video |
| 4 | Media Selectie | 📎 Attachment button in Berichten |
| 5 | Album Organisatie | Tabs [Alles][Eigen][Ontvangen] + contact filter |
| 6 | Opslag Limieten | Waarschuwing bij lage opslag (geen auto-cleanup) |
| 7 | Chat Preview | Inline thumbnail ~200-250px, tap voor fullscreen |
| 8 | Video Playback | Unified MediaViewer voor foto's en video's |
| 9 | Permissions | Just-in-time met "Open Instellingen" fallback |
| 10 | WebRTC Lifecycle | Smart pooling met 60s idle timeout |
| 11 | Doorsturen | Multi-select forwarding naar meerdere contacten |

---

## 3. Technische Specificaties

### 3.1 Media Compressie

| Type | Specificatie | Resultaat |
|------|--------------|-----------|
| **Foto** | Max 1920×1080, JPEG 80% | ~800KB |
| **Video** | Max 720p, H.264, 2Mbps, max 2 min | ~30MB |

### 3.2 Transfer Protocol

```
┌─────────────┐                              ┌─────────────┐
│   Sender    │                              │  Receiver   │
└──────┬──────┘                              └──────┬──────┘
       │                                            │
       │  1. XMPP: Media metadata + thumbnail       │
       │ ─────────────────────────────────────────> │
       │                                            │
       │  2. WebRTC: Establish Data Channel         │
       │ <─────────────────────────────────────────>│
       │                                            │
       │  3. WebRTC Data Channel: Encrypted chunks  │
       │ ─────────────────────────────────────────> │
       │                                            │
       │  4. XMPP: Delivery receipt                 │
       │ <───────────────────────────────────────── │
       │                                            │
```

### 3.3 XMPP Message Schema

```xml
<message type="chat" to="user@commeazy.local">
  <body>[Foto/Video]</body>
  <media xmlns="urn:commeazy:media:0">
    <type>photo|video</type>
    <id>uuid-v4</id>
    <thumbnail>base64-encoded-jpeg</thumbnail>
    <size>812345</size>
    <width>1920</width>
    <height>1080</height>
    <duration>120</duration> <!-- alleen video, in seconden -->
    <encryption>
      <algorithm>xchacha20-poly1305</algorithm>
      <key>base64-encrypted-key</key>
      <nonce>base64-nonce</nonce>
    </encryption>
  </media>
</message>
```

### 3.4 Database Schema (WatermelonDB)

```typescript
// models/MediaMessage.ts
import { Model } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';

export class MediaMessage extends Model {
  static table = 'media_messages';
  static associations = {
    messages: { type: 'belongs_to', key: 'message_id' },
  };

  @field('media_id') mediaId!: string;
  @field('type') type!: 'photo' | 'video';
  @field('local_uri') localUri!: string;
  @field('thumbnail_uri') thumbnailUri!: string;
  @field('size') size!: number;
  @field('width') width!: number;
  @field('height') height!: number;
  @field('duration') duration?: number; // video only
  @field('encryption_key') encryptionKey!: string;
  @field('encryption_nonce') encryptionNonce!: string;
  @field('transfer_status') transferStatus!: 'pending' | 'sending' | 'sent' | 'received' | 'failed';
  @field('retry_count') retryCount!: number;
  @date('created_at') createdAt!: Date;
  @date('expires_at') expiresAt!: Date; // 7 dagen voor outbox
  @relation('messages', 'message_id') message!: any;
}
```

---

## 4. Implementatie Fasen

### Fase 1: Foundation (Week 1-2)

#### 4.1.1 Services

| Service | Bestand | Beschrijving |
|---------|---------|--------------|
| `mediaService` | `src/services/media/mediaService.ts` | Compressie, EXIF strip, encryptie |
| `mediaStorageService` | `src/services/media/mediaStorageService.ts` | Lokale opslag, cleanup |
| `mediaQueueService` | `src/services/media/mediaQueueService.ts` | Outbox, retry logic |

#### 4.1.2 Database

```typescript
// migrations/007_add_media_messages.ts
export const migration007 = {
  toVersion: 7,
  steps: [
    createTable({
      name: 'media_messages',
      columns: [
        { name: 'media_id', type: 'string', isIndexed: true },
        { name: 'message_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string' },
        { name: 'local_uri', type: 'string' },
        { name: 'thumbnail_uri', type: 'string' },
        { name: 'size', type: 'number' },
        { name: 'width', type: 'number' },
        { name: 'height', type: 'number' },
        { name: 'duration', type: 'number', isOptional: true },
        { name: 'encryption_key', type: 'string' },
        { name: 'encryption_nonce', type: 'string' },
        { name: 'transfer_status', type: 'string' },
        { name: 'retry_count', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'expires_at', type: 'number' },
      ],
    }),
  ],
};
```

#### 4.1.3 Context

```typescript
// contexts/MediaContext.tsx
interface MediaContextValue {
  // Capture
  capturePhoto: () => Promise<MediaItem>;
  captureVideo: () => Promise<MediaItem>;

  // Selection
  pickFromGallery: (type: 'photo' | 'video' | 'both') => Promise<MediaItem[]>;

  // Send
  sendMedia: (chatId: string, mediaItems: MediaItem[]) => Promise<void>;

  // Queue
  pendingMedia: MediaItem[];
  retryMedia: (mediaId: string) => Promise<void>;
  cancelMedia: (mediaId: string) => void;

  // Album
  ownMedia: MediaItem[];
  receivedMedia: MediaItem[];
  deleteMedia: (mediaIds: string[]) => Promise<void>;
}
```

### Fase 2: Camera Module (Week 2-3)

#### 4.2.1 Components

| Component | Bestand | Beschrijving |
|-----------|---------|--------------|
| `CameraScreen` | `src/screens/camera/CameraScreen.tsx` | Capture interface |
| `CameraPreview` | `src/components/camera/CameraPreview.tsx` | Preview + bevestiging |
| `CameraControls` | `src/components/camera/CameraControls.tsx` | Capture button, flip, flash |

#### 4.2.2 Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Terug                                    [⚡] [🔄]            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                                                                  │
│                      Camera Preview                              │
│                                                                  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│     [📷]                    [⏺]                    [🎬]         │
│     Foto                   Capture                 Video         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.2.3 Permissions Flow

```typescript
// hooks/useCameraPermissions.ts
export function useCameraPermissions() {
  const { t } = useTranslation();

  const requestCameraPermission = async (): Promise<boolean> => {
    const status = await Camera.requestCameraPermissionsAsync();

    if (status.status === 'denied') {
      Alert.alert(
        t('permissions.camera.title'),
        t('permissions.camera.message'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('permissions.openSettings'),
            onPress: () => Linking.openSettings()
          },
        ]
      );
      return false;
    }

    return status.status === 'granted';
  };

  return { requestCameraPermission };
}
```

### Fase 3: Chat Integration (Week 3-4)

#### 4.3.1 Components

| Component | Bestand | Beschrijving |
|-----------|---------|--------------|
| `AttachmentButton` | `src/components/chat/AttachmentButton.tsx` | 📎 button met menu |
| `MediaThumbnail` | `src/components/chat/MediaThumbnail.tsx` | Inline preview |
| `MediaViewer` | `src/components/MediaViewer.tsx` | Fullscreen viewer |
| `ForwardModal` | `src/components/chat/ForwardModal.tsx` | Multi-select forwarding |

#### 4.3.2 Attachment Menu

```typescript
// components/chat/AttachmentButton.tsx
const ATTACHMENT_OPTIONS = [
  {
    id: 'camera',
    icon: 'camera',
    label: t('chat.attachment.takePhoto'),
    action: () => navigation.navigate('Camera', { mode: 'photo' }),
  },
  {
    id: 'video',
    icon: 'video-camera',
    label: t('chat.attachment.recordVideo'),
    action: () => navigation.navigate('Camera', { mode: 'video' }),
  },
  {
    id: 'gallery',
    icon: 'image',
    label: t('chat.attachment.chooseFromAlbum'),
    action: () => pickFromGallery('both'),
  },
];
```

#### 4.3.3 MediaThumbnail Layout

```
┌───────────────────────────────────────────┐
│  ┌─────────────────────────────────────┐  │
│  │                                     │  │
│  │         Thumbnail (200px)           │  │
│  │                                     │  │
│  │  [▶]  (video indicator)             │  │
│  │                                     │  │
│  └─────────────────────────────────────┘  │
│  ✓✓ 14:32                                 │
└───────────────────────────────────────────┘
```

### Fase 4: Album Module (Week 4-5)

#### 4.4.1 Components

| Component | Bestand | Beschrijving |
|-----------|---------|--------------|
| `AlbumScreen` | `src/screens/album/AlbumScreen.tsx` | Hoofd album scherm |
| `AlbumGrid` | `src/components/album/AlbumGrid.tsx` | Grid view van media |
| `AlbumTabs` | `src/components/album/AlbumTabs.tsx` | [Alles][Eigen][Ontvangen] |
| `ContactFilter` | `src/components/album/ContactFilter.tsx` | Filter op contact |
| `VideoTrimmer` | `src/components/album/VideoTrimmer.tsx` | Video trim interface |

#### 4.4.2 Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  📷 Foto Album                              [MediaIndicator]     │
├─────────────────────────────────────────────────────────────────┤
│  [Alles]        [Eigen]        [Ontvangen ▼]                    │
│                                 └─ Contact filter               │
├─────────────────────────────────────────────────────────────────┤
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐                                │
│  │    │  │    │  │    │  │    │                                │
│  │    │  │ ▶  │  │    │  │    │                                │
│  └────┘  └────┘  └────┘  └────┘                                │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐                                │
│  │    │  │    │  │    │  │ ▶  │                                │
│  │    │  │    │  │    │  │    │                                │
│  └────┘  └────┘  └────┘  └────┘                                │
│                                                                  │
│  [Selecteren]                              [Camera]              │
└─────────────────────────────────────────────────────────────────┘
```

### Fase 5: WebRTC P2P Transfer (Week 5-6)

#### 4.5.1 Service

```typescript
// services/media/webrtcMediaService.ts
interface WebRTCMediaService {
  // Connection management
  getOrCreateConnection(peerId: string): Promise<RTCDataChannel>;
  closeConnection(peerId: string): void;

  // Transfer
  sendMedia(peerId: string, mediaItem: EncryptedMediaItem): Promise<void>;
  onMediaReceived: (handler: (peerId: string, data: Uint8Array) => void) => void;

  // Progress
  onProgress: (handler: (mediaId: string, progress: number) => void) => void;
}
```

#### 4.5.2 Connection Pooling

```typescript
// Smart pooling met 60s idle timeout
class WebRTCConnectionPool {
  private connections: Map<string, {
    channel: RTCDataChannel;
    lastUsed: number;
    idleTimer: NodeJS.Timeout;
  }> = new Map();

  private readonly IDLE_TIMEOUT = 60 * 1000; // 60 seconden

  async getConnection(peerId: string): Promise<RTCDataChannel> {
    const existing = this.connections.get(peerId);

    if (existing && existing.channel.readyState === 'open') {
      // Reset idle timer
      clearTimeout(existing.idleTimer);
      existing.lastUsed = Date.now();
      existing.idleTimer = this.createIdleTimer(peerId);
      return existing.channel;
    }

    // Create new connection
    const channel = await this.createDataChannel(peerId);
    this.connections.set(peerId, {
      channel,
      lastUsed: Date.now(),
      idleTimer: this.createIdleTimer(peerId),
    });

    return channel;
  }

  private createIdleTimer(peerId: string): NodeJS.Timeout {
    return setTimeout(() => {
      const conn = this.connections.get(peerId);
      if (conn && Date.now() - conn.lastUsed >= this.IDLE_TIMEOUT) {
        this.closeConnection(peerId);
      }
    }, this.IDLE_TIMEOUT);
  }
}
```

### Fase 6: Offline & Retry (Week 6-7)

#### 4.6.1 Queue Service

```typescript
// services/media/mediaQueueService.ts
interface MediaQueueService {
  // Add to queue
  enqueue(mediaItem: MediaItem, recipients: string[]): Promise<void>;

  // Process queue
  processQueue(): Promise<void>;

  // Retry
  retry(mediaId: string): Promise<void>;

  // Cleanup expired (>7 dagen)
  cleanupExpired(): Promise<number>;

  // Status
  getPendingCount(): number;
  getFailedItems(): MediaQueueItem[];
}
```

#### 4.6.2 Retry Logic

```typescript
const RETRY_DELAYS = [
  1000,      // 1s
  5000,      // 5s
  30000,     // 30s
  60000,     // 1min
  300000,    // 5min
  900000,    // 15min
  3600000,   // 1hr
];

async function retryWithBackoff(mediaId: string, attempt: number): Promise<void> {
  const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
  await sleep(delay);

  try {
    await sendMedia(mediaId);
    await updateStatus(mediaId, 'sent');
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      await retryWithBackoff(mediaId, attempt + 1);
    } else {
      await updateStatus(mediaId, 'failed');
    }
  }
}
```

---

## 5. Bestandsstructuur

```
src/
├── screens/
│   ├── camera/
│   │   └── CameraScreen.tsx
│   └── album/
│       └── AlbumScreen.tsx
├── components/
│   ├── camera/
│   │   ├── CameraPreview.tsx
│   │   └── CameraControls.tsx
│   ├── chat/
│   │   ├── AttachmentButton.tsx
│   │   ├── MediaThumbnail.tsx
│   │   └── ForwardModal.tsx
│   ├── album/
│   │   ├── AlbumGrid.tsx
│   │   ├── AlbumTabs.tsx
│   │   ├── ContactFilter.tsx
│   │   └── VideoTrimmer.tsx
│   └── MediaViewer.tsx
├── contexts/
│   └── MediaContext.tsx
├── services/
│   └── media/
│       ├── index.ts
│       ├── mediaService.ts
│       ├── mediaStorageService.ts
│       ├── mediaQueueService.ts
│       └── webrtcMediaService.ts
├── hooks/
│   ├── useCameraPermissions.ts
│   ├── useMediaPicker.ts
│   └── useMediaViewer.ts
├── models/
│   └── MediaMessage.ts
└── types/
    └── media.ts
```

---

## 6. Dependencies

### Nieuwe packages

```json
{
  "expo-camera": "~15.0.0",
  "expo-image-picker": "~15.0.0",
  "expo-media-library": "~16.0.0",
  "expo-av": "~14.0.0",
  "react-native-video": "^6.0.0",
  "@react-native-community/image-editor": "^4.0.0",
  "react-native-video-trim": "^0.5.0"
}
```

### Bestaande packages (hergebruik)

- `react-native-webrtc` — Data Channel voor P2P
- `libsodium-wrappers` — XChaCha20-Poly1305 encryptie
- `@nozbe/watermelondb` — Lokale database
- `xmpp.js` — Signaling

---

## 7. i18n Keys

```json
{
  "chat": {
    "attachment": {
      "button": "Bijlage toevoegen",
      "takePhoto": "Maak foto",
      "recordVideo": "Neem video op",
      "chooseFromAlbum": "Kies uit album"
    },
    "media": {
      "sending": "Versturen...",
      "sent": "Verzonden",
      "failed": "Verzenden mislukt",
      "retry": "Opnieuw proberen",
      "forward": "Doorsturen",
      "forwardTo": "Doorsturen naar"
    }
  },
  "camera": {
    "title": "Camera",
    "photo": "Foto",
    "video": "Video",
    "capture": "Vastleggen",
    "retake": "Opnieuw",
    "use": "Gebruiken",
    "send": "Versturen",
    "save": "Opslaan"
  },
  "album": {
    "title": "Foto Album",
    "tabs": {
      "all": "Alles",
      "own": "Eigen",
      "received": "Ontvangen"
    },
    "filterByContact": "Filter op contact",
    "select": "Selecteren",
    "delete": "Verwijderen",
    "trim": "Inkorten",
    "empty": {
      "all": "Nog geen foto's of video's",
      "own": "Je hebt nog geen foto's gemaakt",
      "received": "Je hebt nog geen foto's ontvangen"
    }
  },
  "permissions": {
    "camera": {
      "title": "Cameratoegang nodig",
      "message": "CommEazy heeft toegang tot je camera nodig om foto's en video's te maken."
    },
    "mediaLibrary": {
      "title": "Fototoegang nodig",
      "message": "CommEazy heeft toegang tot je foto's nodig om ze te versturen."
    },
    "openSettings": "Open Instellingen"
  },
  "video": {
    "tooLong": {
      "title": "Video te lang",
      "message": "De video is langer dan 2 minuten. Wil je de video inkorten?",
      "trim": "Inkorten",
      "sendAnyway": "Toch versturen"
    },
    "largeFile": {
      "title": "Grote video",
      "message": "Deze video is groot en kan lang duren om te versturen. Wil je doorgaan?",
      "yes": "Ja, versturen",
      "no": "Annuleren"
    }
  }
}
```

---

## 8. Security Checklist

- [ ] EXIF data (GPS, device info) wordt gestript voor verzenden
- [ ] Media wordt versleuteld met XChaCha20-Poly1305 (libsodium)
- [ ] Encryptie keys worden nooit gelogd
- [ ] Thumbnails worden ook versleuteld
- [ ] Lokale opslag is versleuteld via SQLCipher (WatermelonDB)
- [ ] WebRTC Data Channel gebruikt DTLS encryptie
- [ ] 7-dagen expiry voor undelivered media
- [ ] Geen server-side opslag van media content

---

## 9. Performance Targets

| Metric | Target | Device |
|--------|--------|--------|
| Foto compressie | < 500ms | iPhone SE |
| Video compressie (1 min) | < 10s | iPhone SE |
| Encryptie (1MB) | < 500ms | iPhone SE |
| Thumbnail generatie | < 200ms | iPhone SE |
| Memory tijdens transfer | < 200MB | 1000 messages + media |
| WebRTC connection setup | < 2s | LAN |

---

## 10. Testing Plan

### Unit Tests

- [ ] mediaService: compressie, EXIF strip, encryptie
- [ ] mediaQueueService: enqueue, retry, cleanup
- [ ] webrtcMediaService: connection pooling, transfer

### Integration Tests

- [ ] End-to-end foto versturen (simulator → simulator)
- [ ] End-to-end video versturen
- [ ] Offline queue → online → delivery
- [ ] Multi-recipient groepsberichten

### Manual Tests

- [ ] Permission flows (deny → retry → settings)
- [ ] Large video warning
- [ ] Forward naar meerdere contacten
- [ ] Album tabs en filtering

---

## 11. Implementatie Volgorde

1. **Foundation** — Services, database, types
2. **MediaViewer** — Fullscreen foto/video viewer (herbruikbaar)
3. **Camera Module** — Capture + preview
4. **Chat Integration** — Attachment button, thumbnails
5. **Album Module** — Tabs, grid, filtering
6. **WebRTC Transfer** — P2P met pooling
7. **Offline Queue** — Retry logic, 7-day expiry
8. **Video Trimmer** — In-album trim functionaliteit
9. **Forward Modal** — Multi-select forwarding

---

## 12. Open Vragen

Geen open vragen — alle 11 hiaten zijn geadresseerd in PNA.

---

## 13. Appendix: Message Model Uitbreiding

De bestaande `Message` model in WatermelonDB wordt uitgebreid:

```typescript
// Bestaand + nieuw
export class Message extends Model {
  static table = 'messages';

  // Bestaande velden
  @field('content') content!: string;
  @field('sender_jid') senderJid!: string;
  @field('status') status!: MessageStatus;
  // ... etc

  // NIEUWE velden voor media
  @field('message_type') messageType!: 'text' | 'photo' | 'video';
  @field('media_id') mediaId?: string;
  @field('thumbnail_data') thumbnailData?: string; // base64
  @field('media_width') mediaWidth?: number;
  @field('media_height') mediaHeight?: number;
  @field('media_duration') mediaDuration?: number; // video only
}
```
