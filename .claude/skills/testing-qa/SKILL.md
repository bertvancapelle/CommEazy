---
name: testing-qa
description: >
  Testing & QA specialist for CommEazy. Designs and implements unit tests
  (Jest), integration tests, E2E tests (Detox), accessibility audits,
  i18n validation, store compliance testing, and senior user testing
  protocols across iOS, iPadOS, and Android.
tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
model: sonnet
---

# Testing & QA — CommEazy

## Core Responsibilities

- Test pyramid: 60% unit (Jest), 30% integration, 10% E2E (Detox)
- Encryption round-trip tests
- XMPP connection & offline sync tests
- Accessibility automated tests (VoiceOver/TalkBack)
- i18n coverage validation (all 12 languages: NL/EN/EN-GB/DE/FR/ES/IT/NO/SV/DA/PT/PT-BR)
- Senior user testing protocol (with working prototype)
- Store compliance pre-submission testing
- Performance regression tests

## Parallelle Test Ontwikkeling (VERPLICHT)

Bij het ontwikkelen van nieuwe modules/features MOET de ontwikkelaar tests parallel schrijven:

### Workflow
1. **VOOR implementatie:**
   - Test file aanmaken: `__tests__/[Component].test.tsx`
   - Test skeletons schrijven voor verwachte functionaliteit

2. **TIJDENS implementatie:**
   - Na elke functie: unit test toevoegen
   - Na elke component: component test toevoegen
   - Red-Green-Refactor cyclus volgen

3. **VOOR oplevering:**
   - Alle tests moeten groen zijn
   - Coverage moet ≥80% zijn
   - Geen `any` types in test files

### Minimum Coverage per Component Type

| Component Type | Unit Tests | Integration | E2E |
|---------------|------------|-------------|-----|
| Service (API calls) | 90% | 60% | - |
| Context (state management) | 80% | 70% | - |
| Screen | 70% | 50% | 1 happy path |
| UI Component | 80% | - | - |
| Hook | 85% | - | - |

### Voice Interaction Tests (VERPLICHT voor voice-enabled modules)

```typescript
describe('Voice Interactions', () => {
  it('multi-match navigatie werkt correct', async () => {
    // "maria" matcht met "Oma Maria" + "Tante Maria"
    const matches = voiceFocus.focusByName('maria');
    expect(matches.length).toBeGreaterThan(1);
    expect(matches[0].label).toContain('Maria');
  });

  it('voice command recognition accuracy ≥95%', async () => {
    const commands = ['volgende', 'vorige', 'open', 'stop'];
    const results = await Promise.all(
      commands.map(cmd => recognizeCommand(cmd))
    );
    const accuracy = results.filter(r => r.recognized).length / commands.length;
    expect(accuracy).toBeGreaterThanOrEqual(0.95);
  });

  it('VoiceFocusable scroll-into-view werkt', async () => {
    const { getByTestId } = render(<ListWithVoiceFocus items={100} />);
    voiceFocus.focusByIndex(99);
    await waitFor(() => {
      expect(getByTestId('item-99')).toBeVisible();
    });
  });
});
```

### Test Naming Convention

```
[Component].[methode/scenario].[expected outcome]

Voorbeelden:
- RadioContext.playStation.setsCurrentStation
- RadioScreen.favoriteToggle.addsToFavorites
- artworkService.fetchArtwork.returnsCachedResultOnSecondCall
```

## Store Compliance — Testing

### Pre-Submission Test Suite
```
iOS:
- [ ] TestFlight beta tested (internal + external testers)
- [ ] All iPad layouts verified (Split View, Slide Over)
- [ ] Dynamic Type at all sizes
- [ ] VoiceOver complete flow
- [ ] No crash on low memory (simulate in Xcode)
- [ ] Privacy Manifest entries match actual API usage

Android:
- [ ] Internal testing track verified
- [ ] All screen sizes (5"-10.5")
- [ ] Font scaling at maximum
- [ ] TalkBack complete flow
- [ ] No crash on background process kill
- [ ] Permissions gracefully handle denial
```

## Senior Inclusive — Testing

### Senior User Testing Protocol (at working prototype stage)

```yaml
Participants: 10 senioren (65-80 jaar), mix iPhone/iPad/Android
Recruitment: Via seniorenverenigingen, niet via tech-communities
Environment: Rustige ruimte, eigen device, geen tijdsdruk

Tasks (met tijdslimiet):
  1. "Open de app en maak je account aan" (10 min)
  2. "Stuur een bericht naar Jan" (5 min)
  3. "Stuur een foto naar Jan" (7 min)
  4. "Maak een groep 'Familie' met Jan en Marie" (10 min)
  5. "Stuur een bericht in de groep" (5 min)
  6. "Bel Jan via video" (8 min)
  7. "Verander de taal naar Engels" (3 min)

Observatie:
  - Waar aarzelt de deelnemer?
  - Waar tikt de deelnemer verkeerd?
  - Welke tekst leest de deelnemer niet?
  - Welke stap wordt overgeslagen?

Success Criteria:
  - Task completion: ≥ 80%
  - Error rate: < 10%
  - Satisfaction: ≥ 3.5/5
  - "Zou je deze app gebruiken?": ≥ 70% ja

Post-Interview (in eigen taal deelnemer):
  NL: "Wat vond je het moeilijkst?" / "Wat zou je anders willen?"
  DE: "Was fanden Sie am schwierigsten?" / "Was würden Sie anders machen?"
  FR: "Qu'avez-vous trouvé le plus difficile?" / "Que changeriez-vous?"
```

## Unit Tests (Jest)

### Encryption Round-Trip
```typescript
describe('Encryption', () => {
  it('encrypts and decrypts 1-on-1 correctly', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const plaintext = 'Hallo Bob!';
    
    const encrypted = await encrypt1on1(plaintext, bob.publicKey, alice.privateKey);
    expect(encrypted.ciphertext).not.toBe(plaintext);
    
    const decrypted = await decrypt1on1(encrypted, alice.publicKey, bob.privateKey);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypt-to-all works for ≤8 members', async () => {
    const sender = await generateKeyPair();
    const members = await Promise.all(Array(8).fill(null).map(() => generateKeyPair()));
    
    const bundle = await encryptToAll('Groepsbericht', members);
    expect(Object.keys(bundle.payloads)).toHaveLength(8);
    
    // Each member can decrypt
    for (const member of members) {
      const decrypted = await decrypt1on1(bundle.payloads[member.jid], sender.publicKey, member.privateKey);
      expect(decrypted).toBe('Groepsbericht');
    }
  });

  it('shared-key works for >8 members', async () => {
    const members = await Promise.all(Array(15).fill(null).map(() => generateKeyPair()));
    const bundle = await encryptSharedKey('Groot groepsbericht', members);
    expect(bundle.type).toBe('shared-key');
    expect(Object.keys(bundle.wrappedKeys)).toHaveLength(15);
  });

  it('NEVER sends plaintext on encryption failure', async () => {
    const invalidKey = new Uint8Array(10); // Wrong key length
    await expect(encrypt1on1('test', invalidKey, validKey)).rejects.toThrow('E200');
  });
});
```

### Outbox & Delivery
```typescript
describe('Outbox', () => {
  it('stores message with 7-day TTL', async () => {
    const msg = await saveOutboxMessage({ content: 'encrypted', pendingTo: ['bob'] });
    expect(msg.expiresAt).toBeCloseTo(Date.now() + 7 * 24 * 3600 * 1000, -3);
  });

  it('marks delivery per member', async () => {
    await saveOutboxMessage({ id: 'msg1', pendingTo: ['alice', 'bob'] });
    await markDelivered('msg1', 'alice');
    const msg = await getOutboxMessage('msg1');
    expect(msg.deliveredTo).toContain('alice');
    expect(msg.pendingTo).not.toContain('alice');
    expect(msg.pendingTo).toContain('bob');
  });

  it('cleans up expired messages', async () => {
    // Insert message with past expiry
    await saveOutboxMessage({ id: 'old', expiresAt: Date.now() - 1000 });
    const cleaned = await cleanupExpiredOutbox();
    expect(cleaned).toBe(1);
  });
});
```

### i18n Coverage Test
```typescript
describe('i18n completeness', () => {
  const languages = ['nl', 'en', 'de', 'fr', 'es'];
  const baseKeys = Object.keys(flattenTranslations(require('./locales/en.json')));
  
  languages.forEach(lang => {
    it(`${lang} has all translation keys`, () => {
      const langKeys = Object.keys(flattenTranslations(require(`./locales/${lang}.json`)));
      const missing = baseKeys.filter(k => !langKeys.includes(k));
      expect(missing).toEqual([]);
    });
  });
});
```

## E2E Tests (Detox)

```typescript
describe('Senior Flow: Send Message', () => {
  it('should send a text message', async () => {
    await element(by.text(t('tabs.chats'))).tap();
    await element(by.text('Jan')).tap();
    await element(by.id('message-input')).typeText('Hallo Jan!');
    await element(by.id('send-button')).tap();
    await waitFor(element(by.text('✓✓'))).toBeVisible().withTimeout(5000);
  });

  it('should change language to German', async () => {
    await element(by.text(t('tabs.settings'))).tap();
    await element(by.text(t('settings.language'))).tap();
    await element(by.text('Deutsch')).tap();
    await waitFor(element(by.text('Einstellungen'))).toBeVisible().withTimeout(2000);
  });
});
```

## Quality Checklist

- [ ] Unit test coverage > 80%
- [ ] Encryption round-trip tests pass (all 3 modes)
- [ ] Outbox 7-day TTL + cleanup tested
- [ ] XMPP connection/reconnection tested
- [ ] i18n: all 12 languages have complete translations (NL/EN/EN-GB/DE/FR/ES/IT/NO/SV/DA/PT/PT-BR)
- [ ] E2E: core flows pass on iOS and Android
- [ ] Accessibility: VoiceOver + TalkBack automated checks
- [ ] Performance: message list 1000 items renders < 1sec
- [ ] Senior user testing: ≥ 80% task completion
- [ ] Store pre-submission checklist complete (both stores)
- [ ] No flaky tests (all tests deterministic)

## Collaboration

- **With ALL skills**: Receives testable code, provides test results
- **With accessibility-specialist**: Joint a11y test plan
- **With devops-specialist**: Tests run in CI/CD pipeline
- **With onboarding-recovery**: Test onboarding flow with senioren
