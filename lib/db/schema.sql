-- Autonax Veritabanı Şeması
-- Neon Postgres (Frankfurt)

-- Müşteriler
CREATE TABLE IF NOT EXISTS musteriler (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  ad          TEXT NOT NULL,
  tel         TEXT,
  email       TEXT,
  plaka       TEXT,
  arac        TEXT,
  sifre_hash  TEXT,
  olusturma   TIMESTAMPTZ DEFAULT NOW(),
  guncelleme  TIMESTAMPTZ DEFAULT NOW()
);

-- Randevular
CREATE TABLE IF NOT EXISTS randevular (
  id              TEXT PRIMARY KEY DEFAULT 'rdv-' || gen_random_uuid()::TEXT,
  tarih           TEXT NOT NULL,
  saat            TEXT NOT NULL DEFAULT '09:00',
  musteri         TEXT NOT NULL,
  tel             TEXT,
  plaka           TEXT,
  arac            TEXT,
  hizmet          TEXT,
  tutar           INTEGER DEFAULT 0,
  odenen_toplam   INTEGER DEFAULT 0,
  durum           TEXT DEFAULT 'bekl' CHECK (durum IN ('onay','bekl','iptal')),
  odendi          BOOLEAN DEFAULT FALSE,
  islem           BOOLEAN DEFAULT FALSE,
  online_odeme    BOOLEAN DEFAULT FALSE,
  fatura_no       TEXT,
  fatura_durum    TEXT,
  musteri_id      TEXT REFERENCES musteriler(id),
  olusturma       TIMESTAMPTZ DEFAULT NOW(),
  guncelleme      TIMESTAMPTZ DEFAULT NOW()
);

-- Ödeme Geçmişi
CREATE TABLE IF NOT EXISTS odemeler (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  randevu_id  TEXT REFERENCES randevular(id) ON DELETE CASCADE,
  tarih       TEXT NOT NULL,
  yontem      TEXT DEFAULT 'Nakit',
  miktar      INTEGER NOT NULL,
  not_        TEXT,
  banka       TEXT,
  kart_no     TEXT,
  taksit      TEXT,
  komisyon    INTEGER DEFAULT 0,
  olusturma   TIMESTAMPTZ DEFAULT NOW()
);

-- Ürünler / Fiyatlar
CREATE TABLE IF NOT EXISTS urunler (
  id          TEXT PRIMARY KEY,
  isim        TEXT NOT NULL,
  kat         TEXT,
  alt_kat     TEXT,
  garanti     INTEGER,
  full_fiyat  INTEGER,
  on3_fiyat   INTEGER,
  kaput_fiyat INTEGER,
  tutar       INTEGER,
  bayi_indirim INTEGER DEFAULT 0,
  rozet       TEXT,
  aciklama    TEXT,
  aktif       BOOLEAN DEFAULT TRUE,
  guncelleme  TIMESTAMPTZ DEFAULT NOW()
);

-- Bayiler
CREATE TABLE IF NOT EXISTS bayiler (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
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
);

-- Personel
CREATE TABLE IF NOT EXISTS personel (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  ad        TEXT NOT NULL,
  rol       TEXT DEFAULT 'teknisyen',
  email     TEXT,
  tel       TEXT,
  aktif     BOOLEAN DEFAULT TRUE,
  yetkiler  JSONB DEFAULT '{}',
  olusturma TIMESTAMPTZ DEFAULT NOW()
);

-- Maliyet Kalemleri
CREATE TABLE IF NOT EXISTS maliyet_kalemleri (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  urun_kodu   TEXT NOT NULL,
  urun_isim   TEXT NOT NULL,
  kalem_isim  TEXT NOT NULL,
  tutar       INTEGER DEFAULT 0,
  sira        INTEGER DEFAULT 0,
  guncelleme  TIMESTAMPTZ DEFAULT NOW()
);

-- Site Ayarları
CREATE TABLE IF NOT EXISTS site_ayarlar (
  anahtar     TEXT PRIMARY KEY,
  deger       JSONB NOT NULL,
  guncelleme  TIMESTAMPTZ DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_randevular_tarih ON randevular(tarih);
CREATE INDEX IF NOT EXISTS idx_randevular_musteri ON randevular(musteri);
CREATE INDEX IF NOT EXISTS idx_randevular_plaka ON randevular(plaka);
CREATE INDEX IF NOT EXISTS idx_odemeler_randevu ON odemeler(randevu_id);
CREATE INDEX IF NOT EXISTS idx_musteriler_tel ON musteriler(tel);
CREATE INDEX IF NOT EXISTS idx_musteriler_plaka ON musteriler(plaka);
