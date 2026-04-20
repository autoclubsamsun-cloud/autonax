/**
 * PayTR Direkt API Client
 *
 * iFrame API'den farkli olarak kart bilgileri bizim form'dan alinir ve
 * PayTR'a POST edilir. PayTR 3D Secure sayfasina yonlendirir.
 *
 * Hash formulu (Direkt API):
 *   hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount +
 *              payment_type + installment_count + currency + test_mode + non_3d
 *   paytr_token = base64(HMAC-SHA256(hash_str + merchant_salt, merchant_key))
 *
 * Bildirim hash formulu (callback):
 *   hash_str = merchant_oid + merchant_salt + status + total_amount
 *   hash = base64(HMAC-SHA256(hash_str, merchant_key))
 */

import crypto from 'crypto';
import { odemeAyarlariOku } from './ayarlar-okuyucu';

// ─────────────────────────────────────────────────────────────────────────
// PayTR Direkt API endpoint
// ─────────────────────────────────────────────────────────────────────────

const PAYTR_DIRECT_URL = 'https://www.paytr.com/odeme';

// ─────────────────────────────────────────────────────────────────────────
// Tipler
// ─────────────────────────────────────────────────────────────────────────

export interface SepetUrunu {
  ad: string;
  fiyat: number; // TL cinsinden (ornek: 100.50)
  adet: number;
}

export interface DirectOdemeIstek {
  /** Siparis benzersiz ID (bizim olusturdugumuz) */
  merchantOid: string;
  /** Toplam tutar TL */
  tutar: number;
  /** Musterinin email adresi */
  email: string;
  /** Musterinin IP adresi */
  userIp: string;
  /** Musterinin adi soyadi */
  musteriAdi: string;
  /** Musterinin adresi */
  musteriAdres: string;
  /** Musterinin telefonu */
  musteriTelefon: string;
  /** Sepet - PayTR formatinda */
  sepet: SepetUrunu[];

  /** Kart sahibi adi */
  ccOwner: string;
  /** Kart numarasi (bosluksuz) */
  cardNumber: string;
  /** Son kullanma ay (01-12) */
  expiryMonth: string;
  /** Son kullanma yil (2 haneli - "26" icin 2026) */
  expiryYear: string;
  /** CVV */
  cvv: string;

  /** Taksit sayisi (0 = tek cekim, 2-12 = taksit) */
  installmentCount?: number;

  /** Opsiyonel not (musteri notu) */
  musteriNotu?: string;
}

export interface DirectOdemeYanit {
  basarili: boolean;
  /** PayTR'dan gelen raw yanit */
  rawResponse?: string;
  /** 3D Secure yonlendirme icin HTML (varsa) */
  html3ds?: string;
  /** Sync mode yaniti varsa */
  status?: 'success' | 'failed';
  hata?: string;
  failedReasonCode?: string;
  failedReasonMsg?: string;
  /** PayTR'a gonderilen merchant_oid */
  merchantOid: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Yardimcilar
// ─────────────────────────────────────────────────────────────────────────

/**
 * Sepeti PayTR formatina cevirir:
 * [[urun_adi, fiyat_str, adet], ...] -> base64(JSON)
 */
function sepetiPayTRFormatinaCevir(sepet: SepetUrunu[]): string {
  const dizi = sepet.map((u) => [u.ad, u.fiyat.toFixed(2), u.adet]);
  const json = JSON.stringify(dizi);
  return Buffer.from(json).toString('base64');
}

/**
 * HMAC-SHA256 hash olusturur (Base64).
 */
function hashOlustur(hashStr: string, merchantKey: string): string {
  return crypto
    .createHmac('sha256', merchantKey)
    .update(hashStr)
    .digest('base64');
}

/**
 * Tutari PayTR formatina cevirir: 100.50 TL -> 10050 (kurus olarak gonderilir)
 */
function tutariKurusaCevir(tutarTL: number): number {
  return Math.round(tutarTL * 100);
}

// ─────────────────────────────────────────────────────────────────────────
// PayTR Aktif mi kontrol
// ─────────────────────────────────────────────────────────────────────────

export async function payTRAktifMi(): Promise<boolean> {
  const ayar = await odemeAyarlariOku();
  if (!ayar) return false;
  return !!ayar.paytrAktif;
}

// ─────────────────────────────────────────────────────────────────────────
// ANA FONKSIYON: Direkt API ile odeme baslat
// ─────────────────────────────────────────────────────────────────────────

export async function directOdemeBaslat(
  istek: DirectOdemeIstek
): Promise<DirectOdemeYanit> {
  const ayar = await odemeAyarlariOku();

  if (!ayar || !ayar.paytrAktif) {
    return {
      basarili: false,
      hata: 'PayTR su anda aktif degil. Admin panelinden etkinlestirilmeli.',
      merchantOid: istek.merchantOid,
    };
  }

  if (!ayar.paytrMerchantId || !ayar.paytrMerchantKey || !ayar.paytrMerchantSalt) {
    return {
      basarili: false,
      hata: 'PayTR API bilgileri eksik. Admin panelinden girilmeli.',
      merchantOid: istek.merchantOid,
    };
  }

  const merchantId = ayar.paytrMerchantId;
  const merchantKey = ayar.paytrMerchantKey;
  const merchantSalt = ayar.paytrMerchantSalt;
  const testMode = ayar.paytrTestMod ? '1' : '0';

  // Tutari kurus cinsine cevir
  const paymentAmount = tutariKurusaCevir(istek.tutar);

  // Sepeti encode et
  const userBasket = sepetiPayTRFormatinaCevir(istek.sepet);

  // Taksit - 0 ise tek cekim
  const installmentCount = istek.installmentCount && istek.installmentCount > 1
    ? istek.installmentCount.toString()
    : '0';

  const paymentType = 'card';
  const currency = 'TL';
  const non3d = '0'; // 3D Secure aktif (0 = 3DS var, 1 = non-3DS)

  // Hash string olusumu
  const hashStr =
    merchantId +
    istek.userIp +
    istek.merchantOid +
    istek.email +
    paymentAmount +
    paymentType +
    installmentCount +
    currency +
    testMode +
    non3d;

  const paytrToken = hashOlustur(hashStr + merchantSalt, merchantKey);

  // POST form data olustur
  const postData: Record<string, string> = {
    merchant_id: merchantId,
    user_ip: istek.userIp,
    merchant_oid: istek.merchantOid,
    email: istek.email,
    payment_type: paymentType,
    payment_amount: paymentAmount.toString(),
    currency: currency,
    test_mode: testMode,
    non_3d: non3d,
    merchant_ok_url: `${getSiteUrl()}/odeme-basarili?oid=${istek.merchantOid}`,
    merchant_fail_url: `${getSiteUrl()}/odeme-basarisiz?oid=${istek.merchantOid}`,
    user_name: istek.musteriAdi,
    user_address: istek.musteriAdres,
    user_phone: istek.musteriTelefon,
    user_basket: userBasket,
    debug_on: '1',
    client_lang: 'tr',
    paytr_token: paytrToken,
    installment_count: installmentCount,

    // Direkt API - kart bilgileri
    cc_owner: istek.ccOwner,
    card_number: istek.cardNumber.replace(/\s/g, ''), // boslukları sil
    expiry_month: istek.expiryMonth.padStart(2, '0'),
    expiry_year: istek.expiryYear.length === 4
      ? istek.expiryYear.slice(-2)
      : istek.expiryYear,
    cvv: istek.cvv,

    // Sync mode: 1 = anlik yanit al (PayTR'dan JSON dondurur, 3DS icin html da iceride)
    sync_mode: '1',
  };

  try {
    const body = new URLSearchParams(postData).toString();

    const response = await fetch(PAYTR_DIRECT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    const rawText = await response.text();

    // PayTR yaniti HTML (3DS yonlendirme) veya JSON (sync_mode=1 ile hata) olabilir
    // JSON olup olmadigini deneyerek anla
    let jsonResponse: {
      status?: string;
      reason?: string;
      err_no?: string;
      err_msg?: string;
    } | null = null;

    try {
      jsonResponse = JSON.parse(rawText);
    } catch {
      // JSON parse edilemedi - muhtemelen HTML (3DS redirect)
    }

    // JSON ise - hata var demek
    if (jsonResponse) {
      if (jsonResponse.status === 'success') {
        // Sync mode'da basarili oldu (3DS disinda)
        return {
          basarili: true,
          status: 'success',
          rawResponse: rawText,
          merchantOid: istek.merchantOid,
        };
      }
      return {
        basarili: false,
        status: 'failed',
        hata: jsonResponse.reason || jsonResponse.err_msg || 'Bilinmeyen PayTR hatasi',
        failedReasonCode: jsonResponse.err_no,
        failedReasonMsg: jsonResponse.err_msg,
        rawResponse: rawText,
        merchantOid: istek.merchantOid,
      };
    }

    // JSON degilse - muhtemelen 3DS HTML'i dondu
    // Bu HTML'i musteriye gosterecegiz (3DS banka ekrani)
    return {
      basarili: true,
      html3ds: rawText,
      rawResponse: rawText,
      merchantOid: istek.merchantOid,
    };
  } catch (err) {
    console.error('[PayTR Direct] Network hatasi:', err);
    return {
      basarili: false,
      hata: err instanceof Error ? err.message : 'Network hatasi',
      merchantOid: istek.merchantOid,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Bildirim hash dogrulama
// ─────────────────────────────────────────────────────────────────────────

/**
 * PayTR'dan gelen callback'i dogrular.
 * hash = base64(HMAC-SHA256(merchant_oid + merchant_salt + status + total_amount, merchant_key))
 */
export async function bildirimHashDogrula(params: {
  merchantOid: string;
  status: string;
  totalAmount: string;
  hash: string;
}): Promise<boolean> {
  const ayar = await odemeAyarlariOku();
  if (!ayar || !ayar.paytrMerchantKey || !ayar.paytrMerchantSalt) {
    return false;
  }

  const hashStr =
    params.merchantOid + ayar.paytrMerchantSalt + params.status + params.totalAmount;

  const expectedHash = hashOlustur(hashStr, ayar.paytrMerchantKey);
  return expectedHash === params.hash;
}

// ─────────────────────────────────────────────────────────────────────────
// Site URL yardimci
// ─────────────────────────────────────────────────────────────────────────

function getSiteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000';
  const clean = url.replace(/\/$/, '');
  return clean.startsWith('http') ? clean : `https://${clean}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Siparis ID olustur
// ─────────────────────────────────────────────────────────────────────────

export function siparisIdOlustur(): string {
  const zamanDamgasi = Date.now();
  const rastgele = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `AUTNX${zamanDamgasi}${rastgele}`;
}
