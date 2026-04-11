'use client';

import { useState, useMemo } from 'react';
import { useStore } from '@/lib/hooks/useStore';
import { formatTL } from '@/lib/utils/format';

export default function MusterilerPage() {
  const { randevular, loaded } = useStore();
  const [arama, setArama] = useState('');

  const musteriler = useMemo(() => {
    const map = new Map<string, { isim: string; tel: string; plaka: string; arac: string; islemSayisi: number; toplamTutar: number; sonTarih: string }>();
    randevular.forEach(r => {
      const key = r.musteri + r.plaka;
      const existing = map.get(key);
      if (existing) {
        existing.islemSayisi++;
        existing.toplamTutar += r.tutar;
        if (r.tarih > existing.sonTarih) existing.sonTarih = r.tarih;
      } else {
        map.set(key, { isim: r.musteri, tel: r.tel, plaka: r.plaka, arac: r.arac, islemSayisi: 1, toplamTutar: r.tutar, sonTarih: r.tarih });
      }
    });
    return Array.from(map.values());
  }, [randevular]);

  const filtered = useMemo(() => {
    if (!arama) return musteriler;
    const q = arama.toLowerCase();
    return musteriler.filter(m => m.isim.toLowerCase().includes(q) || m.plaka.toLowerCase().includes(q) || m.tel.includes(q));
  }, [musteriler, arama]);

  if (!loaded) return <div style={{ padding: 40, color: 'var(--ink4)' }}>Yükleniyor...</div>;

  return (
    <>
      <div className="ph">
        <div className="ph-ey">Yönetim</div>
        <div className="ph-title">Müşteri Yönetimi</div>
        <div className="ph-sub">{musteriler.length} kayıtlı müşteri</div>
      </div>

      <div className="k">
        <div className="kh">
          <div style={{ position: 'relative' }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="İsim, plaka veya tel ara..." value={arama} onChange={e => setArama(e.target.value)} style={{ padding: '6px 10px 6px 28px', border: '1.5px solid var(--bd)', borderRadius: 7, fontSize: 12, fontFamily: 'Outfit', outline: 'none', width: 240 }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink4)' }}>{filtered.length} müşteri</div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Müşteri</th><th>Tel</th><th>Plaka / Araç</th><th>İşlem</th><th>Toplam</th><th>Son Hizmet</th></tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: 13, color: '#fff', flexShrink: 0 }}>
                        {m.isim.charAt(0)}
                      </div>
                      <b>{m.isim}</b>
                    </div>
                  </td>
                  <td>{m.tel}</td>
                  <td><span className="tbl-plaka">{m.plaka}</span><br /><small>{m.arac}</small></td>
                  <td style={{ textAlign: 'center' }}><b>{m.islemSayisi}</b> adet</td>
                  <td className="tbl-fiyat">{formatTL(m.toplamTutar)}</td>
                  <td>{m.sonTarih}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
