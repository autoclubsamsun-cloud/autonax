import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-check';
import { getLogsByRandevu } from '@/lib/whatsapp/logger';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const randevuId = searchParams.get('randevuId');
    if (!randevuId) return NextResponse.json({ success: false, error: 'randevuId gerekli' }, { status: 400 });
    const logs = await getLogsByRandevu(randevuId);
    return NextResponse.json({ success: true, data: logs });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
