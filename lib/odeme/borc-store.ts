/**
 * Borç Kayıt Store — PostgreSQL versiyon (Sprint 5)
 *
 * Vercel/Neon Postgres'e baglanir.
 * In-memory'den gecis - Vercel restart'larda bor\u00e7lar kaybolmaz.
 *
 * Tablo: borclar
 *   kod TEXT PRIMARY KEY
 *   siparis_id TEXT UNIQUE
 *   musteri_adi, musteri_telefon, musteri_email TEXT
 *   musteri_id TEXT NULL
 *   tutar NUMERIC
 *   aciklama TEXT
 *   randevu_id TEXT NULL
 *   durum TEXT ('BEKLEMEDE' | 'ODENDI' | 'IPTAL' | 'SURESI_DOLDU')
 *   olusturma_tarihi TIMESTAMPTZ
 *   son_gecerlilik TIMESTAMPTZ
 *   odeme_tarihi TIMESTAMPTZ NULL
 *   odeme_yontemi TEXT NULL
 *   taksit INT NULL
 *   olusturan_kullanici TEXT NULL
 */

import { sql, initDB } from '@/lib/db';

export type BorcDurumu = 'BEKLEMEDE' | 'ODENDI' | 'IPTAL' | 'SURESI_DOLDU';

export interface Borc {
  kod: string;
  siparisId: string;
  musteriAdi: string;
  musteriTelefon: string;
  musteriEmail: string;
  musteriId?: string;
  tutar: number;
  aciklama: string;
  randevuId?: string;
  durum: BorcDurumu;
  olusturmaTarihi: string;
  sonGecerlilik: string;
  odemeTarihi?: string;
  odemeYontemi?: string;
  taksit?: number;
  olusturanKullanici?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Tablo olusturma - ilk cagirida otomatik
// ─────────────────────────────────────────────────────────────────────────

let tabloHazir = false;

async function tabloHazirla(): Promise<void> {
  if (tabloHazir) return;
  await initDB();
  await sql`
    CREATE TABLE IF NOT EXISTS borclar (
      kod TEXT PRIMARY KEY,
      siparis_id TEXT UNIQUE NOT NULL,
      musteri_adi TEXT NOT NULL,
      musteri_telefon TEXT NOT NULL,
      musteri_email TEXT NOT NULL,
      musteri_id TEXT,
      tutar NUMERIC NOT NULL,
      aciklama TEXT NOT NULL,
      randevu_id TEXT,
      durum TEXT NOT NULL DEFAULT 'BEKLEMEDE',
      olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      son_gecerlilik TIMESTAMPTZ NOT NULL,
      odeme_tarihi TIMESTAMPTZ,
      odeme_yontemi TEXT,
      taksit INT,
      olusturan_kullanici TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_borclar_siparis_id ON borclar(siparis_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_borclar_durum ON borclar(durum)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_borclar_telefon ON borclar(musteri_telefon)`;
  tabloHazir = true;
}

// ─────────────────────────────────────────────────────────────────────────
// Row -> Borc cevirici
// ─────────────────────────────────────────────────────────────────────────

function rowToBorc(row: any): Borc {
  return {
    kod: row.kod,
    siparisId: row.siparis_id,
    musteriAdi: row.musteri_adi,
    musteriTelefon: row.musteri_telefon,
    musteriEmail: row.musteri_email,
    musteriId: row.musteri_id || undefined,
    tutar: parseFloat(row.tutar),
    aciklama: row.aciklama,
    randevuId: row.randevu_id || undefined,
    durum: row.durum as BorcDurumu,
    olusturmaTarihi: row.olusturma_tarihi instanceof Date
      ? row.olusturma_tarihi.toISOString()
      : String(row.olusturma_tarihi),
    sonGecerlilik: row.son_gecerlilik instanceof Date
      ? row.son_gecerlilik.toISOString()
      : String(row.son_gecerlilik),
    odemeTarihi: row.odeme_tarihi
      ? (row.odeme_tarihi instanceof Date ? row.odeme_tarihi.toISOString() : String(row.odeme_tarihi))
      : undefined,
    odemeYontemi: row.odeme_yontemi || undefined,
    taksit: row.taksit !== null && row.taksit !== undefined ? Number(row.taksit) : undefined,
    olusturanKullanici: row.olusturan_kullanici || undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Kod uretme
// ─────────────────────────────────────────────────────────────────────────

/**
 * 8 karakterli benzersiz kod uretir.
 */
export async function kodUret(): Promise<string> {
  await tabloHazirla();
  const karakterler = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let deneme = 0; deneme < 10; deneme++) {
    let kod = '';
    for (let i = 0; i < 8; i++) {
      kod += karakterler[Math.floor(Math.random() * karakterler.length)];
    }
    const mevcut = await sql`SELECT kod FROM borclar WHERE kod = ${kod} LIMIT 1`;
    if (mevcut.length === 0) return kod;
  }
  throw new Error('Kod uretilemedi - 10 deneme de cakisti');
}

// ─────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────

export async function borcOlustur(params: {
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
}): Promise<Borc> {
  await tabloHazirla();
  const kod = await kodUret();
  const gecerlilikSaat = params.gecerlilikSaat ?? 24;
  const sonGecerlilik = new Date(Date.now() + gecerlilikSaat * 3600 * 1000);

  const rows = await sql`
    INSERT INTO borclar (
      kod, siparis_id, musteri_adi, musteri_telefon, musteri_email,
      musteri_id, tutar, aciklama, randevu_id,
      durum, son_gecerlilik, olusturan_kullanici
    ) VALUES (
      ${kod}, ${params.siparisId}, ${params.musteriAdi}, ${params.musteriTelefon}, ${params.musteriEmail},
      ${params.musteriId || null}, ${params.tutar}, ${params.aciklama}, ${params.randevuId || null},
      'BEKLEMEDE', ${sonGecerlilik.toISOString()}, ${params.olusturanKullanici || null}
    )
    RETURNING *
  `;

  return rowToBorc(rows[0]);
}

export async function borcBulKod(kod: string): Promise<Borc | null> {
  await tabloHazirla();
  const rows = await sql`SELECT * FROM borclar WHERE kod = ${kod} LIMIT 1`;
  if (rows.length === 0) return null;

  const borc = rowToBorc(rows[0]);

  // Suresi dolduysa durumu guncelle
  if (borc.durum === 'BEKLEMEDE' && new Date() > new Date(borc.sonGecerlilik)) {
    await sql`UPDATE borclar SET durum = 'SURESI_DOLDU' WHERE kod = ${kod}`;
    borc.durum = 'SURESI_DOLDU';
  }
  return borc;
}

export async function borcBulSiparis(siparisId: string): Promise<Borc | null> {
  await tabloHazirla();
  const rows = await sql`SELECT * FROM borclar WHERE siparis_id = ${siparisId} LIMIT 1`;
  if (rows.length === 0) return null;
  return rowToBorc(rows[0]);
}

export async function borcDurumGuncelle(
  siparisId: string,
  durum: BorcDurumu,
  detay?: { odemeYontemi?: string; taksit?: number }
): Promise<Borc | null> {
  await tabloHazirla();

  let rows;
  if (durum === 'ODENDI') {
    rows = await sql`
      UPDATE borclar SET
        durum = ${durum},
        odeme_tarihi = NOW(),
        odeme_yontemi = COALESCE(${detay?.odemeYontemi || null}, odeme_yontemi),
        taksit = COALESCE(${detay?.taksit || null}, taksit)
      WHERE siparis_id = ${siparisId}
      RETURNING *
    `;
  } else {
    rows = await sql`
      UPDATE borclar SET durum = ${durum}
      WHERE siparis_id = ${siparisId}
      RETURNING *
    `;
  }

  if (rows.length === 0) return null;
  return rowToBorc(rows[0]);
}

export async function tumBorclarListele(filtre?: {
  durum?: BorcDurumu;
  musteriId?: string;
  telefon?: string;
}): Promise<Borc[]> {
  await tabloHazirla();

  let rows;
  if (filtre?.durum && filtre?.musteriId) {
    rows = await sql`
      SELECT * FROM borclar
      WHERE durum = ${filtre.durum} AND musteri_id = ${filtre.musteriId}
      ORDER BY olusturma_tarihi DESC
    `;
  } else if (filtre?.durum && filtre?.telefon) {
    const temiz = filtre.telefon.replace(/\D/g, '');
    rows = await sql`
      SELECT * FROM borclar
      WHERE durum = ${filtre.durum}
        AND regexp_replace(musteri_telefon, '\D', '', 'g') = ${temiz}
      ORDER BY olusturma_tarihi DESC
    `;
  } else if (filtre?.durum) {
    rows = await sql`SELECT * FROM borclar WHERE durum = ${filtre.durum} ORDER BY olusturma_tarihi DESC`;
  } else if (filtre?.musteriId) {
    rows = await sql`SELECT * FROM borclar WHERE musteri_id = ${filtre.musteriId} ORDER BY olusturma_tarihi DESC`;
  } else if (filtre?.telefon) {
    const temiz = filtre.telefon.replace(/\D/g, '');
    rows = await sql`
      SELECT * FROM borclar
      WHERE regexp_replace(musteri_telefon, '\D', '', 'g') = ${temiz}
      ORDER BY olusturma_tarihi DESC
    `;
  } else {
    rows = await sql`SELECT * FROM borclar ORDER BY olusturma_tarihi DESC`;
  }

  return rows.map((r: any) => rowToBorc(r));
}

export async function musteriBorclari(params: {
  telefon?: string;
  email?: string;
}): Promise<Borc[]> {
  await tabloHazirla();

  let rows;
  if (params.telefon && params.email) {
    const temiz = params.telefon.replace(/\D/g, '');
    rows = await sql`
      SELECT * FROM borclar
      WHERE regexp_replace(musteri_telefon, '\D', '', 'g') = ${temiz}
         OR LOWER(musteri_email) = LOWER(${params.email})
      ORDER BY olusturma_tarihi DESC
    `;
  } else if (params.telefon) {
    const temiz = params.telefon.replace(/\D/g, '');
    rows = await sql`
      SELECT * FROM borclar
      WHERE regexp_replace(musteri_telefon, '\D', '', 'g') = ${temiz}
      ORDER BY olusturma_tarihi DESC
    `;
  } else if (params.email) {
    rows = await sql`
      SELECT * FROM borclar
      WHERE LOWER(musteri_email) = LOWER(${params.email})
      ORDER BY olusturma_tarihi DESC
    `;
  } else {
    return [];
  }

  return rows.map((r: any) => rowToBorc(r));
}

export async function borcIptal(kod: string): Promise<boolean> {
  await tabloHazirla();
  const rows = await sql`
    UPDATE borclar SET durum = 'IPTAL'
    WHERE kod = ${kod} AND durum = 'BEKLEMEDE'
    RETURNING kod
  `;
  return rows.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Istatistik
// ─────────────────────────────────────────────────────────────────────────

export async function borcIstatistik(): Promise<{
  toplamBekleyen: number;
  toplamBekleyenTutar: number;
  toplamOdenen: number;
  toplamOdenenTutar: number;
  bugunOdenenTutar: number;
}> {
  await tabloHazirla();

  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE durum = 'BEKLEMEDE') AS toplam_bekleyen,
      COALESCE(SUM(tutar) FILTER (WHERE durum = 'BEKLEMEDE'), 0) AS toplam_bekleyen_tutar,
      COUNT(*) FILTER (WHERE durum = 'ODENDI') AS toplam_odenen,
      COALESCE(SUM(tutar) FILTER (WHERE durum = 'ODENDI'), 0) AS toplam_odenen_tutar,
      COALESCE(SUM(tutar) FILTER (
        WHERE durum = 'ODENDI' AND odeme_tarihi >= DATE_TRUNC('day', NOW())
      ), 0) AS bugun_odenen_tutar
    FROM borclar
  `;

  const r: any = rows[0];
  return {
    toplamBekleyen: Number(r.toplam_bekleyen),
    toplamBekleyenTutar: Number(r.toplam_bekleyen_tutar),
    toplamOdenen: Number(r.toplam_odenen),
    toplamOdenenTutar: Number(r.toplam_odenen_tutar),
    bugunOdenenTutar: Number(r.bugun_odenen_tutar),
  };
}
