# CommEazy Skill Interface Contracts

**Version:** 1.0 | **Date:** 2026-02-07

Each skill PROVIDES deliverables and EXPECTS inputs from other skills. This prevents siloed work.

---

## Contract Matrix

| Skill | Provides | Expects From |
|-------|----------|-------------|
| **architecture-lead** | System design, data flow, ADRs, service interfaces | All skills: implementation feedback |
| **security-expert** | Encryption API, security audit results, threat model | architecture: data flow; react-native: implementation |
| **ui-designer** | Component library, design system, screen layouts | accessibility: audit results; i18n: string structure |
| **ios-specialist** | iOS native modules, App Store assets, Privacy Manifest | security: encryption config; devops: CI/CD pipeline |
| **android-specialist** | Android native modules, Play Store assets, Data Safety | security: encryption config; devops: CI/CD pipeline |
| **react-native-expert** | Cross-platform components, navigation, state management | ui-designer: specs; security: encryption API |
| **xmpp-specialist** | XMPP service, MUC management, offline sync protocol | security: E2E integration; architecture: service interfaces |
| **testing-qa** | Test suites, coverage reports, senior test results | All skills: testable code with interfaces |
| **performance-optimizer** | Performance benchmarks, optimization recommendations | react-native: components; xmpp: connection handling |
| **documentation-writer** | API docs, user guides (5 langs), ADRs | All skills: code comments, TSDoc |
| **accessibility-specialist** | Accessibility audit, VoiceOver/TalkBack labels, a11y tests | ui-designer: components; all: screen implementations |
| **devops-specialist** | CI/CD pipeline, automated tests, store deployment | ios/android: build configs; testing: test suites |
| **onboarding-recovery** | Onboarding flow, account recovery, device migration | security: key backup; ui-designer: screen specs; i18n: strings |

---

## Cross-Skill Validation Rules

1. **Security validates ALL skills** — No code ships without security review
2. **Accessibility validates ALL UI** — No screen ships without a11y audit
3. **i18n validates ALL user-facing text** — No hardcoded strings allowed
4. **Performance validates ALL data operations** — No unoptimized queries/renders
5. **Testing validates ALL functionality** — No feature ships without tests

## Handoff Protocol

```
Skill A completes work → Hands off to Skill B for validation → 
Skill B approves OR returns with specific issues → Iterate until approved
```

Every handoff includes:
- File paths changed
- What was done (summary)
- What needs validation
- Known concerns/trade-offs
