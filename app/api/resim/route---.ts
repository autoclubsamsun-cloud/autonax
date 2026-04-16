import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const klasor = (formData.get('klasor') as string) || 'urunler';
    if (!file) return NextResponse.json({ success: false, error: 'Dosya bulunamadi' }, { status: 400 });
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) return NextResponse.json({ success: false, error: 'Sadece JPG PNG WEBP GIF' }, { status: 400 });
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ success: false, error: 'Max 2MB' }, { status: 400 });
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}_${safeName}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', klasor);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, fileName), buffer);
    const url = `/uploads/${klasor}/${fileName}`;
    return NextResponse.json({ success: true, url, fileName });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
