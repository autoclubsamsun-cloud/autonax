export const APP_NAME = 'Autonax';
export const APP_VERSION = '2.0.0';

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/admin/dashboard',
  RANDEVULAR: '/admin/randevular',
  MUSTERILER: '/admin/musteriler',
  HIZMETLER: '/admin/hizmetler',
  FIYATLAR: '/admin/fiyatlar',
  RAPORLAR: '/admin/raporlar',
  BAYILER: '/admin/bayiler',
  AYARLAR: '/admin/ayarlar',
} as const;

export const API = {
  RANDEVULAR: '/api/randevular',
  FIYATLAR: '/api/fiyatlar',
  PERSONEL: '/api/personel',
  BAYILER: '/api/bayiler',
  RAPOR: '/api/rapor',
  AYARLAR: '/api/ayarlar',
  ODEME: '/api/odeme',
  EDM: '/api/edm',
  MUSTERILER: '/api/musteriler',
} as const;

export const TAKSIT_BANKALARI = ['Garanti (Bonus)', 'İş Bankası (Maximum)', 'Yapı Kredi', 'Ziraat', 'Akbank', 'Halkbank', 'QNB Finansbank', 'TEB', 'ING', 'Denizbank'] as const;

export const TAKSIT_ORANLARI_DEFAULT: Record<string, Record<number, number>> = {
  'Garanti (Bonus)':       { 3: 1.69, 6: 3.16, 9: 5.03, 12: 7.44 },
  'İş Bankası (Maximum)': { 3: 1.69, 6: 3.16, 9: 5.03, 12: 7.44 },
  'Yapı Kredi':            { 3: 1.69, 6: 3.28, 9: 5.12, 12: 7.55 },
  'Ziraat':                { 3: 1.65, 6: 3.10, 9: 4.98, 12: 7.35 },
  'Akbank':                { 3: 1.69, 6: 3.16, 9: 5.03, 12: 7.44 },
};
