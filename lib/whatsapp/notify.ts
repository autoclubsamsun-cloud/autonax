import { sql, initDB } from '@/lib/db';
import { getWatiConfig, formatPhone, sendTemplateMessage } from './wati-client';
import { TemplateName, buildTemplateParams, TEMPLATES, RandevuBilgi } from './templates';
import { logWhatsapp } from './logger';

let _dbReady = false;
async function ensureDB() {
  if (!_dbReady) { await initDB(); _dbReady = true; }
}

/**
 * Randevu bildirimi gonder (fire-and-forget)
 * Hata durumunda sessizce loglar, randevu akisini etkilemez.
 */
export async function notifyAppointment(
  randevuId: string,
  templateName: TemplateName
): Promise<void> {
  try {
    const cfg = await getWatiConfig();
    if (!cfg) return; // WATI yapilandirilmamis, sessizce cik

    await ensureDB();
    const rows = await sql`
      SELECT musteri, tel, hizmet, tutar, arac, plaka, tarih, saat
      FROM randevular WHERE id = ${randevuId} LIMIT 1
    `;
    if (rows.length === 0) return;
    const r: any = rows[0];

    const phone = formatPhone(r.tel);
    if (!phone) {
      await logWhatsapp({
        randevuId, telefon: r.tel || '', sablon: templateName,
        durum: 'basarisiz', hata: 'Gecersiz telefon numarasi',
      });
      return;
    }

    const bilgi: RandevuBilgi = {
      musteriAd: r.musteri || '',
      hizmet: r.hizmet || '',
      tutar: r.tutar || 0,
      arac: r.arac || '',
      plaka: r.plaka || '',
      tarih: r.tarih || '',
      saat: r.saat || '',
    };

    const template = TEMPLATES[templateName];
    const params = await buildTemplateParams(templateName, bilgi);
    const result = await sendTemplateMessage(phone, template.watiTemplateName, params, cfg);

    await logWhatsapp({
      randevuId,
      telefon: phone,
      sablon: templateName,
      durum: result.success ? 'basarili' : 'basarisiz',
      hata: result.error,
      messageId: result.messageId,
    });

    if (result.success) {
      console.log(`[WATI] ${template.emoji} ${templateName} -> ${phone} OK`);
    } else {
      console.warn(`[WATI] ${templateName} -> ${phone} HATA:`, result.error);
    }
  } catch (e) {
    console.error('[WATI] notifyAppointment hata:', e);
  }
}
