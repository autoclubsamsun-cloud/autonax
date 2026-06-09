/**
 * ai-randevu.js - Fütüristik 3D / İnteraktif Randevu Oluşturucu
 * Mevcut randevu sistemine entegre çalışır.
 */

(function(){
  'use strict';

  // Secilen arac parcalari
  var secimler = {};
  
  // Fiyat/Hizmet katalogu (Basit oneri icin)
  var katalog = {
    'kaput': { isim: 'Kaput PPF Kaplama', fiyat: 8000 },
    'tavan': { isim: 'Tavan Cam Filmi / PPF', fiyat: 5000 },
    'on_tampon': { isim: 'Ön Tampon Koruma', fiyat: 4000 },
    'arka_tampon': { isim: 'Arka Tampon Koruma', fiyat: 4000 },
    'sol_kapi': { isim: 'Sol Kapı Çizik Giderme', fiyat: 3000 },
    'sag_kapi': { isim: 'Sağ Kapı Çizik Giderme', fiyat: 3000 },
    'bagaj': { isim: 'Bagaj PPF', fiyat: 4000 },
    'tum_arac': { isim: 'Komple Seramik / PPF', fiyat: 45000 }
  };

  /** Gercek 3D Arac (Model-Viewer) */
  function get3DModelHTML() {
    // Kutuphaneyi dinamik yukle
    if (!document.getElementById('model-viewer-script')) {
      var s = document.createElement('script');
      s.id = 'model-viewer-script';
      s.type = 'module';
      s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
      document.head.appendChild(s);
    }
    
    // Model-viewer HTML ciktisi
    // CDN'den acik kaynakli bir araba modeli cekilir (Ornek: bir konsept araba)
    // data-position x,y,z koordinatlaridir.
    return `
    <style>
      model-viewer {
        width: 100%;
        height: 100%;
        min-height: 500px;
        --poster-color: transparent;
      }
      .hotspot-btn {
        display: block;
        width: max-content;
        padding: 6px 12px;
        background: rgba(15, 23, 42, 0.8);
        border: 2px solid #4facfe;
        border-radius: 8px;
        color: #fff;
        font-family: Outfit, sans-serif;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 0 10px rgba(79, 172, 254, 0.5);
      }
      .hotspot-btn:hover {
        background: rgba(79, 172, 254, 0.5);
      }
      .hotspot-btn.active {
        background: rgba(220, 38, 38, 0.8);
        border-color: #ef4444;
        box-shadow: 0 0 15px rgba(239, 68, 68, 0.8);
      }
      /* Cizgi detayi (Gorsel) */
      .hotspot-btn::before {
        content: '';
        display: block;
        position: absolute;
        top: 50%; left: 50%;
        width: 4px; height: 4px;
        background: #fff;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        opacity: 0;
      }
    </style>
    <model-viewer 
      src="https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/models/gltf/ferrari.glb" 
      camera-controls 
      auto-rotate 
      rotation-per-second="10deg"
      environment-image="neutral" 
      exposure="0.8" 
      shadow-intensity="1">
      
      <!-- Hotspotlar (Uzamsal Noktalar) -->
      <!-- Ferrari modelinde genel koordinatlar tahminidir -->
      <button slot="hotspot-kaput" class="hotspot-btn" data-position="0 0.6 1.2" data-normal="0 1 0.2" id="part-kaput" onclick="aiParcaSec('kaput')">Kaput</button>
      <button slot="hotspot-tavan" class="hotspot-btn" data-position="0 1.1 0" data-normal="0 1 0" id="part-tavan" onclick="aiParcaSec('tavan')">Tavan</button>
      <button slot="hotspot-bagaj" class="hotspot-btn" data-position="0 0.8 -1.5" data-normal="0 1 -0.2" id="part-bagaj" onclick="aiParcaSec('bagaj')">Bagaj</button>
      
      <button slot="hotspot-solkapi" class="hotspot-btn" data-position="0.9 0.5 0" data-normal="1 0 0" id="part-sol_kapi" onclick="aiParcaSec('sol_kapi')">Sol Kapı</button>
      <button slot="hotspot-sagkapi" class="hotspot-btn" data-position="-0.9 0.5 0" data-normal="-1 0 0" id="part-sag_kapi" onclick="aiParcaSec('sag_kapi')">Sağ Kapı</button>
      
      <button slot="hotspot-ontampon" class="hotspot-btn" data-position="0 0.3 2.1" data-normal="0 0 1" id="part-on_tampon" onclick="aiParcaSec('on_tampon')">Ön Tampon</button>
      <button slot="hotspot-arkatampon" class="hotspot-btn" data-position="0 0.4 -2.1" data-normal="0 0 -1" id="part-arka_tampon" onclick="aiParcaSec('arka_tampon')">Arka Tampon</button>
      
    </model-viewer>
    `;
  }

  window.aiParcaSec = function(parcaId) {
    var el = document.getElementById('part-' + parcaId);
    if (!el) return;
    
    if (secimler[parcaId]) {
      delete secimler[parcaId];
      el.classList.remove('active');
    } else {
      secimler[parcaId] = true;
      el.classList.add('active');
    }
    
    aiSepetiGuncelle();
  };

  function aiSepetiGuncelle() {
    var sepetEl = document.getElementById('ai-sepet');
    var liste = Object.keys(secimler);
    
    if (liste.length === 0) {
      sepetEl.innerHTML = '<div style="color:var(--ink4);font-size:13px;text-align:center;padding:20px 0;">Araç şemasından işlem yapılacak bölgeleri seçin.</div>';
      return;
    }
    
    var html = '';
    var toplam = 0;
    var hizmetİsimleri = [];
    
    liste.forEach(function(k) {
      var item = katalog[k];
      toplam += item.fiyat;
      hizmetİsimleri.push(item.isim);
      html += '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.1);font-size:13px;color:#fff;">';
      html += '<span>' + item.isim + '</span>';
      html += '<span style="color:#00f2fe;font-weight:bold;">₺' + item.fiyat.toLocaleString() + '</span>';
      html += '</div>';
    });
    
    html += '<div style="display:flex;justify-content:space-between;padding:15px 0;margin-top:10px;font-size:18px;color:#fff;font-weight:bold;">';
    html += '<span>TOPLAM</span>';
    html += '<span style="color:#ef4444;">₺' + toplam.toLocaleString() + '</span>';
    html += '</div>';
    
    sepetEl.innerHTML = html;
    
    // Gizli inputlara yaz (kaydetmek icin)
    var btn = document.getElementById('ai-kaydet-btn');
    if (btn) {
      btn.setAttribute('data-hizmet', hizmetİsimleri.join(' + '));
      btn.setAttribute('data-fiyat', toplam);
    }
  }

  function aiRandevuAc() {
    secimler = {};
    
    var ovl = document.createElement('div');
    ovl.id = 'ai-rdv-ovl';
    ovl.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(2,6,23,0.95);display:flex;padding:20px;font-family:Outfit,sans-serif;backdrop-filter:blur(10px);color:#fff;flex-direction:column;';
    
    var html = `
    <!-- Ust Bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.1);flex-shrink:0;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:2px;color:#00f2fe;display:flex;align-items:center;gap:10px;">
        <span style="font-size:32px;">🤖</span> AI RANDEVU MERKEZİ
      </div>
      <button onclick="document.getElementById('ai-rdv-ovl').remove()" style="background:transparent;border:none;color:#fff;font-size:30px;cursor:pointer;opacity:0.6;transition:0.3s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">&times;</button>
    </div>
    
    <!-- İcerik -->
    <div style="display:flex;flex:1;gap:20px;margin-top:20px;overflow:hidden;">
      
      <!-- Sol: Musteri Bilgileri -->
      <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:16px;overflow-y:auto;">
        <h3 style="margin:0 0 10px 0;font-size:16px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Müşteri Protokolü</h3>
        
        <div>
          <label style="display:block;font-size:11px;color:#64748b;margin-bottom:6px;text-transform:uppercase;">Müşteri Adı</label>
          <input type="text" id="ai-musteri" placeholder="İsim soyisim arayın..." style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);padding:12px;border-radius:10px;color:#fff;outline:none;font-size:14px;box-sizing:border-box;">
        </div>
        
        <div style="display:flex;gap:10px;">
          <div style="flex:1;">
            <label style="display:block;font-size:11px;color:#64748b;margin-bottom:6px;text-transform:uppercase;">Telefon</label>
            <input type="text" id="ai-tel" placeholder="05XX..." style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);padding:12px;border-radius:10px;color:#fff;outline:none;font-size:14px;box-sizing:border-box;">
          </div>
          <div style="flex:1;">
            <label style="display:block;font-size:11px;color:#64748b;margin-bottom:6px;text-transform:uppercase;">Plaka</label>
            <input type="text" id="ai-plaka" placeholder="34 ABC 123" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);padding:12px;border-radius:10px;color:#fff;outline:none;font-size:14px;box-sizing:border-box;text-transform:uppercase;">
          </div>
        </div>
        
        <div>
          <label style="display:block;font-size:11px;color:#64748b;margin-bottom:6px;text-transform:uppercase;">Araç Modeli</label>
          <input type="text" id="ai-arac" placeholder="Örn: BMW 520i" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);padding:12px;border-radius:10px;color:#fff;outline:none;font-size:14px;box-sizing:border-box;">
        </div>

        <div style="margin-top:20px;padding:16px;background:rgba(79, 172, 254, 0.1);border-left:3px solid #00f2fe;border-radius:0 10px 10px 0;">
          <div style="font-size:12px;color:#00f2fe;font-weight:bold;margin-bottom:6px;">🤖 AI RADAR</div>
          <div style="font-size:13px;color:#cbd5e1;line-height:1.5;">Müşteri seçildiğinde aracın geçmişi analiz edilip buraya tavsiyeler düşecektir.</div>
        </div>
      </div>
      
      <!-- Orta: 3D Hologram Arac -->
      <div style="flex:2;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;">
        <div style="position:absolute;top:0;font-family:'Bebas Neue',sans-serif;font-size:20px;color:#4facfe;letter-spacing:1px;text-align:center;">İNTERAKTİF ARAÇ TARAMASI<br><span style="font-family:Outfit,sans-serif;font-size:12px;color:#64748b;letter-spacing:0;">İşlem yapılacak bölgelere tıklayın</span></div>
        <div style="width:100%;max-width:500px;height:100%;display:flex;align-items:center;justify-content:center;">
          ${get3DModelHTML()}
        </div>
      </div>
      
      <!-- Sag: Ozet ve Onay -->
      <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:20px;padding:24px;display:flex;flex-direction:column;">
        <h3 style="margin:0 0 20px 0;font-size:16px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Hizmet Protokolü</h3>
        
        <div id="ai-sepet" style="flex:1;overflow-y:auto;">
          <div style="color:var(--ink4);font-size:13px;text-align:center;padding:20px 0;">Araç şemasından işlem yapılacak bölgeleri seçin.</div>
        </div>
        
        <div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);">
          <div style="display:flex;gap:10px;margin-bottom:20px;">
            <div style="flex:1;">
              <label style="display:block;font-size:11px;color:#64748b;margin-bottom:6px;">Tarih</label>
              <input type="date" id="ai-tarih" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);padding:10px;border-radius:8px;color:#fff;outline:none;font-size:13px;box-sizing:border-box;">
            </div>
            <div style="flex:1;">
              <label style="display:block;font-size:11px;color:#64748b;margin-bottom:6px;">Saat</label>
              <select id="ai-saat" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);padding:10px;border-radius:8px;color:#fff;outline:none;font-size:13px;box-sizing:border-box;">
                <option value="09:00">09:00</option>
                <option value="10:00">10:00</option>
                <option value="11:00">11:00</option>
                <option value="13:00">13:00</option>
                <option value="14:00">14:00</option>
                <option value="15:00">15:00</option>
              </select>
            </div>
          </div>
          
          <button id="ai-kaydet-btn" onclick="aiRandevuSistemeYaz()" style="width:100%;padding:16px;background:linear-gradient(90deg, #ef4444, #dc2626);color:#fff;border:none;border-radius:12px;font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;cursor:pointer;box-shadow:0 10px 20px rgba(239, 68, 68, 0.3);transition:0.3s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 15px 25px rgba(239, 68, 68, 0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 10px 20px rgba(239, 68, 68, 0.3)'">
            SİSTEME AKTAR
          </button>
        </div>
      </div>
      
    </div>
    `;
    
    ovl.innerHTML = html;
    document.body.appendChild(ovl);
    
    // Tarihi bugune ayarla
    document.getElementById('ai-tarih').value = new Date().toISOString().split('T')[0];
    
    // Akilli oneri sistemi baglantisi (varsa)
    setTimeout(function() {
      var inp = document.getElementById('ai-musteri');
      if (inp && typeof window.musteriDBKaydet !== 'undefined' && typeof window._m360Cache !== 'undefined') {
        // Mevcut autocomplete mantigi eklenebilir veya basit tutulabilir.
      }
    }, 500);
  }

  window.aiRandevuAc = aiRandevuAc;

  /** AI verilerini ana sisteme yaz ve kaydet */
  window.aiRandevuSistemeYaz = function() {
    var btn = document.getElementById('ai-kaydet-btn');
    var hizmet = btn.getAttribute('data-hizmet') || '';
    var fiyat = btn.getAttribute('data-fiyat') || '0';
    
    if (!hizmet) {
      if (typeof toast === 'function') toast('Lütfen araç üzerinden en az bir işlem seçin.', 'red');
      else alert('Lütfen araç üzerinden işlem seçin.');
      return;
    }
    
    var dMusteri = document.getElementById('ai-musteri').value;
    var dTel = document.getElementById('ai-tel').value;
    var dPlaka = document.getElementById('ai-plaka').value;
    var dArac = document.getElementById('ai-arac').value;
    var dTarih = document.getElementById('ai-tarih').value;
    var dSaat = document.getElementById('ai-saat').value;
    
    if (!dMusteri || !dPlaka) {
      if (typeof toast === 'function') toast('Müşteri adı ve plaka zorunludur.', 'red');
      return;
    }
    
    // Sayfayi "randevular" sekmesine gecir (ana sistem formu orada)
    if (typeof doPg === 'function') {
      doPg('randevular');
    }
    
    // Modali kapat
    document.getElementById('ai-rdv-ovl').remove();
    
    // DOM'un hazir olmasi icin kisa bekle ve ana formu doldur
    setTimeout(function() {
      var fMusteri = document.getElementById('rdv-musteri');
      var fTel = document.getElementById('rdv-tel');
      var fPlaka = document.getElementById('rdv-plaka');
      var fArac = document.getElementById('rdv-arac');
      var fTarih = document.getElementById('rdv-tarih');
      var fSaat = document.getElementById('rdv-saat');
      
      // Standart form inputlarini doldur
      if (fMusteri) fMusteri.value = dMusteri;
      if (fTel) fTel.value = dTel;
      if (fPlaka) fPlaka.value = dPlaka;
      if (fArac) fArac.value = dArac;
      if (fTarih) fTarih.value = dTarih;
      if (fSaat) fSaat.value = dSaat;
      
      // Hizmet kismini manuel inputa yazip tetikle
      var fHizmetOto = document.getElementById('rdv-hizmet-arama');
      var fHizmetMan = document.getElementById('rdv-hizmet-manuel-isim');
      var fFiyatMan = document.getElementById('rdv-hizmet-manuel-fiyat');
      
      if (fHizmetMan && fFiyatMan) {
        // Yoksa manuel alanini ac
        var rndYok = document.getElementById('rdv-hizmet-yok');
        if (rndYok) rndYok.style.display = 'block';
        
        fHizmetMan.value = "AI: " + hizmet;
        fFiyatMan.value = fiyat;
        
        // Manuel secim fonksiyonunu tetikle (pnl_atn icindeki hizmetManuelSec)
        if (typeof hizmetManuelSec === 'function') {
          hizmetManuelSec();
        }
      }
      
      if (typeof toast === 'function') toast('AI Verileri sisteme aktarıldı. "Randevu Ekle" diyebilirsiniz.', 'blue');
      
      // Opsiyonel: Direkt rdvEkle() cagrilabilir ama kullanicinin son gormesi daha iyi
      // if (typeof rdvEkle === 'function') setTimeout(rdvEkle, 500);
      
    }, 400);
  };

})();
