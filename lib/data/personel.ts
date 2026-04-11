import type { Personel } from '../types';

export const PERSONEL_DEMO: Personel[] = [
  {
    id: 'p1',
    ad: 'Musa Süleymanoğlu',
    rol: 'super_admin',
    email: 'musa@autonax.com',
    tel: '0532 000 00 01',
    aktif: true,
    yetkiler: {
      randevu: true, odeme: true, fatura: true, fiyat: true,
      rapor: true, bayi: true, ayarlar: true, personel: true,
    },
  },
  {
    id: 'p2',
    ad: 'Ahmet Usta',
    rol: 'teknisyen',
    email: 'ahmet@autonax.com',
    tel: '0532 000 00 02',
    aktif: true,
    yetkiler: {
      randevu: true, odeme: false, fatura: false, fiyat: false,
      rapor: false, bayi: false, ayarlar: false, personel: false,
    },
  },
  {
    id: 'p3',
    ad: 'Zeynep Kaya',
    rol: 'muhasebe',
    email: 'zeynep@autonax.com',
    tel: '0532 000 00 03',
    aktif: true,
    yetkiler: {
      randevu: true, odeme: true, fatura: true, fiyat: false,
      rapor: true, bayi: false, ayarlar: false, personel: false,
    },
  },
];

export const ROL_TANIMLAR = {
  super_admin: { etiket: 'Süper Admin', renk: '#B01C2E', bg: 'rgba(176,28,46,.1)', aciklama: 'Tüm yetkilere sahip' },
  admin:        { etiket: 'Admin',       renk: '#7c3aed', bg: 'rgba(124,58,237,.1)', aciklama: 'Çoğu yetkiye sahip' },
  muhasebe:     { etiket: 'Muhasebe',    renk: '#2563EB', bg: 'rgba(37,99,235,.1)',  aciklama: 'Ödeme ve fatura yetkisi' },
  teknisyen:    { etiket: 'Teknisyen',   renk: '#d97706', bg: 'rgba(217,119,6,.1)',  aciklama: 'Sadece randevu görüntüleme' },
  resepsiyonist:{ etiket: 'Resepsiyonist',renk:'#16a34a', bg: 'rgba(22,163,74,.1)', aciklama: 'Randevu ve müşteri' },
} as const;
