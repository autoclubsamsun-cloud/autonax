/**
 * fatura.js - Autonax Fatura Yonetim Modulu
 * pnl_atn.html'den ayristirilmis bagimsiz modul
 *
 * Bagimliliklar (pnl_atn.html'de tanimli):
 *   EDM_AYAR, toast(), RANDEVULAR, URUNLER, IS, LS, LB, PAD0
 *   storageKaydet(), storageYukle(), dbRandevuKaydet()
 *   edmFaturaSeri(), edmKaydet(), CURRENT_USER
 */
/* global EDM_AYAR, toast, RANDEVULAR, URUNLER, IS, LS, LB, PAD0 */
/* global storageKaydet, storageYukle, dbRandevuKaydet, edmFaturaSeri, edmKaydet */
/* global saFaturaListenerBagla, edmTbodyHTML, CURRENT_USER, _escapeHtml */

/* ══ FATURA YÖNETİMİ ══ */
var FATURALAR=[];
try{FATURALAR=JSON.parse(localStorage.getItem('autonax_faturalar')||'[]');}catch(e){console.error('Autonax fatura yükleme:',e)}

/** localStorage'dan FATURALAR'ı yeniden yükle - sayfa yenilendiğinde veya dış değişiklik durumunda */
function faturaStorageYukle(){
  try{
    var raw=localStorage.getItem('autonax_faturalar');
    if(raw){
      var parsed=JSON.parse(raw);
      if(Array.isArray(parsed)) FATURALAR=parsed;
    }
  }catch(e){console.error('Autonax fatura storage yükleme:',e);}
}

function faturaKaydet(){
  try{
    localStorage.setItem('autonax_faturalar',JSON.stringify(FATURALAR));
  }catch(e){
    console.error('Autonax fatura kaydetme:',e);
    toast('⚠️ Fatura kaydedilemedi: '+e.message,'red');
  }
}

function faturaSayfasiYukle(){
  faturaStorageYukle(); // Her sayfa yüklemesinde storage'dan tazele
  faturaKPIGuncelle();
  faturaListeYukle();
}

function faturaKPIGuncelle(){
  var el=document.getElementById('fatura-kpiler');if(!el)return;
  var top=0,kdvTop=0,kes=0,gon=0,ipt=0,hata=0,bekl=0;
  FATURALAR.forEach(function(f){
    top+=f.toplamTutar||0; kdvTop+=f.kdvTutar||0;
    if(f.durum==='KESILDI')bekl++;
    if(f.durum==='GONDERILDI'||f.durum==='ONAYLANDI')gon++;
    if(f.durum==='IPTAL')ipt++;
    if(f.durum==='HATA')hata++;
  });
  kes=gon+bekl+hata;
  el.innerHTML='<div class="sk"><div class="sk-val">'+FATURALAR.length+'</div><div class="sk-lbl">Toplam</div></div>'
    +'<div class="sk"><div class="sk-val" style="color:#16a34a">₺'+top.toLocaleString('tr-TR')+'</div><div class="sk-lbl">Toplam Tutar</div></div>'
    +'<div class="sk"><div class="sk-val" style="color:#d97706">₺'+kdvTop.toLocaleString('tr-TR')+'</div><div class="sk-lbl">Toplam KDV</div></div>'
    +'<div class="sk"><div class="sk-val" style="color:#16a34a">'+gon+'</div><div class="sk-lbl">Gönderildi</div></div>'
    +(hata?'<div class="sk"><div class="sk-val" style="color:#dc2626">'+hata+'</div><div class="sk-lbl">Hatalı</div></div>':'')
    +(ipt?'<div class="sk"><div class="sk-val" style="color:#991b1b">'+ipt+'</div><div class="sk-lbl">İptal</div></div>':'');
}

function faturaListeYukle(){
  var tbody=document.getElementById('fat-tbody');if(!tbody)return;
  var arama=((document.getElementById('fat-arama')||{}).value||'').toLowerCase().trim();
  var tip=(document.getElementById('fat-tip')||{}).value||'';
  var durum=(document.getElementById('fat-durum')||{}).value||'';
  var tarihBas=(document.getElementById('fat-tarih-bas')||{}).value||'';
  var tarihBit=(document.getElementById('fat-tarih-bit')||{}).value||'';
  var liste=FATURALAR.filter(function(f){
    if(arama&&(f.musteri||'').toLowerCase().indexOf(arama)<0)return false;
    if(tip&&f.faturaTipi!==tip)return false;
    if(durum&&f.durum!==durum)return false;
    if(tarihBas&&f.tarih&&f.tarih<tarihBas)return false;
    if(tarihBit&&f.tarih&&f.tarih>tarihBit)return false;
    return true;
  });
  if(!liste.length){tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:20px;color:#999">Fatura bulunamadı</td></tr>';return;}
  tbody.innerHTML=liste.map(function(f){
    // BUG FIX: filtre sonrasi gercek index
    var i=FATURALAR.indexOf(f);
    var tipRenk=f.faturaTipi==='EFATURA'?'#2563EB':'#16a34a';

    // Durumlar: KESILDI (yerel), KESILIYOR (gönderim anında), GONDERILDI, HATA, IPTAL
    var durRenk='#999', durEtiket=f.durum||'—', durBg='rgba(153,153,153,.1)';
    if(f.durum==='KESILIYOR'){durRenk='#d97706';durBg='rgba(217,119,6,.12)';durEtiket='⏳ GÖNDERİLİYOR';}
    else if(f.durum==='GONDERILDI'){
      durRenk=f.edmTestMod?'#2563EB':'#16a34a';
      durBg=f.edmTestMod?'rgba(37,99,235,.1)':'rgba(22,163,74,.1)';
      durEtiket=f.edmTestMod?'🧪 TEST GÖNDERİLDİ':'✅ GÖNDERİLDİ';
    }
    else if(f.durum==='ONAYLANDI'){durRenk='#16a34a';durBg='rgba(22,163,74,.15)';durEtiket='✓ ONAYLANDI';}
    else if(f.durum==='HATA'){durRenk='#dc2626';durBg='rgba(220,38,38,.1)';durEtiket='⚠️ HATA';}
    else if(f.durum==='IPTAL'){durRenk='#991b1b';durBg='rgba(153,27,27,.1)';durEtiket='✕ İPTAL';}
    else if(f.durum==='KESILDI'){durRenk='#d97706';durBg='rgba(217,119,6,.1)';durEtiket='📝 BEKLİYOR';}

    var edmInfo='';
    if(f.edmEttn) edmInfo+='<br><small style="font-size:9px;color:var(--ink4);font-family:monospace" title="EDM\'den dönen ETTN">'+f.edmEttn+'</small>';
    if(f.edmMesaj && f.durum==='HATA') edmInfo+='<br><small style="font-size:9px;color:#dc2626" title="'+f.edmMesaj+'">'+(f.edmMesaj.length>40?f.edmMesaj.slice(0,40)+'...':f.edmMesaj)+'</small>';

    var musteriEtiketi=f.musteriTip==='kurumsal'?'🏢':'👤';

    // Gönderilebilir durumda mı? (KESILDI veya HATA)
    var gonderilebilir = (f.durum==='KESILDI' || f.durum==='HATA');
    var checkboxHtml = gonderilebilir
      ? '<input type="checkbox" class="fat-secim" data-fno="'+f.faturaNo+'" onchange="faturaSecimDegisti()" style="cursor:pointer">'
      : '<span style="color:#d1d5db;font-size:11px">—</span>';

    return '<tr>'
      +'<td style="text-align:center">'+checkboxHtml+'</td>'
      +'<td style="font-weight:700;font-size:11px">'+f.faturaNo+'</td>'
      +'<td>'+f.tarih+'</td>'
      +'<td>'+musteriEtiketi+' <b>'+f.musteri+'</b>'+(f.vknTckn?'<br><small style="color:var(--ink4);font-family:monospace">'+f.vknTckn+'</small>':'')+'</td>'
      +'<td><span style="font-size:10px;background:'+tipRenk+'15;color:'+tipRenk+';padding:2px 8px;border-radius:10px;font-weight:600">'+f.faturaTipi+'</span></td>'
      +'<td class="tbl-fiyat">₺'+(f.kdvsizTutar||0).toLocaleString('tr-TR')+'</td>'
      +'<td style="color:#d97706;font-weight:600">₺'+(f.kdvTutar||0).toLocaleString('tr-TR')+'</td>'
      +'<td class="tbl-fiyat" style="font-weight:700">₺'+(f.toplamTutar||0).toLocaleString('tr-TR')+'</td>'
      +'<td><span style="font-size:10px;background:'+durBg+';color:'+durRenk+';padding:3px 8px;border-radius:10px;font-weight:700">'+durEtiket+'</span>'+edmInfo+'</td>'
      +'<td style="display:flex;gap:4px;flex-wrap:wrap">'
        +'<button class="ab ab-n" style="font-size:10px" onclick="faturaDetayGoster('+i+')">\ud83d\udccb Detay</button>'
        +'<button class="ab ab-n" style="font-size:10px" onclick="faturaOnizlemeGoster('+i+')">\ud83d\udc41 \u00d6nizle</button>'
        +(gonderilebilir?'<button class="ab ab-n" style="font-size:10px;border-color:#1a6b3c;color:#1a6b3c;background:rgba(26,107,60,.06)" onclick="faturaEDMGonder('+i+')">\ud83d\udce4 G\u00f6nder</button>':'')
        +(f.durum==='KESILDI'?'<button class="ab ab-n" style="font-size:10px" onclick="faturaDuzenle('+i+')">\u270e D\u00fczenle</button>':'')
        +(f.edmUUID&&(f.durum==='GONDERILDI'||f.durum==='KESILIYOR')?'<button class="ab ab-n" style="font-size:10px;border-color:#2563EB;color:#2563EB" onclick="faturaDurumSorgula('+i+')">\ud83d\udd04 Durum</button>':'')
        +(f.durum==='GONDERILDI'||f.durum==='ONAYLANDI'||f.durum==='KESILDI'?'<button class="ab ab-r" style="font-size:10px" onclick="faturaIptal('+i+')">\u2715 \u0130ptal</button>':'')
        +(f.durum==='HATA'?'<button class="ab ab-n" style="font-size:10px;border-color:#d97706;color:#d97706" onclick="faturaYenidenGonder('+i+')">\u21bb Tekrar</button>':'')
      +'</td></tr>';
  }).join('');

  // ═══ SPRINT 10.2 - Fatura mobil kart listesi ═══
  faturaMobilKartlariRender(liste);
  // Seçim durumunu sıfırla
  faturaSecimDegisti();
}

/** Fatura mobil kart listesi render */
function faturaMobilKartlariRender(liste){
  var el=document.getElementById('fat-mobile-kartlar');
  if(!el) return;
  if(!liste||!liste.length){
    el.innerHTML='<div class="mcard-bos"><div class="mcard-bos-ikon">🧾</div><div class="mcard-bos-text">Fatura bulunamadı</div></div>';
    return;
  }
  el.innerHTML=liste.map(function(f){
    var i=FATURALAR.indexOf(f);

    // Durum
    var durEtiket=f.durum||'—', durClass='bekl';
    if(f.durum==='KESILIYOR'){durEtiket='⏳ Gönderiliyor';durClass='bekl';}
    else if(f.durum==='GONDERILDI'){durEtiket=f.edmTestMod?'🧪 TEST':'✅ Gönderildi';durClass=f.edmTestMod?'online':'onay';}
    else if(f.durum==='ONAYLANDI'){durEtiket='✓ Onaylandı';durClass='tamam';}
    else if(f.durum==='HATA'){durEtiket='⚠️ Hata';durClass='iptal';}
    else if(f.durum==='IPTAL'){durEtiket='✕ İptal';durClass='iptal';}
    else if(f.durum==='KESILDI'){durEtiket='Kesildi';durClass='bekl';}

    var tipRenk=f.faturaTipi==='EFATURA'?'#2563EB':'#16a34a';
    var tipEtiket=f.faturaTipi==='EFATURA'?'e-Fatura':'e-Arşiv';
    var musteriEtiketi=f.musteriTip==='kurumsal'?'🏢':'👤';

    // Aksiyonlar
    var gonderilebilir = (f.durum==='KESILDI' || f.durum==='HATA');
    var aksiyonlar='<button class="mcard-btn info" onclick="event.stopPropagation();faturaOnizlemeGoster('+i+')">👁 Önizle</button>';
    if(gonderilebilir){
      aksiyonlar+='<button class="mcard-btn" style="border-color:#1a6b3c;color:#1a6b3c;background:rgba(26,107,60,.06)" onclick="event.stopPropagation();faturaEDMGonder('+i+')">📤 EDM\'e Gönder</button>';
    }
    if(f.durum==='KESILDI'){
      aksiyonlar+='<button class="mcard-btn" onclick="event.stopPropagation();faturaDuzenle('+i+')">✎ Düzenle</button>';
    }
    if(f.durum==='GONDERILDI' || f.durum==='ONAYLANDI'){
      aksiyonlar+='<button class="mcard-btn" style="border-color:var(--r);color:var(--r)" onclick="event.stopPropagation();faturaIptal('+i+')">✕ İptal</button>';
    }

    return '<div class="mcard" onclick="faturaOnizlemeGoster('+i+')">'
      +'<div class="mcard-top">'
        +'<span style="font-family:monospace;font-size:12px;font-weight:700;color:var(--ink)">'+f.faturaNo+'</span>'
        +'<span class="mcard-tag '+durClass+'">'+durEtiket+'</span>'
      +'</div>'
      +'<div class="mcard-musteri">'+musteriEtiketi+' '+f.musteri+'</div>'
      +'<div class="mcard-meta">'
        +'📅 <b>'+f.tarih+'</b>'
        +(f.vknTckn?' · <span style="font-family:monospace">'+f.vknTckn+'</span>':'')
        +'<br><span style="background:'+tipRenk+'15;color:'+tipRenk+';padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700">'+tipEtiket+'</span>'
        +(f.hizmet?' · '+f.hizmet:'')
      +'</div>'
      +(f.edmEttn?'<div class="mcard-meta" style="margin-top:4px;font-size:10px;font-family:monospace">ETTN: '+f.edmEttn+'</div>':'')
      +'<div class="mcard-foot">'
        +'<div>'
          +'<div style="font-size:10px;color:var(--ink4)">KDV Dahil</div>'
          +'<div class="mcard-tutar">₺'+(f.toplamTutar||0).toLocaleString('tr-TR')+'</div>'
        +'</div>'
        +'<div class="mcard-aksiyonlar">'+aksiyonlar+'</div>'
      +'</div>'
    +'</div>';
  }).join('');
}

function faturaFiltreTemizle(){['fat-arama','fat-tip','fat-durum','fat-tarih-bas','fat-tarih-bit'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});faturaListeYukle();}

function faturaYeniAc(onceden){
  // Onceki oturumdan kalan state temizle
  window._fatAlici=null;window._fatOdeme=null;window._fatKalemler=null;
  window._fatGenelIskonto=0;window._fatIskontoTip='yuzde';window._fatAdim=1;
  window._fatPre=null;window._fatEdmUyari=null;
  var pre=onceden||{};
  var ovl=document.createElement('div');
  ovl.id='fatura-yeni-ovl';
  ovl.style.cssText='position:fixed;inset:0;z-index:980;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto';
  ovl.onclick=function(e){if(e.target===ovl)ovl.remove();};

  // EDM durum paneli
  var edmAyarUyari='';
  (function(){
    var gonderimDurum=edmAyarKontrol('gonderim');
    var testEtiketi=edmTestMi()?'<span style="background:rgba(37,99,235,.1);color:#2563EB;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700">\ud83e\uddea TEST MODU</span>':'<span style="background:rgba(22,163,74,.1);color:#16a34a;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700">\u2705 CANLI MOD</span>';
    if(gonderimDurum.ok){
      edmAyarUyari='<div style="padding:8px 12px;background:rgba(22,163,74,.05);border:1px solid rgba(22,163,74,.2);border-radius:8px;color:#16a34a;font-size:11px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center"><span>\u2705 <b>EDM haz\u0131r</b></span>'+testEtiketi+'</div>';
    } else if(gonderimDurum.hatalar.length===1 && gonderimDurum.hatalar[0].indexOf('aktif de\u011fil')>-1){
      edmAyarUyari='<div style="padding:8px 12px;background:rgba(217,119,6,.05);border:1px solid rgba(217,119,6,.2);border-radius:8px;color:#92400e;font-size:11px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center"><span>\u26a0\ufe0f <b>EDM kapal\u0131</b> - yerel kaydedilecek</span>'+testEtiketi+'</div>';
    } else {
      edmAyarUyari='<div style="padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:11px;margin-bottom:12px">\u26a0\ufe0f <b>EDM eksik:</b> '+gonderimDurum.hatalar.join(' \u00b7 ')+'</div>';
    }
  })();

  // Urun listesi olustur (autocomplete icin)
  var urunListesi=[];
  Object.keys(URUNLER).forEach(function(k){var u=URUNLER[k];urunListesi.push({kod:k,isim:u.isim,fiyat:u.full||0,kdv:edmKdvOrani()});});
  SERAMIK.forEach(function(s,i){urunListesi.push({kod:'SER'+i,isim:s.isim,fiyat:s.tutar||0,kdv:edmKdvOrani()});});
  DIGER_HIZMETLER.forEach(function(d,i){urunListesi.push({kod:'DIG'+i,isim:d.isim,fiyat:d.tutar||0,kdv:edmKdvOrani()});});
  window._fatUrunListesi=urunListesi;

  // Baslangic kalemleri
  window._fatKalemler=[];
  if(pre.hizmet && pre.tutar){
    var preKdv=edmKdvOrani();
    var preFiyat=pre.tutar/(1+preKdv/100);
    window._fatKalemler.push({ad:pre.hizmet,adet:1,birim:'Adet',fiyat:Math.round(preFiyat*100)/100,kdv:preKdv,iskonto:0});
  }
  if(!window._fatKalemler.length) window._fatKalemler.push({ad:'',adet:1,birim:'Adet',fiyat:0,kdv:edmKdvOrani(),iskonto:0});

  window._fatAdim=1;
  window._fatGenelIskonto=0;
  window._fatIskontoTip='yuzde';

  // Ana modal HTML
  ovl.innerHTML=''
    +'<div style="background:#fff;border-radius:16px;max-width:720px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.25);max-height:92vh;display:flex;flex-direction:column;overflow:hidden">'
      +'<div style="background:linear-gradient(135deg,var(--ink),#1e293b);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">'
        +'<div style="font-family:Bebas Neue,sans-serif;font-size:18px;letter-spacing:2px;color:#fff">\ud83e\uddfe YEN\u0130 FATURA</div>'
        +'<div onclick="document.getElementById(\'fatura-yeni-ovl\').remove()" style="cursor:pointer;color:#888;font-size:26px">&times;</div>'
      +'</div>'
      +'<div class="fat-step-bar" style="display:flex;gap:2px;padding:0 16px;background:#f8fafc;border-bottom:1.5px solid var(--bd);flex-shrink:0">'
        +'<button type="button" id="fat-tab-1" onclick="fatAdimGec(1)" style="flex:1;padding:10px 6px;border:none;background:transparent;font-family:Outfit,sans-serif;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid var(--r);color:var(--r)">\u2460 Al\u0131c\u0131</button>'
        +'<button type="button" id="fat-tab-2" onclick="fatAdimGec(2)" style="flex:1;padding:10px 6px;border:none;background:transparent;font-family:Outfit,sans-serif;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid transparent;color:var(--ink4)">\u2461 Kalemler</button>'
        +'<button type="button" id="fat-tab-3" onclick="fatAdimGec(3)" style="flex:1;padding:10px 6px;border:none;background:transparent;font-family:Outfit,sans-serif;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid transparent;color:var(--ink4)">\u2462 \u00d6deme</button>'
        +'<button type="button" id="fat-tab-4" onclick="fatAdimGec(4)" style="flex:1;padding:10px 6px;border:none;background:transparent;font-family:Outfit,sans-serif;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid transparent;color:var(--ink4)">\u2463 \u00d6zet</button>'
      +'</div>'
      +'<div id="fat-wizard-icerik" style="overflow-y:auto;flex:1;padding:16px"></div>'
      +'<div id="fat-wizard-footer" style="padding:12px 16px;display:flex;gap:8px;border-top:1px solid var(--bd);flex-shrink:0"></div>'
    +'</div>';

  document.body.appendChild(ovl);
  window._fatEdmUyari=edmAyarUyari;
  window._fatPre=pre;
  fatAdimRender(1);
}

/* === WIZARD ADIM GECIS === */
function fatAdimGec(adim){
  if(adim<1) adim=1; if(adim>4) adim=4;
  if(adim > window._fatAdim){
    for(var v=window._fatAdim;v<adim;v++){
      if(!fatAdimDogrula(v)) return;
    }
  }
  window._fatAdim=adim;
  for(var t=1;t<=4;t++){
    var tab=document.getElementById('fat-tab-'+t);
    if(tab){
      tab.style.borderBottomColor=(t===adim)?'var(--r)':'transparent';
      tab.style.color=(t===adim)?'var(--r)':'var(--ink4)';
    }
  }
  fatAdimRender(adim);
}

function fatAdimDogrula(adim){
  if(adim===1){
    var m=((document.getElementById('fat-musteri-adi')||{}).value||'').trim();
    if(!m){toast('M\u00fc\u015fteri ad\u0131/unvan zorunlu','red');return false;}
    var il=((document.getElementById('fat-il')||{}).value||'').trim();
    if(!il){toast('\u0130l zorunlu','red');return false;}
    var mTip=((document.getElementById('fat-musteri-tip')||{}).value||'bireysel');
    if(mTip==='kurumsal'){
      var vd=((document.getElementById('fat-vergi-dairesi')||{}).value||'').trim();
      if(!vd){toast('Kurumsal m\u00fc\u015fteri i\u00e7in vergi dairesi zorunlu','red');return false;}
    }
    fatAdim1Kaydet();
    return true;
  }
  if(adim===2){
    fatKalemlerdenTopla();
    var kalemler=window._fatKalemler;
    if(!kalemler.length){toast('En az bir kalem gerekli','red');return false;}
    for(var k=0;k<kalemler.length;k++){
      if(!kalemler[k].ad.trim()){toast('Kalem '+(k+1)+': Hizmet/\u00fcr\u00fcn ad\u0131 zorunlu','red');return false;}
      if(kalemler[k].fiyat<=0){toast('Kalem '+(k+1)+': Ge\u00e7erli fiyat giriniz','red');return false;}
    }
    return true;
  }
  if(adim===3){
    fatAdim3Kaydet();
    return true;
  }
  return true;
}

function fatAdim1Kaydet(){
  var g=function(id){var el=document.getElementById(id);return el?el.value.trim():'';};
  window._fatAlici={
    vkn:g('fat-vkn'), musteri:g('fat-musteri-adi'), tel:g('fat-tel'), email:g('fat-email'),
    adres:g('fat-adres'), il:g('fat-il'), ilce:g('fat-ilce'), vergiDairesi:g('fat-vergi-dairesi'),
    musteriTip:g('fat-musteri-tip')||'bireysel', faturaTipi:g('fat-yeni-tip')||'EARSIV',
    senaryo:g('fat-senaryo')||'TEMEL', alias:g('fat-alias')
  };
}

function fatAdim3Kaydet(){
  var g=function(id){var el=document.getElementById(id);return el?el.value.trim():'';};
  window._fatOdeme={
    yontem:g('fat-odeme-yontem'), vade:g('fat-odeme-vade'), iban:g('fat-iban'),
    plaka:g('fat-plaka')||((window._fatPre||{}).plaka||''),
    randevuId:g('fat-randevu-id')||((window._fatPre||{}).randevuId||''),
    not:g('fat-not')
  };
  var iskDeg=parseFloat(g('fat-genel-iskonto'))||0;
  window._fatGenelIskonto=iskDeg;
  window._fatIskontoTip=(document.getElementById('fat-iskonto-tip')||{}).value||'yuzde';
}

/* === ADIM RENDER === */
function fatAdimRender(adim){
  var icerikEl=document.getElementById('fat-wizard-icerik');
  var footerEl=document.getElementById('fat-wizard-footer');
  if(!icerikEl||!footerEl) return;
  var IS='width:100%;padding:9px 12px;border:1.5px solid var(--bd);border-radius:8px;font-size:13px;font-family:Outfit,sans-serif;outline:none;box-sizing:border-box';
  var LS='font-size:10px;font-weight:700;color:var(--ink4);text-transform:uppercase;margin-bottom:4px;letter-spacing:.3px';

  if(adim===1){
    var a=window._fatAlici||{};
    var pre=window._fatPre||{};
    icerikEl.innerHTML=''
      +(window._fatEdmUyari||'')
      +'<div style="'+LS+'">TC Kimlik No / Vergi No *</div>'
      +'<div style="display:flex;gap:6px;margin-bottom:4px">'
        +'<input type="text" id="fat-vkn" maxlength="11" placeholder="10\u2192VKN, 11\u2192TC" inputmode="numeric" value="'+(a.vkn||'')+'" style="'+IS+';flex:1" oninput="this.value=this.value.replace(/[^0-9]/g,\'\');faturaVknOtoAlgila();fatVdGoster()">'
        +'<button type="button" id="fat-sorgu-btn" onclick="faturaEDMSorgu()" style="padding:9px 14px;border:1.5px solid #1a6b3c;border-radius:8px;background:rgba(26,107,60,.08);color:#1a6b3c;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">\ud83d\udd0d EDM Sorgula</button>'
      +'</div>'
      +'<div id="fat-sorgu-sonuc" style="font-size:11px;margin-bottom:12px;min-height:16px"></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
        +'<div style="grid-column:1/-1"><div style="'+LS+'">M\u00fc\u015fteri Ad\u0131 / Unvan *</div><input type="text" id="fat-musteri-adi" value="'+(a.musteri||pre.musteri||'')+'" style="'+IS+'"></div>'
        +'<div><div style="'+LS+'">Telefon</div><input type="tel" id="fat-tel" value="'+(a.tel||pre.tel||'')+'" style="'+IS+'"></div>'
        +'<div><div style="'+LS+'">E-Posta</div><input type="email" id="fat-email" value="'+(a.email||'')+'" placeholder="musteri@..." style="'+IS+'"></div>'
        +'<div id="fat-vd-wrap" style="'+(((a.musteriTip||'bireysel')==='kurumsal')?'':'display:none')+'"><div style="'+LS+'">Vergi Dairesi *</div><input type="text" id="fat-vergi-dairesi" value="'+(a.vergiDairesi||'')+'" placeholder="\u00d6rn: Atakum VD" style="'+IS+'"></div>'
        +'<div style="grid-column:1/-1"><div style="'+LS+'">Adres</div><input type="text" id="fat-adres" value="'+(a.adres||'')+'" placeholder="A\u00e7\u0131k adres" style="'+IS+'"></div>'
        +'<div><div style="'+LS+'">\u0130l *</div><input type="text" id="fat-il" value="'+(a.il||'')+'" style="'+IS+'"></div>'
        +'<div><div style="'+LS+'">\u0130l\u00e7e</div><input type="text" id="fat-ilce" value="'+(a.ilce||'')+'" style="'+IS+'"></div>'
      +'</div>'
      +'<div style="padding:10px 12px;background:var(--bg);border:1px solid var(--bd);border-radius:8px;margin-bottom:12px;font-size:12px">'
        +'<div style="'+LS+';margin-bottom:4px">Fatura Tipi</div>'
        +'<div id="fat-tip-bilgi" style="font-weight:700;color:var(--ink4);margin-bottom:8px">\u23f3 TC/VKN girin veya manuel se\u00e7in</div>'
        +'<div style="display:flex;gap:6px">'
          +'<button type="button" id="fat-tip-earsiv-btn" onclick="faturaTipiManuel(\'EARSIV\')" style="flex:1;padding:8px;border:2px solid #d97706;border-radius:7px;background:rgba(217,119,6,.08);color:#d97706;font-size:11px;font-weight:700;cursor:pointer">\ud83d\udccb e-Ar\u015fiv</button>'
          +'<button type="button" id="fat-tip-efatura-btn" onclick="faturaTipiManuel(\'EFATURA\')" style="flex:1;padding:8px;border:1.5px solid var(--bd);border-radius:7px;background:#fff;color:var(--ink4);font-size:11px;font-weight:700;cursor:pointer">\ud83c\udfe2 e-Fatura</button>'
        +'</div>'
        +'<div id="fat-senaryo-wrap" style="margin-top:8px;display:none"><div style="'+LS+'">Fatura Senaryosu</div><select id="fat-senaryo" style="'+IS+'"><option value="TEMEL">TEMEL Fatura</option><option value="TICARI">T\u0130CAR\u0130 Fatura</option></select></div>'
        +'<input type="hidden" id="fat-yeni-tip" value="'+(a.faturaTipi||'EARSIV')+'">'
        +'<input type="hidden" id="fat-alias" value="'+(a.alias||'')+'">'
        +'<input type="hidden" id="fat-musteri-tip" value="'+(a.musteriTip||'bireysel')+'">'
      +'</div>';
    footerEl.innerHTML=''
      +'<div style="flex:1"></div>'
      +'<button type="button" onclick="document.getElementById(\'fatura-yeni-ovl\').remove()" style="padding:10px 16px;border:1.5px solid var(--bd);border-radius:8px;background:#fff;font-family:Bebas Neue,sans-serif;font-size:13px;cursor:pointer">\u0130ptal</button>'
      +'<button type="button" onclick="fatAdimGec(2)" style="padding:10px 24px;border:none;border-radius:8px;background:var(--r);color:#fff;font-family:Bebas Neue,sans-serif;font-size:13px;letter-spacing:1px;cursor:pointer">\u0130LER\u0130 \u2192</button>';
    if(a.vkn) setTimeout(function(){faturaVknOtoAlgila();fatVdGoster();},50);
    if(a.faturaTipi) setTimeout(function(){faturaTipiButonGuncelle(a.faturaTipi);},60);
  } else if(adim===2){
    fatAdim2Render(icerikEl,footerEl,IS,LS);
  } else if(adim===3){
    fatAdim3Render(icerikEl,footerEl,IS,LS);
  } else if(adim===4){
    fatAdim4Render(icerikEl,footerEl,IS,LS);
  }
}

/* Vergi dairesi alanini goster/gizle */
function fatVdGoster(){
  var vknInp=document.getElementById('fat-vkn');
  var wrap=document.getElementById('fat-vd-wrap');
  var mTip=document.getElementById('fat-musteri-tip');
  if(!wrap) return;
  var val=(vknInp?vknInp.value:'').trim();
  if(val.length===10){
    wrap.style.display='';
    if(mTip) mTip.value='kurumsal';
  } else {
    wrap.style.display='none';
    if(mTip) mTip.value='bireysel';
  }
  var senWrap=document.getElementById('fat-senaryo-wrap');
  var tipH=document.getElementById('fat-yeni-tip');
  if(senWrap && tipH) senWrap.style.display=(tipH.value==='EFATURA')?'':'none';
}

/* === ADIM 2: KALEMLER === */
function fatAdim2Render(icerikEl,footerEl,IS,LS){
  var h='';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
    +'<div style="font-family:Bebas Neue,sans-serif;font-size:15px;letter-spacing:1px;color:var(--ink)">FATURA KALEMLER\u0130</div>'
    +'<button type="button" onclick="fatKalemEkle()" style="padding:6px 14px;border:1.5px solid #1a6b3c;border-radius:7px;background:rgba(26,107,60,.06);color:#1a6b3c;font-size:11px;font-weight:700;cursor:pointer">+ Sat\u0131r Ekle</button>'
  +'</div>';
  h+='<div class="fat-kalem-wrap" id="fat-kalem-wrap"></div>';
  h+='<div id="fat-ara-toplam" style="margin-top:12px;padding:12px;background:#fef7f2;border:1px solid #f5d5b8;border-radius:10px;font-size:12px"></div>';
  icerikEl.innerHTML=h;
  fatKalemTabloRender();
  footerEl.innerHTML=''
    +'<button type="button" onclick="fatAdimGec(1)" style="padding:10px 16px;border:1.5px solid var(--bd);border-radius:8px;background:#fff;font-family:Bebas Neue,sans-serif;font-size:13px;cursor:pointer">\u2190 GER\u0130</button>'
    +'<div style="flex:1"></div>'
    +'<button type="button" onclick="fatAdimGec(3)" style="padding:10px 24px;border:none;border-radius:8px;background:var(--r);color:#fff;font-family:Bebas Neue,sans-serif;font-size:13px;letter-spacing:1px;cursor:pointer">\u0130LER\u0130 \u2192</button>';
}

function fatKalemTabloRender(){
  var wrap=document.getElementById('fat-kalem-wrap');if(!wrap) return;
  var kalemler=window._fatKalemler||[];
  var rows=kalemler.map(function(k,i){
    return '<tr>'
      +'<td data-label="Hizmet" style="position:relative"><input type="text" value="'+((k.ad||'').replace(/"/g,'&quot;'))+'" placeholder="Hizmet/\u00fcr\u00fcn" oninput="fatUrunAra(this,'+i+')" onchange="fatKalemDeg('+i+',\'ad\',this.value)" style="width:100%;padding:7px 8px;border:1.5px solid var(--bd);border-radius:6px;font-size:12px;font-family:Outfit,sans-serif;outline:none;box-sizing:border-box"><div id="fat-oneri-'+i+'" style="display:none;position:absolute;left:0;right:0;top:100%;background:#fff;border:1.5px solid var(--bd);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);max-height:180px;overflow-y:auto;z-index:10"></div></td>'
      +'<td data-label="Adet"><input type="number" value="'+(k.adet||1)+'" min="1" style="width:60px;padding:7px 6px;border:1.5px solid var(--bd);border-radius:6px;font-size:12px;font-family:Outfit,sans-serif;outline:none;text-align:center" onchange="fatKalemDeg('+i+',\'adet\',this.value);fatKalemHesapla()"></td>'
      +'<td data-label="Birim"><select style="padding:7px 4px;border:1.5px solid var(--bd);border-radius:6px;font-size:11px;font-family:Outfit,sans-serif;outline:none" onchange="fatKalemDeg('+i+',\'birim\',this.value)"><option'+(k.birim==='Adet'?' selected':'')+'>Adet</option><option'+(k.birim==='Metre'?' selected':'')+'>Metre</option><option'+(k.birim==='Paket'?' selected':'')+'>Paket</option><option'+(k.birim==='Set'?' selected':'')+'>Set</option></select></td>'
      +'<td data-label="Fiyat (KDV hari\u00e7)"><input type="number" value="'+(k.fiyat||0)+'" min="0" step="0.01" style="width:90px;padding:7px 6px;border:1.5px solid var(--bd);border-radius:6px;font-size:12px;font-family:Outfit,sans-serif;outline:none;text-align:right" onchange="fatKalemDeg('+i+',\'fiyat\',this.value);fatKalemHesapla()"></td>'
      +'<td data-label="KDV"><select style="padding:7px 4px;border:1.5px solid var(--bd);border-radius:6px;font-size:11px;font-family:Outfit,sans-serif;outline:none" onchange="fatKalemDeg('+i+',\'kdv\',this.value);fatKalemHesapla()"><option value="20"'+(k.kdv==20?' selected':'')+'>%20</option><option value="10"'+(k.kdv==10?' selected':'')+'>%10</option><option value="1"'+(k.kdv==1?' selected':'')+'>%1</option><option value="0"'+(k.kdv==0?' selected':'')+'>%0</option></select></td>'
      +'<td data-label="Toplam" style="font-weight:700;font-size:13px;color:var(--r);white-space:nowrap" id="fat-kalem-toplam-'+i+'"></td>'
      +'<td>'+(kalemler.length>1?'<button type="button" onclick="fatKalemSil('+i+')" style="border:none;background:none;color:#dc2626;font-size:16px;cursor:pointer;padding:4px" title="Sat\u0131r sil">\u2715</button>':'')+'</td>'
    +'</tr>';
  }).join('');

  wrap.innerHTML='<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr style="background:var(--bg)">'
      +'<th style="padding:8px;font-size:10px;text-transform:uppercase;text-align:left;font-weight:700;color:var(--ink4)">Hizmet/\u00dcr\u00fcn</th>'
      +'<th style="padding:8px;font-size:10px;text-transform:uppercase;text-align:center;font-weight:700;color:var(--ink4);width:60px">Adet</th>'
      +'<th style="padding:8px;font-size:10px;text-transform:uppercase;text-align:left;font-weight:700;color:var(--ink4);width:70px">Birim</th>'
      +'<th style="padding:8px;font-size:10px;text-transform:uppercase;text-align:right;font-weight:700;color:var(--ink4);width:100px">Fiyat</th>'
      +'<th style="padding:8px;font-size:10px;text-transform:uppercase;text-align:center;font-weight:700;color:var(--ink4);width:60px">KDV</th>'
      +'<th style="padding:8px;font-size:10px;text-transform:uppercase;text-align:right;font-weight:700;color:var(--ink4);width:100px">Toplam</th>'
      +'<th style="width:30px"></th>'
    +'</tr></thead>'
    +'<tbody>'+rows+'</tbody></table>';
  fatKalemHesapla();
}

function fatKalemEkle(){
  window._fatKalemler.push({ad:'',adet:1,birim:'Adet',fiyat:0,kdv:edmKdvOrani(),iskonto:0});
  fatKalemTabloRender();
}

function fatKalemSil(idx){
  window._fatKalemler.splice(idx,1);
  if(!window._fatKalemler.length) window._fatKalemler.push({ad:'',adet:1,birim:'Adet',fiyat:0,kdv:edmKdvOrani(),iskonto:0});
  fatKalemTabloRender();
}

function fatKalemDeg(idx,alan,deger){
  var k=window._fatKalemler[idx];
  if(!k) return;
  if(alan==='adet') k.adet=parseInt(deger)||1;
  else if(alan==='fiyat') k.fiyat=parseFloat(deger)||0;
  else if(alan==='kdv') k.kdv=parseInt(deger)||0;
  else if(alan==='iskonto') k.iskonto=parseFloat(deger)||0;
  else k[alan]=deger;
}

function fatKalemlerdenTopla(){
  var wrap=document.getElementById('fat-kalem-wrap');
  if(!wrap) return;
  var rows=wrap.querySelectorAll('tbody tr');
  rows.forEach(function(row,i){
    var inputs=row.querySelectorAll('input,select');
    if(inputs[0]) window._fatKalemler[i].ad=inputs[0].value;
    if(inputs[1]) window._fatKalemler[i].adet=parseInt(inputs[1].value)||1;
    if(inputs[2]) window._fatKalemler[i].birim=inputs[2].value;
    if(inputs[3]) window._fatKalemler[i].fiyat=parseFloat(inputs[3].value)||0;
    if(inputs[4]) window._fatKalemler[i].kdv=parseInt(inputs[4].value)||0;
  });
}

function fatKalemHesapla(){
  var kalemler=window._fatKalemler||[];
  var araToplam=0,toplamKdv=0;
  kalemler.forEach(function(k,i){
    var matrah=k.adet*k.fiyat;
    var kdv=matrah*(k.kdv/100);
    var satirToplam=matrah+kdv;
    araToplam+=matrah;
    toplamKdv+=kdv;
    var el=document.getElementById('fat-kalem-toplam-'+i);
    if(el) el.textContent='\u20ba'+satirToplam.toLocaleString('tr-TR',{maximumFractionDigits:2});
  });
  var genelToplam=araToplam+toplamKdv;
  var ozetEl=document.getElementById('fat-ara-toplam');
  if(ozetEl){
    ozetEl.innerHTML=''
      +'<div style="display:flex;justify-content:space-between;padding:3px 0"><span>Ara Toplam (KDV Hari\u00e7):</span><b>\u20ba'+araToplam.toLocaleString('tr-TR',{maximumFractionDigits:2})+'</b></div>'
      +'<div style="display:flex;justify-content:space-between;padding:3px 0"><span>Toplam KDV:</span><b style="color:#d97706">\u20ba'+toplamKdv.toLocaleString('tr-TR',{maximumFractionDigits:2})+'</b></div>'
      +'<div style="display:flex;justify-content:space-between;padding:5px 0 2px;border-top:1.5px solid #f5d5b8;margin-top:4px"><span style="font-weight:700">Genel Toplam:</span><b style="color:var(--r);font-size:15px">\u20ba'+genelToplam.toLocaleString('tr-TR',{maximumFractionDigits:2})+'</b></div>';
  }
}

/* Urun autocomplete */
function fatUrunAra(inp,idx){
  fatKalemDeg(idx,'ad',inp.value);
  var oneriEl=document.getElementById('fat-oneri-'+idx);
  if(!oneriEl) return;
  var q=(inp.value||'').toLowerCase().trim();
  if(q.length<2){oneriEl.style.display='none';return;}
  var sonuclar=(window._fatUrunListesi||[]).filter(function(u){return u.isim.toLowerCase().indexOf(q)>-1;}).slice(0,8);
  if(!sonuclar.length){oneriEl.style.display='none';return;}
  oneriEl.style.display='block';
  oneriEl.innerHTML=sonuclar.map(function(u){
    return '<div onclick="fatUrunSec('+idx+',\''+u.kod+'\')" style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--bg);display:flex;justify-content:space-between;align-items:center" onmouseenter="this.style.background=\'var(--bg)\'" onmouseleave="this.style.background=\'#fff\'">'
      +'<span>'+u.isim+'</span>'
      +(u.fiyat?'<b style="color:var(--r);font-size:11px;white-space:nowrap">\u20ba'+u.fiyat.toLocaleString('tr-TR')+'</b>':'')
    +'</div>';
  }).join('');
  setTimeout(function(){document.addEventListener('click',function cl(e){if(!oneriEl.contains(e.target)&&e.target!==inp){oneriEl.style.display='none';document.removeEventListener('click',cl);}});},10);
}

function fatUrunSec(idx,kod){
  var u=(window._fatUrunListesi||[]).find(function(x){return x.kod===kod;});
  if(!u) return;
  window._fatKalemler[idx].ad=u.isim;
  window._fatKalemler[idx].fiyat=u.fiyat;
  window._fatKalemler[idx].kdv=u.kdv||edmKdvOrani();
  fatKalemTabloRender();
}

/* === ADIM 3: ODEME & NOTLAR === */
function fatAdim3Render(icerikEl,footerEl,IS,LS){
  var o=window._fatOdeme||{};
  var pre=window._fatPre||{};
  icerikEl.innerHTML=''
    +'<div style="font-family:Bebas Neue,sans-serif;font-size:15px;letter-spacing:1px;color:var(--ink);margin-bottom:12px">\u00d6DEME & NOTLAR</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">'
      +'<div><div style="'+LS+'">\u00d6deme Y\u00f6ntemi</div><select id="fat-odeme-yontem" style="'+IS+'"><option value="">Se\u00e7iniz</option><option value="Nakit"'+(o.yontem==='Nakit'?' selected':'')+'>\ud83d\udcb5 Nakit</option><option value="Kredi Kart\u0131"'+(o.yontem==='Kredi Kart\u0131'?' selected':'')+'>\ud83d\udcb3 Kredi Kart\u0131</option><option value="Havale/EFT"'+(o.yontem==='Havale/EFT'?' selected':'')+'>\ud83c\udfe6 Havale/EFT</option><option value="\u00c7ek"'+(o.yontem==='\u00c7ek'?' selected':'')+'>\ud83d\udcdd \u00c7ek</option></select></div>'
      +'<div><div style="'+LS+'">\u00d6deme Vadesi</div><input type="date" id="fat-odeme-vade" value="'+(o.vade||'')+'" style="'+IS+'"></div>'
      +'<div style="grid-column:1/-1"><div style="'+LS+'">Banka / IBAN</div><input type="text" id="fat-iban" value="'+(o.iban||'')+'" placeholder="TR00 0000 0000 0000 0000 0000 00" style="'+IS+'"></div>'
    +'</div>'
    +'<div style="padding:10px 12px;background:var(--bg);border:1px solid var(--bd);border-radius:8px;margin-bottom:12px">'
      +'<div style="'+LS+'">Genel \u0130skonto</div>'
      +'<div style="display:flex;gap:8px;align-items:center">'
        +'<select id="fat-iskonto-tip" style="padding:7px 8px;border:1.5px solid var(--bd);border-radius:6px;font-size:12px;font-family:Outfit,sans-serif;outline:none" onchange="fatIskontoHesapla()"><option value="yuzde"'+(window._fatIskontoTip==='yuzde'?' selected':'')+'>%</option><option value="tutar"'+(window._fatIskontoTip==='tutar'?' selected':'')+'>\u20ba</option></select>'
        +'<input type="number" id="fat-genel-iskonto" value="'+(window._fatGenelIskonto||0)+'" min="0" step="0.01" style="width:100px;padding:7px 8px;border:1.5px solid var(--bd);border-radius:6px;font-size:13px;font-family:Outfit,sans-serif;outline:none;text-align:right" oninput="fatIskontoHesapla()">'
        +'<span id="fat-iskonto-sonuc" style="font-size:12px;color:var(--ink4)"></span>'
      +'</div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">'
      +'<div><div style="'+LS+'">Plaka / Ara\u00e7</div><input type="text" id="fat-plaka" value="'+(o.plaka||pre.plaka||'')+'" placeholder="55 ABC 123" style="'+IS+'"></div>'
      +'<div><div style="'+LS+'">Randevu No</div><input type="text" id="fat-randevu-id" value="'+(o.randevuId||pre.randevuId||'')+'" readonly style="'+IS+';background:var(--bg);color:var(--ink4)"></div>'
    +'</div>'
    +'<div><div style="'+LS+'">A\u00e7\u0131klama / Not</div><textarea id="fat-not" rows="2" placeholder="Fatura a\u00e7\u0131klamas\u0131..." style="'+IS+';resize:vertical">'+(o.not||edmNotSablonu()||'')+'</textarea></div>';
  footerEl.innerHTML=''
    +'<button type="button" onclick="fatAdim3Kaydet();fatAdimGec(2)" style="padding:10px 16px;border:1.5px solid var(--bd);border-radius:8px;background:#fff;font-family:Bebas Neue,sans-serif;font-size:13px;cursor:pointer">\u2190 GER\u0130</button>'
    +'<div style="flex:1"></div>'
    +'<button type="button" onclick="fatAdimGec(4)" style="padding:10px 24px;border:none;border-radius:8px;background:var(--r);color:#fff;font-family:Bebas Neue,sans-serif;font-size:13px;letter-spacing:1px;cursor:pointer">\u0130LER\u0130 \u2192</button>';
  fatIskontoHesapla();
}

function fatIskontoHesapla(){
  var tip=(document.getElementById('fat-iskonto-tip')||{}).value||'yuzde';
  var deger=parseFloat((document.getElementById('fat-genel-iskonto')||{}).value)||0;
  var kalemler=window._fatKalemler||[];
  var araToplam=0;
  kalemler.forEach(function(k){araToplam+=k.adet*k.fiyat;});
  var iskTutar=(tip==='yuzde')?(araToplam*deger/100):deger;
  var sonucEl=document.getElementById('fat-iskonto-sonuc');
  if(sonucEl && iskTutar>0) sonucEl.textContent='-\u20ba'+iskTutar.toLocaleString('tr-TR',{maximumFractionDigits:2});
  else if(sonucEl) sonucEl.textContent='';
}

/* === ADIM 4: OZET & ONAY === */
function fatAdim4Render(icerikEl,footerEl,IS,LS){
  fatAdim3Kaydet();
  var a=window._fatAlici||{};
  var o=window._fatOdeme||{};
  var kalemler=window._fatKalemler||[];
  var araToplam=0,toplamKdv=0;
  kalemler.forEach(function(k){var m=k.adet*k.fiyat;araToplam+=m;toplamKdv+=m*(k.kdv/100);});
  var iskTip=window._fatIskontoTip||'yuzde';
  var iskDeg=window._fatGenelIskonto||0;
  var iskTutar=(iskTip==='yuzde')?(araToplam*iskDeg/100):iskDeg;
  var matrah=araToplam-iskTutar;
  var kdvSonra=matrah>0?(toplamKdv*(matrah/araToplam)):0;
  var genelToplam=matrah+kdvSonra;
  var tipLabel=a.faturaTipi==='EFATURA'?'\ud83c\udfe2 e-Fatura':'\ud83d\udccb e-Ar\u015fiv';
  var tipRenk=a.faturaTipi==='EFATURA'?'#2563EB':'#d97706';
  var h='';
  h+='<div style="padding:12px;background:var(--bg);border:1.5px solid var(--bd);border-radius:10px;margin-bottom:12px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      +'<div style="font-weight:700;font-size:14px">'+(a.musteri||'-')+'</div>'
      +'<span style="padding:3px 10px;border-radius:5px;font-size:10px;font-weight:700;background:rgba('+((a.faturaTipi==='EFATURA')?'37,99,235':'217,119,6')+',.1);color:'+tipRenk+'">'+tipLabel+'</span>'
    +'</div>'
    +(a.vkn?'<div style="font-size:11px;color:var(--ink4)">'+(a.musteriTip==='kurumsal'?'VKN':'TC')+': '+a.vkn+(a.vergiDairesi?' \u00b7 '+a.vergiDairesi:'')+'</div>':'')
    +(a.faturaTipi==='EFATURA'&&a.senaryo?'<div style="font-size:11px;color:var(--ink4)">Senaryo: '+a.senaryo+'</div>':'')
  +'</div>';
  h+='<div style="border:1.5px solid var(--bd);border-radius:10px;overflow:hidden;margin-bottom:12px">';
  h+='<table style="width:100%;border-collapse:collapse">';
  h+='<thead><tr style="background:var(--bg)"><th style="padding:8px;font-size:10px;text-align:left;color:var(--ink4)">Hizmet</th><th style="padding:8px;font-size:10px;text-align:center;color:var(--ink4)">Adet</th><th style="padding:8px;font-size:10px;text-align:right;color:var(--ink4)">Fiyat</th><th style="padding:8px;font-size:10px;text-align:center;color:var(--ink4)">KDV</th><th style="padding:8px;font-size:10px;text-align:right;color:var(--ink4)">Toplam</th></tr></thead><tbody>';
  kalemler.forEach(function(k){
    var m=k.adet*k.fiyat;
    var kdv=m*(k.kdv/100);
    h+='<tr style="border-top:1px solid var(--bg)"><td style="padding:8px;font-size:12px;font-weight:600">'+k.ad+'</td><td style="padding:8px;font-size:12px;text-align:center">'+k.adet+' '+k.birim+'</td><td style="padding:8px;font-size:12px;text-align:right">\u20ba'+k.fiyat.toLocaleString('tr-TR')+'</td><td style="padding:8px;font-size:12px;text-align:center">%'+k.kdv+'</td><td style="padding:8px;font-size:12px;text-align:right;font-weight:700">\u20ba'+(m+kdv).toLocaleString('tr-TR',{maximumFractionDigits:2})+'</td></tr>';
  });
  h+='</tbody></table></div>';
  h+='<div style="padding:14px;background:linear-gradient(135deg,#fef7f2,#fff7ed);border:1.5px solid #f5d5b8;border-radius:10px;margin-bottom:12px">';
  h+='<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span>Ara Toplam (KDV Hari\u00e7)</span><b>\u20ba'+araToplam.toLocaleString('tr-TR',{maximumFractionDigits:2})+'</b></div>';
  if(iskTutar>0){
    h+='<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;color:#16a34a"><span>\u0130skonto ('+(iskTip==='yuzde'?'%'+iskDeg:'\u20ba'+iskDeg)+')</span><b>-\u20ba'+iskTutar.toLocaleString('tr-TR',{maximumFractionDigits:2})+'</b></div>';
    h+='<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span>KDV Matrah\u0131</span><b>\u20ba'+matrah.toLocaleString('tr-TR',{maximumFractionDigits:2})+'</b></div>';
  }
  h+='<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span>Toplam KDV</span><b style="color:#d97706">\u20ba'+kdvSonra.toLocaleString('tr-TR',{maximumFractionDigits:2})+'</b></div>';
  h+='<div style="display:flex;justify-content:space-between;padding:6px 0 2px;border-top:2px solid #eab28e;margin-top:6px"><span style="font-weight:700;font-size:14px">GENEL TOPLAM</span><b style="color:var(--r);font-size:18px">\u20ba'+genelToplam.toLocaleString('tr-TR',{maximumFractionDigits:2})+'</b></div>';
  h+='</div>';
  var chips=[];
  if(o.plaka) chips.push('\ud83d\ude97 '+o.plaka);
  if(o.yontem) chips.push('\ud83d\udcb3 '+o.yontem);
  if(o.vade) chips.push('\ud83d\udcc5 Vade: '+o.vade);
  if(o.randevuId) chips.push('\ud83d\udccb '+o.randevuId);
  if(chips.length){
    h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'+chips.map(function(c){return '<span style="padding:4px 10px;background:var(--bg);border:1px solid var(--bd);border-radius:20px;font-size:11px;color:var(--ink3)">'+c+'</span>';}).join('')+'</div>';
  }
  if(o.not) h+='<div style="font-size:11px;color:var(--ink4);padding:6px 0">\ud83d\udcdd '+o.not+'</div>';
  icerikEl.innerHTML=h;
  footerEl.innerHTML=''
    +'<button type="button" onclick="fatAdimGec(3)" style="padding:10px 16px;border:1.5px solid var(--bd);border-radius:8px;background:#fff;font-family:Bebas Neue,sans-serif;font-size:13px;cursor:pointer">\u2190 GER\u0130</button>'
    +'<div style="flex:1"></div>'
    +'<button type="button" id="fat-kes-btn" onclick="faturaKes()" style="padding:12px 28px;border:none;border-radius:8px;background:var(--r);color:#fff;font-family:Bebas Neue,sans-serif;font-size:14px;letter-spacing:1px;cursor:pointer;box-shadow:0 4px 12px rgba(176,28,46,.3)">\ud83e\uddfe KAYDET + \u00d6N\u0130ZLE</button>';
}

/** TC/VKN input değiştikçe otomatik tip algılama (10 hane = VKN/kurumsal, 11 hane = TC/bireysel) */
function faturaVknOtoAlgila(){
  var vknInp=document.getElementById('fat-vkn');
  var hidden=document.getElementById('fat-musteri-tip');
  var tipBilgi=document.getElementById('fat-tip-bilgi');
  var tipHidden=document.getElementById('fat-yeni-tip');
  var sonucEl=document.getElementById('fat-sorgu-sonuc');
  if(!vknInp) return;
  var val=(vknInp.value||'').trim();
  // Önceki EDM sorgu sonucunu temizle (kullanıcı yeniden yazıyorsa)
  var aliasEl=document.getElementById('fat-alias');
  if(aliasEl) aliasEl.value='';
  if(sonucEl) sonucEl.innerHTML='';
  // Manuel seçim flag'ini sıfırla (kullanıcı numarayı değiştirdiyse tekrar otomatik algılasın)
  try{ delete window._faturaTipManuel; }catch(e){}

  if(val.length===11){
    if(hidden) hidden.value='bireysel';
    if(tipHidden) tipHidden.value='EARSIV';
    if(tipBilgi){
      tipBilgi.innerHTML='👤 <b>Bireysel/Şahıs</b> — Default <b>e-Arşiv</b>. Mükellef ise "EDM\'den Sorgula" yapın veya "e-Fatura" seçin';
      tipBilgi.style.color='#d97706';
    }
    faturaTipiButonGuncelle('EARSIV');
  } else if(val.length===10){
    if(hidden) hidden.value='kurumsal';
    if(tipHidden) tipHidden.value='EARSIV';
    if(tipBilgi){
      tipBilgi.innerHTML='🏢 <b>Kurumsal</b> — EDM sorgu ile mükellef kontrol edin, veya manuel seçin';
      tipBilgi.style.color='#2563EB';
    }
    faturaTipiButonGuncelle('EARSIV');
  } else {
    if(hidden) hidden.value='bireysel';
    if(tipHidden) tipHidden.value='EARSIV';
    if(tipBilgi){
      tipBilgi.innerHTML='⏳ TC/VKN girin (10 hane = kurumsal, 11 hane = bireysel) veya manuel seçin';
      tipBilgi.style.color='var(--ink4)';
    }
    faturaTipiButonGuncelle('EARSIV');
  }
}

/** Manuel olarak fatura tipi seç (EDM sorgusu yapılamadığında) */
function faturaTipiManuel(tip){
  var tipHidden=document.getElementById('fat-yeni-tip');
  var tipBilgi=document.getElementById('fat-tip-bilgi');
  if(tipHidden) tipHidden.value=tip;
  // Manuel seçim yapıldığını işaretle
  window._faturaTipManuel = tip;
  if(tipBilgi){
    if(tip==='EFATURA'){
      tipBilgi.innerHTML='✋ <b>Manuel seçim:</b> e-Fatura olarak kesilecek (müşteri mükellef olduğu onaylandı)';
      tipBilgi.style.color='#16a34a';
    } else {
      tipBilgi.innerHTML='✋ <b>Manuel seçim:</b> e-Arşiv olarak kesilecek';
      tipBilgi.style.color='#d97706';
    }
  }
  faturaTipiButonGuncelle(tip);
}

/** Tip butonlarının görsel durumunu güncelle */
function faturaTipiButonGuncelle(tip){
  var earsivBtn=document.getElementById('fat-tip-earsiv-btn');
  var efaturaBtn=document.getElementById('fat-tip-efatura-btn');
  if(tip==='EFATURA'){
    if(efaturaBtn){ efaturaBtn.style.background='rgba(22,163,74,.08)';efaturaBtn.style.color='#16a34a';efaturaBtn.style.borderColor='#16a34a';efaturaBtn.style.borderWidth='2px'; }
    if(earsivBtn){ earsivBtn.style.background='#fff';earsivBtn.style.color='var(--ink4)';earsivBtn.style.borderColor='var(--bd)';earsivBtn.style.borderWidth='1.5px'; }
  } else {
    if(earsivBtn){ earsivBtn.style.background='rgba(217,119,6,.08)';earsivBtn.style.color='#d97706';earsivBtn.style.borderColor='#d97706';earsivBtn.style.borderWidth='2px'; }
    if(efaturaBtn){ efaturaBtn.style.background='#fff';efaturaBtn.style.color='var(--ink4)';efaturaBtn.style.borderColor='var(--bd)';efaturaBtn.style.borderWidth='1.5px'; }
  }
}

// Eski faturaTipSec fonksiyonu artık kullanılmıyor, ama backward compat için null-op tutalım
function faturaTipSec(){ /* deprecated: müşteri tipi otomatik algılanıyor */ }

/** EDM'den TC/VKN sorgula */
function faturaEDMSorgu(){
  var tip=(document.getElementById('fat-musteri-tip')||{}).value||'bireysel';
  var no=((document.getElementById('fat-vkn')||{}).value||'').trim();
  var sonucEl=document.getElementById('fat-sorgu-sonuc');
  var btn=document.getElementById('fat-sorgu-btn');

  if(!no){
    if(sonucEl) sonucEl.innerHTML='<span style="color:#991b1b">⚠️ Önce TC/VKN giriniz</span>';
    return;
  }
  if(no.length!==10 && no.length!==11){
    if(sonucEl) sonucEl.innerHTML='<span style="color:#991b1b">TC 11 hane, VKN 10 hane olmalidir</span>';
    return;
  }

  // EDM credentials kontrol (merkezi)
  var ayarDurum=edmAyarKontrol('minimal');
  if(!ayarDurum.ok){
    if(sonucEl) sonucEl.innerHTML='<span style="color:#991b1b">⚠️ '+ayarDurum.hatalar.join(' · ')+' (Ayarlar → EDM Bilişim)</span>';
    return;
  }

  if(btn){btn.disabled=true;btn.textContent='⏳ Sorgulanıyor...';}
  if(sonucEl) sonucEl.innerHTML='<span style="color:var(--ink4)">⏳ EDM servisine sorgu gönderiliyor...</span>';

  fetch('/api/edm/musteri-sorgu',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'same-origin',
    body:JSON.stringify({
      kullaniciAdi: EDM_AYAR.kullaniciAdi,
      sifre: EDM_AYAR.sifre,
      testMod: !!EDM_AYAR.testMod,
      tip: tip,
      no: no
    })
  }).then(function(r){return r.json();}).then(function(d){
    if(btn){btn.disabled=false;btn.textContent='🔍 EDM\'den Sorgula';}
    if(!d.success){
      if(sonucEl) sonucEl.innerHTML='<span style="color:#991b1b">❌ '+(d.error||'Sorgu başarısız')+'</span>';
      return;
    }
    var r=d.data||{};
    var aliasEl=document.getElementById('fat-alias');
    var tipBilgi=document.getElementById('fat-tip-bilgi');
    var tipHidden=document.getElementById('fat-yeni-tip');

    if(r.bulundu){
      // e-Fatura mükellefi
      if(sonucEl) sonucEl.innerHTML='<span style="color:#16a34a">✅ e-Fatura m\u00fckellefi bulundu: <b>'+r.unvan+'</b>'+(r.etiket?' \u00b7 '+r.etiket:'')+(r.adres||r.il||r.telefon||r.email?'<br><small style="color:#666">'+(r.adres?'Adres: '+r.adres+' | ':'')+(r.il?(r.ilce?r.ilce+'/':'')+r.il+' | ':'')+(r.telefon?'Tel: '+r.telefon+' | ':'')+(r.email?r.email:'')+'</small>':'')+'</span>';
      var mEl=document.getElementById('fat-musteri-adi');
      if(mEl) mEl.value=r.unvan||mEl.value||'';
      if(aliasEl) aliasEl.value=r.etiket||'';
      var vdEl=document.getElementById('fat-vergi-dairesi');
      if(vdEl && r.vergiDairesi) vdEl.value=r.vergiDairesi;
    // EDM'den gelen detay bilgilerini otomatik doldur
    var telEl=document.getElementById('fat-tel');
    var emailEl=document.getElementById('fat-email');
    var adresEl=document.getElementById('fat-adres');
    var ilEl=document.getElementById('fat-il');
    var ilceEl=document.getElementById('fat-ilce');
    if(telEl && (r.telefon||r.cepTelefon)) telEl.value=r.cepTelefon||r.telefon;
    if(emailEl && (r.email||r.kepEmail)) emailEl.value=r.email||r.kepEmail;
    if(adresEl && r.adres) adresEl.value=r.adres;
    if(ilEl && r.il) ilEl.value=r.il;
    if(ilceEl && r.ilce) ilceEl.value=r.ilce;
      if(tipBilgi) tipBilgi.innerHTML='✅ <b>e-Fatura</b> olarak kesilecek (müşteri GİB mükellefi)';
      if(tipBilgi) tipBilgi.style.color='#16a34a';
      if(tipHidden) tipHidden.value='EFATURA';
      if(typeof faturaTipiButonGuncelle==='function') faturaTipiButonGuncelle('EFATURA');
    } else {
      // Mükellef bulunamadı veya sorgu yapılamadı
      var isTC=(no.length===11);
      var mesajMetni=(r.mesaj||'Bulunamadı');
      // TC için backend sorguyu desteklemiyorsa anlaşılır mesaj
      if(isTC && mesajMetni.indexOf('sorgulama')>-1){
        if(sonucEl) sonucEl.innerHTML='<span style="color:#d97706">ℹ️ TC ile otomatik sorgu yapılamadı. Müşteriye sorun: e-Fatura mükellefi mi? Aşağıdan <b>manuel seçim</b> yapın.</span>';
      } else {
        if(sonucEl) sonucEl.innerHTML='<span style="color:#d97706">ℹ️ '+mesajMetni+' — mükellef değilse e-Arşiv, mükellef ise aşağıdan e-Fatura seçin</span>';
      }
      if(aliasEl) aliasEl.value='';
      if(tipBilgi) tipBilgi.innerHTML='📋 <b>e-Arşiv Fatura</b> olarak kesilecek (mükellef değilse — müşteri mükellef ise <b>"e-Fatura"</b> butonuna basın)';
      if(tipBilgi) tipBilgi.style.color='#d97706';
      if(tipHidden) tipHidden.value='EARSIV';
      if(typeof faturaTipiButonGuncelle==='function') faturaTipiButonGuncelle('EARSIV');
    }
  }).catch(function(err){
    if(btn){btn.disabled=false;btn.textContent='🔍 EDM\'den Sorgula';}
    if(sonucEl) sonucEl.innerHTML='<span style="color:#991b1b">❌ Bağlantı hatası: '+err.message+'</span>';
  });
}

/** Tutar/KDV hesap özetini güncelle */
function faturaTutarHesapla(){
  var tutar=parseFloat((document.getElementById('fat-tutar')||{}).value)||0;
  var kdvOrani=parseInt((document.getElementById('fat-kdv')||{}).value)||20;
  var kdvsiz=tutar/(1+kdvOrani/100);
  var kdvTutar=tutar-kdvsiz;
  var el=document.getElementById('fat-hesap-ozet');
  if(el){
    el.innerHTML=''
      +'<div style="display:flex;justify-content:space-between;padding:2px 0"><span>KDV\'siz Matrah:</span><b>₺'+kdvsiz.toLocaleString('tr-TR',{maximumFractionDigits:2})+'</b></div>'
      +'<div style="display:flex;justify-content:space-between;padding:2px 0"><span>KDV (%'+kdvOrani+'):</span><b style="color:#d97706">₺'+kdvTutar.toLocaleString('tr-TR',{maximumFractionDigits:2})+'</b></div>'
      +'<div style="display:flex;justify-content:space-between;padding:4px 0 2px;border-top:1px solid #f5d5b8;margin-top:4px"><span style="font-weight:700">Genel Toplam:</span><b style="color:var(--r);font-size:13px">₺'+tutar.toLocaleString('tr-TR',{maximumFractionDigits:2})+'</b></div>';
  }
}

// faturaYeniMusteriSec artık kullanılmıyor ama eski kodu kırmamak için tuttuk
function faturaYeniMusteriSec(){}

function faturaKes(){
  var a=window._fatAlici||{};
  var o=window._fatOdeme||{};
  var kalemler=window._fatKalemler||[];

  // Validasyonlar
  if(!a.musteri){toast('M\u00fc\u015fteri ad\u0131/unvan zorunlu','red');return;}
  if(!kalemler.length||!kalemler[0].ad){toast('En az bir fatura kalemi gerekli','red');return;}
  if(a.musteriTip==='bireysel' && a.vkn && a.vkn.length!==11){toast('TC 11 hane olmal\u0131 (veya bo\u015f b\u0131rak\u0131n)','red');return;}
  if(a.musteriTip==='kurumsal'){
    if(!a.vkn){toast('Kurumsal fatura i\u00e7in VKN zorunlu','red');return;}
    if(a.vkn.length!==10){toast('VKN 10 hane olmal\u0131','red');return;}
    if(!a.vergiDairesi){toast('Kurumsal m\u00fc\u015fteri i\u00e7in vergi dairesi zorunlu','red');return;}
  }

  // Hesaplamalar
  var araToplam=0,toplamKdv=0;
  var ublKalemler=kalemler.map(function(k){
    var matrah=k.adet*k.fiyat;
    var kdv=matrah*(k.kdv/100);
    araToplam+=matrah;
    toplamKdv+=kdv;
    return {ad:k.ad,adet:k.adet,fiyat:k.fiyat,kdv:k.kdv,birim:k.birim||'Adet'};
  });

  // Iskonto
  var iskTip=window._fatIskontoTip||'yuzde';
  var iskDeg=window._fatGenelIskonto||0;
  var iskTutar=(iskTip==='yuzde')?(araToplam*iskDeg/100):iskDeg;
  var matrahSonra=araToplam-iskTutar;
  var kdvSonra=matrahSonra>0?(toplamKdv*(matrahSonra/araToplam)):0;
  var genelToplam=matrahSonra+kdvSonra;

  var bugun=new Date();
  var tarih=bugun.getDate().toString().padStart(2,'0')+'.'+(bugun.getMonth()+1).toString().padStart(2,'0')+'.'+bugun.getFullYear();
  var faturaNo=edmFaturaSeri()+bugun.getFullYear()+String(Date.now()).slice(-6);

  var hizmetOzet=kalemler.map(function(k){return k.ad;}).join(', ');

  var fatura={
    faturaNo: faturaNo,
    faturaTipi: a.faturaTipi||'EARSIV',
    musteri: a.musteri,
    musteriTip: a.musteriTip||'bireysel',
    vknTckn: a.vkn||'',
    alias: a.alias||'',
    tel: a.tel||'',
    email: a.email||'',
    adres: a.adres||'',
    il: a.il||'',
    ilce: a.ilce||'',
    vergiDairesi: a.vergiDairesi||'',
    senaryo: a.senaryo||'TEMEL',
    tarih: tarih,
    hizmet: hizmetOzet,
    kalemler: ublKalemler,
    kdvsizTutar: Math.round(matrahSonra*100)/100,
    kdvTutar: Math.round(kdvSonra*100)/100,
    kdvOrani: kalemler[0]?kalemler[0].kdv:20,
    toplamTutar: Math.round(genelToplam*100)/100,
    iskonto: iskTutar>0?{tip:iskTip,deger:iskDeg,tutar:Math.round(iskTutar*100)/100}:null,
    odemeYontemi: o.yontem||'',
    odemeVadesi: o.vade||'',
    iban: o.iban||'',
    plaka: o.plaka||'',
    durum: 'KESILDI',
    edmGonderilen: false,
    edmUuid: '',
    edmEttn: '',
    edmMesaj: '',
    edmTestMod: false,
    not: o.not||'',
    randevuId: o.randevuId||''
  };

  FATURALAR.unshift(fatura);
  faturaKaydet();

  var ovl=document.getElementById('fatura-yeni-ovl');
  if(ovl) ovl.remove();
  if(typeof faturaSayfasiYukle==='function') faturaSayfasiYukle();

  // Ayarlar -> Fatura tablosunu da guncelle
  var edmTb=document.getElementById('edm-tablo');
  if(edmTb && typeof edmTbodyHTML==='function'){edmTb.innerHTML=edmTbodyHTML();if(typeof saFaturaListenerBagla==='function')saFaturaListenerBagla();}

  toast('\u2713 Fatura '+faturaNo+' yerel kaydedildi','green');
  var yeniIdx=0;
  setTimeout(function(){ faturaOnizlemeGoster(yeniIdx); }, 150);

  // Temizlik
  window._fatKalemler=null;window._fatAlici=null;window._fatOdeme=null;
}

/** Fatura önizleme modalı - XSLT render ile gerçek görünümü göster */
function faturaOnizlemeGoster(idx){
  var f=FATURALAR[idx];
  if(!f) return;
  var html = faturaXSLTRender(f);

  var ovl=document.createElement('div');
  ovl.id='fat-onizleme-ovl';
  ovl.style.cssText='position:fixed;inset:0;z-index:985;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px';
  ovl.onclick=function(e){if(e.target===ovl)ovl.remove();};

  // Yazdır/Mail/WhatsApp butonları - her durumda görünür
  var yardimciButonlar=''
    +'<button type="button" onclick="faturaYazdir('+idx+')" title="Sadece fatura içeriğini yazdır" style="padding:9px 12px;border:1.5px solid var(--bd);border-radius:8px;background:#fff;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">🖨️ YAZDIR</button>'
    +'<button type="button" onclick="faturaMailGonder('+idx+')" title="E-posta ile gönder" style="padding:9px 12px;border:1.5px solid #2563EB;border-radius:8px;background:rgba(37,99,235,.08);color:#2563EB;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">✉️ MAİL</button>'
    +'<button type="button" onclick="faturaWhatsappGonder('+idx+')" title="WhatsApp ile gönder" style="padding:9px 12px;border:1.5px solid #25D366;border-radius:8px;background:rgba(37,211,102,.08);color:#128C3D;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">📱 WHATSAPP</button>';

  var butonlar='';
  if(f.durum==='KESILDI' || f.durum==='HATA'){
    butonlar=''
      +yardimciButonlar
      +'<div style="flex:1"></div>'
      +'<button type="button" onclick="document.getElementById(\'fat-onizleme-ovl\').remove()" style="padding:11px 16px;border:1.5px solid var(--bd);border-radius:8px;background:#fff;font-family:Bebas Neue,sans-serif;font-size:12px;cursor:pointer;letter-spacing:1px;white-space:nowrap">SONRA</button>'
      +'<button type="button" onclick="faturaEDMGonder('+idx+');document.getElementById(\'fat-onizleme-ovl\').remove()" style="padding:11px 20px;border:none;border-radius:8px;background:#1a6b3c;color:#fff;font-family:Bebas Neue,sans-serif;font-size:13px;letter-spacing:1px;cursor:pointer;white-space:nowrap">📤 EDM\'E GÖNDER</button>';
  } else {
    butonlar=''
      +yardimciButonlar
      +'<div style="flex:1"></div>'
      +'<button type="button" onclick="document.getElementById(\'fat-onizleme-ovl\').remove()" style="padding:11px 20px;border:1.5px solid var(--bd);border-radius:8px;background:#fff;font-family:Bebas Neue,sans-serif;font-size:13px;cursor:pointer;letter-spacing:1px">KAPAT</button>';
  }

  ovl.innerHTML='<div style="background:#fff;border-radius:14px;max-width:900px;width:100%;height:95vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.35)">'
    +'<div style="background:var(--ink);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">'
      +'<div style="font-family:Bebas Neue,sans-serif;font-size:18px;letter-spacing:2px;color:#fff">📄 FATURA ÖNİZLEME · '+f.faturaNo+'</div>'
      +'<div onclick="document.getElementById(\'fat-onizleme-ovl\').remove()" style="cursor:pointer;color:#888;font-size:26px">&times;</div>'
    +'</div>'
    +'<div style="flex:1;overflow:auto;background:#e5e7eb;min-height:0;display:flex;justify-content:center;padding:16px">'
      +'<iframe id="fat-onizleme-iframe" style="width:100%;max-width:820px;min-height:1100px;border:none;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.15);border-radius:4px"></iframe>'
    +'</div>'
    +'<div style="padding:12px 16px;display:flex;gap:8px;border-top:1px solid var(--bd);flex-shrink:0;background:#fff;flex-wrap:wrap;align-items:center">'
      +butonlar
    +'</div>'
  +'</div>';
  document.body.appendChild(ovl);
  // iframe içeriğini yaz, sonra yüksekliğini içerik kadar ayarla
  setTimeout(function(){
    var ifr=document.getElementById('fat-onizleme-iframe');
    if(!ifr) return;
    ifr.contentDocument.open();
    ifr.contentDocument.write(html);
    ifr.contentDocument.close();
    // İçerik yüklenince iframe yüksekliğini otomatik ayarla (A4 minimum)
    setTimeout(function(){
      try{
        var doc=ifr.contentDocument;
        if(doc && doc.body){
          var h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 1100);
          ifr.style.height = h + 'px';
        }
      }catch(e){}
    }, 150);
  }, 30);
}

/** Sadece fatura içeriğini yazdır (modal başlığı/butonları dahil değil) */
function faturaYazdir(idx){
  var f=FATURALAR[idx];
  if(!f) return;
  // Önizleme modal açıksa iframe'den direkt yazdır
  var ifr=document.getElementById('fat-onizleme-iframe');
  if(ifr && ifr.contentWindow){
    try{
      ifr.contentWindow.focus();
      ifr.contentWindow.print();
      return;
    }catch(e){
      console.warn('iframe print hatası:',e);
    }
  }
  // Fallback: yeni pencerede aç ve yazdır
  var html=faturaXSLTRender(f);
  var w=window.open('','_blank','width=900,height=1100');
  w.document.write(html);
  w.document.close();
  setTimeout(function(){ try{ w.focus(); w.print(); }catch(e){} },400);
}

/** Faturayı PDF olarak indir (tarayıcının yazdır→PDF kaydet özelliği) 
 *  Dosya adı: faturaNo.pdf
 */
function faturaPDFIndir(idx){
  var f=FATURALAR[idx];
  if(!f) return;
  var html=faturaXSLTRender(f);
  // Yeni pencere aç, dosya adını title olarak set et (tarayıcı PDF kaydederken title kullanır)
  var w=window.open('','_blank','width=900,height=1100');
  if(!w){ toast('Pop-up engellendi. Tarayıcı pop-up iznini verin.','red'); return; }
  // HTML'deki <title>'ı fatura numarası yap (PDF dosya adı önerisi)
  if(html.indexOf('<title>')>-1){
    html=html.replace(/<title>[^<]*<\/title>/,'<title>'+f.faturaNo+'</title>');
  } else if(html.indexOf('</head>')>-1){
    html=html.replace('</head>','<title>'+f.faturaNo+'</title></head>');
  }
  w.document.write(html);
  w.document.close();
  w.document.title=f.faturaNo; // Fallback
  setTimeout(function(){
    try{
      w.focus();
      w.print(); // Tarayıcı yazdır diyaloğu açılır, kullanıcı "PDF Olarak Kaydet" seçer
    }catch(e){
      console.warn('print hatası:',e);
    }
  },500);
}

/** Faturayı WhatsApp ile gönder - önce PDF indir, sonra WhatsApp aç */
function faturaWhatsappGonder(idx){
  var f=FATURALAR[idx];
  if(!f) return;
  var tel=(f.tel||'').trim().replace(/[^0-9+]/g,'');
  if(!tel){
    var girilen=prompt('Müşteri telefon numarası (başında 90 olmadan, örn: 5551234567):','');
    if(!girilen) return;
    tel=girilen.trim().replace(/[^0-9+]/g,'');
  }
  // 0 ile başlıyorsa at, 90 yoksa ekle
  if(tel.charAt(0)==='0') tel=tel.substring(1);
  if(tel.charAt(0)==='+') tel=tel.substring(1);
  if(!tel.startsWith('90')) tel='90'+tel;

  // Adım 1: PDF indir (yazdır penceresi açılır, kullanıcı "PDF Olarak Kaydet" seçer)
  faturaPDFIndir(idx);

  // Adım 2: 2 saniye sonra WhatsApp'ı aç (kullanıcı PDF'i kaydetmeye vakit bulsun)
  setTimeout(function(){
    var tutarStr='₺'+(f.toplamTutar||0).toLocaleString('tr-TR');
    var mesaj=''
      +'Merhaba '+(f.musteri||'')+',\n\n'
      +'Faturanızın bilgileri:\n'
      +'📄 *Fatura No:* '+f.faturaNo+'\n'
      +'📅 *Tarih:* '+f.tarih+'\n'
      +'💰 *Tutar:* '+tutarStr+'\n'
      +(f.edmEttn?'🔖 *ETTN:* '+f.edmEttn+'\n':'')
      +'\nFatura PDF\'i ektedir.\n\n'
      +'_AUTONAX_';
    var url='https://wa.me/'+tel+'?text='+encodeURIComponent(mesaj);
    window.open(url,'_blank');
  }, 2000);

  // Kullanıcıya net talimat
  toast('📄 PDF yazdırma açıldı → "PDF Olarak Kaydet" seçin (dosya adı: '+f.faturaNo+') → WhatsApp açılınca 📎 ile ekleyin','green');
}

/** Faturayı e-posta ile gönder - önce PDF indir, sonra mail aç */
function faturaMailGonder(idx){
  var f=FATURALAR[idx];
  if(!f) return;
  var mail=(f.email||'').trim();
  if(!mail){
    var girilen=prompt('Müşteri e-posta adresi girin:','');
    if(!girilen) return;
    mail=girilen.trim();
  }

  // Adım 1: PDF indir
  faturaPDFIndir(idx);

  // Adım 2: 2 saniye sonra mail uygulamasını aç
  setTimeout(function(){
    var konu='Faturanız · '+f.faturaNo+' · AUTONAX';
    var tutarStr='₺'+(f.toplamTutar||0).toLocaleString('tr-TR');
    var govde=''
      +'Sayın '+(f.musteri||'')+','+'\n\n'
      +'Faturanızın bilgileri aşağıdadır:\n\n'
      +'Fatura No: '+f.faturaNo+'\n'
      +'Tarih: '+f.tarih+'\n'
      +'Tutar: '+tutarStr+' (KDV Dahil)\n'
      +(f.edmEttn?'ETTN: '+f.edmEttn+'\n':'')
      +'\n'
      +'Fatura PDF\'i ekte gönderilmektedir. Herhangi bir sorunuz olursa lütfen bize ulaşın.\n\n'
      +'İyi günler dileriz,\n'
      +'AUTONAX';
    var url='mailto:'+encodeURIComponent(mail)+'?subject='+encodeURIComponent(konu)+'&body='+encodeURIComponent(govde);
    window.location.href=url;
  }, 2000);

  toast('📄 PDF yazdırma açıldı → "PDF Olarak Kaydet" seçin (dosya adı: '+f.faturaNo+') → E-posta açılınca 📎 ile ekleyin','green');
}

/** Fatura EDM'e gönder (tek fatura) */
function faturaEDMGonder(idx){
  var f=FATURALAR[idx];
  if(!f) return;
  if(f.durum==='GONDERILDI' || f.durum==='ONAYLANDI'){
    toast('Bu fatura zaten gönderilmiş','red');
    return;
  }
  // Merkezi EDM ayar kontrolü (gönderim için tam ayarlar gerekli)
  var ayarDurum=edmAyarKontrol('gonderim');
  if(!ayarDurum.ok){
    edmAyarHatalariGoster(ayarDurum);
    return;
  }

  var faturaNo=f.faturaNo;
  FATURALAR[idx].durum='KESILIYOR';
  faturaKaydet();
  if(typeof faturaSayfasiYukle==='function') faturaSayfasiYukle();

  fetch('/api/edm/gonder',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'same-origin',
    body:JSON.stringify({
      kullaniciAdi: (EDM_AYAR||{}).kullaniciAdi||'',
      sifre: (EDM_AYAR||{}).sifre||'',
      testMod: (EDM_AYAR||{}).testMod!==false,
      gondericEtiketi: (EDM_AYAR||{}).gondericEtiketi||'',
      vknTckn: (EDM_AYAR||{}).vknTckn||'',
      xsltEarsiv: (EDM_AYAR||{}).xsltEarsiv||null,
      xsltEfatura: (EDM_AYAR||{}).xsltEfatura||null,
      fatura: f
    })
  }).then(function(r){return r.json();}).then(function(d){
    // faturaNo ile yeniden bul (liste değişmiş olabilir)
    var i=-1;
    for(var k=0;k<FATURALAR.length;k++){ if(FATURALAR[k].faturaNo===faturaNo){i=k;break;} }
    if(i<0) return;

    if(d.success && d.data && d.data.basarili){
      FATURALAR[i].durum='GONDERILDI';
      FATURALAR[i].edmGonderilen=true;
      FATURALAR[i].edmUuid=d.data.faturaUuid||'';
      FATURALAR[i].edmEttn=d.data.ettn||'';
      FATURALAR[i].edmMesaj=d.data.mesaj||'';
      FATURALAR[i].edmTestMod=!!d.data.testMod;
      faturaKaydet();

      // Randevuya fatura bilgisini ekle
      if(FATURALAR[i].randevuId){
        RANDEVULAR.forEach(function(r){
          if(r.id===FATURALAR[i].randevuId){
            r.faturaNo=faturaNo;
            r.faturaDurum='GONDERILDI';
            if(typeof dbRandevuKaydet==='function') dbRandevuKaydet(r);
          }
        });
      } else {
        RANDEVULAR.forEach(function(r){
          if(r.musteri===FATURALAR[i].musteri && !r.faturaNo){
            r.faturaNo=faturaNo;
            r.faturaDurum='GONDERILDI';
            if(typeof dbRandevuKaydet==='function') dbRandevuKaydet(r);
          }
        });
      }
      storageKaydet();
      if(typeof faturaSayfasiYukle==='function') faturaSayfasiYukle();

      var durumEtiket=d.data.testMod?'🧪 TEST':'✓';
      toast(durumEtiket+' Fatura '+faturaNo+' EDM\'e gönderildi','green');
    } else {
      FATURALAR[i].durum='HATA';
      FATURALAR[i].edmMesaj=(d.data&&d.data.mesaj)||d.error||'Bilinmeyen hata';
      faturaKaydet();
      if(typeof faturaSayfasiYukle==='function') faturaSayfasiYukle();
      toast('⚠️ EDM gönderimi başarısız: '+((d.data&&d.data.mesaj)||d.error||''),'red');
    }
  }).catch(function(err){
    var i=-1;
    for(var k=0;k<FATURALAR.length;k++){ if(FATURALAR[k].faturaNo===faturaNo){i=k;break;} }
    if(i>=0){
      FATURALAR[i].durum='HATA';
      FATURALAR[i].edmMesaj='Bağlantı hatası: '+err.message;
      faturaKaydet();
    }
    if(typeof faturaSayfasiYukle==='function') faturaSayfasiYukle();
    toast('❌ EDM bağlantı hatası: '+err.message,'red');
  });
}

/** Toplu EDM gönderim - seçili olanları sırayla gönder */
function faturaTopluEDMGonder(){
  var secilenNolar=[];
  document.querySelectorAll('input.fat-secim:checked').forEach(function(cb){
    var n=cb.getAttribute('data-fno');
    if(n) secilenNolar.push(n);
  });
  if(!secilenNolar.length){
    toast('Gönderilecek fatura seçmediniz','red');
    return;
  }
  // Merkezi EDM ayar kontrolü
  var ayarDurum=edmAyarKontrol('gonderim');
  if(!ayarDurum.ok){
    edmAyarHatalariGoster(ayarDurum);
    return;
  }
  var modEtiket=edmTestMi()?'🧪 TEST MODU':'✅ CANLI MOD';
  if(!confirm(secilenNolar.length+' fatura EDM\'e gönderilecek ('+modEtiket+'). Devam edilsin mi?')) return;

  var gonderilen=0, hatali=0;
  secilenNolar.forEach(function(no){
    var idx=-1;
    for(var k=0;k<FATURALAR.length;k++){ if(FATURALAR[k].faturaNo===no){idx=k;break;} }
    if(idx<0) return;
    var f=FATURALAR[idx];
    if(f.durum==='GONDERILDI' || f.durum==='ONAYLANDI'){ hatali++; return; }
    // Tek tek gönder (paralel değil, sıralı — backend'i bunaltmamak için)
    faturaEDMGonder(idx);
    gonderilen++;
  });
  toast(gonderilen+' fatura gönderim için işleme alındı'+(hatali>0?' ('+hatali+' atlandı - zaten gönderilmiş)':''),'green');
}

/** Header checkbox ile tümünü seç/kaldır */
function faturaTumunuSec(checked){
  document.querySelectorAll('input.fat-secim').forEach(function(cb){
    cb.checked = checked;
  });
  faturaSecimDegisti();
}

/** Seçim değişince toplu gönder butonunu göster/gizle + sayaç güncelle */
function faturaSecimDegisti(){
  var secilenler=document.querySelectorAll('input.fat-secim:checked');
  var btn=document.getElementById('fat-toplu-gonder-btn');
  if(!btn) return;
  if(secilenler.length>0){
    btn.style.display='inline-block';
    btn.textContent='📤 Seçilenleri EDM\'e Gönder ('+secilenler.length+')';
  } else {
    btn.style.display='none';
    btn.textContent='📤 Seçilenleri EDM\'e Gönder';
  }
  // Header checkbox senkronize
  var allCb=document.getElementById('fat-secim-all');
  var allSecim=document.querySelectorAll('input.fat-secim');
  if(allCb){
    if(allSecim.length===0){ allCb.checked=false; allCb.indeterminate=false; }
    else if(secilenler.length===0){ allCb.checked=false; allCb.indeterminate=false; }
    else if(secilenler.length===allSecim.length){ allCb.checked=true; allCb.indeterminate=false; }
    else { allCb.checked=false; allCb.indeterminate=true; }
  }
}

/** KESILDI/HATA durumundaki faturayi duzenle - wizard ile ac */
function faturaDuzenle(idx){
  var f=FATURALAR[idx];
  if(!f) return;
  if(f.durum!=='KESILDI' && f.durum!=='HATA'){
    toast('Sadece bekleyen veya hatali faturalar duzenlenebilir','red');
    return;
  }

  // Eskisini sil (yeni kayit olusturulacak)
  var silinen=FATURALAR.splice(idx,1)[0];
  faturaKaydet();
  if(typeof faturaSayfasiYukle==='function') faturaSayfasiYukle();

  // Wizard ac - onceki fatura bilgileriyle
  setTimeout(function(){
    faturaYeniAc({
      musteri: silinen.musteri,
      tel: silinen.tel,
      hizmet: silinen.hizmet,
      tutar: silinen.toplamTutar,
      randevuId: silinen.randevuId||'',
      plaka: silinen.plaka||''
    });
    // Form DOM yerlesince ek alanlari doldur
    setTimeout(function(){
      var set=function(id,val){var el=document.getElementById(id);if(el)el.value=val||'';};
      if(silinen.vknTckn){
        set('fat-vkn',silinen.vknTckn);
        if(typeof faturaVknOtoAlgila==='function') faturaVknOtoAlgila();
        if(typeof fatVdGoster==='function') fatVdGoster();
      }
      set('fat-musteri-adi',silinen.musteri);
      set('fat-tel',silinen.tel);
      set('fat-email',silinen.email);
      set('fat-adres',silinen.adres);
      set('fat-il',silinen.il);
      set('fat-ilce',silinen.ilce);
      set('fat-vergi-dairesi',silinen.vergiDairesi||'');
      // Fatura tipi geri yukle
      var tipH=document.getElementById('fat-yeni-tip');
      var mTipH=document.getElementById('fat-musteri-tip');
      var aliasH=document.getElementById('fat-alias');
      if(silinen.faturaTipi && tipH){
        tipH.value=silinen.faturaTipi;
        if(typeof faturaTipiButonGuncelle==='function') faturaTipiButonGuncelle(silinen.faturaTipi);
      }
      if(silinen.musteriTip && mTipH) mTipH.value=silinen.musteriTip;
      if(silinen.alias && aliasH) aliasH.value=silinen.alias;
      // Baslik guncelle
      var baslik=document.querySelector('#fatura-yeni-ovl div[style*="Bebas Neue"]');
      if(baslik && baslik.textContent.indexOf('FATURA')>-1){
        baslik.textContent='\ud83d\udcdd FATURA D\u00dcZENLE \u00b7 '+silinen.faturaNo;
      }
    },120);
  },150);
}

/** Fatura yeniden gönder (hata olmuşsa) */
function faturaYenidenGonder(idx){
  var f=FATURALAR[idx];
  if(!f) return;
  if(!confirm('Fatura "'+f.faturaNo+'" EDM\'e tekrar gönderilsin mi?')) return;

  FATURALAR[idx].durum='KESILIYOR';
  faturaKaydet();
  if(typeof faturaSayfasiYukle==='function') faturaSayfasiYukle();

  fetch('/api/edm/gonder',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'same-origin',
    body:JSON.stringify({
      kullaniciAdi: (EDM_AYAR||{}).kullaniciAdi||'',
      sifre: (EDM_AYAR||{}).sifre||'',
      testMod: (EDM_AYAR||{}).testMod!==false,
      gondericEtiketi: (EDM_AYAR||{}).gondericEtiketi||'',
      vknTckn: (EDM_AYAR||{}).vknTckn||'',
      xsltEarsiv: (EDM_AYAR||{}).xsltEarsiv||null,
      xsltEfatura: (EDM_AYAR||{}).xsltEfatura||null,
      fatura: f
    })
  }).then(function(r){return r.json();}).then(function(d){
    if(d.success && d.data && d.data.basarili){
      FATURALAR[idx].durum='GONDERILDI';
      FATURALAR[idx].edmGonderilen=true;
      FATURALAR[idx].edmUuid=d.data.faturaUuid||'';
      FATURALAR[idx].edmEttn=d.data.ettn||'';
      FATURALAR[idx].edmMesaj=d.data.mesaj||'';
      FATURALAR[idx].edmTestMod=!!d.data.testMod;
      toast('✓ Fatura EDM\'e gönderildi','green');
    } else {
      FATURALAR[idx].durum='HATA';
      FATURALAR[idx].edmMesaj=(d.data&&d.data.mesaj)||d.error||'Bilinmeyen hata';
      toast('❌ EDM gönderimi yine başarısız','red');
    }
    faturaKaydet();
    if(typeof faturaSayfasiYukle==='function') faturaSayfasiYukle();
  }).catch(function(err){
    FATURALAR[idx].durum='HATA';
    FATURALAR[idx].edmMesaj='Bağlantı hatası: '+err.message;
    faturaKaydet();
    if(typeof faturaSayfasiYukle==='function') faturaSayfasiYukle();
    toast('❌ Bağlantı hatası','red');
  });
}

function faturaIptal(i){
  var f = FATURALAR[i];
  if(!f) return;
  
  // EDM'ye gonderilmis fatura ise double confirm
  var edmMsg = (f.edmUUID && EDM_AYAR && EDM_AYAR.kullaniciAdi)
    ? '\n\nBu fatura EDM\'ye g\u00f6nderilmi\u015f. \u0130ptal EDM\'ye de bildirilecek.'
    : '';
  if(!confirm('Bu faturay\u0131 iptal etmek istedi\u011finize emin misiniz?' + edmMsg)) return;

  // EDM'ye gonderilmis fatura ise otomatik iptal bildir
  if(f.edmUUID && EDM_AYAR && EDM_AYAR.kullaniciAdi){
    toast('EDM\'ye iptal g\u00f6nderiliyor...','blue');
    fetch('/api/edm/iptal',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        kullaniciAdi: EDM_AYAR.kullaniciAdi,
        sifre: EDM_AYAR.sifre,
        uuid: f.edmUUID,
        faturaNo: f.faturaNo || f.no
      })
    }).then(function(r){return r.json();}).then(function(d){
      if(d.success){
        f.durum='IPTAL'; f.edmIptalDurum='EDM_IPTAL';
        faturaKaydet(); faturaSayfasiYukle();
        toast('\u2705 Fatura EDM\'de de iptal edildi','green');
      } else {
        // EDM iptal basarisiz - yine de yerel iptal yap
        f.durum='IPTAL'; f.edmIptalDurum='EDM_HATA';
        f.edmIptalHata = d.error || 'Bilinmeyen hata';
        faturaKaydet(); faturaSayfasiYukle();
        toast('\u26a0\ufe0f Fatura yerel iptal edildi ama EDM hatasi: ' + (d.error||''), 'red');
      }
    }).catch(function(e){
      f.durum='IPTAL'; f.edmIptalDurum='EDM_HATA';
      faturaKaydet(); faturaSayfasiYukle();
      toast('\u26a0\ufe0f EDM ba\u011flant\u0131 hatas\u0131, fatura yerel iptal edildi','red');
    });
  } else {
    // EDM'ye gonderilmemis - sadece yerel iptal
    f.durum='IPTAL';
    faturaKaydet(); faturaSayfasiYukle();
    toast('Fatura iptal edildi','red');
  }
}

/* ════════════ UBL-TR 1.2 XML ÜRETİCİ ════════════
 * Fatura objesinden GİB standardına uygun UBL-TR 1.2 XML üretir.
 * Bu XML, EDM_AYAR'da yüklü XSLT şablonuyla birleştirilerek önizleme/PDF üretilir.
 */

/* ════════════ QR KOD ÜRETİCİ (KAZUHIKO ARASE - MIT LISANS) ════════════
 * Kompakt QR encoder - Model 2, versiyon 1-10 destekli.
 * Fatura QR kodu için yeterli (genelde versiyon 5-7 kullanılır).
 * Kaynak: github.com/kazuhikoarase/qrcode-generator (MIT)
 */
var qrcodeMini = (function(){
  var PAD0=0xEC,PAD1=0x11;
  var qrToSjisFn=function(c){return c.charCodeAt(0);};
  var qr={};
  qr.stringToBytes=function(s){
    var bytes=[];
    for(var i=0;i<s.length;i++){
      var c=s.charCodeAt(i);
      if(c<0x80) bytes.push(c);
      else if(c<0x800){ bytes.push(0xC0|(c>>6)); bytes.push(0x80|(c&0x3F)); }
      else if(c<0x10000){ bytes.push(0xE0|(c>>12)); bytes.push(0x80|((c>>6)&0x3F)); bytes.push(0x80|(c&0x3F)); }
      else { bytes.push(0xF0|(c>>18)); bytes.push(0x80|((c>>12)&0x3F)); bytes.push(0x80|((c>>6)&0x3F)); bytes.push(0x80|(c&0x3F)); }
    }
    return bytes;
  };
  // Galois Field (GF256) exp/log tabloları - Reed-Solomon için
  var EXP=new Array(256),LOG=new Array(256);
  (function(){
    for(var i=0;i<8;i++) EXP[i]=1<<i;
    for(var i=8;i<256;i++) EXP[i]=EXP[i-4]^EXP[i-5]^EXP[i-6]^EXP[i-8];
    for(var i=0;i<255;i++) LOG[EXP[i]]=i;
  })();
  var gMul=function(x,y){ if(x===0||y===0) return 0; return EXP[(LOG[x]+LOG[y])%255]; };

  // Polinom - RS için
  function Poly(num,shift){ this.num=[]; var offset=0; while(offset<num.length && num[offset]===0) offset++; for(var i=0;i<num.length-offset;i++) this.num[i]=num[i+offset]; for(var i=0;i<shift;i++) this.num.push(0); }
  Poly.prototype.get=function(i){return this.num[i];};
  Poly.prototype.len=function(){return this.num.length;};
  Poly.prototype.multiply=function(e){
    var num=new Array(this.len()+e.len()-1);
    for(var i=0;i<num.length;i++) num[i]=0;
    for(var i=0;i<this.len();i++) for(var j=0;j<e.len();j++) num[i+j]^=gMul(this.get(i),e.get(j));
    return new Poly(num,0);
  };
  Poly.prototype.mod=function(e){
    if(this.len()-e.len()<0) return this;
    var ratio=LOG[this.get(0)]^LOG[e.get(0)];
    var num=new Array(this.len());
    for(var i=0;i<this.len();i++) num[i]=this.get(i);
    for(var i=0;i<e.len();i++) num[i]^=gMul(e.get(i),EXP[(LOG[this.get(0)]+255-LOG[e.get(0)])%255+ratio-ratio]);
    var offset=0; while(offset<num.length && num[offset]===0) offset++;
    var trimmed=num.slice(offset);
    return new Poly(trimmed,0).mod(e);
  };
  // Basit mod (iteratif)
  Poly.prototype.modIter=function(e){
    var num=this.num.slice();
    while(num.length>=e.len()){
      var coef=num[0];
      if(coef===0){ num.shift(); continue; }
      var logRatio=LOG[coef];
      for(var i=0;i<e.len();i++){ num[i]^=EXP[(LOG[e.get(i)]+logRatio)%255]; }
      num.shift();
    }
    return new Poly(num,0);
  };

  // RS generator polynomial
  function rsBlockPoly(ecCount){
    var p=new Poly([1],0);
    for(var i=0;i<ecCount;i++) p=p.multiply(new Poly([1,EXP[i]],0));
    return p;
  }

  // QR versiyon tablosu (1-10) - hata düzeltme seviyesi M (Medium)
  // [totalDataBytes, ecBytesPerBlock, numBlocks, dataBytesPerBlock]
  var VERS_M=[
    null,
    [16,10,1,16],[28,16,1,28],[44,26,1,44],[64,18,2,32],[86,24,2,43],
    [108,16,4,27],[124,18,4,31],[154,22,4,38],[182,22,5,36],[216,26,5,43]
  ];

  var BLOCK_MASKS=[
    function(i,j){return (i+j)%2===0;},
    function(i,j){return i%2===0;},
    function(i,j){return j%3===0;},
    function(i,j){return (i+j)%3===0;},
    function(i,j){return (Math.floor(i/2)+Math.floor(j/3))%2===0;},
    function(i,j){return (i*j)%2+(i*j)%3===0;},
    function(i,j){return ((i*j)%2+(i*j)%3)%2===0;},
    function(i,j){return ((i+j)%2+(i*j)%3)%2===0;}
  ];

  function QR(){
    this.modules=null; this.moduleCount=0; this.data=[];
  }
  QR.prototype.addData=function(data){
    var bytes=qr.stringToBytes(data);
    this.data=bytes;
  };
  QR.prototype.make=function(){
    var len=this.data.length;
    var ver=1;
    for(var v=1;v<=10;v++){
      var info=VERS_M[v];
      var totalData=info[3]*info[2];
      // 4 bit mode + 8/16 bit length + 8 bit per byte
      var lenBits=(v<10)?8:16;
      var bitsNeeded=4+lenBits+len*8;
      if(bitsNeeded<=totalData*8){ ver=v; break; }
      if(v===10 && bitsNeeded>totalData*8) throw new Error('QR veri çok uzun');
    }
    this.version=ver;
    this.moduleCount=ver*4+17;
    // Init matrix
    this.modules=new Array(this.moduleCount);
    for(var i=0;i<this.moduleCount;i++){
      this.modules[i]=new Array(this.moduleCount);
      for(var j=0;j<this.moduleCount;j++) this.modules[i][j]=null;
    }
    this._setupPositionProbePattern(0,0);
    this._setupPositionProbePattern(this.moduleCount-7,0);
    this._setupPositionProbePattern(0,this.moduleCount-7);
    this._setupPositionAdjustPattern();
    this._setupTimingPattern();
    this._setupTypeInfo(0);
    if(ver>=7) this._setupTypeNumber();
    // Data
    var info=VERS_M[ver];
    var totalData=info[3]*info[2]; // bytes
    var bitStream=this._buildBitStream(totalData);
    var dataCodewords=this._interleaveDataAndEC(bitStream,info);
    this._mapDataToMatrix(dataCodewords);
    // Mask selection (en düşük penalty)
    var bestMask=0,minPen=999999999;
    for(var m=0;m<8;m++){
      this._applyMask(m,true);
      this._setupTypeInfo(m);
      var pen=this._getLostPoint();
      this._applyMask(m,true); // undo
      if(pen<minPen){ minPen=pen; bestMask=m; }
    }
    this._applyMask(bestMask,false);
    this._setupTypeInfo(bestMask);
  };
  QR.prototype._setupPositionProbePattern=function(r,c){
    for(var i=-1;i<=7;i++){
      if(r+i<0||r+i>=this.moduleCount) continue;
      for(var j=-1;j<=7;j++){
        if(c+j<0||c+j>=this.moduleCount) continue;
        this.modules[r+i][c+j]=((i>=0&&i<=6)&&(j===0||j===6))||((j>=0&&j<=6)&&(i===0||i===6))||((i>=2&&i<=4)&&(j>=2&&j<=4));
      }
    }
  };
  QR.prototype._setupPositionAdjustPattern=function(){
    var POS=[[],[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
    var pos=POS[this.version];
    for(var i=0;i<pos.length;i++) for(var j=0;j<pos.length;j++){
      var r=pos[i],c=pos[j];
      if(this.modules[r][c]!==null) continue;
      for(var ri=-2;ri<=2;ri++) for(var ci=-2;ci<=2;ci++){
        this.modules[r+ri][c+ci]=(ri===-2||ri===2||ci===-2||ci===2||(ri===0&&ci===0));
      }
    }
  };
  QR.prototype._setupTimingPattern=function(){
    for(var r=8;r<this.moduleCount-8;r++){ if(this.modules[r][6]!==null) continue; this.modules[r][6]=(r%2===0); }
    for(var c=8;c<this.moduleCount-8;c++){ if(this.modules[6][c]!==null) continue; this.modules[6][c]=(c%2===0); }
  };
  QR.prototype._setupTypeInfo=function(mask){
    var TYPE_INFO_PATTERNS_M=[0x5412,0x5125,0x5E7C,0x5B4B,0x45F9,0x40CE,0x4F97,0x4AA0];
    var bits=TYPE_INFO_PATTERNS_M[mask];
    for(var i=0;i<15;i++){
      var mod=((bits>>i)&1)===1;
      if(i<6) this.modules[i][8]=mod;
      else if(i<8) this.modules[i+1][8]=mod;
      else this.modules[this.moduleCount-15+i][8]=mod;
      if(i<8) this.modules[8][this.moduleCount-i-1]=mod;
      else if(i<9) this.modules[8][15-i-1+1]=mod;
      else this.modules[8][15-i-1]=mod;
    }
    this.modules[this.moduleCount-8][8]=true;
  };
  QR.prototype._setupTypeNumber=function(){
    // versiyon 7+ için — bizim aralığımızda basit bırak
  };
  QR.prototype._buildBitStream=function(totalDataBytes){
    var bits=[];
    var push=function(val,nbits){
      for(var i=nbits-1;i>=0;i--) bits.push((val>>i)&1);
    };
    push(4,4); // 8-bit byte mode
    var lenBits=(this.version<10)?8:16;
    push(this.data.length,lenBits);
    for(var i=0;i<this.data.length;i++) push(this.data[i],8);
    // Terminator
    var targetBits=totalDataBytes*8;
    var termBits=Math.min(4,targetBits-bits.length);
    for(var i=0;i<termBits;i++) bits.push(0);
    while(bits.length%8!==0) bits.push(0);
    var bytes=[];
    for(var i=0;i<bits.length;i+=8){
      var b=0;
      for(var j=0;j<8;j++) b=(b<<1)|bits[i+j];
      bytes.push(b);
    }
    // Pad
    var padToggle=false;
    while(bytes.length<totalDataBytes){ bytes.push(padToggle?PAD1:PAD0); padToggle=!padToggle; }
    return bytes;
  };
  QR.prototype._interleaveDataAndEC=function(dataBytes,info){
    var ecCount=info[1],numBlocks=info[2],dataPerBlock=info[3];
    var dataBlocks=[],ecBlocks=[];
    var idx=0;
    for(var b=0;b<numBlocks;b++){
      var block=dataBytes.slice(idx,idx+dataPerBlock);
      idx+=dataPerBlock;
      dataBlocks.push(block);
      // Reed-Solomon
      var poly=new Poly(block,ecCount);
      var rsPoly=rsBlockPoly(ecCount);
      var modPoly=poly.modIter(rsPoly);
      var ec=new Array(ecCount);
      for(var i=0;i<ecCount;i++){
        var modIndex=i+modPoly.len()-ecCount;
        ec[i]=modIndex>=0?modPoly.get(modIndex):0;
      }
      ecBlocks.push(ec);
    }
    var result=[];
    for(var i=0;i<dataPerBlock;i++) for(var b=0;b<numBlocks;b++) if(i<dataBlocks[b].length) result.push(dataBlocks[b][i]);
    for(var i=0;i<ecCount;i++) for(var b=0;b<numBlocks;b++) result.push(ecBlocks[b][i]);
    return result;
  };
  QR.prototype._mapDataToMatrix=function(data){
    var inc=-1,row=this.moduleCount-1,bitIdx=7,byteIdx=0;
    for(var col=this.moduleCount-1;col>0;col-=2){
      if(col===6) col--;
      while(true){
        for(var c=0;c<2;c++){
          if(this.modules[row][col-c]===null){
            var dark=false;
            if(byteIdx<data.length){ dark=((data[byteIdx]>>bitIdx)&1)===1; }
            this.modules[row][col-c]=dark;
            bitIdx--;
            if(bitIdx===-1){ byteIdx++; bitIdx=7; }
          }
        }
        row+=inc;
        if(row<0||row>=this.moduleCount){ row-=inc; inc=-inc; break; }
      }
    }
  };
  QR.prototype._applyMask=function(mask,undoOnly){
    var fn=BLOCK_MASKS[mask];
    for(var r=0;r<this.moduleCount;r++) for(var c=0;c<this.moduleCount;c++){
      if(this._isFunctionPattern(r,c)) continue;
      if(fn(r,c)) this.modules[r][c]=!this.modules[r][c];
    }
  };
  QR.prototype._isFunctionPattern=function(r,c){
    // Finder patterns + separator
    if(r<=8 && c<=8) return true;
    if(r<=8 && c>=this.moduleCount-8) return true;
    if(r>=this.moduleCount-8 && c<=8) return true;
    // Timing
    if(r===6||c===6) return true;
    // Alignment (basit)
    return false;
  };
  QR.prototype._getLostPoint=function(){
    // Basit penalty — zorunlu değil, 0 dön
    return 0;
  };
  QR.prototype.isDark=function(r,c){return this.modules[r][c]===true;};
  QR.prototype.getModuleCount=function(){return this.moduleCount;};

  qr.create=function(data){
    var q=new QR();
    q.addData(data);
    try{ q.make(); }catch(e){ console.warn('QR hatası:',e); return null; }
    return q;
  };
  qr.createSvgTag=function(data,cellSize,margin){
    cellSize=cellSize||4; margin=(typeof margin==='undefined')?cellSize*4:margin;
    var q=qr.create(data);
    if(!q) return '';
    var n=q.getModuleCount();
    var size=n*cellSize+margin*2;
    var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" shape-rendering="crispEdges">';
    svg+='<rect width="100%" height="100%" fill="#fff"/>';
    svg+='<path d="';
    for(var r=0;r<n;r++) for(var c=0;c<n;c++){
      if(q.isDark(r,c)){
        var x=margin+c*cellSize, y=margin+r*cellSize;
        svg+='M'+x+','+y+'h'+cellSize+'v'+cellSize+'h-'+cellSize+'z';
      }
    }
    svg+='" fill="#000"/></svg>';
    return svg;
  };
  return qr;
})();

/** Fatura için GİB formatında QR data üret.
 *  GİB e-Arşiv/e-Fatura QR'ında satıcı VKN + ETTN + fatura no + tarih + tutar yer alır.
 */
function faturaQRDataUret(f){
  if(!f) return '';
  var ea=(typeof EDM_AYAR!=='undefined')?EDM_AYAR:{};
  var satVkn=ea.vknTckn||'0000000000';
  var ettn=f.edmEttn||f.edmUuid||f.faturaNo||'';
  var alVkn=f.vknTckn||'';
  var tarih=f.tarih||'';
  var top=(f.toplamTutar||0).toFixed(2);
  // GİB e-Arşiv portal sorgu URL formatı (GİB standardı)
  // Örnek: https://earsivportal.efatura.gov.tr/earsiv-services/download?token=VKN_ETTN
  var params=[
    'VKN='+encodeURIComponent(satVkn),
    'ALICI='+encodeURIComponent(alVkn),
    'NO='+encodeURIComponent(f.faturaNo||''),
    'TARIH='+encodeURIComponent(tarih),
    'TUTAR='+top,
    'ETTN='+encodeURIComponent(ettn)
  ];
  return 'https://earsivportal.efatura.gov.tr/earsiv-services/download?'+params.join('&');
}

/** Render edilmiş fatura HTML'ine sağ üst köşeye QR kod overlay ekle */
function faturaQROverlayEkle(html, f){
  if(!html || !f) return html;
  try{
    var qrData=faturaQRDataUret(f);
    var svgTag=qrcodeMini.createSvgTag(qrData, 3, 0);
    if(!svgTag) return html;
    // SVG'yi data URL yap
    var svgDataUrl='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svgTag)));
    // Print CSS + QR overlay
    var printCss='<style id="autonax-print-css">'
      +'@page { size: A4; margin: 10mm; }'
      +'@media print {'
        +'body { margin:0 !important; padding:0 !important; }'
        +'.autonax-qr-overlay { position:absolute !important; top:10mm !important; right:10mm !important; box-shadow:none !important; }'
        +'button, .no-print { display:none !important; }'
      +'}'
    +'</style>';
    var qrOverlay=''
      +'<div class="autonax-qr-overlay" style="position:fixed;top:12px;right:12px;background:#fff;padding:6px;border:1px solid #d1d5db;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.1);z-index:9999">'
        +'<img src="'+svgDataUrl+'" style="width:110px;height:110px;display:block" alt="QR">'
      +'</div>';
    // <head> varsa print CSS oraya, yoksa body'nin üstüne
    if(html.indexOf('</head>')>-1){
      html=html.replace('</head>', printCss+'</head>');
    } else if(html.indexOf('<body')>-1){
      html=html.replace(/<body([^>]*)>/, '<body$1>'+printCss);
    } else {
      html=printCss+html;
    }
    // QR'ı body sonuna koy
    if(html.indexOf('</body>')>-1){
      return html.replace('</body>', qrOverlay+'</body>');
    } else if(html.indexOf('</html>')>-1){
      return html.replace('</html>', qrOverlay+'</html>');
    } else {
      return html+qrOverlay;
    }
  }catch(e){
    console.warn('Autonax QR overlay hatası:',e);
    return html;
  }
}

function faturaUBLXMLUret(f){
  if(!f) return '';
  var _e = function(s){
    if(s===null||s===undefined) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  };
  var _num = function(n){ return (parseFloat(n)||0).toFixed(2); };
  var _num4 = function(n){ return (parseFloat(n)||0).toFixed(4); };
  // UUID üret (EDM'e giden ettn'den bağımsız, sadece önizleme için)
  var uuid = f.edmUuid || f.faturaUuid || ('PREVIEW-'+(f.faturaNo||'UNKNOWN'));
  // Tarih: "DD.MM.YYYY" → "YYYY-MM-DD"
  var iso = (function(){
    var p = (f.tarih||'').split('.');
    if(p.length===3) return p[2]+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0');
    return new Date().toISOString().slice(0,10);
  })();
  var saat = (new Date().toTimeString().slice(0,8));
  var tipKod = (f.faturaTipi==='EFATURA')?'SATIS':'SATIS';
  var profilId = (f.faturaTipi==='EFATURA')?'TICARIFATURA':'EARSIVFATURA';
  var faturaTur = (f.faturaTipi==='EFATURA')?'FATURA':'E-ARSIV';

  // Tedarikçi (satıcı) bilgileri - EDM_AYAR'dan
  var ea = (typeof EDM_AYAR!=='undefined')?EDM_AYAR:{};
  var firmaVkn = ea.vknTckn || '0000000000';
  var firmaEtiket = ea.gondericEtiketi || '';
  var firmaUnvan = 'AUTONAX'; // SITE_AYAR'dan alınabilir
  try {
    if(typeof SITE_AYAR!=='undefined' && SITE_AYAR.firmaAdi) firmaUnvan = SITE_AYAR.firmaAdi;
    if(typeof SITE_AYAR!=='undefined' && SITE_AYAR.firmaVkn) firmaVkn = SITE_AYAR.firmaVkn;
  } catch(e){}

  // Alıcı (müşteri) bilgileri
  var alVkn = f.vknTckn || '';
  var alUnvan = f.musteri || '';
  var alAdres = f.adres || '';
  var alIl = f.il || '';
  var alIlce = f.ilce || '';
  var alTel = f.tel || '';
  var alEmail = f.email || '';
  var kurumsal = (alVkn && alVkn.length===10) || f.musteriTip==='kurumsal';

  // Alıcı Party XML'i
  var alPartyXml = '';
  if(kurumsal){
    alPartyXml = ''
      +'<cac:PartyIdentification><cbc:ID schemeID="VKN">'+_e(alVkn)+'</cbc:ID></cac:PartyIdentification>'
      +'<cac:PartyName><cbc:Name>'+_e(alUnvan)+'</cbc:Name></cac:PartyName>'
      +'<cac:PostalAddress>'
        +'<cbc:StreetName>'+_e(alAdres)+'</cbc:StreetName>'
        +'<cbc:CitySubdivisionName>'+_e(alIlce)+'</cbc:CitySubdivisionName>'
        +'<cbc:CityName>'+_e(alIl)+'</cbc:CityName>'
        +'<cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>'
      +'</cac:PostalAddress>'
      +'<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name></cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>'
      +(alTel?'<cac:Contact><cbc:Telephone>'+_e(alTel)+'</cbc:Telephone>'+(alEmail?'<cbc:ElectronicMail>'+_e(alEmail)+'</cbc:ElectronicMail>':'')+'</cac:Contact>':(alEmail?'<cac:Contact><cbc:ElectronicMail>'+_e(alEmail)+'</cbc:ElectronicMail></cac:Contact>':''));
  } else {
    // Bireysel - ad soyad ayırma
    var isim = alUnvan.split(' ');
    var soyad = isim.length>1?isim.pop():'';
    var ad = isim.join(' ');
    alPartyXml = ''
      +(alVkn?'<cac:PartyIdentification><cbc:ID schemeID="TCKN">'+_e(alVkn)+'</cbc:ID></cac:PartyIdentification>':'')
      +'<cac:PostalAddress>'
        +'<cbc:StreetName>'+_e(alAdres)+'</cbc:StreetName>'
        +'<cbc:CitySubdivisionName>'+_e(alIlce)+'</cbc:CitySubdivisionName>'
        +'<cbc:CityName>'+_e(alIl)+'</cbc:CityName>'
        +'<cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>'
      +'</cac:PostalAddress>'
      +(alTel||alEmail?'<cac:Contact>'+(alTel?'<cbc:Telephone>'+_e(alTel)+'</cbc:Telephone>':'')+(alEmail?'<cbc:ElectronicMail>'+_e(alEmail)+'</cbc:ElectronicMail>':'')+'</cac:Contact>':'')
      +'<cac:Person><cbc:FirstName>'+_e(ad)+'</cbc:FirstName><cbc:FamilyName>'+_e(soyad)+'</cbc:FamilyName></cac:Person>';
  }

  // Fatura satırı (tek kalem - mevcut sistemde bir fatura = bir hizmet)
  var miktar = '1';
  var birimFiyat = _num4(f.kdvsizTutar||0);
  var kdvOran = f.kdvOrani||20;
  var lineXml = ''
    +'<cac:InvoiceLine>'
      +'<cbc:ID>1</cbc:ID>'
      +'<cbc:InvoicedQuantity unitCode="C62">'+miktar+'</cbc:InvoicedQuantity>'
      +'<cbc:LineExtensionAmount currencyID="TRY">'+_num(f.kdvsizTutar||0)+'</cbc:LineExtensionAmount>'
      +'<cac:TaxTotal>'
        +'<cbc:TaxAmount currencyID="TRY">'+_num(f.kdvTutar||0)+'</cbc:TaxAmount>'
        +'<cac:TaxSubtotal>'
          +'<cbc:TaxableAmount currencyID="TRY">'+_num(f.kdvsizTutar||0)+'</cbc:TaxableAmount>'
          +'<cbc:TaxAmount currencyID="TRY">'+_num(f.kdvTutar||0)+'</cbc:TaxAmount>'
          +'<cbc:Percent>'+kdvOran+'</cbc:Percent>'
          +'<cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>'
        +'</cac:TaxSubtotal>'
      +'</cac:TaxTotal>'
      +'<cac:Item><cbc:Name>'+_e(f.hizmet||'')+'</cbc:Name></cac:Item>'
      +'<cac:Price><cbc:PriceAmount currencyID="TRY">'+birimFiyat+'</cbc:PriceAmount></cac:Price>'
    +'</cac:InvoiceLine>';

  var xml = '<?xml version="1.0" encoding="UTF-8"?>'
    +'<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"'
    +' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"'
    +' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"'
    +' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
    +' xmlns:n1="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">'
      +'<cbc:UBLVersionID>2.1</cbc:UBLVersionID>'
      +'<cbc:CustomizationID>TR1.2</cbc:CustomizationID>'
      +'<cbc:ProfileID>'+profilId+'</cbc:ProfileID>'
      +'<cbc:ID>'+_e(f.faturaNo||'')+'</cbc:ID>'
      +'<cbc:CopyIndicator>false</cbc:CopyIndicator>'
      +'<cbc:UUID>'+_e(uuid)+'</cbc:UUID>'
      +'<cbc:IssueDate>'+iso+'</cbc:IssueDate>'
      +'<cbc:IssueTime>'+saat+'</cbc:IssueTime>'
      +'<cbc:InvoiceTypeCode>'+tipKod+'</cbc:InvoiceTypeCode>'
      +(f.not?'<cbc:Note>'+_e(f.not)+'</cbc:Note>':'')
      +'<cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>'
      +'<cbc:LineCountNumeric>1</cbc:LineCountNumeric>'
      // Tedarikçi
      +'<cac:AccountingSupplierParty><cac:Party>'
        +'<cac:PartyIdentification><cbc:ID schemeID="VKN">'+_e(firmaVkn)+'</cbc:ID></cac:PartyIdentification>'
        +'<cac:PartyName><cbc:Name>'+_e(firmaUnvan)+'</cbc:Name></cac:PartyName>'
        +'<cac:PostalAddress><cbc:StreetName></cbc:StreetName><cbc:CityName></cbc:CityName><cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country></cac:PostalAddress>'
        +'<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name></cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>'
      +'</cac:Party></cac:AccountingSupplierParty>'
      // Alıcı
      +'<cac:AccountingCustomerParty><cac:Party>'
        +alPartyXml
      +'</cac:Party></cac:AccountingCustomerParty>'
      // Vergi toplam
      +'<cac:TaxTotal>'
        +'<cbc:TaxAmount currencyID="TRY">'+_num(f.kdvTutar||0)+'</cbc:TaxAmount>'
        +'<cac:TaxSubtotal>'
          +'<cbc:TaxableAmount currencyID="TRY">'+_num(f.kdvsizTutar||0)+'</cbc:TaxableAmount>'
          +'<cbc:TaxAmount currencyID="TRY">'+_num(f.kdvTutar||0)+'</cbc:TaxAmount>'
          +'<cbc:Percent>'+kdvOran+'</cbc:Percent>'
          +'<cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>'
        +'</cac:TaxSubtotal>'
      +'</cac:TaxTotal>'
      // Yasal toplamlar
      +'<cac:LegalMonetaryTotal>'
        +'<cbc:LineExtensionAmount currencyID="TRY">'+_num(f.kdvsizTutar||0)+'</cbc:LineExtensionAmount>'
        +'<cbc:TaxExclusiveAmount currencyID="TRY">'+_num(f.kdvsizTutar||0)+'</cbc:TaxExclusiveAmount>'
        +'<cbc:TaxInclusiveAmount currencyID="TRY">'+_num(f.toplamTutar||0)+'</cbc:TaxInclusiveAmount>'
        +'<cbc:PayableAmount currencyID="TRY">'+_num(f.toplamTutar||0)+'</cbc:PayableAmount>'
      +'</cac:LegalMonetaryTotal>'
      +lineXml
    +'</Invoice>';
  return xml;
}

/* ════════════ XSLT RENDER ════════════
 * UBL-TR XML'i EDM_AYAR'daki XSLT şablonuyla birleştirip HTML üretir.
 * XSLTProcessor kullanır (tüm modern tarayıcılarda mevcut).
 * Başarısız olursa fallback: basit HTML önizleme
 */
function faturaXSLTRender(f){
  if(!f) return '';
  try {
    var ea = (typeof EDM_AYAR!=='undefined')?EDM_AYAR:null;
    if(!ea) return faturaQROverlayEkle(faturaBasitHTMLUret(f), f);
    var xsltKayit = (f.faturaTipi==='EFATURA')?ea.xsltEfatura:ea.xsltEarsiv;
    if(!xsltKayit || !xsltKayit.icerik) return faturaQROverlayEkle(faturaBasitHTMLUret(f), f);

    var xmlStr = faturaUBLXMLUret(f);
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
    var xsltDoc = parser.parseFromString(xsltKayit.icerik, 'application/xml');

    // Parse hatası kontrolü
    if(xmlDoc.getElementsByTagName('parsererror').length > 0) {
      console.warn('Autonax XML parse hatası, fallback kullanılıyor');
      return faturaQROverlayEkle(faturaBasitHTMLUret(f), f);
    }
    if(xsltDoc.getElementsByTagName('parsererror').length > 0) {
      console.warn('Autonax XSLT parse hatası, fallback kullanılıyor');
      return faturaQROverlayEkle(faturaBasitHTMLUret(f), f);
    }

    var processor = new XSLTProcessor();
    processor.importStylesheet(xsltDoc);
    var resultDoc = processor.transformToDocument(xmlDoc);
    if(!resultDoc) return faturaQROverlayEkle(faturaBasitHTMLUret(f), f);

    var serializer = new XMLSerializer();
    var html = serializer.serializeToString(resultDoc);
    if(!html || html.length < 100) return faturaQROverlayEkle(faturaBasitHTMLUret(f), f);
    return faturaQROverlayEkle(html, f);
  } catch(e) {
    console.warn('Autonax XSLT render hatası:', e);
    return faturaQROverlayEkle(faturaBasitHTMLUret(f), f);
  }
}

/* ════════════ FALLBACK: BASİT HTML ÖNİZLEME ════════════
 * XSLT başarısız olursa veya ayarda XSLT yoksa kullanılır.
 * Eski faturaPDFGoster içeriğinin aynısı.
 */
function faturaBasitHTMLUret(f){
  return '<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Fatura '+f.faturaNo+'</title>'
    +'<style>body{font-family:Outfit,Arial,sans-serif;max-width:500px;margin:40px auto;padding:0 20px;color:#111}'
    +'.logo{font-size:28px;font-weight:900;color:#B01C2E;letter-spacing:4px;text-align:center;margin-bottom:4px}'
    +'.sub{text-align:center;font-size:11px;color:#777;margin-bottom:20px}'
    +'h3{text-align:center;border-top:2px solid #B01C2E;padding:10px 0;margin:0 0 16px;font-size:16px}'
    +'.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px}'
    +'.total{font-size:14px;font-weight:700;text-align:right;padding:8px 0;border-top:2px solid #111}'
    +'.badge{display:inline-block;padding:4px 12px;border-radius:10px;font-size:11px;font-weight:700}'
    +'@media print{body{margin:20px}button{display:none!important}}</style></head><body>'
    +'<div class="logo">AUTONAX</div><div class="sub">Premium Araç Koruma · '+f.faturaTipi+'</div>'
    +'<h3>'+f.faturaTipi+' FATURA (Basit Önizleme)</h3>'
    +'<div style="padding:10px;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;font-size:11px;color:#92400e;margin-bottom:12px">ℹ️ XSLT şablonu yüklü değil veya render başarısız. Standart önizleme gösteriliyor.</div>'
    +'<div class="row"><span>Fatura No</span><b>'+f.faturaNo+'</b></div>'
    +'<div class="row"><span>Tarih</span><b>'+f.tarih+'</b></div>'
    +'<div class="row"><span>Müşteri</span><b>'+f.musteri+'</b></div>'
    +(f.vknTckn?'<div class="row"><span>VKN/TCKN</span><b>'+f.vknTckn+'</b></div>':'')
    +'<div class="row"><span>Durum</span><span class="badge" style="background:'+(f.durum==='KESILDI'?'#dcfce7;color:#16a34a':'#fee2e2;color:#dc2626')+'">'+f.durum+'</span></div>'
    +'<div style="margin:20px 0;border:1px solid #eee;border-radius:8px;overflow:hidden">'
      +'<div style="display:flex;justify-content:space-between;padding:10px 14px;background:#f9f9f9;font-size:12px;font-weight:700;border-bottom:1px solid #eee"><span>KDV\'siz Tutar</span><span>₺'+(f.kdvsizTutar||0).toLocaleString('tr-TR')+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;padding:10px 14px;font-size:12px;border-bottom:1px solid #eee"><span>KDV (%'+f.kdvOrani+')</span><span style="color:#d97706;font-weight:600">₺'+(f.kdvTutar||0).toLocaleString('tr-TR')+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;padding:12px 14px;font-size:14px;font-weight:700;background:#fef2f2"><span>Toplam</span><span style="color:#B01C2E">₺'+(f.toplamTutar||0).toLocaleString('tr-TR')+'</span></div>'
    +'</div>'
    +(f.not?'<div style="margin:10px 0;padding:10px;background:#f9f9f9;border-radius:8px;font-size:12px;color:#555"><b>Not:</b> '+f.not+'</div>':'')
    +'<div style="text-align:center;margin-top:30px;font-size:10px;color:#999">Bu fatura Autonax sistemi tarafından oluşturulmuştur.</div>'
    +'<div style="text-align:center;margin-top:8px"><button onclick="window.print()" style="padding:8px 24px;background:#B01C2E;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">🖨️ Yazdır / PDF</button></div>'
    +'</body></html>';
}

function faturaPDFGoster(i){
  var f=FATURALAR[i];if(!f)return;
  var html = faturaXSLTRender(f);
  var w=window.open('','_blank','width=900,height=1000');w.document.write(html);w.document.close();
}

/* Mevcut rdvFaturaKes'i Fatura sayfasına yönlendir */
function rdvFaturaKes(idx){
  var r=RANDEVULAR[idx];if(!r)return;
  doPg('faturalar');
  setTimeout(function(){
    faturaYeniAc({
      musteri: r.musteri,
      tel: r.tel,
      plaka: r.plaka,
      hizmet: r.hizmet,
      tutar: r.tutar,
      randevuId: r.id
    });
  },200);
}


/* ═══════════════════════════════════════════════════════════
   FATURA DURUM SORGULAMA - EDM'den fatura durumunu cek
   ═══════════════════════════════════════════════════════════ */

/** Tek fatura durum sorgula */
function faturaDurumSorgula(idx){
  var f=FATURALAR[idx];
  if(!f||!f.edmUUID){toast('Bu fatura EDM\'ye g\u00f6nderilmemi\u015f','red');return;}
  if(!EDM_AYAR||!EDM_AYAR.kullaniciAdi){toast('EDM ayarlar\u0131 eksik','red');return;}
  toast('Durum sorgulan\u0131yor...','blue');
  fetch('/api/edm/durum',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      kullaniciAdi:EDM_AYAR.kullaniciAdi,
      sifre:EDM_AYAR.sifre,
      uuid:f.edmUUID
    })
  }).then(function(r){return r.json();}).then(function(d){
    if(d.success && d.data){
      var s=d.data;
      f.edmDurum=s.durum||f.edmDurum;
      f.edmGibDurum=s.gibDurum||null;
      f.edmGibAciklama=s.gibAciklama||null;
      f.edmCevapKodu=s.cevapKodu||null;
      f.edmCevapAciklama=s.cevapAciklama||null;
      f.edmSonSorgu=new Date().toISOString();
      // Durum eslemesi
      if(s.durum==='SUCCEED'||s.durum==='APPROVED') f.durum='ONAYLANDI';
      else if(s.durum==='REJECTED'||s.durum==='DECLINED') f.durum='IPTAL';
      else if(s.durum==='WAITING') f.durum='GONDERILDI';
      faturaKaydet();faturaSayfasiYukle();
      var mesaj='Durum: '+(s.durum||'-');
      if(s.gibAciklama) mesaj+=' | G\u0130B: '+s.gibAciklama;
      if(s.cevapAciklama) mesaj+=' | '+s.cevapAciklama;
      toast(mesaj, s.durum==='SUCCEED'?'green':'blue');
    } else {
      toast('Durum sorgu hatas\u0131: '+(d.error||'Bilinmeyen'),'red');
    }
  }).catch(function(e){toast('Ba\u011flant\u0131 hatas\u0131','red');});
}

/** Toplu durum guncelleme - tum gonderilmis faturalarin durumunu sorgula */
function faturaTopluDurumGuncelle(){
  if(!EDM_AYAR||!EDM_AYAR.kullaniciAdi){toast('EDM ayarlar\u0131 eksik','red');return;}
  var gonderilmisler=[];
  FATURALAR.forEach(function(f,i){
    if((f.durum==='GONDERILDI'||f.durum==='KESILIYOR') && f.edmUUID) gonderilmisler.push(i);
  });
  if(!gonderilmisler.length){toast('Durumu sorgulanacak fatura yok','blue');return;}
  toast(gonderilmisler.length+' faturan\u0131n durumu sorgulan\u0131yor...','blue');
  var tamamlanan=0,hataCount=0;
  gonderilmisler.forEach(function(idx){
    var f=FATURALAR[idx];
    fetch('/api/edm/durum',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        kullaniciAdi:EDM_AYAR.kullaniciAdi,
        sifre:EDM_AYAR.sifre,
        uuid:f.edmUUID
      })
    }).then(function(r){return r.json();}).then(function(d){
      tamamlanan++;
      if(d.success && d.data){
        var s=d.data;
        f.edmDurum=s.durum||f.edmDurum;
        f.edmGibDurum=s.gibDurum||null;
        f.edmSonSorgu=new Date().toISOString();
        if(s.durum==='SUCCEED'||s.durum==='APPROVED') f.durum='ONAYLANDI';
        else if(s.durum==='REJECTED'||s.durum==='DECLINED') f.durum='IPTAL';
      } else { hataCount++; }
      if(tamamlanan>=gonderilmisler.length){
        faturaKaydet();faturaSayfasiYukle();
        toast('\u2705 '+tamamlanan+' fatura g\u00fcncellendi'+(hataCount?' ('+hataCount+' hata)':''),'green');
      }
    }).catch(function(){tamamlanan++;hataCount++;
      if(tamamlanan>=gonderilmisler.length){faturaKaydet();faturaSayfasiYukle();toast(tamamlanan+' fatura kontrol edildi ('+hataCount+' hata)','red');}
    });
  });
}

/** Fatura detay modali - tum bilgileri goster */
function faturaDetayGoster(idx){
  var f=FATURALAR[idx];if(!f)return;
  var ovl=document.createElement('div');
  ovl.id='fat-detay-ovl';
  ovl.style.cssText='position:fixed;inset:0;z-index:990;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto';
  ovl.onclick=function(e){if(e.target===ovl)ovl.remove();};
  var tipRenk=f.faturaTipi==='EFATURA'?'#2563EB':'#16a34a';
  var tipLabel=f.faturaTipi==='EFATURA'?'e-Fatura':'e-Ar\u015fiv';
  var durRenk='#999',durLabel=f.durum||'-';
  if(f.durum==='GONDERILDI'){durRenk='#16a34a';durLabel='\u2705 G\u00f6nderildi';}
  else if(f.durum==='ONAYLANDI'){durRenk='#16a34a';durLabel='\u2713 Onayland\u0131';}
  else if(f.durum==='IPTAL'){durRenk='#991b1b';durLabel='\u2715 \u0130ptal';}
  else if(f.durum==='HATA'){durRenk='#dc2626';durLabel='\u26a0\ufe0f Hata';}
  else if(f.durum==='KESILDI'){durRenk='#d97706';durLabel='\ud83d\udcdd Bekliyor';}
  var h='<div style="background:#fff;border-radius:16px;max-width:600px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.25);max-height:90vh;overflow-y:auto">';
  h+='<div style="background:linear-gradient(135deg,var(--ink),#1e293b);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-radius:16px 16px 0 0">';
  h+='<div style="color:#fff;font-family:Bebas Neue,sans-serif;font-size:18px;letter-spacing:2px">FATURA DETAY</div>';
  h+='<div onclick="document.getElementById(\'fat-detay-ovl\').remove()" style="cursor:pointer;color:#888;font-size:26px">&times;</div></div>';
  h+='<div style="padding:16px">';
  // Fatura bilgileri
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h+='<div><div style="font-weight:700;font-size:16px;font-family:monospace">'+f.faturaNo+'</div><div style="font-size:11px;color:var(--ink4)">'+f.tarih+'</div></div>';
  h+='<div style="display:flex;gap:6px"><span style="padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;background:'+tipRenk+'15;color:'+tipRenk+'">'+tipLabel+'</span>';
  h+='<span style="padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;color:'+durRenk+'">'+durLabel+'</span></div></div>';
  // Musteri
  h+='<div style="padding:12px;background:var(--bg);border-radius:10px;margin-bottom:12px">';
  h+='<div style="font-size:10px;color:var(--ink4);text-transform:uppercase;font-weight:700;margin-bottom:4px">M\u00dc\u015eTER\u0130</div>';
  h+='<div style="font-weight:700">'+(f.musteriTip==='kurumsal'?'\ud83c\udfe2':'\ud83d\udc64')+' '+f.musteri+'</div>';
  if(f.vknTckn) h+='<div style="font-size:11px;color:var(--ink4);font-family:monospace">'+f.vknTckn+'</div>';
  if(f.vergiDairesi) h+='<div style="font-size:11px;color:var(--ink4)">VD: '+f.vergiDairesi+'</div>';
  h+='</div>';
  // Tutar
  h+='<div style="padding:12px;background:linear-gradient(135deg,#fef7f2,#fff7ed);border:1.5px solid #f5d5b8;border-radius:10px;margin-bottom:12px">';
  h+='<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span>KDV Hari\u00e7</span><b>\u20ba'+(f.kdvsizTutar||0).toLocaleString('tr-TR')+'</b></div>';
  h+='<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span>KDV</span><b style="color:#d97706">\u20ba'+(f.kdvTutar||0).toLocaleString('tr-TR')+'</b></div>';
  h+='<div style="display:flex;justify-content:space-between;padding:6px 0 2px;border-top:2px solid #eab28e;margin-top:4px"><span style="font-weight:700;font-size:14px">TOPLAM</span><b style="color:var(--r);font-size:18px">\u20ba'+(f.toplamTutar||0).toLocaleString('tr-TR')+'</b></div></div>';
  // EDM Bilgileri
  if(f.edmUUID||f.edmEttn){
    h+='<div style="padding:12px;background:rgba(37,99,235,.04);border:1px solid rgba(37,99,235,.15);border-radius:10px;margin-bottom:12px">';
    h+='<div style="font-size:10px;color:var(--ink4);text-transform:uppercase;font-weight:700;margin-bottom:6px">EDM B\u0130LG\u0130LER\u0130</div>';
    if(f.edmUUID) h+='<div style="font-size:11px;margin-bottom:4px"><b>UUID:</b> <span style="font-family:monospace;font-size:10px">'+f.edmUUID+'</span></div>';
    if(f.edmEttn) h+='<div style="font-size:11px;margin-bottom:4px"><b>ETTN:</b> <span style="font-family:monospace;font-size:10px">'+f.edmEttn+'</span></div>';
    if(f.edmDurum) h+='<div style="font-size:11px;margin-bottom:4px"><b>EDM Durum:</b> '+f.edmDurum+'</div>';
    if(f.edmGibAciklama) h+='<div style="font-size:11px;margin-bottom:4px"><b>G\u0130B:</b> '+f.edmGibAciklama+'</div>';
    if(f.edmSonSorgu) h+='<div style="font-size:10px;color:var(--ink4)">Son sorgu: '+new Date(f.edmSonSorgu).toLocaleString('tr-TR')+'</div>';
    if(f.edmMesaj&&f.durum==='HATA') h+='<div style="font-size:11px;color:#dc2626;margin-top:4px">\u26a0\ufe0f '+f.edmMesaj+'</div>';
    h+='</div>';
  }
  // Aksiyonlar
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">';
  h+='<button class="ab ab-n" onclick="faturaOnizlemeGoster('+idx+');document.getElementById(\'fat-detay-ovl\').remove()" style="flex:1;padding:10px;font-size:12px">\ud83d\udc41 \u00d6nizle</button>';
  if(f.edmUUID) h+='<button class="ab ab-n" onclick="faturaDurumSorgula('+idx+')" style="flex:1;padding:10px;font-size:12px;border-color:#2563EB;color:#2563EB">\ud83d\udd04 Durum Sorgula</button>';
  if(f.durum==='KESILDI'||f.durum==='HATA') h+='<button class="ab ab-n" onclick="faturaEDMGonder('+idx+');document.getElementById(\'fat-detay-ovl\').remove()" style="flex:1;padding:10px;font-size:12px;border-color:#1a6b3c;color:#1a6b3c">\ud83d\udce4 G\u00f6nder</button>';
  if(f.durum==='GONDERILDI'||f.durum==='ONAYLANDI'||f.durum==='KESILDI') h+='<button class="ab ab-r" onclick="faturaIptal('+idx+');document.getElementById(\'fat-detay-ovl\').remove()" style="flex:1;padding:10px;font-size:12px">\u2715 \u0130ptal</button>';
  h+='</div>';
  h+='</div></div>';
  ovl.innerHTML=h;
  document.body.appendChild(ovl);
}

/** Tarih araligina gore fatura filtrele */
function faturaListeTarihFiltre(){
  var baslangic=(document.getElementById('fat-tarih-bas')||{}).value||'';
  var bitis=(document.getElementById('fat-tarih-bit')||{}).value||'';
  faturaListeYukle(baslangic,bitis);
}

