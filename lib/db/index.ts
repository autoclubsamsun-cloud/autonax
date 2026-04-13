import { neon } from '@neondatabase/serverless';
if (!process.env.POSTGRES_URL) { throw new Error('POSTGRES_URL environment variable is not set'); }
export const sql = neon(process.env.POSTGRES_URL);
export async function initDB() {
  await sql`CREATE TABLE IF NOT EXISTS randevular (id TEXT PRIMARY KEY, tarih TEXT NOT NULL, saat TEXT NOT NULL DEFAULT '09:00', musteri TEXT NOT NULL, tel TEXT, plaka TEXT, arac TEXT, hizmet TEXT, tutar INTEGER DEFAULT 0, odenen_toplam INTEGER DEFAULT 0, durum TEXT DEFAULT 'bekl', odendi BOOLEAN DEFAULT FALSE, islem BOOLEAN DEFAULT FALSE, online_odeme BOOLEAN DEFAULT FALSE, fatura_no TEXT, fatura_durum TEXT, odeme_gecmisi JSONB DEFAULT '[]', olusturma TIMESTAMPTZ DEFAULT NOW(), guncelleme TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS urunler (id TEXT PRIMARY KEY, isim TEXT NOT NULL, kat TEXT, alt_kat TEXT, garanti INTEGER, full_fiyat INTEGER, on3_fiyat INTEGER, kaput_fiyat INTEGER, tutar INTEGER, bayi_indirim INTEGER DEFAULT 0, mikron TEXT, mensei TEXT, fiyat_34 INTEGER DEFAULT 0, rozet TEXT, aciklama TEXT, resim TEXT, aktif BOOLEAN DEFAULT TRUE, guncelleme TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS hizmet_bolumleri (id TEXT PRIMARY KEY, isim TEXT NOT NULL, ikon TEXT DEFAULT '🔧', alt_baslik TEXT DEFAULT '', aciklama TEXT DEFAULT '', nav_kat TEXT DEFAULT '', sira INTEGER DEFAULT 0, aktif BOOLEAN DEFAULT TRUE, olusturma TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS hizmet_kartlari (id TEXT PRIMARY KEY, bolum_id TEXT REFERENCES hizmet_bolumleri(id) ON DELETE CASCADE, isim TEXT NOT NULL, alt_isim TEXT DEFAULT '', aciklama TEXT DEFAULT '', fiyat INTEGER DEFAULT 0, fiyat_str TEXT DEFAULT '', resim TEXT, rozet TEXT DEFAULT '', garanti TEXT DEFAULT '', ozellikler TEXT DEFAULT '', sira INTEGER DEFAULT 0, aktif BOOLEAN DEFAULT TRUE, olusturma TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS bayiler (id TEXT PRIMARY KEY, isim TEXT NOT NULL, sahip TEXT, tel TEXT, email TEXT, sehir TEXT, adres TEXT, indirim_orani INTEGER DEFAULT 10, aktif BOOLEAN DEFAULT TRUE, kayit_tarihi TEXT, olusturma TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS personel (id TEXT PRIMARY KEY, ad TEXT NOT NULL, rol TEXT DEFAULT 'teknisyen', email TEXT, tel TEXT, aktif BOOLEAN DEFAULT TRUE, yetkiler JSONB DEFAULT '{}', olusturma TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS site_ayarlar (anahtar TEXT PRIMARY KEY, deger JSONB NOT NULL, guncelleme TIMESTAMPTZ DEFAULT NOW())`;
  await sql`ALTER TABLE urunler ADD COLUMN IF NOT EXISTS resim TEXT`;
  await sql`ALTER TABLE urunler ADD COLUMN IF NOT EXISTS mikron TEXT`;
  await sql`ALTER TABLE urunler ADD COLUMN IF NOT EXISTS mensei TEXT`;
  await sql`ALTER TABLE urunler ADD COLUMN IF NOT EXISTS fiyat_34 INTEGER DEFAULT 0`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rdv_tarih ON randevular(tarih)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rdv_plaka ON randevular(plaka)`;
}
