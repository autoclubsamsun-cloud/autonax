'use client';

import { useState } from 'react';
import { useStore } from '@/lib/hooks/useStore';
import { formatTL } from '@/lib/utils/format';
import { showToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import type { PPFUrun } from '@/lib/types';

type AnaKat = 'ppf' | 'seramik' | 'bakim';

export default function FiyatlarPage() {
  const { urunler, setUrunler, seramik, digerHizmetler, kategoriler, loaded } = useStore();
  const [anaKat, setAnaKat] = useState<AnaKat>('ppf');
  const [altKat, setAltKat] = useState<string>('alman');
  const [ekleAcik, setEkleAcik] = useState(false);
  const [yeniUrun, setYeniUrun] = useState({ isim: '', kat: 'ppf|alman', full: '', on3: '', kaput: '', garanti: '10', rozet: '' });

  if (!loaded) return <div style={{ padding: 40, color: 'var(--ink4)' }}>Yükleniyor...</div>;

  const kat = kategoriler[anaKat];
  const altKatlar = Object.entries(kat?.altKategoriler || {});

  const ppfUrunler = Object.entries(urunler).filter(([, u]) => u.kat === anaKat && u.altKat === altKat);
  const seramikUrunler = seramik.filter(u => u.altKat === altKat);
  const digerUrunler = digerHizmetler.filter(u => u.kat === anaKat && u.altKat === altKat);

  function fiyatGuncelle(kod: string, alan: keyof PPFUrun, deger: number | null) {
    setUrunler({ ...urunler, [kod]: { ...urunler[kod], [alan]: deger } });
  }

  function urunKaydet(kod: string) {
    showToast(`✅ ${urunler[kod].isim.slice(0, 20)} güncellendi!`, 'green');
  }

  function yeniUrunEkle() {
    const [k, ak] = yeniUrun.kat.split('|');
    if (!yeniUrun.isim) { showToast('Ürün adı zorunlu!', 'red'); return; }
    const kod = yeniUrun.isim.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || `U${Date.now()}`;
    setUrunler({
      ...urunler,
      [kod]: {
        isim: yeniUrun.isim, kat: k, altKat: ak,
        garanti: parseInt(yeniUrun.garanti) || 5,
        full: parseInt(yeniUrun.full) || null,
        on3: parseInt(yeniUrun.on3) || null,
        kaput: parseInt(yeniUrun.kaput) || null,
        bayiIndirim: 10, rozet: yeniUrun.rozet, aktif: true,
      },
    });
    showToast(`✅ ${yeniUrun.isim} eklendi!`, 'green');
    setEkleAcik(false);
    setYeniUrun({ isim: '', kat: 'ppf|alman', full: '', on3: '', kaput: '', garanti: '10', rozet: '' });
  }

  return (
    <>
      <div className="ph">
        <div className="ph-ey">Yönetim</div>
        <div className="ph-title">Ürün & Fiyat Yönetimi</div>
        <div className="ph-sub">PPF · Seramik · Temizlik & Bakım — Bayi fiyatlandırması dahil</div>
      </div>

      {/* Ana kategori + Ekle butonu */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(kategoriler).map(([k, kat]) => (
            <button key={k} className={`fiyat-tab ${anaKat === k ? 'fiyat-tab-aktif' : ''}`} onClick={() => { setAnaKat(k as AnaKat); setAltKat(Object.keys(kat.altKategoriler)[0] || ''); }}>
              {kat.ikon} {kat.isim}
            </button>
          ))}
        </div>
        <button className="btn-p" onClick={() => setEkleAcik(true)}>+ Yeni Ürün Ekle</button>
      </div>

      {/* Alt kategori */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {altKatlar.map(([k, ak]) => (
          <button key={k} className={`falt-tab ${altKat === k ? 'falt-tab-aktif' : ''}`} onClick={() => setAltKat(k)}>
            {ak.ikon} {ak.isim}
          </button>
        ))}
      </div>

      {/* Ürün kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
        {anaKat === 'ppf' && ppfUrunler.map(([kod, u]) => (
          <div key={kod} className="urun-kart">
            <div className="urun-kart-header">
              {u.rozet && <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--r)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20, zIndex: 1 }}>{u.rozet}</div>}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 20, letterSpacing: 2, color: '#fff' }}>{u.isim.split(' ').slice(1, 4).join(' ')}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>{u.isim}</div>
                {u.garanti && <span style={{ fontSize: 9, background: 'rgba(255,255,255,.2)', color: '#fff', padding: '2px 7px', borderRadius: 10, marginTop: 6, display: 'inline-block' }}>{u.garanti} Yıl Garanti</span>}
              </div>
            </div>
            <div className="urun-kart-body">
              {[['Tam Araç', 'full'], ['Ön 3 Parça', 'on3'], ['Kaput', 'kaput']].map(([lbl, alan]) => (
                <div key={alan} className="urun-fiyat-row">
                  <div className="urun-fiyat-label">{lbl}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink4)' }}>₺</span>
                    <input type="number" className="urun-fiyat-input" defaultValue={u[alan as keyof PPFUrun] as number || ''} onChange={e => fiyatGuncelle(kod, alan as keyof PPFUrun, parseInt(e.target.value) || null)} />
                  </div>
                </div>
              ))}
              <div className="urun-aksiyon">
                <button className="btn-p" style={{ flex: 1, padding: '8px', fontSize: 11 }} onClick={() => urunKaydet(kod)}>💾 Kaydet</button>
              </div>
            </div>
          </div>
        ))}

        {(anaKat === 'seramik' || anaKat === 'bakim') && (
          (anaKat === 'seramik' ? seramikUrunler : digerUrunler).map((u, i) => (
            <div key={i} className="urun-kart">
              <div className="urun-kart-header" style={{ minHeight: 80 }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 2, color: '#fff' }}>{u.isim}</div>
                </div>
              </div>
              <div className="urun-kart-body">
                <div className="urun-fiyat-row">
                  <div className="urun-fiyat-label">Fiyat</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink4)' }}>₺</span>
                    <input type="number" className="urun-fiyat-input" defaultValue={u.tutar} onChange={e => {}} />
                  </div>
                </div>
                <div className="urun-aksiyon">
                  <button className="btn-p" style={{ flex: 1, padding: '8px', fontSize: 11 }} onClick={() => showToast('Güncellendi!', 'green')}>💾 Kaydet</button>
                </div>
              </div>
            </div>
          ))
        )}

        {ppfUrunler.length === 0 && anaKat === 'ppf' && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--ink4)', fontSize: 13 }}>
            Bu kategoride ürün yok.{' '}
            <button onClick={() => setEkleAcik(true)} style={{ color: 'var(--r)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700 }}>+ Ürün Ekle</button>
          </div>
        )}
      </div>

      {/* Yeni Ürün Modal */}
      <Modal open={ekleAcik} onClose={() => setEkleAcik(false)} title="YENİ ÜRÜN EKLE"
        footer={
          <>
            <button className="btn-s" style={{ flex: 1 }} onClick={() => setEkleAcik(false)}>İptal</button>
            <button className="btn-p" style={{ flex: 2 }} onClick={yeniUrunEkle}>ÜRÜNÜ EKLE</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="ff" style={{ gridColumn: '1/-1' }}>
            <label>Ürün Adı *</label>
            <input type="text" placeholder="örn: NiDOJP N10 300 Mikron TPU PPF" value={yeniUrun.isim} onChange={e => setYeniUrun(v => ({ ...v, isim: e.target.value }))} />
          </div>
          <div className="ff" style={{ gridColumn: '1/-1' }}>
            <label>Kategori *</label>
            <select value={yeniUrun.kat} onChange={e => setYeniUrun(v => ({ ...v, kat: e.target.value }))}>
              {Object.entries(kategoriler).flatMap(([k, kat]) =>
                Object.entries(kat.altKategoriler).map(([ak, a]) => (
                  <option key={`${k}|${ak}`} value={`${k}|${ak}`}>{kat.isim} › {a.isim}</option>
                ))
              )}
            </select>
          </div>
          <div className="ff"><label>Fiyat / Tam Araç (₺)</label><input type="number" placeholder="70000" value={yeniUrun.full} onChange={e => setYeniUrun(v => ({ ...v, full: e.target.value }))} /></div>
          <div className="ff"><label>Ön 3 Parça (₺)</label><input type="number" placeholder="20000" value={yeniUrun.on3} onChange={e => setYeniUrun(v => ({ ...v, on3: e.target.value }))} /></div>
          <div className="ff"><label>Kaput (₺)</label><input type="number" placeholder="7000" value={yeniUrun.kaput} onChange={e => setYeniUrun(v => ({ ...v, kaput: e.target.value }))} /></div>
          <div className="ff"><label>Garanti (Yıl)</label><input type="number" placeholder="10" value={yeniUrun.garanti} onChange={e => setYeniUrun(v => ({ ...v, garanti: e.target.value }))} /></div>
          <div className="ff" style={{ gridColumn: '1/-1' }}><label>Rozet</label><input type="text" placeholder="⭐ POPÜLER" value={yeniUrun.rozet} onChange={e => setYeniUrun(v => ({ ...v, rozet: e.target.value }))} /></div>
        </div>
      </Modal>
    </>
  );
}
