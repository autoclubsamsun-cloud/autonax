import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  let tarih = searchParams.get('tarih') || '';
  let saat = searchParams.get('saat') || '09:00';
  let baslik = searchParams.get('baslik') || 'Randevu';
  let aciklama = searchParams.get('aciklama') || '';
  let konum = searchParams.get('konum') || '';
  const sure = parseInt(searchParams.get('sure') || '120');

  const rid = searchParams.get('id');
  if (rid) {
    try {
      await initDB();
      const rows = await sql`SELECT tarih, saat, musteri, plaka, hizmet FROM randevular WHERE id = ${rid} LIMIT 1`;
      if (rows.length > 0) {
        const r: any = rows[0];
        tarih = r.tarih || tarih;
        saat = r.saat || saat;
        baslik = 'AutoClub Samsun Randevu (' + (r.plaka || '') + ')';
        aciklama = 'Arac: ' + (r.plaka || '') + ' - Hizmet: ' + (r.hizmet || '') + ' - Musteri: ' + (r.musteri || '');
      }
      const waRows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar='whatsapp_ayar'`;
      if (waRows.length > 0 && (waRows[0] as any).deger && (waRows[0] as any).deger.mapsUrl) {
        konum = (waRows[0] as any).deger.mapsUrl;
      }
    } catch (e) {
      console.error('[TAKVIM] DB hatasi:', e);
    }
  }

  if (!tarih) {
    return NextResponse.json({ error: 'tarih gerekli' }, { status: 400 });
  }

  const parca = tarih.split('.');
  if (parca.length !== 3) {
    return NextResponse.json({ error: 'tarih DD.MM.YYYY formatinda olmali' }, { status: 400 });
  }

  const dd = parca[0].padStart(2, '0');
  const mm = parca[1].padStart(2, '0');
  const yyyy = parca[2];
  const saatP = saat.split(':');
  const hh = (saatP[0] || '09').padStart(2, '0');
  const min = (saatP[1] || '00').padStart(2, '0');

  const dtStart = yyyy + mm + dd + 'T' + hh + min + '00';

  const startDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), parseInt(hh), parseInt(min));
  const endDate = new Date(startDate.getTime() + sure * 60 * 1000);
  const dtEnd = endDate.getFullYear().toString()
    + String(endDate.getMonth() + 1).padStart(2, '0')
    + String(endDate.getDate()).padStart(2, '0')
    + 'T' + String(endDate.getHours()).padStart(2, '0')
    + String(endDate.getMinutes()).padStart(2, '0') + '00';

  const uid = 'randevu-' + Date.now() + '@autonax.com.tr';

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AutoClub Samsun//Randevu//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Istanbul',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0300',
    'TZOFFSETTO:+0300',
    'TZNAME:TRT',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTART;TZID=Europe/Istanbul:' + dtStart,
    'DTEND;TZID=Europe/Istanbul:' + dtEnd,
    'SUMMARY:' + baslik.replace(/,/g, '\\,'),
    'DESCRIPTION:' + aciklama.replace(/\n/g, '\\n').replace(/,/g, '\\,'),
    'LOCATION:' + konum.replace(/,/g, '\\,'),
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Yarin randevunuz var!',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:2 saat sonra randevunuz var!',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="randevu.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
  });
}
