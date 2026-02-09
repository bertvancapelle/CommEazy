/**
 * Type declarations for @xmpp/client
 *
 * Minimal declarations for the parts we use.
 * @see https://github.com/xmppjs/xmpp.js
 */

declare module '@xmpp/client' {
  export interface XMPPClientOptions {
    service: string;
    domain: string;
    username: string;
    password: string;
  }

  export interface Element {
    name: string;
    attrs: Record<string, string>;
    children: (Element | string)[];
    is(name: string): boolean;
    getChild(name: string, xmlns?: string): Element | undefined;
    getChildText(name: string): string | null;
  }

  export interface XMPPClient {
    start(): Promise<void>;
    stop(): Promise<void>;
    send(stanza: Element): Promise<void>;
    on(event: 'online', handler: () => void): void;
    on(event: 'offline', handler: () => void): void;
    on(event: 'error', handler: (error: Error) => void): void;
    on(event: 'stanza', handler: (stanza: Element) => void): void;
  }

  export function client(options: XMPPClientOptions): XMPPClient;

  export function xml(
    name: string,
    attrs?: Record<string, string>,
    ...children: (Element | string)[]
  ): Element;

  export interface JID {
    local: string;
    domain: string;
    resource?: string;
  }

  export function jid(str: string): JID;
}
