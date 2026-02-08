# CLAUDE CODE DEVELOPMENT SETUP VOOR COMMEAZY

**Complete Guide: Van Nul tot Development Environment**

---

## Inhoudsopgave

1. Claude Code Capabilities & Beperkingen
2. Multi-Agent Setup (Security, UI, Architecture)
3. Cross-Platform Development (iOS, iPadOS, Android)
4. Xcode & Android Studio Requirements
5. Complete Setup Stappenplan
6. Development Workflow
7. Testing & Debugging
8. Veelvoorkomende Vragen

---

# 1. Claude Code Capabilities & Beperkingen

## 1.1 Wat is Claude Code?

**Claude Code** is een CLI tool waarmee Claude:
- ✅ Bestanden kan lezen/schrijven in je project
- ✅ Terminal commands kan uitvoeren
- ✅ Code kan genereren en refactoren
- ✅ Tests kan schrijven en draaien
- ✅ Dependencies kan installeren
- ✅ Git commits kan maken

**Claude Code is NIET:**
- ❌ Een IDE (je gebruikt het naast VS Code/Cursor)
- ❌ Een compiler (Xcode/Android Studio doen dat)
- ❌ Multiple agents (1 Claude instantie per keer)
- ❌ Autonomous (je geeft commands, Claude voert uit)

## 1.2 Claude Code voor React Native

**Wat Claude Code WEL kan (autonomie %):**

| **Taak** | **Autonomie** | **Jouw Rol** |
|----------|---------------|--------------|
| React componenten schrijven | 90% | Review, design decisions |
| TypeScript types definiëren | 85% | Validate business logic |
| Realm schema maken | 85% | Review data model |
| XMPP client integratie | 75% | Test, debug edge cases |
| Encryption wrappers (libsodium) | 80% | Security review |
| Navigation setup | 90% | UX flow decisions |
| Styling (Tailwind/StyleSheet) | 85% | Design approval |
| Unit tests schrijven | 70% | Define test cases |
| Git workflows | 80% | Final review, merge |

**Wat Claude Code NIET kan:**

| **Taak** | **Reden** | **Jouw Rol** |
|----------|-----------|--------------|
| App compileren voor device | Xcode/Android Studio nodig | JIJ compileert |
| App Store submission | Handmatig proces | JIJ uploadt |
| Native module linking | Xcode project wijzigen | JIJ linkt |
| iOS Simulator draaien | macOS + Xcode nodig | JIJ draait |
| Physical device debugging | USB + tools | JIJ debug |
| Prosody server opzetten | SSH naar VPS | JIJ configureert |

**Gemiddelde autonomie: 78%** (22% is jouw werk)

---

# 2. Multi-Agent Setup (Workaround)

## 2.1 Probleem: Claude Code = 1 Agent

Claude Code ondersteunt **GEEN echte multi-agent architectuur**.

Je kunt NIET:
- ❌ Meerdere Claude instanties tegelijk draaien
- ❌ "Security agent" + "UI agent" parallel laten werken
- ❌ Agents laten "praten" met elkaar

## 2.2 Oplossing: Context Switching + Custom Instructions

**Strategie:** Gebruik **verschillende contexten** met aangepaste instructies.

### Aanpak 1: Project Files Structuur

```
commeazy/
├── .claude/
│   ├── security-context.md      ← Security focus
│   ├── ui-context.md            ← UI/UX focus
│   ├── architecture-context.md  ← Architecture decisions
│   └── current-context.md       ← Symlink naar actieve context
├── src/
│   ├── components/
│   ├── screens/
│   ├── services/
│   └── utils/
└── docs/
    └── architecture.md
```

**security-context.md:**
```markdown
# Security Context

Je bent een security expert voor CommEazy.

## Jouw Focus:
- E2E encryption (libsodium)
- Key management
- Secure storage (Realm encryption)
- Input validation
- XMPP security
- Zero server storage verification

## Altijd Checken:
- Zijn keys veilig opgeslagen?
- Is data encrypted voor opslag?
- Zijn API calls authenticated?
- Is input gesanitized?

## Niet Jouw Focus:
- UI/UX design
- Styling
- Navigation flows
```

**ui-context.md:**
```markdown
# UI/UX Context

Je bent een senior UI/UX developer voor CommEazy.

## Jouw Focus:
- React Native componenten
- Senior-friendly design (grote knoppen, 18pt+ tekst)
- Accessibility
- Touch target sizes (min 60x60pt)
- Clear visual hierarchy
- Loading states
- Error messages (simpel Nederlands)

## Design Principes:
1. GROTE lettertype (min 18pt)
2. GROTE knoppen (min 60x60pt)
3. HOOG contrast
4. Max 3 stappen per flow
5. Duidelijke feedback

## Niet Jouw Focus:
- Encryption implementation
- Database queries
- Server configuration
```

**architecture-context.md:**
```markdown
# Architecture Context

Je bent de lead architect voor CommEazy.

## Jouw Focus:
- System design
- Data flow
- API design
- Performance
- Scalability
- Technical debt prevention

## Beslissingen Maken:
- Welke library gebruiken?
- Hoe structureren we code?
- Wat is het beste pattern?

## Niet Jouw Focus:
- Pixel-perfect UI
- Specifieke encryption algorithms (security's domein)
```

### Aanpak 2: Session-Based Context Switching

**Terminal sessies:**

```bash
# Terminal 1: Security work
cd commeazy
export CLAUDE_CONTEXT="security"
claude-code --context-file .claude/security-context.md

# Terminal 2: UI work
cd commeazy
export CLAUDE_CONTEXT="ui"
claude-code --context-file .claude/ui-context.md

# Terminal 3: Architecture work
cd commeazy
export CLAUDE_CONTEXT="architecture"
claude-code --context-file .claude/architecture-context.md
```

**Voordeel:** Verschillende Claude sessies met specifieke focus.

**Nadeel:** Niet echt parallel (1 sessie per keer actief).

### Aanpak 3: Taak-Specifieke Prompts

**In plaats van "agents", gebruik expliciete rol-prompts:**

```bash
# Security review
claude-code

> "Act as a security expert. Review src/services/encryption.ts 
  for vulnerabilities. Check: key storage, encryption strength, 
  input validation."

# UI development
claude-code

> "Act as a senior UI designer. Create a GroupChatScreen component
  following CommEazy design system (18pt+ text, 60x60pt buttons,
  high contrast). Reference: docs/ui-guidelines.md"

# Architecture decision
claude-code

> "Act as lead architect. We need to choose between Zustand and
  Redux for state management. Consider: bundle size, learning curve,
  React Native compatibility. Recommend best option."
```

**Voordeel:** Flexibel, makkelijk te switchen.

**Nadeel:** Geen persistent "agent" memory.

## 2.3 Aanbeveling: Hybrid Approach

**Beste strategie voor CommEazy:**

1. **Context files** voor verschillende domeinen
2. **Expliciete rol-prompts** in elke sessie
3. **Documentation** als single source of truth

**Workflow:**

```
Week 5 - Authentication:
├─ Day 1: Architecture (design auth flow)
│   └─ claude-code --context architecture-context.md
│       "Design Firebase phone auth integration"
│
├─ Day 2: Security (implement secure storage)
│   └─ claude-code --context security-context.md
│       "Implement secure token storage using Realm encryption"
│
└─ Day 3: UI (create auth screens)
    └─ claude-code --context ui-context.md
        "Create PhoneAuthScreen with OTP input (senior-friendly)"
```

**Key insight:** Je switcht ZELF tussen contexten/rollen door expliciete instructies te geven.

---

# 3. Cross-Platform Development (iOS, iPadOS, Android)

## 3.1 React Native = Write Once, Run Everywhere?

**Ja, MAAR...**

| **Aspect** | **Shared** | **Platform-Specific** |
|------------|------------|-----------------------|
| Business logic | ✅ 95% | Native modules (5%) |
| UI components | ✅ 90% | Platform styling (10%) |
| Navigation | ✅ 100% | - |
| State management | ✅ 100% | - |
| API calls | ✅ 100% | - |
| **Encryption** | ✅ 100% (JS) | - |
| **XMPP client** | ✅ 100% (JS) | - |
| **WebRTC calls** | ⚠️ 80% | Platform permissions (20%) |
| Camera/Gallery | ⚠️ 70% | Native pickers (30%) |
| Push notifications | ⚠️ 60% | FCM config (40%) |
| **Build process** | ❌ 0% | Xcode (iOS) + Gradle (Android) |

**Realiteit:** ~85% code is shared, 15% platform-specific.

## 3.2 Gelijktijdig Ontwikkelen: iOS + Android

**Ja, dit is mogelijk!**

**Typische workflow:**

```
1. Ontwikkel feature in shared code (src/)
   └─ Claude Code schrijft TypeScript/React components
   
2. Test op iOS Simulator (Mac)
   └─ JIJ draait: npx react-native run-ios
   
3. Test op Android Emulator (Mac/Linux/Windows)
   └─ JIJ draait: npx react-native run-android
   
4. Fix platform-specific issues
   └─ Claude Code helpt met Platform.select() patterns
   
5. Test op fysieke devices
   └─ JIJ debug via Xcode/Android Studio
```

**Claude Code kan:**
- ✅ Shared code schrijven (components, services, utils)
- ✅ Platform.select() gebruiken voor styling differences
- ✅ Platform-specific files maken (file.ios.ts, file.android.ts)

**Claude Code kan NIET:**
- ❌ iOS Simulator draaien (jij doet: `npx react-native run-ios`)
- ❌ Android Emulator draaien (jij doet: `npx react-native run-android`)
- ❌ Native modules compileren (Xcode/Gradle doen dit)

## 3.3 iPad vs iPhone

**Vraag:** Moet ik apart voor iPad ontwikkelen?

**Antwoord:** Nee! iPadOS = iOS.

React Native app draait automatisch op iPad.

**Maar:** Je moet wel **responsive design** implementeren:

```typescript
// Claude Code kan dit schrijven:
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

const styles = StyleSheet.create({
  button: {
    width: isTablet ? 200 : 150, // Grotere buttons op iPad
    height: isTablet ? 80 : 60,
  }
});
```

**Voor CommEazy:**
- iPhone: 1 kolom (messages fullscreen)
- iPad: 2 kolommen (conversations links, chat rechts)

Claude Code kan dit implementeren met responsive layouts.

---

# 4. Xcode & Android Studio Requirements

## 4.1 Heb Ik Xcode Nodig?

**Voor iOS development: JA, absoluut.**

| **Task** | **Xcode Nodig?** |
|----------|------------------|
| Code schrijven (TypeScript/React) | ❌ Nee (VS Code) |
| App compileren voor iOS | ✅ JA |
| iOS Simulator draaien | ✅ JA |
| Physical iPhone testen | ✅ JA |
| App Store submission | ✅ JA |
| Native modules linken | ✅ JA |
| Push notifications setup | ✅ JA |

**Waarom?**

Xcode bevat:
- iOS SDK (frameworks, APIs)
- iOS Simulator
- Code signing tools
- App Store upload tools

**Zonder Xcode:** Je kunt ALLEEN Android ontwikkelen.

## 4.2 Heb Ik Android Studio Nodig?

**Voor Android development: JA.**

| **Task** | **Android Studio Nodig?** |
|----------|---------------------------|
| Code schrijven | ❌ Nee (VS Code) |
| App compileren voor Android | ✅ JA (Gradle) |
| Android Emulator draaien | ✅ JA |
| Physical Android testen | ✅ JA (ADB) |
| Play Store submission | ⚠️ Nee (web) maar handig |

**Je kunt:**
- Gradle installeren zonder Android Studio (maar complex)
- Android SDK apart downloaden

**Maar:** Android Studio is veel makkelijker (alles-in-één).

## 4.3 Platform Requirements

| **Ontwikkel voor** | **Vereist OS** | **Tools** |
|--------------------|----------------|-----------|
| iOS + Android | **macOS** | Xcode + Android Studio |
| Alleen Android | macOS / Linux / Windows | Android Studio |
| Alleen iOS | **macOS** | Xcode |

**Conclusie voor CommEazy:**
- **macOS = beste keuze** (iOS + Android development mogelijk)
- **Windows/Linux = alleen Android** (geen iOS zonder macOS)

## 4.4 Minimum Requirements

**macOS (voor iOS + Android):**
```
OS: macOS 13+ (Ventura or newer)
RAM: 16 GB (minimum), 32 GB (recommended)
Disk: 100 GB free (Xcode + Android Studio + simulators)
CPU: M1/M2/M3 (ARM) of Intel i5+ (x86)

Xcode: 15+ (latest)
Android Studio: Hedgehog+ (latest)
Node.js: 18+ LTS
```

**Windows/Linux (alleen Android):**
```
RAM: 16 GB minimum
Disk: 50 GB free
Android Studio: Latest
Node.js: 18+ LTS
```

---

# 5. Complete Setup Stappenplan

## 5.1 Prerequisites (Before Anything)

```bash
# 1. Check Node.js version
node --version  # Should be 18+

# 2. Check npm/yarn
npm --version   # or: yarn --version

# 3. Check Git
git --version

# 4. Check macOS version (if Mac)
sw_vers  # Should be 13+
```

## 5.2 Step-by-Step Setup (macOS)

### Step 1: Install Xcode (iOS development)

```bash
# Option A: App Store
# - Open App Store
# - Search "Xcode"
# - Install (takes 1-2 hours, ~40 GB)

# Option B: Direct download
# - Go to developer.apple.com/download
# - Download Xcode 15+
# - Install .xip file

# After install:
sudo xcode-select --switch /Applications/Xcode.app
xcode-select --install  # Command Line Tools

# Agree to license
sudo xcodebuild -license accept

# Test
xcodebuild -version  # Should show Xcode 15+
```

### Step 2: Install Android Studio (Android development)

```bash
# Download from: developer.android.com/studio
# Install Android Studio.dmg

# Open Android Studio
# - Go through setup wizard
# - Install Android SDK
# - Install Android Emulator
# - Create virtual device (Pixel 7, API 34)

# Add to PATH (.zshrc or .bashrc):
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Test
adb --version
emulator -list-avds
```

### Step 3: Install React Native CLI

```bash
# Install React Native CLI globally
npm install -g react-native-cli

# Or use npx (no global install)
npx react-native --version
```

### Step 4: Install Claude Code

```bash
# Install via npm
npm install -g @anthropic-ai/claude-code

# Or via Homebrew
brew install claude-code

# Test
claude-code --version

# Login (requires API key or Claude Pro)
claude-code login
```

### Step 5: Install CocoaPods (iOS dependencies)

```bash
# CocoaPods for iOS native dependencies
sudo gem install cocoapods

# Test
pod --version
```

### Step 6: Install Watchman (file watcher)

```bash
# Watchman for fast reloads
brew install watchman

# Test
watchman --version
```

## 5.3 Create CommEazy Project

```bash
# Create new React Native project
npx react-native init CommEazy --template react-native-template-typescript

# Navigate
cd CommEazy

# Install core dependencies
npm install \
  @react-navigation/native \
  @react-navigation/bottom-tabs \
  react-native-webrtc \
  strophe.js \
  libsodium-wrappers \
  realm \
  @react-native-firebase/app \
  @react-native-firebase/auth \
  @react-native-firebase/messaging \
  react-native-image-picker \
  react-native-fs

# iOS: Install pods
cd ios && pod install && cd ..

# Test iOS
npx react-native run-ios

# Test Android (start emulator first!)
npx react-native run-android
```

## 5.4 Setup Claude Code Context

```bash
# Create .claude directory
mkdir .claude

# Create context files
cat > .claude/security-context.md << EOF
# Security Context for CommEazy
You are a security expert focusing on:
- E2E encryption (libsodium)
- Zero server storage
- Secure key management
EOF

cat > .claude/ui-context.md << EOF
# UI/UX Context for CommEazy
You are a senior UI developer focusing on:
- Senior-friendly design (18pt+, 60x60pt buttons)
- Accessibility
- React Native best practices
EOF

cat > .claude/architecture-context.md << EOF
# Architecture Context for CommEazy
You are the lead architect focusing on:
- System design
- Data flow
- Performance
EOF

# Start Claude Code with context
claude-code --context-file .claude/ui-context.md
```

---

# 6. Development Workflow

## 6.1 Typical Day: Week 7 (Chat UI)

**Goal:** Create ChatScreen component

### Morning (Architecture)

```bash
# Terminal 1: Architecture decisions
cd CommEazy
claude-code --context-file .claude/architecture-context.md
```

**Prompt:**
```
"Design the ChatScreen architecture for CommEazy. 
Consider:
- Message list (FlatList with 500+ messages)
- Real-time updates (XMPP stanzas)
- Encryption/decryption performance
- Image lazy loading

Propose component structure and data flow."
```

Claude creates:
- `docs/chat-screen-architecture.md`
- Component diagram
- Data flow diagram

### Mid-Morning (UI Implementation)

```bash
# Terminal 1: UI development
claude-code --context-file .claude/ui-context.md
```

**Prompt:**
```
"Implement ChatScreen component following docs/chat-screen-architecture.md

Requirements:
- 18pt+ font for messages
- Sender name above bubble (for groups)
- Own messages right (green), others left (grey)
- Input field 56pt high
- Send button 60x60pt

Create: src/screens/ChatScreen.tsx"
```

Claude creates full component (~300 lines).

### Afternoon (Test on Devices)

```bash
# Terminal 2: Run iOS
npx react-native run-ios

# Terminal 3: Run Android
npx react-native run-android
```

**JIJ test:**
- Does layout look good?
- Are buttons big enough?
- Any crashes?

### Late Afternoon (Bug Fixes)

Back to Claude:

```
"ChatScreen has issues:
1. Message bubbles too small on iPhone SE
2. Input field keyboard overlaps messages
3. Send button not centered

Fix these issues in src/screens/ChatScreen.tsx"
```

Claude fixes and commits.

### Evening (Security Review)

```bash
claude-code --context-file .claude/security-context.md
```

**Prompt:**
```
"Security review: ChatScreen message handling

Check:
1. Are messages decrypted securely?
2. Is plaintext ever logged?
3. Are encryption keys properly cleared from memory?
4. Is user input sanitized before encryption?

Review: src/screens/ChatScreen.tsx and src/services/encryption.ts"
```

Claude creates security report + fixes.

## 6.2 Parallel Work (Simulated)

**Vraag:** Kan ik UI en Security parallel doen?

**Antwoord:** Niet echt, maar je kunt snel switchen:

```bash
# Morning: UI work (2 hours)
claude-code --context ui-context.md
> "Create GroupListScreen"

# Afternoon: Security review (1 hour)
claude-code --context security-context.md
> "Review GroupListScreen for security issues"

# Late afternoon: UI fixes (1 hour)
claude-code --context ui-context.md
> "Fix issues from security review"
```

**Snelle context switches (~5 min) voelen bijna als parallel.**

## 6.3 Git Workflow

Claude Code kan Git commands uitvoeren:

```bash
claude-code
```

**Prompt:**
```
"Commit current changes:
- Added GroupListScreen component
- Implemented group creation flow
- Added unit tests

Use conventional commits format.
Then push to origin/main."
```

Claude executes:
```bash
git add src/screens/GroupListScreen.tsx
git add src/components/GroupCreateModal.tsx
git add __tests__/GroupListScreen.test.tsx
git commit -m "feat: add group list screen with creation flow

- Implemented GroupListScreen component
- Added GroupCreateModal for group creation
- Includes unit tests with 85% coverage"
git push origin main
```

---

# 7. Testing & Debugging

## 7.1 Testing Strategy

**Claude Code schrijft tests:**

```bash
claude-code
```

**Prompt:**
```
"Write unit tests for src/services/encryption.ts

Test cases:
1. encryptMessage() returns valid ciphertext
2. decryptMessage() recovers original plaintext
3. Invalid key throws error
4. Empty message throws error
5. Encryption is deterministic (same input = different output due to nonce)

Use Jest. Create: __tests__/encryption.test.ts"
```

**Run tests:**
```bash
npm test
```

**JIJ debug failures** (Claude kan helpen met fixes).

## 7.2 Debugging on Device

**iOS Simulator:**
```bash
# Run app
npx react-native run-ios

# Open debugger (in app)
# Shake device → "Debug" → Chrome DevTools opens

# View logs
npx react-native log-ios
```

**Android Emulator:**
```bash
# Run app
npx react-native run-android

# View logs
npx react-native log-android

# Or use adb
adb logcat
```

**Claude Code kan helpen met:**
- Analyzing crash logs
- Suggesting fixes for errors
- Adding debug logging

**Claude Code kan NIET:**
- Draaien in Simulator/Emulator
- Interactieve debugging (breakpoints)

## 7.3 Physical Device Testing

**iOS (iPhone/iPad):**
```bash
# Connect iPhone via USB
# Trust computer on device

# In Xcode:
# - Open ios/CommEazy.xcworkspace
# - Select connected device
# - Click Run (or Cmd+R)
```

**Android:**
```bash
# Enable Developer Mode on phone
# Enable USB Debugging

# Connect via USB
adb devices  # Should show device

# Run
npx react-native run-android --device
```

---

# 8. Veelvoorkomende Vragen

## Q1: Kan Claude Code de hele app bouwen zonder mij?

**A:** Nee. Claude kan ~78% autonoom schrijven, maar jij moet:
- Design decisions maken
- Testen op devices
- Server opzetten (Prosody)
- App Store submission
- Senior testing organiseren

## Q2: Moet ik programmeren kunnen?

**A:** Basics helpen, maar Claude Code kan veel uitleggen. Je moet:
- ✅ Terminal commands kunnen lezen
- ✅ Code kunnen reviewen (niet per se schrijven)
- ✅ Errors kunnen interpreteren (Claude helpt)
- ✅ Git basics kennen

## Q3: Kan ik op Windows ontwikkelen?

**A:** Alleen Android. Voor iOS heb je Mac + Xcode nodig.

## Q4: Hoe lang duurt setup?

**A:** 
- Mac setup (Xcode + Android Studio): 4-6 uur
- React Native project setup: 1-2 uur
- Claude Code setup: 30 min
- **Totaal: 1 dag**

## Q5: Kost Claude Code geld?

**A:** 
- Claude Pro ($20/maand) = Claude Code included
- Of: Anthropic API key (pay-as-you-go)

Voor CommEazy (23 weken):
- Claude Pro: $20 × 6 maanden = $120
- Zeer acceptabel voor 78% autonomie!

## Q6: Kan Claude Code native modules linken?

**A:** Gedeeltelijk. Claude kan:
- ✅ npm install commands draaien
- ✅ Pod install uitvoeren (iOS)
- ⚠️ Xcode project files wijzigen (met guidance)
- ❌ Complexe native code schrijven (C++/Swift/Kotlin)

Voor react-native-webrtc (native module):
- Claude installeert package
- Claude draait pod install
- JIJ moet mogelijk Xcode permissions configureren

## Q7: Wat als Claude vast loopt?

**A:** 
1. Geef meer context (`@file` mention)
2. Split taak op in kleinere stukken
3. Vraag explicitie om debugging help
4. Google error messages (Claude kan helpen interpreteren)
5. Stack Overflow + Claude review answers

## Q8: Kan ik meerdere Claude sessies parallel draaien?

**A:** Technisch ja (meerdere terminals), maar:
- Niet aan te raden (merge conflicts)
- Beter: snel switchen tussen contexten
- Claude kan helpen mergen als conflict

---

# 9. Recommended Workflow voor CommEazy

## Week 1-4: Foundation

**Day 1-2:** Project Setup (JIJ + Claude)
```bash
# JIJ: Create React Native project
npx react-native init CommEazy --template typescript

# Claude: Setup folder structure
claude-code
> "Create folder structure following CommEazy architecture:
   src/components, src/screens, src/services, src/utils"
```

**Day 3-5:** Realm + Encryption (Claude 80%)
```bash
claude-code --context architecture-context.md
> "Implement Realm schemas from docs/data-model.md"

claude-code --context security-context.md
> "Implement libsodium encryption wrappers"
```

**Day 6-10:** XMPP Client (Claude 75%)
```bash
claude-code --context architecture-context.md
> "Implement XMPP connection manager using Strophe.js
   Reference: docs/xmpp-architecture.md"
```

## Week 5-8: Core Features

**UI-heavy weeks:** Meer tijd met UI context

```bash
# Most time in UI context
claude-code --context ui-context.md

# Occasional security reviews
claude-code --context security-context.md
> "Quick security review of auth flow"
```

## Week 9-11: Groups

**Mix van Architecture + Security + UI:**

```bash
# Day 1-2: Architecture
claude-code --context architecture-context.md
> "Design group messaging architecture (outbox, ACK, sync)"

# Day 3-5: Security
claude-code --context security-context.md
> "Implement dual encryption (encrypt-to-all + shared-key)"

# Day 6-10: UI
claude-code --context ui-context.md
> "Implement GroupChatScreen and GroupListScreen"
```

## Testing Throughout

**Elke week:**
- JIJ test op iOS Simulator (daily)
- JIJ test op Android Emulator (2× per week)
- JIJ test op physical device (1× per week)
- Claude schrijft unit tests (daily)

---

# 10. Final Checklist

## Prerequisites ✓

- [ ] macOS 13+ (or Windows/Linux for Android only)
- [ ] 16+ GB RAM
- [ ] 100+ GB free disk space
- [ ] Node.js 18+ installed
- [ ] Git installed
- [ ] Xcode 15+ installed (Mac only)
- [ ] Android Studio installed
- [ ] Claude Code installed
- [ ] Claude Pro subscription OR API key

## Development Environment ✓

- [ ] React Native CLI installed
- [ ] CocoaPods installed (Mac)
- [ ] Watchman installed (Mac)
- [ ] VS Code or Cursor installed
- [ ] iOS Simulator configured
- [ ] Android Emulator created
- [ ] Physical devices configured (optional)

## Project Setup ✓

- [ ] CommEazy React Native project created
- [ ] Dependencies installed
- [ ] iOS pods installed
- [ ] .claude/ context files created
- [ ] Git repository initialized
- [ ] First test build successful (iOS + Android)

## Ready to Start! 🚀

---

**Samenvatting:**

1. **Claude Code = Powerful, maar geen magic**
   - 78% autonomie voor code
   - JIJ doet: testen, beslissingen, compilation

2. **Multi-agent = Context switching**
   - Geen echte agents, maar slimme context files
   - Snel switchen tussen rollen (UI, Security, Architecture)

3. **Cross-platform = Mogelijk maar Xcode + Android Studio nodig**
   - 85% shared code
   - Mac = beste keuze (iOS + Android)
   - Windows/Linux = alleen Android

4. **Setup = 1 dag werk**
   - Xcode + Android Studio installeren
   - React Native project opzetten
   - Claude Code configureren met contexts

5. **Workflow = Iteratief**
   - Claude schrijft code (context-specifiek)
   - JIJ test op devices
   - Claude fix issues
   - JIJ review + merge

**Je bent nu klaar om CommEazy te bouwen! 🎉**
