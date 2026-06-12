import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-check';
import { notifyAppointment } from '@/lib/whatsapp/notify';
import { TemplateName, TEMPLATES } from '@/lib/whatsapp/templates';
import { getWatiConfig, formatPhone, sendTextMessage, testConnection } from '@/lib/whatsapp/wati-client';
import { logWhatsapp } from '@/lib/whatsapp/logger';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const b = await req.json();
    
    // Test baglantisi
    if (b.test === true) {
      const cfg = b.apiUrl && b.apiToken ? {
        apiUrl: b.apiUrl.replace(/\/+$/, ''),
        apiToken: b.apiToken,
        aktif: true,
        googleMapsUrl: b.googleMapsUrl || '',
      } : null;
      const result = await testConnection(cfg);
      return NextResponse.json({ success: result.success, error: result.error });
    }

    // Test mesaj gonder (serbest metin)
    if (b.testMesaj && b.telefon) {
      const phone = formatPhone(b.telefon);
      if (!phone) return NextResponse.json({ success: false, error: 'Gecersiz telefon' }, { status: 400 });
      const result = await sendTextMessage(phone, b.testMesaj);
      return NextResponse.json({ success: result.success, error: result.error, messageId: result.messageId });
    }

    // Randevu bildirimi gonder
    if (!b.randevuId) return NextResponse.json({ success: false, error: 'randevuId gerekli' }, { status: 400 });
    const sablon = (b.sablon || 'appointment_created') as TemplateName;
    if (!TEMPLATES[sablon]) return NextResponse.json({ success: false, error: 'Gecersiz sablon' }, { status: 400 });

    await notifyAppointment(b.randevuId, sablon);
    return NextResponse.json({ success: true, message: 'Bildirim gonderildi' });
  } catch (e: any) {
    console.error('[WA-GONDER] Hata:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
