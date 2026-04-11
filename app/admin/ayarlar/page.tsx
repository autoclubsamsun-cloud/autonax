'use client';

import { useState } from 'react';
import { useStore } from '@/lib/hooks/useStore';
import { showToast } from '@/components/ui/Toast';
import { PERSONEL_DEMO, ROL_TANIMLAR } from '@/lib/data/personel';
import type { Personel, Rol } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import { storageGet, storageSet, STORAGE_KEYS } from '@/lib/utils/storage';

const TABS = [
  { id: 'admin',    label: '⚙️ Admin' },
  { id: 'genel',    label: '🌐 Genel' },
  { id: 'seo',      label: '🔍 SEO' },
  { id: 'sosyal',   label: '📱 Sosyal' },
  { id: 'odeme',    label: '💳 Ödeme' },
  { id: 'fatura',   label: '🧾 Fatura' },
];

const YETKI_TANIMLAR = [
  { key: 'randevu',  lbl: 'Randevu Yönetimi',  ikon: '📅' },
  { key: 'odeme',    lbl: 'Ödeme Al / Taksit',  ikon: '💳' },
  { key: 'fatura',   lbl: 'Fatura Kes (EDM)',    ikon: '🧾' },
  { key: 'fiyat',    lbl: 'Fiyat Yönetimi',      ikon: '💰' },
  { key: 'rapor',    lbl: 'Raporlar',             ikon: '📊' },
  { key: 'bayi',     lbl: 'Bayi Yönetimi',       ikon: '🏪' },
  { key: 'ayarlar',  lbl: 'Sistem Ayarları',     ikon: '⚙️' },
  { key: 'personel', lbl: 'Personel Yönetimi',   ikon: '👥' },
] as const;

export default function AyarlarPage() {
  const [aktifTab, setAktifTab] = useState('admin');
  const [personelList, setPersonelList] = useState<Personel[]>(() =>
    storageGet<Personel[]>(STORAGE_KEYS.PERSONEL) ?? PERSONEL_DEMO
  );
  const [perModal, setPerModal] = useState(false);
  const [duzenleIdx, setDuzenleIdx] = useState<number | null>(null);
  const [perForm, setPerForm] = useState<Omit<Personel, 'id'>>({
    ad: '', rol: 'teknisyen', email: '', tel: '', sifre: '', aktif: true,
    yetkiler: { randevu: false, odeme: false, fatura: false, fiyat: false, rapor: false, bayi: false, ayarlar: false, personel: false },
  });

  // Site ayarları state
  const [genel, setGenel] = useState({ firmaAdi: 'Autonax Araç Koruma', slogan: 'Premium PPF & Seramik Kaplama', telefon: '0362 000 00 00', email: 'info@autonax.com', adres: 'Samsun, Türkiye', calisma: 'Hft İçi 09:00–18:00' });
  const [seo, setSeo] = useState({ title: 'Autonax | Premium PPF & Seramik Kaplama', description: 'Autonax ile aracınızı koruyun.', keywords: 'ppf, seramik kaplama, araç koruma' });
  const [sosyal, setSosyal] = useState({ instagram: '', facebook: '', whatsapp: '', youtube: '' });
  const [edmAyar, setEdmAyar] = useState({ aktif: false, testMod: true, kullaniciAdi: '', sifre: '', vknTckn: '', faturaTipi: 'EARSIV' });
  const [odemeAyar, setOdemeAyar] = useState({ aktifGateway: 'none', iyzicoApiKey: '', paytrMerchantId: '', vadeKarsilayanFirma: true });

  function personelKaydet() {
    const liste = [...personelList];
    if (duzenleIdx !== null) liste[duzenleIdx] = { ...liste[duzenleIdx], ...perForm };
    else liste.push({ id: 'p' + Date.now(), ...perForm });
    setPersonelList(liste);
    storageSet(STORAGE_KEYS.PERSONEL, liste);
    showToast(duzenleIdx !== null ? 'Personel güncellendi!' : 'Personel eklendi!', 'green');
    setPerModal(false);
  }

  function acModal(idx?: number) {
    if (idx !== undefined) {
      const p = personelList[idx];
      setDuzenleIdx(idx);
      setPerForm({ ad: p.ad, rol: p.rol, email: p.email, tel: p.tel, sifre: '', aktif: p.aktif, yetkiler: { ...p.yetkiler } });
    } else {
      setDuzenleIdx(null);
      setPerForm({ ad: '', rol: 'teknisyen', email: '', tel: '', sifre: '', aktif: true, yetkiler: { randevu: false, odeme: false, fatura: false, fiyat: false, rapor: false, bayi: false, ayarlar: false, personel: false } });
    }
    setPerModal(true);
  }

  const ROL_SABLON: Record<string, Partial<Personel['yetkiler']>> = {
    teknisyen:     { randevu: true },
    resepsiyonist: { randevu: true, odeme: true },
    muhasebe:      { randevu: true, odeme: true, fatura: true, rapor: true },
    admin:         { randevu: true, odeme: true, fatura: true, fiyat: true, rapor: true, bayi: true, ayarlar: true },
    super_admin:   { randevu: true, odeme: true, fatura: true, fiyat: true, rapor: true, bayi: true, ayarlar: true, personel: true },
  };

  return (
    <>
      <div className="ph">
        <div className="ph-ey">Sistem</div>
        <div className="ph-title">Ayarlar</div>
        <div className="ph-sub">Panel ve site yapılandırması</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16, background: 'var(--bg)', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button key={t.id} className={`siteayar-tab ${aktifTab === t.id ? 'siteayar-tab-ak' : ''}`} onClick={() => setAktifTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ─── ADMIN ─── */}
      {aktifTab === 'admin' && (
        <div className="g2">
          <div>
            <div className="k" style={{ marginBottom: 14 }}>
              <div className="kh"><div className="kt">Admin Bilgileri</div></div>
              <div className="kb">
                <div className="ff"><label>Ad Soyad</label><input defaultValue="Admin Kullanıcı" /></div>
                <div className="ff"><label>E-posta</label><input type="email" defaultValue="admin@autonax.com" /></div>
                <div className="ff"><label>Mevcut Şifre</label><input type="password" placeholder="••••••••" /></div>
                <div className="ff"><label>Yeni Şifre</label><input type="password" placeholder="••••••••" /></div>
                <button className="btn-p" onClick={() => showToast('Kaydedildi!', 'green')}>Kaydet</button>
              </div>
            </div>

            {/* Rol tanımları */}
            <div className="k">
              <div className="kh"><div className="kt">Rol Tanımları</div></div>
              <div className="kb">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
                  {Object.entries(ROL_TANIMLAR).map(([k, r]) => (
                    <div key={k} style={{ padding: '10px 12px', border: `1.5px solid ${r.renk}33`, borderRadius: 9, background: r.bg }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: r.renk }}>{r.etiket}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink4)', marginTop: 2 }}>{r.aciklama}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Personel listesi */}
          <div>
            <div className="k">
              <div className="kh">
                <div className="kt">👥 Personel & Yetkilendirme</div>
                <button className="btn-p" style={{ fontSize: 11, padding: '6px 12px' }} onClick={() => acModal()}>+ Ekle</button>
              </div>
              <div style={{ padding: 0 }}>
                <table className="tbl">
                  <thead><tr><th>Personel</th><th>Rol</th><th>Yetkiler</th><th>Durum</th><th></th></tr></thead>
                  <tbody>
                    {personelList.map((p, i) => {
                      const r = ROL_TANIMLAR[p.rol as keyof typeof ROL_TANIMLAR];
                      return (
                        <tr key={p.id}>
                          <td><div style={{ fontWeight: 700, fontSize: 13 }}>{p.ad}</div><div style={{ fontSize: 10, color: 'var(--ink4)' }}>{p.email}</div></td>
                          <td><span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: r?.bg, color: r?.renk }}>{r?.etiket}</span></td>
                          <td style={{ fontSize: 14 }}>
                            {YETKI_TANIMLAR.filter(y => p.yetkiler[y.key as keyof typeof p.yetkiler]).map(y => <span key={y.key} title={y.lbl}>{y.ikon}</span>)}
                          </td>
                          <td><span className={`tag ${p.aktif ? 'onay' : 'tamam'}`}>{p.aktif ? 'Aktif' : 'Pasif'}</span></td>
                          <td><button className="ab ab-n" onClick={() => acModal(i)}>Düzenle</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── GENEL ─── */}
      {aktifTab === 'genel' && (
        <div className="k">
          <div className="kh"><div className="kt">Genel Site Bilgileri</div></div>
          <div className="kb">
            <div className="form-grid">
              {[['Firma Adı', 'firmaAdi'], ['Slogan', 'slogan'], ['Telefon', 'telefon'], ['E-posta', 'email'], ['Adres', 'adres'], ['Çalışma Saatleri', 'calisma']].map(([l, k]) => (
                <div key={k} className="ff">
                  <label>{l}</label>
                  <input value={genel[k as keyof typeof genel]} onChange={e => setGenel(g => ({ ...g, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="sa-yayinla">
              <button className="btn-s" style={{ flex: 1 }}>Sıfırla</button>
              <button className="btn-p" style={{ flex: 2 }} onClick={() => showToast('Genel ayarlar kaydedildi!', 'green')}>Yayınla</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SEO ─── */}
      {aktifTab === 'seo' && (
        <div className="k">
          <div className="kh"><div className="kt">SEO Ayarları</div></div>
          <div className="kb">
            <div className="ff"><label>Sayfa Başlığı (Title)</label><input value={seo.title} onChange={e => setSeo(s => ({ ...s, title: e.target.value }))} /></div>
            <div className="ff"><label>Meta Açıklaması</label><textarea className="sa-textarea" value={seo.description} onChange={e => setSeo(s => ({ ...s, description: e.target.value }))} rows={3} /></div>
            <div className="ff"><label>Anahtar Kelimeler</label><input value={seo.keywords} onChange={e => setSeo(s => ({ ...s, keywords: e.target.value }))} placeholder="virgülle ayır" /></div>
            <button className="btn-p" onClick={() => showToast('SEO ayarları kaydedildi!', 'green')}>Kaydet</button>
          </div>
        </div>
      )}

      {/* ─── SOSYAL ─── */}
      {aktifTab === 'sosyal' && (
        <div className="k">
          <div className="kh"><div className="kt">Sosyal Medya</div></div>
          <div className="kb">
            {[['📸 Instagram', 'instagram', 'https://instagram.com/...'], ['👥 Facebook', 'facebook', 'https://facebook.com/...'], ['💬 WhatsApp', 'whatsapp', '905xxxxxxxxx'], ['▶️ YouTube', 'youtube', 'https://youtube.com/...']].map(([l, k, ph]) => (
              <div key={k} className="sa-sosyal-row">
                <span className="sa-sosyal-ikon">{l.split(' ')[0]}</span>
                <div style={{ flex: 1 }}>
                  <div className="sa-lbl">{l.split(' ').slice(1).join(' ')}</div>
                  <input className="sa-inp" placeholder={ph} value={sosyal[k as keyof typeof sosyal]} onChange={e => setSosyal(s => ({ ...s, [k]: e.target.value }))} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <button className="btn-p" onClick={() => showToast('Sosyal medya kaydedildi!', 'green')}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ÖDEME ─── */}
      {aktifTab === 'odeme' && (
        <div className="g2">
          <div className="k">
            <div className="kh"><div className="kt">İyzico Entegrasyonu</div></div>
            <div className="kb">
              <div className="ff"><label>API Key</label><input type="password" placeholder="sandbox-..." value={odemeAyar.iyzicoApiKey} onChange={e => setOdemeAyar(o => ({ ...o, iyzicoApiKey: e.target.value }))} /></div>
              <div className="ff"><label>Secret Key</label><input type="password" placeholder="sandbox-..." /></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                <span style={{ fontSize: 13 }}>Test Modu</span>
                <button className="tgl on" onClick={e => (e.target as HTMLElement).classList.toggle('on')} />
              </div>
            </div>
          </div>
          <div className="k">
            <div className="kh"><div className="kt">PayTR Entegrasyonu</div></div>
            <div className="kb">
              <div className="ff"><label>Merchant ID</label><input placeholder="000000" value={odemeAyar.paytrMerchantId} onChange={e => setOdemeAyar(o => ({ ...o, paytrMerchantId: e.target.value }))} /></div>
              <div className="ff"><label>Merchant Key</label><input type="password" placeholder="••••••••" /></div>
              <div className="ff"><label>Merchant Salt</label><input type="password" placeholder="••••••••" /></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                <span style={{ fontSize: 13 }}>Test Modu</span>
                <button className="tgl on" onClick={e => (e.target as HTMLElement).classList.toggle('on')} />
              </div>
            </div>
          </div>
          <div className="k" style={{ gridColumn: '1/-1' }}>
            <div className="kh"><div className="kt">Genel Ödeme Ayarları</div></div>
            <div className="kb">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--bg)' }}>
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Vade Farkı</div><div style={{ fontSize: 11, color: 'var(--ink4)' }}>Taksit vade farkını müşteri mi, firma mı karşılar?</div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink4)' }}>{odemeAyar.vadeKarsilayanFirma ? 'Firma' : 'Müşteri'}</span>
                  <button className={`tgl ${odemeAyar.vadeKarsilayanFirma ? 'on' : ''}`} onClick={() => setOdemeAyar(o => ({ ...o, vadeKarsilayanFirma: !o.vadeKarsilayanFirma }))} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Aktif Gateway</div></div>
                <select style={{ padding: '6px 12px', border: '1.5px solid var(--bd)', borderRadius: 8, fontSize: 12, outline: 'none' }} value={odemeAyar.aktifGateway} onChange={e => setOdemeAyar(o => ({ ...o, aktifGateway: e.target.value }))}>
                  <option value="none">Seçilmedi</option>
                  <option value="iyzico">İyzico</option>
                  <option value="paytr">PayTR</option>
                </select>
              </div>
              <button className="btn-p" onClick={() => showToast('Ödeme ayarları kaydedildi!', 'green')}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── FATURA ─── */}
      {aktifTab === 'fatura' && (
        <div>
          <div className="g2" style={{ marginBottom: 14 }}>
            <div className="k">
              <div className="kh">
                <div><div className="kt">e-Arşiv Fatura Şablonu</div><div style={{ fontSize: 10, color: 'var(--ink4)', marginTop: 2 }}>.xslt veya .xsl formatında</div></div>
              </div>
              <div className="kb">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, border: '2px dashed var(--bd)', borderRadius: 10, cursor: 'pointer', background: 'var(--bg)' }}>
                  <div style={{ fontSize: 28 }}>📤</div>
                  <div><div style={{ fontSize: 13, fontWeight: 700 }}>e-Arşiv Şablonu Yükle</div><div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 2 }}>.xslt dosyası seçin</div></div>
                  <input type="file" accept=".xslt,.xsl" style={{ display: 'none' }} onChange={() => showToast('Şablon yüklendi!', 'green')} />
                </label>
              </div>
            </div>
            <div className="k">
              <div className="kh">
                <div><div className="kt">e-Fatura Şablonu</div><div style={{ fontSize: 10, color: 'var(--ink4)', marginTop: 2 }}>.xslt veya .xsl formatında</div></div>
              </div>
              <div className="kb">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, border: '2px dashed var(--bd)', borderRadius: 10, cursor: 'pointer', background: 'var(--bg)' }}>
                  <div style={{ fontSize: 28 }}>📤</div>
                  <div><div style={{ fontSize: 13, fontWeight: 700 }}>e-Fatura Şablonu Yükle</div><div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 2 }}>.xslt dosyası seçin</div></div>
                  <input type="file" accept=".xslt,.xsl" style={{ display: 'none' }} onChange={() => showToast('Şablon yüklendi!', 'green')} />
                </label>
              </div>
            </div>
          </div>
          <div className="k">
            <div className="kh"><div className="kt">EDM Bilişim Entegrasyonu</div></div>
            <div className="kb">
              <div className="form-grid">
                <div className="ff"><label>Kullanıcı Adı</label><input value={edmAyar.kullaniciAdi} onChange={e => setEdmAyar(v => ({ ...v, kullaniciAdi: e.target.value }))} /></div>
                <div className="ff"><label>Şifre</label><input type="password" value={edmAyar.sifre} onChange={e => setEdmAyar(v => ({ ...v, sifre: e.target.value }))} /></div>
                <div className="ff"><label>VKN / TCKN</label><input value={edmAyar.vknTckn} onChange={e => setEdmAyar(v => ({ ...v, vknTckn: e.target.value }))} /></div>
                <div className="ff"><label>Fatura Tipi</label>
                  <select value={edmAyar.faturaTipi} onChange={e => setEdmAyar(v => ({ ...v, faturaTipi: e.target.value }))}>
                    <option value="EARSIV">e-Arşiv</option>
                    <option value="EFATURA">e-Fatura</option>
                  </select>
                </div>
                <div className="ff full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', border: 'none' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Entegrasyon Aktif</span>
                  <button className={`tgl ${edmAyar.aktif ? 'on' : ''}`} onClick={() => setEdmAyar(v => ({ ...v, aktif: !v.aktif }))} />
                </div>
              </div>
              <button className="btn-p" onClick={() => showToast('EDM ayarları kaydedildi!', 'green')}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* Personel Modal */}
      <Modal open={perModal} onClose={() => setPerModal(false)} title={duzenleIdx !== null ? 'PERSONEL DÜZENLE' : 'YENİ PERSONEL'} maxWidth={500}
        footer={<><button className="btn-s" style={{ flex: 1 }} onClick={() => setPerModal(false)}>İptal</button><button className="btn-p" style={{ flex: 2 }} onClick={personelKaydet}>KAYDET</button></>}
      >
        <div className="form-grid">
          <div className="ff full"><label>Ad Soyad *</label><input value={perForm.ad} onChange={e => setPerForm(f => ({ ...f, ad: e.target.value }))} /></div>
          <div className="ff"><label>E-posta</label><input type="email" value={perForm.email} onChange={e => setPerForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div className="ff"><label>Telefon</label><input value={perForm.tel} onChange={e => setPerForm(f => ({ ...f, tel: e.target.value }))} /></div>
          <div className="ff"><label>Şifre</label><input type="password" value={perForm.sifre || ''} onChange={e => setPerForm(f => ({ ...f, sifre: e.target.value }))} placeholder="••••••••" /></div>
          <div className="ff"><label>Rol</label>
            <select value={perForm.rol} onChange={e => { const r = e.target.value as Rol; const s = ROL_SABLON[r] || {}; setPerForm(f => ({ ...f, rol: r, yetkiler: { randevu: false, odeme: false, fatura: false, fiyat: false, rapor: false, bayi: false, ayarlar: false, personel: false, ...s } })); }}>
              {Object.entries(ROL_TANIMLAR).map(([k, r]) => <option key={k} value={k}>{r.etiket}</option>)}
            </select>
          </div>
        </div>
        {/* Hızlı rol şablonları */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {Object.entries(ROL_TANIMLAR).map(([k, r]) => (
            <button key={k} onClick={() => { const s = ROL_SABLON[k] || {}; setPerForm(f => ({ ...f, rol: k as Rol, yetkiler: { randevu: false, odeme: false, fatura: false, fiyat: false, rapor: false, bayi: false, ayarlar: false, personel: false, ...s } })); }} style={{ padding: '4px 10px', border: `1.5px solid ${r.renk}`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: r.bg, color: r.renk }}>{r.etiket}</button>
          ))}
        </div>
        {/* Yetkiler */}
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink4)', textTransform: 'uppercase', marginBottom: 6 }}>Yetkiler</div>
        <div style={{ border: '1.5px solid var(--bd)', borderRadius: 10, padding: '0 12px' }}>
          {YETKI_TANIMLAR.map(y => (
            <label key={y.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--bg)', cursor: 'pointer' }}>
              <input type="checkbox" checked={perForm.yetkiler[y.key as keyof typeof perForm.yetkiler]} onChange={e => setPerForm(f => ({ ...f, yetkiler: { ...f.yetkiler, [y.key]: e.target.checked } }))} style={{ width: 16, height: 16, accentColor: 'var(--r)' }} />
              <span style={{ fontSize: 18 }}>{y.ikon}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{y.lbl}</span>
            </label>
          ))}
        </div>
      </Modal>
    </>
  );
}
