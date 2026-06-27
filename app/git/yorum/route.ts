import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  let url = 'https://google.com';
  try {
    await initDB();
    const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar='whatsapp_ayar'`;
    if (rows.length > 0 && rows[0].deger && rows[0].deger.yorumUrl) {
      url = rows[0].deger.yorumUrl;
    }
  } catch(e) {}
  return NextResponse.redirect(url, { status: 302 });
}
