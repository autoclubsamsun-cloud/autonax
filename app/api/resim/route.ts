import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const klasor = (formData.get('klasor') as string) || 'urunler';
    const urunId = (formData.get('urunId') as string) || '';

    if (!file) {
      return NextResponse.json({ success: false, error: 'Dosya bulunamadi' }, { status: 400 });
    }

    // Dosya tipi kontrolü
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Sadece JPG, PNG, WEBP, GIF yuklenebilir' }, { status: 400 });
    }

    // Dosya boyutu kontrolü (1MB - base64 için)
    if (file.size > 1 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Dosya 1MB den kucuk olmali' }, { status: 400 });
    }

    // Base64'e çevir
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    // DB'ye kaydet
    const sql = neon(process.env.DATABASE_URL!);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}_${safeName}`;
    const key = `resim_${klasor}_${fileName}`;

    await sql`
      INSERT INTO site_ayarlar (anahtar, deger)
      VALUES (${key}, ${JSON.stringify({ url: dataUrl, klasor, urunId, fileName, tip: file.type, boyut: file.size })}::jsonb)
      ON CONFLICT (anahtar) DO UPDATE SET deger = EXCLUDED.deger
    `;

    // URL olarak data URL döndür
    return NextResponse.json({ success: true, url: dataUrl, fileName, key });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
