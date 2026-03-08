/**
 * AgendaCategoryPickerScreen — Category selection for new agenda items
 *
 * Senior-inclusive grid showing manual categories grouped by type:
 * - Afspraken (doctor, dentist, hairdresser, optician, bank, municipality, other)
 * - Familie (family)
 * - Herinneringen (reminder, medication)
 *
 * Each category is a large touch target (72pt) with emoji icon + label.
 * Selecting a category navigates to the form screen.
 *
 * @see constants/agendaCategories.ts for category definitions
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, HapticTouchable } from '@/components';
import { useColors } from '@/contexts/ThemeContext';
import { useModuleColor } from '@/contexts/ModuleColorsContext';
import {
  MANUAL_CATEGORIES,
  CATEGORY_GROUPS,
  type AgendaCategory,
  type CategoryDefinition,
  type CategoryGroup,
} from '@/constants/agendaCategories';

// ============================================================
// Props
// ============================================================

interface AgendaCategoryPickerScreenProps {
  onSelectCategory: (category: AgendaCategory) => void;
  onBack: () => void;
}

// ============================================================
// CategoryButton — Single category option
// ============================================================

interface CategoryButtonProps {
  category: CategoryDefinition;
  onPress: (id: AgendaCategory) => void;
  themeColors: ReturnType<typeof useColors>;
}

function CategoryButton({ category, onPress, themeColors }: CategoryButtonProps) {
  const { t } = useTranslation();

  return (
    <HapticTouchable
      style={[styles.categoryButton, { borderColor: themeColors.border }]}
      onPress={() => onPress(category.id)}
      accessibilityRole="button"
      accessibilityLabel={`${category.icon} ${t(category.labelKey)}`}
    >
      <Text style={styles.categoryIcon}>{category.icon}</Text>
      <Text
        style={[styles.categoryLabel, { color: themeColors.textPrimary }]}
        numberOfLines={2}
      >
        {t(category.labelKey)}
      </Text>
    </HapticTouchable>
  );
}

// ============================================================
// CategoryGroup — Group header + categories
// ============================================================

interface CategoryGroupSectionProps {
  groupKey: CategoryGroup;
  groupLabelKey: string;
  categories: CategoryDefinition[];
  onPress: (id: AgendaCategory) => void;
  themeColors: ReturnType<typeof useColors>;
}

function CategoryGroupSection({
  groupLabelKey,
  categories,
  onPress,
  themeColors,
}: CategoryGroupSectionProps) {
  const { t } = useTranslation();

  if (categories.length === 0) return null;

  return (
    <View style={styles.groupSection}>
      <Text style={[styles.groupLabel, { color: themeColors.textSecondary }]}>
        {t(groupLabelKey)}
      </Text>
      <View style={styles.categoryGrid}>
        {categories.map((cat) => (
          <CategoryButton
            key={cat.id}
            category={cat}
            onPress={onPress}
            themeColors={themeColors}
          />
        ))}
      </View>
    </View>
  );
}

// ============================================================
// AgendaCategoryPickerScreen
// ============================================================

export function AgendaCategoryPickerScreen({
  onSelectCategory,
  onBack,
}: AgendaCategoryPickerScreenProps) {
  const { t } = useTranslation();
  const themeColors = useColors();
  const insets = useSafeAreaInsets();
  const moduleColor = useModuleColor('agenda');

  const handleCategoryPress = useCallback(
    (categoryId: AgendaCategory) => {
      onSelectCategory(categoryId);
    },
    [onSelectCategory],
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header with back button */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: moduleColor,
            paddingTop: insets.top + spacing.sm,
          },
        ]}
      >
        <HapticTouchable
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.goBack')}
        >
          <Icon name="chevron-left" size={24} color={colors.textOnPrimary} />
        </HapticTouchable>
        <Text style={styles.headerTitle}>
          {t('modules.agenda.form.pickCategory')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        {CATEGORY_GROUPS.map((group) => {
          const groupCategories = MANUAL_CATEGORIES.filter(
            (c) => c.group === group.key,
          );
          return (
            <CategoryGroupSection
              key={group.key}
              groupKey={group.key}
              groupLabelKey={group.labelKey}
              categories={groupCategories}
              onPress={handleCategoryPress}
              themeColors={themeColors}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  backButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textOnPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  headerSpacer: {
    width: touchTargets.minimum,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },

  // Group section
  groupSection: {
    marginBottom: spacing.lg,
  },
  groupLabel: {
    ...typography.label,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  // Category button
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    flexBasis: '48%',
    flexGrow: 1,
  },
  categoryIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  categoryLabel: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
  },
});
