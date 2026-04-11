'use client';

import { useState } from 'react';
import { useStore } from '@/lib/hooks/useStore';
import { showToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import type { Bayi } from '@/lib/types';

const EMPTY_BAYI: Omit<Bayi, 'id'> = { isim: '', sahip: '', tel: '', email: '', sehir: '', adres: '', indirimOrani: 10, aktif: true, kayitTarihi: '' };

export default function BayilerPage() {
  const { bayiler, setBayiler, loaded } = useStore();
  const [modalAcik, setModalAcik] = useState(false);
  const [duzenle, setDuzenle] = useState<Bayi | null>(null);
  const [form, setForm] = useState<Omit<Bayi, 'id'>>(EMPTY_BAYI);

  if (!loaded) return <div style={{ padding: 40, color: 'var(--ink4)' }}>Yükleniyor...</div>;

  function acModal(bayi?: Bayi) {
    if (bayi) { setDuzenle(bayi); setForm({ isim: bayi.isim, sahip: bayi.sahip, tel: bayi.tel, email: bayi.email, sehir: bayi.sehir, adres: bayi.adres, indirimOrani: bayi.indirimOrani, aktif: bayi.aktif, kayitTarihi: bayi.kayitTarihi }); }
    else { setDuzenle(null); setForm(EMPTY_BAYI); }
    setModalAcik(true);
  }

  function kaydet() {
    if (!form.isim) { showToast('Bayi adı zorunlu!', 'red'); return; }
    if (duzenle) {
      setBayiler(bayiler.map(b => b.id === duzenle.id ? { ...b, ...form } : b));
      showToast('Bayi güncellendi!', 'green');
    } else {
      setBayiler([...bayiler, { id: 'b' + Date.now(), ...form, kayitTarihi: new Date().toLocaleDateString('tr-TR') }]);
      showToast('Bayi eklendi!', 'green');
    }
    setModalAcik(false);
  }

  function sil(id: string) {
    if (!confirm('Bu bayi silinsin mi?')) return;
    setBayiler(bayiler.filter(b => b.id !== id));
    showToast('Bayi silindi', 'green');
  }

  const aktif = bayiler.filter(b => b.aktif).length;

  return (
    <>
      <div className="ph">
        <div className="ph-ey">Yönetim</div>
        <div className="ph-title">Bayi Yönetimi</div>
        <div className="ph-sub">{bayiler.length} bayi · {aktif} aktif</div>
      </div>

      <div className="g3" style={{ marginBottom: 14 }}>
        {[['Toplam Bayi', String(bayiler.length), 'var(--r)'], ['Aktif', String(aktif), 'var(--green)'], ['Pasif', String(bayiler.length - aktif), 'var(--amber)']].map(([l, v, c]) => (
          <div key={l} className="k" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: 'var(--ink4)' }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="k">
        <div className="kh">
          <div className="kt">Bayi Listesi</div>
          <button className="btn-p" onClick={() => acModal()}>+ Bayi Ekle</button>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Bayi Adı</th><th>Sahip</th><th>Şehir</th><th>Tel</th><th>İndirim</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody>
              {bayiler.map(b => (
                <tr key={b.id}>
                  <td><b>{b.isim}</b></td>
                  <td>{b.sahip}</td>
                  <td>{b.sehir}</td>
                  <td>{b.tel}</td>
                  <td><b style={{ color: 'var(--blue)', fontFamily: 'Bebas Neue', fontSize: 16 }}>%{b.indirimOrani}</b></td>
                  <td><span className={`tag ${b.aktif ? 'onay' : 'tamam'}`}>{b.aktif ? 'Aktif' : 'Pasif'}</span></td>
                  <td style={{ display: 'flex', gap: 5 }}>
                    <button className="ab ab-n" onClick={() => acModal(b)}>Düzenle</button>
                    <button className="ab ab-r" onClick={() => sil(b.id)}>Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalAcik} onClose={() => setModalAcik(false)} title={duzenle ? 'BAYİ DÜZENLE' : 'YENİ BAYİ'}
        footer={<><button className="btn-s" style={{ flex: 1 }} onClick={() => setModalAcik(false)}>İptal</button><button className="btn-p" style={{ flex: 2 }} onClick={kaydet}>KAYDET</button></>}
      >
        <div className="form-grid">
          <div className="ff full"><label>Bayi Adı *</label><input value={form.isim} onChange={e => setForm(f => ({ ...f, isim: e.target.value }))} /></div>
          <div className="ff"><label>Sahip</label><input value={form.sahip} onChange={e => setForm(f => ({ ...f, sahip: e.target.value }))} /></div>
          <div className="ff"><label>Şehir</label><input value={form.sehir} onChange={e => setForm(f => ({ ...f, sehir: e.target.value }))} /></div>
          <div className="ff"><label>Tel</label><input value={form.tel} onChange={e => setForm(f => ({ ...f, tel: e.target.value }))} /></div>
          <div className="ff"><label>E-posta</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div className="ff full"><label>Adres</label><input value={form.adres} onChange={e => setForm(f => ({ ...f, adres: e.target.value }))} /></div>
          <div className="ff"><label>İndirim Oranı (%)</label><input type="number" min={0} max={50} value={form.indirimOrani} onChange={e => setForm(f => ({ ...f, indirimOrani: Number(e.target.value) }))} /></div>
          <div className="ff" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 }}>
            <button className={`tgl ${form.aktif ? 'on' : ''}`} onClick={() => setForm(f => ({ ...f, aktif: !f.aktif }))} />
            <label style={{ fontSize: 13, fontWeight: 600 }}>Aktif</label>
          </div>
        </div>
      </Modal>
    </>
  );
}
