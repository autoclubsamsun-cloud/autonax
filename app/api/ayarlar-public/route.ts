import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';

let dbReady = false;
async function ensureDB() { if (!dbReady) { await initDB(); dbReady = true; } }

// PUBLIC endpoint - giriş gerektirmez
// Marka sayfaları ve ana sayfa için public verileri döndürür
// Hassas admin verilerini (kullanıcılar, faturalar, müşteriler vb) dışlar
export async function GET(req: NextRequest) {
  try {
    await ensureDB();
    const rows = await sql`SELECT anahtar, deger FROM site_ayarlar`;
    const ayarlar: any = {};
    rows.forEach((r: any) => { ayarlar[r.anahtar] = r.deger; });

    // Sadece public verileri döndür
    const publicData: any = {};
    if (ayarlar.markalar_v1) publicData.markalar_v1 = ayarlar.markalar_v1;
    if (ayarlar.site_ayarlar) publicData.site_ayarlar = ayarlar.site_ayarlar;
    if (ayarlar.genel) publicData.genel = ayarlar.genel;

    // Geriye uyumluluk için top-level site_ayarlar da ekle
    const site_ayarlar = ayarlar.site_ayarlar || null;

    const response = NextResponse.json({
      success: true,
      data: publicData,
      site_ayarlar: site_ayarlar
    });
    // CDN cache - 30 saniye (panel değişiklikleri hızlı yansısın)
    response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
