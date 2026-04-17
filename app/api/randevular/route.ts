import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}
function mapRandevu(r: any) {
  return {
    id: r.id, tarih: r.tarih, saat: r.saat, musteri: r.musteri, tel: r.tel,
    plaka: r.plaka, arac: r.arac, hizmet: r.hizmet, tutar: r.tutar,
    odenenToplam: r.odenen_toplam, durum: r.durum, odendi: r.odendi,
    islem: r.islem, onlineOdeme: r.online_odeme, faturaNo: r.fatura_no,
    faturaDurum: r.fatura_durum, odemeGecmisi: r.odeme_gecmisi || [],
  };
}
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const { searchParams } = new URL(req.url);
    const tarih = searchParams.get('tarih');
    const durum = searchParams.get('durum');
    const q = searchParams.get('q')?.toLowerCase();
    let rows: any[];
    if (tarih) rows = await sql`SELECT * FROM randevular WHERE tarih=${tarih} ORDER BY saat`;
    else if (durum) rows = await sql`SELECT * FROM randevular WHERE durum=${durum} ORDER BY tarih DESC`;
    else if (q) rows = await sql`SELECT * FROM randevular WHERE LOWER(musteri) LIKE ${'%'+q+'%'} OR LOWER(plaka) LIKE ${'%'+q+'%'} ORDER BY tarih DESC`;
    else rows = await sql`SELECT * FROM randevular ORDER BY tarih DESC, saat`;
    return NextResponse.json({ success: true, data: rows.map(mapRandevu) });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const b = await req.json();
    const id = b.id || 'rdv-' + Date.now();
    await sql`INSERT INTO randevular (id,tarih,saat,musteri,tel,plaka,arac,hizmet,tutar,odenen_toplam,durum,odendi,islem,online_odeme,fatura_no,fatura_durum,odeme_gecmisi) VALUES (${id},${b.tarih},${b.saat||'09:00'},${b.musteri},${b.tel||''},${b.plaka||''},${b.arac||''},${b.hizmet||''},${b.tutar||0},${b.odenenToplam||0},${b.durum||'bekl'},${b.odendi||false},${b.islem||false},${b.onlineOdeme||false},${b.faturaNo||null},${b.faturaDurum||null},${JSON.stringify(b.odemeGecmisi||[])}::jsonb)`;
    return NextResponse.json({ success: true, data: { ...b, id } }, { status: 201 });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const b = await req.json();
    if (!b.id) return NextResponse.json({ success: false, error: 'ID gerekli' }, { status: 400 });
    await sql`UPDATE randevular SET tarih=${b.tarih},saat=${b.saat},musteri=${b.musteri},tel=${b.tel||''},plaka=${b.plaka||''},arac=${b.arac||''},hizmet=${b.hizmet||''},tutar=${b.tutar||0},odenen_toplam=${b.odenenToplam||0},durum=${b.durum||'bekl'},odendi=${b.odendi||false},islem=${b.islem||false},fatura_no=${b.faturaNo||null},fatura_durum=${b.faturaDurum||null},odeme_gecmisi=${JSON.stringify(b.odemeGecmisi||[])}::jsonb,guncelleme=NOW() WHERE id=${b.id}`;
    return NextResponse.json({ success: true, data: b });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID gerekli' }, { status: 400 });
    await sql`DELETE FROM randevular WHERE id=${id}`;
    return NextResponse.json({ success: true, message: 'Silindi' });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
