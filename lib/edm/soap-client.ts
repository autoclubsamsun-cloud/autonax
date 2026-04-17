/**
 * EDM Bilişim EFaturaEDMConnectorService SOAP İstemcisi
 *
 * Endpoint'ler:
 *   Test: https://efaturatest.edmbilisim.com.tr/EFaturaEDM/EFaturaEDMConnector
 *   Canlı: https://efatura.edmbilisim.com.tr/EFaturaEDM/EFaturaEDMConnector
 *
 * WS-Security UsernameToken ile kimlik doğrulama, SOAP 1.1 envelope.
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
}

const EDM_ENDPOINTS = {
  test: 'https://efaturatest.edmbilisim.com.tr/EFaturaEDM/EFaturaEDMConnector',
  canli: 'https://efatura.edmbilisim.com.tr/EFaturaEDM/EFaturaEDMConnector',
} as const;

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
  const faultString = tagCek(xml, 'faultstring') || tagCek(xml, 'Reason');
  if (faultString) {
    const errCode = tagCek(xml, 'errorCode') || tagCek(xml, 'faultcode') || 'SOAP_FAULT';
    return { kod: errCode, mesaj: faultString };
  }
  return null;
}

/** SOAP 1.1 zarfı oluşturur (WS-Security UsernameToken ile) */
function soapEnvelopeOlustur(bodyXml: string, auth: EdmAuth): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:con="http://connector.edm.com/">
  <soapenv:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" soapenv:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>${xmlEsc(auth.kullaniciAdi)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${xmlEsc(auth.sifre)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
${bodyXml}
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * EDM SOAP endpoint'ine POST gönderir
 * @param soapAction - SOAP Action header'ı (operasyon adı)
 * @param bodyXml - Operasyon body'si
 * @param auth - Kimlik bilgileri + testMod flag'i
 */
export async function soapCagri(
  soapAction: string,
  bodyXml: string,
  auth: EdmAuth
): Promise<SoapSonuc> {
  const endpoint = auth.testMod ? EDM_ENDPOINTS.test : EDM_ENDPOINTS.canli;
  const envelope = soapEnvelopeOlustur(bodyXml, auth);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        SOAPAction: `"${soapAction}"`,
      },
      body: envelope,
    });

    const xmlYanit = await response.text();

    // SOAP Fault kontrolü (HTTP 500 + fault response de gelebilir)
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
