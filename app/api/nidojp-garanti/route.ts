import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() { if (!dbReady) { await initDB(); dbReady = true; } }

const B2B_URL = 'https://b2b.nidojpfilm.com';
// Tarih parse helper - TR format (dd.mm.yyyy), ISO (yyyy-mm-dd) ve diger formatlari destekler
function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // dd.mm.yyyy veya dd/mm/yyyy
  const trMatch = dateStr.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (trMatch) return new Date(parseInt(trMatch[3]), parseInt(trMatch[2]) - 1, parseInt(trMatch[1]));
  // yyyy-mm-dd (ISO)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  // Fallback
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}
function toISODate(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const GARANTI_YILLARI: Record<string, number> = {
  CS190: 4, S75: 6, S85: 8, N7: 8, N8: 10, N9: 12, S_Matte: 8, H7_Black: 5,
};

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

async function getNidojpConfig() {
  await ensureDB();
  const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar = 'nidojp_ayar' LIMIT 1`;
  if (rows.length === 0) return null;
  const cfg = typeof rows[0].deger === 'string' ? JSON.parse(rows[0].deger) : rows[0].deger;
  if (!cfg || !cfg.email || !cfg.sifre) return null;
  return cfg;
}

// ====== DB SESSION ======
async function getStoredSession(): Promise<Record<string, string> | null> {
  try {
    const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar = 'nidojp_session' LIMIT 1`;
    if (rows.length === 0) return null;
    const data = typeof rows[0].deger === 'string' ? JSON.parse(rows[0].deger) : rows[0].deger;
    if (!data || !data.cookies || !data.expiresAt) return null;
    if (Date.now() > data.expiresAt) return null; // suresi dolmus
    return data.cookies;
  } catch { return null; }
}

async function saveSessionToDB(cookies: Record<string, string>) {
  const val = JSON.stringify({ cookies, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
  await sql`
    INSERT INTO site_ayarlar (anahtar, deger) VALUES ('nidojp_session', ${val}::jsonb)
    ON CONFLICT (anahtar) DO UPDATE SET deger = ${val}::jsonb
  `.catch(() => {});
}

async function clearSessionFromDB() {
  await sql`DELETE FROM site_ayarlar WHERE anahtar = 'nidojp_session'`.catch(() => {});
}

// Session hala gecerli mi test et
async function testSession(cookies: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(B2B_URL + '/stok-garanti-islemleri', {
      redirect: 'manual',
      headers: { 'Cookie': cookieString(cookies), 'User-Agent': UA },
    });
    return res.status === 200;
  } catch { return false; }
}

// ====== B2B LOGIN ======
// Rate limit CACHE'LEMEZ. Her zaman B2B'nin gercek cevabini doner.
// Sadece basarili session'i DB'de saklar ve tekrar kullanir.
async function b2bLogin(forceNewLogin = false): Promise<{ success: boolean; cookies?: Record<string, string>; error?: string }> {
  try {
    await ensureDB();

    // 1. Kayitli session varsa kullan (force degilse)
    if (!forceNewLogin) {
      const stored = await getStoredSession();
      if (stored) {
        const valid = await testSession(stored);
        if (valid) {
          console.log('[NIDOJP] DB session gecerli');
          return { success: true, cookies: stored };
        }
        console.log('[NIDOJP] DB session gecersiz, login gerekli');
      }
    }

    // 2. Yeni login
    const cfg = await getNidojpConfig();
    if (!cfg) return { success: false, error: 'NiDOJP ayarlari yapilandirilmamis. Ayarlar > NiDOJP bolumunden email/sifre girin.' };

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
      await saveSessionToDB(cookies);
      console.log('[NIDOJP] Login basarili, session kaydedildi');
      return { success: true, cookies };
    }

    // Basarisiz - gercek hatayi dondur (rate limit dahil)
    return { success: false, error: loginData?.error || 'Login basarisiz' };
  } catch (e: any) {
    return { success: false, error: e.message || 'Login hatasi' };
  }
}

// ====== GET ======
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

// ====== POST ======
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const b = await req.json();
    const action = b.action;

    // --- LOGIN TEST ---
    if (action === 'login') {
      const result = await b2bLogin(true); // force new login
      return NextResponse.json({ success: result.success, error: result.error });
    }

    // --- SESSION TEMIZLE ---
    if (action === 'clear_session') {
      await clearSessionFromDB();
      return NextResponse.json({ success: true, message: 'Session temizlendi' });
    }

    // --- TARAYICI COOKIE KAYDET ---
    if (action === 'save_browser_cookie') {
      const ciSession = b.ci_session;
      if (!ciSession) return NextResponse.json({ success: false, error: 'ci_session bos' });
      // Cookie'yi CSRF token ile birlikte DB'ye kaydet
      const cookies: Record<string, string> = { ci_session: ciSession };
      // CSRF token'i da almaya calis
      try {
        const testRes = await fetch(B2B_URL + '/stok-garanti-islemleri', {
          redirect: 'manual',
          headers: { 'Cookie': 'ci_session=' + ciSession, 'User-Agent': UA },
        });
        if (testRes.status === 200) {
          // CSRF cookie'yi al
          const testCookies = testRes.headers.getSetCookie ? testRes.headers.getSetCookie() :
            (testRes.headers.get('set-cookie') || '').split(',').filter(Boolean);
          const parsed = parseCookies(testCookies);
          if (parsed.csrf_token) cookies.csrf_token = parsed.csrf_token;
          // HTML'den de CSRF token ara
          const html = await testRes.text();
          const csrfMatch = html.match(/csrf_token['"]\s*(?:value|content)\s*=\s*['"]([^'"]+)/);
          if (csrfMatch) cookies.csrf_token = csrfMatch[1];
        }
      } catch {}
      await saveSessionToDB(cookies);
      return NextResponse.json({ success: true, message: 'Cookie kaydedildi' });
    }

    // --- GORSEL YUKLE ---
    if (action === 'gorsel_yukle') {
      try {
        const login = await b2bLogin();
        if (!login.cookies?.ci_session) {
          return NextResponse.json({ success: false, error: 'B2B oturumu yok' });
        }
        const imgBase64 = b.image_base64;
        const filename = b.filename || 'arac.jpg';
        const contentType = b.content_type || 'image/jpeg';
        if (!imgBase64) {
          return NextResponse.json({ success: false, error: 'Gorsel verisi yok' });
        }

        const imgBuffer = Buffer.from(imgBase64, 'base64');
        const boundary = '----FormBoundary' + Date.now();
        
        const csrfPart = '--' + boundary + '\r\nContent-Disposition: form-data; name="csrf"\r\n\r\n' + (login.cookies['csrf_token'] || '') + '\r\n';
        const filePart = '--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="' + filename + '"\r\nContent-Type: ' + contentType + '\r\n\r\n';
        const endPart = '\r\n--' + boundary + '--\r\n';
        
        const fullBody = Buffer.concat([
          Buffer.from(csrfPart, 'utf8'),
          Buffer.from(filePart, 'utf8'),
          imgBuffer,
          Buffer.from(endPart, 'utf8')
        ]);

        const uploadRes = await fetch(B2B_URL + '/Account/add-profile-photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data; boundary=' + boundary,
            'Cookie': Object.entries(login.cookies).map(([k,v]) => k+'='+v).join('; '),
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': B2B_URL + '/stok-garanti-islemleri',
          },
          body: fullBody,
        });

        const upCookies = uploadRes.headers.getSetCookie?.() || [];
        upCookies.forEach((sc: string) => {
          const m = sc.match(/^([^=]+)=([^;]*)/);
          if (m) login.cookies[m[1]] = m[2];
        });
        // session cookies updated

        const uploadText = await uploadRes.text();
        console.log('[NIDOJP] Gorsel upload:', uploadRes.status, uploadText.substring(0, 200));
        
        let uploadResult: any;
        try { uploadResult = JSON.parse(uploadText); } catch { uploadResult = { raw: uploadText }; }
        
        return NextResponse.json({ success: uploadRes.ok, upload: uploadResult });
      } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
      }
    }

    // --- SESSION TEST ---
    if (action === 'test_session') {
      const stored = await getStoredSession();
      if (!stored) return NextResponse.json({ success: false, valid: false, error: 'Kayitli session yok. Cookie yapi�tirin.' });
      const valid = await testSession(stored);
      return NextResponse.json({ success: true, valid, error: valid ? null : 'Session gecersiz veya suresi dolmus' });
    }

    // --- GARANTI OLUSTUR ---
    if (action === 'garanti_olustur') {
      const login = await b2bLogin(); // cached session kullan
      if (!login.success || !login.cookies) {
        // B2B login basarisiz ama lokal kayit yap
        const urunKod = b.product_id || '';
        let garantiYil = 8;
        Object.keys(GARANTI_YILLARI).forEach(k => {
          if (urunKod.toLowerCase().includes(k.toLowerCase())) garantiYil = GARANTI_YILLARI[k];
        });
        const rawDate = b.installation_date || '';
      const ugParsed = parseDate(rawDate);
      const ugTarih = toISODate(ugParsed);
        const bitisTarih = new Date(ugParsed.getTime());
        bitisTarih.setFullYear(bitisTarih.getFullYear() + garantiYil);

        const dbRows = await sql`
          INSERT INTO garanti_belgeleri (randevu_id, nidojp_stok_id, nidojp_seri_no, urun, plaka, arac_km,
            uygulama_tarihi, garanti_yil, garanti_bitis, garanti_aciklama,
            musteri_ad, musteri_tel, musteri_sehir, musteri_ilce, uygulanan_alanlar, durum)
          VALUES (${b.randevu_id || null}, ${b.stock_warranty_id || 0}, ${null},
            ${urunKod}, ${b.license_plate || ''}, ${b.vehicle_km || ''},
            ${ugTarih}, ${garantiYil}, ${toISODate(bitisTarih)}, ${b.warranty_desc || ''},
            ${b.customer_name || ''}, ${b.customer_phone || ''},
            ${b.customer_city || '55'}, ${b.customer_counties || ''},
            ${JSON.stringify(b.field_application || [])}::jsonb, ${'beklemede'})
          RETURNING *
        `;
        return NextResponse.json({
          success: true,
          b2b_success: false,
          b2b_error: login.error,
          data: dbRows[0] || null,
        });
      }

      // B2B'ye garanti ekle
      // ONEMLI: �nce garanti sayfas�n� GET et - taze CSRF token al
      const stockId = String(b.stock_warranty_id || '0');
      const garantiPageRes = await fetch(B2B_URL + '/stok-garanti-ekle/' + stockId, {
        redirect: 'manual',
        headers: { 'Cookie': cookieString(login.cookies), 'User-Agent': UA },
      });
      // Yeni CSRF cookie'yi al
      const garantiPageCookies = garantiPageRes.headers.getSetCookie ? garantiPageRes.headers.getSetCookie() :
        (garantiPageRes.headers.get('set-cookie') || '').split(',').filter(Boolean);
      const freshCookies = parseCookies(garantiPageCookies);
      if (freshCookies.csrf_token) {
        login.cookies['csrf_token'] = freshCookies.csrf_token;
      }
      // HTML'den de CSRF kontrol
      const garantiPageHtml = await garantiPageRes.text();
      // Hidden input'tan CSRF
      const csrfFromPage = garantiPageHtml.match(/csrf_token['"]\s*(?:value|content)\s*=\s*['"]([^'"]+)/);
      // Meta tag'den CSRF
      const csrfFromMeta = garantiPageHtml.match(/name=['"]csrf['"]\s*content=['"]([^'"]+)/);
      // Cookie.get simule - HTML icindeki cookie degerini al
      const csrfFromCookieJs = garantiPageHtml.match(/csrf_token=([a-f0-9]{32,})/i);
      if (csrfFromPage) login.cookies['csrf_token'] = csrfFromPage[1];
      else if (csrfFromMeta) login.cookies['csrf_token'] = csrfFromMeta[1];
      else if (csrfFromCookieJs) login.cookies['csrf_token'] = csrfFromCookieJs[1];
      
      // Sayfadaki form field name'lerini logla (debug)
      const pageFields: string[] = [];
      const nameRegex = /name=['"]([^'"]+)['"]/g;
      let fieldMatch;
      while ((fieldMatch = nameRegex.exec(garantiPageHtml)) !== null) { pageFields.push(fieldMatch[1]); }
      console.log('[NIDOJP] Garanti page fields:', JSON.stringify([...new Set(pageFields)]));
      console.log('[NIDOJP] Page status:', garantiPageRes.status, 'CSRF:', login.cookies['csrf_token']?.substring(0,10) + '...');

      const formData = new URLSearchParams();
      formData.append('stock_warranty_id', stockId);
      // product_id: stock_warranty_id -> B2B product_id sabit eslesme
      const stockToProduct: Record<string, string> = {
        '41': '4',  // N7
        '42': '5',  // N8
        '43': '2',  // CS190
        '44': '3',  // S75 / S85
        '31': '7',  // S Matte
        '45': '3',  // S85
        '46': '6',  // N9
        '47': '8',  // H7 Black
      };
      let productId = String(b.product_id || '');
      if (!productId || productId === '0' || isNaN(Number(productId))) {
        productId = stockToProduct[String(stockId)] || '';
      }
      // Hala bos ise stok sayfasindan dene
      if (!productId) {
        try {
          const prodMatch = garantiPageHtml.match(/<option[^>]*selected[^>]*value=["'](\d+)["']/i);
          if (prodMatch) productId = prodMatch[1];
        } catch(e) {}
      }
      console.log('[NIDOJP] product_id:', productId, 'stock:', stockId);
      formData.append('product_id', productId);
      formData.append('license_plate', b.license_plate || '');
      formData.append('vehicle_km', b.vehicle_km || '');
      formData.append('installation_date', b.installation_date || '');
      formData.append('warranty_desc', b.warranty_desc || '');
      formData.append('customer_name', b.customer_name || '');
      formData.append('customer_phone', b.customer_phone || '');
      formData.append('customer_city', b.customer_city || '');
      formData.append('customer_counties', b.customer_counties || '');
      // warranty_year zorunlu alan - urun bazli garanti suresi
      const warrantyYearMap: Record<string, number> = {
        '44': 6,  // S75 - 6 yil
        '43': 4,  // CS190 - 4 yil
        '42': 10, // N8 - 10 yil
        '41': 8,  // N7 - 8 yil
        '31': 8,  // S Matte - 8 yil
        '45': 8,  // S85 - 8 yil
        '46': 12, // N9 - 12 yil
        '47': 5,  // H7 Black - 5 yil
      };
      const wYear = b.warranty_year || warrantyYearMap[String(stockId)] || 6;
      formData.append('warranty_year', String(wYear));
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

      let garantiData = null;
      const garantiRawText = await garantiRes.text();
      try { garantiData = JSON.parse(garantiRawText); } catch { garantiData = null; }
      if (!garantiData) {
        console.log('[NIDOJP] B2B garanti raw response:', garantiRes.status, garantiRawText.substring(0, 500));
      }
      // B2B response cookies'ini guncelle ve DB'ye kaydet
      const garantiRespCookies = garantiRes.headers.getSetCookie ? garantiRes.headers.getSetCookie() :
        (garantiRes.headers.get('set-cookie') || '').split(',').filter(Boolean);
      const freshGarantiCookies = parseCookies(garantiRespCookies);
      if (freshGarantiCookies.ci_session) {
        login.cookies.ci_session = freshGarantiCookies.ci_session;
        await saveSessionToDB(login.cookies).catch(() => {});
      }
      console.log('[NIDOJP] B2B garanti response status:', garantiRes.status);
      console.log('[NIDOJP] B2B garanti response body:', JSON.stringify(garantiData));
      console.log('[NIDOJP] Sent fields:', formData.toString().substring(0, 500));

      const urunKod = b.product_id || '';
      let garantiYil = 8;
      Object.keys(GARANTI_YILLARI).forEach(k => {
        if (urunKod.toLowerCase().includes(k.toLowerCase())) garantiYil = GARANTI_YILLARI[k];
      });
      const rawDate = b.installation_date || '';
      const ugParsed = parseDate(rawDate);
      const ugTarih = toISODate(ugParsed);
      const bitisTarih = new Date(ugParsed.getTime());
      bitisTarih.setFullYear(bitisTarih.getFullYear() + garantiYil);
      const garantiBitis = toISODate(bitisTarih);

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
          ${b2bBasarili ? 'aktif' : 'beklemede'})
        RETURNING *
      `;

      return NextResponse.json({
        success: true,
        b2b_success: b2bBasarili,
        b2b_response: garantiData,
        b2b_error: !b2bBasarili ? (garantiData?.error || garantiRawText?.substring(0, 200) || 'B2B yanit bos') : null,
        data: dbRows[0] || null,
      });
    }

    // --- GARANTI SORGULA ---
    if (action === 'garanti_sorgula') {
      const login = await b2bLogin();
      if (!login.success || !login.cookies) {
        return NextResponse.json({ success: false, error: 'B2B login basarisiz: ' + (login.error || '') });
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

    // --- ILCE GETIR ---
    if (action === 'ilce_getir') {
      const login = await b2bLogin();
      if (!login.success || !login.cookies) {
        return NextResponse.json({ success: false, error: 'B2B session gecersiz' });
      }
      // Taze CSRF al
      const pageRes = await fetch(B2B_URL + '/stok-garanti-islemleri', {
        redirect: 'manual',
        headers: { 'Cookie': cookieString(login.cookies), 'User-Agent': UA },
      });
      const pageCookies = pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() :
        (pageRes.headers.get('set-cookie') || '').split(',').filter(Boolean);
      const freshParsed = parseCookies(pageCookies);
      if (freshParsed.csrf_token) login.cookies['csrf_token'] = freshParsed.csrf_token;
      if (freshParsed.ci_session) {
        login.cookies.ci_session = freshParsed.ci_session;
        await saveSessionToDB(login.cookies).catch(() => {});
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
          'User-Agent': UA,
        },
        body: formData.toString(),
      });

      let respData = null;
      const ilceRawText = await res.text();
      try { respData = JSON.parse(ilceRawText); } catch { respData = null; }
      if (!respData) console.log('[NIDOJP] Ilce raw response:', res.status, ilceRawText.substring(0, 300));
      
      // B2B response: { status: true, counties: "<option value='id'>name</option>..." }
      // HTML options'i parse edip JSON array'e cevir
      const counties: Array<{id: string; name: string}> = [];
      if (respData && respData.status === true && respData.counties) {
        const optionRegex = /<option[^>]*value=['"](\d+)['"][^>]*>([^<]+)<\/option>/gi;
        let optMatch;
        while ((optMatch = optionRegex.exec(respData.counties)) !== null) {
          counties.push({ id: optMatch[1], name: optMatch[2].trim() });
        }
      }

      // Cookie guncelle
      const ilceRespCookies = res.headers.getSetCookie ? res.headers.getSetCookie() :
        (res.headers.get('set-cookie') || '').split(',').filter(Boolean);
      const freshIlceCookies = parseCookies(ilceRespCookies);
      if (freshIlceCookies.ci_session) {
        login.cookies.ci_session = freshIlceCookies.ci_session;
        await saveSessionToDB(login.cookies).catch(() => {});
      }

      console.log('[NIDOJP] Ilce response for city', b.city_id, '- found', counties.length, 'districts');
      return NextResponse.json({ success: true, data: counties });
    }


    // --- DEBUG: B2B SAYFA FETCH ---
    if (action === 'fetch_b2b_page') {
      const stored = await getStoredSession();
      if (!stored) return NextResponse.json({ success: false, error: 'Session yok' });
      const url = b.url || '/stok-garanti-ekle/41';
      const res = await fetch(B2B_URL + url, {
        redirect: 'manual',
        headers: { 'Cookie': cookieString(stored), 'User-Agent': UA },
      });
      const html = await res.text();
      // Form inputs bul
      const inputRegex = /<(?:input|select|textarea)[^>]*name=['"]([^'"]+)['"][^>]*>/gi;
      const fields: string[] = [];
      let match;
      const tempHtml = html;
      const regex = /name=['"]([^'"]+)['"]/gi;
      let m;
      while ((m = regex.exec(tempHtml)) !== null) { fields.push(m[1]); }
      // Form action bul
      const formAction = html.match(/id=['"]infoStockWarrantyAdd['"][^>]*action=['"]([^'"]+)['"]/);
      return NextResponse.json({ 
        success: true, 
        status: res.status,
        fields: [...new Set(fields)],
        formAction: formAction ? formAction[1] : null,
        htmlLength: html.length,
        hasForm: html.includes('infoStockWarrantyAdd'),
      });
    }
        return NextResponse.json({ success: false, error: 'Gecersiz action' }, { status: 400 });
  } catch (e: any) {
    console.error('[NIDOJP] Hata:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}