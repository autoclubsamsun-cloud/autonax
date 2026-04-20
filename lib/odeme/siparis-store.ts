/**
 * Sipariş saklama modülü
 *
 * Şimdilik basit bir yapı kullanıyoruz:
 * - Vercel serverless ortamında veri kalıcı değildir (her request yeni instance olabilir)
 * - Gerçek kalıcılık için veritabanı (Postgres/MongoDB/Supabase) gerekir
 *
 * ŞU ANKI DAVRANIŞ:
 * - Sipariş bilgileri frontend tarafında localStorage'da tutulur
 * - Backend sadece ÖDEME AKIŞINI yönetir, bildirim gelince localStorage'a geri push eder
 * - Idempotency için işlenmiş merchant_oid listesi memory'de (sunucu yeniden başlarsa kaybolur)
 *
 * TODO: Pazartesi veya sonra — Supabase/Postgres entegrasyonu ekle
 */

// Basit in-memory idempotency cache (işlenmiş siparişler)
// Uyarı: serverless cold start sonrası sıfırlanır
const islenmisOdemeler = new Map<string, { tarih: number; durum: string }>();

/**
 * Daha önce bu sipariş için callback işlendi mi?
 * PayTR aynı bildirimi birden fazla kez gönderebilir, sadece ilkini işlemeliyiz.
 */
export function odemeIslendiMi(merchantOid: string): boolean {
  return islenmisOdemeler.has(merchantOid);
}

/**
 * Siparişi işlenmiş olarak işaretle.
 */
export function odemeIslendiOlarakIsaretle(
  merchantOid: string,
  durum: 'ODENDI' | 'HATALI' | 'IPTAL'
): void {
  islenmisOdemeler.set(merchantOid, {
    tarih: Date.now(),
    durum,
  });

  // Eski kayıtları temizle (24 saatten eski)
  const yirmiDortSaatOnce = Date.now() - 24 * 60 * 60 * 1000;
  for (const [oid, kayit] of islenmisOdemeler.entries()) {
    if (kayit.tarih < yirmiDortSaatOnce) {
      islenmisOdemeler.delete(oid);
    }
  }
}

/**
 * İşlenmiş sipariş detayını getir.
 */
export function odemeDurumGetir(
  merchantOid: string
): { tarih: number; durum: string } | null {
  return islenmisOdemeler.get(merchantOid) ?? null;
}
