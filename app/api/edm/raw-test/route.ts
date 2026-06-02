import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-check';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { kullaniciAdi, sifre } = body;

  const sifreDebug = {
    uzunluk: sifre?.length || 0,
    ilk2: sifre?.slice(0, 2) || '',
    son2: sifre?.slice(-2) || '',
    charCodes: Array.from(sifre || '').map((c: string) => c.charCodeAt(0)),
    hasXmlSpecial: /[&<>"']/.test(sifre || ''),
  };

  function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const soapXml = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <LoginRequest xmlns="http://tempuri.org/">
      <REQUEST_HEADER xmlns="">
        <SESSION_ID/>
        <ACTION_DATE>${new Date().toISOString()}</ACTION_DATE>
        <REASON>ETA</REASON>
        <APPLICATION_NAME>ETA</APPLICATION_NAME>
        <HOSTNAME>localhost</HOSTNAME>
        <CHANNEL_NAME>WEB</CHANNEL_NAME>
        <COMPRESSED>N</COMPRESSED>
      </REQUEST_HEADER>
      <USER_NAME xmlns="">${esc(kullaniciAdi)}</USER_NAME>
      <PASSWORD xmlns="">${esc(sifre)}</PASSWORD>
    </LoginRequest>
  </s:Body>
</s:Envelope>`;

  const endpoints = [
    'https://interaktif.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc',
    'https://portal2.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc',
    'https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc',
  ];

  const results: Record<string, unknown>[] = [];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: '"LoginRequest"' },
        body: soapXml,
      });
      const xml = await resp.text();
      const sessionMatch = xml.match(/<SESSION_ID>([^<]+)<\/SESSION_ID>/);
      const errorMatch = xml.match(/ERROR_CODE[^>]*>([^<]+)/);
      const errorDesc = xml.match(/ERROR_LONG_DES[^>]*>([^<]+)/);
      results.push({
        endpoint: ep.replace('https://','').split('/')[0],
        status: resp.status,
        basarili: !!sessionMatch,
        sessionId: sessionMatch?.[1]?.slice(0,12) || null,
        errorCode: errorMatch?.[1] || null,
        errorDesc: errorDesc?.[1] || null,
      });
    } catch (err) {
      results.push({ endpoint: ep.replace('https://','').split('/')[0], hata: (err as Error).message });
    }
  }

  return NextResponse.json({ success: true, data: { sifreDebug, sonuclar: results } });
}