# FlatList Rehabilitatie Plan

> **Aangemaakt:** 2026-03-13
> **Status:** Klaar voor implementatie
> **Aanleiding:** React Native 0.84.1 (Hermes V1) lost de FlatList `getItem undefined` bug op
> **Getest:** iPhone 14 Pro Max, iOS 26.4 beta — geen crashes

---

## Samenvatting

68 bestanden in de CommEazy codebase gebruiken `ScrollView + .map()` als workaround voor een FlatList crash in RN 0.73 + Hermes V0. Nu RN 0.84 (Hermes V1) de bug oplost, kunnen deze terug gemigreerd worden naar FlatList voor betere performance, geheugenefficiency en accessibility.

---

## Waarom Migreren?

| Aspect | ScrollView + .map() | FlatList |
|--------|---------------------|---------|
| **Rendering** | Alle items tegelijk | Alleen zichtbare items (virtualisatie) |
| **Geheugen** | Hoog bij >50 items | Constant, ongeacht lijstgrootte |
| **Scroll FPS** | Verlaagd bij lange lijsten | 60fps door recycling |
| **Accessibility** | Alle items in DOM | Lazy accessibility tree |
| **Pull-to-refresh** | Handmatig implementeren | `RefreshControl` prop |

---

## Migratiepatroon

### Voor (ScrollView + .map())
```typescript
<ScrollView>
  {items.map((item, index) => (
    <ItemComponent key={item.id} item={item} />
  ))}
</ScrollView>
```

### Na (FlatList)
```typescript
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemComponent item={item} />}
  // Optioneel:
  initialNumToRender={15}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

### Aandachtspunten per migratie
- **VoiceFocusable wrappers** moeten behouden blijven
- **HoldToNavigateWrapper** moet buiten FlatList blijven (niet in renderItem)
- **Sticky headers** → gebruik `stickyHeaderIndices` of `SectionList`
- **RefreshControl** → verplaats naar FlatList `refreshControl` prop
- **Inverted lists** (ChatScreen) → `inverted={true}` prop
- **Dynamic bottom padding** (MiniPlayer) → `contentContainerStyle` of `ListFooterComponent`

---

## Fasering

### Fase 1: Core Screens (21 bestanden) — Hoogste prioriteit

Schermen met de meeste items en hoogste gebruiksfrequentie.

| # | Bestand | Items | Complexiteit |
|---|---------|-------|-------------|
| 1 | `screens/chat/ChatListScreen.tsx` | ~100+ | Complex — RefreshControl, voice focus, presence |
| 2 | `screens/chat/ChatScreen.tsx` | ~50 | Complex — inverted, RefreshControl, message rendering |
| 3 | `screens/contacts/ContactListScreen.tsx` | ~200+ | Complex — SearchBar, chips, voice focus |
| 4 | `screens/group/GroupListScreen.tsx` | ~100+ | Complex — RefreshControl, voice focus |
| 5 | `screens/modules/RadioScreen.tsx` | ~50+ | Complex — tabs, ChipSelector, MiniPlayer |
| 6 | `screens/modules/PodcastScreen.tsx` | ~50+ | Complex — tabs, ChipSelector, MiniPlayer |
| 7 | `screens/modules/AppleMusicScreen.tsx` | ~50+ | Complex — catalog, playlists, MiniPlayer |
| 8 | `screens/modules/PhotoAlbumScreen.tsx` | ~50+ | Complex — grid/list, thumbnails |
| 9 | `screens/modules/AgendaScreen.tsx` | ~50+ | Complex — timeline, categories |
| 10 | `screens/modules/CallsScreen.tsx` | ~50+ | Complex — call history |
| 11 | `screens/modules/BookPlayerScreen.tsx` | ~50+ | Complex — chapters, bookmarks |
| 12 | `screens/modules/AgendaItemDetailScreen.tsx` | ~50+ | Complex — event details |
| 13 | `screens/modules/AgendaItemFormScreen.tsx` | ~50+ | Complex — event form |
| 14 | `screens/mail/MailComposeScreen.tsx` | ~50+ | Complex — recipient picker |
| 15 | `screens/mail/MailInboxScreen.tsx` | ~50+ | Complex — inbox list |
| 16 | `screens/mail/MailDetailScreen.tsx` | ~50+ | Complex — message thread |
| 17 | `screens/contacts/ManualAddContactScreen.tsx` | ~50+ | Complex — form + suggestions |
| 18 | `screens/contacts/ContactDetailScreen.tsx` | ~50+ | Complex — detail + related |
| 19 | `screens/contacts/AddContactScreen.tsx` | ~50+ | Complex — wizard |
| 20 | `screens/contacts/CreateGroupModal.tsx` | ~50+ | Complex — contact picker |
| 21 | `screens/contacts/EditGroupModal.tsx` | ~50+ | Complex — member editor |

### Fase 2: Module Screens & Modals (17 bestanden) — Medium prioriteit

| # | Bestand | Items | Complexiteit |
|---|---------|-------|-------------|
| 1 | `screens/modules/BooksScreen.tsx` | ~10 | Complex |
| 2 | `screens/modules/AskAIScreen.tsx` | ~10 | Complex |
| 3 | `screens/modules/NuNlScreen.tsx` | ~10 | Complex |
| 4 | `screens/modules/WeatherScreen.tsx` | ~10 | Complex |
| 5 | `screens/HomeScreen.tsx` | ~10 | Complex |
| 6 | `screens/onboarding/LanguageSelectScreen.tsx` | ~13 | Complex |
| 7 | `screens/onboarding/DemographicsScreen.tsx` | ~10 | Complex |
| 8 | `screens/group/CreateGroupScreen.tsx` | ~50 | Simple |
| 9 | `components/ContactSelectionModal.tsx` | ~50+ | Complex |
| 10 | `components/PhotoRecipientModal.tsx` | ~50+ | Complex |
| 11 | `components/mail/ContactPickerModal.tsx` | ~50+ | Complex |
| 12 | `components/appleMusic/AppleMusicDetailModal.tsx` | ~50 | Complex |
| 13 | `components/mail/BulkSaveSheet.tsx` | ~10 | Complex |
| 14 | `components/QueueView.tsx` | ~10 | Complex |
| 15 | `components/DevModePanel.tsx` | ~50 | Complex |
| 16 | `components/ContactGroupChipBar.tsx` | ~50 | Complex |
| 17 | `components/MusicCollectionChipBar.tsx` | ~10 | Complex |

### Fase 3: Settings & Utility (30 bestanden) — Lage prioriteit

| # | Bestand | Items |
|---|---------|-------|
| 1 | `screens/settings/SettingsMainScreen.tsx` | ~10 |
| 2 | `screens/settings/AccessibilitySettingsScreen.tsx` | ~10 |
| 3 | `screens/settings/AppearanceSettingsScreen.tsx` | ~10 |
| 4 | `screens/settings/CallSettingsScreen.tsx` | ~10 |
| 5 | `screens/settings/VoiceSettingsScreen.tsx` | ~10 |
| 6 | `screens/settings/MailSettingsScreen.tsx` | ~10 |
| 7 | `screens/settings/AppleMusicSettingsScreen.tsx` | ~10 |
| 8 | `screens/settings/ModulesSettingsScreen.tsx` | ~10 |
| 9 | `screens/settings/ProfileSettingsScreen.tsx` | ~10 |
| 10 | `screens/settings/PickerModal.tsx` | ~10 |
| 11 | `screens/settings/CityPickerModal.tsx` | ~10 |
| 12 | `screens/settings/ComplianceReportScreen.tsx` | ~10 |
| 13 | `screens/mail/MailOnboardingStep1.tsx` | ~10 |
| 14 | `screens/mail/MailOnboardingStep2.tsx` | ~10 |
| 15 | `screens/mail/MailOnboardingStep3.tsx` | ~10 |
| 16 | `components/navigation/ModulePickerModal.tsx` | ~10 |
| 17 | `components/navigation/Sidebar.tsx` | ~10 |
| 18 | `components/modules/MenuModule.tsx` | ~10 |
| 19 | `components/askAI/AskAIHistoryModal.tsx` | ~10 |
| 20 | `components/mail/AlbumPickerModal.tsx` | ~10 |
| 21 | `components/mail/AttachmentPreviewBar.tsx` | ~10 |
| 22 | `components/mail/RecipientInput.tsx` | ~50 |
| 23 | `components/SeniorDatePicker.tsx` | ~50 |
| 24 | `screens/modules/PlaylistBrowserModal.tsx` | ~10 |
| 25 | `screens/modules/SongCollectionModal.tsx` | ~10 |
| 26 | `screens/modules/BookReaderScreen.tsx` | ~10 |
| 27 | `screens/dev/PiperTtsTestScreen.tsx` | ~10 |
| 28 | `components/ChipSelector.tsx` | ~10 |
| 29 | `contexts/VoiceFocusContext.tsx` | ~50 |
| 30 | `screens/group/GroupDetailScreen.tsx` | ~10 |

---

## Beslissing: FlatList vs FlashList

| Criterium | FlatList | @shopify/flash-list |
|-----------|---------|---------------------|
| **Dependency** | Built-in (geen extra dep) | Externe dependency |
| **Performance** | Goed voor <500 items | Beter voor >500 items |
| **API** | Standaard RN | Bijna identiek (drop-in) |
| **Maintenance** | Meta onderhouden | Shopify onderhouden |
| **CommEazy use case** | Lijsten <200 items | Overkill |

**Besluit:** Gebruik standaard FlatList. CommEazy heeft geen lijsten >500 items. FlashList toevoegen introduceert een externe dependency zonder noodzaak.

---

## Settings Screens Uitzondering

Settings screens (Fase 3, #1-12) hebben typisch <15 items en zijn geen echte "lijsten" — het zijn formulieren met toggle-rijen. Voor deze schermen is FlatList migratie optioneel. ScrollView is acceptabel voor statische content met weinig items.

**Aanbeveling:** Settings screens NIET migreren naar FlatList. Ze blijven op ScrollView. Focus de refactoring op echte data-driven lijsten (Fase 1 en 2).

---

## Validatie per Migratie

Na elke bestandsmigratie:

1. **Build check:** `⌘B` — geen compile errors
2. **Visuele check:** Scherm ziet er identiek uit
3. **Scroll check:** Smooth scrolling, geen jank
4. **VoiceFocus check:** Voice navigatie werkt nog
5. **Pull-to-refresh check:** RefreshControl werkt (indien aanwezig)
6. **MiniPlayer check:** Dynamic bottom padding correct (indien audio module)
7. **Memory check:** Geen geheugentoename bij scrollen

---

## Totaal Overzicht

| Fase | Bestanden | Prioriteit | Status |
|------|-----------|------------|--------|
| **Fase 1** | 21 | Hoog | ⏳ TODO |
| **Fase 2** | 17 | Medium | ⏳ TODO |
| **Fase 3** | 30 (waarvan ~12 SKIP) | Laag | ⏳ TODO |
| **Totaal te migreren** | ~56 | — | — |
| **Settings (SKIP)** | ~12 | N/A | Blijft ScrollView |
