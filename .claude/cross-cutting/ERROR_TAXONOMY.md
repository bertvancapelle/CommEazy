# CommEazy Error Taxonomy & Senior-Friendly Recovery

**Version:** 1.0 | **Date:** 2026-02-07

---

## Error Categories

### E1xx — Network Errors

| Code | Trigger | Recovery |
|------|---------|----------|
| E100 | No internet | Auto-retry when online, queue in outbox |
| E101 | XMPP disconnect | Auto-reconnect (exponential backoff) |
| E102 | XMPP timeout | Retry 3x, then show offline mode |
| E103 | WebRTC connection failed | Retry, suggest wifi, offer audio-only fallback |

**User Messages (E100 - No Internet):**
| Lang | Message |
|------|---------|
| NL | "Geen internetverbinding. Je bericht wordt verstuurd zodra je weer online bent." |
| EN | "No internet connection. Your message will be sent when you're back online." |
| DE | "Keine Internetverbindung. Ihre Nachricht wird gesendet, sobald Sie wieder online sind." |
| FR | "Pas de connexion internet. Votre message sera envoyé dès que vous serez reconnecté." |
| ES | "Sin conexión a internet. Tu mensaje se enviará cuando vuelvas a estar en línea." |

### E2xx — Encryption Errors

| Code | Trigger | Recovery |
|------|---------|----------|
| E200 | Encryption failed | Retry with fresh nonce, do NOT send plaintext |
| E201 | Decryption failed | Request re-send from sender |
| E202 | Key not found | Trigger key exchange |
| E203 | Key verification failed | Show warning, suggest QR re-verify |

**User Messages (E200 - Encryption Failed):**
| Lang | Message |
|------|---------|
| NL | "Bericht kon niet beveiligd worden. Probeer het opnieuw." |
| EN | "Message could not be secured. Please try again." |
| DE | "Nachricht konnte nicht gesichert werden. Bitte versuchen Sie es erneut." |
| FR | "Le message n'a pas pu être sécurisé. Veuillez réessayer." |
| ES | "El mensaje no pudo ser asegurado. Inténtalo de nuevo." |

### E3xx — Message Delivery Errors

| Code | Trigger | Recovery |
|------|---------|----------|
| E300 | Send failed (server) | Queue in outbox, auto-retry |
| E301 | Recipient offline | Store in outbox (7 days) |
| E302 | Group member left | Update member list, skip delivery |
| E303 | Outbox full | Warn user, offer cleanup of oldest |
| E304 | Message expired (7 days) | Notify sender, remove from outbox |

**User Messages (E301 - Recipient Offline):**
| Lang | Message |
|------|---------|
| NL | "Jan is nu niet online. Je bericht wordt bewaard en verstuurd zodra Jan weer online komt (maximaal 7 dagen)." |
| EN | "Jan is not online right now. Your message is saved and will be sent when Jan comes back online (up to 7 days)." |
| DE | "Jan ist gerade nicht online. Ihre Nachricht wird gespeichert und gesendet, sobald Jan wieder online ist (bis zu 7 Tage)." |
| FR | "Jan n'est pas en ligne pour le moment. Votre message est sauvegardé et sera envoyé quand Jan sera de retour en ligne (jusqu'à 7 jours)." |
| ES | "Jan no está en línea ahora. Tu mensaje se guardará y se enviará cuando Jan vuelva a estar en línea (hasta 7 días)." |

### E4xx — Media Errors

| Code | Trigger | Recovery |
|------|---------|----------|
| E400 | Photo too large | Auto-compress, inform user |
| E401 | Camera permission denied | Show settings instruction |
| E402 | Microphone permission denied | Show settings instruction |
| E403 | Photo upload failed | Retry, show progress |

**User Messages (E401 - Camera Permission):**
| Lang | Message |
|------|---------|
| NL | "CommEazy heeft toegang tot je camera nodig. Ga naar Instellingen → CommEazy → Camera en zet deze aan." |
| EN | "CommEazy needs access to your camera. Go to Settings → CommEazy → Camera and turn it on." |
| DE | "CommEazy benötigt Zugriff auf Ihre Kamera. Gehen Sie zu Einstellungen → CommEazy → Kamera und aktivieren Sie diese." |
| FR | "CommEazy a besoin d'accéder à votre appareil photo. Allez dans Réglages → CommEazy → Appareil photo et activez-le." |
| ES | "CommEazy necesita acceso a tu cámara. Ve a Ajustes → CommEazy → Cámara y actívala." |

### E5xx — Authentication Errors

| Code | Trigger | Recovery |
|------|---------|----------|
| E500 | Phone verification failed | Retry, offer voice call alternative |
| E501 | Session expired | Auto re-authenticate |
| E502 | Account not found | Guide to registration |

### E6xx — Storage Errors

| Code | Trigger | Recovery |
|------|---------|----------|
| E600 | Database corrupt | Restore from backup, clear cache |
| E601 | Storage full | Warn user, offer cleanup |
| E602 | Migration failed | Rollback, report |

---

## Design Principles for Error Messages

1. **Explain WHAT happened** in plain language (no error codes shown to user)
2. **Explain WHAT TO DO** — always one clear action
3. **Reassure** — "your message is saved" / "we'll try again automatically"
4. **Never blame** the user — "Connection lost" not "You disconnected"
5. **Never show technical details** — no stack traces, no HTTP codes
6. **Use the contact's name** when relevant (personalization)
7. **Offer a way out** — always a button to dismiss, retry, or get help

## Implementation Pattern

```typescript
// i18n key structure
// errors.{category}.{code}.message
// errors.{category}.{code}.action

// Example usage
import { useTranslation } from 'react-i18next';

function ErrorBanner({ error }: { error: AppError }) {
  const { t } = useTranslation();
  
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>
        {t(`errors.${error.category}.${error.code}.message`, {
          contactName: error.context?.contactName
        })}
      </Text>
      <LargeButton
        title={t(`errors.${error.category}.${error.code}.action`)}
        onPress={error.recovery}
      />
    </View>
  );
}
```
