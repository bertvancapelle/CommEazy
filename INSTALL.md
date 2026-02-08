# CommEazy — Installatie & Opstart Handleiding

**Versie:** 1.0 — 8 februari 2026
**Pakket:** CommEazy_Complete_V1.zip (scaffold + skills + PoC + referentiedocs)

---

## Wat zit er in dit pakket?

```
CommEazy/
├── .claude/                          ← Agent Teams configuratie
│   ├── CLAUDE.md                     ← Master context (lees dit als eerste)
│   ├── SKILLS_README.md              ← Skills V2.0 changelog
│   ├── cross-cutting/                ← Gedeelde standaarden
│   │   ├── QUALITY_GATES.md          ← 6 verplichte kwaliteitspoorten
│   │   ├── TECH_COMPARISON.md        ← xmpp.js vs Strophe, WatermelonDB vs Realm
│   │   ├── ERROR_TAXONOMY.md         ← Foutcodes + 5-talige berichten
│   │   └── INTERFACE_CONTRACTS.md    ← Skill afhankelijkheden
│   └── skills/                       ← 13 Agent Team skills
│       ├── architecture-lead/        ← Systeem-architectuur & integratie
│       ├── security-expert/          ← Encryptie, compliance, audit
│       ├── ui-designer/              ← Senior-inclusive UI ontwerp
│       ├── ios-specialist/           ← Apple App Store, Privacy Manifest
│       ├── android-specialist/       ← Google Play, Data Safety Section
│       ├── react-native-expert/      ← RN componenten, i18n, a11y
│       ├── xmpp-specialist/          ← XMPP protocol, outbox, offline sync
│       ├── accessibility-specialist/ ← VoiceOver, TalkBack, WCAG AAA
│       ├── testing-qa/               ← Unit, E2E, senior user testing
│       ├── performance-optimizer/    ← Startup, scroll, memory, bundle
│       ├── devops-specialist/        ← CI/CD, Fastlane, Prosody beheer
│       ├── onboarding-recovery-specialist/ ← First-use, backup, migratie
│       └── documentation-writer/     ← Docs, ADRs, user guides
│
├── src/                              ← Broncode
│   ├── services/                     ← Kern business logic
│   │   ├── interfaces.ts             ← ⭐ Alle service-contracten (START HIER)
│   │   ├── container.ts              ← Dependency injection singleton
│   │   ├── encryption.ts             ← libsodium dual-path (397 regels)
│   │   └── xmpp.ts                   ← xmpp.js client implementatie
│   ├── screens/                      ← Scherm-componenten (nog placeholder)
│   ├── components/                   ← Herbruikbare UI componenten
│   ├── navigation/                   ← React Navigation (tabs + stacks)
│   ├── hooks/                        ← Custom React hooks
│   ├── locales/                      ← Vertalingen (NL/EN/DE/FR/ES compleet)
│   ├── theme/                        ← Kleuren, typografie, spacing
│   ├── config/                       ← App configuratie & constanten
│   └── app/                          ← App entry point
│
├── poc/                              ← Proof-of-Concept resultaten
│   ├── results/POC_RESULTS.md        ← Samenvatting technologiekeuze
│   ├── xmpp-comparison/             ← xmpp.js vs Strophe.js benchmark
│   └── encryption-benchmark/        ← Dual-path performance meting
│
├── docs/reference/                   ← Oorspronkelijke ontwerpdocumenten
│   ├── CommEazy_MVP_Plan_V1_0.md     ← MVP plan
│   ├── CommEazy_Plan_P2P_UPDATED.md  ← P2P architectuur plan
│   ├── CommEazy_UI_P2P_UPDATED.md    ← UI ontwerp specificaties
│   ├── CommEazy_Gebruikerservaring_Twee_Families.md ← User stories
│   ├── CommEazy_Claude_Context_Files.md ← Volledige context
│   └── Claude_Code_Setup_Guide_CommEazy.md ← Setup guide (uitgebreid)
│
├── package.json                      ← Dependencies & scripts
├── tsconfig.json                     ← TypeScript strict configuratie
├── .eslintrc.js                      ← Linting regels
├── .gitignore                        ← Git ignore (secrets, builds, pods)
├── babel.config.js                   ← Babel configuratie
├── app.json                          ← React Native app metadata
└── README.md                         ← Project overzicht
```

---

## Vereisten

### Hardware
- **Mac** (verplicht voor iOS development) — Apple Silicon of Intel
- **Minimaal 16 GB RAM** (Xcode + Android Studio + Metro bundler)
- **50 GB vrije schijfruimte** (Xcode ~12GB, Android SDK ~8GB, project + deps)

### Software

| Tool | Versie | Installatie |
|------|--------|-------------|
| **Node.js** | ≥18.0 (LTS aanbevolen) | `brew install node` of [nodejs.org](https://nodejs.org) |
| **npm** | ≥9.0 (meegeleverd) | Komt met Node.js |
| **Watchman** | Latest | `brew install watchman` |
| **Xcode** | ≥15.0 | Mac App Store |
| **CocoaPods** | ≥1.14 | `sudo gem install cocoapods` |
| **Android Studio** | Latest | [developer.android.com](https://developer.android.com/studio) |
| **JDK** | 17 | `brew install openjdk@17` |
| **Claude Code** | Latest | `npm install -g @anthropic-ai/claude-code` |

---

## Installatie — Stap voor Stap

### Stap 1: Pakket uitpakken

```bash
# Maak project directory
mkdir -p ~/Projects
cd ~/Projects

# Unzip het pakket
unzip CommEazy_Complete_V1.zip -d CommEazy
cd CommEazy
```

### Stap 2: Git repository initialiseren

```bash
git init
git add .
git commit -m "Initial scaffold: CommEazy V1.0 — skills, PoC, services, i18n"
```

### Stap 3: Dependencies installeren

```bash
# Node modules
npm install

# iOS pods (alleen op Mac)
cd ios
pod install
cd ..
```

> **Let op:** Als `pod install` faalt, probeer: `pod install --repo-update`

### Stap 4: iOS configuratie

```bash
# Open Xcode workspace (NIET het .xcodeproj!)
open ios/CommEazy.xcworkspace
```

In Xcode:
1. Selecteer je **Development Team** (Signing & Capabilities)
2. Wijzig de **Bundle Identifier** naar jouw ID (bijv. `nl.commeazy.app`)
3. Zet **Minimum Deployment Target** op iOS 15.0

### Stap 5: Android configuratie

```bash
# Zorg dat ANDROID_HOME is ingesteld
echo $ANDROID_HOME  # Moet iets zijn als /Users/jouw-naam/Library/Android/sdk

# Als dit leeg is, voeg toe aan ~/.zshrc:
# export ANDROID_HOME=$HOME/Library/Android/sdk
# export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
```

In Android Studio:
1. Open `android/` als project
2. Installeer **API 34** via SDK Manager
3. Maak een **emulator** aan (Pixel 7 API 34 aanbevolen)

### Stap 6: Eerste keer draaien

```bash
# Start Metro bundler
npm start

# In een nieuw terminal venster:

# iOS (simulator)
npm run ios

# OF Android (emulator)
npm run android
```

> **Verwacht resultaat:** De app start met een placeholder scherm. Dit is correct — de schermen moeten nog gebouwd worden met Agent Teams.

### Stap 7: Claude Code opstarten

```bash
# In de project root
claude

# Claude Code leest automatisch .claude/CLAUDE.md en kent het project
```

---

## Eerste Opdracht aan Claude Code

Na installatie, geef Claude Code deze eerste opdracht om te verifiëren dat alles werkt:

```
Lees .claude/CLAUDE.md en .claude/cross-cutting/QUALITY_GATES.md.
Verifieer dat:
1. src/services/interfaces.ts compileert (npm run typecheck)
2. src/locales/ alle 5 talen heeft met identieke keys
3. De theme voldoet aan senior UX eisen uit QUALITY_GATES

Rapporteer eventuele issues.
```

---

## Development Workflow met Agent Teams

### Hoe skills werken

Elke skill in `.claude/skills/` is een gedetailleerde instructieset voor een specifiek domein. Je activeert een skill door Claude Code ernaar te verwijzen:

```
Lees .claude/skills/onboarding-recovery-specialist/SKILL.md
en implementeer het onboarding scherm (taalkeuzescherm → 
telefoonverificatie → naam → PIN → klaar).
Volg de quality gates uit .claude/cross-cutting/QUALITY_GATES.md.
```

### Aanbevolen bouwvolgorde

| Stap | Wat | Welke skill(s) |
|------|-----|-----------------|
| 1 | Onboarding flow | onboarding-recovery-specialist + ui-designer |
| 2 | Encryption service testen | security-expert + testing-qa |
| 3 | 1-op-1 chat | xmpp-specialist + react-native-expert |
| 4 | Contact lijst | ui-designer + accessibility-specialist |
| 5 | Groepschat | xmpp-specialist + security-expert |
| 6 | Foto versturen | react-native-expert + performance-optimizer |
| 7 | Video bellen | xmpp-specialist + ios-specialist + android-specialist |
| 8 | Instellingen scherm | ui-designer + accessibility-specialist |
| 9 | CI/CD pipeline | devops-specialist |
| 10 | Store submission | ios-specialist + android-specialist + devops-specialist |

### Tips voor effectief werken met Claude Code

1. **Eén feature per sessie** — Geef Claude Code focus op één ding tegelijk
2. **Verwijs altijd naar skills** — "Lees skill X en implementeer Y"
3. **Laat testen draaien** — "Schrijf tests EN draai ze" (niet alleen schrijven)
4. **Quality gates checken** — Eindig elke sessie met "Controleer QUALITY_GATES.md"
5. **Commit na elke feature** — "Maak een git commit met beschrijvende message"

---

## Projectconfiguratie

### Environment variabelen

Maak een `.env` bestand aan (wordt NIET ge-commit door .gitignore):

```env
# XMPP Server (development)
XMPP_DOMAIN=commeazy.nl
XMPP_WEBSOCKET_URL=wss://commeazy.nl:5281/xmpp-websocket

# Firebase (haal op uit Firebase Console)
FIREBASE_API_KEY=your-api-key
FIREBASE_PROJECT_ID=your-project-id

# TURN Server
TURN_SERVER_URL=turn:turn.commeazy.nl:3478
TURN_USERNAME=your-turn-username
TURN_CREDENTIAL=your-turn-credential
```

### Firebase opzetten

1. Ga naar [Firebase Console](https://console.firebase.google.com)
2. Maak project "CommEazy" aan
3. Voeg iOS app toe (bundle ID uit Xcode)
4. Voeg Android app toe (package name: `nl.commeazy.app`)
5. Download `GoogleService-Info.plist` → `/ios/`
6. Download `google-services.json` → `/android/app/`
7. Activeer **Authentication** → **Phone** sign-in

### Prosody XMPP Server

De server-setup staat beschreven in `.claude/skills/devops-specialist/SKILL.md`. Kernpunten:

```lua
-- prosody.cfg.lua — KRITISCHE instellingen
max_history_messages = 0     -- GEEN berichtopslag
archive_store = "none"       -- GEEN MAM
offline_store = "none"       -- GEEN offline berichten
```

---

## Handige Commando's

```bash
# Development
npm start                  # Metro bundler starten
npm run ios                # iOS simulator
npm run android            # Android emulator

# Kwaliteit
npm run lint               # ESLint (0 warnings vereist)
npm run typecheck          # TypeScript strict check
npm test                   # Jest met coverage rapport
npm run test:encryption    # Alleen encryptie tests
npm run test:i18n          # Alleen vertalings-tests
npm run test:a11y          # Alleen accessibility tests

# Maintenance
npm run clean              # Alles opnieuw installeren (bij problemen)
```

---

## Probleemoplossing

### "Command not found: react-native"
```bash
npx react-native doctor    # Controleert alle vereisten
```

### Pod install faalt
```bash
cd ios
pod deintegrate
pod install --repo-update
cd ..
```

### Android build faalt
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Metro bundler crash
```bash
watchman watch-del-all
rm -rf node_modules/.cache
npm start -- --reset-cache
```

### TypeScript fouten na merge
```bash
rm -rf node_modules
npm install
npm run typecheck
```

---

## Belangrijke Beslissingen (vastgelegd)

Deze beslissingen zijn genomen en vastgelegd in de PoC resultaten:

| Beslissing | Keuze | Reden |
|-----------|-------|-------|
| XMPP client | **xmpp.js** | Native TypeScript, async/await, 6-0 score |
| Database | **WatermelonDB** | Geen vendor lock-in, SQLite, 5-2 score |
| Encryptie threshold | **8 leden** | Benchmark: 30MB→1MB payload besparing |
| Vertalingen | **5 talen** | NL, EN, DE, FR, ES |
| Min. iOS | **15.0** | Breed bereik, Privacy Manifest support |
| Min. Android | **API 24 (7.0)** | 97%+ marktdekking |
| Senior testing | **Bij werkend prototype** | Niet bij wireframes |

---

## Volgende stap

Na succesvolle installatie en het draaien van de app:

```
claude

> Lees .claude/CLAUDE.md en .claude/skills/onboarding-recovery-specialist/SKILL.md.
> Implementeer het complete onboarding scherm met taalkeuzescherm als eerste stap.
> Gebruik de vertalingen uit src/locales/ en het theme uit src/theme/.
> Controleer tegen .claude/cross-cutting/QUALITY_GATES.md wanneer je klaar bent.
```

Succes! 🚀
