/**
 * Type-safe localStorage wrapper with SSR safety
 */

const KEYS = {
  RANDEVULAR: 'autonax_randevular_v1',
  URUNLER: 'autonax_urunler_v1',
  BAYILER: 'autonax_bayiler_v1',
  PERSONEL: 'autonax_personel_v1',
  SITE_AYARLAR: 'autonax_site_v1',
  EDM_AYAR: 'autonax_edm_v1',
  ODEME_AYAR: 'autonax_odeme_v1',
  TAKSIT_ORANLARI: 'autonax_taksit_v1',
  AUTH: 'autonax_auth',
} as const;

export type StorageKey = typeof KEYS[keyof typeof KEYS];

function isClient() {
  return typeof window !== 'undefined';
}

export function storageGet<T>(key: string): T | null {
  if (!isClient()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function storageSet<T>(key: string, value: T): boolean {
  if (!isClient()) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(key: string): void {
  if (!isClient()) return;
  localStorage.removeItem(key);
}

export function storageClear(): void {
  if (!isClient()) return;
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

export { KEYS as STORAGE_KEYS };
