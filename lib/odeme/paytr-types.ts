/**
 * PayTR iFrame API tipleri
 *
 * Referans: https://dev.paytr.com/iframe-api/iframe-api-1-adim
 */

/** Müşterinin sepetindeki tek ürün */
export interface PayTRSepetUrunu {
  /** Ürün adı (max 150 karakter) */
  ad: string;
  /** Ürün fiyatı (TL, ondalıklı) — örn: 199.99 */
  fiyat: number;
  /** Adet */
  adet: number;
}

/** Ödeme başlatma isteği (frontend → backend) */
export interface OdemeBaslatIstegi {
  /** Sipariş benzersiz ID'si (merchant_oid) - sadece harf/rakam, boşluksuz */
  siparisId: string;
  /** Müşteri e-posta */
  email: string;
  /** Müşteri adı soyadı */
  adSoyad: string;
  /** Müşteri telefonu (ör: 05551112233) */
  telefon: string;
  /** Müşteri adresi (max 400 karakter) */
  adres: string;
  /** Sepet ürünleri */
  sepet: PayTRSepetUrunu[];
  /** Taksit kısıtı (0 = taksit yok / tek çekim zorunlu, 2-12 = max taksit) */
  maxTaksit?: number;
  /** Sadece tek çekim zorunlu mu? */
  tekCekim?: boolean;
  /** Test modu (true ise test kartları çalışır, gerçek ödeme alınmaz) */
  testModu?: boolean;
}

/** PayTR token yanıtı (backend → frontend) */
export interface OdemeBaslatYaniti {
  /** İşlem başarılı mı */
  basarili: boolean;
  /** iframe_token - frontend bu token ile iframe açacak */
  token?: string;
  /** merchant_oid (referans için) */
  siparisId?: string;
  /** Hata mesajı */
  hata?: string;
  /** PayTR'dan gelen ham yanıt (debug) */
  ham?: unknown;
}

/** PayTR callback bildirimi (PayTR → backend) */
export interface PayTRBildirimi {
  merchant_oid: string;
  status: 'success' | 'failed';
  total_amount: string;
  hash: string;
  failed_reason_code?: string;
  failed_reason_msg?: string;
  payment_type?: string;
  installment_count?: string;
  currency?: string;
  payment_amount?: string;
}

/** Sipariş durumu sorgulama yanıtı */
export interface OdemeDurumYaniti {
  basarili: boolean;
  durum: 'BEKLEMEDE' | 'ODENDI' | 'IPTAL' | 'IADE' | 'HATA';
  siparisId: string;
  tutar?: number;
  taksit?: number;
  odemeTarihi?: string;
  hata?: string;
}

/** PayTR iade isteği */
export interface OdemeIadeIstegi {
  siparisId: string;
  /** TL cinsinden iade tutarı - boşsa tamamen iade */
  iadeTutari?: number;
}

export interface OdemeIadeYaniti {
  basarili: boolean;
  mesaj: string;
  hata?: string;
}

/** Ortam değişkenleri doğrulama tipi */
export interface PayTRConfig {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  testModu: boolean;
  maxTaksit: number;
  siteUrl: string;
}
