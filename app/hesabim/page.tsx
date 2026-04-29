/**
 * Müşteri Paneli — Hesabım
 *
 * Bu dosya artık redirect yapmıyor.
 * /hesabim URL'sine gelen istekler vercel.json'daki rewrite kuralı
 * tarafından /standalone/hesabim.html'e yönlendirilir (URL korunur).
 *
 * Bu sayfa fallback olarak duruyor — eğer rewrite çalışmazsa
 * boş bir sayfa gösterir, redirect yapmaz.
 */
export default function HesabimPage() {
  return null;
}
