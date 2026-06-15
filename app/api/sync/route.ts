import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() { if (!dbReady) { await initDB(); dbReady = true; } }

/**
 * Lightweight sync endpoint — returns last update timestamps
 * Clients poll this every 15-30 seconds to detect changes
 * Only returns timestamps, not data (minimal bandwidth)
 *
 * GET /api/sync?since=2026-06-15T14:00:00Z
 * Returns: { changed: true/false, timestamps: { randevular, urunler, bayiler, personel } }
 */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();
    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since') || '';

    // Her tablonun son guncelleme zamanini al
    const [rdv, urn, bay, per] = await Promise.all([
      sql`SELECT MAX(guncelleme) as son FROM randevular`,
      sql`SELECT MAX(guncelleme) as son FROM urunler`,
      sql`SELECT MAX(guncelleme) as son FROM bayiler`,
      sql`SELECT MAX(guncelleme) as son FROM personel`,
    ]);

    const timestamps: Record<string, string> = {
      randevular: rdv[0]?.son || '',
      urunler: urn[0]?.son || '',
      bayiler: bay[0]?.son || '',
      personel: per[0]?.son || '',
    };

    // since parametresi varsa, degisiklik olup olmadigini kontrol et
    let changed = false;
    if (!since) {
      // Ilk baglanti — her zaman veri cek
      changed = true;
    } else {
      try {
        const sinceDate = new Date(since).getTime();
        if (isNaN(sinceDate)) {
          changed = true; // Gecersiz tarih — guvenli tarafta kal
        } else {
          changed = Object.values(timestamps).some(t => {
            if (!t) return false;
            const tTime = new Date(t).getTime();
            return !isNaN(tTime) && tTime > sinceDate;
          });
        }
      } catch (e) {
        changed = true; // Hata durumunda guvenli tarafta kal
      }
    }

    return NextResponse.json({
      success: true,
      changed,
      timestamps,
      serverTime: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
