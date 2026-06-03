/**
 * musteri-oneri.js - Randevu formunda akilli musteri onerisi
 * Musteri adi, telefon veya plaka yazarken gecmis kayitlardan oneri gosterir
 * 
 * Bagimliliklar: RANDEVULAR (pnl_atn.html'de tanimli)
 */
/* global RANDEVULAR */

(function(){
  'use strict';

  // Musteri veritabani - localStorage + RANDEVULAR'dan derlenir
  var MUSTERI_DB=[];
  var DB_KEY='autonax_musteri_db';

  /** Musteri DB'yi yenile - RANDEVULAR + localStorage birlestir */
  function musteriDBYenile(){
    var map={};
    // localStorage'dan
    try{
      var kayitli=JSON.parse(localStorage.getItem(DB_KEY)||'[]');
      kayitli.forEach(function(m){
        var key=(m.tel||m.isim||'').toLowerCase().replace(/\s/g,'');
        if(key) map[key]=m;
      });
    }catch(e){}
    // RANDEVULAR'dan
    var randevular=(typeof RANDEVULAR!=='undefined'?RANDEVULAR:[])||[];
    randevular.forEach(function(r){
      if(!r.musteri&&!r.musteriAdi) return;
      var tel=(r.musteriTel||r.tel||'').replace(/\s/g,'');
      var isim=r.musteri||r.musteriAdi||'';
      var key=(tel||isim).toLowerCase().replace(/\s/g,'');
      if(!key) return;
      if(!map[key]){
        map[key]={isim:isim,tel:tel,plaka:'',arac:'',ziyaret:0};
      }
      var m=map[key];
      // En son bilgileri guncelle
      if(isim&&isim.length>m.isim.length) m.isim=isim;
      if(tel&&!m.tel) m.tel=tel;
      if(r.plaka&&!m.plaka) m.plaka=r.plaka;
      if(r.plaka&&m.plaka.indexOf(r.plaka)<0) m.plaka+=(m.plaka?' | ':'')+r.plaka;
      if(r.arac&&!m.arac) m.arac=r.arac;
      m.ziyaret=(m.ziyaret||0)+1;
    });
    MUSTERI_DB=Object.values(map);
    // Ziyarete gore sirala
    MUSTERI_DB.sort(function(a,b){return(b.ziyaret||0)-(a.ziyaret||0);});
  }

  /** Yeni musteri kaydet (randevu eklendiginde) */
  function musteriDBKaydet(isim,tel,plaka,arac){
    musteriDBYenile();
    var key=(tel||isim||'').toLowerCase().replace(/\s/g,'');
    if(!key) return;
    var bulundu=false;
    MUSTERI_DB.forEach(function(m){
      var mKey=(m.tel||m.isim).toLowerCase().replace(/\s/g,'');
      if(mKey===key){
        bulundu=true;
        if(isim) m.isim=isim;
        if(tel) m.tel=tel;
        if(plaka&&m.plaka.indexOf(plaka)<0) m.plaka+=(m.plaka?' | ':'')+plaka;
        if(arac) m.arac=arac;
        m.ziyaret=(m.ziyaret||0)+1;
      }
    });
    if(!bulundu){
      MUSTERI_DB.push({isim:isim||'',tel:tel||'',plaka:plaka||'',arac:arac||'',ziyaret:1});
    }
    try{localStorage.setItem(DB_KEY,JSON.stringify(MUSTERI_DB));}catch(e){}
  }
  // Global erisim
  window.musteriDBKaydet=musteriDBKaydet;

  /** Dropdown olustur */
  function oneriDropdownOlustur(inputEl){
    var dd=document.createElement('div');
    dd.className='moneri-dd';
    dd.style.cssText='display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid var(--bd);border-top:none;border-radius:0 0 10px 10px;max-height:200px;overflow-y:auto;z-index:300;box-shadow:0 8px 24px rgba(0,0,0,.12)';
    // Input'un parent'ina relative pozisyon ver
    var parent=inputEl.parentElement;
    if(getComputedStyle(parent).position==='static') parent.style.position='relative';
    parent.appendChild(dd);
    return dd;
  }

  /** Onerileri goster */
  function onerileriGoster(inputEl, dd, alan){
    var q=(inputEl.value||'').trim().toLowerCase().replace(/\s/g,'');
    if(q.length<2){dd.style.display='none';return;}

    var sonuclar=MUSTERI_DB.filter(function(m){
      if(alan==='isim') return (m.isim||'').toLowerCase().indexOf(q)>-1;
      if(alan==='tel') return (m.tel||'').replace(/\s/g,'').indexOf(q)>-1;
      if(alan==='plaka') return (m.plaka||'').toLowerCase().replace(/\s/g,'').indexOf(q)>-1;
      return false;
    }).slice(0,8);

    if(!sonuclar.length){dd.style.display='none';return;}

    dd.innerHTML=sonuclar.map(function(m){
      var vurgulu=alan==='isim'?'<b>'+m.isim+'</b>':m.isim;
      var telStr=m.tel?'<span style="color:var(--ink4);font-size:10px;margin-left:6px">\ud83d\udcf1 '+m.tel+'</span>':'';
      var plakaStr=m.plaka?'<span style="color:var(--ink4);font-size:10px;margin-left:6px">\ud83d\ude97 '+m.plaka+'</span>':'';
      var ziyStr=m.ziyaret>1?'<span style="color:#6366f1;font-size:9px;margin-left:4px">('+m.ziyaret+'x)</span>':'';
      return '<div class="moneri-item" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--bg);font-size:12px;display:flex;align-items:center;flex-wrap:wrap;gap:2px" data-isim="'+(m.isim||'').replace(/"/g,'&quot;')+'" data-tel="'+(m.tel||'')+'" data-plaka="'+(m.plaka||'').split(' | ')[0]+'" data-arac="'+(m.arac||'').replace(/"/g,'&quot;')+'">'
        +vurgulu+telStr+plakaStr+ziyStr
        +'</div>';
    }).join('');
    dd.style.display='block';

    // Click handler
    dd.querySelectorAll('.moneri-item').forEach(function(item){
      item.onmousedown=function(e){
        e.preventDefault();
        var isim=item.getAttribute('data-isim')||'';
        var tel=item.getAttribute('data-tel')||'';
        var plaka=item.getAttribute('data-plaka')||'';
        var arac=item.getAttribute('data-arac')||'';
        // Tum alanlari doldur
        var fM=document.getElementById('rdv-musteri');
        var fT=document.getElementById('rdv-tel');
        var fP=document.getElementById('rdv-plaka');
        var fA=document.getElementById('rdv-arac');
        if(fM&&isim) fM.value=isim;
        if(fT&&tel) fT.value=tel;
        if(fP&&plaka) fP.value=plaka;
        if(fA&&arac) fA.value=arac;
        dd.style.display='none';
        // Dolduruldugunu goster
        [fM,fT,fP,fA].forEach(function(f){
          if(f&&f.value){
            f.style.transition='background .3s';
            f.style.background='rgba(99,102,241,.08)';
            setTimeout(function(){f.style.background='';},1500);
          }
        });
      };
      item.onmouseenter=function(){item.style.background='var(--bg)';};
      item.onmouseleave=function(){item.style.background='';};
    });
  }

  /** Form inputlarina autocomplete ekle */
  function autocompleteKur(){
    musteriDBYenile();
    
    var fields=[
      {id:'rdv-musteri',alan:'isim'},
      {id:'rdv-tel',alan:'tel'},
      {id:'rdv-plaka',alan:'plaka'}
    ];

    fields.forEach(function(field){
      var inp=document.getElementById(field.id);
      if(!inp||inp._moneriKuruldu) return;
      inp._moneriKuruldu=true;
      inp.setAttribute('autocomplete','off');
      var dd=oneriDropdownOlustur(inp);

      inp.addEventListener('input',function(){
        musteriDBYenile(); // Her seferinde tazele
        onerileriGoster(inp,dd,field.alan);
      });
      inp.addEventListener('focus',function(){
        if(inp.value.length>=2){
          musteriDBYenile();
          onerileriGoster(inp,dd,field.alan);
        }
      });
      inp.addEventListener('blur',function(){
        setTimeout(function(){dd.style.display='none';},200);
      });
    });
  }

  /** rdvEkle hook - yeni randevu eklendiginde musteri DB'ye kaydet */
  var _origRdvEkle=window.rdvEkle;
  if(typeof _origRdvEkle==='function'){
    window.rdvEkle=function(){
      // Formdaki degerleri kaydet
      var isim=(document.getElementById('rdv-musteri')||{}).value||'';
      var tel=(document.getElementById('rdv-tel')||{}).value||'';
      var plaka=(document.getElementById('rdv-plaka')||{}).value||'';
      var arac=(document.getElementById('rdv-arac')||{}).value||'';
      // Orijinal fonksiyonu cagir
      var sonuc=_origRdvEkle.apply(this,arguments);
      // DB'ye kaydet (basarili olsun olmasin - form dolu ise kaydet)
      if(isim||tel||plaka) musteriDBKaydet(isim,tel,plaka,arac);
      return sonuc;
    };
  }

  // Sayfa yuklendiginde ve tab degistiginde kur
  function baslat(){
    autocompleteKur();
    // MutationObserver ile dinamik form degisikliklerini izle
    var obs=new MutationObserver(function(){
      var inp=document.getElementById('rdv-musteri');
      if(inp&&!inp._moneriKuruldu) autocompleteKur();
    });
    obs.observe(document.body,{childList:true,subtree:true});
  }

  // DOM hazir olunca baslat
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',baslat);
  } else {
    setTimeout(baslat,500);
  }

})();
