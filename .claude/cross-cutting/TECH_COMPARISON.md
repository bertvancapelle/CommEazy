# CommEazy Technology Comparison & Recommendations

**Version:** 1.0 | **Date:** 2026-02-07 | **Status:** Advisory

---

## 1. XMPP Client: Strophe.js vs xmpp.js

| Criteria | Strophe.js | xmpp.js (@xmpp/client) |
|----------|-----------|------------------------|
| Last major release | 2021 (v1.6.2) | 2024 (v0.13+) |
| Maintenance | Low activity | Active |
| TypeScript | Community @types | Native |
| WebSocket | Plugin | Built-in |
| Bundle size | ~45KB | ~35KB (modular) |
| Stream Management (XEP-0198) | Manual | Built-in |
| React Native | Proven | Good, some polyfills |

### Recommendation: **xmpp.js**
1. Active maintenance = security patches (critical for messaging app)
2. Native TypeScript = fewer bugs in strict mode
3. Built-in reconnection = critical for senioren switching wifi/cellular
4. Modular = smaller bundle
5. Modern async/await API

**Mitigatie bij behoud Strophe.js:** Pin version, monitor CVEs, create XMPPService abstraction layer, implement Stream Management manually.

**Migration effort:** ~11 days (Low-Medium risk)

---

## 2. Local Database: Realm vs Alternatives

| Criteria | Realm | WatermelonDB | op-sqlite (SQLite) |
|----------|-------|--------------|---------------------|
| Status | **Deprecated path*** | Active | Mature |
| Encryption at rest | AES-256 built-in | SQLCipher | SQLCipher |
| Offline-first | Yes | Designed for it | Manual |
| Reactive queries | Built-in | Built-in observable | Manual polling |
| Bundle size | ~3MB | ~1.5MB | ~1MB |
| Vendor lock-in | MongoDB | None | None |

*Realm Device SDK deprecated maart 2024 → Atlas Device SDK. Local-only mode still works but future uncertain.

### Recommendation: **WatermelonDB**
1. Designed for React Native offline-first (exact CommEazy use case)
2. No vendor lock-in (SQLite under the hood)
3. Lazy loading = better with 1000+ messages
4. Observable queries = reactive UI
5. No deprecation risk
6. SQLCipher encryption

**Mitigatie bij behoud Realm:** Create DatabaseService abstraction, monitor Atlas SDK announcements, prepare migration plan.

**Migration effort:** ~12 days (Low-Medium risk)

---

## 3. Encryption Dual-Path Performance Boundaries

### Encrypt-to-All (per member count, iPhone SE baseline)

| Members | Text (~1KB) | Photo (1MB) |
|---------|------------|-------------|
| 2 | ~2ms / 0.2KB payload | ~4ms / 2MB payload |
| 8 | ~8ms / 0.8KB payload | ~16ms / 8MB payload |
| 15 | ~15ms / 1.5KB payload | ~30ms / 15MB payload |
| 30 | ~30ms / 3KB payload | ~60ms / 30MB payload |

### Shared-Key (constant content encryption + key per member)

| Members | Text (~1KB) | Photo (1MB) |
|---------|------------|-------------|
| Any | ~8ms + 1ms/member | ~12ms + 1ms/member |
| 30 | ~38ms / 3.3KB | ~42ms / 1.23MB |

### Conclusie
- **Tekst**: encrypt-to-all performant tot ~20 leden
- **Foto's**: shared-key essentieel boven 3 leden (30MB vs 1.2MB payload bij 30 leden)
- **Threshold 8 is correct** als balans voor mixed content
- Future: overweeg dynamic threshold op basis van content type

---

## 4. Decision Summary

| Technology | Current | Recommended | Action |
|-----------|---------|-------------|--------|
| XMPP Client | Strophe.js | **xmpp.js** | Create abstraction, evaluate swap |
| Local DB | Realm | **WatermelonDB** | Create abstraction, evaluate swap |
| Encryption | Dual-path (8) | **Dual-path (8)** | Keep, document boundaries |

**CRITICAL**: Bouw ALTIJD een abstractielaag, ongeacht keuze:

```typescript
// Database abstraction
interface DatabaseService {
  saveMessage(msg: Message): Promise<void>;
  getMessages(chatId: string, limit: number): Observable<Message[]>;
  saveOutboxMessage(msg: OutboxMessage): Promise<void>;
}

// XMPP abstraction
interface XMPPService {
  connect(jid: string, password: string): Promise<void>;
  sendMessage(to: string, body: EncryptedPayload): Promise<void>;
  onMessage(handler: MessageHandler): Unsubscribe;
  joinMUC(roomJid: string): Promise<void>;
}
```
