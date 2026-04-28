import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireMusteriAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

const MAX_HAK = 3;
const ESIK_10 = 200;
const ESIK_15 = 300;

function rastgeleKod(): string {
  const harfler = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 5; i++) {
    r += harfler[Math.floor(Math.random() * harfler.length)];
  }
  return r;
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireMusteriAuth(req);
    if (auth instanceof NextResponse) return auth;

    const musteri_id = auth.musteriId;

    await ensureDB();

    const sayim = await sql`
      SELECT COUNT(*)::int AS adet FROM cark_kayit WHERE musteri_id = ${musteri_id}
    `;
    const cevirilenSayi = Number((sayim[0] as any).adet || 0);

    if (cevirilenSayi >= MAX_HAK) {
      return NextResponse.json(
        { success: false, error: 'Tum cevirme haklarinizi kullandiniz', kalan_hak: 0 },
        { status: 400 }
      );
    }

    const distinctSayim = await sql`
      SELECT COUNT(DISTINCT musteri_id)::int AS adet FROM cark_kayit
    `;
    const oncekiFarkliKullanici = Number((distinctSayim[0] as any).adet || 0);

    const yeniFarkliSayi = (cevirilenSayi === 0)
      ? oncekiFarkliKullanici + 1
      : oncekiFarkliKullanici;

    let odul_yuzde = 5;
    let odul_kod = 'AUTO-05';

    if (cevirilenSayi === 0) {
      if (yeniFarkliSayi % ESIK_15 === 0) {
        odul_yuzde = 15;
        odul_kod = 'AUTO-15';
      }
      else if (yeniFarkliSayi % ESIK_10 === 0) {
        odul_yuzde = 10;
        odul_kod = 'AUTO-10';
      }
    }

    let kupon_kod = '';
    let denemeler = 0;
    while (denemeler < 5) {
      kupon_kod = `${odul_kod}-${rastgeleKod()}`;
      const mevcut = await sql`SELECT 1 FROM cark_kayit WHERE kupon_kod = ${kupon_kod} LIMIT 1`;
      if (mevcut.length === 0) break;
      denemeler++;
    }
    if (denemeler >= 5) {
      return NextResponse.json(
        { success: false, error: 'Sistem hatasi, lutfen tekrar deneyin' },
        { status: 500 }
      );
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || null;
    const ua = req.headers.get('user-agent') || null;

    await sql`
      INSERT INTO cark_kayit (musteri_id, odul_kod, odul_yuzde, kupon_kod, ip_adres, user_agent)
      VALUES (${musteri_id}, ${odul_kod}, ${odul_yuzde}, ${kupon_kod}, ${ip}, ${ua})
    `;

    return NextResponse.json({
      success: true,
      odul: {
        kod: odul_kod,
        yuzde: odul_yuzde,
        kupon: kupon_kod,
        isim: `%${odul_yuzde} Indirim Kuponu`,
      },
      kalan_hak: MAX_HAK - (cevirilenSayi + 1),
    });
  } catch (e: any) {
    console.error('[cark/cevir POST] hata:', e);
    return NextResponse.json(
      { success: false, error: e.message || 'Sunucu hatasi' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireMusteriAuth(req);
    if (auth instanceof NextResponse) {
      return NextResponse.json({ success: true, uye: false, kalan_hak: 0, kayitlar: [] });
    }

    const musteri_id = auth.musteriId;

    await ensureDB();

    const kayitlar = await sql`
      SELECT id, odul_kod, odul_yuzde, kupon_kod, kullanildi, kullanma_tarih, cevirme_tarih
      FROM cark_kayit
      WHERE musteri_id = ${musteri_id}
      ORDER BY cevirme_tarih DESC
    `;

    return NextResponse.json({
      success: true,
      uye: true,
      kalan_hak: MAX_HAK - kayitlar.length,
      kayitlar: kayitlar.map((k: any) => ({
        id: k.id,
        kupon_kod: k.kupon_kod,
        odul_yuzde: k.odul_yuzde,
        odul_kod: k.odul_kod,
        kullanildi: k.kullanildi,
        kullanma_tarih: k.kullanma_tarih,
        cevirme_tarih: k.cevirme_tarih,
      })),
    });
  } catch (e: any) {
    console.error('[cark/cevir GET] hata:', e);
    return NextResponse.json(
      { success: false, error: e.message || 'Sunucu hatasi' },
      { status: 500 }
    );
  }
}