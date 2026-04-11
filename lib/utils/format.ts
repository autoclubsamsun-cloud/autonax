/** Sayıyı TL formatına çevirir */
export function formatTL(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return '₺' + value.toLocaleString('tr-TR');
}

/** Bugünün tarihini DD.MM.YYYY döndürür */
export function bugunTarih(): string {
  const d = new Date();
  return [
    d.getDate().toString().padStart(2, '0'),
    (d.getMonth() + 1).toString().padStart(2, '0'),
    d.getFullYear(),
  ].join('.');
}

/** Tarih string'ini Date objesine çevirir */
export function parseTarih(tarih: string): Date {
  const [g, a, y] = tarih.split('.').map(Number);
  return new Date(y, a - 1, g);
}

/** ms cinsinden süre için okunabilir string */
export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}dk`;
  return `${Math.floor(m / 60)}s ${m % 60}dk`;
}

/** Plakayı formatlı hale getirir: 34ABC123 → 34 ABC 123 */
export function formatPlaka(plaka: string): string {
  return plaka.replace(/([0-9]{2})([A-Z]+)([0-9]+)/, '$1 $2 $3');
}
