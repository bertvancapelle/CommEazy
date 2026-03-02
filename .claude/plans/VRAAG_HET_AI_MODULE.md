# "Vraag het AI" Module — Implementatieplan

## Status: PLAN GEREED ✅ — Wacht op implementatie (na Apple Music)

**Aangemaakt:** 2026-03-02
**Voorwaarde:** Apple Music module moet eerst afgerond zijn

---

## Overzicht

AI-assistent module voor CommEazy: gebruikers kunnen vragen stellen in natuurlijke taal en krijgen senior-vriendelijke antwoorden. Gebaseerd op Google Gemini API met OAuth2 authenticatie via bestaand Firebase account.

**Kernprincipe:** Twee-staps interactie — elke vraag krijgt ALTIJD eerst een senior-vriendelijk antwoord (via ingebakken system prompt), daarna vrije vervolgvragen.

---

## Architectuurbeslissingen (PNA Discussie 2026-03-02)

| Beslissing | Keuze | Motivatie |
|-----------|-------|-----------|
| **AI provider** | Google Gemini | Onbeperkt gratis tier, geen creditcard nodig |
| **Authenticatie** | OAuth2 via Google Sign-In | Native popup, 2-3 taps, geen API key copy/paste |
| **Account koppeling** | Firebase `linkWithCredential()` | Koppel Google aan bestaand telefoon-verified account |
| **API key nodig** | Nee | OAuth2 tokens worden automatisch beheerd |
| **Creditcard nodig** | Nee | Geen betalingsmethode vereist |
| **Kosten voor gebruiker** | Gratis | Google Gemini free tier is onbeperkt |
| **Server nodig** | Nee | Direct vanuit app naar Gemini API |
| **Gesprekshistorie** | On-device (AsyncStorage) | Zero-server-storage principe |
| **Senior-prompt** | System prompt ingebakken in app | Niet configureerbaar door gebruiker |
| **Interactie patroon** | Twee-staps | Altijd senior-vriendelijk initieel antwoord + vrije vervolgvragen |

### Waarom NIET Anthropic Claude?
- Vereist creditcard na $5 gratis tegoed
- Console is alleen Engels en developer-gericht
- API key setup te complex voor senioren/familieleden
- Veel Europese senioren hebben geen creditcard

### Waarom Google Gemini?
- Onbeperkte gratis tier
- Geen creditcard vereist
- OAuth2 login = native Google popup (2-3 taps)
- Firebase Auth integratie (al in gebruik)
- Ondersteunt Nederlands en alle 13 CommEazy talen

---

## User Experience Flows

### Flow 1: Eerste keer — Google Account koppelen

```
┌─────────────────────────────────────┐
│  🤖 Vraag het AI                    │  ← ModuleHeader
├─────────────────────────────────────┤
│                                     │
│   ┌───────────────────────────┐     │
│   │  🤖                       │     │
│   │                           │     │
│   │  Welkom bij Vraag het AI! │     │
│   │                           │     │
│   │  Stel elke vraag en       │     │
│   │  krijg een duidelijk      │     │
│   │  antwoord.                │     │
│   │                           │     │
│   │  Om te beginnen moet je   │     │
│   │  eenmalig inloggen met    │     │
│   │  een Google account.      │     │
│   │                           │     │
│   │  ┌─────────────────────┐  │     │
│   │  │ 🔵 Inloggen met     │  │     │
│   │  │    Google            │  │     │
│   │  └─────────────────────┘  │     │
│   └───────────────────────────┘     │
│                                     │
└─────────────────────────────────────┘
```

**Stappen:**
1. Gebruiker opent "Vraag het AI" module
2. Welcome screen met uitleg (1 zin) + "Inloggen met Google" knop
3. Native Google Sign-In popup verschijnt
4. Gebruiker logt in (of kiest bestaand account)
5. App koppelt Google credential aan Firebase account via `linkWithCredential()`
6. OAuth2 token wordt opgeslagen in iOS Keychain
7. Chat interface verschijnt — klaar om vragen te stellen

### Flow 2: Terugkerende gebruiker

```
┌─────────────────────────────────────┐
│  🤖 Vraag het AI                    │  ← ModuleHeader
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🤖 Hallo! Stel gerust een  │    │
│  │    vraag. Ik help je graag. │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Wat is het verschil tussen  │    │  ← Vorige vraag
│  │ griep en verkoudheid?       │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🤖 Griep en verkoudheid    │    │  ← Vorig antwoord
│  │ lijken op elkaar, maar...   │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│  [Stel een vraag...        ] [📤]   │  ← Input field + verzend knop
└─────────────────────────────────────┘
```

**Stappen:**
1. Module opent met chat interface
2. Vorige gesprekken zijn zichtbaar (ScrollView)
3. Gebruiker typt vraag of dicteert via voice
4. Verzend knop (60pt, duidelijk zichtbaar)
5. Loading indicator met tekst "Even denken..."
6. Senior-vriendelijk antwoord verschijnt
7. Gebruiker kan vervolgvragen stellen

### Flow 3: Nieuw gesprek starten

```
┌─────────────────────────────────────┐
│  🤖 Vraag het AI         [🗑️ Nieuw]│
├─────────────────────────────────────┤
│                                     │
│  "Wil je een nieuw gesprek          │
│   starten? Je huidige gesprek       │
│   wordt bewaard."                   │
│                                     │
│  [Ja, nieuw gesprek]  [Annuleer]    │
│                                     │
└─────────────────────────────────────┘
```

### Flow 4: Gesprekshistorie bekijken

```
┌─────────────────────────────────────┐
│  🤖 Vraag het AI        [📋 Vorige]│
├─────────────────────────────────────┤
│                                     │
│  📅 Vandaag                         │
│  ┌─────────────────────────────┐    │
│  │ Wat is het verschil tussen  │    │
│  │ griep en verkoudheid?       │    │
│  │ 14:32                       │    │
│  └─────────────────────────────┘    │
│                                     │
│  📅 Gisteren                        │
│  ┌─────────────────────────────┐    │
│  │ Hoe zet ik mijn telefoon    │    │
│  │ op stil?                    │    │
│  │ 10:15                       │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

---

## Twee-Staps Interactie (Kernfeature)

### System Prompt (Ingebakken)

```
Je bent een vriendelijke en geduldige assistent die vragen beantwoordt
voor mensen die niet altijd even handig zijn met technologie.

Regels:
1. Gebruik eenvoudige, duidelijke taal — vermijd jargon
2. Geef korte antwoorden (max 3-4 zinnen voor het eerste antwoord)
3. Gebruik opsommingstekens voor stappen
4. Als iets meerdere stappen heeft, nummer ze (1, 2, 3...)
5. Eindig met een uitnodiging om een vervolgvraag te stellen
6. Antwoord in dezelfde taal als de vraag
7. Wees geduldig en respectvol — nooit neerbuigend
8. Als je iets niet weet, zeg dat eerlijk

Antwoord altijd in de taal van de gebruiker.
```

### Voorbeeld Interactie

**Gebruiker:** "Wat is WiFi?"

**AI (stap 1 — senior-vriendelijk):**
> WiFi is een draadloze internetverbinding. Het werkt zoals een onzichtbare kabel tussen je telefoon en het internet.
>
> Je hebt thuis waarschijnlijk een kastje van je internetprovider staan — dat is je WiFi-router. Alle apparaten in huis kunnen daar draadloos mee verbinden.
>
> Wil je weten hoe je verbinding maakt met WiFi?

**Gebruiker:** "Ja, hoe doe ik dat?"

**AI (vervolgvraag):**
> Om WiFi aan te zetten op je iPhone:
>
> 1. Open **Instellingen** (het tandwiel-icoontje)
> 2. Tik op **Wi-Fi**
> 3. Zet de schakelaar **aan** (groen)
> 4. Kies je netwerknaam uit de lijst
> 5. Vul het wachtwoord in (staat vaak op een sticker onder je router)
>
> Lukt het? Of heb je hulp nodig bij een van deze stappen?

---

## Technische Architectuur

### Bestandsstructuur

```
src/
  contexts/
    AskAIContext.tsx           ← Hoofd-context (auth, chat, history)
  screens/
    modules/
      AskAIScreen.tsx          ← Hoofdscherm (chat interface)
  components/
    askAI/
      AskAIWelcomeScreen.tsx   ← Eerste keer welkom + Google login
      AskAIChatBubble.tsx      ← Chatbericht bubble (user/AI)
      AskAIInputBar.tsx        ← Input field + verzend knop
      AskAIHistoryModal.tsx    ← Vorige gesprekken overzicht
      AskAITypingIndicator.tsx ← "Even denken..." animatie
  services/
    gemini/
      geminiService.ts         ← Google Gemini API communicatie
      geminiTypes.ts           ← TypeScript types voor Gemini API
      seniorPrompt.ts          ← System prompt definitie
  types/
    askAI.ts                   ← Gedeelde types (Conversation, Message, etc.)
```

### Context Interface

```typescript
// src/contexts/AskAIContext.tsx

export interface AskAIContextValue {
  // Auth state
  isGoogleLinked: boolean;
  isLinking: boolean;
  linkGoogleAccount: () => Promise<void>;

  // Current conversation
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;       // AI is aan het antwoorden
  error: string | null;

  // Chat actions
  sendMessage: (text: string) => Promise<void>;
  startNewConversation: () => void;

  // History
  conversations: ConversationSummary[];
  loadConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  clearAllConversations: () => Promise<void>;
}
```

### Types

```typescript
// src/types/askAI.ts

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  title: string;          // Auto-gegenereerd uit eerste vraag
}

export interface ConversationSummary {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: number;
  messageCount: number;
}
```

### Gemini API Service

```typescript
// src/services/gemini/geminiService.ts

import { GoogleSignin } from '@react-native-google-signin/google-signin';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.0-flash';  // Snel, gratis, meertalig

export async function sendToGemini(
  messages: Message[],
  systemPrompt: string,
): Promise<string> {
  const tokens = await GoogleSignin.getTokens();

  const response = await fetch(
    `${GEMINI_API_URL}/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
        generationConfig: {
          maxOutputTokens: 1024,       // Beperkt voor beknopte antwoorden
          temperature: 0.7,            // Balans creativiteit/consistentie
        },
        safetySettings: [
          // Strenge safety voor senioren-app
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        ],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new GeminiError(data.error?.message || 'Onbekende fout', response.status);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
```

### Google Sign-In Koppeling aan Firebase

```typescript
// In AskAIContext.tsx

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';

const linkGoogleAccount = async () => {
  try {
    setIsLinking(true);

    // 1. Google Sign-In popup
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();

    // 2. Maak Firebase credential
    const googleCredential = auth.GoogleAuthProvider.credential(
      userInfo.idToken
    );

    // 3. Link aan bestaand Firebase account (telefoon-verified)
    const currentUser = auth().currentUser;
    if (currentUser) {
      await currentUser.linkWithCredential(googleCredential);
    }

    // 4. Sla linked status op
    await AsyncStorage.setItem('@commeazy/google_linked', 'true');
    setIsGoogleLinked(true);

  } catch (error: any) {
    if (error.code === 'auth/credential-already-in-use') {
      // Google account al gekoppeld aan ander Firebase account
      setError(t('askAI.errors.accountAlreadyLinked'));
    } else if (error.code === 'auth/provider-already-linked') {
      // Al gekoppeld — geen actie nodig
      setIsGoogleLinked(true);
    } else {
      setError(t('askAI.errors.linkFailed'));
    }
  } finally {
    setIsLinking(false);
  }
};
```

---

## Gesprekshistorie (AsyncStorage)

### Storage Schema

```typescript
// Keys:
// @commeazy/askai_conversations  → ConversationSummary[] (index)
// @commeazy/askai_conv_{id}      → Conversation (volledige messages)
// @commeazy/askai_current        → string (huidige conversation id)
// @commeazy/google_linked        → 'true' | null

const MAX_CONVERSATIONS = 50;      // Max bewaard
const MAX_MESSAGES_PER_CONV = 100; // Max per gesprek
```

### Automatische Opschoning

- Bij >50 gesprekken: oudste worden verwijderd
- Bij >100 berichten in gesprek: oudste worden verwijderd
- Gebruiker kan handmatig verwijderen (per gesprek of alles)

---

## UI Screen Layout

### AskAIScreen — Chat Interface

```
┌──────────────────────────────────────────────────────────────┐
│  Safe Area                                                    │
├──────────────────────────────────────────────────────────────┤
│  🤖 Vraag het AI              [📋] [🗑️]                      │  ← ModuleHeader
│     ↑ moduleId="askAI"                                       │     📋 = historie, 🗑️ = nieuw gesprek
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐      │
│  │ 🤖 Hallo! Stel gerust een vraag.                  │      │  ← AI welkomstbericht
│  │    Ik help je graag.                               │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
│                    ┌──────────────────────────────────┐      │
│                    │ Wat is het verschil tussen       │      │  ← User bericht (rechts)
│                    │ griep en verkoudheid?            │      │
│                    └──────────────────────────────────┘      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐      │
│  │ 🤖 Griep en verkoudheid lijken op elkaar,         │      │  ← AI antwoord (links)
│  │ maar er zijn belangrijke verschillen:              │      │
│  │                                                    │      │
│  │ • Griep begint plotseling met koorts              │      │
│  │ • Verkoudheid bouwt langzaam op                   │      │
│  │ • Bij griep voel je je echt ziek                   │      │
│  │                                                    │      │
│  │ Wil je meer weten over de behandeling?            │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐      │
│  │ 🤖 Even denken...                                 │      │  ← Typing indicator
│  │ ●●●                                               │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  ┌──────────┐       │
│  │ Stel een vraag...                  │  │   📤     │       │  ← Input + verzend
│  └────────────────────────────────────┘  └──────────┘       │  ← 60pt hoogte
│  Safe Area Bottom                                            │
└──────────────────────────────────────────────────────────────┘
```

### Chat Bubble Styling (WhatsApp-style)

```typescript
// User berichten: rechts uitgelijnd, accentkleur achtergrond
const userBubble = {
  alignSelf: 'flex-end',
  backgroundColor: moduleColor,      // Module accent kleur
  borderRadius: borderRadius.lg,
  borderBottomRightRadius: 4,        // "Staartje" rechts
  maxWidth: '80%',
  padding: spacing.md,
};

// AI berichten: links uitgelijnd, surface achtergrond
const aiBubble = {
  alignSelf: 'flex-start',
  backgroundColor: colors.surface,
  borderRadius: borderRadius.lg,
  borderBottomLeftRadius: 4,         // "Staartje" links
  maxWidth: '85%',                   // Iets breder voor AI (langere antwoorden)
  padding: spacing.md,
};
```

---

## Module Registratie Checklist

Alle vereiste registratiepunten conform CLAUDE.md "Nieuwe Module Validatie Checklist":

| # | Check | Bestand | Actie |
|---|-------|---------|-------|
| 1 | NavigationDestination type | `WheelNavigationMenu.tsx` | `'askAI'` toevoegen aan StaticNavigationDestination |
| 2 | STATIC_MODULE_DEFINITIONS | `WheelNavigationMenu.tsx` | `askAI: { labelKey: 'navigation.askAI', icon: 'askAI' }` |
| 3 | ALL_MODULES array | `useModuleUsage.ts` | `'askAI'` toevoegen |
| 4 | DEFAULT_MODULE_ORDER array | `useModuleUsage.ts` | `'askAI'` toevoegen (positie: na weather) |
| 5 | MODULE_TINT_COLORS | `liquidGlass.ts` | Kleur registreren (voorstel: groen #2E7D32 of teal) |
| 6 | ModuleColorId type | `liquidGlass.ts` | `'askAI'` toevoegen |
| 7 | CUSTOMIZABLE_MODULES | `ModuleColorsContext.tsx` | `'askAI'` toevoegen |
| 8 | MODULE_LABELS | `ModuleColorsContext.tsx` | `askAI: 'navigation.askAI'` |
| 9 | i18n (13 talen) | `src/locales/*.json` | `navigation.askAI` + alle module strings |
| 10 | Navigation route | `navigation/index.tsx` | Tab.Screen registreren |
| 11 | Screen component | `screens/modules/AskAIScreen.tsx` | Aanmaken |
| 12 | Icon | `Icon.tsx` | `askAI` icon toevoegen (robot/chat-bot icoon) |

---

## Dependencies

### Nieuwe packages (te installeren)

| Package | Versie | Doel |
|---------|--------|------|
| `@react-native-google-signin/google-signin` | latest | Google OAuth2 Sign-In |

### Bestaande packages (hergebruiken)

| Package | Doel |
|---------|------|
| `@react-native-async-storage/async-storage` | Gesprekshistorie opslag |
| `@react-native-firebase/auth` | Firebase account linking |
| `react-i18next` | Vertalingen |

### iOS Setup

- Google Sign-In vereist `GoogleService-Info.plist` update (CLIENT_ID)
- Info.plist: URL scheme toevoegen voor Google Sign-In callback
- CocoaPods: `pod install` na package installatie

### Android Setup

- `google-services.json` update (SHA-1 fingerprint)
- Build.gradle: Google Sign-In dependency

---

## i18n Keys (13 Talen)

### Vereiste keys

```json
{
  "navigation": {
    "askAI": "Vraag het AI"
  },
  "modules": {
    "askAI": {
      "title": "Vraag het AI",
      "welcome": {
        "title": "Welkom bij Vraag het AI!",
        "description": "Stel elke vraag en krijg een duidelijk antwoord.",
        "loginPrompt": "Om te beginnen moet je eenmalig inloggen met een Google account.",
        "loginButton": "Inloggen met Google",
        "loginHelp": "Je Google account wordt alleen gebruikt voor de AI-assistent. CommEazy bewaart je gegevens niet."
      },
      "chat": {
        "greeting": "Hallo! Stel gerust een vraag. Ik help je graag.",
        "inputPlaceholder": "Stel een vraag...",
        "sendButton": "Verstuur",
        "thinking": "Even denken...",
        "newConversation": "Nieuw gesprek",
        "newConversationConfirm": "Wil je een nieuw gesprek starten? Je huidige gesprek wordt bewaard.",
        "history": "Vorige gesprekken",
        "noHistory": "Je hebt nog geen eerdere gesprekken.",
        "deleteConversation": "Gesprek verwijderen",
        "deleteConversationConfirm": "Weet je zeker dat je dit gesprek wilt verwijderen?",
        "clearAll": "Alles verwijderen",
        "clearAllConfirm": "Weet je zeker dat je alle gesprekken wilt verwijderen? Dit kan niet ongedaan worden."
      },
      "errors": {
        "linkFailed": "Inloggen mislukt. Probeer het opnieuw.",
        "accountAlreadyLinked": "Dit Google account is al in gebruik. Probeer een ander account.",
        "sendFailed": "Je vraag kon niet worden verstuurd. Probeer het opnieuw.",
        "networkError": "Geen internetverbinding. Controleer je verbinding en probeer het opnieuw.",
        "rateLimited": "Even geduld — je hebt veel vragen gesteld. Probeer het over een minuutje opnieuw.",
        "tooLong": "Je vraag is te lang. Probeer een kortere vraag te stellen."
      },
      "a11y": {
        "sendMessage": "Verstuur bericht",
        "newConversation": "Start nieuw gesprek",
        "viewHistory": "Bekijk vorige gesprekken",
        "aiResponse": "Antwoord van AI assistent",
        "userMessage": "Jouw bericht"
      }
    }
  }
}
```

### Vertalingen per taal

| Taal | `navigation.askAI` | `modules.askAI.title` |
|------|--------------------|-----------------------|
| nl | Vraag het AI | Vraag het AI |
| en | Ask AI | Ask AI |
| en-GB | Ask AI | Ask AI |
| de | Frag die KI | Frag die KI |
| fr | Demandez à l'IA | Demandez à l'IA |
| es | Pregunta a la IA | Pregunta a la IA |
| it | Chiedi all'IA | Chiedi all'IA |
| no | Spør KI | Spør KI |
| sv | Fråga AI | Fråga AI |
| da | Spørg AI | Spørg AI |
| pt | Pergunte à IA | Pergunte à IA |
| pt-BR | Pergunte à IA | Pergunte à IA |
| pl | Zapytaj AI | Zapytaj AI |

---

## Rate Limiting & Error Handling

### Gemini Free Tier Limieten

| Limiet | Waarde | Handling |
|--------|--------|---------|
| Requests per minuut | 15 | Toon `rateLimited` error + timer |
| Requests per dag | 1500 | Toon vriendelijke "dagelijks limiet" melding |
| Tokens per minuut | 32,000 | maxOutputTokens op 1024 beperkt risico |
| Max input tokens | 32,768 | Beperk conversation history in request |

### Error Recovery

```typescript
// Rate limiting met exponential backoff
const handleRateLimit = async (retryAfter: number) => {
  const waitSeconds = Math.min(retryAfter || 60, 120);
  setError(t('askAI.errors.rateLimited'));

  // Countdown timer zichtbaar voor gebruiker
  setRateLimitCountdown(waitSeconds);
  const interval = setInterval(() => {
    setRateLimitCountdown(prev => {
      if (prev <= 1) {
        clearInterval(interval);
        setError(null);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
};
```

### Conversation History Trimming

Om binnen token limieten te blijven, stuur maximaal de laatste 10 berichten mee:

```typescript
const getContextMessages = (messages: Message[]): Message[] => {
  // Altijd system prompt + laatste 10 berichten
  const recentMessages = messages.slice(-10);
  return recentMessages;
};
```

---

## Security & Privacy

### Principes

1. **Zero server storage** — Geen CommEazy server betrokken
2. **On-device history** — AsyncStorage, niet in cloud
3. **OAuth2 tokens** — iOS Keychain / Android Keystore
4. **Geen PII logging** — Nooit vragen of antwoorden loggen
5. **Google Privacy** — Google's standaard privacy policy van toepassing op Gemini API
6. **Transparantie** — Gebruiker wordt geïnformeerd dat vragen naar Google worden gestuurd

### Privacy Melding (in welkomstscherm)

```
"Je vragen worden verwerkt door Google's AI-dienst.
CommEazy bewaart je gesprekken alleen op dit apparaat.
Google kan je vragen gebruiken om hun dienst te verbeteren."
```

---

## Accessibility

### VoiceOver / TalkBack

- Alle chat bubbles: `accessibilityRole="text"` met `accessibilityLabel`
- Input field: `accessibilityLabel={t('askAI.chat.inputPlaceholder')}`
- Verzendknop: `accessibilityLabel={t('askAI.a11y.sendMessage')}`
- Nieuwe AI berichten: `AccessibilityInfo.announceForAccessibility()`

### Voice Commands (VoiceFocusable)

| Commando | Actie |
|----------|-------|
| "verstuur" / "stuur" | Verzend huidig bericht |
| "nieuw gesprek" | Start nieuw gesprek |
| "vorige gesprekken" | Open historie modal |
| "dicteer" | Activeer spraak-naar-tekst |

### Senior-Inclusive Design

- Input field: 60pt hoogte
- Verzendknop: 60pt × 60pt
- Chat tekst: 18pt minimum
- Antwoorden: max 85% breedte (leesbaar)
- Loading: spinner + "Even denken..." tekst
- Errors: menselijke taal + "Probeer opnieuw" knop

---

## Gefaseerde Implementatie

### Fase 1: Foundation

- [ ] Types definiëren (`src/types/askAI.ts`)
- [ ] Gemini service (`src/services/gemini/`)
- [ ] Senior system prompt (`src/services/gemini/seniorPrompt.ts`)
- [ ] Google Sign-In package installeren en configureren

### Fase 2: Context & Auth

- [ ] AskAIContext provider aanmaken
- [ ] Google Sign-In → Firebase linkWithCredential flow
- [ ] AsyncStorage conversation persistence
- [ ] Token refresh handling

### Fase 3: UI Components

- [ ] AskAIWelcomeScreen (eerste keer login)
- [ ] AskAIChatBubble (user/AI berichten)
- [ ] AskAIInputBar (tekst input + verzendknop)
- [ ] AskAITypingIndicator (loading animatie)
- [ ] AskAIHistoryModal (vorige gesprekken)

### Fase 4: Screen & Integration

- [ ] AskAIScreen hoofdscherm
- [ ] ModuleHeader integratie (moduleId="askAI")
- [ ] Keyboard handling (KeyboardAvoidingView)
- [ ] Auto-scroll naar nieuwste bericht

### Fase 5: Module Registratie

- [ ] Volledige checklist (12 punten) doorlopen
- [ ] i18n alle 13 talen
- [ ] Icon toevoegen
- [ ] Navigation route registreren

### Fase 6: Polish & Accessibility

- [ ] VoiceOver/TalkBack labels
- [ ] Voice commands registreren
- [ ] Error handling met recovery
- [ ] Rate limiting UI
- [ ] Welcome modal (first-time use)

---

## Module Kleur

**Voorstel:** Groen (#4CAF50) — associatie met "hulp", "antwoord", "AI assistent"

Alternatief: Teal (#009688) — maar dit wordt al door Radio gebruikt.

Definitieve keuze wordt bepaald bij implementatie, in overleg met de gebruiker.

---

## Afhankelijkheden van Andere Modules

| Module | Afhankelijkheid | Type |
|--------|----------------|------|
| Firebase Auth | Bestaand account voor linking | Hard |
| ModuleColorsContext | Kleur customization | Hard |
| WheelNavigationMenu | Navigatie registratie | Hard |
| HoldToNavigateWrapper | Long-press navigatie | Soft |
| ButtonStyleContext | Knop styling consistent | Soft |

---

## Open Vragen (te Beantwoorden bij Implementatie)

1. **Markdown rendering** — Gemini antwoorden kunnen markdown bevatten. Moeten we een markdown renderer gebruiken of alleen plain text?
2. **Code blocks** — Als AI code voorbeelden geeft, hoe tonen we die leesbaar?
3. **Afbeeldingen** — Gemini kan afbeeldingen beschrijven. Willen we afbeelding-upload ondersteunen?
4. **Offline mode** — Wat tonen we als er geen internet is? Alleen historie?
5. **Exacte icon** — Robot, chat-bot, of sparkle/wand icoon?
