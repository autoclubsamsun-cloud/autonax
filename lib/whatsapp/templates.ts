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
  ];
}
