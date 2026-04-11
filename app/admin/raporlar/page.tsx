'use client';

import { useState, useMemo } from 'react';
import { useStore } from '@/lib/hooks/useStore';
import { formatTL } from '@/lib/utils/format';

type Donem = 'bu-ay' | 'gecen-ay' | 'bu-yil';

export default function RaporlarPage() {
  const { randevular, urunler, loaded } = useStore();
  const [donem, setDonem] = useState<Donem>('bu-ay');

  const stats = useMemo(() => {
    const tamamlanan = randevular.filter(r => r.islem && r.odendi);
    const toplamGelir = tamamlanan.reduce((s, r) => s + r.tutar, 0);
    const bekleyenOdeme = randevular.filter(r => !r.odendi).reduce((s, r) => s + Math.max(0, r.tutar - (r.odenenToplam || 0)), 0);
    const ortalamaIslem = tamamlanan.length > 0 ? Math.round(toplamGelir / tamamlanan.length) : 0;

    // Hizmet bazlı
    const hizmetSayisi: Record<string, number> = {};
    randevular.forEach(r => {
      const k = r.hizmet.split(' ').slice(0, 2).join(' ');
      hizmetSayisi[k] = (hizmetSayisi[k] || 0) + 1;
    });
    const topHizmetler = Object.entries(hizmetSayisi).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxCount = topHizmetler[0]?.[1] || 1;

    return { toplamGelir, tamamlanan: tamamlanan.length, bekleyenOdeme, ortalamaIslem, topHizmetler, maxCount };
  }, [randevular, donem]);

  if (!loaded) return <div style={{ padding: 40, color: 'var(--ink4)' }}>Yükleniyor...</div>;

  return (
    <>
      <div className="ph">
        <div className="ph-ey">Analitik</div>
        <div className="ph-title">Raporlar</div>
        <div className="ph-sub">Gelir, hizmet ve müşteri analizleri</div>
      </div>

      {/* Dönem seçimi */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['bu-ay', 'gecen-ay', 'bu-yil'] as Donem[]).map(d => (
          <button key={d} className={`rapor-donem-btn ${donem === d ? 'rapor-donem-aktif' : ''}`} onClick={() => setDonem(d)}>
            {{ 'bu-ay': 'Bu Ay', 'gecen-ay': 'Geçen Ay', 'bu-yil': 'Bu Yıl' }[d]}
          </button>
        ))}
      </div>

      {/* Özet kartlar */}
      <div className="g4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Toplam Gelir', value: formatTL(stats.toplamGelir), color: 'var(--r)' },
          { label: 'Tamamlanan İşlem', value: String(stats.tamamlanan), color: 'var(--green)' },
          { label: 'Bekleyen Tahsilat', value: formatTL(stats.bekleyenOdeme), color: 'var(--amber)' },
          { label: 'Ortalama İşlem', value: formatTL(stats.ortalamaIslem), color: 'var(--blue)' },
        ].map(s => (
          <div key={s.label} className="k" style={{ padding: 16 }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--ink4)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="g2">
        {/* En Çok İstenen Hizmetler */}
        <div className="k">
          <div className="kh"><div className="kt">En Çok İstenen Hizmetler</div></div>
          <div className="kb">
            <div className="rapor-bar-wrap">
              {stats.topHizmetler.map(([h, s]) => (
                <div key={h} className="rapor-bar-row">
                  <div className="rapor-bar-lbl">{h.slice(0, 8)}</div>
                  <div className="rapor-bar-track">
                    <div className="rapor-bar-fill" style={{ width: `${(s / stats.maxCount) * 100}%`, background: 'var(--r)' }} />
                  </div>
                  <div className="rapor-bar-val">{s} işlem</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ödeme Yöntemi Dağılımı */}
        <div className="k">
          <div className="kh"><div className="kt">Ödeme Yöntemleri</div></div>
          <div className="kb">
            {(() => {
              const sayac: Record<string, number> = {};
              randevular.forEach(r => r.odemeGecmisi?.forEach(o => { sayac[o.yontem] = (sayac[o.yontem] || 0) + 1; }));
              const toplam = Object.values(sayac).reduce((a, b) => a + b, 0) || 1;
              return Object.entries(sayac).map(([y, s]) => (
                <div key={y} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--bg)' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink3)' }}>{y}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 80, height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${(s / toplam) * 100}%`, height: '100%', background: 'var(--r)', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink4)', width: 30 }}>{s}×</span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Randevu tablosu - ödeme durumu */}
      <div className="k">
        <div className="kh"><div className="kt">Gelir Detayı</div></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Tarih</th><th>Müşteri</th><th>Hizmet</th><th>Tutar</th><th>Ödenen</th><th>Kalan</th><th>Durum</th></tr></thead>
            <tbody>
              {randevular.slice(0, 10).map(r => {
                const kalan = Math.max(0, r.tutar - (r.odenenToplam || 0));
                return (
                  <tr key={r.id}>
                    <td>{r.tarih}</td>
                    <td><b>{r.musteri}</b></td>
                    <td>{r.hizmet.slice(0, 25)}</td>
                    <td className="tbl-fiyat">{formatTL(r.tutar)}</td>
                    <td style={{ color: 'var(--green)', fontFamily: 'Bebas Neue', fontSize: 14 }}>{formatTL(r.odenenToplam)}</td>
                    <td style={{ color: kalan > 0 ? 'var(--amber)' : 'var(--green)', fontFamily: 'Bebas Neue', fontSize: 14 }}>{kalan > 0 ? formatTL(kalan) : '✓'}</td>
                    <td><span className={`tag ${r.odendi ? 'onay' : 'bekl'}`}>{r.odendi ? 'Ödendi' : 'Bekliyor'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
