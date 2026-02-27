# Unified Notification Architecture Plan

## Doel

Eén centrale notificatie-service die ALLE modules (berichten, oproepen, video calls, groepen) uniform afhandelt op iOS, iPadOS en Android. Geen module-specifieke notificatie-logica meer — modules registreren zich bij de NotificationRouter.

## Huidige Staat (Analyse)

### Wat WEL werkt
- **Calls**: CallKit integreert volledig (inkomend → native UI → CallService → CallContext → ActiveCallScreen)
- **FCM tokens**: Worden correct opgehaald en naar Prosody gestuurd via XEP-0357
- **APNs token**: Wordt correct doorgestuurd naar Firebase Messaging
- **Foreground notificaties**: AppDelegate toont Banner + Sound + Badge

### Wat NIET werkt
- **Message notificaties**: FCM → AppDelegate → Firebase SDK → **NERGENS** — `onNotification()` handler is gedefinieerd maar wordt nooit geconsumeerd
- **Tap navigatie**: AppDelegate logt het type maar routeert niet naar het juiste scherm
- **Background messages**: Handler is geregistreerd maar bevat TODO — verwerkt geen data
- **Lokale notificaties**: Geen Notifee/lokale display vanuit React Native layer
- **VoIP Push**: PushKit NIET geïmplementeerd — calls missen in DND modus
- **Android**: Geen POST_NOTIFICATIONS permission, geen notification channels

### Architectuur Probleem
Er is geen uniforme routing laag. Elke notificatie-stroom heeft eigen ad-hoc logica:
```
Calls:  XMPP stanza → signalingService → callService → CallKit ✅
Msgs:   Prosody push → FCM → AppDelegate → ??? ❌
Groups: Niet geïmplementeerd ❌
Video:  Zelfde als calls (via callService) ✅ (maar VoIP push mist)
```

---

## Doelarchitectuur

```
┌──────────────────────────────────────────────────────────┐
│                    Prosody Server                         │
│  mod_cloud_notify (XEP-0357) + mod_commeazy_call_push    │
│  → FCM (Android + iOS data) + APNs (iOS VoIP)           │
└──────────────┬──────────────────────┬────────────────────┘
               │                      │
               ▼                      ▼
┌──────────────────────┐  ┌──────────────────────┐
│  FCM (data message)  │  │  PushKit (VoIP push) │
│  Android + iOS       │  │  iOS only            │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           ▼                         ▼
┌──────────────────────────────────────────────────────────┐
│              NotificationRouter (singleton)               │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ CallHandler  │  │ MsgHandler  │  │ GroupHandler │     │
│  │ (registered) │  │ (registered)│  │ (registered) │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │              │
│  ┌──────┴──────────────────┴────────────────┴──────┐    │
│  │         NotificationDisplayService              │    │
│  │         (Notifee: channels, categories)         │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│              NotificationContext (React)                   │
│  - Pending notification state (cold start / background)  │
│  - Navigation on tap (via PaneContext/navigation ref)    │
│  - Badge count management                                │
│  - Read/dismiss tracking                                 │
└──────────────────────────────────────────────────────────┘
```

---

## Fase 0: Dependencies

### 0a. Installeer Notifee
```bash
npm install @notifee/react-native
cd ios && pod install
```

**Waarom Notifee?**
- Cross-platform (iOS + Android) local notification display
- Notification channels (Android 8+ vereist)
- Notification categories met action buttons
- Background event handler
- Badge management
- Gratis en open-source

### 0b. PushKit Framework (iOS)
- Link PushKit framework in Xcode (Build Phases → Link Binary)
- Voeg `voip` toe aan `UIBackgroundModes` in Info.plist
- **Let op:** Apple vereist dat VoIP push ALTIJD een CallKit call reporteert

### 0c. Android POST_NOTIFICATIONS Permission
```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```
- Runtime permission request voor Android 13+ (API 33)
- Prompt tijdens onboarding na taal/telefoon stap

### Bestanden
| Bestand | Actie |
|---------|-------|
| `package.json` | `@notifee/react-native` toevoegen |
| `ios/Podfile` | Pod install |
| `ios/CommEazyTemp/Info.plist` | `voip` background mode toevoegen |
| `ios/CommEazyTemp.xcodeproj` | PushKit framework linken |
| `android/app/src/main/AndroidManifest.xml` | POST_NOTIFICATIONS permission |

---

## Fase 1: NotificationRouter (Centrale Routing)

### 1a. `src/services/notifications/NotificationRouter.ts`

```typescript
type NotificationType = 'message' | 'call' | 'video_call' | 'group_invite' | 'group_message' | 'missed_call';

interface NotificationPayload {
  type: NotificationType;
  // Message
  chatId?: string;
  senderJid?: string;
  senderName?: string;
  messagePreview?: string;
  // Call
  callId?: string;
  callerJid?: string;
  callerName?: string;
  isVideo?: boolean;
  // Group
  groupId?: string;
  groupName?: string;
}

interface NotificationHandler {
  type: NotificationType | NotificationType[];
  canHandle(payload: NotificationPayload): boolean;
  handle(payload: NotificationPayload): Promise<void>;
  handleTap(payload: NotificationPayload): NavigationTarget | null;
}

interface NavigationTarget {
  moduleId: string;
  screen: string;
  params: Record<string, unknown>;
}

class NotificationRouter {
  private handlers: Map<NotificationType, NotificationHandler> = new Map();

  register(handler: NotificationHandler): void;
  unregister(type: NotificationType): void;

  async route(payload: NotificationPayload): Promise<void> {
    const handler = this.handlers.get(payload.type);
    if (handler?.canHandle(payload)) {
      await handler.handle(payload);
    }
  }

  getNavigationTarget(payload: NotificationPayload): NavigationTarget | null {
    const handler = this.handlers.get(payload.type);
    return handler?.handleTap(payload) ?? null;
  }
}
```

### 1b. Module Handlers registreren

```typescript
// CallNotificationHandler
router.register({
  type: ['call', 'video_call', 'missed_call'],
  canHandle: (p) => !!p.callId && !!p.callerJid,
  handle: async (p) => {
    if (p.type === 'missed_call') {
      await displayService.showLocal({
        title: p.callerName,
        body: t('notifications.missedCall'),
        channel: 'calls',
        data: p,
      });
    }
    // Active calls → CallKit handles display
  },
  handleTap: (p) => ({
    moduleId: 'calls',
    screen: p.type === 'missed_call' ? 'CallHistory' : 'ActiveCall',
    params: { callId: p.callId },
  }),
});

// MessageNotificationHandler
router.register({
  type: ['message', 'group_message'],
  canHandle: (p) => !!p.chatId,
  handle: async (p) => {
    await displayService.showLocal({
      title: p.senderName ?? p.groupName,
      body: p.messagePreview ?? t('notifications.newMessage'),
      channel: p.type === 'group_message' ? 'groups' : 'messages',
      data: p,
    });
  },
  handleTap: (p) => ({
    moduleId: 'chats',
    screen: 'ChatDetail',
    params: { chatId: p.chatId, name: p.senderName },
  }),
});
```

### Bestanden
| Bestand | Actie |
|---------|-------|
| `src/services/notifications/NotificationRouter.ts` | **NIEUW** |
| `src/services/notifications/handlers/CallNotificationHandler.ts` | **NIEUW** |
| `src/services/notifications/handlers/MessageNotificationHandler.ts` | **NIEUW** |
| `src/services/notifications/handlers/GroupNotificationHandler.ts` | **NIEUW** |
| `src/services/notifications/index.ts` | **NIEUW** — barrel export |

---

## Fase 2: NotificationDisplayService (Notifee)

### 2a. `src/services/notifications/NotificationDisplayService.ts`

```typescript
import notifee, { AndroidImportance, AndroidChannel } from '@notifee/react-native';

const CHANNELS: AndroidChannel[] = [
  {
    id: 'messages',
    name: 'Berichten',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  },
  {
    id: 'calls',
    name: 'Oproepen',
    importance: AndroidImportance.HIGH,
    sound: 'ringtone',
    vibration: true,
  },
  {
    id: 'groups',
    name: 'Groepen',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
    vibration: true,
  },
  {
    id: 'system',
    name: 'Systeem',
    importance: AndroidImportance.LOW,
    sound: undefined,
    vibration: false,
  },
];

class NotificationDisplayService {
  async initialize(): Promise<void> {
    // Android: channels aanmaken
    await Promise.all(CHANNELS.map(ch => notifee.createChannel(ch)));
  }

  async showLocal(options: {
    title: string;
    body: string;
    channel: string;
    data?: Record<string, string>;
    categoryId?: string;
  }): Promise<string> {
    return notifee.displayNotification({
      title: options.title,
      body: options.body,
      data: options.data,
      android: {
        channelId: options.channel,
        smallIcon: 'ic_notification',
        pressAction: { id: 'default' },
      },
      ios: {
        categoryId: options.categoryId,
        sound: 'default',
      },
    });
  }

  async cancelAll(): Promise<void> {
    await notifee.cancelAllNotifications();
  }

  async setBadgeCount(count: number): Promise<void> {
    await notifee.setBadgeCount(count);
  }
}
```

### 2b. iOS Notification Categories (Action Buttons)

```typescript
// Message: "Antwoord" + "Markeer als gelezen"
await notifee.setNotificationCategories([
  {
    id: 'message',
    actions: [
      { id: 'reply', title: t('notifications.reply'), input: true },
      { id: 'read', title: t('notifications.markRead') },
    ],
  },
  {
    id: 'missed_call',
    actions: [
      { id: 'callback', title: t('notifications.callBack') },
    ],
  },
]);
```

### Bestanden
| Bestand | Actie |
|---------|-------|
| `src/services/notifications/NotificationDisplayService.ts` | **NIEUW** |
| `android/app/src/main/res/drawable/ic_notification.xml` | **NIEUW** — Android notification icon |

---

## Fase 3: NotificationContext (React Navigation)

### 3a. `src/contexts/NotificationContext.tsx`

```typescript
interface NotificationContextValue {
  pendingNavigation: NavigationTarget | null;
  consumePendingNavigation(): NavigationTarget | null;
  unreadCount: number;
  clearUnread(chatId: string): void;
}

function NotificationProvider({ children }: Props) {
  const [pendingNavigation, setPendingNavigation] = useState<NavigationTarget | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRef(NotificationRouter.getInstance());

  useEffect(() => {
    // FCM foreground listener
    const unsubForeground = messaging().onMessage(async (remoteMessage) => {
      const payload = parsePayload(remoteMessage.data);
      await router.current.route(payload);
    });

    // FCM background → app opened via notification tap
    messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        const payload = parsePayload(remoteMessage.data);
        const target = router.current.getNavigationTarget(payload);
        if (target) setPendingNavigation(target);
      }
    });

    // Notifee foreground event (tap on local notification)
    const unsubNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS && detail.notification?.data) {
        const payload = parsePayload(detail.notification.data);
        const target = router.current.getNavigationTarget(payload);
        if (target) navigateToTarget(target);
      }
    });

    return () => {
      unsubForeground();
      unsubNotifee();
    };
  }, []);

  // Navigation consumer — voor RootNavigator
  const consumePendingNavigation = useCallback(() => {
    const nav = pendingNavigation;
    setPendingNavigation(null);
    return nav;
  }, [pendingNavigation]);

  return (
    <NotificationContext.Provider value={{
      pendingNavigation,
      consumePendingNavigation,
      unreadCount,
      clearUnread,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}
```

### 3b. RootNavigator Integratie

```typescript
// In RootNavigator of AdaptiveNavigationWrapper:
function NavigationHandler() {
  const { consumePendingNavigation } = useNotificationContext();
  const { setPaneModule } = usePaneContext();
  const navigation = useNavigation();

  useEffect(() => {
    const target = consumePendingNavigation();
    if (target) {
      // Navigeer naar juiste module + screen
      setPaneModule('main', target.moduleId, {
        screen: target.screen,
        params: target.params,
      });
    }
  }, [consumePendingNavigation]);

  return null;
}
```

### 3c. Cold Start Flow

```
App killed → Push notification → User taps →
  1. App starts
  2. getInitialNotification() haalt payload op
  3. setPendingNavigation(target)
  4. App mount → RootNavigator → NavigationHandler
  5. consumePendingNavigation() → navigeert naar ChatDetail/CallHistory/etc.
```

### Bestanden
| Bestand | Actie |
|---------|-------|
| `src/contexts/NotificationContext.tsx` | **NIEUW** |
| `src/hooks/useNotificationContext.ts` | **NIEUW** |
| `src/navigation/index.tsx` | **WIJZIG** — NavigationHandler toevoegen |
| `src/contexts/index.ts` | **WIJZIG** — export toevoegen |

---

## Fase 4: VoIP Push voor Calls (iOS)

### 4a. Native Module: `VoIPPushModule.swift`

```swift
import PushKit

@objc(VoIPPushModule)
class VoIPPushModule: NSObject, PKPushRegistryDelegate {
    private var voipRegistry: PKPushRegistry?

    @objc func register() {
        voipRegistry = PKPushRegistry(queue: .main)
        voipRegistry?.delegate = self
        voipRegistry?.desiredPushTypes = [.voIP]
    }

    func pushRegistry(_ registry: PKPushRegistry,
                      didUpdate pushCredentials: PKPushCredentials,
                      for type: PKPushType) {
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        // Stuur token naar React Native
        sendEvent("voipTokenReceived", ["token": token])
    }

    func pushRegistry(_ registry: PKPushRegistry,
                      didReceiveIncomingPushWith payload: PKPushPayload,
                      for type: PKPushType,
                      completion: @escaping () -> Void) {
        // VERPLICHT: Report CallKit call ONMIDDELLIJK
        // Apple termineert de app als dit niet binnen ~5 seconden gebeurt
        let callData = payload.dictionaryPayload
        let callId = callData["callId"] as? String ?? UUID().uuidString
        let callerName = callData["callerName"] as? String ?? "Onbekend"
        let isVideo = callData["isVideo"] as? Bool ?? false

        // Report aan CallKit
        RNCallKeep.reportNewIncomingCall(
            callId,
            handle: callerName,
            handleType: "generic",
            hasVideo: isVideo,
            localizedCallerName: callerName,
            supportsHolding: false,
            supportsDTMF: false,
            supportsGrouping: false,
            supportsUngrouping: false,
            fromPushKit: true
        )

        // Stuur naar React Native voor WebRTC setup
        sendEvent("voipPushReceived", callData)

        completion()
    }
}
```

### 4b. Prosody Module: `mod_commeazy_call_push`

```lua
-- /opt/homebrew/lib/prosody/modules/mod_commeazy_call_push.lua
-- Luistert naar call signaling stanzas en stuurt VoIP push

local jid = require "util.jid";

module:hook("message/bare", function(event)
    local stanza = event.stanza;
    local call = stanza:get_child("call", "urn:commeazy:call:1");
    if not call then return; end

    local payload = call:get_text();
    -- Parse JSON om type te bepalen
    local ok, data = pcall(require("util.json").decode, payload);
    if not ok or data.type ~= "offer" then return; end

    -- Haal VoIP push token op voor ontvanger
    local to = jid.bare(stanza.attr.to);
    local push_info = get_push_registration(to); -- XEP-0357 registratie

    if push_info and push_info.voip_token then
        -- Stuur APNs VoIP push
        send_voip_push(push_info.voip_token, {
            callId = data.callId,
            callerJid = jid.bare(stanza.attr.from),
            callerName = data.callerName or "Onbekend",
            isVideo = data.isVideo or false,
        });
    end
end, 10); -- Prioriteit 10: na normale message handling
```

### 4c. Token Registratie Uitbreiden

XMPP `enablePushNotifications()` moet 3 tokens sturen:
1. FCM token (Android + iOS data messages)
2. APNs token (iOS alert notifications)
3. VoIP token (iOS VoIP push — NIEUW)

```typescript
// xmpp.ts uitbreiding
async enablePushNotifications(
  fcmToken: string,
  apnsToken: string | null,
  voipToken: string | null,  // NIEUW
): Promise<void> {
  const tokenNode = voipToken
    ? `apns:${apnsToken}|fcm:${fcmToken}|voip:${voipToken}`
    : `apns:${apnsToken}|fcm:${fcmToken}`;
  // ... rest van XEP-0357 IQ
}
```

### Bestanden
| Bestand | Actie |
|---------|-------|
| `ios/CommEazyTemp/VoIPPushModule.swift` | **NIEUW** |
| `ios/CommEazyTemp/VoIPPushModule.m` | **NIEUW** — Bridge |
| `src/services/voipPush.ts` | **NIEUW** — React Native wrapper |
| `src/services/xmpp.ts` | **WIJZIG** — voipToken parameter toevoegen |
| `src/services/container.ts` | **WIJZIG** — VoIP token registratie |
| Prosody: `mod_commeazy_call_push.lua` | **NIEUW** — Server-side module |

---

## Fase 5: Background Message Handler

### 5a. `index.js` — Registratie (al aanwezig, moet worden uitgebreid)

```typescript
// index.js (voor AppRegistry)
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';

// FCM background handler
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  const payload = parseNotificationPayload(remoteMessage.data);

  switch (payload.type) {
    case 'message':
    case 'group_message':
      // Toon lokale notificatie via Notifee
      await notifee.displayNotification({
        title: payload.senderName ?? 'Nieuw bericht',
        body: payload.messagePreview ?? '',
        android: { channelId: 'messages', smallIcon: 'ic_notification' },
        ios: { categoryId: 'message', sound: 'default' },
        data: remoteMessage.data,
      });
      break;

    case 'missed_call':
      await notifee.displayNotification({
        title: payload.callerName ?? 'Gemiste oproep',
        body: payload.isVideo
          ? t('notifications.missedVideoCall')
          : t('notifications.missedCall'),
        android: { channelId: 'calls', smallIcon: 'ic_notification' },
        ios: { categoryId: 'missed_call', sound: 'default' },
        data: remoteMessage.data,
      });
      break;

    // Calls (offer/answer/hangup) worden NIET hier afgehandeld
    // → VoIP push (iOS) of high-priority FCM (Android) + CallKit
  }
});

// Notifee background event handler (voor tap op lokale notificatie)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    // Navigatie wordt afgehandeld door NotificationContext bij app launch
    // Data is bewaard in de notification payload
  }
  if (type === EventType.ACTION_PRESS) {
    if (detail.pressAction?.id === 'read') {
      // Markeer als gelezen in database
      // (database is niet beschikbaar in background — markeer bij volgende launch)
    }
  }
});
```

### Bestanden
| Bestand | Actie |
|---------|-------|
| `index.js` | **WIJZIG** — background handlers uitbreiden |
| `src/services/notifications/parsePayload.ts` | **NIEUW** — gedeelde payload parser |

---

## Fase 6: Prosody Server-Side Push Configuratie

### 6a. `mod_cloud_notify` Configuratie Uitbreiden

```lua
-- /opt/homebrew/etc/prosody/prosody.cfg.lua

-- Bestaande config:
modules_enabled = {
    "cloud_notify";           -- XEP-0357 push
    "commeazy_call_push";     -- NIEUW: VoIP push voor calls
}

-- Push notification payload template
cloud_notify_options = {
    -- Stuur mee in push payload:
    include_sender = true;     -- From JID
    include_body = false;      -- PRIVACY: geen berichtinhoud in push
    include_count = true;      -- Unread count
}
```

### 6b. FCM Push Gateway

Prosody heeft een push gateway nodig die FCM HTTP v1 API aanroept:

```lua
-- mod_cloud_notify_fcm.lua
-- Stuurt push via Google FCM HTTP v1 API

local http = require "net.http";
local json = require "util.json";

-- Service account credentials
local FCM_PROJECT_ID = "commeazy-prod";
local FCM_SERVER_KEY = os.getenv("FCM_SERVER_KEY");

function send_fcm_push(token, data)
    local payload = json.encode({
        message = {
            token = token,
            data = data,  -- Data-only message (geen notification block)
            android = {
                priority = "high",
            },
            apns = {
                headers = {
                    ["apns-priority"] = "10",
                    ["apns-push-type"] = "alert",
                },
            },
        },
    });

    http.request(
        "https://fcm.googleapis.com/v1/projects/" .. FCM_PROJECT_ID .. "/messages:send",
        {
            method = "POST",
            headers = {
                ["Authorization"] = "Bearer " .. get_access_token(),
                ["Content-Type"] = "application/json",
            },
            body = payload,
        }
    );
end
```

### 6c. APNs VoIP Push Gateway

```lua
-- mod_commeazy_call_push.lua (uitbreiding)
-- Stuurt VoIP push via Apple APNs HTTP/2

local http = require "net.http";

function send_voip_push(device_token, call_data)
    local payload = json.encode({
        callId = call_data.callId,
        callerJid = call_data.callerJid,
        callerName = call_data.callerName,
        isVideo = call_data.isVideo,
    });

    -- APNs HTTP/2 request
    http.request(
        "https://api.push.apple.com/3/device/" .. device_token,
        {
            method = "POST",
            headers = {
                ["apns-topic"] = "com.commeazy.app.voip",  -- .voip suffix VERPLICHT
                ["apns-push-type"] = "voip",
                ["apns-priority"] = "10",                   -- Immediate delivery
                ["authorization"] = "bearer " .. get_apns_jwt(),
            },
            body = payload,
        }
    );
end
```

### Bestanden
| Bestand | Actie |
|---------|-------|
| `/opt/homebrew/etc/prosody/prosody.cfg.lua` | **WIJZIG** — modules + config |
| Prosody: `mod_cloud_notify_fcm.lua` | **NIEUW** — FCM gateway |
| Prosody: `mod_commeazy_call_push.lua` | **NIEUW** — VoIP push gateway |

---

## i18n Keys (ALLE 13 talen)

```json
{
  "notifications": {
    "newMessage": "Nieuw bericht",
    "newGroupMessage": "Nieuw groepsbericht",
    "missedCall": "Gemiste oproep",
    "missedVideoCall": "Gemist videogesprek",
    "reply": "Antwoord",
    "markRead": "Markeer als gelezen",
    "callBack": "Terugbellen",
    "channelMessages": "Berichten",
    "channelCalls": "Oproepen",
    "channelGroups": "Groepen",
    "channelSystem": "Systeem",
    "permissionTitle": "Meldingen toestaan",
    "permissionMessage": "CommEazy heeft toestemming nodig om je te laten weten wanneer je berichten of oproepen ontvangt.",
    "permissionAllow": "Toestaan",
    "permissionDeny": "Niet nu"
  }
}
```

---

## Kritieke Bestanden Overzicht

| Bestand | Actie | Fase |
|---------|-------|------|
| `src/services/notifications/NotificationRouter.ts` | **NIEUW** | 1 |
| `src/services/notifications/NotificationDisplayService.ts` | **NIEUW** | 2 |
| `src/services/notifications/handlers/CallNotificationHandler.ts` | **NIEUW** | 1 |
| `src/services/notifications/handlers/MessageNotificationHandler.ts` | **NIEUW** | 1 |
| `src/services/notifications/handlers/GroupNotificationHandler.ts` | **NIEUW** | 1 |
| `src/services/notifications/parsePayload.ts` | **NIEUW** | 5 |
| `src/services/notifications/index.ts` | **NIEUW** | 1 |
| `src/contexts/NotificationContext.tsx` | **NIEUW** | 3 |
| `src/hooks/useNotificationContext.ts` | **NIEUW** | 3 |
| `src/services/voipPush.ts` | **NIEUW** | 4 |
| `ios/CommEazyTemp/VoIPPushModule.swift` | **NIEUW** | 4 |
| `ios/CommEazyTemp/VoIPPushModule.m` | **NIEUW** | 4 |
| `src/services/notifications.ts` | **WIJZIG** → integreer in router | 1 |
| `src/services/xmpp.ts` | **WIJZIG** — voipToken | 4 |
| `src/services/container.ts` | **WIJZIG** — init volgorde | 1 |
| `src/navigation/index.tsx` | **WIJZIG** — NavigationHandler | 3 |
| `index.js` | **WIJZIG** — background handlers | 5 |
| `ios/CommEazyTemp/Info.plist` | **WIJZIG** — voip background mode | 4 |
| `src/locales/*.json` (13 bestanden) | **WIJZIG** — notification keys | 1 |
| Prosody: `mod_cloud_notify_fcm.lua` | **NIEUW** | 6 |
| Prosody: `mod_commeazy_call_push.lua` | **NIEUW** | 6 |
| `/opt/homebrew/etc/prosody/prosody.cfg.lua` | **WIJZIG** | 6 |

---

## Verificatie Checklist

### Per Fase

#### Fase 0: Dependencies
- [ ] Notifee installeert zonder build errors
- [ ] PushKit framework gelinkt in Xcode
- [ ] `voip` in UIBackgroundModes
- [ ] Android POST_NOTIFICATIONS permission in manifest

#### Fase 1: NotificationRouter
- [ ] Router singleton geïnitialiseerd in container.ts
- [ ] CallHandler, MessageHandler, GroupHandler geregistreerd
- [ ] Oude FCMNotificationService geïntegreerd (niet parallel)

#### Fase 2: NotificationDisplayService
- [ ] Android channels aangemaakt bij app start
- [ ] iOS categories geregistreerd
- [ ] `showLocal()` toont notificatie op iOS + Android
- [ ] Badge count werkt

#### Fase 3: NotificationContext
- [ ] FCM foreground → lokale notificatie getoond
- [ ] Tap op notificatie → navigeert naar juiste scherm
- [ ] Cold start met pending notificatie → navigeert na mount
- [ ] Background → foreground met tap → navigeert correct

#### Fase 4: VoIP Push
- [ ] VoIP token wordt opgehaald en naar Prosody gestuurd
- [ ] Inkomende VoIP push → CallKit call reported
- [ ] App terminated → VoIP push → CallKit lockscreen UI
- [ ] DND modus → VoIP push → CallKit doorbreekt DND

#### Fase 5: Background Handler
- [ ] App in background → bericht → lokale notificatie zichtbaar
- [ ] App terminated → bericht → push notificatie zichtbaar
- [ ] Gemiste oproep → notificatie met "Terugbellen" actie

#### Fase 6: Prosody
- [ ] FCM push gateway stuurt data messages
- [ ] VoIP push gateway stuurt naar APNs
- [ ] Privacy: geen berichtinhoud in push payload
- [ ] Dual-token registratie (FCM + APNs + VoIP)

### End-to-End Tests

| Test | Verwacht Resultaat |
|------|-------------------|
| **Bericht bij app open** | Lokale notificatie bovenaan scherm |
| **Bericht bij app in background** | Push notificatie in notification center |
| **Bericht bij app terminated** | Push notificatie → tap → app opent → navigeert naar chat |
| **Inkomende call bij app open** | CallKit UI + ringtone |
| **Inkomende call bij app background** | CallKit lockscreen UI |
| **Inkomende call bij app terminated** | VoIP push → CallKit lockscreen UI |
| **Inkomende call bij DND** | VoIP push doorbreekt DND → CallKit UI |
| **Gemiste call** | Notificatie met "Terugbellen" knop |
| **Groepsuitnodiging** | Notificatie met groepsnaam |
| **Tap op berichtnotificatie** | Navigeert naar ChatDetail van die chat |
| **Tap op gemiste call** | Navigeert naar CallHistory |

---

## Afhankelijkheden en Volgorde

```
Fase 0 (Dependencies)
  ↓
Fase 1 (NotificationRouter) + Fase 2 (DisplayService) — parallel mogelijk
  ↓
Fase 3 (NotificationContext) — vereist Fase 1 + 2
  ↓
Fase 4 (VoIP Push) — onafhankelijk van Fase 3, maar logisch erna
  ↓
Fase 5 (Background Handler) — vereist Fase 2
  ↓
Fase 6 (Prosody) — server-side, kan parallel met Fase 4/5
```

## Status

- [ ] Fase 0: Dependencies
- [ ] Fase 1: NotificationRouter
- [ ] Fase 2: NotificationDisplayService
- [ ] Fase 3: NotificationContext
- [ ] Fase 4: VoIP Push
- [ ] Fase 5: Background Handler
- [ ] Fase 6: Prosody Push Gateway
