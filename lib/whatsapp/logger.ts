import { sql, initDB } from '@/lib/db';

let _dbReady = false;
async function ensureDB() {
  if (!_dbReady) { await initDB(); _dbReady = true; }
}

export async function logWhatsapp(entry: {
  randevuId: string;
  telefon: string;
  sablon: string;
  durum: 'basarili' | 'basarisiz' | 'beklemede';
  hata?: string;
  messageId?: string;
}) {
  try {
    await ensureDB();
    await sql`
      INSERT INTO whatsapp_log (randevu_id, telefon, sablon, durum, hata, wati_message_id)
      VALUES (${entry.randevuId}, ${entry.telefon}, ${entry.sablon}, ${entry.durum}, ${entry.hata || null}, ${entry.messageId || null})
    `;
  } catch (e) {
    console.error('[WA-LOG] Kayit hatasi:', e);
  }
}

export async function getLogsByRandevu(randevuId: string) {
  try {
    await ensureDB();
    return await sql`
      SELECT * FROM whatsapp_log WHERE randevu_id = ${randevuId} ORDER BY tarih DESC
    `;
  } catch (e) {
    console.error('[WA-LOG] Sorgulama hatasi:', e);
    return [];
  }
}

export async function alreadySent(randevuId: string, sablon: string): Promise<boolean> {
  try {
    await ensureDB();
    const rows = await sql`
      SELECT id FROM whatsapp_log 
      WHERE randevu_id = ${randevuId} AND sablon = ${sablon} AND durum = 'basarili'
      LIMIT 1
    `;
    return rows.length > 0;
  } catch (e) {
    return false;
  }
}
