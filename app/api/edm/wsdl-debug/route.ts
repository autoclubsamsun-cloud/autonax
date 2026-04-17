/**
 * GET /api/edm/wsdl-debug
 * EDM WSDL'sini fetch eder, SOAPAction'ları çıkarır ve log'a yazar.
 * Gerçek action isimleri ve operasyon adlarını tespit etmek için geçici araç.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';

const WSDL_URLS = {
  canli: 'https://efatura.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc?wsdl',
  test: 'https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc?wsdl',
};

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const mod = url.searchParams.get('mod') === 'test' ? 'test' : 'canli';
  const wsdlUrl = WSDL_URLS[mod];

  console.log('[WSDL DEBUG] ===== WSDL indiriliyor =====');
  console.log('[WSDL DEBUG] URL:', wsdlUrl);

  try {
    const baslangic = Date.now();
    const response = await fetch(wsdlUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/xml, application/xml, */*',
        'User-Agent': 'Autonax-EDM-Client/1.0',
      },
      signal: AbortSignal.timeout(20000),
    });
    const sure = Date.now() - baslangic;

    console.log('[WSDL DEBUG] HTTP status:', response.status, '- süre:', sure, 'ms');
    console.log('[WSDL DEBUG] Content-Type:', response.headers.get('content-type'));

    if (!response.ok) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      });
    }

    const xml = await response.text();
    console.log('[WSDL DEBUG] WSDL boyut:', xml.length, 'byte');
    console.log('[WSDL DEBUG] İlk 300 char:', xml.slice(0, 300));

    // SOAPAction'ları çıkar
    const actionRegex = /soapAction\s*=\s*["']([^"']+)["']/gi;
    const actions: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = actionRegex.exec(xml)) !== null) {
      actions.push(m[1]);
    }

    // Operasyon adlarını çıkar
    const opRegex = /wsdl:operation\s+name\s*=\s*["']([^"']+)["']/gi;
    const ops: string[] = [];
    while ((m = opRegex.exec(xml)) !== null) {
      if (!ops.includes(m[1])) ops.push(m[1]);
    }

    // portType / binding adlarını çıkar
    const portTypeRegex = /wsdl:portType\s+name\s*=\s*["']([^"']+)["']/gi;
    const portTypes: string[] = [];
    while ((m = portTypeRegex.exec(xml)) !== null) {
      portTypes.push(m[1]);
    }

    const bindingRegex = /wsdl:binding\s+name\s*=\s*["']([^"']+)["']/gi;
    const bindings: string[] = [];
    while ((m = bindingRegex.exec(xml)) !== null) {
      bindings.push(m[1]);
    }

    const targetNsMatch = xml.match(/targetNamespace\s*=\s*["']([^"']+)["']/);
    const targetNs = targetNsMatch ? targetNsMatch[1] : null;

    console.log('[WSDL DEBUG] targetNamespace:', targetNs);
    console.log('[WSDL DEBUG] portTypes:', portTypes);
    console.log('[WSDL DEBUG] bindings:', bindings);
    console.log('[WSDL DEBUG] İlk 15 SOAPAction:', actions.slice(0, 15));
    console.log('[WSDL DEBUG] İlk 20 operasyon:', ops.slice(0, 20));

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        wsdlUrl,
        wsdlBoyut: xml.length,
        targetNamespace: targetNs,
        portTypes,
        bindings,
        operations: ops.slice(0, 30),
        soapActions: actions.slice(0, 30),
        ornekXmlBas: xml.slice(0, 500),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && 'cause' in err ? (err as any).cause : undefined;
    console.error('[WSDL DEBUG] HATA:', msg);
    console.error('[WSDL DEBUG] cause:', cause);

    let detay = msg;
    if (cause) {
      const c = cause as any;
      if (c.code) detay += ` [code=${c.code}]`;
      if (c.errno) detay += ` [errno=${c.errno}]`;
      if (c.hostname) detay += ` [host=${c.hostname}]`;
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: detay,
    });
  }
}
