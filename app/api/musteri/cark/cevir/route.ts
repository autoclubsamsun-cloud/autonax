import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireMusteriAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

const TOPLAM_HAK = 3;
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

// ════════════════════════════════════════════════════════
// POST /api/musteri/cark/cevir — Çarkı çevir
// ════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const auth = requireMusteriAuth(req);
    if (auth instanceof NextResponse) return auth;

    const musteri_id = auth.musteriId;

    await ensureDB();

    // 1. Bu kullanıcı için "session" var mı? (cark_oturum tablosundan)
    let oturum = await sql`
      SELECT kazanan_hak, kullanilan_hak, kazanildi
      FROM cark_oturum
      WHERE musteri_id = ${musteri_id}
      LIMIT 1
    `;

    let kazanan_hak: number;
    let kullanilan_hak: number;
    let kazanildi: boolean;

    if (oturum.length === 0) {
      // İlk kez geliyor → yeni oturum oluştur
      // Kazanma hakkı: 1, 2 veya 3 arasında rastgele
      // Ağırlık: 1.hak %30, 2.hak %30, 3.hak %40 (son hak biraz daha şanslı, suspans için)
      const r = Math.random();
      kazanan_hak = r < 0.30 ? 1 : (r < 0.60 ? 2 : 3);
      kullanilan_hak = 0;
      kazanildi = false;

      await sql`
        INSERT INTO cark_oturum (musteri_id, kazanan_hak, kullanilan_hak, kazanildi)
        VALUES (${musteri_id}, ${kazanan_hak}, 0, FALSE)
      `;
    } else {
      kazanan_hak = (oturum[0] as any).kazanan_hak;
      kullanilan_hak = (oturum[0] as any).kullanilan_hak;
      kazanildi = (oturum[0] as any).kazanildi;
    }

    // Tüm haklar kullanıldıysa kapat
    if (kullanilan_hak >= TOPLAM_HAK) {
      return NextResponse.json(
        { success: false, error: 'Tüm çevirme haklarınızı kullandınız', kalan_hak: 0 },
        { status: 400 }
      );
    }

    // Kupon kazanmışsa artık çeviremez (3 hakkı kullanmadan da bitirebilir)
    if (kazanildi) {
      return NextResponse.json(
        { success: false, error: 'Çark hakkınız bitti', kalan_hak: 0 },
        { status: 400 }
      );
    }

    // Bu çevirme kaçıncı hak?
    const su_anki_hak = kullanilan_hak + 1;

    // Bu hakta kazanacak mı?
    if (su_anki_hak !== kazanan_hak) {
      // KAYBETTİ — "Tekrar Deneyin"
      await sql`
        UPDATE cark_oturum
        SET kullanilan_hak = ${su_anki_hak}
        WHERE musteri_id = ${musteri_id}
      `;

      return NextResponse.json({
        success: true,
        odul: {
          kod: 'TEKRAR_DENE',
          yuzde: 0,
          kupon: null,
          isim: 'Tekrar Deneyin',
        },
        kalan_hak: TOPLAM_HAK - su_anki_hak,
        kazandi: false,
      });
    }

    // KAZANDI — gerçek kupon üret
    // 200/300 mantığı için farklı kullanıcı sayımı
    const distinctSayim = await sql`
      SELECT COUNT(DISTINCT musteri_id)::int AS adet FROM cark_kayit
    `;
    const oncekiFarkliKullanici = Number((distinctSayim[0] as any).adet || 0);
    const yeniFarkliSayi = oncekiFarkliKullanici + 1;

    let odul_yuzde = 5;
    let odul_kod = 'AUTO-05';

    if (yeniFarkliSayi % ESIK_15 === 0) {
      odul_yuzde = 15;
      odul_kod = 'AUTO-15';
    } else if (yeniFarkliSayi % ESIK_10 === 0) {
      odul_yuzde = 10;
      odul_kod = 'AUTO-10';
    }

    // Kupon kodu üret
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
        { success: false, error: 'Sistem hatası, lütfen tekrar deneyin' },
        { status: 500 }
      );
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || null;
    const ua = req.headers.get('user-agent') || null;

    // Kuponu DB'ye yaz
    await sql`
      INSERT INTO cark_kayit (musteri_id, odul_kod, odul_yuzde, kupon_kod, ip_adres, user_agent)
      VALUES (${musteri_id}, ${odul_kod}, ${odul_yuzde}, ${kupon_kod}, ${ip}, ${ua})
    `;

    // Oturumu güncelle: kazandı ve hak kullanıldı
    await sql`
      UPDATE cark_oturum
      SET kullanilan_hak = ${su_anki_hak}, kazanildi = TRUE
      WHERE musteri_id = ${musteri_id}
    `;

    return NextResponse.json({
      success: true,
      odul: {
        kod: odul_kod,
        yuzde: odul_yuzde,
        kupon: kupon_kod,
        isim: `%${odul_yuzde} İndirim Kuponu`,
      },
      kalan_hak: TOPLAM_HAK - su_anki_hak,
      kazandi: true,
    });
  } catch (e: any) {
    console.error('[cark/cevir POST] hata:', e);
    return NextResponse.json(
      { success: false, error: e.message || 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

// ════════════════════════════════════════════════════════
// GET /api/musteri/cark/cevir — Kullanıcı durumu
// ════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const auth = requireMusteriAuth(req);
    if (auth instanceof NextResponse) {
      return NextResponse.json({ success: true, uye: false, kalan_hak: 0, kayitlar: [] });
    }

    const musteri_id = auth.musteriId;

    await ensureDB();

    // Oturum bilgisi (varsa)
    const oturum = await sql`
      SELECT kazanan_hak, kullanilan_hak, kazanildi
      FROM cark_oturum
      WHERE musteri_id = ${musteri_id}
      LIMIT 1
    `;

    let kalan_hak = TOPLAM_HAK;
    let kazanildi = false;

    if (oturum.length > 0) {
      const o = oturum[0] as any;
      kalan_hak = TOPLAM_HAK - o.kullanilan_hak;
      kazanildi = o.kazanildi;
      // Kazandıysa kalan hakkı 0 yap (artık çeviremez)
      if (kazanildi) kalan_hak = 0;
    }

    // Kazanılan kuponlar
    const kayitlar = await sql`
      SELECT id, odul_kod, odul_yuzde, kupon_kod, kullanildi, kullanma_tarih, cevirme_tarih
      FROM cark_kayit
      WHERE musteri_id = ${musteri_id}
      ORDER BY cevirme_tarih DESC
    `;

    return NextResponse.json({
      success: true,
      uye: true,
      kalan_hak,
      kazanildi,
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
      { success: false, error: e.message || 'Sunucu hatası' },
      { status: 500 }
    );
  }
}
