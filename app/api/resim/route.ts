import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
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

    // Frontend ile uyumlu: 2MB sinir
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Dosya 2MB den kucuk olmali' }, { status: 400 });
    }

    // Dosya ismini guvenli hale getir
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}_${safeName}`;
    // Blob path: klasor/dosya.jpg (orn: urunler/1735000000_foto.jpg)
    const blobPath = `${klasor}/${fileName}`;

    // Vercel Blob'a yukle - public erisim, cache'lenir
    const blob = await put(blobPath, file, {
      access: 'public',
      addRandomSuffix: false, // Bizim fileName zaten timestamp icerdigi icin unique
      contentType: file.type,
    });

    // Metadata'yi DB'ye kaydet (URL referansi, gercek resim Blob'da)
    const sql = neon(process.env.DATABASE_URL!);
    const key = `resim_${klasor}_${fileName}`;

    await sql`
      INSERT INTO site_ayarlar (anahtar, deger)
      VALUES (${key}, ${JSON.stringify({
        url: blob.url,
        klasor,
        urunId,
        fileName,
        tip: file.type,
        boyut: file.size,
        blobPath,
      })}::jsonb)
      ON CONFLICT (anahtar) DO UPDATE SET deger = EXCLUDED.deger
    `;

    // Frontend ile uyumlu response: { success, url, fileName, key }
    return NextResponse.json({ success: true, url: blob.url, fileName, key });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
