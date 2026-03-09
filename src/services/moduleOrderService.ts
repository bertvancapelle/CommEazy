/**
 * Module Order Service — Persistence for user-defined module order
 *
 * Stores the user's custom module order in AsyncStorage.
 * Used by useModuleOrder hook to provide ordered module list
 * for the HomeScreen grid.
 *
 * Falls back to DEFAULT_MODULE_ORDER when no custom order is saved.
 *
 * @see src/screens/HomeScreen.tsx
 * @see src/hooks/useModuleOrder.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Constants
// ============================================================

const LOG_PREFIX = '[moduleOrderService]';
const STORAGE_KEY = '@commeazy/moduleOrder';

// ============================================================
// Types
// ============================================================

interface ModuleOrderData {
  /** Module IDs in user-defined order */
  order: string[];
  /** Timestamp of last update */
  updatedAt: number;
}

// ============================================================
// Public API
// ============================================================

/**
 * Get the user's custom module order.
 * Returns null if no custom order has been saved (use default).
 */
export async function getModuleOrder(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as ModuleOrderData;
    if (!Array.isArray(data.order) || data.order.length === 0) {
      return null;
    }

    return data.order;
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to read module order');
    return null;
  }
}

/**
 * Save the user's custom module order.
 * Called after drag & drop reordering on the HomeScreen.
 */
export async function saveModuleOrder(order: string[]): Promise<void> {
  try {
    const data: ModuleOrderData = {
      order,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.debug(LOG_PREFIX, 'Module order saved', { count: order.length });
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to save module order');
    throw error;
  }
}

/**
 * Reset the module order to default.
 * Removes the custom order from storage.
 */
export async function resetModuleOrder(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.debug(LOG_PREFIX, 'Module order reset to default');
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to reset module order');
    throw error;
  }
}
