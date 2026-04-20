/**
 * GET /api/odeme/paytr/sorgu?oid=SIPARIS_ID
 *
 * Sipariş durumunu sorgular.
 * Ödeme başarılı/başarısız sayfaları bu endpoint'i çağırır.
 *
 * Kullanım:
 *   fetch('/api/odeme/paytr/sorgu?oid=AUTNX123')
 *     .then(r => r.json())
 *     .then(d => console.log(d.data.durum))
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { odemeDurumGetir } from '@/lib/odeme/siparis-store';
import type { OdemeDurumYaniti } from '@/lib/odeme/paytr-types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siparisId = searchParams.get('oid')?.trim();

    if (!siparisId) {
      return NextResponse.json<ApiResponse<OdemeDurumYaniti>>({
        success: true,
        data: {
          basarili: false,
          durum: 'HATA',
          siparisId: '',
          hata: 'Siparis ID (oid) parametresi gerekli',
        },
      });
    }

    const kayit = odemeDurumGetir(siparisId);

    if (!kayit) {
      return NextResponse.json<ApiResponse<OdemeDurumYaniti>>({
        success: true,
        data: {
          basarili: true,
          durum: 'BEKLEMEDE',
          siparisId,
        },
      });
    }

    // Memory'den okuduk — durum ODENDI | HATALI | IPTAL
    const durumMap: Record<string, OdemeDurumYaniti['durum']> = {
      ODENDI: 'ODENDI',
      HATALI: 'HATA',
      IPTAL: 'IPTAL',
    };

    return NextResponse.json<ApiResponse<OdemeDurumYaniti>>({
      success: true,
      data: {
        basarili: true,
        durum: durumMap[kayit.durum] ?? 'BEKLEMEDE',
        siparisId,
        odemeTarihi: new Date(kayit.tarih).toISOString(),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PayTR Sorgu] Hata:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatasi: ' + msg },
      { status: 500 }
    );
  }
}
