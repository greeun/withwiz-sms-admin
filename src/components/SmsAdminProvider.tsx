'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_BASE_PATH, DEFAULT_RECIPIENT_STORAGE_KEY } from '../constants';

export type ImageSize = 'thumb' | 'sm' | 'md' | 'lg';

/** A fetch carrying the consuming project's auth headers. Accepts the adminFetch shape as is. */
export type SmsFetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Notification callbacks. Notifications are skipped when this is not provided.
 * All three levels are accepted because the original send form used `toast.warning`
 * for partial failures.
 */
export interface SmsNotifier {
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

export interface SmsAdminUiConfig {
  /** Base path of the SMS API group */
  basePath?: string;
  fetcher: SmsFetcher;
  /** Uploads an image and returns its public URL. */
  onUploadImage?: (file: File) => Promise<string>;
  /** Rule for deriving variant image URLs. The original URL is used when this is omitted. */
  resolveImageUrl?: (url: string, size: ImageSize) => string;
  notify?: SmsNotifier;
  /**
   * sessionStorage key holding recipients collected on another screen.
   * The send form reads it once on first render and then clears it.
   */
  recipientStorageKey?: string;
}

export interface ResolvedSmsAdminUiConfig {
  basePath: string;
  fetcher: SmsFetcher;
  onUploadImage?: (file: File) => Promise<string>;
  resolveImageUrl: (url: string, size: ImageSize) => string;
  notify: SmsNotifier;
  recipientStorageKey: string;
}

const NOOP_NOTIFIER: SmsNotifier = { success: () => {}, warning: () => {}, error: () => {} };

const SmsAdminContext = createContext<ResolvedSmsAdminUiConfig | null>(null);

export function SmsAdminProvider({
  config,
  children,
}: {
  config: SmsAdminUiConfig;
  children: ReactNode;
}) {
  // Consumers commonly pass config as an inline object literal, so depending on
  // [config] would change the reference on every render and defeat the memo.
  // Destructuring it lets a new object be built only when a value actually changes.
  const { basePath, fetcher, onUploadImage, resolveImageUrl, notify, recipientStorageKey } = config;

  const value = useMemo<ResolvedSmsAdminUiConfig>(
    () => ({
      basePath: basePath ?? DEFAULT_BASE_PATH,
      fetcher,
      onUploadImage,
      resolveImageUrl: resolveImageUrl ?? ((url) => url),
      notify: notify ?? NOOP_NOTIFIER,
      recipientStorageKey: recipientStorageKey ?? DEFAULT_RECIPIENT_STORAGE_KEY,
    }),
    [basePath, fetcher, onUploadImage, resolveImageUrl, notify, recipientStorageKey],
  );

  return <SmsAdminContext.Provider value={value}>{children}</SmsAdminContext.Provider>;
}

export function useSmsAdminConfig(): ResolvedSmsAdminUiConfig {
  const config = useContext(SmsAdminContext);
  if (!config) {
    throw new Error('The useSmsAdminConfig hook must be used inside SmsAdminProvider.');
  }
  return config;
}
