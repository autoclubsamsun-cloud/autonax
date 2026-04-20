/**
 * PayTR iFrame API İstemci Kütüphanesi - v4
 *
 * v3'ten fark: /api/ayarlar HTTP cagrisi yerine DB'den direkt okur.
 * Sunnet'in endpoint'i auth gerektiriyordu, backend kendi cagirinca 401 aliyor.
 * Cozum: lib/odeme/ayarlar-okuyucu.ts -> DB'den direkt.
 */

import crypto from 'crypto';
import type {
  PayTRConfig,
  PayTRSepetUrunu,
  PayTRBildirimi,
} from './paytr-types';
import { odemeAyariOku } from './ayarlar-okuyucu';

const PAYTR_TOKEN_URL = 'https://www.paytr.com/odeme/api/get-token';

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
 * Oncelik sirasi:
 * 1. DB'den odeme_ayar (panelden kaydedilmis) - v4'te DB direkt
 * 2. .env.local (fallback)
 */
export async function payTRConfigOku(): Promise<PayTRConfig> {
  // 1. DB'den oku
  const panelAyar = await odemeAyariOku();

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
      testModu: panelAyar.paytrTestMod !== false,
      maxTaksit: 12,
      siteUrl,
    };
  }

  // 2. Fallback: .env.local
  const envConfig = envConfigOku();
  if (envConfig) {
    console.log('[PayTR Config] .env fallback kullaniliyor');
    return envConfig;
  }

  throw new Error(
    'PayTR konfigurasyonu bulunamadi: Admin paneli → Ayarlar → Odeme ' +
      'bolumunden MERCHANT ID/KEY/SALT girilmeli ve kaydedilmeli.'
  );
}

/**
 * PayTR aktif mi kontrol eder — panelde Aktif toggle'i kapaliysa false.
 */
export async function payTRAktifMi(): Promise<boolean> {
  const panelAyar = await odemeAyariOku();
  if (!panelAyar) return false;
  return !!panelAyar.paytrAktif;
}

/**
 * Musteri sepetini PayTR formatina cevirir.
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
 * TL tutarini kurus string'ine cevirir. 199.99 -> "19999"
 */
export function tlToKurusString(tl: number): string {
  if (!Number.isFinite(tl) || tl < 0) {
    throw new Error('Gecersiz tutar: ' + tl);
  }
  return Math.round(tl * 100).toString();
}

/**
 * Sepet toplam tutarini kurus olarak hesaplar
 */
export function sepetToplamiKurus(sepet: PayTRSepetUrunu[]): number {
  return sepet.reduce((toplam, u) => {
    return toplam + Math.round(u.fiyat * 100) * u.adet;
  }, 0);
}

/**
 * iFrame token hash
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
 * Callback bildirim hash dogrulama
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
 * PayTR'dan iFrame token alir
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
 * HTTP istegindan musteri IP'sini cikarir
 */
export function istekIpAl(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * Siparis ID uretir (merchant_oid)
 */
export function siparisIdUret(prefix: string = 'AUTNX'): string {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${timestamp}${random}`;
}
