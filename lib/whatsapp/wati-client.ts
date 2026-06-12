import { sql, initDB } from '@/lib/db';

interface WatiConfig {
  apiUrl: string;
  apiToken: string;
  aktif: boolean;
  googleMapsUrl: string;
}

let _dbReady = false;
async function ensureDB() {
  if (!_dbReady) { await initDB(); _dbReady = true; }
}

export async function getWatiConfig(): Promise<WatiConfig | null> {
  try {
    await ensureDB();
    const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar = 'whatsapp_ayar' LIMIT 1`;
    if (rows.length === 0) return null;
    const cfg = typeof rows[0].deger === 'string' ? JSON.parse(rows[0].deger) : rows[0].deger;
    if (!cfg || !cfg.apiUrl || !cfg.apiToken) return null;
    if (cfg.aktif === false) return null;
    return {
      apiUrl: cfg.apiUrl.replace(/\/+$/, ''),
      apiToken: cfg.apiToken,
      aktif: cfg.aktif !== false,
      googleMapsUrl: cfg.googleMapsUrl || 'https://maps.google.com/?q=41.2867,36.3370',
    };
  } catch (e) {
    console.error('[WATI] Config okuma hatasi:', e);
    return null;
  }
}

export function formatPhone(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^0-9]/g, '');
  if (!digits || digits.length < 10) return null;
  if (digits.startsWith('90') && digits.length >= 12) return digits;
  if (digits.startsWith('0')) digits = '90' + digits.substring(1);
  else if (digits.startsWith('5') && digits.length === 10) digits = '90' + digits;
  return digits.length >= 12 ? digits : null;
}

interface WatiSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendTemplateMessage(
  phone: string,
  templateName: string,
  params: Array<{ name: string; value: string }>,
  config?: WatiConfig | null
): Promise<WatiSendResult> {
  const cfg = config || await getWatiConfig();
  if (!cfg) return { success: false, error: 'WATI yapilandirilmamis' };
  try {
    const url = `${cfg.apiUrl}/api/v1/sendTemplateMessage?whatsappNumber=${phone}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_name: templateName,
        broadcast_name: 'autonax_randevu',
        parameters: params,
      }),
    });
    const data = await res.json();
    if (res.ok && data.result) return { success: true, messageId: data.messageId || data.id || 'ok' };
    return { success: false, error: data.message || data.info || `HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e.message || 'Baglanti hatasi' };
  }
}

export async function sendTextMessage(
  phone: string,
  text: string,
  config?: WatiConfig | null
): Promise<WatiSendResult> {
  const cfg = config || await getWatiConfig();
  if (!cfg) return { success: false, error: 'WATI yapilandirilmamis' };
  try {
    const url = `${cfg.apiUrl}/api/v1/sendSessionMessage/${phone}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messageText: text }),
    });
    const data = await res.json();
    if (res.ok && data.result) return { success: true, messageId: data.messageId || 'ok' };
    return { success: false, error: data.message || `HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e.message || 'Baglanti hatasi' };
  }
}

export async function testConnection(config?: WatiConfig | null): Promise<WatiSendResult> {
  const cfg = config || await getWatiConfig();
  if (!cfg) return { success: false, error: 'WATI yapilandirilmamis' };
  try {
    const url = `${cfg.apiUrl}/api/v1/getContacts?pageSize=1`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${cfg.apiToken}` },
    });
    if (res.ok) return { success: true };
    return { success: false, error: `HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e.message || 'Baglanti hatasi' };
  }
}
