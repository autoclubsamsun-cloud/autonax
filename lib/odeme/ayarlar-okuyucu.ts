/**
 * Odeme Ayarlari DB Okuyucu
 *
 * Sunnet'in /api/ayarlar endpoint'i auth gerektiriyor (requireAuth).
 * Backend kendi kendine HTTP cagrisi yapamiyor (cookie yok, 401 donuyor).
 *
 * Cozum: DB'den direkt okuruz — HTTP yok, auth yok.
 * Ayni veri, ayni kaynak, sadece farkli yol.
 *
 * Sunnet'in kodundan:
 *   site_ayarlar TABLOSU: anahtar TEXT PRIMARY KEY, deger JSONB
 *   POST /api/ayarlar -> INSERT anahtar='odeme_ayar' deger={...}
 *   GET /api/ayarlar  -> SELECT * FROM site_ayarlar
 */

import { sql } from '@/lib/db';

export interface OdemeAyari {
  paytrMerchantId?: string;
  paytrMerchantKey?: string;
  paytrMerchantSalt?: string;
  paytrAktif?: boolean;
  paytrTestMod?: boolean;
  iyzicoApiKey?: string;
  iyzicoSecretKey?: string;
  iyzicoBaseUrl?: string;
  iyzicoAktif?: boolean;
  iyzicoTestMod?: boolean;
  aktifGateway?: string;
  vadeKarsilayanFirma?: boolean;
  [key: string]: unknown;
}

/**
 * odeme_ayar satirini DB'den okur.
 * null donerse kayit yok.
 */
export async function odemeAyariOku(): Promise<OdemeAyari | null> {
  try {
    const rows = await sql`
      SELECT deger FROM site_ayarlar WHERE anahtar = 'odeme_ayar' LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      console.log('[Ayarlar Okuyucu] odeme_ayar kaydi bulunamadi');
      return null;
    }

    const deger = rows[0].deger;

    // JSONB zaten parse edilmis obje olarak geliyor, ama yine de tedbir
    if (typeof deger === 'string') {
      try {
        return JSON.parse(deger) as OdemeAyari;
      } catch {
        return null;
      }
    }

    return deger as OdemeAyari;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Ayarlar Okuyucu] DB hatasi:', msg);
    return null;
  }
}
