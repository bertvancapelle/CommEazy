# SENIOR UI DESIGN & ARCHITECTURE

**CommEazy Complete UI Specification**

*P2P • Device-Centric • Age-Friendly Design*

---

# Inhoudsopgave

1. **NIEUWE: P2P UI Requirements**
2. **NIEUWE: Device Migration UI Flows**
3. **NIEUWE: Backup & Restore Screens**
4. **NIEUWE: QR Code Pairing UI**
5. **NIEUWE: Presence Indicators (Prosody)**
6. Senior Physical Limitations
7. Complete UI Design System
8. Navigation & Information Architecture
9. Interaction Patterns
10. Voice Control Integration
11. Accessibility Features
12. Testing Protocol

---

# 1. P2P UI Requirements

## 1.1 Waarom P2P Specifieke UI Nodig Is

**Device-Centric = User Ziet Verschil:**

| **Aspect** | **Cloud-Based App** | **CommEazy P2P** |
|------------|---------------------|------------------|
| Data locatie | "In de cloud" | **"Op dit apparaat"** |
| Backup | Automatisch | **User moet activeren** |
| Device switch | Naadloos | **Handmatige migratie** |
| Online status | Altijd connected | **P2P presence** |
| Message sync | Auto multi-device | **Single device only** |

**De UI moet dit DUIDELIJK maken!**

## 1.2 Kritieke UI Elementen voor P2P

### Settings Screen moet tonen:

```
┌─────────────────────────────────────┐
│  ⚙️  Instellingen                   │
├─────────────────────────────────────┤
│                                     │
│  📱 Deze App                        │
│     CommEazy versie 1.0             │
│     Apparaat: iPhone van Oma        │
│                                     │
│  💾 Gegevens Opslag                 │
│     ✓ Alle data op DIT apparaat    │
│     ⚠️ Backup maken aanbevolen      │
│                                     │
│     [Maak backup nu]                │
│                                     │
│  📊 Opslag Gebruik                  │
│     Berichten: 124 MB               │
│     Foto's: 456 MB                  │
│     Totaal: 580 MB                  │
│                                     │
│  🔐 Beveiliging                     │
│     ✓ Versleutelde berichten       │
│     ✓ Veilige opslag               │
│                                     │
└─────────────────────────────────────┘
```

### Contact Status moet tonen:

```
Contacten lijst:

┌─────────────────────────────────────┐
│  👤 Marie de Vries                  │
│  🟢 Online nu                       │  ← P2P presence
│  Laatst gezien: 2 min geleden       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  👤 Jan Bakker                      │
│  ⚪ Offline                         │  ← Niet online
│  Laatst gezien: 3 uur geleden       │
│  [Bel via telefoon]                 │  ← Fallback option
└─────────────────────────────────────┘
```

---

# 2. Device Migration UI Flows

## 2.1 Backup Maken Screen

### First-Time Backup Prompt (Week 1):

```
┌─────────────────────────────────────┐
│         💾 Backup Maken?            │
├─────────────────────────────────────┤
│                                     │
│  Uw gegevens staan alleen op        │
│  dit apparaat.                      │
│                                     │
│  Als u dit apparaat verliest,       │
│  zijn uw berichten en contacten     │
│  weg.                               │
│                                     │
│  Wilt u nu een backup maken?        │
│                                     │
│  [✓ Ja, maak backup]                │
│  [Niet nu]                          │
│  [Nooit vragen]                     │
│                                     │
└─────────────────────────────────────┘
```

### Backup Locatie Kiezen:

```
┌─────────────────────────────────────┐
│     📂 Waar wilt u backup           │
│        bewaren?                     │
├─────────────────────────────────────┤
│                                     │
│  ( ) Geen backup                    │
│      ⚠️ Niet aanbevolen             │
│                                     │
│  (•) Google Drive                   │
│      ✓ Veilig in de cloud           │
│      ✓ Automatisch bewaard          │
│                                     │
│  ( ) iCloud                         │
│      ✓ Voor Apple gebruikers       │
│                                     │
│  ( ) Op dit apparaat                │
│      ⚠️ Gaat verloren bij defect   │
│                                     │
│  ( ) SD Kaart                       │
│      ⚠️ Kaart moet altijd in phone  │
│                                     │
│  [Volgende]                         │
│                                     │
└─────────────────────────────────────┘
```

### PIN Instellen voor Backup:

```
┌─────────────────────────────────────┐
│      🔐 Beveilig Uw Backup          │
├─────────────────────────────────────┤
│                                     │
│  Kies een 6-cijferige PIN           │
│  om uw backup te beschermen.        │
│                                     │
│  Alleen u kunt deze backup          │
│  terugzetten met deze PIN.          │
│                                     │
│  ┌─────────────────────────┐       │
│  │  [ • ][ • ][ • ][ • ][ • ][ • ] │ │
│  └─────────────────────────┘       │
│                                     │
│  ⚠️ BELANGRIJK:                     │
│  Schrijf deze PIN op een            │
│  veilige plek!                      │
│                                     │
│  Zonder PIN kunt u uw backup        │
│  NIET terugzetten.                  │
│                                     │
│  [Bevestig PIN]                     │
│                                     │
└─────────────────────────────────────┘
```

### Backup in Progress:

```
┌─────────────────────────────────────┐
│       💾 Backup maken...            │
├─────────────────────────────────────┤
│                                     │
│         ⚙️ Bezig met:               │
│                                     │
│  ✓ Contacten verzamelen             │
│  ✓ Berichten verzamelen             │
│  ➤ Foto's verzamelen (45%)          │
│  ⏳ Versleutelen...                  │
│  ⏳ Uploaden naar Google Drive...    │
│                                     │
│  ████████░░░░░░░░░░ 45%             │
│                                     │
│  Nog ongeveer 2 minuten...          │
│                                     │
└─────────────────────────────────────┘
```

### Backup Success:

```
┌─────────────────────────────────────┐
│         ✅ Backup Succesvol!        │
├─────────────────────────────────────┤
│                                     │
│  Uw gegevens zijn veilig            │
│  opgeslagen in Google Drive.        │
│                                     │
│  📅 Laatste backup:                 │
│     Vandaag om 14:32                │
│                                     │
│  📦 Backup grootte:                 │
│     580 MB                          │
│                                     │
│  📂 Locatie:                        │
│     Google Drive / CommEazy         │
│                                     │
│  💡 TIP:                            │
│  Schrijf uw PIN op:                 │
│  _ _ _ _ _ _                        │
│                                     │
│  [Klaar]                            │
│                                     │
└─────────────────────────────────────┘
```

## 2.2 Backup Terugzetten (Nieuw Device)

### Welkom Screen (Nieuw Device):

```
┌─────────────────────────────────────┐
│      👋 Welkom bij CommEazy         │
├─────────────────────────────────────┤
│                                     │
│  Heeft u al een CommEazy            │
│  account?                           │
│                                     │
│  [✓ Ja, backup terugzetten]         │
│                                     │
│  [Nieuw account maken]              │
│                                     │
└─────────────────────────────────────┘
```

### Backup Locatie Selecteren:

```
┌─────────────────────────────────────┐
│     📂 Waar staat uw backup?        │
├─────────────────────────────────────┤
│                                     │
│  [📱 Google Drive]                  │
│     Login met uw Google account     │
│                                     │
│  [☁️  iCloud]                       │
│     Login met uw Apple ID           │
│                                     │
│  [💾 Op dit apparaat]               │
│     Backup bestand kiezen           │
│                                     │
│  [💿 SD Kaart]                      │
│     Zoek backup op SD kaart         │
│                                     │
└─────────────────────────────────────┘
```

### Backup File Selectie:

```
┌─────────────────────────────────────┐
│     📦 Kies uw backup               │
├─────────────────────────────────────┤
│                                     │
│  Backups gevonden:                  │
│                                     │
│  (•) CommEazy_2026-02-05.backup     │
│      Vandaag om 14:32               │
│      580 MB                         │
│                                     │
│  ( ) CommEazy_2026-02-01.backup     │
│      4 dagen geleden                │
│      567 MB                         │
│                                     │
│  ( ) CommEazy_2026-01-28.backup     │
│      1 week geleden                 │
│      543 MB                         │
│                                     │
│  💡 Kies de nieuwste backup         │
│                                     │
│  [Terugzetten]                      │
│  [Annuleer]                         │
│                                     │
└─────────────────────────────────────┘
```

### PIN Invoeren:

```
┌─────────────────────────────────────┐
│      🔐 Voer Uw PIN In              │
├─────────────────────────────────────┤
│                                     │
│  Voer de 6-cijferige PIN in         │
│  die u gebruikte om deze backup     │
│  te maken.                          │
│                                     │
│  ┌─────────────────────────┐       │
│  │  [ 1 ][ 2 ][ 3 ][ • ][ • ][ • ] │ │
│  └─────────────────────────┘       │
│                                     │
│  [Wachtwoord vergeten?]             │
│                                     │
│                                     │
│  [Bevestig]                         │
│  [Annuleer]                         │
│                                     │
└─────────────────────────────────────┘
```

### PIN Vergeten Dialog:

```
┌─────────────────────────────────────┐
│      ⚠️  PIN Vergeten?              │
├─────────────────────────────────────┤
│                                     │
│  Zonder uw PIN kunnen we            │
│  deze backup niet terugzetten.      │
│                                     │
│  Heeft u de PIN opgeschreven?       │
│  Kijk op de plek waar u             │
│  belangrijke dingen bewaart.        │
│                                     │
│  [Probeer opnieuw]                  │
│                                     │
│  ─────────────────────              │
│                                     │
│  Heeft u hulp nodig?                │
│                                     │
│  [Bel familie voor hulp]            │
│  (Belt uw noodcontact)              │
│                                     │
│  [Nieuw account beginnen]           │
│  (⚠️ Oude data gaat verloren)       │
│                                     │
└─────────────────────────────────────┘
```

### Restore in Progress:

```
┌─────────────────────────────────────┐
│     ⚙️  Backup terugzetten...       │
├─────────────────────────────────────┤
│                                     │
│         Bezig met:                  │
│                                     │
│  ✓ Backup downloaden                │
│  ✓ Beveiliging controleren          │
│  ✓ Ontsleutelen                     │
│  ➤ Contacten terugzetten (15/24)    │
│  ⏳ Berichten terugzetten...         │
│  ⏳ Foto's terugzetten...            │
│                                     │
│  ████████████░░░░░░ 62%             │
│                                     │
│  Nog ongeveer 1 minuut...           │
│                                     │
│  ⚠️ Sluit de app NIET af            │
│                                     │
└─────────────────────────────────────┘
```

### Restore Success:

```
┌─────────────────────────────────────┐
│       ✅ Welkom Terug!              │
├─────────────────────────────────────┤
│                                     │
│  Uw gegevens zijn teruggehaald:     │
│                                     │
│  ✓ 24 contacten                     │
│  ✓ 432 berichten                    │
│  ✓ 67 foto's                        │
│  ✓ 15 gesprekken                    │
│                                     │
│  U kunt nu verder gaan waar u       │
│  gebleven was!                      │
│                                     │
│  [Start met chatten]                │
│                                     │
└─────────────────────────────────────┘
```

---

# 3. Backup & Restore Screens

## 3.1 Backup Settings Screen

```
┌─────────────────────────────────────┐
│    ⚙️  Backup Instellingen          │
├─────────────────────────────────────┤
│                                     │
│  📂 Backup Locatie                  │
│     Google Drive                    │
│     [Wijzig]                        │
│                                     │
│  🔐 Backup PIN                      │
│     •••••• (ingesteld)              │
│     [Wijzig PIN]                    │
│                                     │
│  📅 Automatische Backup             │
│     [ON]                            │
│     Frequentie: Elke week           │
│     [Wijzig frequentie]             │
│                                     │
│  📊 Laatste Backup                  │
│     Vandaag om 14:32                │
│     Grootte: 580 MB                 │
│                                     │
│  [💾 Maak backup nu]                │
│                                     │
│  ─────────────────────              │
│                                     │
│  🗑️  Backup Verwijderen             │
│     [Verwijder alle backups]        │
│     ⚠️ Alleen doen als zeker        │
│                                     │
└─────────────────────────────────────┘
```

## 3.2 Automatic Backup Notification

```
┌─────────────────────────────────────┐
│  🔔 Automatische backup gedaan      │
├─────────────────────────────────────┤
│                                     │
│  ✅ Uw gegevens zijn veilig         │
│     opgeslagen.                     │
│                                     │
│  📅 Laatste backup:                 │
│     Vandaag om 02:00                │
│                                     │
│  [Bekijk details]                   │
│  [Sluiten]                          │
│                                     │
└─────────────────────────────────────┘
```

---

# 4. QR Code Pairing UI

## 4.1 Waarom QR Code Pairing

**Security:** Voorkomt Man-in-the-Middle aanvallen bij key exchange.

**Usability:** Simpeler dan handmatig public keys delen.

**Trust:** Visuele verificatie dat je de juiste persoon toevoegt.

## 4.2 Add Contact Flow

### Optie 1: Scan QR Code

```
┌─────────────────────────────────────┐
│    👥 Nieuw Contact Toevoegen       │
├─────────────────────────────────────┤
│                                     │
│  Hoe wilt u contact toevoegen?      │
│                                     │
│  [📷 Scan QR code]                  │
│     Makkelijkste manier             │
│     ✓ Veilig                        │
│                                     │
│  [⌨️  Typ naam en nummer]           │
│     Als QR niet werkt               │
│                                     │
│  [Annuleer]                         │
│                                     │
└─────────────────────────────────────┘
```

### QR Scanner Screen:

```
┌─────────────────────────────────────┐
│     📷 Scan QR Code                 │
├─────────────────────────────────────┤
│                                     │
│         CAMERA VIEW                 │
│  ┌─────────────────────────┐       │
│  │                         │       │
│  │    ┏━━━━━━━━━━━┓        │       │
│  │    ┃           ┃        │       │
│  │    ┃  VIEWFINDER        │       │
│  │    ┃           ┃        │       │
│  │    ┗━━━━━━━━━━━┛        │       │
│  │                         │       │
│  └─────────────────────────┘       │
│                                     │
│  Richt camera op de QR code         │
│  van uw contact.                    │
│                                     │
│  💡 TIP: Vraag contact om           │
│     "Toon mijn QR" te kiezen        │
│                                     │
│  [❌ Annuleer]                      │
│                                     │
└─────────────────────────────────────┘
```

### QR Code Detected:

```
┌─────────────────────────────────────┐
│      ✅ Contact Gevonden!           │
├─────────────────────────────────────┤
│                                     │
│  👤 Marie de Vries                  │
│     marie@commeazy.nl               │
│                                     │
│  📱 +31 6 1234 5678                 │
│                                     │
│  🔐 Beveiligde verbinding           │
│     ✓ Geverifieerd via QR           │
│                                     │
│  ─────────────────────              │
│                                     │
│  Contact toevoegen?                 │
│                                     │
│  [✓ Toevoegen]                      │
│  [❌ Annuleer]                      │
│                                     │
└─────────────────────────────────────┘
```

### Contact Added Success:

```
┌─────────────────────────────────────┐
│       🎉 Contact Toegevoegd!        │
├─────────────────────────────────────┤
│                                     │
│  Marie de Vries is nu in            │
│  uw contactenlijst.                 │
│                                     │
│  U kunt nu:                         │
│                                     │
│  [💬 Bericht sturen]                │
│  [📞 Bellen]                        │
│  [📹 Videobellen]                   │
│                                     │
│  [Terug naar contacten]             │
│                                     │
└─────────────────────────────────────┘
```

## 4.3 Show My QR Code

```
┌─────────────────────────────────────┐
│     📱 Mijn QR Code                 │
├─────────────────────────────────────┤
│                                     │
│  Laat deze code scannen om          │
│  toegevoegd te worden:              │
│                                     │
│  ┌─────────────────────────┐       │
│  │                         │       │
│  │   █▀▀▀▀▀█ ▄▀ █▀█       │       │
│  │   █ ███ █ ██▄ ▀        │       │
│  │   █ ▀▀▀ █ █▄▀ ▄█       │       │
│  │   ▀▀▀▀▀▀▀ ▀ ▀ ▀        │       │
│  │                         │       │
│  │   QR CODE GROOT         │       │
│  │   (200x200pt)           │       │
│  │                         │       │
│  └─────────────────────────┘       │
│                                     │
│  👤 Oma Jan                         │
│     oma.jan@commeazy.nl             │
│                                     │
│  [✉️  Verstuur via email]           │
│  [Sluiten]                          │
│                                     │
└─────────────────────────────────────┘
```

---

# 5. Presence Indicators (Prosody)

## 5.1 Online Status Visualisatie

### In Contact List:

```
┌─────────────────────────────────────┐
│     👥 Contacten                    │
├─────────────────────────────────────┤
│                                     │
│  🟢 Marie de Vries                  │
│     Online nu                       │
│     [💬] [📞] [📹]                  │
│                                     │
│  🟢 Jan Bakker                      │
│     Online nu                       │
│     [💬] [📞] [📹]                  │
│                                     │
│  ⚪ Lisa Jansen                     │
│     Laatst gezien: 2 uur geleden    │
│     [💬] [📞]                       │
│                                     │
│  ⚪ Peter de Jong                   │
│     Offline                         │
│     [💬] [📞]                       │
│                                     │
└─────────────────────────────────────┘
```

**Presence Indicator Specs:**
- Size: 16x16pt (groot genoeg om te zien)
- Position: Links van naam (eerste focus punt)
- Colors:
  - 🟢 Groen: Online (exact #00C853)
  - ⚪ Grijs: Offline (exact #BDBDBD)
- Animation: Pulse effect wanneer status wijzigt (200ms)
- Always visible: Niet verbergen op scroll

### In Chat Screen Header:

```
┌─────────────────────────────────────┐
│  [←]  🟢 Marie de Vries     [⋮]    │
│       Online nu                     │
├─────────────────────────────────────┤
│                                     │
│  (Message bubbles hier)             │
│                                     │
└─────────────────────────────────────┘
```

### In Call Setup:

```
┌─────────────────────────────────────┐
│                                     │
│       👤 Marie de Vries             │
│          (Profielfoto)              │
│                                     │
│       🟢 Online                     │
│                                     │
│    [📞 Audio Call]                  │
│    [📹 Video Call]                  │
│                                     │
└─────────────────────────────────────┘
```

## 5.2 Offline Contact Dialog

```
┌─────────────────────────────────────┐
│    ⚠️  Contact is Offline           │
├─────────────────────────────────────┤
│                                     │
│  Marie is niet online in            │
│  CommEazy.                          │
│                                     │
│  Wat wilt u doen?                   │
│                                     │
│  [📞 Bel via telefoon]              │
│     Direct bellen via Phone.app     │
│     (Niet encrypted)                │
│                                     │
│  [💬 Stuur SMS uitnodiging]         │
│     Nodig Marie uit voor CommEazy   │
│                                     │
│  [✉️  Stuur bericht]                │
│     Marie leest het als ze online   │
│     komt                            │
│                                     │
│  [❌ Annuleer]                      │
│                                     │
└─────────────────────────────────────┘
```

---

# 6. Senior Physical Limitations

## 6.1 Vision Decline (Presbyopia)

**👁️ Feit:** 1 op 6 mensen boven 70 heeft vision impairment.

| **Challenge** | **CommEazy Oplossing** |
|---------------|------------------------|
| Kleine tekst onleesbaar | Min 18pt body, 24pt+ headers, user kan vergroten |
| Lage contrast niet zichtbaar | WCAG AAA: 7:1 contrast ratio minimum |
| Kleur onderscheid moeilijk | Nooit alleen kleur - altijd + icon/tekst |
| Slechte verlichting | High contrast mode + dark mode |
| Wazig zicht | Extra dikke borders, duidelijke separatie |
| Peripheral vision loss | Belangrijke info altijd center screen |
| Focus problemen | Auto-scroll naar active element |

## 6.2 Motor Skills Decline (Tremor, Arthritis)

**🤲 Feit:** Motor skills vertragen met ~15% per decade na 60.

| **Challenge** | **CommEazy Oplossing** |
|---------------|------------------------|
| Kleine buttons missen | 60x60pt MINIMUM, 80x80pt primair |
| Tremor - accidental taps | 400ms debounce, undo altijd mogelijk |
| Swipe gestures moeilijk | GEEN swipe-only features, altijd button alt |
| Pinch-to-zoom lastig | Dedicated +/- zoom buttons |
| Long press niet vol houden | Max 500ms long press, visual countdown |
| Multi-finger gestures | VERBODEN - alleen single tap/scroll |
| Drag & drop | VERMIJDEN - gebruik select + action buttons |

## 6.3 Cognitive Processing Slowdown

**🧠 Feit:** Information processing speed daalt met ~20% tussen 25-75 jaar.

| **Challenge** | **CommEazy Oplossing** |
|---------------|------------------------|
| Info overload | Max 3 keuzes per screen, simpele flows |
| Working memory beperkt | Persistent breadcrumbs, altijd "terug" zichtbaar |
| Vergeten waar feature is | Consistent placement, geen verrassingen |
| Complexe instructies | Max 1 stap per screen, visuele guides |
| Abstract concepten | CONCREET - "Bel Marie" niet "Initiate comm" |
| Multi-tasking moeilijk | Focus mode - één ding tegelijk |
| Snelle timeouts | GEEN timeouts, user bepaalt tempo |
| Foutmeldingen niet begrijpen | Plain language: "Internet werkt niet" niet "ERR_CONNECTION_REFUSED" |

## 6.4 Hearing Loss

- 🔊 Alle video content: STANDAARD captions/subtitles AAN
- 🔔 Notifications: Visueel (flash) + haptic (trillen) + audio
- 🎚️ Volume controls: Groot, altijd accessible, visual feedback
- 📞 Call audio: Extra volume boost optie (120% mode)
- 🎤 Speech recognition: Voor voice commands (compensate hearing)
- 📝 Transcriptie: Alle audio → text optie (accessibility)
- 🚨 Alerts: NOOIT alleen audio - altijd visual backup

---

# 7. Complete UI Design System

## 7.1 Typography System

| **Element** | **Size** | **Weight** | **Line Height** |
|-------------|----------|------------|-----------------|
| Hero (Titles) | 32pt | Bold | 40pt |
| H1 (Screen title) | 28pt | Bold | 36pt |
| H2 (Sections) | 24pt | Semibold | 32pt |
| H3 (Subsections) | 20pt | Semibold | 28pt |
| Body (Content) | 18pt | Regular | 26pt |
| Secondary | 16pt | Regular | 24pt |
| Caption (Metadata) | 14pt | Regular | 20pt |

**Font requirements:**
- System font ONLY (San Francisco iOS, Roboto Android)
- No italic (moeilijk leesbaar)
- No all-caps (MOEILIJK TE SCANNEN)
- Letter spacing: +0.5pt (readability)
- Word spacing: +1pt (separation)
- Max line length: 60 characters
- Text alignment: Left (no center/justify for body)
- User can increase ALL text sizes

## 7.2 Color System

| **Color** | **Usage** | **Contrast Ratio** |
|-----------|-----------|-------------------|
| Primary (Blue) | Action buttons, links | 7.5:1 (AAA) |
| Success (Green) | Confirmations, online | 7.2:1 (AAA) |
| Warning (Orange) | Cautions, battery low | 7.8:1 (AAA) |
| Error (Red) | Errors, delete actions | 7.5:1 (AAA) |
| Gray Dark | Body text | 12:1 (AAA) |
| Gray Medium | Secondary text | 7:1 (AAA) |
| Gray Light | Borders, separators | N/A (not text) |
| Background White | Main background | N/A |

**Color rules:**
- NOOIT alleen kleur - altijd + icon of tekst
- Red/Green colorblind safe - add icons
- Dark mode support (auto-switch)
- High contrast mode (toggle)
- Semantic colors (green=go, red=stop)
- Consistent meaning (blue=primary altijd)

## 7.3 Spacing & Layout

- Base unit: 8pt (alles is multiple van 8)
- Touch targets: Minimum **60x60pt** (Apple HIG: 44pt - te klein!)
- Padding: 16pt minimum
- Margins: 20pt sides (thumb zone safe)
- Vertical spacing: 24pt tussen sections
- List items: 72pt height
- Icon spacing: 12pt tussen icon en tekst
- Button spacing: 16pt tussen multiple buttons
- Safe area respect: iOS notch, Android navigation
- Bottom tab bar: 72pt (extra space voor tremor)

## 7.4 Interactive Elements

| **Button Type** | **Size** | **Usage** | **Example** |
|-----------------|----------|-----------|-------------|
| Primary CTA | 60pt height, full width | Main action | "Bel nu" |
| Secondary | 56pt height, auto width | Alternative | "Annuleer" |
| Icon Button | 80x80pt | Single action | Call, Camera |
| Floating Action | 72x72pt circle | New item | "+ Nieuw" |
| Tab Bar Item | 72x72pt | Navigation | Chat icon |

**Button states:**
- Default: Clear affordance (looks like button)
- Active: Immediate visual feedback (scale 95%, darker)
- Disabled: 50% opacity + "grayed out"
- Loading: Spinner INSIDE button, text "Bezig..."
- Success: Checkmark icon, green flash (200ms)
- Error: X icon, red shake animation
- Press depth: 2pt shadow shift (tactile feeling)

---

# 8. Navigation & Information Architecture

## 8.1 Bottom Navigation (3 Tabs - STRIPPED MVP)

| **Tab** | **Icon** | **Functie** |
|---------|----------|-------------|
| 1. Chats | 💬 | Messaging |
| 2. Calls | 📞 | Call History + Initiate Call |
| 3. Contacts | 👥 | Adresboek + Add Contact |

**GEEN TV/Audio tabs in MVP** - alleen communicatie.

## 8.2 Tab Bar Specificaties

- Hoogte: 72pt (normaal is 56pt) - extra groot
- Icon size: 36x36pt (normaal is 24x24pt)
- Label tekst: 14pt bold (altijd zichtbaar)
- Touch target: 72x72pt per tab
- Spacing: 8pt tussen icons
- Active state: Dikke underline (4pt) + color
- Haptic feedback: Trillen bij tab switch
- Badge support: Unread counts (max 99+)
- Animation: Smooth transition (200ms)
- Position: Altijd bottom (nooit top)

## 8.3 Flat Navigation (Max 2 Levels)

- Level 1: Tab bar (3 tabs)
- Level 2: Screen content (detail)
- NO Level 3: Avoid deep nesting
- Back button: ALWAYS visible (top left, 60x60pt)
- Breadcrumbs: "Chats > Marie" (context)
- Home button: Always available (bottom tab)
- Settings: Accessible from all tabs (gear icon)
- Modal sheets: For temporary actions

---

# 9. Interaction Patterns

## 9.1 Tap Interactions

- Single tap: Primary action (open, select)
- Double tap: AVOID (accidental triggers)
- Long press: Secondary actions (max 500ms)
- **Debounce: 400ms** (prevent tremor double-taps)
- Visual feedback: Immediate (< 100ms)
- Haptic feedback: On all taps (vibrate)
- Audio feedback: Optional (setting)
- Loading state: If action takes >500ms
- Success feedback: Checkmark + haptic
- Error feedback: Shake + haptic + message

## 9.2 Scroll Behavior

- Scroll direction: Vertical ONLY (no horizontal)
- Infinite scroll: AVOID (pagination met "Meer" button)
- Pull-to-refresh: YES (natural gesture)
- Scroll to top: Tap status bar (iOS) or FAB (Android)
- Sticky headers: Section titles remain visible
- Scroll indicators: Large, always visible
- Elastic bounce: YES (iOS natural)
- Momentum scroll: Moderate speed
- Scroll position memory: Resume waar gebruiker was

## 9.3 VERBODEN Gestures

- ❌ Swipe-only navigation (altijd button alternatief)
- ❌ Pinch-to-zoom (dedicated +/- buttons)
- ❌ Multi-finger gestures (3-finger, 4-finger)
- ❌ Shake-to-undo (accidental activation)
- ❌ Force touch (pressure sensitivity)
- ❌ Complex paths (draw shapes)
- ❌ Rotation gestures (twist)
- ❌ Hover states (mobile heeft geen hover)

---

# 10. Voice Control Integration

## 10.1 Waarom Voice Control Kritiek Is

**🎤 Motor Skill Compensatie:** Voor senioren met tremor, arthritis of vision impairment is voice control vaak EENVOUDIGER dan taps en swipes.

- 👴 Hands-free bediening (tremor, arthritis)
- 👁️ Screen-free bediening (vision impairment)
- 🚗 Veilig in auto (geen screen kijken)
- 🛏️ Bediening in bed (comfort)
- 🧠 Cognitieve load reductie (zeggen vs navigeren)
- ⚡ Snelheid (zeg "Bel Marie" vs tap-tap-tap)
- ♿ Accessibility compliance (WCAG 2.1)

## 10.2 Voice Commands

- *"Bel Marie"* → Start audio call
- *"Videobel Jan"* → Start video call
- *"Stuur bericht naar Lisa"* → Open chat
- *"Lees berichten"* → Read unread messages aloud
- *"Zoek contact Peter"* → Search contacts
- *"Terug"* → Navigate back
- *"Help"* → Show help/tutorial
- *"Instellingen"* → Open settings
- *"Maak backup"* → Start backup process
- *"Toon mijn QR"* → Show QR code

## 10.3 Voice Feedback

- Confirmation: "Ik bel Marie voor je"
- Error: "Ik kan contact Jan niet vinden"
- Clarification: "Bedoel je Marie de Vries of Marie Jansen?"
- Progress: "Een moment, ik verbind je"
- Success: "Gesprek gestart met Marie"
- Always visual + audio (dual feedback)
- Natural language (geen robot stem)
- Dutch language support (native)
- Adjustable speech speed (settings)

---

# 11. Accessibility Features

## 11.1 VoiceOver / TalkBack Support

**WCAG 2.1 AAA Compliance:**

- All interactive elements: Accessible labels
- All images: Alt text descriptions
- All buttons: Clear, descriptive names
- Navigation order: Logical flow (top→bottom, left→right)
- Focus indicators: High contrast (4:1 ratio)
- Screen reader: Reads all content correctly
- Gestures: All tap/swipe alternatives available
- Headings: Proper hierarchy (H1→H2→H3)

## 11.2 Dynamic Type Support

User can increase ALL text sizes:

| **Size Setting** | **Body Text** | **Headings** |
|------------------|---------------|--------------|
| Small | 16pt | 22pt |
| Medium (default) | 18pt | 24pt |
| Large | 20pt | 28pt |
| Extra Large | 24pt | 32pt |
| Maximum | 28pt | 36pt |

**Layout adapts:**
- Buttons scale proportionally
- Line height increases
- Spacing adjusts automatically
- No text truncation
- No horizontal scroll

## 11.3 High Contrast Mode

Toggle in Settings → Accessibility:

| **Element** | **Normal** | **High Contrast** |
|-------------|------------|-------------------|
| Text | Gray Dark (12:1) | Pure Black (21:1) |
| Borders | Light Gray | Dark Gray |
| Buttons | Subtle shadows | Bold outlines |
| Icons | Filled | Outlined + thick |
| Backgrounds | Off-white | Pure white |

---

# 12. Testing Protocol

## 12.1 Senior User Testing (Week 18)

**Minimum: 10 senioren, 65+ jaar**

### Critical Test Scenarios:

1. **QR Code Pairing**
   - Time to complete: < 2 min
   - Success rate: > 90%
   - Frustration level: Low

2. **Send Photo**
   - Steps needed: Max 4
   - Time to complete: < 1 min
   - Errors: < 10%

3. **Receive Call**
   - Understand incoming screen: 100%
   - Answer successfully: > 95%
   - Reject successfully: > 95%

4. **Phone Fallback**
   - Understand "offline" dialog: 100%
   - Choose correct option: > 80%

5. **Backup Maken**
   - Complete without help: > 70%
   - Understand importance: 100%
   - Remember PIN location: > 90%

6. **Restore Backup**
   - Complete successfully: > 80%
   - Enter correct PIN: > 85%
   - Know who to ask for help: 100%

## 12.2 Metrics to Collect

**Quantitative:**
- Task completion time
- Error rate per screen
- Tap accuracy (missed taps)
- Scroll behavior (overshooting)
- Voice command recognition rate
- Backup success rate

**Qualitative:**
- Confusion points (where stuck?)
- Delightful moments (what loved?)
- Frustration triggers (what hated?)
- Language clarity (understood labels?)
- Visual clarity (could see everything?)
- Confidence level (feel in control?)

## 12.3 Pass/Fail Criteria

**APP MAG NIET LAUNCHEN ALS:**
- ❌ Task success rate < 80%
- ❌ Average frustration rating > 3/5
- ❌ More than 2 seniors say "too complicated"
- ❌ Backup restore fails > 20% of time
- ❌ QR pairing success < 85%
- ❌ Call answer success < 90%

**FIX BEFORE LAUNCH!**

---

# Samenvatting: P2P UI Requirements

## VANAF DAG 1 vereist:

- ✅ **3-tab navigation** (Chats, Calls, Contacts - GEEN TV/Audio)
- ✅ **Presence indicators** (🟢 online, ⚪ offline via Prosody)
- ✅ **QR code pairing** flow (camera + scanner UI)
- ✅ **Backup/restore** UI (settings + onboarding)
- ✅ **Device migration** wizard (step-by-step)
- ✅ **60x60pt minimum** touch targets (motor skills)
- ✅ **18pt+ text sizes** (vision)
- ✅ **7:1 contrast ratios** (vision)
- ✅ **400ms tap debounce** (tremor)
- ✅ **Voice control** infrastructure (accessibility)
- ✅ **No swipe-only** features (motor skills)
- ✅ **Max 2-level** navigation (cognitive)
- ✅ **Persistent state** management (resume anywhere)
- ✅ **Accessibility APIs** (VoiceOver/TalkBack)
- ✅ **High contrast mode** toggle
- ✅ **User-adjustable text** sizes
- ✅ **Phone fallback** dialog (offline contacts)
- ✅ **PIN entry** screens (backup security)
- ✅ **"Data op dit apparaat"** messaging (transparency)

---

**Deze architectuur is NIET optioneel.**  
**Het is de FOUNDATION voor alles.**

---

*Laatst bijgewerkt: Februari 2026*
*Versie: 2.0 (P2P + Device-Centric UI)*
