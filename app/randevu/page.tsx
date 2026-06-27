import { sql, initDB } from '@/lib/db';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
    await initDB();
    const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar='whatsapp_ayar'`;
    let resim1 = 'https://autonax.com.tr/hero-banner-desktop.jpg';
    if(rows.length > 0 && rows[0].deger && rows[0].deger.resim1Url) {
        resim1 = rows[0].deger.resim1Url;
    }
    return {
        title: 'AutoClub Samsun - Randevunuz Onaylandı',
        description: 'Araç kabul detayları, işletme konumu ve müşteri fotoğraflarımız için tıklayın.',
        openGraph: {
            title: 'AutoClub Samsun - Randevunuz Onaylandı',
            description: 'Araç kabul detayları, işletme konumu ve müşteri fotoğraflarımız için tıklayın.',
            images: [resim1],
        }
    };
}

export default function RandevuPage() {
    redirect('/');
}
