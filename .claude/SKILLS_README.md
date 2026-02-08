# CommEazy Agent Teams — Skills Package V2.0

## What Changed from V1.0

### New Skills (3)
- **accessibility-specialist** — Dedicated a11y auditing for all screens
- **devops-specialist** — CI/CD, automated store deployment, screenshot generation
- **onboarding-recovery-specialist** — First-use flow, account recovery, key backup

### New Cross-Cutting Documents (4)
- **QUALITY_GATES.md** — 6 unified quality gates all skills must pass
- **TECH_COMPARISON.md** — Strophe.js vs xmpp.js, Realm vs WatermelonDB analysis
- **ERROR_TAXONOMY.md** — Categorized errors with 5-language user messages
- **INTERFACE_CONTRACTS.md** — What each skill provides/expects from others

### All 9 Existing Skills Revised
Every skill now includes:
1. **Store Compliance Gate** — Apple + Google specific requirements
2. **Senior Inclusive Design** — Respectful, non-condescending inclusive design
3. **i18n Requirements** — 5 languages (NL/EN/DE/FR/ES) integration
4. **Interface Contracts** — Dependencies on other skills
5. **Error Scenarios** — Unhappy paths with senior-friendly recovery
6. **Code Examples** — Happy + unhappy paths

### Key Decisions Made
- Android specialist: separate skill (not combined with iOS)
- Languages at launch: NL, EN, DE, FR, ES
- Accessibility: ALL features (Dynamic Type, colour blindness, reduced motion, haptic/audio)
- Encryption export: Complete US BIS guidance included
- Privacy Manifests: Required in ios-specialist
- RTL: Not needed (no Arabic/Hebrew)
- Tech stack: Comparison provided, recommend xmpp.js + WatermelonDB with abstraction layers
- Offline: 7-day device outbox retention
- Encryption: Dual-path kept (threshold 8), performance boundaries documented
- Senior testing: At working prototype stage (not wireframes)

## Structure

```
.claude/
├── CLAUDE.md                              # Master context (updated)
├── README.md                              # This file
├── cross-cutting/
│   ├── QUALITY_GATES.md                   # 6 unified quality gates
│   ├── TECH_COMPARISON.md                 # Technology evaluation
│   ├── ERROR_TAXONOMY.md                  # Error codes + 5-lang messages
│   └── INTERFACE_CONTRACTS.md             # Skill dependencies
└── skills/
    ├── architecture-lead/SKILL.md         # System design (revised)
    ├── security-expert/SKILL.md           # Encryption & privacy (revised)
    ├── ui-designer/SKILL.md               # Inclusive UI/UX (revised)
    ├── ios-specialist/SKILL.md            # iOS + App Store (revised)
    ├── android-specialist/SKILL.md        # Android + Play Store (NEW)
    ├── react-native-expert/SKILL.md       # Cross-platform (revised)
    ├── xmpp-specialist/SKILL.md           # XMPP protocol (revised)
    ├── testing-qa/SKILL.md                # Testing & QA (revised)
    ├── performance-optimizer/SKILL.md     # Performance (revised)
    ├── documentation-writer/SKILL.md      # Documentation (revised)
    ├── accessibility-specialist/SKILL.md  # Accessibility (NEW)
    ├── devops-specialist/SKILL.md         # CI/CD & DevOps (NEW)
    └── onboarding-recovery-specialist/SKILL.md  # Onboarding (NEW)
```

## Usage

Unzip in CommEazy project root. The `.claude/` directory is ready for Agent Teams development.

**Three Pillars** enforced across all skills:
1. 🏪 Store Compliance (Apple + Google)
2. 👥 Inclusive Senior Design (WCAG AAA)
3. 🌐 Multi-Language (NL/EN/DE/FR/ES)
