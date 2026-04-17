import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAuth } from '@/lib/utils/auth-check';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const klasor = (formData.get('klasor') as string) || 'urunler';
    const urunId = (formData.get('urunId') as string) || '';

    if (!file) {
      return NextResponse.json({ success: false, error: 'Dosya bulunamadi' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Sadece JPG, PNG, WEBP, GIF yuklenebilir' }, { status: 400 });
    }

    if (file.size > 1 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Dosya 1MB den kucuk olmali' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    const sql = neon(process.env.DATABASE_URL!);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}_${safeName}`;
    const key = `resim_${klasor}_${fileName}`;

    await sql`
      INSERT INTO site_ayarlar (anahtar, deger)
      VALUES (${key}, ${JSON.stringify({ url: dataUrl, klasor, urunId, fileName, tip: file.type, boyut: file.size })}::jsonb)
      ON CONFLICT (anahtar) DO UPDATE SET deger = EXCLUDED.deger
    `;

    return NextResponse.json({ success: true, url: dataUrl, fileName, key });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
