/**
 * EDM Bilişim EFaturaEDMConnectorService SOAP İstemcisi v2
 *
 * Doğru endpoint'ler:
 *   Test:  https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc
 *   Canlı: https://efatura.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc
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
  canli: 'https://efatura.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc',
} as const;

const EDM_NAMESPACE = 'http://schemas.i2i.com/ei/wsdl';

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

/** SOAP 1.1 zarfı oluşturur — EDM WSDL namespace'i ile */
function soapEnvelopeOlustur(bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="${EDM_NAMESPACE}">
  <soapenv:Header/>
  <soapenv:Body>
${bodyXml}
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** EDM SOAP endpoint'ine POST gönderir */
export async function soapCagri(
  soapAction: string,
  bodyXml: string,
  auth: EdmAuth
): Promise<SoapSonuc> {
  const endpoint = auth.testMod ? EDM_ENDPOINTS.test : EDM_ENDPOINTS.canli;
  const envelope = soapEnvelopeOlustur(bodyXml);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        SOAPAction: `"${EDM_NAMESPACE}/IEFaturaEDM/${soapAction}"`,
      },
      body: envelope,
    });

    const xmlYanit = await response.text();

    const fault = soapFaultKontrol(xmlYanit);
    if (fault) {
      return { basarili: false, hata: fault, xml: xmlYanit };
    }

    if (!response.ok) {
      return {
        basarili: false,
        hata: {
          kod: `HTTP_${response.status}`,
          mesaj: xmlYanit.slice(0, 500) || response.statusText,
        },
        xml: xmlYanit,
      };
    }

    return { basarili: true, xml: xmlYanit };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      basarili: false,
      hata: { kod: 'NETWORK', mesaj: msg },
    };
  }
}

/**
 * LOGIN — kullanıcı/şifre ile giriş yap, SessionID al
 */
export async function login(auth: EdmAuth): Promise<SoapSonuc> {
  const body = `
    <tem:Login>
      <tem:user>${xmlEsc(auth.kullaniciAdi)}</tem:user>
      <tem:password>${xmlEsc(auth.sifre)}</tem:password>
    </tem:Login>`;

  const sonuc = await soapCagri('Login', body, auth);
  if (!sonuc.basarili) return sonuc;

  const xml = sonuc.xml ?? '';
  const sessionId =
    tagCek(xml, 'SessionId') ||
    tagCek(xml, 'SESSION_ID') ||
    tagCek(xml, 'LoginResult') ||
    tagCek(xml, 'sessionId');

  if (!sessionId) {
    return {
      basarili: false,
      hata: {
        kod: 'NO_SESSION',
        mesaj: 'Login başarılı gözüküyor ama SessionID alınamadı. Yanıt: ' + xml.slice(0, 300),
      },
      xml,
    };
  }

  return { basarili: true, sessionId, xml };
}
