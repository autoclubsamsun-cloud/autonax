'use client';

import { useStore } from '@/lib/hooks/useStore';
import { formatTL } from '@/lib/utils/format';

export default function HizmetlerPage() {
  const { randevular, loaded } = useStore();

  const tamamlanan = randevular.filter(r => r.islem);

  if (!loaded) return <div style={{ padding: 40, color: 'var(--ink4)' }}>Yükleniyor...</div>;

  return (
    <>
      <div className="ph">
        <div className="ph-ey">Yönetim</div>
        <div className="ph-title">Hizmet Geçmişi</div>
        <div className="ph-sub">Tamamlanan {tamamlanan.length} hizmet</div>
      </div>

      <div className="k">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Tarih</th><th>Müşteri</th><th>Plaka / Araç</th><th>Hizmet</th><th>Tutar</th><th>Fatura</th><th>Ödeme</th></tr>
            </thead>
            <tbody>
              {tamamlanan.map(r => (
                <tr key={r.id}>
                  <td><b>{r.tarih}</b><br /><small style={{ color: 'var(--ink4)' }}>{r.saat}</small></td>
                  <td><b>{r.musteri}</b><br /><small style={{ color: 'var(--ink4)' }}>{r.tel}</small></td>
                  <td><span className="tbl-plaka">{r.plaka}</span><br /><small>{r.arac}</small></td>
                  <td>{r.hizmet}</td>
                  <td className="tbl-fiyat">{formatTL(r.tutar)}</td>
                  <td>{r.faturaNo ? <span className="tag onay">{r.faturaNo}</span> : <span className="tag tamam">—</span>}</td>
                  <td><span className={`tag ${r.odendi ? 'onay' : 'bekl'}`}>{r.odendi ? 'Ödendi' : 'Bekliyor'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
