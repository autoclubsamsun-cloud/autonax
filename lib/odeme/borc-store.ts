/**
 * Borç Kayıt Store — Sprint 2
 *
 * In-memory store (sunucu restart'ta sifirlanir).
 * Sprint 3: PostgreSQL / Supabase'e gecilecek.
 *
 * Her odeme linki = bir Borc kaydi.
 * Admin linki olusturur, musteri tiklar ve oder.
 */

export type BorcDurumu = 'BEKLEMEDE' | 'ODENDI' | 'IPTAL' | 'SURESI_DOLDU';

export interface Borc {
  // Kimlik
  kod: string;                  // Linkte gorunen kisa kod (8 karakter)
  siparisId: string;            // PayTR merchant_oid (AUTNX...)

  // Musteri bilgisi
  musteriAdi: string;
  musteriTelefon: string;
  musteriEmail: string;
  musteriId?: string;           // hesabim.html icin eslestirme (opsiyonel)

  // Borc detayi
  tutar: number;                // TL cinsinden
  aciklama: string;             // "Seramik kaplama - 34ABC123"
  randevuId?: string;           // Hangi randevuya bagli (opsiyonel)

  // Durum
  durum: BorcDurumu;
  olusturmaTarihi: string;      // ISO date
  sonGecerlilik: string;        // ISO date (24 saat sonra default)
  odemeTarihi?: string;         // ISO date

  // Odeme detayi (basarili odendiyse)
  odemeYontemi?: string;        // "Kredi Karti", "Havale" vs
  taksit?: number;

  // Meta
  olusturanKullanici?: string;  // Admin paneldeki kullanici
}

const borclar = new Map<string, Borc>();
const siparisKodIndex = new Map<string, string>();

/**
 * 8 karakterli benzersiz kod uretir.
 * Karisabilecek karakterler (I, O, 0, 1) cikarildi.
 */
export function kodUret(): string {
  const karakterler = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let kod = '';
  for (let i = 0; i < 8; i++) {
    kod += karakterler[Math.floor(Math.random() * karakterler.length)];
  }
  if (borclar.has(kod)) return kodUret();
  return kod;
}

export function borcOlustur(params: {
  siparisId: string;
  musteriAdi: string;
  musteriTelefon: string;
  musteriEmail: string;
  tutar: number;
  aciklama: string;
  musteriId?: string;
  randevuId?: string;
  olusturanKullanici?: string;
  gecerlilikSaat?: number;
}): Borc {
  const kod = kodUret();
  const simdi = new Date();
  const gecerlilikSaat = params.gecerlilikSaat ?? 24;
  const sonGecerlilik = new Date(simdi.getTime() + gecerlilikSaat * 3600 * 1000);

  const borc: Borc = {
    kod,
    siparisId: params.siparisId,
    musteriAdi: params.musteriAdi,
    musteriTelefon: params.musteriTelefon,
    musteriEmail: params.musteriEmail,
    musteriId: params.musteriId,
    tutar: params.tutar,
    aciklama: params.aciklama,
    randevuId: params.randevuId,
    durum: 'BEKLEMEDE',
    olusturmaTarihi: simdi.toISOString(),
    sonGecerlilik: sonGecerlilik.toISOString(),
    olusturanKullanici: params.olusturanKullanici,
  };

  borclar.set(kod, borc);
  siparisKodIndex.set(params.siparisId, kod);
  return borc;
}

export function borcBulKod(kod: string): Borc | null {
  const borc = borclar.get(kod);
  if (!borc) return null;

  // Suresi dolduysa otomatik guncelle
  if (borc.durum === 'BEKLEMEDE' && new Date() > new Date(borc.sonGecerlilik)) {
    borc.durum = 'SURESI_DOLDU';
    borclar.set(kod, borc);
  }
  return borc;
}

export function borcBulSiparis(siparisId: string): Borc | null {
  const kod = siparisKodIndex.get(siparisId);
  if (!kod) return null;
  return borclar.get(kod) || null;
}

export function borcDurumGuncelle(
  siparisId: string,
  durum: BorcDurumu,
  detay?: { odemeYontemi?: string; taksit?: number }
): Borc | null {
  const kod = siparisKodIndex.get(siparisId);
  if (!kod) return null;

  const borc = borclar.get(kod);
  if (!borc) return null;

  borc.durum = durum;
  if (durum === 'ODENDI') {
    borc.odemeTarihi = new Date().toISOString();
    if (detay?.odemeYontemi) borc.odemeYontemi = detay.odemeYontemi;
    if (detay?.taksit) borc.taksit = detay.taksit;
  }

  borclar.set(kod, borc);
  return borc;
}

export function tumBorclarListele(filtre?: {
  durum?: BorcDurumu;
  musteriId?: string;
  telefon?: string;
}): Borc[] {
  let sonuc = Array.from(borclar.values());

  if (filtre?.durum) sonuc = sonuc.filter((b) => b.durum === filtre.durum);
  if (filtre?.musteriId) sonuc = sonuc.filter((b) => b.musteriId === filtre.musteriId);
  if (filtre?.telefon) {
    const temiz = filtre.telefon.replace(/\D/g, '');
    sonuc = sonuc.filter((b) => b.musteriTelefon.replace(/\D/g, '') === temiz);
  }

  return sonuc.sort(
    (a, b) =>
      new Date(b.olusturmaTarihi).getTime() - new Date(a.olusturmaTarihi).getTime()
  );
}

export function musteriBorclari(params: {
  telefon?: string;
  email?: string;
}): Borc[] {
  const sonuc: Borc[] = [];
  for (const borc of borclar.values()) {
    const telEslesme =
      params.telefon &&
      borc.musteriTelefon.replace(/\D/g, '') === params.telefon.replace(/\D/g, '');
    const emailEslesme =
      params.email &&
      borc.musteriEmail.toLowerCase() === params.email.toLowerCase();

    if (telEslesme || emailEslesme) sonuc.push(borc);
  }
  return sonuc.sort(
    (a, b) =>
      new Date(b.olusturmaTarihi).getTime() - new Date(a.olusturmaTarihi).getTime()
  );
}

export function borcIptal(kod: string): boolean {
  const borc = borclar.get(kod);
  if (!borc) return false;
  if (borc.durum !== 'BEKLEMEDE') return false;

  borc.durum = 'IPTAL';
  borclar.set(kod, borc);
  return true;
}

/**
 * Dashboard istatistik
 */
export function borcIstatistik(): {
  toplamBekleyen: number;
  toplamBekleyenTutar: number;
  toplamOdenen: number;
  toplamOdenenTutar: number;
  bugunOdenenTutar: number;
} {
  const simdi = new Date();
  const bugunBaslangic = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();

  let toplamBekleyen = 0;
  let toplamBekleyenTutar = 0;
  let toplamOdenen = 0;
  let toplamOdenenTutar = 0;
  let bugunOdenenTutar = 0;

  for (const b of borclar.values()) {
    if (b.durum === 'BEKLEMEDE') {
      toplamBekleyen++;
      toplamBekleyenTutar += b.tutar;
    } else if (b.durum === 'ODENDI') {
      toplamOdenen++;
      toplamOdenenTutar += b.tutar;
      if (b.odemeTarihi && new Date(b.odemeTarihi).getTime() >= bugunBaslangic) {
        bugunOdenenTutar += b.tutar;
      }
    }
  }

  return {
    toplamBekleyen,
    toplamBekleyenTutar,
    toplamOdenen,
    toplamOdenenTutar,
    bugunOdenenTutar,
  };
}
