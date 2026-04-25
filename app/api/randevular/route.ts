import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireAuth, requireAnyAuth, requireMusteriAuth } from '@/lib/utils/auth-check';

// ═══════════════════════════════════════════════════════════════════
// RANDEVULAR API
// ═══════════════════════════════════════════════════════════════════
//
// GET    → admin: tüm randevular | müşteri (?mod=musteri): kendi
// POST   → admin: serbest oluşturma | (Sprint 2B: müşteri kendi randevusu)
// PUT    → admin: serbest güncelleme | müşteri: sadece kendi + sadece iptal
// DELETE → SADECE admin
//
// Sprint 2A: GET müşteri görüntüleme
// Sprint 2B: POST müşteri randevu açma + PUT müşteri iptal
// ═══════════════════════════════════════════════════════════════════

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
    musteriId: r.musteri_id || null,
  };
}

// ─── Hizmet kaplama mı? — slot limit için ─────────────────────────
const GUNLUK_KAPLAMA_LIMIT = 2;

function isKaplamaHizmeti(hizmet: string): boolean {
  if (!hizmet) return false;
  const h = hizmet.toLowerCase();
  // Önce kaplama OLMAYANLAR
  if (/\bön\s*3\s*parça\b|\bkaput\b|\bpasta\b|\byıkama\b|\bdetay\s*temizlik\b|\biç.*dış\s*detay\b|\bcila\b/.test(h)) {
    return false;
  }
  // Sonra kaplama olanlar
  if (/ppf/.test(h) && /(tam\s*araç|full\s*araç|komple\s*araç|tam\b)/.test(h)) return true;
  if (/seramik\s*kaplama/.test(h)) return true;
  if (/\bkombo\b|\bkompozit\b/.test(h)) return true;
  return false;
}

// Tarih DD.MM.YYYY formatı kontrolü ve Pazar günü tespiti
function tarihPazarMi(tarihStr: string): boolean {
  const m = tarihStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return false;
  const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  return d.getDay() === 0;
}

// ═══════════════════════════════════════════════════════════════════
// GET — Admin tüm, Müşteri kendi (?mod=musteri)
// ═══════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  // Hem admin hem müşteri kabul edilir
  const auth = requireAnyAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();
    const { searchParams } = new URL(req.url);
    const tarih = searchParams.get('tarih');
    const durum = searchParams.get('durum');
    const q = searchParams.get('q')?.toLowerCase();
    const mod = searchParams.get('mod'); // 'musteri' = sadece kendi randevuları

    // ─── HOTFIX — Mod kararı ──────────────────────────────────────
    // ESKI: auth.kim === 'musteri' tek başına müşteri modu tetikliyordu
    //       → admin panel müşteri cookie'si de varsa kazara müşteri sanıyordu
    // YENI: Müşteri modu SADECE şu durumda tetiklenir:
    //       1) Açıkça ?mod=musteri query param VAR  (müşteri panelinden çağrılır)
    //       2) VEYA istek atan admin token YOK ve sadece müşteri token VAR
    //       Yani admin token varsa, mod=musteri olmadıkça admin akışı çalışır.
    // ─────────────────────────────────────────────────────────────
    const adminToken = req.cookies.get('autonax_token')?.value;
    const isMusteriRequest = (mod === 'musteri') || (auth.kim === 'musteri' && !adminToken);

    if (isMusteriRequest) {
      // Müşteri ise zorla kendi verilerini çek
      if (auth.kim !== 'musteri') {
        return NextResponse.json(
          { success: false, error: 'Bu mod sadece müşteri girişiyle çalışır' },
          { status: 403 }
        );
      }

      // Önce kendi bilgilerini al (eşleştirme için tel + ad)
      const musteriRows = await sql`
        SELECT id, ad, soyad, tel
        FROM musteriler
        WHERE id = ${auth.musteriId}
        LIMIT 1
      `;
      if (musteriRows.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }
      const m: any = musteriRows[0];
      const adSoyad = ((m.ad || '') + ' ' + (m.soyad || '')).trim().toLowerCase();
      const telDigits = (m.tel || '').replace(/[^0-9]/g, '');

      // Eşleştirme: musteri_id (yeni randevular) + tel/ad (eski randevular)
      // ORDER BY tarih DESC — son randevu en üstte
      const rows = await sql`
        SELECT * FROM randevular
        WHERE
          musteri_id = ${auth.musteriId}
          OR (
            musteri_id IS NULL
            AND (
              REGEXP_REPLACE(COALESCE(tel, ''), '[^0-9]', '', 'g') = ${telDigits}
              OR LOWER(TRIM(COALESCE(musteri, ''))) = ${adSoyad}
            )
          )
        ORDER BY tarih DESC, saat DESC
      `;
      return NextResponse.json({ success: true, data: rows.map(mapRandevu) });
    }

    // ─── ADMIN MODU (mevcut davranış aynen) ───────────────────────
    let rows: any[];
    if (tarih) rows = await sql`SELECT * FROM randevular WHERE tarih=${tarih} ORDER BY saat`;
    else if (durum) rows = await sql`SELECT * FROM randevular WHERE durum=${durum} ORDER BY tarih DESC`;
    else if (q) rows = await sql`SELECT * FROM randevular WHERE LOWER(musteri) LIKE ${'%'+q+'%'} OR LOWER(plaka) LIKE ${'%'+q+'%'} ORDER BY tarih DESC`;
    else rows = await sql`SELECT * FROM randevular ORDER BY tarih DESC, saat`;
    return NextResponse.json({ success: true, data: rows.map(mapRandevu) });
  } catch (e: any) {
    console.error('[RANDEVULAR GET] Hata:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════
// POST — Admin serbest, Müşteri (Sprint 2B): kendi randevusu
// ═══════════════════════════════════════════════════════════════════
//
// Sprint 2A'da: sadece admin POST yapabilir (mevcut davranış aynen).
// Sprint 2B'de: müşteri kendi randevusu açabilir, durum:'bekl' zorunlu.
// ═══════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const auth = requireAnyAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();
    const b = await req.json();
    const id = b.id || 'rdv-' + Date.now();
    let musteriId: string | null = b.musteriId || null;

    // ─── MÜŞTERİ MODU (Sprint 2B) ─────────────────────────────────
    if (auth.kim === 'musteri') {
      // Müşteri kendi adına randevu açıyor — zorunlu kurallar:
      //   1) musteri_id zorla auth'tan gelir (b.musteriId yok sayılır)
      //   2) durum zorla 'bekl' (admin onayı bekler)
      //   3) odendi:false, islem:false zorla
      //   4) Müşteri bilgileri DB'den çekilir (sahte veri girmesin)
      const mRows = await sql`
        SELECT ad, soyad, tel FROM musteriler WHERE id = ${auth.musteriId} LIMIT 1
      `;
      if (mRows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Müşteri bulunamadı' },
          { status: 404 }
        );
      }
      const m: any = mRows[0];
      musteriId = auth.musteriId;
      b.musteri = ((m.ad || '') + ' ' + (m.soyad || '')).trim() || b.musteri || '';
      b.tel = m.tel || b.tel || '';
      b.durum = 'bekl';
      b.odendi = false;
      b.islem = false;
      b.onlineOdeme = false;
      b.faturaNo = null;
      b.faturaDurum = null;
      b.odemeGecmisi = [];
      b.odenenToplam = 0;

      // Validation — minimum alanlar
      if (!b.tarih || !b.saat) {
        return NextResponse.json(
          { success: false, error: 'Tarih ve saat zorunlu' },
          { status: 400 }
        );
      }
      if (!b.plaka) {
        return NextResponse.json(
          { success: false, error: 'Plaka zorunlu' },
          { status: 400 }
        );
      }
      if (!b.hizmet) {
        return NextResponse.json(
          { success: false, error: 'Hizmet seçimi zorunlu' },
          { status: 400 }
        );
      }

      // ─── PAZAR ENGELİ ────────────────────────────────────────
      // Pazar günleri kapalı, müşteri randevu açamaz
      if (tarihPazarMi(b.tarih)) {
        return NextResponse.json(
          { success: false, error: 'Pazar günleri kapalıyız. Lütfen başka bir gün seçin.' },
          { status: 400 }
        );
      }

      // ─── SLOT ÇAKIŞMA KONTROLÜ ──────────────────────────────
      // Sadece kaplama hizmetleri için günlük limit
      // Sayılan durumlar: bekl + onay + tmm + tamamlandi (iptal sayılmaz)
      if (isKaplamaHizmeti(b.hizmet)) {
        const ayniGunRows = await sql`
          SELECT hizmet FROM randevular
          WHERE tarih = ${b.tarih}
            AND durum IN ('bekl', 'onay', 'tmm', 'tamamlandi')
        `;
        let mevcutKaplama = 0;
        for (const r of ayniGunRows) {
          if (isKaplamaHizmeti((r as any).hizmet || '')) mevcutKaplama += 1;
        }
        if (mevcutKaplama >= GUNLUK_KAPLAMA_LIMIT) {
          return NextResponse.json(
            {
              success: false,
              error: `Bu tarih dolu. Günlük kaplama kapasitemiz ${GUNLUK_KAPLAMA_LIMIT}. Başka bir gün seçin.`,
              slot_dolu: true,
            },
            { status: 409 }
          );
        }
      }
    }

    // ─── ADMIN MODU — slot uyarısı (block etmez) ─────────────────
    let slotUyarisi: string | null = null;
    if (auth.kim === 'admin' && b.hizmet && isKaplamaHizmeti(b.hizmet) && b.tarih) {
      const ayniGunRows = await sql`
        SELECT hizmet FROM randevular
        WHERE tarih = ${b.tarih}
          AND durum IN ('bekl', 'onay', 'tmm', 'tamamlandi')
          AND id != ${id}
      `;
      let mevcutKaplama = 0;
      for (const r of ayniGunRows) {
        if (isKaplamaHizmeti((r as any).hizmet || '')) mevcutKaplama += 1;
      }
      if (mevcutKaplama >= GUNLUK_KAPLAMA_LIMIT) {
        slotUyarisi = `Bu tarih için günlük kaplama limiti (${GUNLUK_KAPLAMA_LIMIT}) aşıldı, ${mevcutKaplama} mevcut. Yine de eklendi.`;
      }
    }

    await sql`
      INSERT INTO randevular (
        id, tarih, saat, musteri, tel, plaka, arac, hizmet, tutar,
        odenen_toplam, durum, odendi, islem, online_odeme, fatura_no,
        fatura_durum, odeme_gecmisi, musteri_id
      ) VALUES (
        ${id}, ${b.tarih}, ${b.saat || '09:00'}, ${b.musteri}, ${b.tel || ''},
        ${b.plaka || ''}, ${b.arac || ''}, ${b.hizmet || ''}, ${b.tutar || 0},
        ${b.odenenToplam || 0}, ${b.durum || 'bekl'}, ${b.odendi || false},
        ${b.islem || false}, ${b.onlineOdeme || false}, ${b.faturaNo || null},
        ${b.faturaDurum || null}, ${JSON.stringify(b.odemeGecmisi || [])}::jsonb,
        ${musteriId}
      )
      ON CONFLICT (id) DO UPDATE SET
        tarih = ${b.tarih}, saat = ${b.saat || '09:00'}, musteri = ${b.musteri},
        tel = ${b.tel || ''}, plaka = ${b.plaka || ''}, arac = ${b.arac || ''},
        hizmet = ${b.hizmet || ''}, tutar = ${b.tutar || 0},
        odenen_toplam = ${b.odenenToplam || 0}, durum = ${b.durum || 'bekl'},
        odendi = ${b.odendi || false}, islem = ${b.islem || false},
        fatura_no = ${b.faturaNo || null}, fatura_durum = ${b.faturaDurum || null},
        odeme_gecmisi = ${JSON.stringify(b.odemeGecmisi || [])}::jsonb,
        guncelleme = NOW()
    `;
    return NextResponse.json({
      success: true,
      data: { ...b, id, musteriId },
      slotUyarisi,  // admin için: kapasite aşımı uyarısı (varsa)
    }, { status: 201 });
  } catch (e: any) {
    console.error('[RANDEVULAR POST] Hata:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════
// PUT — Admin: serbest | Müşteri: sadece kendi + sadece iptal/değişim
// ═══════════════════════════════════════════════════════════════════

export async function PUT(req: NextRequest) {
  const auth = requireAnyAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();
    const b = await req.json();
    if (!b.id) return NextResponse.json({ success: false, error: 'ID gerekli' }, { status: 400 });

    // ─── MÜŞTERİ MODU ─────────────────────────────────────────────
    if (auth.kim === 'musteri') {
      // Müşteri sadece kendi randevusunu güncelleyebilir
      // Şu an SADECE iptal etme yetkisi (durum:'iptal') var.
      const rdvRows = await sql`
        SELECT musteri_id, durum FROM randevular WHERE id = ${b.id} LIMIT 1
      `;
      if (rdvRows.length === 0) {
        return NextResponse.json({ success: false, error: 'Randevu bulunamadı' }, { status: 404 });
      }
      const r: any = rdvRows[0];
      if (r.musteri_id !== auth.musteriId) {
        return NextResponse.json(
          { success: false, error: 'Bu randevu size ait değil' },
          { status: 403 }
        );
      }
      if (r.durum === 'iptal') {
        return NextResponse.json(
          { success: false, error: 'Zaten iptal edilmiş' },
          { status: 400 }
        );
      }
      if (r.durum === 'tamamlandi' || r.durum === 'tmm') {
        return NextResponse.json(
          { success: false, error: 'Tamamlanmış randevu iptal edilemez' },
          { status: 400 }
        );
      }
      // Müşteri sadece iptal edebilir
      if (b.durum !== 'iptal') {
        return NextResponse.json(
          { success: false, error: 'Müşteri sadece iptal yapabilir' },
          { status: 403 }
        );
      }
      await sql`
        UPDATE randevular SET durum = 'iptal', guncelleme = NOW()
        WHERE id = ${b.id} AND musteri_id = ${auth.musteriId}
      `;
      return NextResponse.json({ success: true, data: { id: b.id, durum: 'iptal' } });
    }

    // ─── ADMIN MODU (mevcut davranış aynen) ───────────────────────
    await sql`
      UPDATE randevular SET
        tarih = ${b.tarih}, saat = ${b.saat}, musteri = ${b.musteri},
        tel = ${b.tel || ''}, plaka = ${b.plaka || ''}, arac = ${b.arac || ''},
        hizmet = ${b.hizmet || ''}, tutar = ${b.tutar || 0},
        odenen_toplam = ${b.odenenToplam || 0}, durum = ${b.durum || 'bekl'},
        odendi = ${b.odendi || false}, islem = ${b.islem || false},
        fatura_no = ${b.faturaNo || null}, fatura_durum = ${b.faturaDurum || null},
        odeme_gecmisi = ${JSON.stringify(b.odemeGecmisi || [])}::jsonb,
        guncelleme = NOW()
      WHERE id = ${b.id}
    `;
    return NextResponse.json({ success: true, data: b });
  } catch (e: any) {
    console.error('[RANDEVULAR PUT] Hata:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════
// DELETE — SADECE ADMIN (kalıcı silme)
// ═══════════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);  // sadece admin
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID gerekli' }, { status: 400 });
    await sql`DELETE FROM randevular WHERE id=${id}`;
    return NextResponse.json({ success: true, message: 'Silindi' });
  } catch (e: any) {
    console.error('[RANDEVULAR DELETE] Hata:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
