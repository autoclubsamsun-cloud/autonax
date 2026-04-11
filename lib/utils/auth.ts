import { storageGet, storageSet, storageRemove, STORAGE_KEYS } from './storage';

interface AuthSession {
  user: string;
  loginAt: number;
  expiresAt: number;
}

const SESSION_HOURS = 8;

/** Credential kontrolü (demo: env veya hardcoded) */
export function validateCredentials(username: string, password: string): boolean {
  const envUser = process.env.NEXT_PUBLIC_ADMIN_USER || 'admin';
  const envPass = process.env.NEXT_PUBLIC_ADMIN_PASS || 'admin123';
  return username === envUser && password === envPass;
}

/** Login — session oluştur */
export function login(username: string): void {
  const now = Date.now();
  const session: AuthSession = {
    user: username,
    loginAt: now,
    expiresAt: now + SESSION_HOURS * 60 * 60 * 1000,
  };
  storageSet(STORAGE_KEYS.AUTH, session);
}

/** Logout */
export function logout(): void {
  storageRemove(STORAGE_KEYS.AUTH);
}

/** Session geçerli mi? */
export function isAuthenticated(): boolean {
  const session = storageGet<AuthSession>(STORAGE_KEYS.AUTH);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    logout();
    return false;
  }
  return true;
}

/** Mevcut kullanıcı */
export function getCurrentUser(): string | null {
  const session = storageGet<AuthSession>(STORAGE_KEYS.AUTH);
  return session?.user ?? null;
}
