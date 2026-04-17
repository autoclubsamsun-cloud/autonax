/**
 * EDM Bilişim EFaturaEDMConnectorService SOAP İstemcisi v2
 *
 * Doğru endpoint'ler:
 *   Test:  https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc
 *   Canlı: https://interaktif.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc
 *
 * Akış:
 *   1. login(kullaniciAdi, sifre) → SessionID döner
 *   2. SessionID ile diğer operasyonlar (CheckUser, SendInvoice...)
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
}

const EDM_ENDPOINTS = {
  test: 'https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc',
  canli: 'https://interaktif.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc',
} as const;

const EDM_NAMESPACE = 'http://tempuri.org/';

/** XML için özel karakterleri kaçış */
export function xmlEsc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!)
  );
}

/** SOAP yanıtından belirli bir XML tag'inin içeriğini çıkarır */
export function tagCek(xml: string, tagAdi: string): string | null {
  const re = new RegExp(
    `<(?:[\\w]+:)?${tagAdi}[^>]*>([\\s\\S]*?)<\\/(?:[\\w]+:)?${tagAdi}>`,
    'i'
  );
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

/** SOAP Fault varsa mesajı çıkarır */
export function soapFaultKontrol(xml: string): SoapHata | null {
  const faultString = tagCek(xml, 'faultstring') || tagCek(xml, 'Reason') || tagCek(xml, 'Text');
  if (faultString) {
    const errCode = tagCek(xml, 'errorCode') || tagCek(xml, 'faultcode') || tagCek(xml, 'Code') || 'SOAP_FAULT';
    return { kod: errCode, mesaj: faultString };
  }
  return null;
}

/** SOAP 1.1 zarfı oluşturur */
function soapEnvelopeOlustur(bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    ${bodyXml}
  </s:Body>
</s:Envelope>`;
}

/** EDM SOAP endpoint'ine POST gönderir */
export async function soapCagri(
  soapAction: string,
  bodyXml: string,
  auth: EdmAuth
): Promise<SoapSonuc> {
  const endpoint = auth.testMod ? EDM_ENDPOINTS.test : EDM_ENDPOINTS.canli;
  const envelope = soapEnvelopeOlustur(bodyXml);

  console.log('[EDM SOAP] ===== İstek başlıyor =====');
  console.log('[EDM SOAP] Endpoint:', endpoint);
  console.log('[EDM SOAP] Operasyon:', soapAction);
  console.log('[EDM SOAP] testMod:', auth.testMod);
  console.log('[EDM SOAP] Envelope ilk 500 char:', envelope.slice(0, 500));

  try {
    const baslangic = Date.now();
    // EDM WSDL'e göre SOAPAction = operasyon adı + "Request" (tırnak içinde)
    // Örn: "LoginRequest", "SendInvoiceRequest", "ArchiveInvoiceRequest"
    const soapActionUrl = soapAction;
    console.log('[EDM SOAP] Tam SOAPAction URL:', soapActionUrl);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        SOAPAction: `"${soapActionUrl}"`,
      },
      body: envelope,
    });
    const sure = Date.now() - baslangic;

    console.log('[EDM SOAP] Yanıt geldi, HTTP status:', response.status, '- süre:', sure, 'ms');

    const xmlYanit = await response.text();
    console.log('[EDM SOAP] Yanıt gövdesi ilk 500 char:', xmlYanit.slice(0, 500));

    const fault = soapFaultKontrol(xmlYanit);
    if (fault) {
      console.log('[EDM SOAP] SOAP Fault:', fault);
      return { basarili: false, hata: fault, xml: xmlYanit };
    }

    if (!response.ok) {
      console.log('[EDM SOAP] HTTP başarısız:', response.status, response.statusText);
      return {
        basarili: false,
        hata: {
          kod: `HTTP_${response.status}`,
          mesaj: xmlYanit.slice(0, 500) || response.statusText,
        },
        xml: xmlYanit,
      };
    }

    console.log('[EDM SOAP] BAŞARILI');
    return { basarili: true, xml: xmlYanit };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    const cause = err instanceof Error && 'cause' in err ? (err as any).cause : undefined;

    console.error('[EDM SOAP] ===== HATA =====');
    console.error('[EDM SOAP] Hata mesajı:', msg);
    console.error('[EDM SOAP] Hata stack:', stack);
    console.error('[EDM SOAP] Hata cause:', cause);
    console.error('[EDM SOAP] Endpoint:', endpoint);

    // cause nesnesi Node.js fetch hatalarında TLS/DNS detayları içerir
    let detayliMesaj = msg;
    if (cause && typeof cause === 'object') {
      const c = cause as any;
      if (c.code) detayliMesaj += ` [code=${c.code}]`;
      if (c.errno) detayliMesaj += ` [errno=${c.errno}]`;
      if (c.hostname) detayliMesaj += ` [host=${c.hostname}]`;
      if (c.syscall) detayliMesaj += ` [syscall=${c.syscall}]`;
      if (c.reason) detayliMesaj += ` [reason=${c.reason}]`;
    }

    return {
      basarili: false,
      hata: { kod: 'NETWORK', mesaj: detayliMesaj },
    };
  }
}

/**
 * LOGIN — kullanıcı/şifre ile giriş yap, SessionID al
 *
 * WSDL'den öğrendiğimiz üzere SOAPAction = "LoginRequest" (tırnaklı literal)
 * Element adı da LoginRequest, namespace tempuri.org
 */
export async function login(auth: EdmAuth): Promise<SoapSonuc> {
  const txnId = 'autonax-' + Date.now();
  const actionDate = new Date().toISOString();

  const body = `<LoginRequest xmlns="${EDM_NAMESPACE}">
      <REQUEST_HEADER xmlns="">
        <SESSION_ID></SESSION_ID>
        <CLIENT_TXN_ID>${txnId}</CLIENT_TXN_ID>
        <ACTION_DATE>${actionDate}</ACTION_DATE>
        <REASON>Autonax EDM entegrasyonu - kimlik dogrulama</REASON>
        <APPLICATION_NAME>Autonax</APPLICATION_NAME>
        <HOSTNAME>autonax.com.tr</HOSTNAME>
        <CHANNEL_NAME>WEB</CHANNEL_NAME>
        <COMPRESSED>N</COMPRESSED>
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
        mesaj: 'Login başarılı gözüküyor ama SessionID alınamadı. Yanıt: ' + xml.slice(0, 500),
      },
      xml,
    };
  }

  return { basarili: true, sessionId, xml };
}
