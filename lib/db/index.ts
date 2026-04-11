import { neon } from '@neondatabase/serverless';

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

export const sql = neon(process.env.POSTGRES_URL);

// Tablo oluşturma — ilk çalıştırmada
export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS randevular (
      id              TEXT PRIMARY KEY,
      tarih           TEXT NOT NULL,
      saat            TEXT NOT NULL DEFAULT '09:00',
      musteri         TEXT NOT NULL,
      tel             TEXT,
      plaka           TEXT,
      arac            TEXT,
      hizmet          TEXT,
      tutar           INTEGER DEFAULT 0,
      odenen_toplam   INTEGER DEFAULT 0,
      durum           TEXT DEFAULT 'bekl',
      odendi          BOOLEAN DEFAULT FALSE,
      islem           BOOLEAN DEFAULT FALSE,
      online_odeme    BOOLEAN DEFAULT FALSE,
      fatura_no       TEXT,
      fatura_durum    TEXT,
      odeme_gecmisi   JSONB DEFAULT '[]',
      olusturma       TIMESTAMPTZ DEFAULT NOW(),
      guncelleme      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS musteriler (
      id          TEXT PRIMARY KEY,
      ad          TEXT NOT NULL,
      tel         TEXT,
      email       TEXT,
      plaka       TEXT,
      arac        TEXT,
      olusturma   TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS urunler (
      id           TEXT PRIMARY KEY,
      isim         TEXT NOT NULL,
      kat          TEXT,
      alt_kat      TEXT,
      garanti      INTEGER,
      full_fiyat   INTEGER,
      on3_fiyat    INTEGER,
      kaput_fiyat  INTEGER,
      tutar        INTEGER,
      bayi_indirim INTEGER DEFAULT 0,
      rozet        TEXT,
      aciklama     TEXT,
      aktif        BOOLEAN DEFAULT TRUE,
      guncelleme   TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS bayiler (
      id              TEXT PRIMARY KEY,
      isim            TEXT NOT NULL,
      sahip           TEXT,
      tel             TEXT,
      email           TEXT,
      sehir           TEXT,
      adres           TEXT,
      indirim_orani   INTEGER DEFAULT 10,
      aktif           BOOLEAN DEFAULT TRUE,
      kayit_tarihi    TEXT,
      olusturma       TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS personel (
      id        TEXT PRIMARY KEY,
      ad        TEXT NOT NULL,
      rol       TEXT DEFAULT 'teknisyen',
      email     TEXT,
      tel       TEXT,
      aktif     BOOLEAN DEFAULT TRUE,
      yetkiler  JSONB DEFAULT '{}',
      olusturma TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS site_ayarlar (
      anahtar     TEXT PRIMARY KEY,
      deger       JSONB NOT NULL,
      guncelleme  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_rdv_tarih ON randevular(tarih)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rdv_plaka ON randevular(plaka)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rdv_musteri ON randevular(musteri)`;
}
