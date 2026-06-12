import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { getWatiConfig } from '@/lib/whatsapp/wati-client';
import { notifyAppointment } from '@/lib/whatsapp/notify';
import { alreadySent } from '@/lib/whatsapp/logger';

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

// Vercel Cron: Her gun 06:00 UTC (09:00 TR)
export async function GET(req: NextRequest) {
  try {
    const cfg = await getWatiConfig();
    if (!cfg) return NextResponse.json({ success: true, message: 'WATI pasif, atlanıyor' });

    await ensureDB();
    
    // Yarinin tarihini hesapla (TR timezone)
    const now = new Date();
    const yarin = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    // DD.MM.YYYY formatinda
    const gun = String(yarin.getDate()).padStart(2, '0');
    const ay = String(yarin.getMonth() + 1).padStart(2, '0');
    const yil = yarin.getFullYear();
    const yarinStr = `${gun}.${ay}.${yil}`;

    // Yarınki aktif randevulari bul
    const rows = await sql`
      SELECT id FROM randevular
      WHERE tarih = ${yarinStr}
        AND durum IN ('bekl', 'onay')
        AND tel IS NOT NULL AND tel != ''
    `;

    let gonderilen = 0;
    let atlanan = 0;
    for (const r of rows) {
      const rid = (r as any).id;
      // Zaten gonderilmisse tekrar gonderme
      const sent = await alreadySent(rid, 'appointment_reminder');
      if (sent) { atlanan++; continue; }
      await notifyAppointment(rid, 'appointment_reminder');
      gonderilen++;
    }

    return NextResponse.json({
      success: true,
      tarih: yarinStr,
      toplam: rows.length,
      gonderilen,
      atlanan,
    });
  } catch (e: any) {
    console.error('[HATIRLATMA] Cron hatasi:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
