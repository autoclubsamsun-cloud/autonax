import { getWatiConfig } from './wati-client';

export type TemplateName = 
  | 'appointment_created'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_reminder'
  | 'appointment_updated';

interface TemplateInfo {
  watiTemplateName: string;
  description: string;
  emoji: string;
}

export const TEMPLATES: Record<TemplateName, TemplateInfo> = {
  appointment_created: {
    watiTemplateName: 'appointment_created',
    description: 'Randevu olusturuldu',
    emoji: '\u2705',
  },
  appointment_confirmed: {
    watiTemplateName: 'appointment_confirmed',
    description: 'Randevu onaylandi',
    emoji: '\u2705',
  },
  appointment_cancelled: {
    watiTemplateName: 'appointment_cancelled',
    description: 'Randevu iptal edildi',
    emoji: '\u274C',
  },
  appointment_reminder: {
    watiTemplateName: 'appointment_reminder',
    description: 'Randevu hatirlatma',
    emoji: '\uD83D\uDCC5',
  },
  appointment_updated: {
    watiTemplateName: 'appointment_updated',
    description: 'Randevu guncellendi',
    emoji: '\uD83D\uDD04',
  },
};

export interface RandevuBilgi {
  musteriAd: string;
  hizmet: string;
  tutar: number;
  arac: string;
  plaka: string;
  tarih: string;
  saat: string;
}

/**
 * Google Calendar takvime ekle linki olusturur
 * DD.MM.YYYY + HH:MM -> Google Calendar URL
 */
function buildCalendarUrl(tarih: string, saat: string, hizmet: string): string {
  try {
    const parts = tarih.split('.');
    if (parts.length !== 3) return '';
    const [gun, ay, yil] = parts;
    const saatParts = (saat || '09:00').split(':');
    const startH = saatParts[0]?.padStart(2, '0') || '09';
    const startM = saatParts[1]?.padStart(2, '0') || '00';
    const endH = String(Math.min(23, parseInt(startH) + 3)).padStart(2, '0');
    const dateStart = yil + ay.padStart(2, '0') + gun.padStart(2, '0') + 'T' + startH + startM + '00';
    const dateEnd = yil + ay.padStart(2, '0') + gun.padStart(2, '0') + 'T' + endH + startM + '00';
    const title = encodeURIComponent('Autonax Randevu - ' + (hizmet || 'PPF Kaplama'));
    const location = encodeURIComponent('Autonax-AutoClub Samsun Merkez');
    const details = encodeURIComponent('Autonax-AutoClub Samsun Merkez randevunuz.');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text=' + title
      + '&dates=' + dateStart + '/' + dateEnd
      + '&details=' + details
      + '&location=' + location
      + '&ctz=Europe/Istanbul';
  } catch (e) { return ''; }
}

export async function buildTemplateParams(
  templateName: TemplateName,
  bilgi: RandevuBilgi
): Promise<Array<{ name: string; value: string }>> {
  const cfg = await getWatiConfig();
  const konum = cfg?.googleMapsUrl || 'https://maps.google.com/?q=41.2867,36.3370';
  
  return [
    { name: '1', value: bilgi.musteriAd || 'Degerli Musterimiz' },
    { name: '2', value: bilgi.hizmet || '-' },
    { name: '3', value: bilgi.tutar ? `${bilgi.tutar.toLocaleString('tr-TR')} TL` : 'Belirtilmedi' },
    { name: '4', value: `${bilgi.arac || ''} ${bilgi.plaka || ''}`.trim() || '-' },
    { name: '5', value: bilgi.tarih || '-' },
    { name: '6', value: bilgi.saat || '-' },
    { name: '7', value: konum },
    { name: '8', value: buildCalendarUrl(bilgi.tarih, bilgi.saat, bilgi.hizmet) || konum },
  ];
}
