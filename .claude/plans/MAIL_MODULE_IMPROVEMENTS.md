# Mail Module Verbeterplan — Senior UX Audit

> **Status:** Plan — wacht op goedkeuring
> **Datum:** 2026-03-06
> **Aanleiding:** Grondige analyse van de mail module vanuit senior-perspectief

---

## Overzicht

Dit plan adresseert alle gevonden problemen en ontbrekende functionaliteit in de mail module, georganiseerd in 4 fasen. Elke fase levert een werkend, testbaar geheel op.

---

## Fase 1 — UX Fixes (touch targets, typografie, compliance)

Kleine maar kritieke fixes die de bestaande functionaliteit bruikbaarder maken voor senioren. Puur code-aanpassingen in bestaande bestanden.

### 1.1 Touch Target Fixes

| # | Fix | Bestand | Regel | Wat | Van → Naar |
|---|-----|---------|-------|-----|------------|
| 1 | Vlag-toggle vergroten | `MailListItem.tsx` | ~161 | Icon + hitSlop te klein | ~42pt → 60pt (vergroot icon naar 24px + hitSlop 18) |
| 2 | SecuritySelector vergroten | `MailOnboardingStep2.tsx` | ~499 | `minHeight: 36` | 36pt → 60pt |
| 3 | Zoek-clear pill vergroten | `MailInboxScreen.tsx` | ~562 | Pill met hitSlop te klein | ~36pt → 60pt (vergroot padding + hitSlop) |

### 1.2 Typografie Fixes

| # | Fix | Bestand | Regel | Van → Naar |
|---|-----|---------|-------|------------|
| 4 | Chip tekst vergroten | `MailComposeScreen.tsx` | ~1275 | `fontSize: 15` → `fontSize: 18` (typography.body) |
| 5 | Suggestie email vergroten | `MailComposeScreen.tsx` | ~1323 | `fontSize: 14` → `fontSize: 16` (typography.label minimum) |

### 1.3 Hardcoded Kleuren → Theme Tokens

| # | Fix | Bestanden | Wat |
|---|-----|-----------|-----|
| 6 | `#FFFFFF` → `colors.textOnPrimary` | MailScreen, MailInboxScreen, MailDetailScreen, MailComposeScreen | Witte tekst op knoppen |
| 7 | `rgba(255,255,255,0.15)` → theme token | MailDetailScreen, MailComposeScreen | Knop achtergronden |
| 8 | Success/error kleuren → theme tokens | AttachmentRow, MailDetailScreen | `#4CAF50` → `colors.success`, `#E8F5E9` → `colors.success + '20'` |
| 9 | `colors.background` static → `useColors()` | MailScreen | Dark mode container fix |

### 1.4 Commit

```
fix(mail): UX compliance — touch targets, typography, theme tokens
```

**Bestanden geraakt:** 6
**Risico:** Laag — alleen styling wijzigingen
**Skill validatie:** ui-designer, accessibility-specialist

---

## Fase 2 — Essentiële Ontbrekende Functionaliteit

Features die elke senior email-gebruiker verwacht.

### 2.1 Bevestiging na Verzenden

**Wat:** Na succesvol verzenden, toon een duidelijk bevestigingsscherm met groen vinkje en "Mail verstuurd!" tekst. Automatisch terug naar inbox na 2 seconden, of direct bij tap.

**Waarom:** Senioren twijfelen of hun actie succesvol was. Een duidelijke visuele bevestiging geeft vertrouwen.

**Implementatie:**
- `MailComposeScreen.tsx`: Na `sendMessage` success, toon `SendConfirmationOverlay` component
- Nieuw component `SendConfirmationOverlay.tsx`: Fullscreen overlay met checkmark animatie, tekst, auto-dismiss
- Haptic feedback: `success` type
- i18n keys: `modules.mail.compose.sentSuccess`, `modules.mail.compose.sentSuccessHint` (13 talen)

**Bestanden:**
- `src/screens/mail/SendConfirmationOverlay.tsx` (nieuw)
- `src/screens/mail/MailComposeScreen.tsx` (wijziging — success handler)
- 13 locale bestanden (nieuwe keys)

### 2.2 Ongelezen/Gelezen Toggle

**Wat:** In mail detail, een knop om een gelezen mail terug te markeren als ongelezen. In inbox, visuele indicator (bold + dot) voor ongelezen mails (bestaat al), plus long-press optie om te togglen.

**Waarom:** Senioren openen mail per ongeluk en willen deze later teruglezen. Ze moeten kunnen zien welke mails ze nog moeten afhandelen.

**Implementatie:**
- `MailDetailScreen.tsx`: Knop "Markeer als ongelezen" in action bar (naast reply/forward/delete)
- `MailModule.swift`: `markAsUnread` methode (IMAP `STORE -FLAGS (\Seen)`)
- Bridge: `markAsRead(uid, value)` parameter toevoegen (true/false)
- `MailInboxScreen.tsx`: Na terugkeer uit detail, ververs cached header status
- i18n keys: `modules.mail.detail.markUnread`, `modules.mail.detail.markRead` (13 talen)

**Bestanden:**
- `ios/CommEazyTemp/MailModule.swift` (wijziging — markAsUnread)
- `src/screens/mail/MailDetailScreen.tsx` (wijziging — toggle knop)
- `src/screens/mail/MailInboxScreen.tsx` (wijziging — refresh na toggle)
- 13 locale bestanden (nieuwe keys)

### 2.3 Verzonden Map Toegankelijk

**Wat:** "Verzonden" map zichtbaar in de folder dropdown. Eventueel een snelkoppeling "Bekijk in Verzonden" op het bevestigingsscherm na verzenden.

**Waarom:** Senioren willen controleren of hun mail echt verstuurd is.

**Implementatie:**
- `MailInboxScreen.tsx`: Folder dropdown toont al alle IMAP folders — valideer dat "Sent" / "Verzonden items" correct wordt weergegeven
- `mailDetailHelpers.ts`: Voeg folder display name mapping toe voor bekende sent-folder namen (Gmail: "[Gmail]/Sent Mail", Outlook: "Sent Items", etc.)
- `SendConfirmationOverlay.tsx`: Optionele "Bekijk in Verzonden" knop
- i18n keys: folder namen + "Bekijk in Verzonden" (13 talen)

**Bestanden:**
- `src/screens/mail/mailDetailHelpers.ts` (wijziging — folder name mapping)
- `src/screens/mail/SendConfirmationOverlay.tsx` (wijziging — link naar verzonden)
- `src/screens/mail/MailInboxScreen.tsx` (wijziging — folder navigatie na tap)
- 13 locale bestanden (nieuwe keys)

### 2.4 Reply All Knop

**Wat:** Aparte "Beantwoord allen" knop naast "Beantwoord", ALLEEN zichtbaar als er meerdere ontvangers zijn. Duidelijk label met uitleg.

**Waarom:** Senioren begrijpen het verschil tussen Reply en Reply All niet. Door het alleen te tonen wanneer relevant, en met duidelijke labels, voorkomen we verwarring.

**Implementatie:**
- `MailDetailScreen.tsx`: Detecteer `to.length + cc.length > 1` → toon extra "Beantwoord allen" knop
- `MailComposeScreen.tsx`: Accepteer `replyAll: true` prop → vul To + CC voor met alle originele ontvangers (excl. jezelf)
- i18n keys: `modules.mail.detail.replyAll`, `modules.mail.detail.replyAllHint` (13 talen)

**Bestanden:**
- `src/screens/mail/MailDetailScreen.tsx` (wijziging — extra knop)
- `src/screens/mail/MailComposeScreen.tsx` (wijziging — replyAll logic)
- 13 locale bestanden (nieuwe keys)

### 2.5 Commit

```
feat(mail): Send confirmation, read/unread toggle, sent folder, reply all
```

**Bestanden geraakt:** ~8 + 13 locales
**Risico:** Medium — native module wijziging (markAsUnread), nieuwe component
**Skill validatie:** ui-designer, accessibility-specialist, ios-specialist, react-native-expert

---

## Fase 3 — Geavanceerde Functionaliteit

Features die de mail module naar een volwaardig niveau tillen.

### 3.1 Foto Bijlagen (Camera Roll)

**Wat:** Foto's selecteren uit fotoalbum en bijvoegen aan mail. De bestaande code in `MailComposeScreen.tsx` is al voorbereid maar uitgeschakeld (`isCameraRollAvailable = false`).

**Waarom:** "Ik wil die foto van de kleinkinderen doorsturen naar tante Mia" — een van de meest gevraagde use cases voor senioren.

**Implementatie:**
- Installeer `@react-native-camera-roll/camera-roll` package
- `MailComposeScreen.tsx`: Zet `isCameraRollAvailable = true`, activeer bestaande foto-picker UI
- Permissie handling: Gebruik `react-native-permissions` voor `PHOTO_LIBRARY` access
- Compressie: Bestaande `compressImageIfNeeded` functie is al aanwezig
- Size limit waarschuwing: Bestaande logica is al aanwezig
- iOS Privacy Manifest: Voeg `PHPhotoLibrary` reason toe aan `PrivacyInfo.xcprivacy`
- i18n keys: Bestaande keys controleren, eventueel permissie-specifieke berichten toevoegen (13 talen)

**Bestanden:**
- `package.json` (dependency toevoegen)
- `ios/Podfile` (pod toevoegen)
- `src/screens/mail/MailComposeScreen.tsx` (wijziging — enable foto's)
- `ios/CommEazyTemp/PrivacyInfo.xcprivacy` (wijziging — photo library reason)
- `ios/CommEazyTemp/Info.plist` (NSPhotoLibraryUsageDescription indien ontbreekt)
- 13 locale bestanden (eventuele nieuwe keys)

**Let op:** Vereist `pod install` en clean build.

### 3.2 Auto-Save Drafts

**Wat:** Automatisch concept opslaan naar AsyncStorage bij:
- App naar achtergrond
- Navigatie weg van compose scherm (na bevestiging)
- Periodiek (elke 30 seconden)

Bij terugkeer naar compose: "Je hebt een onvoltooid concept. Wil je verder schrijven?"

**Waarom:** Senioren verliezen vaker hun werk door per ongeluk teruggaan of app-crash.

**Implementatie:**
- `src/services/mail/draftService.ts` (nieuw): AsyncStorage CRUD voor drafts
- `MailComposeScreen.tsx`: Auto-save timer + AppState listener + draft restore dialog
- `MailInboxScreen.tsx`: Badge/indicator als er een draft beschikbaar is
- Draft data model: `{ to, cc, bcc, subject, body, attachments, savedAt, replyToUid? }`
- i18n keys: `modules.mail.compose.draftSaved`, `modules.mail.compose.draftRestore`, `modules.mail.compose.draftDiscard` (13 talen)

**Bestanden:**
- `src/services/mail/draftService.ts` (nieuw)
- `src/screens/mail/MailComposeScreen.tsx` (wijziging — auto-save + restore)
- `src/screens/mail/MailInboxScreen.tsx` (wijziging — draft indicator)
- 13 locale bestanden (nieuwe keys)

### 3.3 Mail Voorleesfunctie (Piper TTS)

**Wat:** "Lees voor" knop in mail detail die de mail body voorleest via Piper TTS (Nederlands) of system TTS (andere talen).

**Waarom:** Senioren met verminderd zicht, of die simpelweg liever luisteren. Piper TTS is al beschikbaar in de app.

**Implementatie:**
- `MailDetailScreen.tsx`: "Lees voor" knop in action bar
- Text extraction: Strip HTML tags uit mail body voor TTS input
- Taaldetectie: Detecteer taal van mail body → kies TTS engine (Piper voor NL, system TTS voor andere talen)
- Playback controls: Play/Pause/Stop, voortgangsvisualisatie
- AudioOrchestrator integratie: Pauzeer andere audio bronnen tijdens voorlezen
- i18n keys: `modules.mail.detail.readAloud`, `modules.mail.detail.stopReading` (13 talen)

**Bestanden:**
- `src/screens/mail/MailDetailScreen.tsx` (wijziging — TTS knop + controls)
- `src/services/mail/mailTtsService.ts` (nieuw — TTS orchestratie)
- 13 locale bestanden (nieuwe keys)

### 3.4 Tekst Vergroten in Mail Body

**Wat:** "Aa" knop boven de mail body WebView waarmee de gebruiker kan wisselen tussen 3 tekstgrootten: Normaal (18px), Groot (24px), Extra Groot (32px). Keuze wordt onthouden via AsyncStorage.

**Waarom:** Veel mails gebruiken kleine fonts. Senioren moeten zonder pinch-to-zoom de tekst kunnen vergroten.

**Implementatie:**
- `MailDetailScreen.tsx`: "Aa" toggle knop boven WebView
- `MailBodyWebView.tsx`: Accepteer `fontScale` prop, pas base CSS font-size aan
- `mailDetailHelpers.ts`: `buildWebViewHtml` accepteert `baseFontSize` parameter
- AsyncStorage: `@commeazy/mailFontSize` (persist keuze)
- i18n keys: `modules.mail.detail.textSize`, `modules.mail.detail.textSizeNormal/Large/ExtraLarge` (13 talen)

**Bestanden:**
- `src/screens/mail/MailDetailScreen.tsx` (wijziging — font size toggle)
- `src/screens/mail/MailBodyWebView.tsx` (wijziging — fontScale prop)
- `src/screens/mail/mailDetailHelpers.ts` (wijziging — baseFontSize parameter)
- 13 locale bestanden (nieuwe keys)

### 3.5 Mail Instellingen Persistent Maken

**Wat:** Alle mail settings in `MailSettingsScreen.tsx` persisteren naar AsyncStorage zodat ze bewaard blijven.

**Implementatie:**
- `MailSettingsScreen.tsx`: Vervang lokale state door AsyncStorage-backed state
- Settings keys: `@commeazy/mail/syncInterval`, `@commeazy/mail/cacheSize`, `@commeazy/mail/imagePolicy`, `@commeazy/mail/trustedSenders`
- Load on mount, save on change

**Bestanden:**
- `src/screens/settings/MailSettingsScreen.tsx` (wijziging)

### 3.6 Commit

```
feat(mail): Photo attachments, drafts, TTS read-aloud, text sizing, persistent settings
```

**Bestanden geraakt:** ~10 + 13 locales + dependency
**Risico:** Hoog — native dependency (camera-roll), TTS integratie, Privacy Manifest
**Skill validatie:** ui-designer, accessibility-specialist, ios-specialist, security-expert, react-native-expert, performance-optimizer

---

## Fase 4 — Polish & Compliance

Technische verbeteringen die de module productieklaar maken.

### 4.1 Background Fetch Notificaties → i18n Systeem

**Wat:** Vervang hardcoded vertaalstrings in `MailBackgroundFetchModule.swift` door een mechanisme dat de React Native i18n strings gebruikt.

**Implementatie:**
- Optie A: Bij app start, stuur huidige locale strings naar native module via bridge call (`configureNotificationStrings`)
- Optie B: Gebruik `NSLocalizedString` met `.strings` bestanden in Xcode (dupliceert vertalingen maar is native-proof)
- **Aanbeveling: Optie A** — voorkomt duplicatie, één bron van waarheid

**Bestanden:**
- `ios/CommEazyTemp/MailBackgroundFetchModule.swift` (wijziging)
- `src/screens/mail/MailScreen.tsx` (wijziging — bridge call bij init)

### 4.2 OAuth2 Email Fallback Verbeteren

**Wat:** Als ID token extractie faalt, toon een handmatig email invoerveld in plaats van een nep-adres te construeren.

**Implementatie:**
- `MailOnboardingScreen.tsx`: Bij `null` email na OAuth2, toon TextInput voor handmatige invoer
- i18n keys: `modules.mail.onboarding.enterEmailManually`, `modules.mail.onboarding.couldNotDetectEmail` (13 talen)

**Bestanden:**
- `src/screens/mail/MailOnboardingScreen.tsx` (wijziging)
- 13 locale bestanden (nieuwe keys)

### 4.3 Voice Commands voor Mail

**Wat:** VoiceFocusable wrappers op inbox items + voice commands voor mail acties.

**Implementatie:**
- `MailInboxScreen.tsx`: `VoiceFocusable` wrapper op elk mail item met `label={senderName + ": " + subject}`
- `MailDetailScreen.tsx`: `useVoiceAction` voor "beantwoord", "verwijder", "lees voor"
- `MailComposeScreen.tsx`: `useVoiceAction` voor "verzend"
- Voice command definities voor 13 talen

**Bestanden:**
- `src/screens/mail/MailInboxScreen.tsx` (wijziging)
- `src/screens/mail/MailDetailScreen.tsx` (wijziging)
- `src/screens/mail/MailComposeScreen.tsx` (wijziging)
- Voice command config bestanden (wijziging)

### 4.4 Commit

```
fix(mail): i18n background notifications, OAuth2 fallback, voice commands
```

**Bestanden geraakt:** ~6 + 13 locales
**Risico:** Medium — native module wijziging, voice integratie
**Skill validatie:** ios-specialist, accessibility-specialist, documentation-writer

---

## Samenvatting per Fase

| Fase | Beschrijving | Bestanden | Nieuwe i18n keys | Risico |
|------|-------------|-----------|------------------|--------|
| **1** | UX Fixes (touch, typo, colors) | ~6 | 0 | Laag |
| **2** | Essentiële features (confirm, read/unread, sent, reply all) | ~8 + 1 nieuw | ~10 keys × 13 talen | Medium |
| **3** | Geavanceerde features (foto's, drafts, TTS, text size, settings) | ~10 + 2 nieuw | ~15 keys × 13 talen | Hoog |
| **4** | Polish (i18n native, OAuth2, voice) | ~6 | ~5 keys × 13 talen | Medium |

---

## Volgorde & Afhankelijkheden

```
Fase 1 (UX fixes)
  ↓ geen afhankelijkheden
Fase 2 (Essentiële features)
  ↓ SendConfirmationOverlay nodig voor Fase 3.2 (draft indicator)
Fase 3 (Geavanceerde features)
  ↓ 3.1 (foto's) vereist pod install + clean build
  ↓ 3.3 (TTS) vereist AudioOrchestrator integratie
Fase 4 (Polish)
  ↓ kan parallel met Fase 3
```

Fase 1 en 2 kunnen zonder native wijzigingen (behalve markAsUnread in Swift). Fase 3 vereist dependency installatie en native builds. Fase 4 kan op elk moment na Fase 2.

---

## Skill Validatie Matrix

| Fase | ui-designer | a11y | security | ios | rn-expert | perf | docs |
|------|------------|------|----------|-----|-----------|------|------|
| 1 | ✅ | ✅ | — | — | — | — | — |
| 2 | ✅ | ✅ | — | ✅ | ✅ | — | — |
| 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| 4 | — | ✅ | — | ✅ | — | — | ✅ |

---

## Niet Opgenomen (Bewuste Keuzes)

| Item | Reden |
|------|-------|
| **Swipe-acties op inbox items** | Te complex voor senioren — bewust weggelaten |
| **Bulk selectie/verwijderen** | Complexe interactie — mogelijk later toevoegen als senioren dit missen |
| **Zoekfilters (datum/bijlage)** | Server-side IMAP search is beperkt — beter om eerst basis zoeken goed te laten werken |
| **Contactfoto bij afzender** | Vereist foto's in contact service — out of scope voor mail module |
| **Inline bijlage preview** | DocumentPreviewModule ondersteunt dit al via QLPreview — werkt al |
