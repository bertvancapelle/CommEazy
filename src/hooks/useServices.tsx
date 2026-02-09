/**
 * Service Provider — Dependency injection via React Context
 *
 * Provides all services to the component tree.
 * Makes testing easy: swap real services for mocks.
 */

import React, { createContext, useContext, useMemo } from 'react';
import type {
  DatabaseService,
  EncryptionService,
  XMPPService,
  NotificationService,
} from '@/services/interfaces';

interface Services {
  db: DatabaseService;
  encryption: EncryptionService;
  xmpp: XMPPService;
  notifications: NotificationService;
  reducedMotion: boolean;
}

const ServiceContext = createContext<Services | null>(null);

interface ServiceProviderProps {
  children: React.ReactNode;
  reducedMotion: boolean;
  // Optional overrides for testing
  overrides?: Partial<Services>;
}

export function ServiceProvider({ children, reducedMotion, overrides }: ServiceProviderProps) {
  const services = useMemo<Services>(() => ({
    // These will be initialized with real implementations
    // For now, they're placeholders that will be replaced during app init
    db: overrides?.db ?? (null as unknown as DatabaseService),
    encryption: overrides?.encryption ?? (null as unknown as EncryptionService),
    xmpp: overrides?.xmpp ?? (null as unknown as XMPPService),
    notifications: overrides?.notifications ?? (null as unknown as NotificationService),
    reducedMotion,
  }), [reducedMotion, overrides]);

  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
}

export function useServices(): Services {
  const ctx = useContext(ServiceContext);
  if (!ctx) {
    throw new Error('useServices must be used within ServiceProvider');
  }
  return ctx;
}

export function useDatabase(): DatabaseService {
  return useServices().db;
}

export function useEncryption(): EncryptionService {
  return useServices().encryption;
}

export function useXMPP(): XMPPService {
  return useServices().xmpp;
}

export function useReducedMotion(): boolean {
  return useServices().reducedMotion;
}
