'use client';

import { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/lib/hooks/useStore';
import { formatTL, bugunTarih } from '@/lib/utils/format';
import type { Randevu } from '@/lib/types';
import { showToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';

type Filtre = 'hepsi' | 'bugun' | 'bekleyen' | 'borclu' | 'tamamlandi';

export default function RandevularPage() {
  const { randevular, setRandevular, loaded } = useStore();
  const [filtre, setFiltre] = useState<Filtre>('hepsi');
  const [arama, setArama] = useState('');
  const [secili, setSecili] = useState<Randevu | null>(null);
  const [detayAcik, setDetayAcik] = useState(false);
  const [odemeAcik, setOdemeAcik] = useState(false);

  const liste = useMemo(() => {
    let r = [...randevular];
    const bugun = bugunTarih();
    if (filtre === 'bugun') r = r.filter(x => x.tarih === bugun);
    else if (filtre === 'bekleyen') r = r.filter(x => x.durum === 'bekl');
    else if (filtre === 'borclu') r = r.filter(x => !x.odendi && x.odenenToplam < x.tutar);
    else if (filtre === 'tamamlandi') r = r.filter(x => x.islem);
    if (arama) {
      const q = arama.toLowerCase();
      r = r.filter(x => x.musteri.toLowerCase().includes(q) || x.plaka.toLowerCase().includes(q));
    }
    return r;
  }, [randevular, filtre, arama]);

  function odemeKaydet(idx: number, miktar: number, yontem: string, not: string) {
    const updated = randevular.map((r, i) => {
      if (r.id !== secili?.id) return r;
      const yeniToplam = (r.odenenToplam || 0) + miktar;
      return {
        ...r,
        odenenToplam: yeniToplam,
        odendi: yeniToplam >= r.tutar,
        odemeGecmisi: [...(r.odemeGecmisi || []), { tarih: bugunTarih(), yontem: yontem as any, miktar, not }],
      };
    });
    setRandevular(updated);
    showToast(`₺${miktar.toLocaleString('tr-TR')} tahsil edildi!`, 'green');
    setOdemeAcik(false);
  }

  if (!loaded) return <div style={{ padding: 40, color: 'var(--ink4)', textAlign: 'center' }}>Yükleniyor...</div>;

  return (
    <>
      <div className="ph">
        <div className="ph-ey">Yönetim</div>
        <div className="ph-title">Randevu Yönetimi</div>
        <div className="ph-sub">Tüm randevuları görüntüleyin, onaylayın veya iptal edin.</div>
      </div>

      {/* Hızlı işlem barı */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, padding: '10px 14px', background: 'var(--w)', border: '1.5px solid var(--bd)', borderRadius: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink4)', textTransform: 'uppercase' }}>Hızlı İşlem:</div>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--ink4)' }}>
          {secili ? <><b>{secili.musteri}</b> · {secili.plaka} · <span style={{ color: 'var(--r)', fontWeight: 700 }}>{formatTL(secili.tutar)}</span></> : 'Satıra tıklayarak randevu seçin'}
        </div>
        <button disabled={!secili} onClick={() => secili && setOdemeAcik(true)} style={{ padding: '7px 14px', border: '1.5px solid #d97706', borderRadius: 7, background: 'rgba(217,119,6,.06)', color: '#d97706', fontSize: 11, fontWeight: 700, cursor: secili ? 'pointer' : 'not-allowed', opacity: secili ? 1 : .4 }}>💵 Ödeme Al</button>
        <button disabled={!secili} onClick={() => secili && setDetayAcik(true)} style={{ padding: '7px 14px', border: '1.5px solid #2563EB', borderRadius: 7, background: 'rgba(37,99,235,.06)', color: '#2563EB', fontSize: 11, fontWeight: 700, cursor: secili ? 'pointer' : 'not-allowed', opacity: secili ? 1 : .4 }}>📋 Detay</button>
      </div>

      {/* Filtre + Arama */}
      <div className="k" style={{ marginBottom: 14 }}>
        <div className="kh" id="rdv-kh" style={{ flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="İsim veya plaka ara..." value={arama} onChange={e => setArama(e.target.value)} style={{ padding: '6px 10px 6px 28px', border: '1.5px solid var(--bd)', borderRadius: 7, fontSize: 12, fontFamily: 'Outfit', outline: 'none', width: 210 }} />
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink4)' }}>{liste.length} randevu</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['hepsi', 'bugun', 'bekleyen', 'borclu', 'tamamlandi'] as Filtre[]).map(f => (
              <button key={f} onClick={() => setFiltre(f)} style={{ padding: '5px 12px', border: '1.5px solid var(--bd)', borderRadius: 20, background: filtre === f ? 'var(--r)' : '#fff', color: filtre === f ? '#fff' : 'var(--ink4)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {{ hepsi: 'Hepsi', bugun: 'Bugün', bekleyen: 'Bekleyen', borclu: 'Borçlu', tamamlandi: 'Tamamlanan' }[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Tarih</th><th>Müşteri</th><th>Plaka / Araç</th><th>Hizmet</th><th>Tutar</th><th>Durum</th><th>Ödeme</th><th>İşlem</th></tr>
            </thead>
            <tbody>
              {liste.map(r => {
                const kalan = Math.max(0, r.tutar - (r.odenenToplam || 0));
                return (
                  <tr key={r.id} onClick={() => setSecili(r)} style={{ cursor: 'pointer', outline: secili?.id === r.id ? '2px solid var(--r)' : 'none' }}>
                    <td><b>{r.tarih}</b><br /><small style={{ color: 'var(--ink4)' }}>{r.saat}</small></td>
                    <td><b>{r.musteri}</b><br /><small style={{ color: 'var(--ink4)' }}>{r.tel}</small></td>
                    <td><span className="tbl-plaka">{r.plaka}</span><br /><small>{r.arac}</small></td>
                    <td>{r.hizmet.slice(0, 28)}</td>
                    <td className="tbl-fiyat">{formatTL(r.tutar)}</td>
                    <td><span className={`tag ${r.durum === 'onay' ? 'onay' : r.durum === 'iptal' ? 'iptal' : 'bekl'}`}>{r.durum === 'onay' ? 'Onaylı' : r.durum === 'iptal' ? 'İptal' : 'Bekliyor'}</span></td>
                    <td>
                      {r.odendi ? <span className="tag onay">Ödendi</span>
                        : kalan > 0 ? <span className="tag bekl">Kalan {formatTL(kalan)}</span>
                        : <span className="tag tamam">—</span>}
                    </td>
                    <td style={{ display: 'flex', gap: 5 }}>
                      <button className="ab ab-n" onClick={e => { e.stopPropagation(); setSecili(r); setDetayAcik(true); }}>Detay</button>
                      {kalan > 0 && <button className="ab ab-r" onClick={e => { e.stopPropagation(); setSecili(r); setOdemeAcik(true); }}>💵</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detay Modal */}
      <Modal open={detayAcik} onClose={() => setDetayAcik(false)} title="Randevu Detay" maxWidth={520}>
        {secili && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[['Müşteri', secili.musteri], ['Tel', secili.tel], ['Plaka', secili.plaka], ['Araç', secili.arac], ['Tarih', secili.tarih], ['Saat', secili.saat]].map(([l, v]) => (
                <div key={l}><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink4)', textTransform: 'uppercase', marginBottom: 3 }}>{l}</div><div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div></div>
              ))}
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink4)', textTransform: 'uppercase', marginBottom: 6 }}>Hizmet</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{secili.hizmet}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[['Toplam', formatTL(secili.tutar), 'var(--r)'], ['Ödenen', formatTL(secili.odenenToplam), 'var(--green)'], ['Kalan', formatTL(Math.max(0, secili.tutar - secili.odenenToplam)), 'var(--amber)']].map(([l, v, c]) => (
                <div key={l} style={{ padding: 10, background: 'var(--bg)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--ink4)', fontWeight: 700, textTransform: 'uppercase' }}>{l}</div>
                  <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, color: c as string }}>{v}</div>
                </div>
              ))}
            </div>
            {secili.odemeGecmisi?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink4)', textTransform: 'uppercase', marginBottom: 8 }}>Ödeme Geçmişi</div>
                {secili.odemeGecmisi.map((og, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--bg)' }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{og.yontem}</div><div style={{ fontSize: 10, color: 'var(--ink4)' }}>{og.not} · {og.tarih}</div></div>
                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 16, color: 'var(--green)' }}>+{formatTL(og.miktar)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Ödeme Modal */}
      {secili && (
        <OdemeModal
          open={odemeAcik}
          randevu={secili}
          onClose={() => setOdemeAcik(false)}
          onKaydet={odemeKaydet}
        />
      )}
    </>
  );
}

function OdemeModal({ open, randevu, onClose, onKaydet }: { open: boolean; randevu: Randevu; onClose: () => void; onKaydet: (idx: number, miktar: number, yontem: string, not: string) => void }) {
  const [miktar, setMiktar] = useState(0);
  const [yontem, setYontem] = useState('');
  const [not, setNot] = useState('');
  const kalan = Math.max(0, randevu.tutar - (randevu.odenenToplam || 0));

  useEffect(() => { setMiktar(kalan); }, [kalan]);

  return (
    <Modal open={open} onClose={onClose} title="💵 Ödeme Al" maxWidth={420}
      footer={
        <>
          <button className="btn-s" style={{ flex: 1 }} onClick={onClose}>İptal</button>
          <button className="btn-p" style={{ flex: 2 }} onClick={() => {
            if (!yontem) { showToast('Ödeme yöntemi seçin!', 'red'); return; }
            if (miktar <= 0 || miktar > kalan) { showToast('Geçersiz tutar!', 'red'); return; }
            onKaydet(0, miktar, yontem, not);
          }}>KAYDET</button>
        </>
      }
    >
      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 12, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ fontSize: 11, color: 'var(--ink4)' }}>{randevu.musteri} · {randevu.plaka}</div><div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 2 }}>Kalan Borç</div></div>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: 'var(--r)' }}>{formatTL(kalan)}</div>
      </div>
      <div className="ff">
        <label>Tutar (₺)</label>
        <input type="number" value={miktar} min={1} max={kalan} onChange={e => setMiktar(Number(e.target.value))} />
      </div>
      <div className="ff">
        <label>Not</label>
        <input type="text" placeholder="Peşin, avans..." value={not} onChange={e => setNot(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 4 }}>
        {[['Nakit', '💵'], ['Kredi Kart', '💳'], ['Havale', '🏦']].map(([y, ic]) => (
          <button key={y} onClick={() => setYontem(y)} style={{ padding: '10px 6px', border: `1.5px solid ${yontem === y ? 'var(--r)' : 'var(--bd)'}`, borderRadius: 8, background: yontem === y ? 'rgba(176,28,46,.06)' : '#fff', color: yontem === y ? 'var(--r)' : 'var(--ink4)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 20 }}>{ic}</span>{y}
          </button>
        ))}
      </div>
    </Modal>
  );
}
