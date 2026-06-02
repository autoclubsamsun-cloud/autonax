/**
 * EDM Bilisim EFaturaEDMConnectorService SOAP Istemcisi v3
 *
 * WSDL'den tespit edilen dogru yapilar:
 *   - SOAP 1.1 (text/xml)
 *   - targetNamespace: http://tempuri.org/
 *   - Login SOAPAction: "LoginRequest"
 *   - CheckUser SOAPAction: "CheckUserRequest"
 *   - SendInvoice SOAPAction: "SendInvoiceRequest"
 *   - ArchiveInvoice SOAPAction: "ArchiveInvoiceRequest"
 *   - Elementler form="unqualified" -> namespace prefix'siz
 *
 * Endpoint'ler:
 *   Test:  https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc
 *   Canli: https://interaktif.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc
 */

export interface EdmAuth {
  kullaniciAdi: string;
  sifre: string;
  testMod: boolean;
}

export interface SoapHata {
  kod: string;
  mesaj: string;
}

export interface SoapSonuc {
  basarili: boolean;
  xml?: string;
  hata?: SoapHata;
  sessionId?: string;
  gonderilenEnvelope?: string;
  endpoint?: string;
  soapAction?: string;
}

const EDM_ENDPOINTS = {
  test: 'https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc',
  canli: 'https://interaktif.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc',
} as const;

const EDM_NAMESPACE = 'http://tempuri.org/';

/** XML icin ozel karakterleri kacis */
export function xmlEsc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!)
  );
}

/** SOAP yanitindan belirli bir XML tag'inin icerigini cikarir */
export function tagCek(xml: string, tagAdi: string): string | null {
  const re = new RegExp(
    `<(?:[\\w]+:)?${tagAdi}[^>]*>([\\s\\S]*?)<\\/(?:[\\w]+:)?${tagAdi}>`,
    'i'
  );
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

/** SOAP Fault varsa mesaji cikarir */
export function soapFaultKontrol(xml: string): SoapHata | null {
  const faultString = tagCek(xml, 'faultstring') || tagCek(xml, 'Reason') || tagCek(xml, 'Text');
  if (faultString) {
    const errCode = tagCek(xml, 'errorCode') || tagCek(xml, 'faultcode') || tagCek(xml, 'Code') || 'SOAP_FAULT';
    return { kod: errCode, mesaj: faultString };
  }
  // EDM ozel hata formati: RequestFault -> errorCode + errorShortDes
  const errCode2 = tagCek(xml, 'errorCode');
  const errDesc2 = tagCek(xml, 'errorShortDes') || tagCek(xml, 'ERROR_SHORT_DES');
  if (errCode2 && errDesc2) {
    return { kod: errCode2, mesaj: errDesc2 };
  }
  return null;
}

/** SOAP 1.1 zarfi olusturur - EDM WSDL'e gore dogru format */
function soapEnvelopeOlustur(bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    ${bodyXml}
  </s:Body>
</s:Envelope>`;
}

/** EDM SOAP endpoint'ine POST gonderir */
export async function soapCagri(
  soapAction: string,
  bodyXml: string,
  auth: EdmAuth
): Promise<SoapSonuc> {
  const endpoint = auth.testMod ? EDM_ENDPOINTS.test : EDM_ENDPOINTS.canli;
  const envelope = soapEnvelopeOlustur(bodyXml);

  console.log('[EDM SOAP] ===== Istek basliyor =====');
  console.log('[EDM SOAP] Endpoint:', endpoint);
  console.log('[EDM SOAP] SOAPAction:', soapAction);
  console.log('[EDM SOAP] testMod:', auth.testMod);
  console.log('[EDM SOAP] Envelope:\n', envelope);

  try {
    const baslangic = Date.now();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        SOAPAction: `"${soapAction}"`,
      },
      body: envelope,
    });
    const sure = Date.now() - baslangic;

    console.log('[EDM SOAP] HTTP status:', response.status, '- sure:', sure, 'ms');

    const xmlYanit = await response.text();
    console.log('[EDM SOAP] Yanit:\n', xmlYanit.slice(0, 1000));

    const debugInfo = {
      gonderilenEnvelope: envelope,
      endpoint,
      soapAction,
    };

    const fault = soapFaultKontrol(xmlYanit);
    if (fault) {
      console.log('[EDM SOAP] SOAP Fault:', fault);
      return { basarili: false, hata: fault, xml: xmlYanit, ...debugInfo };
    }

    if (!response.ok) {
      console.log('[EDM SOAP] HTTP basarisiz:', response.status, response.statusText);
      return {
        basarili: false,
        hata: {
          kod: `HTTP_${response.status}`,
          mesaj: xmlYanit.slice(0, 500) || response.statusText,
        },
        xml: xmlYanit,
        ...debugInfo,
      };
    }

    console.log('[EDM SOAP] BASARILI');
    return { basarili: true, xml: xmlYanit, ...debugInfo };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && 'cause' in err ? (err as any).cause : undefined;

    console.error('[EDM SOAP] ===== HATA =====');
    console.error('[EDM SOAP] Hata mesaji:', msg);
    console.error('[EDM SOAP] Endpoint:', endpoint);

    let detayliMesaj = msg;
    if (cause && typeof cause === 'object') {
      const c = cause as any;
      if (c.code) detayliMesaj += ` [code=${c.code}]`;
      if (c.errno) detayliMesaj += ` [errno=${c.errno}]`;
      if (c.hostname) detayliMesaj += ` [host=${c.hostname}]`;
      if (c.syscall) detayliMesaj += ` [syscall=${c.syscall}]`;
    }

    return {
      basarili: false,
      hata: { kod: 'NETWORK', mesaj: detayliMesaj },
      gonderilenEnvelope: envelope,
      endpoint,
    };
  }
}

/**
 * LOGIN - kullanici/sifre ile giris yap, SessionID al
 *
 * WSDL'den:
 *   SOAPAction = "LoginRequest" (tirnak icinde)
 *   Element: <LoginRequest xmlns="http://tempuri.org/">
 *   LoginRequest extends REQUEST -> REQUEST_HEADER + USER_NAME + PASSWORD
 *   Tum child elementler form="unqualified" -> namespace prefix'siz
 */
export async function login(auth: EdmAuth): Promise<SoapSonuc> {
  const actionDate = new Date().toISOString();

  // WSDL'e gore dogru yapi:
  // LoginRequest elementinin namespace = http://tempuri.org/
  // Child elementler unqualified = namespace prefix'siz
  const body = `<LoginRequest xmlns="${EDM_NAMESPACE}">
      <REQUEST_HEADER xmlns="">
        <SESSION_ID/>
        <ACTION_DATE>${actionDate}</ACTION_DATE>
      </REQUEST_HEADER>
      <USER_NAME xmlns="">${xmlEsc(auth.kullaniciAdi)}</USER_NAME>
      <PASSWORD xmlns="">${xmlEsc(auth.sifre)}</PASSWORD>
    </LoginRequest>`;

  const sonuc = await soapCagri('LoginRequest', body, auth);
  if (!sonuc.basarili) return sonuc;

  const xml = sonuc.xml ?? '';
  const sessionId =
    tagCek(xml, 'SESSION_ID') ||
    tagCek(xml, 'SessionId') ||
    tagCek(xml, 'LoginResult') ||
    tagCek(xml, 'sessionId');

  if (!sessionId) {
    return {
      basarili: false,
      hata: {
        kod: 'NO_SESSION',
        mesaj: 'Login basarili gozukuyor ama SessionID alinamadi. Yanit: ' + xml.slice(0, 500),
      },
      xml,
      gonderilenEnvelope: sonuc.gonderilenEnvelope,
      endpoint: sonuc.endpoint,
      soapAction: sonuc.soapAction,
    };
  }

  return {
    basarili: true,
    sessionId,
    xml,
    gonderilenEnvelope: sonuc.gonderilenEnvelope,
    endpoint: sonuc.endpoint,
    soapAction: sonuc.soapAction,
  };
}

/**
 * CheckUser - VKN/TC ile GIB mukellef sorgula
 *
 * WSDL'den:
 *   SOAPAction = "CheckUserRequest"
 *   Element: <CheckUserRequest xmlns="http://tempuri.org/">
 *   CheckUserRequest extends REQUEST -> REQUEST_HEADER + USER (GIBUSER tipi)
 *   GIBUSER: IDENTIFIER, ALIAS, TITLE, TYPE, REGISTER_TIME, ...
 */
export async function checkGIBUser(
  sessionId: string,
  vknTckn: string,
  auth: EdmAuth
): Promise<SoapSonuc> {
  const body = `<CheckUserRequest xmlns="${EDM_NAMESPACE}">
      <REQUEST_HEADER xmlns="">
        <SESSION_ID>${xmlEsc(sessionId)}</SESSION_ID>
      </REQUEST_HEADER>
      <USER xmlns="">
        <IDENTIFIER>${xmlEsc(vknTckn)}</IDENTIFIER>
      </USER>
    </CheckUserRequest>`;

  return soapCagri('CheckUserRequest', body, auth);
}
