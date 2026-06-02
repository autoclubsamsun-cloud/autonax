import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-check';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const kullaniciAdi = String(body.kullaniciAdi || '');
    const sifre = String(body.sifre || '');

    const codes: number[] = [];
    for (let i = 0; i < sifre.length; i++) codes.push(sifre.charCodeAt(i));

    const sifreDebug = {
      uzunluk: sifre.length,
      ilk2: sifre.slice(0, 2),
      son2: sifre.slice(-2),
      charCodes: codes,
      hasXmlSpecial: /[&<>"']/.test(sifre),
    };

    function esc(s: string): string {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const soapXml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
      '<LoginRequest xmlns="http://tempuri.org/">' +
      '<REQUEST_HEADER xmlns="">' +
      '<SESSION_ID/>' +
      '<ACTION_DATE>' + new Date().toISOString() + '</ACTION_DATE>' +
      '<REASON>ETA</REASON>' +
      '<APPLICATION_NAME>ETA</APPLICATION_NAME>' +
      '<HOSTNAME>localhost</HOSTNAME>' +
      '<CHANNEL_NAME>WEB</CHANNEL_NAME>' +
      '<COMPRESSED>N</COMPRESSED>' +
      '</REQUEST_HEADER>' +
      '<USER_NAME xmlns="">' + esc(kullaniciAdi) + '</USER_NAME>' +
      '<PASSWORD xmlns="">' + esc(sifre) + '</PASSWORD>' +
      '</LoginRequest>' +
      '</s:Body></s:Envelope>';

    const endpoints = [
      'https://portal2.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc',
      'https://portal2.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc',
      'https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc',
    ];

    const sonuclar = [];

    for (const ep of endpoints) {
      try {
        const resp = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: '"LoginRequest"' },
          body: soapXml,
        });
        const xml = await resp.text();
        const sm = xml.match(/<SESSION_ID>([^<]+)<\/SESSION_ID>/);
        const em = xml.match(/ERROR_CODE[^>]*>([^<]+)/);
        const ed = xml.match(/ERROR_LONG_DES[^>]*>([^<]+)/);
        sonuclar.push({
          ep: ep.replace('https://','').split('/')[0],
          ok: !!sm,
          sid: sm ? sm[1].slice(0,12) : null,
          ec: em ? em[1] : null,
          ed: ed ? ed[1] : null,
        });
      } catch (e) {
        sonuclar.push({ ep: ep.replace('https://','').split('/')[0], err: String(e) });
      }
    }

    return NextResponse.json({ success: true, data: { sifreDebug, sonuclar } });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}