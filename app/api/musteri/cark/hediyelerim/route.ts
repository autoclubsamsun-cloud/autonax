import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireMusteriAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireMusteriAuth(req);
    if (auth instanceof NextResponse) return auth;

    const musteri_id = auth.musteriId;

    await ensureDB();

    const kayitlar = await sql`
      SELECT id, odul_kod, odul_yuzde, kupon_kod, kullanildi, kullanma_tarih, cevirme_tarih
      FROM cark_kayit
      WHERE musteri_id = ${musteri_id}
      ORDER BY cevirme_tarih DESC
    `;

    const simdi = new Date();
    const kayitlarFormatli = kayitlar.map((k: any) => {
      const cevirilenTarih = new Date(k.cevirme_tarih);
      const sonGun = new Date(cevirilenTarih);
      sonGun.setDate(sonGun.getDate() + 30);
      const kalanGun = Math.max(0, Math.ceil((sonGun.getTime() - simdi.getTime()) / 86400000));
      const suresiGecmis = kalanGun === 0 && !k.kullanildi;

      return {
        id: k.id,
        kupon_kod: k.kupon_kod,
        odul_yuzde: k.odul_yuzde,
        odul_kod: k.odul_kod,
        kullanildi: k.kullanildi,
        kullanma_tarih: k.kullanma_tarih,
        cevirme_tarih: k.cevirme_tarih,
        son_gun: sonGun.toISOString(),
        kalan_gun: kalanGun,
        suresi_gecmis: suresiGecmis,
        durum: k.kullanildi
          ? 'kullanildi'
          : suresiGecmis
            ? 'suresi_doldu'
            : 'aktif',
      };
    });

    return NextResponse.json({
      success: true,
      hediyeler: kayitlarFormatli,
      ozet: {
        toplam: kayitlarFormatli.length,
        aktif: kayitlarFormatli.filter((k) => k.durum === 'aktif').length,
        kullanildi: kayitlarFormatli.filter((k) => k.durum === 'kullanildi').length,
        suresi_doldu: kayitlarFormatli.filter((k) => k.durum === 'suresi_doldu').length,
      },
    });
  } catch (e: any) {
    console.error('[cark/hediyelerim] hata:', e);
    return NextResponse.json(
      { success: false, error: e.message || 'Sunucu hatasi' },
      { status: 500 }
    );
  }
}