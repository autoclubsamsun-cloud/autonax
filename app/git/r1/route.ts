import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  let url = 'https://autonax.com.tr/hero-banner-desktop.jpg';
  try {
    await initDB();
    const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar='whatsapp_ayar'`;
    if (rows.length > 0 && rows[0].deger && rows[0].deger.resim1Url) {
      url = rows[0].deger.resim1Url;
    }
  } catch(e) {}
  return NextResponse.redirect(url, { status: 302 });
}
