/**
 * PayTR iFrame API İstemci Kütüphanesi - v2
 *
 * Sprint 1'den farkı:
 * - Credentials artık .env yerine /api/ayarlar endpoint'inden okunuyor
 * - Sunnet'in yazdığı panel ile tam uyumlu
 * - .env fallback hâlâ var (development kolaylığı için)
 */

import crypto from 'crypto';
import type {
  PayTRConfig,
  PayTRSepetUrunu,
  PayTRBildirimi,
} from './paytr-types';

const PAYTR_TOKEN_URL = 'https://www.paytr.com/odeme/api/get-token';

/**
 * Ayarlar endpoint'inin tam URL'ini döndürür.
 * Dahili (same-origin) fetch için base URL gerekir.
 */
function ayarlarUrlAl(): string {
  // Vercel/production
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (siteUrl) {
    const clean = siteUrl.replace(/\/$/, '');
    const withProtocol = clean.startsWith('http') ? clean : `https://${clean}`;
    return `${withProtocol}/api/ayarlar`;
  }
  // Local development
  return 'http://localhost:3000/api/ayarlar';
}

/**
 * /api/ayarlar endpoint'inden odeme_ayar bilgisini çeker.
 * Sunnet'in panel kodu bu endpoint'e "odeme_ayar" anahtarı altında kaydediyor.
 */
async function odemeAyariCek(): Promise<{
  paytrMerchantId?: string;
  paytrMerchantKey?: string;
  paytrMerchantSalt?: string;
  paytrAktif?: boolean;
  paytrTestMod?: boolean;
} | null> {
  try {
    const url = ayarlarUrlAl();
    const res = await fetch(url, {
      method: 'GET',
      // Panel tarafında cookie auth gerekebilir, same-origin çalıştığımız için cache'siz çekelim
      cache: 'no-store',
    });

    if (!res.ok) {
      console.log('[PayTR Config] /api/ayarlar status:', res.status);
      return null;
    }

    const json = await res.json();
    // Sunnet'in mimarisi: { success: true, data: { odeme_ayar: {...}, site_ayarlar: {...}, ... } }
    // Ya da (eski): { success: true, odeme_ayar: {...} }
    const odeme =
      json?.data?.odeme_ayar ||
      json?.odeme_ayar ||
      null;

    if (!odeme || typeof odeme !== 'object') return null;
    return odeme;
  } catch (err) {
    console.log('[PayTR Config] /api/ayarlar fetch hatası:', err);
    return null;
  }
}

/**
 * .env.local'den config okur (fallback)
 */
function envConfigOku(): PayTRConfig | null {
  const merchantId = process.env.PAYTR_MERCHANT_ID;
  const merchantKey = process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT;

  if (!merchantId || !merchantKey || !merchantSalt) return null;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://www.autonax.com.tr';
  const testModu = process.env.PAYTR_TEST_MODE === '1';
  const maxTaksit = parseInt(process.env.PAYTR_MAX_INSTALLMENT || '12', 10);

  return {
    merchantId,
    merchantKey,
    merchantSalt,
    testModu,
    maxTaksit: isNaN(maxTaksit) ? 12 : maxTaksit,
    siteUrl,
  };
}

/**
 * PayTR konfigurasyonunu okur.
 *
 * Öncelik sırası:
 * 1. /api/ayarlar → odeme_ayar (panelden kaydedilmiş)
 * 2. .env.local (fallback)
 *
 * Panel KAYDET basılınca backend anında yeni bilgilerle çalışır.
 */
export async function payTRConfigOku(): Promise<PayTRConfig> {
  // 1. Panelden kaydedilmiş ayarları dene
  const panelAyar = await odemeAyariCek();

  if (
    panelAyar &&
    panelAyar.paytrMerchantId &&
    panelAyar.paytrMerchantKey &&
    panelAyar.paytrMerchantSalt
  ) {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || 'https://www.autonax.com.tr';

    return {
      merchantId: panelAyar.paytrMerchantId,
      merchantKey: panelAyar.paytrMerchantKey,
      merchantSalt: panelAyar.paytrMerchantSalt,
      // paytrTestMod true/undefined ise test modu aktif (güvenli default)
      testModu: panelAyar.paytrTestMod !== false,
      maxTaksit: 12,
      siteUrl,
    };
  }

  // 2. Fallback: .env.local
  const envConfig = envConfigOku();
  if (envConfig) {
    console.log('[PayTR Config] .env fallback kullanılıyor');
    return envConfig;
  }

  // 3. Hiç yok — hata fırlat
  throw new Error(
    'PayTR konfigurasyonu bulunamadı: Admin paneli → Ayarlar → Ödeme ' +
      'bölümünden MERCHANT ID/KEY/SALT girilmeli ve kaydedilmeli. ' +
      'Alternatif olarak .env.local dosyasına PAYTR_MERCHANT_ID, ' +
      'PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT eklenebilir.'
  );
}

/**
 * PayTR aktif mi kontrol eder — panelde Aktif toggle'ı kapalıysa false.
 * Ödeme başlatmadan önce çağrılmalı.
 */
export async function payTRAktifMi(): Promise<boolean> {
  const panelAyar = await odemeAyariCek();
  if (!panelAyar) return false;
  // paytrAktif true ise aktif. undefined ise false sayalım (güvenli default)
  return !!panelAyar.paytrAktif;
}

/**
 * Müşteri sepetini PayTR formatına çevirir.
 * [['Ürün adı', 'fiyat_kurus', adet], ...]  →  base64(JSON)
 */
export function sepetiPayTRFormatinaCevir(
  sepet: PayTRSepetUrunu[]
): string {
  const formatli = sepet.map((u) => [
    u.ad.slice(0, 150),
    tlToKurusString(u.fiyat),
    u.adet,
  ]);
  return Buffer.from(JSON.stringify(formatli)).toString('base64');
}

/**
 * TL tutarını kuruş string'ine çevirir. 199.99 → "19999"
 */
export function tlToKurusString(tl: number): string {
  if (!Number.isFinite(tl) || tl < 0) {
    throw new Error('Gecersiz tutar: ' + tl);
  }
  return Math.round(tl * 100).toString();
}

/**
 * Sepet toplam tutarını kuruş olarak hesaplar
 */
export function sepetToplamiKurus(sepet: PayTRSepetUrunu[]): number {
  return sepet.reduce((toplam, u) => {
    return toplam + Math.round(u.fiyat * 100) * u.adet;
  }, 0);
}

/**
 * iFrame token hash
 * hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount
 *            + user_basket + no_installment + max_installment + currency + test_mode
 * paytr_token = base64( HMAC-SHA256(hash_str + merchant_salt, merchant_key) )
 */
export function iFrameTokenHashOlustur(params: {
  config: PayTRConfig;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmount: string;
  userBasket: string;
  noInstallment: string;
  maxInstallment: string;
  currency: string;
  testMode: string;
}): string {
  const { config } = params;

  const hashStr =
    config.merchantId +
    params.userIp +
    params.merchantOid +
    params.email +
    params.paymentAmount +
    params.userBasket +
    params.noInstallment +
    params.maxInstallment +
    params.currency +
    params.testMode;

  const hmac = crypto.createHmac('sha256', config.merchantKey);
  hmac.update(hashStr + config.merchantSalt);
  return hmac.digest('base64');
}

/**
 * Callback bildirim hash doğrulama
 * hash = base64( HMAC-SHA256(merchant_oid + merchant_salt + status + total_amount, merchant_key) )
 */
export function bildirimHashDogrula(
  config: PayTRConfig,
  bildirim: Pick<
    PayTRBildirimi,
    'merchant_oid' | 'status' | 'total_amount' | 'hash'
  >
): boolean {
  const hashStr =
    bildirim.merchant_oid +
    config.merchantSalt +
    bildirim.status +
    bildirim.total_amount;

  const hmac = crypto.createHmac('sha256', config.merchantKey);
  hmac.update(hashStr);
  const beklenenHash = hmac.digest('base64');

  if (beklenenHash.length !== bildirim.hash.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(beklenenHash),
    Buffer.from(bildirim.hash)
  );
}

/**
 * PayTR'dan iFrame token alır
 */
export async function iFrameTokenAl(params: {
  config: PayTRConfig;
  userIp: string;
  merchantOid: string;
  email: string;
  tutarKurus: number;
  sepet: PayTRSepetUrunu[];
  musteriAdSoyad: string;
  musteriAdres: string;
  musteriTelefon: string;
  basariliUrl: string;
  basarisizUrl: string;
  maxTaksit?: number;
  tekCekim?: boolean;
  testModu?: boolean;
}): Promise<{
  basarili: boolean;
  token?: string;
  hata?: string;
  ham?: unknown;
}> {
  const { config } = params;

  const paymentAmount = params.tutarKurus.toString();
  const userBasket = sepetiPayTRFormatinaCevir(params.sepet);
  const noInstallment = params.tekCekim ? '1' : '0';
  const maxInstallment = (params.maxTaksit ?? config.maxTaksit).toString();
  const currency = 'TL';
  const testMode = params.testModu ?? config.testModu ? '1' : '0';

  const paytrToken = iFrameTokenHashOlustur({
    config,
    userIp: params.userIp,
    merchantOid: params.merchantOid,
    email: params.email,
    paymentAmount,
    userBasket,
    noInstallment,
    maxInstallment,
    currency,
    testMode,
  });

  const form = new URLSearchParams({
    merchant_id: config.merchantId,
    user_ip: params.userIp,
    merchant_oid: params.merchantOid,
    email: params.email,
    payment_amount: paymentAmount,
    paytr_token: paytrToken,
    user_basket: userBasket,
    debug_on: '1',
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: params.musteriAdSoyad.slice(0, 60),
    user_address: params.musteriAdres.slice(0, 400),
    user_phone: params.musteriTelefon.slice(0, 20),
    merchant_ok_url: params.basariliUrl.slice(0, 400),
    merchant_fail_url: params.basarisizUrl.slice(0, 400),
    timeout_limit: '30',
    currency,
    test_mode: testMode,
    lang: 'tr',
  });

  console.log('[PayTR] Token istek basliyor:', {
    merchantOid: params.merchantOid,
    tutarKurus: paymentAmount,
    testModu: testMode === '1',
    noInstallment,
    maxInstallment,
  });

  try {
    const response = await fetch(PAYTR_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const text = await response.text();
    console.log('[PayTR] Yanit:', text.slice(0, 500));

    let json: { status?: string; token?: string; reason?: string };
    try {
      json = JSON.parse(text);
    } catch {
      return {
        basarili: false,
        hata: 'PayTR gecerli JSON dondurmedi: ' + text.slice(0, 200),
        ham: text,
      };
    }

    if (json.status === 'success' && json.token) {
      console.log('[PayTR] Token alindi:', params.merchantOid);
      return { basarili: true, token: json.token, ham: json };
    }

    return {
      basarili: false,
      hata: json.reason || 'Bilinmeyen PayTR hatasi',
      ham: json,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PayTR] Fetch hatasi:', msg);
    return { basarili: false, hata: 'Ag hatasi: ' + msg };
  }
}

/**
 * HTTP isteğinden müşteri IP'sini çıkarır
 */
export function istekIpAl(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * Sipariş ID üretir (merchant_oid)
 * Format: AUTNX + timestamp + 6 hex = sadece alfanumerik, PayTR uyumlu
 */
export function siparisIdUret(prefix: string = 'AUTNX'): string {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${timestamp}${random}`;
}
