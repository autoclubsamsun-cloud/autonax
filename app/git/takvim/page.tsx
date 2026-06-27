import { redirect } from 'next/navigation';

export default function TakvimRedirect({ searchParams }: { searchParams: { [key: string]: string } }) {
  const p = searchParams;
  const url = '/api/takvim?baslik=' + encodeURIComponent(p.b || 'Randevu')
    + '&tarih=' + encodeURIComponent(p.t || '')
    + '&saat=' + encodeURIComponent(p.s || '09:00')
    + '&sure=' + encodeURIComponent(p.d || '120')
    + '&aciklama=' + encodeURIComponent(p.a || '')
    + '&konum=' + encodeURIComponent(p.k || '');
  redirect(url);
}
