/**
 * ModulePickerModal — Module selection modal for iPad Split View
 *
 * Appears when user long-presses a panel to change its module.
 * Shows a grid of available modules in a centered modal.
 *
 * Design:
 * - Touch targets ≥60pt (senior-inclusive)
 * - Text ≥18pt
 * - WCAG AAA contrast
 * - Haptic feedback on selection
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

import React, { useCallback } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { useSplitViewContext, type PanelId } from '@/contexts/SplitViewContext';
import { useNavigationContext } from '@/contexts/NavigationContext';
import { ModuleIcon } from './ModuleIcon';
import type { ModuleDefinition, NavigationDestination } from '@/types/navigation';
import {
  colors,
  typography,
  spacing,
  borderRadius,
  touchTargets,
} from '@/theme';

// ============================================================
// Types
// ============================================================

export interface ModulePickerModalProps {
  /** Which panel to set the module for */
  targetPanel: PanelId;
  /** Called when modal is closed */
  onClose: () => void;
}

// ============================================================
// Component
// ============================================================

export function ModulePickerModal({ targetPanel, onClose }: ModulePickerModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { modules, getModulesByGroup } = useNavigationContext();
  const { setLeftModule, setRightModule, leftPanel, rightPanel } = useSplitViewContext();

  // Get current module for this panel
  const currentModuleId = targetPanel === 'left' ? leftPanel.moduleId : rightPanel.moduleId;

  // Get grouped modules
  const groupedModules = getModulesByGroup();

  // ============================================================
  // Handlers
  // ============================================================

  const handleModuleSelect = useCallback(
    (moduleId: NavigationDestination) => {
      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Set module for target panel
      if (targetPanel === 'left') {
        setLeftModule(moduleId);
      } else {
        setRightModule(moduleId);
      }

      onClose();
    },
    [targetPanel, setLeftModule, setRightModule, onClose]
  );

  const handleBackdropPress = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  }, [onClose]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleBackdropPress}
      >
        {/* Modal Content */}
        <View
          style={[
            styles.modalContent,
            {
              marginTop: insets.top + spacing.xl,
              marginBottom: insets.bottom + spacing.xl,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('splitView.chooseModule')}</Text>
            <Text style={styles.subtitle}>
              {targetPanel === 'left'
                ? t('splitView.leftPanel')
                : t('splitView.rightPanel')}
            </Text>
          </View>

          {/* Module Grid */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Primary Section (Communication) */}
            <ModuleSection
              title={t('navigation.sections.communication')}
              modules={groupedModules.primary}
              currentModuleId={currentModuleId}
              onSelect={handleModuleSelect}
            />

            {/* Secondary Section (Media) */}
            <ModuleSection
              title={t('navigation.sections.media')}
              modules={groupedModules.secondary}
              currentModuleId={currentModuleId}
              onSelect={handleModuleSelect}
            />

            {/* Dynamic Section (Country-specific) */}
            {groupedModules.dynamic.length > 0 && (
              <ModuleSection
                title={t('navigation.sections.modules')}
                modules={groupedModules.dynamic}
                currentModuleId={currentModuleId}
                onSelect={handleModuleSelect}
              />
            )}

            {/* Footer Section */}
            <ModuleSection
              title={t('navigation.sections.system')}
              modules={groupedModules.footer}
              currentModuleId={currentModuleId}
              onSelect={handleModuleSelect}
            />
          </ScrollView>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleBackdropPress}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ============================================================
// Section Component
// ============================================================

interface ModuleSectionProps {
  title: string;
  modules: ModuleDefinition[];
  currentModuleId: NavigationDestination;
  onSelect: (moduleId: NavigationDestination) => void;
}

function ModuleSection({
  title,
  modules,
  currentModuleId,
  onSelect,
}: ModuleSectionProps) {
  const { t } = useTranslation();

  if (modules.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.moduleGrid}>
        {modules.map((module) => (
          <ModuleButton
            key={module.id}
            module={module}
            isSelected={module.id === currentModuleId}
            onPress={() => onSelect(module.id)}
          />
        ))}
      </View>
    </View>
  );
}

// ============================================================
// Module Button Component
// ============================================================

interface ModuleButtonProps {
  module: ModuleDefinition;
  isSelected: boolean;
  onPress: () => void;
}

function ModuleButton({ module, isSelected, onPress }: ModuleButtonProps) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={[
        styles.moduleButton,
        isSelected && styles.moduleButtonSelected,
        { borderColor: isSelected ? module.color : colors.border },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(module.labelKey)}
      accessibilityState={{ selected: isSelected }}
    >
      <View
        style={[
          styles.moduleIconContainer,
          { backgroundColor: module.color },
        ]}
      >
        <ModuleIcon type={module.icon} size={28} color={colors.textOnPrimary} />
      </View>
      <Text
        style={[
          styles.moduleLabel,
          isSelected && { color: module.color, fontWeight: '700' },
        ]}
        numberOfLines={2}
      >
        {t(module.labelKey)}
      </Text>
      {isSelected && (
        <View
          style={[styles.selectedIndicator, { backgroundColor: module.color }]}
        />
      )}
    </TouchableOpacity>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    width: '80%',
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },

  // Header
  header: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  // Section
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textTertiary,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },

  // Module Button
  moduleButton: {
    width: '50%',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  moduleButtonSelected: {
    // Selected styles applied inline
  },
  moduleIconContainer: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  moduleLabel: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  selectedIndicator: {
    position: 'absolute',
    left: spacing.xs,
    top: spacing.sm,
    bottom: spacing.xs + touchTargets.minimum + spacing.xs + 24, // Icon + label height
    width: 4,
    borderRadius: 2,
  },

  // Cancel Button
  cancelButton: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    minHeight: touchTargets.comfortable,
    justifyContent: 'center',
  },
  cancelText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default ModulePickerModal;
