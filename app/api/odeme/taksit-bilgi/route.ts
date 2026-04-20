/**
 * GET /api/odeme/taksit-bilgi
 *
 * Public endpoint - auth gerekmez.
 * Musteri odeme sayfasina taksit oranlari ve vade farki ayari doner.
 * Merchant bilgileri, key/salt DONDURULMEZ.
 */

import { NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';

let dbReady = false;
async function ensureDB() {
  if (!dbReady) {
    await initDB();
    dbReady = true;
  }
}

export async function GET() {
  try {
    await ensureDB();

    const rows = await sql`
      SELECT anahtar, deger FROM site_ayarlar
      WHERE anahtar IN ('taksit_oranlari', 'odeme_ayar')
    `;

    let taksitOranlari: Record<string, Record<string, number>> = {};
    let vadeKarsilayanFirma = true;

    rows.forEach((r: any) => {
      if (r.anahtar === 'taksit_oranlari' && r.deger) {
        taksitOranlari = r.deger as Record<string, Record<string, number>>;
      }
      if (r.anahtar === 'odeme_ayar' && r.deger) {
        const odeme = r.deger as { vadeKarsilayanFirma?: boolean };
        if (typeof odeme.vadeKarsilayanFirma === 'boolean') {
          vadeKarsilayanFirma = odeme.vadeKarsilayanFirma;
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        taksitOranlari,
        vadeKarsilayanFirma,
      },
    });
  } catch (err) {
    console.error('[taksit-bilgi] Hata:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Sunucu hatasi',
      },
      { status: 500 }
    );
  }
}
