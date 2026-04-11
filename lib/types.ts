// ─── Randevu ───────────────────────────────────────────────────────────────

export interface OdemeKaydi {
  tarih: string;
  yontem: 'Nakit' | 'Kredi Kart' | 'Havale' | 'Taksit' | 'Online';
  miktar: number;
  not?: string;
}

export interface Randevu {
  id: string;
  tarih: string;
  saat: string;
  musteri: string;
  tel: string;
  plaka: string;
  arac: string;
  hizmet: string;
  tutar: number;
  odenenToplam: number;
  durum: 'onay' | 'bekl' | 'iptal';
  odendi: boolean;
  islem: boolean;
  onlineOdeme: boolean;
  faturaDurum?: 'kesildi' | 'bekliyor';
  faturaNo?: string;
  odemeGecmisi: OdemeKaydi[];
}

// ─── Ürün / Fiyat ──────────────────────────────────────────────────────────

export interface PPFUrun {
  isim: string;
  kat: string;
  altKat: string;
  garanti: number;
  full: number | null;
  on3: number | null;
  kaput: number | null;
  bayiIndirim: number;
  rozet?: string;
  aciklama?: string;
  resim?: string;
  aktif?: boolean;
}

export interface SeramikUrun {
  isim: string;
  kat: string;
  altKat: string;
  tutar: number;
  bayiIndirim: number;
  aciklama?: string;
  aktif?: boolean;
}

export interface DigerHizmet {
  isim: string;
  kat: string;
  altKat: string;
  tutar: number;
  bayiIndirim: number;
  aciklama?: string;
  aktif?: boolean;
}

export interface AltKategori {
  isim: string;
  ikon: string;
  aciklama: string;
}

export interface Kategori {
  isim: string;
  ikon: string;
  renk: string;
  altKategoriler: Record<string, AltKategori>;
}

// ─── Müşteri ────────────────────────────────────────────────────────────────

export interface Musteri {
  id: string;
  isim: string;
  tel: string;
  email?: string;
  plaka: string;
  arac: string;
  kayitTarihi: string;
  toplamIslem: number;
  toplamTutar: number;
}

// ─── Bayi ───────────────────────────────────────────────────────────────────

export interface Bayi {
  id: string;
  isim: string;
  sahip: string;
  tel: string;
  email: string;
  sehir: string;
  adres: string;
  indirimOrani: number;
  aktif: boolean;
  kayitTarihi: string;
}

// ─── Personel ───────────────────────────────────────────────────────────────

export type Rol = 'super_admin' | 'admin' | 'muhasebe' | 'teknisyen' | 'resepsiyonist';

export interface Yetkiler {
  randevu: boolean;
  odeme: boolean;
  fatura: boolean;
  fiyat: boolean;
  rapor: boolean;
  bayi: boolean;
  ayarlar: boolean;
  personel: boolean;
}

export interface Personel {
  id: string;
  ad: string;
  rol: Rol;
  email: string;
  tel: string;
  sifre?: string;
  aktif: boolean;
  yetkiler: Yetkiler;
}

// ─── EDM / E-Fatura ─────────────────────────────────────────────────────────

export interface XSLTSablon {
  isim: string;
  icerik: string;
  boyut: number;
}

export interface EDMAyar {
  aktif: boolean;
  testMod: boolean;
  kullaniciAdi: string;
  sifre: string;
  vknTckn: string;
  gondericEtiketi: string;
  faturaTipi: 'EARSIV' | 'EFATURA';
  faturaSeri: string;
  kdvOrani: number;
  notSablonu: string;
  otomatikFatura: boolean;
  xsltEarsiv: XSLTSablon;
  xsltEfatura: XSLTSablon;
}

// ─── Ödeme ──────────────────────────────────────────────────────────────────

export interface TaksitOranlari {
  [banka: string]: {
    [taksit: number]: number;
  };
}

export interface OdemeAyar {
  vadeKarsilayanFirma: boolean;
  aktifGateway: 'iyzico' | 'paytr' | 'none';
  iyzicoApiKey: string;
  iyzicoSecretKey: string;
  iyzicoBaseUrl: string;
  iyzicoTestMod: boolean;
  paytrMerchantId: string;
  paytrMerchantKey: string;
  paytrMerchantSalt: string;
  paytrTestMod: boolean;
}

// ─── Site Ayarları ──────────────────────────────────────────────────────────

export interface SiteAyarlar {
  genel: {
    firmaAdi: string;
    slogan: string;
    telefon: string;
    email: string;
    adres: string;
    harita: string;
    calisma: string;
  };
  seo: {
    title: string;
    description: string;
    keywords: string;
  };
  sosyal: {
    instagram: string;
    facebook: string;
    whatsapp: string;
    youtube: string;
  };
  gorunurluk: {
    ppf: boolean;
    seramik: boolean;
    bakim: boolean;
    bayiler: boolean;
    blog: boolean;
  };
}

// ─── API Response ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
