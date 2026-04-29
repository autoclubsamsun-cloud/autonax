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

// ─── SLOT KONTROL — günlük kaplama limiti + pazar engeli ──────────
const GUNLUK_KAPLAMA_LIMIT = 2;

function isKaplamaHizmeti(hizmet: string): boolean {
  if (!hizmet) return false;
  const h = hizmet.toLowerCase();
  // Önce kaplama OLMAYANLAR (öncelikli)
  if (/\bön\s*3\s*parça\b|\bkaput\b|\bpasta\b|\byıkama\b|\bdetay\s*temizlik\b|\biç.*dış\s*detay\b|\bcila\b/.test(h)) {
    return false;
  }
  // Sonra kaplama olanlar
  if (/ppf/.test(h) && /(tam\s*araç|full\s*araç|komple\s*araç|tam\b)/.test(h)) return true;
  if (/seramik\s*kaplama/.test(h)) return true;
  if (/\bkombo\b|\bkompozit\b/.test(h)) return true;
  return false;
}

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

    // ─── HOTFIX 3 — GET'te mod=musteri zorlama (POST/PUT ile aynı mantık) ──
    // ESKI: auth.kim === 'musteri' tek başına müşteri modu tetikliyordu
    //       → admin panel müşteri cookie'si de varsa kazara müşteri sanıyordu
    // HOTFIX 2: POST/PUT'a mod=musteri zorla eklendi
    // HOTFIX 3: GET'e de aynı mantık eklendi (önceden 403 dönüyordu çünkü
    //   admin token varsa auth.kim='admin', mod=musteri kontrolü 403 atıyordu)
    // YENI: Müşteri modu SADECE şu durumda tetiklenir:
    //       1) Açıkça ?mod=musteri query param VAR (müşteri panelinden çağrılır)
    //       2) VEYA istek atan admin token YOK ve sadece müşteri token VAR
    //       Yani admin token varsa, mod=musteri olmadıkça admin akışı çalışır.
    // ─────────────────────────────────────────────────────────────
    const adminToken = req.cookies.get('autonax_token')?.value;
    const isMusteriRequest = (mod === 'musteri') || (auth.kim === 'musteri' && !adminToken);

    if (isMusteriRequest) {
      // Müşteri ID'sini doğru kaynaktan al (admin token olsa bile mod=musteri zorlandıysa)
      let aktiveMusteriId: string | null = null;
      if (auth.kim === 'musteri') {
        aktiveMusteriId = auth.musteriId;
      } else if (mod === 'musteri') {
        // Admin token kullanıldı ama mod=musteri zorlandı → müşteri cookie'sinden ID al
        const musteriToken = req.cookies.get('autonax_musteri_token')?.value;
        if (!musteriToken) {
          return NextResponse.json(
            { success: false, error: 'Müşteri girişi yok' },
            { status: 401 }
          );
        }
        try {
          const parts = musteriToken.split('.');
          if (parts.length !== 3) throw new Error('Geçersiz token');
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
          if (Date.now() / 1000 > payload.exp) throw new Error('Süresi dolmuş');
          aktiveMusteriId = payload.sub;
        } catch (e) {
          return NextResponse.json(
            { success: false, error: 'Müşteri oturumu geçersiz' },
            { status: 401 }
          );
        }
      }

      if (!aktiveMusteriId) {
        return NextResponse.json(
          { success: false, error: 'Müşteri kimliği bulunamadı' },
          { status: 401 }
        );
      }

      // Önce kendi bilgilerini al (eşleştirme için tel + ad)
      const musteriRows = await sql`
        SELECT id, ad, soyad, tel
        FROM musteriler
        WHERE id = ${aktiveMusteriId}
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
          musteri_id = ${aktiveMusteriId}
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

    // ─── HOTFIX2 — Müşteri akışını ?mod=musteri ile zorla ─────────
    const { searchParams } = new URL(req.url);
    const modIsMusteri = searchParams.get('mod') === 'musteri';

    // Müşteri akışı: ya zorla ya da gerçekten müşteri token tek başına
    let aktiveMusteriId: string | null = null;
    if (auth.kim === 'musteri') {
      aktiveMusteriId = auth.musteriId;
    } else if (modIsMusteri) {
      // Admin token kullanıldı ama mod=musteri zorlandı → müşteri cookie'sinden ID al
      const musteriToken = req.cookies.get('autonax_musteri_token')?.value;
      if (!musteriToken) {
        return NextResponse.json(
          { success: false, error: 'Müşteri girişi yok' },
          { status: 401 }
        );
      }
      try {
        const parts = musteriToken.split('.');
        if (parts.length !== 3) throw new Error('Geçersiz token');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (Date.now() / 1000 > payload.exp) throw new Error('Süresi dolmuş');
        aktiveMusteriId = payload.sub;
      } catch (e) {
        return NextResponse.json(
          { success: false, error: 'Müşteri oturumu geçersiz' },
          { status: 401 }
        );
      }
    }

    // ─── MÜŞTERİ MODU (Sprint 2B) ─────────────────────────────────
    if (aktiveMusteriId) {
      // Müşteri kendi adına randevu açıyor — zorunlu kurallar:
      //   1) musteri_id zorla auth'tan gelir (b.musteriId yok sayılır)
      //   2) durum zorla 'bekl' (admin onayı bekler)
      //   3) odendi:false, islem:false zorla
      //   4) Müşteri bilgileri DB'den çekilir (sahte veri girmesin)
      const mRows = await sql`
        SELECT ad, soyad, tel FROM musteriler WHERE id = ${aktiveMusteriId} LIMIT 1
      `;
      if (mRows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Müşteri bulunamadı' },
          { status: 404 }
        );
      }
      const m: any = mRows[0];
      musteriId = aktiveMusteriId;
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
      // Müşteri Pazar günü randevu açamaz
      if (tarihPazarMi(b.tarih)) {
        return NextResponse.json(
          { success: false, error: 'Pazar günleri kapalıyız. Lütfen başka bir gün seçin.' },
          { status: 400 }
        );
      }

      // ─── SLOT ÇAKIŞMA KONTROLÜ ──────────────────────────────
      // Sadece kaplama hizmetleri için günlük limit (bekl + onay + tmm + tamamlandi)
      if (isKaplamaHizmeti(b.hizmet)) {
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

    // ─── ADMIN MODU — slot uyarısı (block etmez, sadece bilgilendirir) ──
    let slotUyarisi: string | null = null;
    if (auth.kim === 'admin' && b.hizmet && isKaplamaHizmeti(b.hizmet) && b.tarih && !aktiveMusteriId) {
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

    // ─── KUPON İŞARETLEME ─────────────────────────────────────────
    // Body'de kupon_kod varsa, kuponu "kullanıldı" işaretle ve randevuya bağla
    // Hata olursa randevu yine kaydedilir, sadece logla
    if (b.kupon_kod && typeof b.kupon_kod === 'string') {
      try {
        const kuponKod = b.kupon_kod.trim().toUpperCase();
        // Sadece bu müşterinin kuponuysa ve henüz kullanılmamışsa işaretle
        const ownerCheck = aktiveMusteriId
          ? await sql`SELECT id FROM cark_kayit WHERE kupon_kod = ${kuponKod} AND musteri_id = ${aktiveMusteriId} AND kullanildi = FALSE LIMIT 1`
          : await sql`SELECT id FROM cark_kayit WHERE kupon_kod = ${kuponKod} AND kullanildi = FALSE LIMIT 1`;
        if (ownerCheck.length > 0) {
          await sql`
            UPDATE cark_kayit
            SET kullanildi = TRUE,
                kullanma_tarih = NOW(),
                rezerve_randevu_id = ${id}
            WHERE kupon_kod = ${kuponKod}
          `;
        }
      } catch (kupErr: any) {
        // Kupon işaretleme hatası kritik değil, randevu yine geçerli
        console.warn('[RANDEVULAR POST] Kupon işaretleme uyarısı:', kupErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...b, id, musteriId },
      slotUyarisi,
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

    // ─── HOTFIX2 — Müşteri modu zorla ──────────────────────────────
    // Aynı tarayıcıda admin + müşteri cookie'si bir arada olabilir.
    // requireAnyAuth admin'i önce verir, ama müşteri kendi panelinden
    // ?mod=musteri query param ile gelirse müşteri akışını zorlamalıyız.
    const { searchParams } = new URL(req.url);
    const modIsMusteri = searchParams.get('mod') === 'musteri';

    // Müşteri akışı: ya zorla (?mod=musteri) ya da gerçekten müşteri token tek başına
    if (modIsMusteri || auth.kim === 'musteri') {
      // Müşteri zorla mı geldi ama admin token'ı varsa? Müşteri token'ı verify et
      // Çünkü auth.kim === 'admin' olabilir ama müşteri panelinden geldi
      let musteriId: string | null = null;
      if (auth.kim === 'musteri') {
        musteriId = auth.musteriId;
      } else {
        // Admin token kullanıldı ama mod=musteri zorlandı.
        // Müşteri cookie'sinden ID al
        const musteriToken = req.cookies.get('autonax_musteri_token')?.value;
        if (!musteriToken) {
          return NextResponse.json(
            { success: false, error: 'Müşteri girişi yok' },
            { status: 401 }
          );
        }
        // Token'ı verify et - basit bir parse (auth-check.ts'deki mantık)
        try {
          const parts = musteriToken.split('.');
          if (parts.length !== 3) throw new Error('Geçersiz token');
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
          if (Date.now() / 1000 > payload.exp) throw new Error('Süresi dolmuş');
          musteriId = payload.sub;
        } catch (e) {
          return NextResponse.json(
            { success: false, error: 'Müşteri oturumu geçersiz' },
            { status: 401 }
          );
        }
      }

      if (!musteriId) {
        return NextResponse.json(
          { success: false, error: 'Müşteri kimliği bulunamadı' },
          { status: 401 }
        );
      }

      // Müşteri sadece kendi randevusunu güncelleyebilir
      // Şu an SADECE iptal etme yetkisi (durum:'iptal') var.
      const rdvRows = await sql`
        SELECT musteri_id, durum, tel, musteri FROM randevular WHERE id = ${b.id} LIMIT 1
      `;
      if (rdvRows.length === 0) {
        return NextResponse.json({ success: false, error: 'Randevu bulunamadı' }, { status: 404 });
      }
      const r: any = rdvRows[0];

      // ─── SAHİPLİK KONTROLÜ — fallback ile ────────────────────
      // 1) musteri_id eşleşiyor → kesinlikle bu kişiye ait
      // 2) musteri_id NULL ama tel veya ad eşleşiyor → eski randevu, atayalım
      // 3) Hiçbiri → reddet
      let sahip = false;
      let migrate = false;  // musteri_id atama yapacak mıyız

      if (r.musteri_id === musteriId) {
        sahip = true;
      } else if (r.musteri_id === null || r.musteri_id === undefined) {
        // Eski kayıt — tel/ad fallback ile doğrula
        const userRows = await sql`
          SELECT ad, soyad, tel FROM musteriler WHERE id = ${musteriId} LIMIT 1
        `;
        if (userRows.length > 0) {
          const u: any = userRows[0];
          const userAdSoyad = ((u.ad || '') + ' ' + (u.soyad || '')).trim().toLowerCase();
          const userTelDigits = (u.tel || '').replace(/[^0-9]/g, '');
          const rdvTelDigits = (r.tel || '').replace(/[^0-9]/g, '');
          const rdvMusteri = (r.musteri || '').trim().toLowerCase();

          if (userTelDigits && userTelDigits === rdvTelDigits) {
            sahip = true;
            migrate = true;
          } else if (userAdSoyad && userAdSoyad === rdvMusteri) {
            sahip = true;
            migrate = true;
          }
        }
      }

      if (!sahip) {
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

      // ─── KUPON İADE — 24 SAAT KURALI ──────────────────────────
      // Bu randevuya bağlı kupon var mı? Varsa ve 24 saat içindeyse iade et.
      // 24 saat kuralı: kupon kullanma_tarih'inden itibaren 24 saat
      let kuponIade = false;
      try {
        const kuponRows = await sql`
          SELECT kupon_kod, kullanma_tarih FROM cark_kayit
          WHERE rezerve_randevu_id = ${b.id} AND kullanildi = TRUE
          LIMIT 1
        `;
        if (kuponRows.length > 0) {
          const k: any = kuponRows[0];
          const kullanmaTarih = new Date(k.kullanma_tarih);
          const simdi = new Date();
          const farkSaat = (simdi.getTime() - kullanmaTarih.getTime()) / (1000 * 60 * 60);
          if (farkSaat <= 24) {
            await sql`
              UPDATE cark_kayit
              SET kullanildi = FALSE,
                  kullanma_tarih = NULL,
                  rezerve_randevu_id = NULL
              WHERE kupon_kod = ${k.kupon_kod}
            `;
            kuponIade = true;
          }
        }
      } catch (kupErr: any) {
        console.warn('[RANDEVULAR PUT iptal] Kupon iade uyarısı:', kupErr.message);
      }

      // Eski randevuya musteri_id ata (bir defaya mahsus migrasyon)
      // ve durum iptal yap
      if (migrate) {
        await sql`
          UPDATE randevular 
          SET durum = 'iptal', guncelleme = NOW(), musteri_id = ${musteriId}
          WHERE id = ${b.id}
        `;
      } else {
        await sql`
          UPDATE randevular SET durum = 'iptal', guncelleme = NOW()
          WHERE id = ${b.id} AND musteri_id = ${musteriId}
        `;
      }
      return NextResponse.json({
        success: true,
        data: { id: b.id, durum: 'iptal' },
        kuponIade
      });
    }

    // ─── ADMIN MODU (mevcut davranış aynen) ───────────────────────
    // Admin iptal yapıyorsa → 24 saat kuralı ile kupon iade
    if (b.durum === 'iptal') {
      try {
        const kuponRows = await sql`
          SELECT kupon_kod, kullanma_tarih FROM cark_kayit
          WHERE rezerve_randevu_id = ${b.id} AND kullanildi = TRUE
          LIMIT 1
        `;
        if (kuponRows.length > 0) {
          const k: any = kuponRows[0];
          const kullanmaTarih = new Date(k.kullanma_tarih);
          const simdi = new Date();
          const farkSaat = (simdi.getTime() - kullanmaTarih.getTime()) / (1000 * 60 * 60);
          if (farkSaat <= 24) {
            await sql`
              UPDATE cark_kayit
              SET kullanildi = FALSE,
                  kullanma_tarih = NULL,
                  rezerve_randevu_id = NULL
              WHERE kupon_kod = ${k.kupon_kod}
            `;
          }
        }
      } catch (kupErr: any) {
        console.warn('[RANDEVULAR PUT admin iptal] Kupon iade uyarısı:', kupErr.message);
      }
    }

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

    // ─── KUPON İADE — 24 SAAT KURALI ──────────────────────────
    // Silinen randevuya bağlı kupon varsa ve 24 saat içindeyse iade et
    try {
      const kuponRows = await sql`
        SELECT kupon_kod, kullanma_tarih FROM cark_kayit
        WHERE rezerve_randevu_id = ${id} AND kullanildi = TRUE
        LIMIT 1
      `;
      if (kuponRows.length > 0) {
        const k: any = kuponRows[0];
        const kullanmaTarih = new Date(k.kullanma_tarih);
        const simdi = new Date();
        const farkSaat = (simdi.getTime() - kullanmaTarih.getTime()) / (1000 * 60 * 60);
        if (farkSaat <= 24) {
          await sql`
            UPDATE cark_kayit
            SET kullanildi = FALSE,
                kullanma_tarih = NULL,
                rezerve_randevu_id = NULL
            WHERE kupon_kod = ${k.kupon_kod}
          `;
        } else {
          // 24 saat geçmiş — sadece bağlantıyı temizle, kupon kullanılmış kalır
          await sql`
            UPDATE cark_kayit
            SET rezerve_randevu_id = NULL
            WHERE kupon_kod = ${k.kupon_kod}
          `;
        }
      }
    } catch (kupErr: any) {
      console.warn('[RANDEVULAR DELETE] Kupon temizleme uyarısı:', kupErr.message);
    }

    await sql`DELETE FROM randevular WHERE id=${id}`;
    return NextResponse.json({ success: true, message: 'Silindi' });
  } catch (e: any) {
    console.error('[RANDEVULAR DELETE] Hata:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
