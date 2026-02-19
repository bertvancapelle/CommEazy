# Wijzigings-Validatie Matrix — CommEazy Skills

## Doel

Deze matrix definieert **welke skills** moeten valideren voor **elk type wijziging**. Dit zorgt ervoor dat geen wijziging wordt doorgevoerd zonder goedkeuring van alle relevante experts.

## Hoe te Gebruiken

1. Identificeer het type wijziging in de linkerkolom
2. Raadpleeg de vereiste skills in de rechterkolom
3. Valideer de wijziging tegen de checklist van elke skill
4. Documenteer de resultaten voordat je uitvoert

---

## Validatie Matrix

### UI & Frontend

| Wijzigingstype | Verplichte Skills | Optionele Skills |
|----------------|-------------------|------------------|
| Nieuw scherm/component | ui-designer, accessibility-specialist, react-native-expert | ios-specialist, android-specialist |
| Styling aanpassing | ui-designer, accessibility-specialist | - |
| Formulierveld toevoegen | ui-designer, accessibility-specialist | security-expert (als PII) |
| Button/interactief element | ui-designer, accessibility-specialist | - |
| Navigatie wijziging | architecture-lead, ui-designer | - |
| Wheel Navigation Menu wijziging | ui-designer, accessibility-specialist | architecture-lead |
| Animatie toevoegen | ui-designer, accessibility-specialist, performance-optimizer | - |
| Error state ontwerp | ui-designer, accessibility-specialist | - |
| Loading state | ui-designer, accessibility-specialist | - |
| Lijst/grid met >3 items | ui-designer, accessibility-specialist, react-native-expert | - |

### Voice Interactions (KERNFUNCTIE)

Voice control is een **kernfunctie** van CommEazy, niet optioneel. ELKE module MOET voice interactions ondersteunen.

| Wijzigingstype | Verplichte Skills | Optionele Skills |
|----------------|-------------------|------------------|
| **Lijsten met voice** | ui-designer, accessibility-specialist, react-native-expert | - |
| Voice command toevoegen | accessibility-specialist, react-native-expert, ui-designer | ios-specialist, android-specialist |
| Voice Session Mode UI | ui-designer, accessibility-specialist | - |
| **Formulier met voice** | ui-designer, accessibility-specialist, react-native-expert | - |
| Voice dictation | ios-specialist, android-specialist, accessibility-specialist | - |
| Voice confirmation dialog | ui-designer, accessibility-specialist | - |
| Speech recognition native | ios-specialist, android-specialist, accessibility-specialist | security-expert |
| Voice settings schema | architecture-lead, ui-designer | - |
| **Nieuw scherm/module** | ui-designer, accessibility-specialist, react-native-expert | (Voice interaction check verplicht) |

**BELANGRIJK:** Bij ELKE nieuwe module of scherm moet de Voice Interaction Checklist worden doorlopen:
- Lijsten >3 items: VoiceFocusable wrappers
- Formulieren: Voice dictation ondersteuning
- Primaire acties: Voice triggerable
- Destructieve acties: Voice confirmation

### Text-to-Speech (TTS)

CommEazy gebruikt een **dual-engine TTS architectuur** waarbij Nederlands ALTIJD de high-quality Piper TTS (`nl_NL-rdh-high`) moet gebruiken.

| Wijzigingstype | Verplichte Skills | Optionele Skills |
|----------------|-------------------|------------------|
| **Nieuwe TTS functionaliteit** | accessibility-specialist, react-native-expert, ios-specialist | android-specialist |
| TTS engine selectie | accessibility-specialist, react-native-expert | architecture-lead |
| Piper model toevoegen | ios-specialist, android-specialist, react-native-expert | performance-optimizer |
| TTS UI controls | ui-designer, accessibility-specialist | - |
| TTS progress tracking | react-native-expert, accessibility-specialist | - |

**KRITIEK:** Bij ELKE TTS implementatie moet worden gevalideerd:
- Nederlands (nl-NL, nl-BE) → Piper TTS `nl_NL-rdh-high`
- Andere talen → System TTS
- Engine tracking via `currentEngineRef`
- Stop functie stopt BEIDE engines

---

### Internationalisatie (i18n)

| Wijzigingstype | Verplichte Skills | Optionele Skills |
|----------------|-------------------|------------------|
| Nieuwe vertalingen | ui-designer, documentation-writer | - |
| Tekst wijziging | ui-designer | documentation-writer |
| Taal toevoegen | ui-designer, documentation-writer, architecture-lead | - |
| Foutmeldingen | ui-designer, documentation-writer | - |

### Security & Privacy

| Wijzigingstype | Verplichte Skills | Optionele Skills |
|----------------|-------------------|------------------|
| Encryptie code | security-expert | architecture-lead |
| Key management | security-expert, architecture-lead | - |
| Token handling | security-expert | - |
| PII data opslag | security-expert, architecture-lead | - |
| Auth flow | security-expert, onboarding-recovery-specialist | ui-designer |
| Privacy Manifest update | security-expert, ios-specialist | - |
| Data Safety Section | security-expert, android-specialist | - |

### Database & Storage

| Wijzigingstype | Verplichte Skills | Optionele Skills |
|----------------|-------------------|------------------|
| Schema wijziging | architecture-lead, security-expert | - |
| Query toevoegen | architecture-lead | performance-optimizer |
| Migratie | architecture-lead | testing-qa |
| Cache implementatie | architecture-lead, performance-optimizer | - |

### Messaging & Protocol

| Wijzigingstype | Verplichte Skills | Optionele Skills |
|----------------|-------------------|------------------|
| XMPP bericht versturen | xmpp-specialist, security-expert | - |
| Presence status | xmpp-specialist | ui-designer |
| MUC (groepschat) | xmpp-specialist, security-expert | - |
| Delivery receipts | xmpp-specialist | - |
| Offline sync | xmpp-specialist, architecture-lead | - |

### Platform Specifiek

| Wijzigingstype | Verplichte Skills | Optionele Skills |
|----------------|-------------------|------------------|
| iOS native module | ios-specialist, react-native-expert | security-expert |
| Android native module | android-specialist, react-native-expert | security-expert |
| Push notifications (iOS) | ios-specialist, security-expert | - |
| Push notifications (Android) | android-specialist, security-expert | - |
| Background tasks (iOS) | ios-specialist | performance-optimizer |
| Background tasks (Android) | android-specialist | performance-optimizer |
| Keychain/Keystore | ios-specialist OF android-specialist, security-expert | - |

### Onboarding & Recovery

| Wijzigingstype | Verplichte Skills | Optionele Skills |
|----------------|-------------------|------------------|
| Onboarding flow | onboarding-recovery-specialist, ui-designer, accessibility-specialist | - |
| Phone verificatie | onboarding-recovery-specialist, security-expert | - |
| Account recovery | onboarding-recovery-specialist, security-expert | - |
| Device linking | onboarding-recovery-specialist, security-expert, xmpp-specialist | - |
| PIN setup | onboarding-recovery-specialist, security-expert, ui-designer | - |

### Performance

| Wijzigingstype | Verplichte Skills | Optionele Skills |
|----------------|-------------------|------------------|
| List rendering | performance-optimizer, react-native-expert | ui-designer |
| Image handling | performance-optimizer | - |
| Memory optimalisatie | performance-optimizer | - |
| Bundle size | performance-optimizer, devops-specialist | - |
| Startup time | performance-optimizer | - |

### Testing & QA

| Wijzigingstype | Verplichte Skills | Optionele Skills |
|----------------|-------------------|------------------|
| Unit test | testing-qa | - |
| Integration test | testing-qa | architecture-lead |
| E2E test | testing-qa | ui-designer |
| Accessibility audit | testing-qa, accessibility-specialist | - |

### DevOps & Deployment

| Wijzigingstype | Verplichte Skills | Optionele Skills |
|----------------|-------------------|------------------|
| CI/CD pipeline | devops-specialist | - |
| Store submission | devops-specialist, ios-specialist, android-specialist | - |
| Screenshot generatie | devops-specialist, ui-designer | - |
| Prosody config | devops-specialist, xmpp-specialist | - |
| Coturn config | devops-specialist | - |

---

## Skill Checklist Referenties

Voor de specifieke validatie-regels van elke skill, zie:

| Skill | Checklist Locatie |
|-------|-------------------|
| ui-designer | `.claude/skills/ui-designer/SKILL.md` → Quality Checklist |
| accessibility-specialist | `.claude/skills/accessibility-specialist/SKILL.md` → WCAG AAA Checklist |
| security-expert | `.claude/skills/security-expert/SKILL.md` → Security Audit Checklist |
| architecture-lead | `.claude/skills/architecture-lead/SKILL.md` → Architecture Review |
| react-native-expert | `.claude/skills/react-native-expert/SKILL.md` → Cross-Platform Checklist |
| ios-specialist | `.claude/skills/ios-specialist/SKILL.md` → App Store Compliance |
| android-specialist | `.claude/skills/android-specialist/SKILL.md` → Play Store Compliance |
| xmpp-specialist | `.claude/skills/xmpp-specialist/SKILL.md` → Protocol Compliance |
| onboarding-recovery-specialist | `.claude/skills/onboarding-recovery-specialist/SKILL.md` → UX Flow Checklist |
| performance-optimizer | `.claude/skills/performance-optimizer/SKILL.md` → Performance Targets |
| testing-qa | `.claude/skills/testing-qa/SKILL.md` → Test Coverage Requirements |
| devops-specialist | `.claude/skills/devops-specialist/SKILL.md` → Deployment Checklist |
| documentation-writer | `.claude/skills/documentation-writer/SKILL.md` → Documentation Standards |

---

## Veelvoorkomende Scenario's

### Scenario 1: "Voeg een nieuw invoerveld toe voor e-mail"

**Classificatie:** Formulierveld + mogelijk PII

**Vereiste validaties:**
1. **ui-designer** — Labels BOVEN, BUITEN rand; touch target ≥60pt; vet label
2. **accessibility-specialist** — VoiceOver label; Dynamic Type; contrast
3. **security-expert** — Is e-mail PII? Wordt het versleuteld opgeslagen?

### Scenario 2: "Verbeter de performance van de chatlijst"

**Classificatie:** List rendering + performance

**Vereiste validaties:**
1. **performance-optimizer** — 60fps scroll; memory <200MB
2. **react-native-expert** — Cross-platform compatibel; geen memory leaks
3. **ui-designer** — Visuele kwaliteit blijft behouden

### Scenario 3: "Implementeer device linking met QR code"

**Classificatie:** Onboarding + Security + UI

**Vereiste validaties:**
1. **onboarding-recovery-specialist** — Max 3 stappen; senior-vriendelijk
2. **security-expert** — Key exchange; QR data encryptie
3. **ui-designer** — Grote QR code (200pt+); duidelijke instructies
4. **accessibility-specialist** — VoiceOver voor QR scanning
5. **xmpp-specialist** — Device sync protocol

---

## Handhaving

Dit document is **verplicht** voor alle wijzigingen. Als een wijziging wordt gemaakt zonder de vereiste validaties:

1. De wijziging moet worden teruggedraaid of alsnog gevalideerd
2. De architecture-lead moet de situatie beoordelen
3. Het coördinatie-protocol moet worden gevolgd voordat verder gegaan wordt

Zie `COORDINATION_PROTOCOL.md` voor het volledige validatieproces.
