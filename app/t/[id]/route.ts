import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  // Redirect to the takvim API with the randevu ID
  const url = new URL('/api/takvim', req.url);
  url.searchParams.set('id', id);
  return NextResponse.redirect(url.toString());
}
