import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() { if (!dbReady) { await initDB(); dbReady = true; } }

const B2B_URL = 'https://b2b.nidojpfilm.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Urun -> garanti yili eslesmesi
const GARANTI_YILLARI: Record<string, number> = {
  CS190: 4, S75: 6, S85: 8, N7: 8, N8: 10, N9: 12, S_Matte: 8, H7_Black: 5,
};

// Cookie parse helper
function parseCookies(setCookieHeaders: string[]): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const h of setCookieHeaders) {
    const parts = h.split(';')[0];
    const [name, ...rest] = parts.split('=');
    if (name && rest.length) cookies[name.trim()] = rest.join('=').trim();
  }
  return cookies;
}
function cookieString(cookies: Record<string, string>): string {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

// NiDOJP B2B credentials
async function getNidojpConfig() {
  await ensureDB();
  const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar = 'nidojp_ayar' LIMIT 1`;
  if (rows.length === 0) return null;
  const cfg = typeof rows[0].deger === 'string' ? JSON.parse(rows[0].deger) : rows[0].deger;
  if (!cfg || !cfg.email || !cfg.sifre) return null;
  return cfg;
}

// ====== DB SESSION MANAGEMENT ======
// Session'i site_ayarlar'da sakla (anahtar: 'nidojp_session')
// Vercel serverless hafizasi cold start'ta sifirlanir, DB kalici.
async function getStoredSession(): Promise<{ cookies: Record<string, string>; expiresAt: number; rateLimitUntil: number } | null> {
  try {
    const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar = 'nidojp_session' LIMIT 1`;
    if (rows.length === 0) return null;
    const data = typeof rows[0].deger === 'string' ? JSON.parse(rows[0].deger) : rows[0].deger;
    return data || null;
  } catch { return null; }
}

async function saveSession(cookies: Record<string, string>, expiresAt: number, rateLimitUntil = 0) {
  const val = JSON.stringify({ cookies, expiresAt, rateLimitUntil });
  await sql`
    INSERT INTO site_ayarlar (anahtar, deger) VALUES ('nidojp_session', ${val}::jsonb)
    ON CONFLICT (anahtar) DO UPDATE SET deger = ${val}::jsonb
  `;
}

async function saveRateLimit(until: number) {
  const stored = await getStoredSession();
  const val = JSON.stringify({
    cookies: stored?.cookies || {},
    expiresAt: stored?.expiresAt || 0,
    rateLimitUntil: until
  });
  await sql`
    INSERT INTO site_ayarlar (anahtar, deger) VALUES ('nidojp_session', ${val}::jsonb)
    ON CONFLICT (anahtar) DO UPDATE SET deger = ${val}::jsonb
  `;
}

// Session gecerli mi? B2B'de korunmus sayfaya erismeyi dene
async function testSession(cookies: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(B2B_URL + '/stok-garanti-islemleri', {
      redirect: 'manual',
      headers: { 'Cookie': cookieString(cookies), 'User-Agent': UA },
    });
    // 200 = giris yapilmis, 302 = login'e yonlendirme (session gecersiz)
    return res.status === 200;
  } catch { return false; }
}

// ====== B2B LOGIN (DB session destekli) ======
async function b2bLogin(): Promise<{ success: boolean; cookies?: Record<string, string>; error?: string }> {
  try {
    await ensureDB();

    // 1. DB'den mevcut session'i yukle
    const stored = await getStoredSession();

    // Rate limit kontrolu (DB'den)
    if (stored && stored.rateLimitUntil && Date.now() < stored.rateLimitUntil) {
      const bekle = Math.ceil((stored.rateLimitUntil - Date.now()) / 60000);
      return { success: false, error: `B2B rate limit aktif. ${bekle} dk sonra tekrar deneyin.` };
    }

    // 2. Kayitli session varsa ve suresi dolmamissa, once test et
    if (stored && stored.cookies && stored.expiresAt && Date.now() < stored.expiresAt) {
      const valid = await testSession(stored.cookies);
      if (valid) {
        console.log('[NIDOJP] DB session gecerli, yeniden login gerekmiyor');
        return { success: true, cookies: stored.cookies };
      }
      console.log('[NIDOJP] DB session gecersiz, yeni login yapilacak');
    }

    // 3. Yeni login gerekli
    const cfg = await getNidojpConfig();
    if (!cfg) return { success: false, error: 'NiDOJP ayarlari yapilandirilmamis. Ayarlar > NiDOJP bolumunden email/sifre girin.' };

    // Step 1: Ana sayfaya GET - cookie al
    const initRes = await fetch(B2B_URL + '/', {
      redirect: 'manual',
      headers: { 'User-Agent': UA },
    });
    const initCookieHeaders = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() :
      (initRes.headers.get('set-cookie') || '').split(',').filter(Boolean);
    const cookies = parseCookies(initCookieHeaders);

    let csrfToken = cookies['csrf_token'] || '';
    if (!csrfToken) {
      const html = await initRes.text();
      const m = html.match(/csrf_token['\"]\s*(?:value|content)\s*=\s*['"]([^'"]+)/);
      if (m) { csrfToken = m[1]; cookies['csrf_token'] = csrfToken; }
    }

    // Step 2: Login POST
    const formData = new URLSearchParams();
    formData.append('login_info', cfg.email);
    formData.append('password', cfg.sifre);
    formData.append('g_recaptcha', '');
    formData.append('csrf', csrfToken);
    formData.append('remember', 'on');

    const loginRes = await fetch(B2B_URL + '/Login/login_ajax', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': B2B_URL,
        'Referer': B2B_URL + '/',
        'Cookie': cookieString(cookies),
        'User-Agent': UA,
      },
      body: formData.toString(),
    });

    const loginCookieHeaders = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() :
      (loginRes.headers.get('set-cookie') || '').split(',').filter(Boolean);
    Object.assign(cookies, parseCookies(loginCookieHeaders));

    const loginData = await loginRes.json().catch(() => null);

    if (loginData && loginData.status === true) {
      // BASARILI - session'i DB'ye kaydet (2 saat gecerli)
      await saveSession(cookies, Date.now() + 2 * 60 * 60 * 1000, 0);
      console.log('[NIDOJP] Login basarili, session DB ye kaydedildi (2 saat)');
      return { success: true, cookies };
    }

    // HATA - rate limit mi?
    const errMsg = loginData?.error || 'Login basarisiz';
    if (errMsg.toLowerCase().includes('fazla deneme')) {
      // 15 dk cooldown DB'ye kaydet
      await saveRateLimit(Date.now() + 15 * 60 * 1000);
      console.log('[NIDOJP] Rate limit! 15 dk cooldown DB ye kaydedildi');
      return { success: false, error: 'B2B cok fazla deneme. 15 dk bekleyip tekrar deneyin.' };
    }

    return { success: false, error: errMsg };
  } catch (e: any) {
    return { success: false, error: e.message || 'Login hatasi' };
  }
}

// ====== GET: Garanti belgelerini listele ======
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const { searchParams } = new URL(req.url);
    const randevuId = searchParams.get('randevu_id');
    const plaka = searchParams.get('plaka');

    let rows;
    if (randevuId) {
      rows = await sql`SELECT * FROM garanti_belgeleri WHERE randevu_id = ${randevuId} ORDER BY olusturma DESC`;
    } else if (plaka) {
      rows = await sql`SELECT * FROM garanti_belgeleri WHERE plaka ILIKE ${'%' + plaka + '%'} ORDER BY olusturma DESC`;
    } else {
      rows = await sql`SELECT * FROM garanti_belgeleri ORDER BY olusturma DESC LIMIT 200`;
    }
    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// ====== POST: Action-based ======
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const b = await req.json();
    const action = b.action;

    // --- LOGIN TEST ---
    if (action === 'login') {
      const result = await b2bLogin();
      return NextResponse.json({ success: result.success, error: result.error });
    }

    // --- RATE LIMIT SIFIRLA (admin kullanimi) ---
    if (action === 'reset_rate_limit') {
      await saveRateLimit(0);
      return NextResponse.json({ success: true, message: 'Rate limit sifirlandi' });
    }

    // --- GARANTI OLUSTUR ---
    if (action === 'garanti_olustur') {
      // 1. Login
      const login = await b2bLogin();
      if (!login.success || !login.cookies) {
        return NextResponse.json({ success: false, error: 'B2B login basarisiz: ' + (login.error || '') });
      }

      // 2. B2B'ye garanti ekle
      const formData = new URLSearchParams();
      formData.append('stock_warranty_id', String(b.stock_warranty_id || '0'));
      formData.append('product_id', String(b.product_id || ''));
      formData.append('license_plate', b.license_plate || '');
      formData.append('vehicle_km', b.vehicle_km || '');
      formData.append('installation_date', b.installation_date || '');
      formData.append('warranty_desc', b.warranty_desc || '');
      formData.append('customer_name', b.customer_name || '');
      formData.append('customer_phone', b.customer_phone || '');
      formData.append('customer_city', b.customer_city || '55');
      formData.append('customer_counties', b.customer_counties || '');
      formData.append('csrf', login.cookies['csrf_token'] || '');

      if (Array.isArray(b.field_application)) {
        b.field_application.forEach((v: number) => formData.append('field_application[]', String(v)));
      }

      const garantiRes = await fetch(B2B_URL + '/Account/add_stock_warranty_ajax', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': B2B_URL,
          'Referer': B2B_URL + '/stok-garanti-ekle/' + (b.stock_warranty_id || ''),
          'Cookie': cookieString(login.cookies),
          'User-Agent': UA,
        },
        body: formData.toString(),
      });

      const garantiData = await garantiRes.json().catch(() => null);
      console.log('[NIDOJP] B2B garanti response:', JSON.stringify(garantiData));

      // 3. Garanti yilini hesapla
      const urunKod = b.product_id || '';
      let garantiYil = 8;
      Object.keys(GARANTI_YILLARI).forEach(k => {
        if (urunKod.toLowerCase().includes(k.toLowerCase())) garantiYil = GARANTI_YILLARI[k];
      });
      const ugTarih = b.installation_date || new Date().toISOString().split('T')[0];
      const bitisTarih = new Date(ugTarih);
      bitisTarih.setFullYear(bitisTarih.getFullYear() + garantiYil);
      const garantiBitis = bitisTarih.toISOString().split('T')[0];

      // 4. DB'ye kaydet
      const b2bBasarili = garantiData && garantiData.status === true;
      const seriNo = garantiData?.serial_number || garantiData?.seri_no || garantiData?.warranty_no || garantiData?.data?.serial_number || garantiData?.data?.seri_no || null;

      const dbRows = await sql`
        INSERT INTO garanti_belgeleri (randevu_id, nidojp_stok_id, nidojp_seri_no, urun, plaka, arac_km,
          uygulama_tarihi, garanti_yil, garanti_bitis, garanti_aciklama,
          musteri_ad, musteri_tel, musteri_sehir, musteri_ilce, uygulanan_alanlar, durum)
        VALUES (${b.randevu_id || null}, ${b.stock_warranty_id || 0}, ${seriNo},
          ${urunKod}, ${b.license_plate || ''}, ${b.vehicle_km || ''},
          ${ugTarih}, ${garantiYil}, ${garantiBitis}, ${b.warranty_desc || ''},
          ${b.customer_name || ''}, ${b.customer_phone || ''},
          ${b.customer_city || '55'}, ${b.customer_counties || ''},
          ${JSON.stringify(b.field_application || [])}::jsonb,
          ${b2bBasarili ? 'aktif' : 'lokal'})
        RETURNING *
      `;

      return NextResponse.json({
        success: true,
        b2b_success: b2bBasarili,
        b2b_response: garantiData,
        data: dbRows[0] || null,
      });
    }

    // --- GARANTI SORGULA ---
    if (action === 'garanti_sorgula') {
      const login = await b2bLogin();
      if (!login.success || !login.cookies) {
        return NextResponse.json({ success: false, error: 'B2B login basarisiz' });
      }
      const formData = new URLSearchParams();
      formData.append('license_plate', b.license_plate || b.plaka || '');
      formData.append('csrf', login.cookies['csrf_token'] || '');
      const res = await fetch(B2B_URL + '/Account/check_warranty_ajax', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookieString(login.cookies),
          'User-Agent': UA,
        },
        body: formData.toString(),
      });
      const data = await res.json().catch(() => null);
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, error: 'Gecersiz action' }, { status: 400 });
  } catch (e: any) {
    console.error('[NIDOJP] Hata:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}