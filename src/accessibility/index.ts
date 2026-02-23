/**
 * Accessibility Module Exports
 *
 * @see .claude/plans/ACCESSIBILITY_COMPLIANCE.md
 */

export {
  // Types
  type ComplianceStandard,
  type WCAGLevel,
  type ComplianceStatus,
  type ValidationMethod,
  type ComplianceItem,
  type ComplianceDeviation,
  type ComplianceSummary,
  type ComplianceReport,
  // Data
  WCAG_ITEMS,
  EN301549_ITEMS,
  // Functions
  calculateSummary,
  generateComplianceReport,
  getStatusIcon,
  getStatusColor,
} from './compliance';
