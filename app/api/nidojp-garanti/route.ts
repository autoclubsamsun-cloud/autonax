import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() { if (!dbReady) { await initDB(); dbReady = true; } }

const B2B_URL = 'https://b2b.nidojpfilm.com';

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

// B2B Login - session cookie al
async function b2bLogin(): Promise<{ success: boolean; cookies?: Record<string, string>; error?: string }> {
  try {
    const cfg = await getNidojpConfig();
    if (!cfg) return { success: false, error: 'NiDOJP ayarlari yapilandirilmamis' };

    // Step 1: Ana sayfaya GET - cookie al
    const initRes = await fetch(B2B_URL + '/', {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const initCookieHeaders = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : 
      (initRes.headers.get('set-cookie') || '').split(',').filter(Boolean);
    const cookies = parseCookies(initCookieHeaders);
    
    const csrfToken = cookies['csrf_token'] || '';
    if (!csrfToken) {
      // Sayfa iceriginden csrf okumaya calis
      const html = await initRes.text();
      const m = html.match(/csrf_token['"]\s*(?:value|content)\s*=\s*['"]([^'"]+)/);
      if (m) cookies['csrf_token'] = m[1];
    }

    // Step 2: Login POST
    const formData = new URLSearchParams();
    formData.append('login_info', cfg.email);
    formData.append('password', cfg.sifre);
    formData.append('g_recaptcha', '');
    formData.append('csrf', cookies['csrf_token'] || '');
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: formData.toString(),
    });

    const loginCookieHeaders = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() :
      (loginRes.headers.get('set-cookie') || '').split(',').filter(Boolean);
    const loginCookies = parseCookies(loginCookieHeaders);
    Object.assign(cookies, loginCookies);

    const loginData = await loginRes.json().catch(() => null);
    if (loginData && loginData.status === true) {
      return { success: true, cookies };
    }
    return { success: false, error: loginData?.error || 'Login basarisiz' };
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

    // --- LOGIN ---
    if (action === 'login') {
      const result = await b2bLogin();
      return NextResponse.json({ success: result.success, cookies: result.cookies, error: result.error });
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
      formData.append('customer_city', b.customer_city || '67');
      formData.append('customer_counties', b.customer_counties || '');
      formData.append('csrf', login.cookies['csrf_token'] || '');
      
      // field_application array
      if (Array.isArray(b.field_application)) {
        b.field_application.forEach((v: number) => formData.append('field_application[]', String(v)));
      }

      const garantiRes = await fetch(B2B_URL + '/Account/add_stock_warranty_ajax', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': B2B_URL,
          'Referer': B2B_URL + '/stok-garanti-ekle/',
          'Cookie': cookieString(login.cookies),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: formData.toString(),
      });

      const garantiData = await garantiRes.json().catch(() => null);

      // 3. Garanti yilini hesapla
      const urunKod = b.product_id || '';
      let garantiYil = 8; // varsayilan
      Object.keys(GARANTI_YILLARI).forEach(k => {
        if (urunKod.toLowerCase().includes(k.toLowerCase())) garantiYil = GARANTI_YILLARI[k];
      });
      const ugTarih = b.installation_date || new Date().toISOString().split('T')[0];
      const bitisTarih = new Date(ugTarih);
      bitisTarih.setFullYear(bitisTarih.getFullYear() + garantiYil);
      const garantiBitis = bitisTarih.toISOString().split('T')[0];

      // 4. DB'ye kaydet (B2B basarisiz olsa bile lokal kayit tut)
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
          ${b.customer_city || '67'}, ${b.customer_counties || ''},
          ${JSON.stringify(b.field_application || [])}::jsonb,
          ${b2bBasarili ? 'aktif' : 'lokal'})
        RETURNING *
      `;

      console.log('[NIDOJP] B2B response:', JSON.stringify(garantiData));

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
        },
        body: formData.toString(),
      });

      const data = await res.json().catch(() => null);
      return NextResponse.json({ success: true, data });
    }

    // --- ILCE GETIR ---
    if (action === 'ilce_getir') {
      const login = await b2bLogin();
      if (!login.success || !login.cookies) {
        return NextResponse.json({ success: false, error: 'B2B login basarisiz' });
      }

      const formData = new URLSearchParams();
      formData.append('id', String(b.city_id || ''));
      formData.append('csrf', login.cookies['csrf_token'] || '');

      const res = await fetch(B2B_URL + '/Account/get_cities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookieString(login.cookies),
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