/**
 * Autonax DB Sync — panel.html ve hesabim.html için
 * localStorage → Neon Postgres API köprüsü
 * Bu dosyayı panel.html ve hesabim.html'e <script src="/standalone/db-sync.js"></script> ile ekleyin
 */

const AUTONAX_API = '/api';

// ─── API YARDIMCILARI ─────────────────────────────────────────────────────
async function apiGet(path, params = {}) {
  const url = new URL(AUTONAX_API + path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v));
  const r = await fetch(url);
  const d = await r.json();
  return d.data;
}

async function apiPost(path, body) {
  const r = await fetch(AUTONAX_API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function apiPut(path, body) {
  const r = await fetch(AUTONAX_API + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function apiDelete(path, id) {
  const r = await fetch(`${AUTONAX_API}${path}?id=${id}`, { method: 'DELETE' });
  return r.json();
}

// ─── RANDEVU FONKSİYONLARI ───────────────────────────────────────────────
window.DB = {
  // Tüm randevuları çek — localStorage'a da yaz (offline fallback)
  async getRandevular(params = {}) {
    try {
      const data = await apiGet('/randevular', params);
      if (data) {
        RANDEVULAR = data;
        storageKaydet();
      }
      return data;
    } catch (e) {
      console.warn('DB offline, localStorage kullanılıyor', e);
      return RANDEVULAR;
    }
  },

  // Randevu ekle
  async randevuEkle(randevu) {
    try {
      const res = await apiPost('/randevular', randevu);
      if (res.success) {
        RANDEVULAR.push(res.data);
        storageKaydet();
        return res.data;
      }
    } catch (e) {
      RANDEVULAR.push(randevu);
      storageKaydet();
      return randevu;
    }
  },

  // Randevu güncelle
  async randevuGuncelle(randevu) {
    try {
      const res = await apiPut('/randevular', randevu);
      if (res.success) {
        const idx = RANDEVULAR.findIndex(r => r.id === randevu.id);
        if (idx > -1) RANDEVULAR[idx] = randevu;
        storageKaydet();
      }
    } catch (e) {
      const idx = RANDEVULAR.findIndex(r => r.id === randevu.id);
      if (idx > -1) RANDEVULAR[idx] = randevu;
      storageKaydet();
    }
  },

  // Randevu sil
  async randevuSil(id) {
    try {
      await apiDelete('/randevular', id);
      RANDEVULAR = RANDEVULAR.filter(r => r.id !== id);
      storageKaydet();
    } catch (e) {
      RANDEVULAR = RANDEVULAR.filter(r => r.id !== id);
      storageKaydet();
    }
  },

  // Tüm local değişiklikleri DB'ye yükle (import sonrası)
  async syncToDB() {
    let ok = 0, err = 0;
    for (const rdv of RANDEVULAR) {
      try {
        await apiPost('/randevular', rdv);
        ok++;
      } catch (e) { err++; }
    }
    toast(`✅ ${ok} randevu DB'ye senkronize edildi${err?' ('+err+' hata)':''}`, ok > 0 ? 'green' : 'red');
  }
};

// ─── OTOMATİK YÜKLEME ─────────────────────────────────────────────────────
// Sayfa yüklendiğinde DB'den verileri çek
document.addEventListener('DOMContentLoaded', function() {
  // Login kontrol — admin giriş yapmışsa verileri çek
  var checkLogin = setInterval(function() {
    var loginOvl = document.getElementById('login-ovl');
    if (loginOvl && loginOvl.style.display === 'none') {
      clearInterval(checkLogin);
      window.DB.getRandevular().then(function(data) {
        if (data && data.length >= 0) {
          console.log('DB\'den', data.length, 'randevu yüklendi');
          // Dashboard ve aktif sayfayı yenile
          if (typeof doInit === 'function') doInit();
        }
      });
    }
  }, 500);
});
