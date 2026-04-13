import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

async function getCredentials() {
  const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar='admin_credentials'`;
  if (rows.length > 0) {
    const c = rows[0].deger as any;
    return { username: c.username||'admin', password: c.password||'admin123' };
  }
  return { username: 'admin', password: 'admin123' };
}

export async function POST(req: NextRequest) {
  try {
    await ensureDB();
    const { username, password, action } = await req.json();

    if (action === 'get_credentials') {
      const creds = await getCredentials();
      return NextResponse.json({ success: true, ...creds });
    }

    if (action === 'login') {
      const creds = await getCredentials();
      if (username === creds.username && password === creds.password) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false, error: 'Hatalı giriş' }, { status: 401 });
    }

    if (action === 'update') {
      await sql`INSERT INTO site_ayarlar (anahtar,deger) VALUES ('admin_credentials',${JSON.stringify({username,password})}::jsonb) ON CONFLICT (anahtar) DO UPDATE SET deger=${JSON.stringify({username,password})}::jsonb,guncelleme=NOW()`;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
