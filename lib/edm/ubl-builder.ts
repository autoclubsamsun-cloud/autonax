/**
 * UBL-TR 2.1 Fatura XML Üreticisi
 *
 * GİB şeması:
 * - UBLVersionID: 2.1, CustomizationID: TR1.2
 * - ProfileID: EARSIVFATURA (e-arşiv) / TEMELFATURA (e-fatura temel)
 * - Zorunlu: ID, UUID, IssueDate, InvoiceTypeCode,
 *   AccountingSupplierParty, AccountingCustomerParty,
 *   LegalMonetaryTotal, en az 1 InvoiceLine
 */

import { xmlEsc } from './soap-client';

export interface FaturaKalem {
  ad: string;
  adet: number;
  fiyat: number;
  kdv: number;
}

export interface FaturaData {
  faturaNo: string;
  faturaTipi: 'EARSIV' | 'EFATURA';
  musteriTipi: 'bireysel' | 'kurumsal';
  vknTckn: string;
  musteri: string;
  email: string;
  telefon?: string;
  adres: string;
  il: string;
  ilce: string;
  vergiDairesi?: string;
  tarih: string; // "17.04.2026" formatında
  kdvsizTutar: number;
  kdvTutar: number;
  kdvOrani: number;
  toplamTutar: number;
  kalemler: FaturaKalem[];
}

export interface GondericiData {
  vknTckn: string;
  gondericEtiketi?: string;
  unvan: string;
  adres: string;
  il: string;
  ilce: string;
  vergiDairesi: string;
}

function formatPara(n: number): string {
  return (Number(n) || 0).toFixed(2);
}

export function formatTarih(tarihStr: string): string {
  // "17.04.2026" -> "2026-04-17"
  if (!tarihStr) return new Date().toISOString().slice(0, 10);
  const p = tarihStr.split('.');
  if (p.length === 3)
    return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  return tarihStr;
}

export function uuidOlustur(): string {
  // RFC 4122 v4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Fatura objesini UBL-TR XML'e çevirir
 */
export function faturaUblOlustur(
  fatura: FaturaData,
  gonderici: GondericiData,
  xsltIcerik?: string
): string {
  const uuid = uuidOlustur();
  const tarih = formatTarih(fatura.tarih);
  const parabirim = 'TRY';
  const profileID =
    fatura.faturaTipi === 'EARSIV' ? 'EARSIVFATURA' : 'TEMELFATURA';
  const invoiceTypeCode = 'SATIS';

  const kurumsal = fatura.musteriTipi === 'kurumsal';
  const aliciVknTckn = fatura.vknTckn || '11111111111';

  // Kalem satırları
  const kalemlerXml = (fatura.kalemler || [])
    .map((k, i) => {
      const matrah = k.adet * k.fiyat;
      const kdvTutar = matrah * (k.kdv / 100);
      return `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="C62">${k.adet}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${parabirim}">${formatPara(matrah)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${parabirim}">${formatPara(kdvTutar)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="${parabirim}">${formatPara(matrah)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="${parabirim}">${formatPara(kdvTutar)}</cbc:TaxAmount>
          <cbc:Percent>${k.kdv}</cbc:Percent>
          <cac:TaxCategory>
            <cac:TaxScheme>
              <cbc:Name>KDV</cbc:Name>
              <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${xmlEsc(k.ad)}</cbc:Name>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${parabirim}">${formatPara(k.fiyat)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
    })
    .join('');

  // XSLT şablonu (varsa base64 olarak göm)
  const xsltBlok = xsltIcerik
    ? `
  <cac:AdditionalDocumentReference>
    <cbc:ID>${uuid}</cbc:ID>
    <cbc:IssueDate>${tarih}</cbc:IssueDate>
    <cbc:DocumentTypeCode>XSLT</cbc:DocumentTypeCode>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="application/xml" filename="style.xslt">${Buffer.from(xsltIcerik, 'utf-8').toString('base64')}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>${profileID}</cbc:ProfileID>
  <cbc:ID>${xmlEsc(fatura.faturaNo)}</cbc:ID>
  <cbc:CopyIndicator>false</cbc:CopyIndicator>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>${tarih}</cbc:IssueDate>
  <cbc:IssueTime>${new Date().toISOString().slice(11, 19)}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>${invoiceTypeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${parabirim}</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${(fatura.kalemler || []).length}</cbc:LineCountNumeric>
  ${xsltBlok}

  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:WebsiteURI>https://www.autonax.com.tr</cbc:WebsiteURI>
      <cac:PartyIdentification>
        <cbc:ID schemeID="VKN">${xmlEsc(gonderici.vknTckn)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${xmlEsc(gonderici.unvan || 'AUTONAX')}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${xmlEsc(gonderici.adres || '-')}</cbc:StreetName>
        <cbc:CitySubdivisionName>${xmlEsc(gonderici.ilce || '-')}</cbc:CitySubdivisionName>
        <cbc:CityName>${xmlEsc(gonderici.il || '-')}</cbc:CityName>
        <cac:Country>
          <cbc:Name>Türkiye</cbc:Name>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cac:TaxScheme>
          <cbc:Name>${xmlEsc(gonderici.vergiDairesi || '-')}</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${kurumsal ? 'VKN' : 'TCKN'}">${xmlEsc(aliciVknTckn)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${xmlEsc(fatura.musteri)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${xmlEsc(fatura.adres || '-')}</cbc:StreetName>
        <cbc:CitySubdivisionName>${xmlEsc(fatura.ilce || '-')}</cbc:CitySubdivisionName>
        <cbc:CityName>${xmlEsc(fatura.il || '-')}</cbc:CityName>
        <cac:Country>
          <cbc:Name>Türkiye</cbc:Name>
        </cac:Country>
      </cac:PostalAddress>
      ${
        kurumsal
          ? `<cac:PartyTaxScheme>
        <cac:TaxScheme>
          <cbc:Name>${xmlEsc(fatura.vergiDairesi || '-')}</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>`
          : ''
      }
      ${
        fatura.email
          ? `<cac:Contact>
        <cbc:ElectronicMail>${xmlEsc(fatura.email)}</cbc:ElectronicMail>
        <cbc:Telephone>${xmlEsc(fatura.telefon || '')}</cbc:Telephone>
      </cac:Contact>`
          : ''
      }
    </cac:Party>
  </cac:AccountingCustomerParty>

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${parabirim}">${formatPara(fatura.kdvTutar)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${parabirim}">${formatPara(fatura.kdvsizTutar)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${parabirim}">${formatPara(fatura.kdvTutar)}</cbc:TaxAmount>
      <cbc:Percent>${fatura.kdvOrani || 20}</cbc:Percent>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:Name>KDV</cbc:Name>
          <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${parabirim}">${formatPara(fatura.kdvsizTutar)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${parabirim}">${formatPara(fatura.kdvsizTutar)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${parabirim}">${formatPara(fatura.toplamTutar)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${parabirim}">${formatPara(fatura.toplamTutar)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  ${kalemlerXml}
</Invoice>`;
}
