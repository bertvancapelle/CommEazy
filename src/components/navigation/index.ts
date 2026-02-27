/**
 * Navigation components — Exports for adaptive navigation system
 *
 * These components are shared between iPhone (WheelNavigationMenu)
 * and iPad (Sidebar) navigation.
 *
 * @see .claude/plans/IPAD_IPHONE_HYBRID_MENU.md
 */

export { ModuleItem } from './ModuleItem';
export type { ModuleItemProps, ModuleItemVariant, ModuleItemSize } from './ModuleItem';

export { ModuleIcon } from './ModuleIcon';
export type { ModuleIconProps } from './ModuleIcon';

export { Sidebar } from './Sidebar';
export type { SidebarProps } from './Sidebar';

export { AdaptiveNavigation, SplitViewLayout } from './AdaptiveNavigation';
export type { AdaptiveNavigationProps, SplitViewLayoutProps } from './AdaptiveNavigation';

export { AdaptiveNavigationWrapper } from './AdaptiveNavigationWrapper';
export type { AdaptiveNavigationWrapperProps } from './AdaptiveNavigationWrapper';

export { ModulePanel } from './ModulePanel';
export type { ModulePanelProps } from './ModulePanel';

export { PanelNavigator } from './PanelNavigator';
export type { PanelNavigatorProps } from './PanelNavigator';

export { DraggableDivider } from './DraggableDivider';
export type { DraggableDividerProps } from './DraggableDivider';

export { CollapsedPaneIndicator } from './CollapsedPaneIndicator';
export type { CollapsedPaneIndicatorProps } from './CollapsedPaneIndicator';
