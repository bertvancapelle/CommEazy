/**
 * SinglePaneLayout — iPhone single-pane container
 *
 * iPhone equivalent of SplitViewLayout — renders a single ModulePanel
 * that displays the current module from PaneContext.
 *
 * @see .claude/plans/sunny-yawning-sunset.md
 */

import React from 'react';

import { usePaneContext } from '@/contexts/PaneContext';
import { ModulePanel } from './ModulePanel';

/**
 * iPhone layout: renders one ModulePanel for pane 'main'.
 */
export function SinglePaneLayout() {
  const { panes } = usePaneContext();
  const mainPane = panes.main;

  if (!mainPane) {
    return null;
  }

  return (
    <ModulePanel panelId="main" moduleId={mainPane.moduleId} />
  );
}

export default SinglePaneLayout;
