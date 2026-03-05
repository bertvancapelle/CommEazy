#!/bin/bash
#
# validate-components.sh — Component Registry & Touch Target Validation
#
# Checks that all screens use standardized components and meet
# senior-inclusive touch target requirements.
#
# Usage:
#   ./scripts/validate-components.sh          # Full report
#   ./scripts/validate-components.sh --strict # Exit 1 on any violation
#
# Checks:
# 1. ModuleHeader adoption (module screens must use ModuleHeader)
# 2. PanelAwareModal adoption (no raw Modal usage)
# 3. LoadingView adoption (no bare ActivityIndicator)
# 4. HapticTouchable adoption (no raw TouchableOpacity)
# 5. ErrorView adoption (no Alert.alert for errors)
# 6. Touch target linting (no sub-60pt values)

set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")/../src" && pwd)"
STRICT="${1:-}"

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

VIOLATIONS=0
WARNINGS=0

header() {
  echo ""
  echo -e "${CYAN}${BOLD}═══ $1 ═══${NC}"
}

violation() {
  echo -e "  ${RED}❌ $1${NC}"
  VIOLATIONS=$((VIOLATIONS + 1))
}

warning() {
  echo -e "  ${YELLOW}⚠️  $1${NC}"
  WARNINGS=$((WARNINGS + 1))
}

ok() {
  echo -e "  ${GREEN}✅ $1${NC}"
}

# ============================================================
# 1. ModuleHeader Adoption
# ============================================================
header "1. ModuleHeader Adoption"

# Module screens that MUST use ModuleHeader
MODULE_SCREENS=(
  "screens/modules/RadioScreen.tsx"
  "screens/modules/PodcastScreen.tsx"
  "screens/modules/BooksScreen.tsx"
  "screens/modules/BookPlayerScreen.tsx"
  "screens/modules/AppleMusicScreen.tsx"
  "screens/modules/WeatherScreen.tsx"
  "screens/modules/NunlScreen.tsx"
  "screens/modules/BuienradarScreen.tsx"
  "screens/chat/ChatListScreen.tsx"
  "screens/contacts/ContactListScreen.tsx"
  "screens/settings/SettingsMainScreen.tsx"
)

for screen in "${MODULE_SCREENS[@]}"; do
  filepath="$SRC_DIR/$screen"
  if [ -f "$filepath" ]; then
    if grep -q "ModuleHeader" "$filepath"; then
      ok "$screen — uses ModuleHeader"
    else
      violation "$screen — MISSING ModuleHeader"
    fi
  fi
done

# ============================================================
# 2. PanelAwareModal Adoption
# ============================================================
header "2. PanelAwareModal Adoption (no raw Modal)"

# Find files using Modal from react-native (should use PanelAwareModal instead)
RAW_MODAL_FILES=$(grep -rl "import.*{.*Modal.*}.*from 'react-native'" "$SRC_DIR/screens/" "$SRC_DIR/components/" 2>/dev/null | grep -v "PanelAwareModal" | grep -v "node_modules" || true)

if [ -z "$RAW_MODAL_FILES" ]; then
  ok "No raw Modal imports found"
else
  while IFS= read -r file; do
    relative="${file#$SRC_DIR/}"
    # Check if file also imports PanelAwareModal (dual import is OK for re-export)
    if grep -q "PanelAwareModal" "$file"; then
      ok "$relative — imports Modal but also PanelAwareModal (OK)"
    else
      warning "$relative — uses raw Modal (consider PanelAwareModal)"
    fi
  done <<< "$RAW_MODAL_FILES"
fi

# ============================================================
# 3. LoadingView Adoption
# ============================================================
header "3. LoadingView Adoption (no bare ActivityIndicator)"

# Find files using ActivityIndicator without LoadingView
BARE_SPINNER_FILES=$(grep -rl "ActivityIndicator" "$SRC_DIR/screens/" 2>/dev/null | grep -v "node_modules" || true)

if [ -z "$BARE_SPINNER_FILES" ]; then
  ok "No bare ActivityIndicator in screens"
else
  while IFS= read -r file; do
    relative="${file#$SRC_DIR/}"
    if grep -q "LoadingView" "$file"; then
      ok "$relative — uses LoadingView alongside ActivityIndicator"
    else
      warning "$relative — uses bare ActivityIndicator (consider LoadingView)"
    fi
  done <<< "$BARE_SPINNER_FILES"
fi

# ============================================================
# 4. HapticTouchable Adoption
# ============================================================
header "4. HapticTouchable Adoption (no raw TouchableOpacity)"

# Find files importing TouchableOpacity directly from react-native
RAW_TOUCHABLE_FILES=$(grep -rl "import.*TouchableOpacity.*from 'react-native'" "$SRC_DIR/screens/" "$SRC_DIR/components/" 2>/dev/null | grep -v "HapticTouchable.tsx" | grep -v "node_modules" || true)

TOUCHABLE_COUNT=0
if [ -n "$RAW_TOUCHABLE_FILES" ]; then
  TOUCHABLE_COUNT=$(echo "$RAW_TOUCHABLE_FILES" | wc -l | tr -d ' ')
fi

if [ "$TOUCHABLE_COUNT" -eq 0 ]; then
  ok "No raw TouchableOpacity imports found"
else
  echo -e "  ${YELLOW}Found $TOUCHABLE_COUNT files with raw TouchableOpacity:${NC}"
  while IFS= read -r file; do
    relative="${file#$SRC_DIR/}"
    warning "$relative — uses raw TouchableOpacity (migrate to HapticTouchable)"
  done <<< "$RAW_TOUCHABLE_FILES"
fi

# ============================================================
# 5. ErrorView Adoption
# ============================================================
header "5. ErrorView Adoption (no Alert.alert for errors)"

ALERT_FILES=$(grep -rl "Alert\.alert" "$SRC_DIR/screens/" 2>/dev/null | grep -v "node_modules" || true)

if [ -z "$ALERT_FILES" ]; then
  ok "No Alert.alert usage in screens"
else
  while IFS= read -r file; do
    relative="${file#$SRC_DIR/}"
    warning "$relative — uses Alert.alert (consider ErrorView for errors)"
  done <<< "$ALERT_FILES"
fi

# ============================================================
# 6. Touch Target Linting (sub-60pt values)
# ============================================================
header "6. Touch Target Linting (minimum 60pt)"

# Find height/minHeight values between 40-59 (likely sub-60pt touch targets)
SUB60_FILES=$(grep -rn "height:\s*4[0-9]\b\|minHeight:\s*4[0-9]\b\|height:\s*5[0-9]\b\|minHeight:\s*5[0-9]\b" "$SRC_DIR/screens/" "$SRC_DIR/components/" 2>/dev/null | grep -v "node_modules" | grep -v "lineHeight" | grep -v "maxHeight" | grep -v "// non-interactive" || true)

if [ -z "$SUB60_FILES" ]; then
  ok "No sub-60pt touch targets found"
else
  echo -e "  ${YELLOW}Potential sub-60pt touch targets:${NC}"
  while IFS= read -r line; do
    relative="${line#$SRC_DIR/}"
    warning "$relative"
  done <<< "$SUB60_FILES"
fi

# Also check for hardcoded width values on interactive elements
SUB60_WIDTH=$(grep -rn "width:\s*4[0-4]\b" "$SRC_DIR/screens/" "$SRC_DIR/components/" 2>/dev/null | grep -v "node_modules" | grep -v "borderWidth" | grep -v "lineWidth" | grep -v "strokeWidth" | grep -v "// non-interactive" || true)

if [ -n "$SUB60_WIDTH" ]; then
  echo -e "  ${YELLOW}Potential sub-60pt width values:${NC}"
  while IFS= read -r line; do
    relative="${line#$SRC_DIR/}"
    warning "$relative"
  done <<< "$SUB60_WIDTH"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo -e "${BOLD}═══════════════════════════════════${NC}"
echo -e "${BOLD}         VALIDATION SUMMARY        ${NC}"
echo -e "${BOLD}═══════════════════════════════════${NC}"
echo ""

if [ "$VIOLATIONS" -gt 0 ]; then
  echo -e "  ${RED}${BOLD}❌ Violations: $VIOLATIONS${NC}"
fi
if [ "$WARNINGS" -gt 0 ]; then
  echo -e "  ${YELLOW}${BOLD}⚠️  Warnings: $WARNINGS${NC}"
fi
if [ "$VIOLATIONS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}✅ All checks passed!${NC}"
fi

echo ""

# Exit with error if strict mode and violations found
if [ "$STRICT" = "--strict" ] && [ "$VIOLATIONS" -gt 0 ]; then
  echo -e "${RED}Strict mode: exiting with error due to $VIOLATIONS violations${NC}"
  exit 1
fi

exit 0
