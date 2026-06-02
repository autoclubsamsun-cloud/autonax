/**
 * EDM EFaturaEDMConnectorService operasyonlari
 */

import { soapCagri, tagCek, xmlEsc, login, checkGIBUser, type EdmAuth, type SoapHata } from './soap-client';
import { faturaUblOlustur, type FaturaData, type GondericiData } from './ubl-builder';

export interface CheckUserSonuc {
  basarili: boolean;
  mesaj: string;
  kod?: string;
  firma?: string | null;
  xml?: string;
  gonderilenEnvelope?: string;
  endpoint?: string;
  soapAction?: string;
}

export interface FaturaGonderimSonuc {
  basarili: boolean;
  uuid?: string;
  faturaNo?: string;
  hata?: SoapHata;
  xml?: string;
}

/**
 * CheckUser - Login testi (kullanici/sifre dogrulugunu test eder)
 * Login basariliysa SessionID doner = credentials dogru.
 */
export async function checkUser(auth: EdmAuth): Promise<CheckUserSonuc> {
  const sonuc = await login(auth);

  if (!sonuc.basarili) {
    return {
      basarili: false,
      mesaj: sonuc.hata?.mesaj ?? 'Bilinmeyen hata',
      kod: sonuc.hata?.kod,
      xml: sonuc.xml,
      gonderilenEnvelope: sonuc.gonderilenEnvelope,
      endpoint: sonuc.endpoint,
      soapAction: sonuc.soapAction,
    };
  }

  return {
    basarili: true,
    mesaj: 'Baglanti basarili, kullanici dogrulandi. (SessionID alindi)',
    firma: null,
    xml: sonuc.xml,
    gonderilenEnvelope: sonuc.gonderilenEnvelope,
    endpoint: sonuc.endpoint,
    soapAction: sonuc.soapAction,
  };
}

/**
 * 2. ArchiveInvoice - e-Arsiv fatura gonderimi
 *
 * WSDL'den SOAPAction = "ArchiveInvoiceRequest"
 */
export async function archiveInvoiceGonder(
  fatura: FaturaData,
  gonderici: GondericiData,
  auth: EdmAuth,
  xsltIcerik?: string
): Promise<FaturaGonderimSonuc> {
  // Once login yap
  const loginSonuc = await login(auth);
  if (!loginSonuc.basarili || !loginSonuc.sessionId) {
    return {
      basarili: false,
      hata: { kod: 'LOGIN_FAIL', mesaj: 'Login basarisiz: ' + (loginSonuc.hata?.mesaj || 'SessionID alinamadi') },
    };
  }

  const ublXml = faturaUblOlustur(fatura, gonderici, xsltIcerik);
  const ublBase64 = Buffer.from(ublXml, 'utf-8').toString('base64');

  const body = `<ArchiveInvoiceRequest xmlns="http://tempuri.org/">
      <REQUEST_HEADER>
        <SESSION_ID>${xmlEsc(loginSonuc.sessionId)}</SESSION_ID>
        <CLIENT_TXN_ID>${xmlEsc(fatura.faturaNo)}</CLIENT_TXN_ID>
      </REQUEST_HEADER>
      <ARCHIVE>
        <HEADER>
          <SENDER_URN>${xmlEsc(gonderici.gondericEtiketi || '')}</SENDER_URN>
        </HEADER>
        <CONTENT>${ublBase64}</CONTENT>
      </ARCHIVE>
    </ArchiveInvoiceRequest>`;

  const sonuc = await soapCagri('ArchiveInvoiceRequest', body, auth);
  if (!sonuc.basarili) return { basarili: false, hata: sonuc.hata };

  const xml = sonuc.xml ?? '';
  const errorCode = tagCek(xml, 'ERROR_CODE');
  const errorDesc = tagCek(xml, 'ERROR_DESCRIPTION');

  if (errorCode && errorCode !== '0') {
    return {
      basarili: false,
      hata: { kod: errorCode, mesaj: errorDesc || 'EDM hatasi' },
    };
  }

  const envelopeUuid = tagCek(xml, 'UUID') || tagCek(xml, 'ENVELOPE_UUID') || undefined;
  const faturaNo = tagCek(xml, 'INVOICE_ID') || fatura.faturaNo;

  return { basarili: true, uuid: envelopeUuid, faturaNo, xml };
}

/**
 * 3. SendInvoice - e-Fatura gonderimi (kurumsal)
 *
 * WSDL'den SOAPAction = "SendInvoiceRequest"
 */
export async function sendInvoiceGonder(
  fatura: FaturaData,
  gonderici: GondericiData,
  auth: EdmAuth,
  xsltIcerik?: string
): Promise<FaturaGonderimSonuc> {
  // Once login yap
  const loginSonuc = await login(auth);
  if (!loginSonuc.basarili || !loginSonuc.sessionId) {
    return {
      basarili: false,
      hata: { kod: 'LOGIN_FAIL', mesaj: 'Login basarisiz: ' + (loginSonuc.hata?.mesaj || 'SessionID alinamadi') },
    };
  }

  const ublXml = faturaUblOlustur(fatura, gonderici, xsltIcerik);
  const ublBase64 = Buffer.from(ublXml, 'utf-8').toString('base64');

  const body = `<SendInvoiceRequest xmlns="http://tempuri.org/">
      <REQUEST_HEADER>
        <SESSION_ID>${xmlEsc(loginSonuc.sessionId)}</SESSION_ID>
        <CLIENT_TXN_ID>${xmlEsc(fatura.faturaNo)}</CLIENT_TXN_ID>
      </REQUEST_HEADER>
      <INVOICE>
        <HEADER>
          <SENDER_URN>${xmlEsc(gonderici.gondericEtiketi || '')}</SENDER_URN>
          <RECEIVER_URN>urn:mail:defaultpk@${xmlEsc(fatura.vknTckn)}</RECEIVER_URN>
        </HEADER>
        <CONTENT>${ublBase64}</CONTENT>
      </INVOICE>
    </SendInvoiceRequest>`;

  const sonuc = await soapCagri('SendInvoiceRequest', body, auth);
  if (!sonuc.basarili) return { basarili: false, hata: sonuc.hata };

  const xml = sonuc.xml ?? '';
  const errorCode = tagCek(xml, 'ERROR_CODE');
  const errorDesc = tagCek(xml, 'ERROR_DESCRIPTION');

  if (errorCode && errorCode !== '0') {
    return {
      basarili: false,
      hata: { kod: errorCode, mesaj: errorDesc || 'EDM hatasi' },
    };
  }

  const envelopeUuid = tagCek(xml, 'UUID') || tagCek(xml, 'ENVELOPE_UUID') || undefined;
  return { basarili: true, uuid: envelopeUuid, faturaNo: fatura.faturaNo, xml };
}

/**
 * Router - fatura tipine gore uygun operasyonu cagir
 */
export async function faturaGonder(
  fatura: FaturaData,
  gonderici: GondericiData,
  auth: EdmAuth,
  xsltIcerik?: string
): Promise<FaturaGonderimSonuc> {
  if (fatura.faturaTipi === 'EARSIV') {
    return archiveInvoiceGonder(fatura, gonderici, auth, xsltIcerik);
  }
  if (fatura.faturaTipi === 'EFATURA') {
    return sendInvoiceGonder(fatura, gonderici, auth, xsltIcerik);
  }
  return {
    basarili: false,
    hata: { kod: 'INVALID_TIP', mesaj: 'Fatura tipi EARSIV veya EFATURA olmali' },
  };
}