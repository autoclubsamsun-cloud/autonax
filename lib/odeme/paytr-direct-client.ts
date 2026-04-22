/**
 * PayTR Direkt API Client - DUZELTILMIS
 *
 * Duzeltme: Turkce karakter encoding sorunu (gecerli degisken adi)
 * Duzeltme: card_type her zaman gonderilir (PayTR zorunlu tuttu)
 *
 * iFrame API'den farkli olarak kart bilgileri bizim form'dan alinir ve
 * PayTR'a POST edilir. PayTR 3D Secure sayfasina yonlendirir.
 */

import crypto from 'crypto';
import { odemeAyariOku } from './ayarlar-okuyucu';

const PAYTR_DIRECT_URL = 'https://www.paytr.com/odeme';

// Tipler
export interface SepetUrunu {
  ad: string;
  fiyat: number; // TL cinsinden (ornek: 100.50)
  adet: number;
}

export interface DirectOdemeIstek {
  merchantOid: string;
  tutar: number;
  email: string;
  userIp: string;
  musteriAdi: string;
  musteriAdres: string;
  musteriTelefon: string;
  sepet: SepetUrunu[];
  ccOwner: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  installmentCount?: number;
  cardType?: string;
  musteriNotu?: string;
}

export interface DirectOdemeYanit {
  basarili: boolean;
  rawResponse?: string;
  html3ds?: string;
  status?: 'success' | 'failed';
  hata?: string;
  failedReasonCode?: string;
  failedReasonMsg?: string;
  merchantOid: string;
}

// Yardimcilar
function sepetiPayTRFormatinaCevir(sepet: SepetUrunu[]): string {
  const dizi = sepet.map((u) => [u.ad, u.fiyat.toFixed(2), u.adet]);
  const json = JSON.stringify(dizi);
  return Buffer.from(json).toString('base64');
}

function hashOlustur(hashStr: string, merchantKey: string): string {
  return crypto
    .createHmac('sha256', merchantKey)
    .update(hashStr)
    .digest('base64');
}

function tutariPayTRFormatina(tutarTL: number): string {
  return tutarTL.toFixed(2);
}

/**
 * PayTR'nin kabul ettigi kart markalari.
 * Eger musteri marka secmediyse PayTR'a bos string gidecegine,
 * biz varsayilan olarak 'world' gondeririz (en yaygin).
 */
const GECERLI_KART_TIPLERI = [
  'advantage', 'axess', 'combo', 'bonus', 'cardfinans',
  'maximum', 'paraf', 'world', 'saglamkart'
];

/**
 * Kart numarasinin ilk 6 hanesinden marka tahmini.
 * PayTR BIN API'si baslangicta cagirilmazsa fallback olarak kullanilir.
 */
function kartTipiTahminEt(cardNumber: string): string {
  const temiz = cardNumber.replace(/\D/g, '');
  const bin = temiz.substring(0, 6);

  // Bonus kartlar (Garanti, Deniz, ING)
  if (/^(4824|4355|4539|5571|5300|5446)/.test(bin)) return 'bonus';
  // World kartlar (Yapi Kredi, Vakifbank)
  if (/^(4158|4544|5451|5522|5528)/.test(bin)) return 'world';
  // Axess (Akbank)
  if (/^(4531|4546|4506|5104|5115)/.test(bin)) return 'axess';
  // Maximum (Is Bankasi)
  if (/^(4258|4531|5127|5279|5313)/.test(bin)) return 'maximum';
  // CardFinans (QNB Finansbank)
  if (/^(4056|4172|4921|5140|5167)/.test(bin)) return 'cardfinans';
  // Paraf (Halkbank)
  if (/^(4028|4144|5186|5223|5352)/.test(bin)) return 'paraf';

  // Varsayilan - en yaygin kabul edilen
  return 'world';
}

export async function payTRAktifMi(): Promise<boolean> {
  const ayar = await odemeAyariOku();
  if (!ayar) return false;
  return !!ayar.paytrAktif;
}

export async function directOdemeBaslat(
  istek: DirectOdemeIstek
): Promise<DirectOdemeYanit> {
  const ayar = await odemeAyariOku();

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

  const paymentAmount = tutariPayTRFormatina(istek.tutar);
  const userBasket = sepetiPayTRFormatinaCevir(istek.sepet);

  const installmentCount = istek.installmentCount && istek.installmentCount > 1
    ? istek.installmentCount.toString()
    : '0';

  const paymentType = 'card';
  const currency = 'TL';
  const non3d = '0';

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

  // === CARD TYPE BELIRLEME (her zaman gonderilir) ===
  let kartTipi = 'world'; // default
  if (istek.cardType) {
    const normalize = istek.cardType.toLowerCase().replace(/\s/g, '');
    if (GECERLI_KART_TIPLERI.indexOf(normalize) >= 0) {
      kartTipi = normalize;
    }
  }
  // Eger musteri marka secmediyse kart numarasindan tahmin et
  if (!istek.cardType || kartTipi === 'world') {
    const tahmin = kartTipiTahminEt(istek.cardNumber);
    if (GECERLI_KART_TIPLERI.indexOf(tahmin) >= 0) {
      kartTipi = tahmin;
    }
  }

  const postData: Record<string, string> = {
    merchant_id: merchantId,
    user_ip: istek.userIp,
    merchant_oid: istek.merchantOid,
    email: istek.email,
    payment_type: paymentType,
    payment_amount: paymentAmount,
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

    cc_owner: istek.ccOwner,
    card_number: istek.cardNumber.replace(/\s/g, ''),
    expiry_month: istek.expiryMonth.padStart(2, '0'),
    expiry_year: istek.expiryYear.length === 4
      ? istek.expiryYear.slice(-2)
      : istek.expiryYear,
    cvv: istek.cvv,

    // card_type HER ZAMAN gonderilir (PayTR zorunlu tuttu)
    card_type: kartTipi,
  };

  console.log('[PayTR Direct] Istek:', {
    merchant_oid: istek.merchantOid,
    payment_amount: paymentAmount,
    installment_count: installmentCount,
    card_type: kartTipi,
    bin: istek.cardNumber.replace(/\s/g, '').substring(0, 6),
  });

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

    if (jsonResponse) {
      if (jsonResponse.status === 'success') {
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

export async function bildirimHashDogrula(params: {
  merchantOid: string;
  status: string;
  totalAmount: string;
  hash: string;
}): Promise<boolean> {
  const ayar = await odemeAyariOku();
  if (!ayar || !ayar.paytrMerchantKey || !ayar.paytrMerchantSalt) {
    return false;
  }

  const hashStr =
    params.merchantOid + ayar.paytrMerchantSalt + params.status + params.totalAmount;

  const expectedHash = hashOlustur(hashStr, ayar.paytrMerchantKey);
  return expectedHash === params.hash;
}

function getSiteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000';
  const clean = url.replace(/\/$/, '');
  return clean.startsWith('http') ? clean : `https://${clean}`;
}

export function siparisIdOlustur(): string {
  const zamanDamgasi = Date.now();
  const rastgele = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `AUTNX${zamanDamgasi}${rastgele}`;
}
