import type { Bayi } from '../types';

export const BAYILER_DEMO: Bayi[] = [
  {
    id: 'b1', isim: 'İstanbul Oto Koruma', sahip: 'Ali Veli',
    tel: '0212 555 00 01', email: 'info@istanbuloto.com',
    sehir: 'İstanbul', adres: 'Bağcılar, İstanbul',
    indirimOrani: 15, aktif: true, kayitTarihi: '01.01.2024',
  },
  {
    id: 'b2', isim: 'Ankara PPF Center', sahip: 'Mehmet Kaya',
    tel: '0312 444 00 02', email: 'ankara@ppfcenter.com',
    sehir: 'Ankara', adres: 'Çankaya, Ankara',
    indirimOrani: 12, aktif: true, kayitTarihi: '15.03.2024',
  },
  {
    id: 'b3', isim: 'İzmir Araç Koruma', sahip: 'Fatma Şahin',
    tel: '0232 333 00 03', email: 'izmir@arackoruma.com',
    sehir: 'İzmir', adres: 'Konak, İzmir',
    indirimOrani: 10, aktif: false, kayitTarihi: '20.06.2024',
  },
];
