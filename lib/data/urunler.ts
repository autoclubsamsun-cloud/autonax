import type { PPFUrun, SeramikUrun, DigerHizmet, Kategori } from '../types';

export const KATEGORILER: Record<string, Kategori> = {
  ppf: {
    isim: 'PPF TPU Kaplama',
    ikon: '🛡️',
    renk: '#B01C2E',
    altKategoriler: {
      alman: { isim: 'Alman Serisi', ikon: '🇩🇪', aciklama: 'Henkel yapışkan teknolojisi' },
      amerikan: { isim: 'Amerikan Serisi', ikon: '🇺🇸', aciklama: 'Ashland yapışkan teknolojisi' },
      renkli: { isim: 'Özel / Renkli', ikon: '🌈', aciklama: 'Renk değiştirme ve mat kaplamalar' },
    },
  },
  seramik: {
    isim: 'Seramik & Kimyasal',
    ikon: '✨',
    renk: '#0ea5e9',
    altKategoriler: {
      nano: { isim: 'Nano Seramik', ikon: '💎', aciklama: 'Cam bazlı seramik kaplama' },
      pasta: { isim: 'Pasta & Cila', ikon: '✨', aciklama: 'Boya koruma ve parlatma' },
    },
  },
  bakim: {
    isim: 'Temizlik & Bakım',
    ikon: '🚿',
    renk: '#10b981',
    altKategoriler: {
      yikama: { isim: 'Araç Yıkama', ikon: '🚿', aciklama: 'Standart ve özel yıkama paketleri' },
      detayli: { isim: 'Detaylı Temizlik', ikon: '🧹', aciklama: 'İç ve dış detaylı temizlik' },
    },
  },
};

export const URUNLER: Record<string, PPFUrun> = {
  CS190: {
    isim: 'NiDOJP CS190 200 Mikron TPU PPF EKO',
    kat: 'ppf', altKat: 'alman', garanti: 4,
    full: 45000, on3: 13000, kaput: 3000,
    bayiIndirim: 15, rozet: '💡 EKONOMİK',
    aciklama: '200 Mikron Alman TPU. Henkel yapışkan sistemi. Ekonomik PPF çözümü.',
    aktif: true,
  },
  S75: {
    isim: 'NiDOJP S75 200 Mikron TPU PPF',
    kat: 'ppf', altKat: 'alman', garanti: 6,
    full: 55000, on3: 15000, kaput: 4000,
    bayiIndirim: 12, rozet: '🇩🇪 GERMANY',
    aciklama: '200 Mikron Alman TPU. Yüksek optik berraklık ve sararmama garantisi.',
    aktif: true,
  },
  S85: {
    isim: 'NiDOJP S85 220 Mikron TPU PPF',
    kat: 'ppf', altKat: 'alman', garanti: 8,
    full: null, on3: null, kaput: null,
    bayiIndirim: 10, rozet: '🇩🇪 8 YIL',
    aciklama: '220 Mikron gelişmiş Alman TPU. Kendini iyileştirme özelliği.',
    aktif: true,
  },
  N7: {
    isim: 'NiDOJP N7 200 Mikron TPU PPF',
    kat: 'ppf', altKat: 'amerikan', garanti: 8,
    full: 65000, on3: 17000, kaput: 5000,
    bayiIndirim: 10, rozet: '☑ BAŞLANGIÇ',
    aciklama: '200 Mikron Amerikan TPU. Ashland yapışkan sistemi. Üstün yapışma gücü.',
    aktif: true,
  },
  N8: {
    isim: 'NiDOJP N8 220 Mikron TPU PPF',
    kat: 'ppf', altKat: 'amerikan', garanti: 10,
    full: 70000, on3: 20000, kaput: 7000,
    bayiIndirim: 10, rozet: '⭐ POPÜLER',
    aciklama: '220 Mikron premium Amerikan TPU. Serinin en çok tercih edileni.',
    aktif: true,
  },
  N9: {
    isim: 'NiDOJP N9 250 Mikron TPU PPF',
    kat: 'ppf', altKat: 'amerikan', garanti: 12,
    full: 90000, on3: null, kaput: null,
    bayiIndirim: 8, rozet: '👑 MAKSİMUM',
    aciklama: '250 Mikron ultra kalın Amerikan TPU. Maksimum darbe koruması.',
    aktif: true,
  },
  RENKLI: {
    isim: 'NiDOJP Renkli 200 Mikron TPU PPF',
    kat: 'ppf', altKat: 'renkli', garanti: 5,
    full: 180000, on3: null, kaput: null,
    bayiIndirim: 8, rozet: '🌈 RENKLİ',
    aciklama: '200 Mikron renkli/mat TPU. Araç rengi değiştirme ve koruma bir arada. 30+ renk seçeneği.',
    aktif: true,
  },
};

export const SERAMIK: SeramikUrun[] = [
  { isim: 'Nano Seramik 2 Yıl', kat: 'seramik', altKat: 'nano', tutar: 12000, bayiIndirim: 15, aciklama: 'Giriş seviyesi cam seramik. 2 yıl garanti.', aktif: true },
  { isim: 'Nano Seramik 4 Yıl', kat: 'seramik', altKat: 'nano', tutar: 18000, bayiIndirim: 12, aciklama: 'Orta segment cam seramik. 4 yıl garanti.', aktif: true },
  { isim: 'Nano Seramik Pro 6 Yıl', kat: 'seramik', altKat: 'nano', tutar: 25000, bayiIndirim: 10, aciklama: 'Premium cam seramik. 6 yıl garanti.', aktif: true },
];

export const DIGER_HIZMETLER: DigerHizmet[] = [
  { isim: 'Pasta Cila Standart', kat: 'seramik', altKat: 'pasta', tutar: 3500, bayiIndirim: 20, aciklama: 'Standart pasta cilası.', aktif: true },
  { isim: 'Pasta Cila Detaylı', kat: 'seramik', altKat: 'pasta', tutar: 6000, bayiIndirim: 15, aciklama: 'Profesyonel çok aşamalı pasta cila.', aktif: true },
  { isim: 'Araç Yıkama Standart', kat: 'bakim', altKat: 'yikama', tutar: 500, bayiIndirim: 20, aciklama: 'Dış karoser temizliği.', aktif: true },
  { isim: 'Araç Yıkama Detaylı', kat: 'bakim', altKat: 'yikama', tutar: 1200, bayiIndirim: 15, aciklama: 'Dış + ön cam + jant + lastik detay.', aktif: true },
  { isim: 'Motor Yıkama', kat: 'bakim', altKat: 'yikama', tutar: 1000, bayiIndirim: 15, aciklama: 'Motor bölgesi yağ ve kir temizliği.', aktif: true },
  { isim: 'İç Temizlik', kat: 'bakim', altKat: 'detayli', tutar: 2000, bayiIndirim: 15, aciklama: 'Koltuk, tavan, pano detay temizliği.', aktif: true },
  { isim: 'Detaylı İç+Dış Temizlik', kat: 'bakim', altKat: 'detayli', tutar: 3500, bayiIndirim: 12, aciklama: 'Komple araç detay temizliği.', aktif: true },
];
