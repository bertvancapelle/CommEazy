# CommEazy Mock Mode - Wijzigingen & Terugdraai Instructies

> **Aangemaakt:** 2026-02-11
> **Doel:** Documentatie van alle aanpassingen voor mock data modus en instructies om terug te draaien voor productie testing.

---

## Samenvatting Kernproblemen

### Probleem 1: FlatList/VirtualizedList Bug (React Native 0.73 + Hermes)

**Symptoom:** `TypeError: Cannot read property 'getItem' of undefined`

**Oorzaak:** Bug in VirtualizedList regel 497 waarbij props destructuring faalt wanneer native modules nog niet volledig geïnitialiseerd zijn.

**Oplossing:** FlatList vervangen door ScrollView + handmatige `.map()`

### Probleem 2: Module Loading Race Conditions

**Symptoom:** Native modules (`RNLocalize`, `Keychain`, etc.) zijn `undefined`

**Oorzaak:** Hermes evalueert top-level imports synchroon vóórdat de native bridge volledig is opgezet.

**Oplossing:** Dynamische imports (`await import()`) + delays

### Probleem 3: uuid/libsodium Incompatibiliteit met Hermes ✅ OPGELOST

**Symptoom:** `No secure random number generator found, js engine: hermes`

**Oorzaak:**
- `uuid` library mist werkende crypto random generator voor Hermes
- `libsodium-wrappers` vereist WebAssembly/crypto APIs die Hermes niet heeft

**Oplossing (geïmplementeerd 2026-02-11):**
- `uuid` vervangen door `react-native-uuid` (native RNG)
- `libsodium-wrappers` vervangen door `react-native-libsodium` (native module)

---

## Gewijzigde Bestanden

### 1. `src/app/App.tsx`

**Wijziging:** Delay toegevoegd voor native module initialisatie

```typescript
// TOEGEVOEGD (regel 64):
await new Promise(resolve => setTimeout(resolve, 100));
```

**Voor productie:** Kan blijven (veilig) of vervangen door echte service initialisatie in `initializeApp()`.

---

### 2. `src/screens/chat/ChatListScreen.tsx` ✅ GEÜPDATET

**Huidige status (2026-02-11):** Hybride modus - gebruikt `ServiceContainer.isInitialized` check.

**Wijzigingen:**
- Imports toegevoegd: `ServiceContainer`, `chatService`
- useEffect: Gebruikt `chatService.observeChatList()` wanneer services initialized zijn
- Fallback: Mock data via dynamische import wanneer services niet beschikbaar
- ScrollView i.p.v. FlatList (workaround voor VirtualizedList bug)

**Gedrag:**
- Als `ServiceContainer.isInitialized` → echte service (lokale WatermelonDB)
- Anders in `__DEV__` → mock data
- Anders → lege lijst

**Voor pure productie (verwijder mock fallback):**
```typescript
// Verwijder alle `else if (__DEV__)` blocks
// Behoud alleen de ServiceContainer.isInitialized logica
```

---

### 3. `src/screens/chat/ChatScreen.tsx` ✅ GEÜPDATET

**Huidige status (2026-02-11):** Hybride modus - gebruikt `ServiceContainer.isInitialized` check.

**Wijzigingen:**
- Imports toegevoegd: `ServiceContainer`, `chatService`
- useEffect: Gebruikt `chatService.observeMessages()` wanneer services initialized zijn
- handleSend: Gebruikt `chatService.sendMessage()` wanneer services initialized zijn
- Fallback: Mock data via dynamische import wanneer services niet beschikbaar
- ScrollView i.p.v. FlatList (workaround voor VirtualizedList bug)
- `isOwn` check: Nog steeds hardcoded `'ik@commeazy.local'` voor mock mode

**Gedrag:**
- Als `ServiceContainer.isInitialized` → echte service (lokale WatermelonDB + toekomstig XMPP)
- Anders in `__DEV__` → mock data lokaal toevoegen aan state
- Anders → lege lijst / geen functionaliteit

**Voor pure productie (verwijder mock fallback):**
```typescript
// 1. Verwijder alle `else if (__DEV__)` blocks
// 2. Update isOwn check naar: item.senderId === chatService.myJid
```

---

### 4. `src/screens/contacts/ContactListScreen.tsx`

**Wijzigingen:**
- FlatList → ScrollView
- Dynamische import van `MOCK_CONTACTS`

**Terugdraaien:** Vergelijkbaar patroon - vervang mock imports door echte contact service.

---

## Regels voor Toekomstige Ontwikkeling

### Regel 1: Vermijd Top-Level Imports van Native-Afhankelijke Modules

```typescript
// FOUT - wordt geëvalueerd voordat native bridge klaar is
import { chatService } from '@/services/chat';

// GOED - lazy loading
const loadService = async () => {
  const { chatService } = await import('@/services/chat');
  return chatService;
};
```

### Regel 2: FlatList Workaround (tot RN 0.74+)

Gebruik ScrollView + `.map()` voor lijsten tot ~100 items. Voor langere lijsten: upgrade React Native of gebruik `@shopify/flash-list`.

### Regel 3: uuid en libsodium Alternatieven ✅ GEÏMPLEMENTEERD

| Library | Probleem | Oplossing | Status |
|---------|----------|-----------|--------|
| `uuid` | Geen crypto RNG in Hermes | `react-native-uuid` | ✅ Geïnstalleerd |
| `libsodium-wrappers` | WASM issues in Hermes | `react-native-libsodium` | ✅ Geïnstalleerd |

**Gewijzigde bestanden:**
- `src/services/encryption.ts` - imports aangepast
- `src/services/chat.ts` - imports aangepast
- `src/services/database.ts` - imports aangepast
- `src/services/deviceLink.ts` - imports aangepast
- `src/types/react-native-uuid.d.ts` - type definitions toegevoegd

### Regel 4: Altijd Delays bij App Startup

```typescript
// Minimaal 50-100ms wachten voordat native modules worden aangesproken
await new Promise(resolve => setTimeout(resolve, 100));
```

### Regel 5: `__DEV__` Guards voor Mock Data

Alle mock code MOET binnen `if (__DEV__)` staan - wordt automatisch verwijderd in production builds.

---

## Checklist voor Productie Test Versie

- [x] `ChatScreen.tsx`: ChatService geïntegreerd met fallback naar mock ✅
- [x] `ChatListScreen.tsx`: ChatService geïntegreerd met fallback naar mock ✅
- [ ] `ContactListScreen.tsx`: Herstel contact service
- [x] `App.tsx`: ServiceContainer initialisatie geïmplementeerd ✅
- [x] Test uuid library met Hermes (vervangen door `react-native-uuid`) ✅
- [x] Test libsodium initialisatie met Hermes (vervangen door `react-native-libsodium`) ✅
- [ ] Overweeg upgrade naar React Native 0.74+ voor FlatList fix
- [ ] Test XMPP verbinding met Prosody server
- [ ] Test end-to-end encryptie flow

---

## Quick Reference: Mock vs Productie

| Component | Mock Mode | Productie Mode |
|-----------|-----------|----------------|
| Chat lijst | `getMockChatList()` | `chatService.getChatList()` |
| Berichten | `getMockMessages(chatId)` | `chatService.observeMessages()` |
| Versturen | Lokaal toevoegen aan state | `chatService.sendMessage()` |
| Contacten | `MOCK_CONTACTS` | `contactService.getContacts()` |
| User ID | `'ik@commeazy.local'` | `chatService.myJid` |

---

## Gerelateerde Documentatie

- `.claude/CLAUDE.md` - Project master context
- `.claude/skills/` - Agent team skill definities
- `src/services/mock/` - Mock data implementaties
