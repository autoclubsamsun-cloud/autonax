import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() { if (!dbReady) { await initDB(); dbReady = true; } }

/**
 * Lightweight sync endpoint
 * GET /api/sync?since=ISO_DATE
 */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();
    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since') || '';

    // randevular ve urunler -> guncelleme sutunu var
    // bayiler ve personel -> sadece olusturma var, guncelleme YOK
    let rdvSon = '', urnSon = '', baySon = '', perSon = '';
    
    try {
      const r = await sql`SELECT MAX(guncelleme) as son FROM randevular`;
      rdvSon = r[0]?.son || '';
    } catch(e) {}
    
    try {
      const r = await sql`SELECT MAX(guncelleme) as son FROM urunler`;
      urnSon = r[0]?.son || '';
    } catch(e) {}
    
    try {
      const r = await sql`SELECT MAX(olusturma) as son FROM bayiler`;
      baySon = r[0]?.son || '';
    } catch(e) {}
    
    try {
      const r = await sql`SELECT MAX(olusturma) as son FROM personel`;
      perSon = r[0]?.son || '';
    } catch(e) {}

    const timestamps = {
      randevular: rdvSon,
      urunler: urnSon,
      bayiler: baySon,
      personel: perSon,
    };

    let changed = false;
    if (!since) {
      changed = true;
    } else {
      try {
        const sinceDate = new Date(since).getTime();
        if (isNaN(sinceDate)) {
          changed = true;
        } else {
          changed = Object.values(timestamps).some(t => {
            if (!t) return false;
            const tTime = new Date(t).getTime();
            return !isNaN(tTime) && tTime > sinceDate;
          });
        }
      } catch (e) {
        changed = true;
      }
    }

    return NextResponse.json({
      success: true,
      changed,
      timestamps,
      serverTime: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
