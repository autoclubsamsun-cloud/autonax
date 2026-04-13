import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
let dbReady = false;
async function ensureDB() { if (!dbReady) { await initDB(); dbReady = true; } }
export async function GET() {
  try {
    await ensureDB();
    const bolumleri = await sql`SELECT * FROM hizmet_bolumleri ORDER BY sira, olusturma`;
    const kartlar = await sql`SELECT * FROM hizmet_kartlari WHERE aktif=true ORDER BY sira, olusturma`;
    const data = bolumleri.map((b: any) => ({ ...b, kartlar: kartlar.filter((k: any) => k.bolum_id === b.id) }));
    return NextResponse.json({ success: true, data });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  try {
    await ensureDB();
    const b = await req.json();
    const id = b.id || ('bol-' + Date.now());
    await sql`INSERT INTO hizmet_bolumleri (id,isim,ikon,alt_baslik,nav_kat,sira,aktif) VALUES (${id},${b.isim},${b.ikon||'🔧'},${b.altBaslik||''},${b.navKat||''},${b.sira||0},${b.aktif!==false}) ON CONFLICT (id) DO UPDATE SET isim=${b.isim},ikon=${b.ikon||'🔧'},alt_baslik=${b.altBaslik||''},nav_kat=${b.navKat||''},sira=${b.sira||0},aktif=${b.aktif!==false}`;
    return NextResponse.json({ success: true, data: { ...b, id } }, { status: 201 });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
export async function DELETE(req: NextRequest) {
  try {
    await ensureDB();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID gerekli' }, { status: 400 });
    await sql`DELETE FROM hizmet_bolumleri WHERE id=${id}`;
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
