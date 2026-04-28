import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireMusteriAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

// ════════════════════════════════════════════════════════
// POST /api/musteri/cark/kupon-kontrol
// Kupon kodu girildikten sonra geçerli mi kontrol eder
// Body: { kupon_kod: 'AUTO-10-XYZ' }
// ════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const auth = requireMusteriAuth(req);
    if (auth instanceof NextResponse) return auth;

    const musteri_id = auth.musteriId;
    const body = await req.json().catch(() => ({}));
    const kupon_kod = (body.kupon_kod || '').trim().toUpperCase();

    if (!kupon_kod) {
      return NextResponse.json(
        { success: false, error: 'Kupon kodu boş olamaz' },
        { status: 400 }
      );
    }

    await ensureDB();

    // Kuponu bul
    const kayit = await sql`
      SELECT id, musteri_id, odul_yuzde, kupon_kod, kullanildi, cevirme_tarih
      FROM cark_kayit
      WHERE kupon_kod = ${kupon_kod}
      LIMIT 1
    `;

    if (kayit.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz kupon kodu' },
        { status: 404 }
      );
    }

    const k: any = kayit[0];

    // Sahibi mi?
    if (k.musteri_id !== musteri_id) {
      return NextResponse.json(
        { success: false, error: 'Bu kupon size ait değil' },
        { status: 403 }
      );
    }

    // Kullanılmış mı?
    if (k.kullanildi) {
      return NextResponse.json(
        { success: false, error: 'Bu kupon daha önce kullanıldı' },
        { status: 400 }
      );
    }

    // Süresi dolmuş mu?
    const cevirilenTarih = new Date(k.cevirme_tarih);
    const sonGun = new Date(cevirilenTarih);
    sonGun.setDate(sonGun.getDate() + 30);
    const simdi = new Date();

    if (simdi > sonGun) {
      return NextResponse.json(
        { success: false, error: 'Bu kuponun süresi dolmuş (30 gün)' },
        { status: 400 }
      );
    }

    // Geçerli — döndür
    const kalanGun = Math.ceil((sonGun.getTime() - simdi.getTime()) / 86400000);

    return NextResponse.json({
      success: true,
      kupon: {
        id: k.id,
        kupon_kod: k.kupon_kod,
        yuzde: k.odul_yuzde,
        kalan_gun: kalanGun,
      },
    });
  } catch (e: any) {
    console.error('[cark/kupon-kontrol] hata:', e);
    return NextResponse.json(
      { success: false, error: e.message || 'Sunucu hatası' },
      { status: 500 }
    );
  }
}
