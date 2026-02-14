/**
 * Type definitions for react-native-uuid
 * Hermes-compatible UUID generator for React Native
 */

declare module 'react-native-uuid' {
  interface UUID {
    v1(): string;
    v4(): string;
    v5(name: string, namespace: string): string;
  }

  const uuid: UUID;
  export default uuid;
}
