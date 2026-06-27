import { sql, initDB } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function KonumRedirect() {
  await initDB();
  const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar='whatsapp_ayar'`;
  let url = 'https://maps.google.com';
  if (rows.length > 0 && rows[0].deger && rows[0].deger.mapsUrl) {
    url = rows[0].deger.mapsUrl;
  }
  redirect(url);
}
