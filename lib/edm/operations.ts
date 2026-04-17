/**
 * EDM EFaturaEDMConnectorService operasyonları
 */

import { soapCagri, tagCek, xmlEsc, type EdmAuth, type SoapHata } from './soap-client';
import { faturaUblOlustur, type FaturaData, type GondericiData } from './ubl-builder';

export interface CheckUserSonuc {
  basarili: boolean;
  mesaj: string;
  kod?: string;
  firma?: string | null;
  xml?: string;
}

export interface FaturaGonderimSonuc {
  basarili: boolean;
  uuid?: string;
  faturaNo?: string;
  hata?: SoapHata;
  xml?: string;
}

/**
 * 1. CheckUser — kullanıcı/şifre doğruluğunu test et
 */
export async function checkUser(auth: EdmAuth): Promise<CheckUserSonuc> {
  const body = `
    <con:checkUserRequest>
      <REQUEST_HEADER>
        <SESSION_ID></SESSION_ID>
        <CLIENT_TXN_ID></CLIENT_TXN_ID>
      </REQUEST_HEADER>
      <INPUT/>
    </con:checkUserRequest>`;

  const sonuc = await soapCagri('checkUser', body, auth);

  if (!sonuc.basarili) {
    return {
      basarili: false,
      mesaj: sonuc.hata?.mesaj ?? 'Bilinmeyen hata',
      kod: sonuc.hata?.kod,
    };
  }

  const xml = sonuc.xml ?? '';
  const errorCode = tagCek(xml, 'ERROR_CODE');
  const errorDesc = tagCek(xml, 'ERROR_DESCRIPTION');

  if (errorCode && errorCode !== '0') {
    return {
      basarili: false,
      mesaj: errorDesc || 'Kimlik doğrulanamadı',
      kod: errorCode,
    };
  }

  const firma = tagCek(xml, 'DEFINITION') || tagCek(xml, 'COMPANY_NAME');

  return {
    basarili: true,
    mesaj: 'Bağlantı başarılı, kullanıcı doğrulandı.',
    firma,
    xml,
  };
}

/**
 * 2. ArchiveInvoice — e-Arşiv fatura gönderimi
 */
export async function archiveInvoiceGonder(
  fatura: FaturaData,
  gonderici: GondericiData,
  auth: EdmAuth,
  xsltIcerik?: string
): Promise<FaturaGonderimSonuc> {
  const ublXml = faturaUblOlustur(fatura, gonderici, xsltIcerik);
  const ublBase64 = Buffer.from(ublXml, 'utf-8').toString('base64');

  const body = `
    <con:archiveInvoiceRequest>
      <REQUEST_HEADER>
        <SESSION_ID></SESSION_ID>
        <CLIENT_TXN_ID>${xmlEsc(fatura.faturaNo)}</CLIENT_TXN_ID>
      </REQUEST_HEADER>
      <ARCHIVE>
        <HEADER>
          <SENDER_URN>${xmlEsc(gonderici.gondericEtiketi || '')}</SENDER_URN>
        </HEADER>
        <CONTENT>${ublBase64}</CONTENT>
      </ARCHIVE>
    </con:archiveInvoiceRequest>`;

  const sonuc = await soapCagri('archiveInvoice', body, auth);
  if (!sonuc.basarili) return { basarili: false, hata: sonuc.hata };

  const xml = sonuc.xml ?? '';
  const errorCode = tagCek(xml, 'ERROR_CODE');
  const errorDesc = tagCek(xml, 'ERROR_DESCRIPTION');

  if (errorCode && errorCode !== '0') {
    return {
      basarili: false,
      hata: { kod: errorCode, mesaj: errorDesc || 'EDM hatası' },
    };
  }

  const envelopeUuid = tagCek(xml, 'UUID') || tagCek(xml, 'ENVELOPE_UUID') || undefined;
  const faturaNo = tagCek(xml, 'INVOICE_ID') || fatura.faturaNo;

  return { basarili: true, uuid: envelopeUuid, faturaNo, xml };
}

/**
 * 3. SendInvoice — e-Fatura gönderimi (kurumsal)
 */
export async function sendInvoiceGonder(
  fatura: FaturaData,
  gonderici: GondericiData,
  auth: EdmAuth,
  xsltIcerik?: string
): Promise<FaturaGonderimSonuc> {
  const ublXml = faturaUblOlustur(fatura, gonderici, xsltIcerik);
  const ublBase64 = Buffer.from(ublXml, 'utf-8').toString('base64');

  const body = `
    <con:sendInvoiceRequest>
      <REQUEST_HEADER>
        <SESSION_ID></SESSION_ID>
        <CLIENT_TXN_ID>${xmlEsc(fatura.faturaNo)}</CLIENT_TXN_ID>
      </REQUEST_HEADER>
      <INVOICE>
        <HEADER>
          <SENDER_URN>${xmlEsc(gonderici.gondericEtiketi || '')}</SENDER_URN>
          <RECEIVER_URN>urn:mail:defaultpk@${xmlEsc(fatura.vknTckn)}</RECEIVER_URN>
        </HEADER>
        <CONTENT>${ublBase64}</CONTENT>
      </INVOICE>
    </con:sendInvoiceRequest>`;

  const sonuc = await soapCagri('sendInvoice', body, auth);
  if (!sonuc.basarili) return { basarili: false, hata: sonuc.hata };

  const xml = sonuc.xml ?? '';
  const errorCode = tagCek(xml, 'ERROR_CODE');
  const errorDesc = tagCek(xml, 'ERROR_DESCRIPTION');

  if (errorCode && errorCode !== '0') {
    return {
      basarili: false,
      hata: { kod: errorCode, mesaj: errorDesc || 'EDM hatası' },
    };
  }

  const envelopeUuid = tagCek(xml, 'UUID') || tagCek(xml, 'ENVELOPE_UUID') || undefined;
  return { basarili: true, uuid: envelopeUuid, faturaNo: fatura.faturaNo, xml };
}

/**
 * Router — fatura tipine göre uygun operasyonu çağır
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
    hata: { kod: 'INVALID_TIP', mesaj: 'Fatura tipi EARSIV veya EFATURA olmalı' },
  };
}
