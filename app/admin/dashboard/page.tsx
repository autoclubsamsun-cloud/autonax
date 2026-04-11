'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/hooks/useStore';
import { formatTL, bugunTarih } from '@/lib/utils/format';
import StatCard from '@/components/ui/StatCard';
import Link from 'next/link';

export default function DashboardPage() {
  const { randevular, loaded } = useStore();

  const stats = useMemo(() => {
    const bugun = bugunTarih();
    const bugunRdv = randevular.filter(r => r.tarih === bugun);
    const bekleyenOnay = randevular.filter(r => r.durum === 'bekl');
    const toplamGelir = randevular.filter(r => r.odendi).reduce((s, r) => s + r.tutar, 0);
    const tamamlanan = randevular.filter(r => r.islem);
    return { bugunRdv, bekleyenOnay, toplamGelir, tamamlanan };
  }, [randevular]);

  const bugunRdv = randevular.filter(r => r.tarih === bugunTarih());

  const sonHizmetler = randevular.filter(r => r.islem).slice(0, 5);

  if (!loaded) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink4)' }}>Yükleniyor...</div>;

  return (
    <>
      <div className="ph">
        <div className="ph-ey">Admin Panel</div>
        <div className="ph-title">Dashboard</div>
        <div className="ph-sub" id="ph-tarih">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      {/* Stat kartları */}
      <div className="g4">
        <StatCard
          label="Bugünkü Randevu"
          value={String(stats.bugunRdv.length)}
          trend="Dünden +1"
          trendUp={true}
          color="red"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
        />
        <StatCard
          label="Bu Hafta Gelir"
          value={formatTL(stats.toplamGelir)}
          trend="Geçen haftadan +%18"
          trendUp={true}
          color="green"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        />
        <StatCard
          label="Toplam Tamamlanan"
          value={String(stats.tamamlanan.length)}
          trend="Bu ay +6"
          trendUp={true}
          color="blue"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
        />
        <StatCard
          label="Bekleyen Onay"
          value={String(stats.bekleyenOnay.length)}
          trend="Acil onay gerekiyor"
          trendUp={false}
          color="amber"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
      </div>

      <div className="g21">
        {/* Bugünkü Randevular */}
        <div className="k">
          <div className="kh">
            <div className="kt">Bugünkü Randevular</div>
            <Link href="/admin/randevular" className="km">Tümü →</Link>
          </div>
          <div className="kb">
            {bugunRdv.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--ink4)', fontSize: 13 }}>
                Bugün için randevu yok
              </div>
            ) : bugunRdv.map(r => (
              <div key={r.id} className="cal-rdv-item">
                <div className="cal-rdv-time">{r.saat}</div>
                <div className="cal-rdv-body">
                  <div className="cal-rdv-isim">{r.musteri} — {r.hizmet.slice(0, 30)}</div>
                  <div className="cal-rdv-plaka">{r.plaka} · {r.arac} · {formatTL(r.tutar)}</div>
                </div>
                <span className={`tag ${r.durum === 'onay' ? 'onay' : 'bekl'}`}>
                  {r.durum === 'onay' ? 'Onaylı' : 'Bekliyor'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* En Çok Tercih */}
        <div className="k">
          <div className="kh"><div className="kt">En Çok Tercih</div></div>
          <div className="kb">
            <div className="chart-bar-wrap">
              {[
                { label: 'N8', val: 85, text: '₺70K × 12' },
                { label: 'N7', val: 65, text: '₺65K × 9' },
                { label: 'S75', val: 48, text: '₺55K × 7' },
                { label: 'CS190', val: 35, text: '₺45K × 5' },
                { label: 'Seramik', val: 28, text: '₺18K × 4' },
              ].map(item => (
                <div key={item.label} className="chart-bar-row">
                  <div className="chart-bar-label">{item.label}</div>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill" style={{ width: `${item.val}%` }} />
                  </div>
                  <div className="chart-bar-val">{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Son Hizmetler */}
      <div className="k">
        <div className="kh">
          <div className="kt">Son Hizmetler</div>
          <Link href="/admin/hizmetler" className="km">Tümü →</Link>
        </div>
        <div className="kb" style={{ padding: 0 }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Müşteri</th><th>Araç</th><th>Hizmet</th><th>Tarih</th><th>Tutar</th><th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {sonHizmetler.map(r => (
                  <tr key={r.id}>
                    <td><b>{r.musteri}</b></td>
                    <td><span className="tbl-plaka">{r.plaka}</span><br /><small>{r.arac}</small></td>
                    <td>{r.hizmet.slice(0, 25)}</td>
                    <td>{r.tarih}</td>
                    <td className="tbl-fiyat">{formatTL(r.tutar)}</td>
                    <td><span className={`tag ${r.odendi ? 'onay' : 'bekl'}`}>{r.odendi ? 'Ödendi' : 'Bekliyor'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
