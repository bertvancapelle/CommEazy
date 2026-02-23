/**
 * ComplianceReportScreen — WCAG AAA + EN 301 549 Compliance Report
 *
 * Shows accessibility compliance status with expandable accordions.
 * English only (as specified in requirements).
 *
 * @see .claude/plans/ACCESSIBILITY_COMPLIANCE.md
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAccentColorContext } from '@/contexts/AccentColorContext';
import { Icon } from '@/components';
import {
  colors,
  typography,
  spacing,
  borderRadius,
  touchTargets,
} from '@/theme';
import {
  WCAG_ITEMS,
  EN301549_ITEMS,
  calculateSummary,
  getStatusIcon,
  getStatusColor,
  type ComplianceItem,
  type ComplianceSummary,
  type ComplianceDeviation,
} from '@/accessibility';

// ============================================================
// Known Deviations
// ============================================================

const DEVIATIONS: ComplianceDeviation[] = [
  {
    itemId: '6.2',
    description: 'Real-Time Text (RTT) not implemented',
    justification:
      'Voice calls and text messaging provide equivalent communication capability',
    workaround: 'Use text chat or voice calls for real-time communication',
  },
];

// ============================================================
// Accordion Component
// ============================================================

interface ComplianceAccordionProps {
  title: string;
  summary: ComplianceSummary;
  items: ComplianceItem[];
}

function ComplianceAccordion({ title, summary, items }: ComplianceAccordionProps) {
  const [expanded, setExpanded] = useState(false);
  const { accentColor } = useAccentColorContext();

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <View style={styles.accordion}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}. ${summary.compliant} of ${summary.total} compliant. ${expanded ? 'Collapse' : 'Expand'} to see details.`}
      >
        <View style={styles.accordionTitleRow}>
          <Text style={styles.accordionTitle}>{title}</Text>
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {/* Summary Row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryIcon, { color: getStatusColor('compliant') }]}>✅</Text>
          <Text style={styles.summaryText}>{summary.compliant} Compliant</Text>
        </View>
        {summary.partial > 0 && (
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryIcon, { color: getStatusColor('partial') }]}>⚠️</Text>
            <Text style={styles.summaryText}>{summary.partial} Partial</Text>
          </View>
        )}
        {summary.nonCompliant > 0 && (
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryIcon, { color: getStatusColor('non-compliant') }]}>❌</Text>
            <Text style={styles.summaryText}>{summary.nonCompliant} Non-compliant</Text>
          </View>
        )}
        {summary.notApplicable > 0 && (
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryIcon, { color: getStatusColor('not-applicable') }]}>N/A</Text>
            <Text style={styles.summaryText}>{summary.notApplicable} Not applicable</Text>
          </View>
        )}
      </View>

      {/* Expanded Items */}
      {expanded && (
        <View style={styles.accordionContent}>
          {items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={[styles.itemIcon, { color: getStatusColor(item.status) }]}>
                {getStatusIcon(item.status)}
              </Text>
              <View style={styles.itemContent}>
                <Text style={styles.itemId}>{item.id}</Text>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.details && (
                  <Text style={styles.itemDetails}>{item.details}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================
// Deviations Accordion
// ============================================================

interface DeviationsAccordionProps {
  deviations: ComplianceDeviation[];
}

function DeviationsAccordion({ deviations }: DeviationsAccordionProps) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  if (deviations.length === 0) {
    return null;
  }

  return (
    <View style={styles.accordion}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Known Deviations. ${deviations.length} items. ${expanded ? 'Collapse' : 'Expand'} to see details.`}
      >
        <View style={styles.accordionTitleRow}>
          <Text style={styles.accordionTitle}>Known Deviations</Text>
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryIcon, { color: getStatusColor('partial') }]}>⚠️</Text>
          <Text style={styles.summaryText}>{deviations.length} deviation(s)</Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.accordionContent}>
          {deviations.map((deviation) => (
            <View key={deviation.itemId} style={styles.deviationRow}>
              <Text style={[styles.itemIcon, { color: getStatusColor('partial') }]}>⚠️</Text>
              <View style={styles.itemContent}>
                <Text style={styles.deviationTitle}>{deviation.description}</Text>
                <Text style={styles.deviationLabel}>Justification:</Text>
                <Text style={styles.deviationText}>{deviation.justification}</Text>
                {deviation.workaround && (
                  <>
                    <Text style={styles.deviationLabel}>Workaround:</Text>
                    <Text style={styles.deviationText}>{deviation.workaround}</Text>
                  </>
                )}
                {deviation.plannedRemediation && (
                  <>
                    <Text style={styles.deviationLabel}>Planned:</Text>
                    <Text style={styles.deviationText}>{deviation.plannedRemediation}</Text>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================
// Main Screen
// ============================================================

export function ComplianceReportScreen() {
  const navigation = useNavigation();
  const { accentColor } = useAccentColorContext();

  // Calculate summaries
  const wcagSummary = useMemo(() => calculateSummary(WCAG_ITEMS), []);
  const en301549Summary = useMemo(() => calculateSummary(EN301549_ITEMS), []);

  // Report metadata
  const reportDate = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0] + ' ' + now.toTimeString().split(' ')[0].slice(0, 5) + ' UTC';
  }, []);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: accentColor.primary }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={28} color={colors.textOnPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Accessibility Compliance</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* WCAG AAA */}
        <ComplianceAccordion
          title="WCAG 2.2 AAA"
          summary={wcagSummary}
          items={WCAG_ITEMS}
        />

        {/* EN 301 549 */}
        <ComplianceAccordion
          title="EN 301 549 V3.2.1"
          summary={en301549Summary}
          items={EN301549_ITEMS}
        />

        {/* Deviations */}
        <DeviationsAccordion deviations={DEVIATIONS} />

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Text style={styles.footerText}>Report generated: {reportDate}</Text>
          <Text style={styles.footerText}>App version: 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.comfortable,
  },
  backButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textOnPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: touchTargets.minimum,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // Accordion
  accordion: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  accordionHeader: {
    padding: spacing.md,
    minHeight: touchTargets.minimum,
  },
  accordionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accordionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryIcon: {
    fontSize: 16,
  },
  summaryText: {
    ...typography.small,
    color: colors.textSecondary,
  },

  // Accordion Content
  accordionContent: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingVertical: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  itemIcon: {
    fontSize: 14,
    width: 24,
    textAlign: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemId: {
    ...typography.small,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  itemName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  itemDetails: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Deviations
  deviationRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  deviationTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  deviationLabel: {
    ...typography.small,
    color: colors.textTertiary,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  deviationText: {
    ...typography.small,
    color: colors.textSecondary,
  },

  // Footer
  footer: {
    marginTop: spacing.lg,
  },
  footerDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginBottom: spacing.md,
  },
  footerText: {
    ...typography.small,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
});

export default ComplianceReportScreen;
