# Implementatieplan: Country-Specific Module Framework

**Datum:** 2026-02-19
**Eerste implementatie:** nu.nl (Nederland)

---

## Overzicht

Dit plan beschrijft de implementatie van een country-specific module framework voor CommEazy.
Modules kunnen landspecifiek zijn en worden automatisch getoond aan gebruikers uit dat land,
terwijl gebruikers uit andere landen deze modules kunnen ontdekken en activeren via Instellingen.

---

## Architecturale Beslissingen (Samenvatting)

| Beslissing | Keuze |
|------------|-------|
| **Toegang andere landen** | Opt-in via Instellingen → Modules |
| **Menu positie** | Direct in WheelNavigationMenu |
| **Sortering** | Op gebruikstijd in afgelopen 24 uur |
| **Content presentatie** | Category ChipSelector |
| **Artikel weergave** | Safari View Controller + AdMob + TTS |
| **TTS strategie** | Hybrid (RSS summary + optioneel full extraction) |

---

## Fase 1: Foundation (Core Infrastructure)

### 1.1 Module Definition Interface

**Bestand:** `src/types/modules.ts`

```typescript
export interface CountryModuleDefinition {
  id: string;                           // 'nunl', 'nos', 'bbc', etc.
  countryCode: string;                  // 'NL', 'BE', 'GB', etc.
  labelKey: string;                     // i18n key: 'modules.nunl.title'
  icon: ModuleIconType;                 // Icon type for WheelNavigationMenu
  color: string;                        // Module accent color
  categories: ModuleCategory[];         // RSS categories
  rssBaseUrl: string;                   // Base URL for RSS feeds
  supportsFullTextExtraction: boolean;  // Can extract full article?
  contentLicense?: string;              // Attribution requirements
}

export interface ModuleCategory {
  id: string;                           // 'sport', 'tech', etc.
  labelKey: string;                     // i18n key
  rssPath: string;                      // Path appended to rssBaseUrl
  icon?: string;                        // Optional emoji icon
}

export interface EnabledModule {
  moduleId: string;
  enabledAt: number;                    // Timestamp
  isAutoEnabled: boolean;               // true if from user's country
}
```

**Complexiteit:** Laag
**Afhankelijkheden:** Geen

---

### 1.2 Module Registry

**Bestand:** `src/config/moduleRegistry.ts`

```typescript
import type { CountryModuleDefinition } from '@/types/modules';

export const COUNTRY_MODULES: CountryModuleDefinition[] = [
  {
    id: 'nunl',
    countryCode: 'NL',
    labelKey: 'modules.nunl.title',
    icon: 'news',
    color: '#E65100',  // nu.nl orange
    rssBaseUrl: 'https://www.nu.nl/rss',
    supportsFullTextExtraction: true,
    categories: [
      { id: 'algemeen', labelKey: 'modules.nunl.categories.algemeen', rssPath: '/Algemeen' },
      { id: 'sport', labelKey: 'modules.nunl.categories.sport', rssPath: '/Sport' },
      { id: 'tech', labelKey: 'modules.nunl.categories.tech', rssPath: '/Tech' },
      { id: 'economie', labelKey: 'modules.nunl.categories.economie', rssPath: '/Economie' },
      { id: 'film', labelKey: 'modules.nunl.categories.film', rssPath: '/Film' },
      { id: 'muziek', labelKey: 'modules.nunl.categories.muziek', rssPath: '/Muziek' },
      { id: 'wetenschap', labelKey: 'modules.nunl.categories.wetenschap', rssPath: '/Wetenschap' },
      { id: 'opmerkelijk', labelKey: 'modules.nunl.categories.opmerkelijk', rssPath: '/Opmerkelijk' },
      { id: 'achterklap', labelKey: 'modules.nunl.categories.achterklap', rssPath: '/Achterklap' },
    ],
  },
  // Future: NOS, RTL Nieuws, VRT, BBC, etc.
];

export function getModulesForCountry(countryCode: string): CountryModuleDefinition[] {
  return COUNTRY_MODULES.filter(m => m.countryCode === countryCode);
}

export function getModuleById(id: string): CountryModuleDefinition | undefined {
  return COUNTRY_MODULES.find(m => m.id === id);
}

export function getAllAvailableModules(): CountryModuleDefinition[] {
  return COUNTRY_MODULES;
}
```

**Complexiteit:** Laag
**Afhankelijkheden:** 1.1

---

### 1.3 Module Usage Service (24-uurs tracking)

**Bestand:** `src/services/moduleUsageService.ts`

Uitbreiding van bestaande `useModuleUsage` hook naar een service die:
- Tijd bijhoudt (niet alleen count)
- 24-uurs rolling window berekent
- Session tracking (start/stop tijd per module)

```typescript
export interface ModuleSession {
  moduleId: string;
  startedAt: number;     // Timestamp
  endedAt?: number;      // Timestamp (undefined if active)
}

export interface ModuleUsageData {
  sessions: ModuleSession[];
  // Sessions older than 24h worden automatisch opgeruimd
}

export class ModuleUsageService {
  private currentSession: ModuleSession | null = null;

  /** Start tracking time in a module */
  startSession(moduleId: string): void;

  /** End current session (call on navigate away) */
  endSession(): void;

  /** Get total time spent in module in last 24 hours (in seconds) */
  getUsageTime24h(moduleId: string): number;

  /** Get all modules sorted by 24h usage time (descending) */
  getModulesByUsage(): Array<{ moduleId: string; seconds: number }>;

  /** Cleanup old sessions (called periodically) */
  pruneOldSessions(): Promise<void>;
}
```

**Complexiteit:** Medium
**Afhankelijkheden:** 1.1, database service
**Test coverage:** Unit tests voor 24h berekening, session management

---

### 1.4 Module Config Context

**Bestand:** `src/contexts/ModuleConfigContext.tsx`

```typescript
interface ModuleConfigContextValue {
  /** All enabled modules for current user */
  enabledModules: EnabledModule[];

  /** Check if a module is enabled */
  isModuleEnabled: (moduleId: string) => boolean;

  /** Enable a module (opt-in from settings) */
  enableModule: (moduleId: string) => Promise<void>;

  /** Disable a module */
  disableModule: (moduleId: string) => Promise<void>;

  /** Get modules to show in WheelNavigationMenu (sorted by 24h usage) */
  getMenuModules: () => string[];

  /** User's country code from profile */
  userCountryCode: string | null;

  /** Loading state */
  isLoading: boolean;
}
```

**Complexiteit:** Medium
**Afhankelijkheden:** 1.1, 1.2, 1.3, UserProfile

---

## Fase 2: WheelNavigationMenu Integratie

### 2.1 Extend NavigationDestination Type

**Bestand:** `src/components/WheelNavigationMenu.tsx`

Uitbreiden van `NavigationDestination` type om dynamische module IDs te ondersteunen:

```typescript
// Bestaande static modules
export type StaticNavigationDestination =
  | 'chats' | 'contacts' | 'groups' | 'settings' | 'help'
  | 'calls' | 'videocall' | 'podcast' | 'radio' | 'books';

// Dynamic country modules
export type DynamicNavigationDestination = `module:${string}`;

// Combined type
export type NavigationDestination =
  | StaticNavigationDestination
  | DynamicNavigationDestination;
```

**Complexiteit:** Medium
**Afhankelijkheden:** 1.4

---

### 2.2 Dynamic Module Icons

**Bestand:** `src/components/WheelNavigationMenu.tsx`

Toevoegen van nieuwe icon types voor country modules:

```typescript
// Nieuwe icon type
type: 'news' | 'newspaper' | ...existing icons...

// In ModuleIcon component
case 'news':
  return (
    <View style={[styles.iconContainer, { width: size, height: size }]}>
      {/* Newspaper icon - folded paper with lines */}
      <View style={[styles.newsBody, { ... }]} />
      <View style={[styles.newsLine, { ... }]} />
      <View style={[styles.newsLine, { ... }]} />
    </View>
  );
```

**Complexiteit:** Laag
**Afhankelijkheden:** 2.1

---

### 2.3 24h Usage Sorting Integration

**Bestand:** `src/hooks/useModuleUsage.ts`

Refactoring om 24-uurs tijd-gebaseerde sortering te gebruiken:

```typescript
// Huidige: getTopModules sorted by count
// Nieuw: getTopModules sorted by 24h time

const getTopModules = useCallback((
  excludeModule: NavigationDestination | undefined,
  count: number
): NavigationDestination[] => {
  // Get enabled country modules
  const countryModules = moduleConfig.getMenuModules();

  // Combine with static modules
  const allModules = [...ALL_MODULES, ...countryModules];

  // Sort by 24h usage time
  const sorted = [...allModules].sort((a, b) => {
    const timeA = moduleUsageService.getUsageTime24h(a);
    const timeB = moduleUsageService.getUsageTime24h(b);
    return timeB - timeA;
  });

  return sorted.filter(m => m !== excludeModule).slice(0, count);
}, [moduleConfig, moduleUsageService]);
```

**Complexiteit:** Medium
**Afhankelijkheden:** 1.3, 1.4, 2.1

---

## Fase 3: News Service & RSS Parsing

### 3.1 News Service Interface

**Bestand:** `src/services/newsService.ts`

```typescript
export interface NewsArticle {
  id: string;
  title: string;
  description: string;           // RSS description (summary)
  link: string;                  // Article URL
  pubDate: Date;
  imageUrl?: string;
  category: string;
  moduleId: string;
}

export interface NewsServiceInterface {
  /** Fetch articles for a category */
  getArticles(moduleId: string, categoryId: string): Promise<NewsArticle[]>;

  /** Extract full article text (for TTS) */
  extractFullText(articleUrl: string): Promise<string | null>;

  /** Clear cache */
  clearCache(): Promise<void>;
}
```

**Complexiteit:** Medium
**Afhankelijkheden:** 1.1, 1.2

---

### 3.2 RSS Parser Implementation

**Bestand:** `src/services/newsService.ts`

```typescript
import { XMLParser } from 'fast-xml-parser';

async function parseRssFeed(url: string): Promise<NewsArticle[]> {
  const response = await fetch(url);
  const xml = await response.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  const result = parser.parse(xml);
  const items = result.rss?.channel?.item || [];

  return items.map((item: any) => ({
    id: item.guid || item.link,
    title: item.title,
    description: stripHtml(item.description),
    link: item.link,
    pubDate: new Date(item.pubDate),
    imageUrl: extractImageUrl(item),
    // ...
  }));
}
```

**NPM Dependency:** `fast-xml-parser`
**Complexiteit:** Medium
**Afhankelijkheden:** 3.1

---

### 3.3 Full Text Extraction (voor TTS)

**Bestand:** `src/services/newsService.ts`

```typescript
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

async function extractFullText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const html = await response.text();

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article?.textContent) {
      return cleanTextForTTS(article.textContent);
    }
    return null;
  } catch (error) {
    console.warn('[newsService] Full text extraction failed:', error);
    return null;
  }
}
```

**NPM Dependencies:** `@mozilla/readability`, `jsdom`
**Complexiteit:** Medium
**Afhankelijkheden:** 3.1

---

## Fase 4: ArticleViewer Component

### 4.1 Safari View Controller Wrapper

**Bestand:** `src/components/ArticleViewer.tsx`

```typescript
import { InAppBrowser } from 'react-native-inappbrowser-reborn';

interface ArticleViewerProps {
  visible: boolean;
  article: NewsArticle;
  onClose: () => void;
  accentColor: string;

  // TTS controls
  onStartTTS?: () => void;
  onStopTTS?: () => void;
  isTTSPlaying?: boolean;
  isTTSLoading?: boolean;

  // AdMob
  showAdMob?: boolean;
}

export function ArticleViewer({
  visible,
  article,
  onClose,
  accentColor,
  onStartTTS,
  onStopTTS,
  isTTSPlaying,
  isTTSLoading,
  showAdMob = true,
}: ArticleViewerProps) {
  // Custom modal wrapper around InAppBrowser
  // - AdMob banner at top
  // - TTS play/stop button
  // - Close button
  // - Safari View Controller content
}
```

**NPM Dependency:** `react-native-inappbrowser-reborn`
**Complexiteit:** Hoog
**Afhankelijkheden:** Geen

---

### 4.2 ArticleViewer Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Safe Area                                                    │
├──────────────────────────────────────────────────────────────┤
│  [X] Sluiten          [TTS 🔊/⏸]                             │
├──────────────────────────────────────────────────────────────┤
│  [═══════════ AdMob Banner ═══════════════════]              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│                 Safari View Controller                        │
│                    (article URL)                              │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**TTS Button States:**
- Idle: 🔊 "Voorlezen"
- Loading: ⏳ "Laden..."
- Playing: ⏸ "Pauze"

**Complexiteit:** Medium
**Afhankelijkheden:** 4.1

---

### 4.3 TTS Integration for Articles

**Bestand:** `src/hooks/useArticleTTS.ts`

```typescript
interface UseArticleTTSReturn {
  startTTS: (article: NewsArticle, useFullText: boolean) => Promise<void>;
  stopTTS: () => void;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;  // 0-1
  currentSentence: string;
}

export function useArticleTTS(): UseArticleTTSReturn {
  const { speak, stop, isPlaying } = useTTS();
  const newsService = useNewsService();

  const startTTS = async (article: NewsArticle, useFullText: boolean) => {
    let text = article.description;

    if (useFullText) {
      const fullText = await newsService.extractFullText(article.link);
      if (fullText) {
        text = fullText;
      }
    }

    speak(text);
  };

  // ...
}
```

**Complexiteit:** Medium
**Afhankelijkheden:** 3.3, bestaande TTS service

---

## Fase 5: News Module Screen (nu.nl)

### 5.1 NuNlScreen Component

**Bestand:** `src/screens/modules/NuNlScreen.tsx`

```typescript
export function NuNlScreen() {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState('algemeen');
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Module definition
  const module = getModuleById('nunl')!;

  // Category options for ChipSelector
  const categoryOptions: ChipOption[] = module.categories.map(cat => ({
    code: cat.id,
    icon: cat.icon || '📰',
    nativeName: t(cat.labelKey),
  }));

  return (
    <SafeAreaView style={styles.container}>
      <ModuleHeader
        moduleId="nunl"
        icon="news"
        title={t('modules.nunl.title')}
        showAdMob={true}
      />

      {/* Category selector */}
      <ChipSelector
        mode="language"  // Re-use language mode styling
        options={categoryOptions}
        selectedCode={selectedCategory}
        onSelect={handleCategoryChange}
        label={t('modules.nunl.category')}
      />

      {/* Article list */}
      <ScrollView style={styles.articleList}>
        {articles.map(article => (
          <ArticleCard
            key={article.id}
            article={article}
            onPress={() => setSelectedArticle(article)}
          />
        ))}
      </ScrollView>

      {/* Article viewer modal */}
      <ArticleViewer
        visible={selectedArticle !== null}
        article={selectedArticle!}
        onClose={() => setSelectedArticle(null)}
        accentColor={module.color}
        showAdMob={true}
      />
    </SafeAreaView>
  );
}
```

**Complexiteit:** Hoog
**Afhankelijkheden:** 3.1, 4.1, ChipSelector, ModuleHeader

---

### 5.2 ArticleCard Component

**Bestand:** `src/components/ArticleCard.tsx`

```typescript
interface ArticleCardProps {
  article: NewsArticle;
  onPress: () => void;
}

export function ArticleCard({ article, onPress }: ArticleCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={() => {}}  // Block double-action
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={article.title}
    >
      {article.imageUrl && (
        <Image source={{ uri: article.imageUrl }} style={styles.image} />
      )}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={styles.description} numberOfLines={3}>
          {article.description}
        </Text>
        <Text style={styles.date}>
          {formatRelativeDate(article.pubDate)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
```

**Complexiteit:** Laag
**Afhankelijkheden:** Geen

---

## Fase 6: Settings Integration

### 6.1 ModulesSettingsScreen

**Bestand:** `src/screens/settings/ModulesSettingsScreen.tsx`

```typescript
export function ModulesSettingsScreen() {
  const { t } = useTranslation();
  const { enabledModules, enableModule, disableModule, userCountryCode } = useModuleConfig();

  // Group modules by country
  const modulesByCountry = useMemo(() => {
    const groups: Record<string, CountryModuleDefinition[]> = {};

    for (const module of getAllAvailableModules()) {
      if (!groups[module.countryCode]) {
        groups[module.countryCode] = [];
      }
      groups[module.countryCode].push(module);
    }

    return groups;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t('settings.modules.title')}</Text>
      <Text style={styles.subtitle}>{t('settings.modules.subtitle')}</Text>

      <ScrollView>
        {Object.entries(modulesByCountry).map(([countryCode, modules]) => (
          <View key={countryCode}>
            <Text style={styles.countryHeader}>
              {getCountryFlag(countryCode)} {getCountryName(countryCode)}
            </Text>

            {modules.map(module => {
              const isEnabled = enabledModules.some(e => e.moduleId === module.id);
              const isFromUserCountry = countryCode === userCountryCode;

              return (
                <ModuleToggleRow
                  key={module.id}
                  module={module}
                  isEnabled={isEnabled}
                  isFromUserCountry={isFromUserCountry}
                  onToggle={() => {
                    if (isEnabled) {
                      disableModule(module.id);
                    } else {
                      enableModule(module.id);
                    }
                  }}
                />
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
```

**Complexiteit:** Medium
**Afhankelijkheden:** 1.4

---

### 6.2 Navigation to ModulesSettingsScreen

**Bestand:** `src/screens/settings/SettingsMainScreen.tsx`

Toevoegen van menu item naar ModulesSettingsScreen:

```typescript
{
  label: t('settings.modules.title'),
  icon: 'apps',
  onPress: () => navigation.navigate('ModulesSettings'),
}
```

**Complexiteit:** Laag
**Afhankelijkheden:** 6.1

---

## Fase 7: i18n & Localization

### 7.1 Translation Keys

**Bestanden:** `src/locales/*.json`

```json
// nl.json
{
  "modules": {
    "nunl": {
      "title": "nu.nl Nieuws",
      "category": "Categorie",
      "categories": {
        "algemeen": "Algemeen",
        "sport": "Sport",
        "tech": "Tech",
        "economie": "Economie",
        "film": "Film",
        "muziek": "Muziek",
        "wetenschap": "Wetenschap",
        "opmerkelijk": "Opmerkelijk",
        "achterklap": "Achterklap"
      }
    }
  },
  "settings": {
    "modules": {
      "title": "Modules",
      "subtitle": "Kies welke modules je wilt gebruiken",
      "fromYourCountry": "Beschikbaar voor jouw land",
      "otherCountries": "Andere landen"
    }
  },
  "articleViewer": {
    "readAloud": "Voorlezen",
    "pause": "Pauze",
    "loading": "Laden...",
    "close": "Sluiten",
    "readFullArticle": "Volledig artikel voorlezen",
    "readSummary": "Samenvatting voorlezen"
  }
}
```

**Alle 5 talen:** NL, EN, DE, FR, ES

**Complexiteit:** Medium (vertaalwerk)
**Afhankelijkheden:** Geen

---

## Implementatie Volgorde

```
Week 1: Foundation
├── Dag 1-2: Types & Registry (1.1, 1.2)
├── Dag 3-4: ModuleUsageService (1.3)
└── Dag 5: ModuleConfigContext (1.4)

Week 2: Menu Integration
├── Dag 1-2: WheelNavigationMenu uitbreiding (2.1, 2.2)
└── Dag 3-5: 24h usage sorting (2.3)

Week 3: News Service
├── Dag 1-2: RSS parsing (3.1, 3.2)
└── Dag 3-5: Full text extraction (3.3)

Week 4: ArticleViewer
├── Dag 1-3: Safari VC wrapper + AdMob (4.1, 4.2)
└── Dag 4-5: TTS integration (4.3)

Week 5: NuNl Screen
├── Dag 1-3: NuNlScreen + ArticleCard (5.1, 5.2)
└── Dag 4-5: Testing & polish

Week 6: Settings & i18n
├── Dag 1-2: ModulesSettingsScreen (6.1, 6.2)
├── Dag 3-4: i18n alle 5 talen (7.1)
└── Dag 5: Final testing
```

---

## NPM Dependencies

| Package | Versie | Doel |
|---------|--------|------|
| `fast-xml-parser` | ^4.x | RSS XML parsing |
| `@mozilla/readability` | ^0.5.x | Article text extraction |
| `jsdom` | ^24.x | DOM parsing for Readability |
| `react-native-inappbrowser-reborn` | ^3.x | Safari View Controller |

---

## Database Changes

### UserProfile Uitbreiding

```typescript
interface UserProfile {
  // Bestaande velden...

  // Nieuw
  enabledModules?: EnabledModule[];
  moduleSessions?: ModuleSession[];  // 24h tracking
}
```

---

## Validatie Checklist (per COORDINATION_PROTOCOL)

### Betrokken Skills

- [x] **architecture-lead** — Module framework design
- [x] **ui-designer** — ArticleViewer, ArticleCard, ChipSelector reuse
- [x] **accessibility-specialist** — VoiceFocusable artikelen, TTS controls
- [x] **react-native-expert** — Safari VC integratie, RSS parsing
- [x] **ios-specialist** — Safari View Controller
- [x] **android-specialist** — Chrome Custom Tabs equivalent
- [x] **security-expert** — External URL handling, content extraction
- [x] **performance-optimizer** — RSS caching, 24h session cleanup
- [x] **testing-qa** — Unit tests, integration tests

### Quality Gates

- [ ] Senior-inclusive UI (60pt touch targets, 18pt text)
- [ ] VoiceOver/TalkBack volledig ondersteund
- [ ] Alle 5 talen vertaald
- [ ] AdMob correct geïntegreerd
- [ ] 24h usage correct berekend
- [ ] RSS caching voor offline support
- [ ] TTS werkt met summary en full text
- [ ] Safari VC/Chrome Custom Tabs werkt op beide platforms

---

## Risico's & Mitigaties

| Risico | Impact | Mitigatie |
|--------|--------|-----------|
| nu.nl RSS feed wijzigt | Hoog | Robust parsing, fallbacks, monitoring |
| Full text extraction faalt | Medium | Graceful fallback naar RSS summary |
| Safari VC niet beschikbaar | Laag | Fallback naar WebView |
| JSDOM te zwaar voor mobile | Medium | Server-side extraction als alternatief |

---

## Future Extensions

Na succesvolle implementatie van nu.nl:

1. **NOS Nieuws** (Nederland)
2. **RTL Nieuws** (Nederland)
3. **VRT NWS** (België)
4. **BBC News** (UK)
5. **Tagesschau** (Duitsland)
6. **France Info** (Frankrijk)
7. **RTVE** (Spanje)

Elk nieuw module vereist alleen:
- Entry in `moduleRegistry.ts`
- i18n keys voor categorieën
- Eventueel aangepaste text extraction rules

---

## Conclusie

Dit implementatieplan biedt een schaalbare architectuur voor country-specific modules.
De nu.nl implementatie dient als proof-of-concept en template voor toekomstige modules.

**Start:** Fase 1 (Foundation)
**Eerste milestone:** nu.nl module werkend met category selectie
**Volledige implementatie:** 6 weken
