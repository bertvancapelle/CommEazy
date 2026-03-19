#!/bin/bash
# validate-toolbar-positions.sh
#
# Validates that ModalLayout consumers with multiple vertical children
# in their headerBlock use useModalLayoutBottom() to ensure correct
# ordering at both toolbar positions (top and bottom).
#
# Usage:
#   ./scripts/validate-toolbar-positions.sh          # Report only
#   ./scripts/validate-toolbar-positions.sh --strict  # Exit 1 on violations

set -euo pipefail

STRICT=false
if [[ "${1:-}" == "--strict" ]]; then
  STRICT=true
fi

SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)/src"
VIOLATIONS=0
CHECKED=0

echo "🔍 Toolbar Position Dual Validation"
echo "===================================="
echo ""

# Find all files that import ModalLayout
MODAL_LAYOUT_FILES=$(grep -rl "import.*ModalLayout" "$SRC_DIR" --include="*.tsx" 2>/dev/null || true)

for file in $MODAL_LAYOUT_FILES; do
  CHECKED=$((CHECKED + 1))
  relative_path="${file#$SRC_DIR/}"

  # Check if file has a searchSection style (strong indicator of multiple vertical children)
  has_search_section=0
  grep -q "searchSection" "$file" 2>/dev/null && has_search_section=1

  # Check if file uses useModalLayoutBottom
  has_hook=0
  grep -q "useModalLayoutBottom" "$file" 2>/dev/null && has_hook=1

  # Check if file also uses ModuleScreenLayout — if so, the searchSection is likely
  # in the controlsBlock (which already handles reversal via reverseChildren),
  # NOT in a ModalLayout headerBlock. Skip these as false positives.
  uses_module_screen_layout=0
  grep -q "ModuleScreenLayout" "$file" 2>/dev/null && uses_module_screen_layout=1

  # Heuristic: files with searchSection inside ModalLayout headerBlock AND no hook are violations.
  # Files that also use ModuleScreenLayout likely have searchSection in controlsBlock (not headerBlock).
  if [[ "$has_search_section" -gt 0 ]] && [[ "$has_hook" -eq 0 ]] && [[ "$uses_module_screen_layout" -eq 0 ]]; then
    echo "⚠️  MISSING useModalLayoutBottom: $relative_path"
    echo "   → Has searchSection style but no useModalLayoutBottom hook"
    echo "   → headerBlock children may not reverse at bottom toolbar position"
    echo ""
    VIOLATIONS=$((VIOLATIONS + 1))
  elif [[ "$has_hook" -gt 0 ]]; then
    echo "✅ $relative_path — uses useModalLayoutBottom"
  elif [[ "$has_search_section" -gt 0 ]] && [[ "$uses_module_screen_layout" -gt 0 ]]; then
    echo "ℹ️  $relative_path — searchSection in ModuleScreenLayout (handled by reverseChildren)"
  else
    echo "ℹ️  $relative_path — single-row header (no action needed)"
  fi
done

echo ""
echo "===================================="
echo "Checked: $CHECKED files"
echo "Violations: $VIOLATIONS"

if [[ "$VIOLATIONS" -gt 0 ]]; then
  echo ""
  echo "⚠️  Fix: Import and use useModalLayoutBottom() from '@/components/ModalLayout'"
  echo "   Apply headerStyle to headerBlock root View with multiple vertical children."
  echo ""
  echo "   Example:"
  echo "     const { isBottom, headerStyle } = useModalLayoutBottom();"
  echo "     <View style={[styles.searchSection, headerStyle]}>"

  if $STRICT; then
    exit 1
  fi
else
  echo ""
  echo "✅ All ModalLayout consumers correctly handle toolbar positions."
fi
