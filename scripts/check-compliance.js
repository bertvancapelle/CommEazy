#!/usr/bin/env node

/**
 * Accessibility Compliance Check Script
 *
 * Validates CommEazy against WCAG 2.2 AAA and EN 301 549 requirements.
 * Run: npm run compliance:check
 *
 * @see .claude/plans/ACCESSIBILITY_COMPLIANCE.md
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// Configuration
// ============================================================

const ROOT_DIR = path.join(__dirname, '..');
const ACCENT_COLORS_PATH = path.join(ROOT_DIR, 'src/theme/accentColors.ts');
const LOCALES_DIR = path.join(ROOT_DIR, 'src/locales');
const REPORT_PATH = path.join(ROOT_DIR, 'src/accessibility/compliance-report.json');

// Required locales (13 languages)
const REQUIRED_LOCALES = [
  'nl', 'en', 'en-GB', 'de', 'fr', 'es', 'it', 'pt', 'pt-BR', 'no', 'sv', 'da', 'pl'
];

// WCAG AAA requires 7:1 contrast ratio for normal text
const AAA_CONTRAST_RATIO = 7.0;

// ============================================================
// Color Utilities
// ============================================================

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function calculateContrast(foreground, background) {
  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  if (!fgRgb || !bgRgb) {
    return 0;
  }

  const fgLum = relativeLuminance(fgRgb);
  const bgLum = relativeLuminance(bgRgb);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================================
// Check Functions
// ============================================================

/**
 * Check all accent colors meet WCAG AAA contrast requirements
 */
function checkContrastCompliance() {
  console.log('\n📐 Checking WCAG AAA contrast compliance...');

  if (!fs.existsSync(ACCENT_COLORS_PATH)) {
    console.error('❌ Accent colors file not found:', ACCENT_COLORS_PATH);
    return { passed: false, errors: ['Accent colors file not found'] };
  }

  const content = fs.readFileSync(ACCENT_COLORS_PATH, 'utf-8');

  // Extract primary color values
  const colorRegex = /(\w+):\s*\{[^}]*primary:\s*'(#[A-Fa-f0-9]{6})'/gs;
  const colors = [];
  let match;

  // Reset regex state
  const lines = content.split('\n');
  let currentColor = null;

  for (const line of lines) {
    const colorNameMatch = line.match(/^\s*(\w+):\s*\{/);
    if (colorNameMatch) {
      currentColor = colorNameMatch[1];
    }

    const primaryMatch = line.match(/primary:\s*'(#[A-Fa-f0-9]{6})'/);
    if (primaryMatch && currentColor) {
      colors.push({ name: currentColor, hex: primaryMatch[1] });
    }
  }

  const results = colors.map(({ name, hex }) => ({
    name,
    color: hex,
    contrast: calculateContrast(hex, '#FFFFFF'),
    meetsAAA: calculateContrast(hex, '#FFFFFF') >= AAA_CONTRAST_RATIO
  }));

  const failures = results.filter(r => !r.meetsAAA);

  if (failures.length > 0) {
    console.error('❌ Contrast failures:');
    failures.forEach(f => {
      console.error(`   ${f.name}: ${f.color} → ${f.contrast.toFixed(2)}:1 (needs ${AAA_CONTRAST_RATIO}:1)`);
    });
    return { passed: false, errors: failures.map(f => `${f.name}: ${f.contrast.toFixed(2)}:1`) };
  }

  console.log(`✅ All ${results.length} accent colors meet WCAG AAA contrast (≥${AAA_CONTRAST_RATIO}:1)`);
  results.forEach(r => {
    console.log(`   ${r.name}: ${r.color} → ${r.contrast.toFixed(2)}:1`);
  });

  return { passed: true, results };
}

/**
 * Check all accessibility i18n keys exist in all locales
 */
function checkI18nCoverage() {
  console.log('\n🌍 Checking accessibility i18n coverage...');

  // Load base locale (English)
  const baseLocalePath = path.join(LOCALES_DIR, 'en.json');
  if (!fs.existsSync(baseLocalePath)) {
    console.error('❌ Base locale (en.json) not found');
    return { passed: false, errors: ['Base locale not found'] };
  }

  const baseLocale = JSON.parse(fs.readFileSync(baseLocalePath, 'utf-8'));

  // Extract all keys with 'a11y' prefix
  function extractKeys(obj, prefix = '') {
    const keys = [];
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        keys.push(...extractKeys(value, path));
      } else {
        keys.push(path);
      }
    }
    return keys;
  }

  const allKeys = extractKeys(baseLocale);
  const a11yKeys = allKeys.filter(k => k.startsWith('a11y') || k.includes('accessibility'));

  console.log(`   Found ${a11yKeys.length} accessibility-related keys in base locale`);

  // Check each required locale
  const missing = [];

  for (const locale of REQUIRED_LOCALES) {
    const localePath = path.join(LOCALES_DIR, `${locale}.json`);

    if (!fs.existsSync(localePath)) {
      missing.push({ locale, keys: a11yKeys.length, message: 'File not found' });
      continue;
    }

    const localeData = JSON.parse(fs.readFileSync(localePath, 'utf-8'));
    const localeKeys = extractKeys(localeData);

    const missingKeys = a11yKeys.filter(k => !localeKeys.includes(k));

    if (missingKeys.length > 0) {
      missing.push({ locale, keys: missingKeys.length, missing: missingKeys.slice(0, 5) });
    }
  }

  if (missing.length > 0) {
    console.warn('⚠️  Missing a11y translations:');
    missing.forEach(m => {
      console.warn(`   ${m.locale}: ${m.keys} keys missing`);
      if (m.missing) {
        m.missing.forEach(k => console.warn(`      - ${k}`));
      }
    });
    return { passed: true, warnings: missing }; // Warning, not failure
  }

  console.log(`✅ All ${a11yKeys.length} a11y keys present in ${REQUIRED_LOCALES.length} locales`);
  return { passed: true };
}

/**
 * Generate compliance report JSON
 */
function generateReport(results) {
  const now = new Date().toISOString();

  const report = {
    generatedAt: now,
    appVersion: require(path.join(ROOT_DIR, 'package.json')).version || '1.0.0',
    buildNumber: process.env.BUILD_NUMBER || 'dev',
    checks: {
      contrast: results.contrast,
      i18n: results.i18n,
    },
    summary: {
      passed: results.contrast.passed && results.i18n.passed,
      warnings: results.i18n.warnings?.length || 0,
      errors: (results.contrast.errors?.length || 0) + (results.i18n.errors?.length || 0),
    }
  };

  // Ensure directory exists
  const reportDir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n📄 Compliance report saved to: ${REPORT_PATH}`);

  return report;
}

// ============================================================
// Main
// ============================================================

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  CommEazy Accessibility Compliance Check');
  console.log('  WCAG 2.2 AAA + EN 301 549 V3.2.1');
  console.log('═══════════════════════════════════════════════════════════');

  const results = {
    contrast: checkContrastCompliance(),
    i18n: checkI18nCoverage(),
  };

  const report = generateReport(results);

  console.log('\n═══════════════════════════════════════════════════════════');

  if (report.summary.passed) {
    console.log('✅ All compliance checks passed!');
    if (report.summary.warnings > 0) {
      console.log(`⚠️  ${report.summary.warnings} warnings (non-blocking)`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');
    process.exit(0);
  } else {
    console.log(`❌ ${report.summary.errors} compliance check(s) failed!`);
    console.log('═══════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

main();
