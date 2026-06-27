import { sql, initDB } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function Resim1Redirect() {
  await initDB();
  const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar='whatsapp_ayar'`;
  let url = '/hero-banner-desktop.jpg';
  if (rows.length > 0 && rows[0].deger && rows[0].deger.resim1Url) {
    url = rows[0].deger.resim1Url;
  }
  redirect(url);
}
