/**
 * musteri360.js - Musteri 360 Sihirbazi
 * TC/VKN, telefon veya plaka ile musteri gecmisini goster
 *
 * Bagimliliklar (pnl_atn.html'de tanimli):
 *   RANDEVULAR, FATURALAR, toast(), doPg()
 */
/* global RANDEVULAR, FATURALAR, toast, doPg, faturaYeniAc, faturaOnizlemeGoster */

/** Ana arama modali ac */
function musteri360Ac(){
  var ovl=document.createElement('div');ovl.id='m360-ovl';
  ovl.style.cssText='position:fixed;inset:0;z-index:990;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto';
  ovl.onclick=function(e){if(e.target===ovl)ovl.remove();};
  ovl.innerHTML='<div id="m360-modal" style="background:#fff;border-radius:16px;max-width:800px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.25);max-height:92vh;display:flex;flex-direction:column;overflow:hidden">'
    +'<div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">'
      +'<div style="color:#fff;font-family:Bebas Neue,sans-serif;font-size:18px;letter-spacing:2px">\ud83d\udd0d M\u00dc\u015eTER\u0130 360\u00b0</div>'
      +'<div onclick="document.getElementById(\'m360-ovl\').remove()" style="cursor:pointer;color:#888;font-size:26px">&times;</div>'
    +'</div>'
    +'<div style="padding:16px;flex-shrink:0">'
      +'<div style="display:flex;gap:8px">'
        +'<input type="text" id="m360-arama" placeholder="TC / VKN / Telefon / Plaka / M\u00fc\u015fteri ad\u0131..." style="flex:1;padding:10px 14px;border:1.5px solid var(--bd);border-radius:10px;font-size:13px;font-family:Outfit,sans-serif;outline:none" oninput="m360Debounce()" onkeydown="if(event.key===\'Enter\')m360Ara()">'
        +'<button onclick="m360Ara()" style="padding:10px 20px;border:none;border-radius:10px;background:var(--r);color:#fff;font-family:Bebas Neue,sans-serif;font-size:14px;letter-spacing:1px;cursor:pointer">\ud83d\udd0d ARA</button>'
      +'</div>'
    +'</div>'
    +'<div id="m360-sonuc" style="overflow-y:auto;flex:1;padding:0 16px 16px;min-height:200px">'
      +'<div style="text-align:center;padding:40px;color:var(--ink4)">'
        +'<div style="font-size:48px;margin-bottom:8px">\ud83d\udc64</div>'
        +'<div style="font-size:13px">TC, VKN, telefon, plaka veya m\u00fc\u015fteri ad\u0131 girin</div>'
      +'</div>'
    +'</div>'
  +'</div>';
  document.body.appendChild(ovl);
  setTimeout(function(){document.getElementById('m360-arama').focus();},100);
}

var _m360Timer=null;
function m360Debounce(){
  clearTimeout(_m360Timer);
  var q=(document.getElementById('m360-arama')||{}).value||'';
  if(q.length>=3) _m360Timer=setTimeout(m360Ara,400);
}

/** Arama yap */
function m360Ara(){
  var q=((document.getElementById('m360-arama')||{}).value||'').trim().toLowerCase();
  var el=document.getElementById('m360-sonuc');
  if(!el)return;
  if(q.length<2){el.innerHTML='<div style="text-align:center;padding:30px;color:var(--ink4);font-size:12px">En az 2 karakter girin</div>';return;}

  // Randevulardan musteri bul
  var randevular=(typeof RANDEVULAR!=='undefined'?RANDEVULAR:[])||[];
  var faturalar=(typeof FATURALAR!=='undefined'?FATURALAR:[])||[];

  // Musteri eslestirme
  var musteriMap={};
  randevular.forEach(function(r,ri){
    var key=(r.musteriTel||r.tel||r.musteri||'').toLowerCase().replace(/\s/g,'');
    if(!key) key='rdv_'+ri;
    // Arama kriteri
    var match=false;
    if(q&&((r.musteri||'').toLowerCase().indexOf(q)>-1
      ||(r.musteriAdi||'').toLowerCase().indexOf(q)>-1
      ||(r.plaka||'').toLowerCase().replace(/\s/g,'').indexOf(q.replace(/\s/g,''))>-1
      ||(r.musteriTel||r.tel||'').replace(/\s/g,'').indexOf(q.replace(/\s/g,''))>-1
      ||(r.musteriId||'').indexOf(q)>-1
    )) match=true;
    if(!match) return;

    var mKey=(r.musteriTel||r.tel||r.musteri||'unknown').toLowerCase().replace(/\s/g,'');
    if(!musteriMap[mKey]){
      musteriMap[mKey]={
        isim:r.musteri||r.musteriAdi||'-',
        tel:r.musteriTel||r.tel||'',
        email:r.musteriEmail||'',
        plakalar:[],
        araclar:[],
        randevular:[],
        faturalar:[],
        toplamHarcama:0,
        toplamOdenen:0,
        sonZiyaret:null
      };
    }
    var m=musteriMap[mKey];
    if(r.plaka&&m.plakalar.indexOf(r.plaka)<0) m.plakalar.push(r.plaka);
    if(r.arac&&m.araclar.indexOf(r.arac)<0) m.araclar.push(r.arac);
    m.randevular.push({idx:ri,tarih:r.tarih,saat:r.saat,hizmet:r.hizmet,tutar:r.tutar||0,durum:r.durum,plaka:r.plaka,arac:r.arac,odenen:r.odenenToplam||0,faturaNo:r.faturaNo});
    m.toplamHarcama+=(r.tutar||0);
    m.toplamOdenen+=(r.odenenToplam||0);
    if(!m.sonZiyaret||r.tarih>m.sonZiyaret) m.sonZiyaret=r.tarih;
  });

  // Faturalardan da esle
  faturalar.forEach(function(f,fi){
    var match=false;
    if(q&&((f.musteri||'').toLowerCase().indexOf(q)>-1
      ||(f.vknTckn||'').indexOf(q)>-1
    )) match=true;
    if(!match) return;
    // Musteriye ekle
    var mKey=(f.vknTckn||f.musteri||'unknown').toLowerCase().replace(/\s/g,'');
    // Mevcut musteri var mi?
    var found=false;
    Object.keys(musteriMap).forEach(function(k){
      var m=musteriMap[k];
      if(m.isim.toLowerCase()===f.musteri.toLowerCase()){found=true;mKey=k;}
    });
    if(!musteriMap[mKey]){
      musteriMap[mKey]={isim:f.musteri||'-',tel:'',email:'',plakalar:[],araclar:[],randevular:[],faturalar:[],toplamHarcama:0,toplamOdenen:0,sonZiyaret:null};
    }
    musteriMap[mKey].faturalar.push({idx:fi,no:f.faturaNo,tarih:f.tarih,tutar:f.toplamTutar||0,durum:f.durum,tip:f.faturaTipi});
  });

  var keys=Object.keys(musteriMap);
  if(!keys.length){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink4)"><div style="font-size:36px;margin-bottom:8px">\ud83d\ude45</div><div style="font-size:13px">"'+q+'" ile e\u015fle\u015fen m\u00fc\u015fteri bulunamad\u0131</div></div>';
    return;
  }

  // Sonuclari render
  var html='<div style="font-size:11px;color:var(--ink4);margin-bottom:12px">'+keys.length+' m\u00fc\u015fteri bulundu</div>';
  keys.forEach(function(k){
    var m=musteriMap[k];
    var ziyaretSayisi=m.randevular.length;
    var faturaSayisi=m.faturalar.length;
    var gunFark=m.sonZiyaret?Math.floor((Date.now()-new Date(m.sonZiyaret).getTime())/(86400000)):null;
    var gunLabel=gunFark!==null?(gunFark===0?'Bug\u00fcn':gunFark+' g\u00fcn \u00f6nce'):'Bilinmiyor';

    // Sadakat seviyesi
    var sadakat='',sadakatRenk='#999';
    if(ziyaretSayisi>=10){sadakat='\ud83d\udc51 VIP';sadakatRenk='#d97706';}
    else if(ziyaretSayisi>=5){sadakat='\u2b50 Sad\u0131k';sadakatRenk='#16a34a';}
    else if(ziyaretSayisi>=2){sadakat='\ud83d\udd04 Tekrar';sadakatRenk='#2563EB';}
    else{sadakat='\ud83c\udd95 Yeni';sadakatRenk='#6b7280';}

    html+='<div style="border:1.5px solid var(--bd);border-radius:12px;margin-bottom:12px;overflow:hidden">';
    // Baslik
    html+='<div style="padding:14px 16px;background:var(--bg);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">';
    html+='<div><div style="font-weight:700;font-size:15px">\ud83d\udc64 '+m.isim+'</div>';
    if(m.tel) html+='<div style="font-size:11px;color:var(--ink4)">\ud83d\udcf1 '+m.tel+'</div>';
    if(m.plakalar.length) html+='<div style="font-size:11px;color:var(--ink4)">\ud83d\ude97 '+m.plakalar.join(' \u00b7 ')+'</div>';
    html+='</div>';
    html+='<div style="text-align:right"><span style="padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;color:'+sadakatRenk+';background:'+sadakatRenk+'12">'+sadakat+'</span></div>';
    html+='</div>';

    // KPI
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:1px;background:var(--bd)">';
    html+='<div style="padding:10px;background:#fff;text-align:center"><div style="font-size:18px;font-weight:700;color:var(--ink)">'+ziyaretSayisi+'</div><div style="font-size:9px;color:var(--ink4);text-transform:uppercase">Ziyaret</div></div>';
    html+='<div style="padding:10px;background:#fff;text-align:center"><div style="font-size:18px;font-weight:700;color:#16a34a">\u20ba'+m.toplamHarcama.toLocaleString('tr-TR')+'</div><div style="font-size:9px;color:var(--ink4);text-transform:uppercase">Toplam</div></div>';
    html+='<div style="padding:10px;background:#fff;text-align:center"><div style="font-size:18px;font-weight:700;color:#2563EB">'+faturaSayisi+'</div><div style="font-size:9px;color:var(--ink4);text-transform:uppercase">Fatura</div></div>';
    html+='<div style="padding:10px;background:#fff;text-align:center"><div style="font-size:14px;font-weight:700;color:'+(gunFark!==null&&gunFark>90?'#dc2626':'var(--ink)')+'">'+gunLabel+'</div><div style="font-size:9px;color:var(--ink4);text-transform:uppercase">Son Ziyaret</div></div>';
    html+='</div>';

    // Hizmet gecmisi timeline
    if(m.randevular.length){
      var sorted=m.randevular.slice().sort(function(a,b){return b.tarih>a.tarih?1:-1;});
      html+='<div style="padding:12px 16px"><div style="font-size:10px;font-weight:700;color:var(--ink4);text-transform:uppercase;margin-bottom:8px">\ud83d\udccc H\u0130ZMET GE\u00c7M\u0130\u015e\u0130</div>';
      sorted.slice(0,8).forEach(function(r){
        var durRenk=r.durum==='tamamland\u0131'?'#16a34a':r.durum==='iptal'?'#dc2626':'#d97706';
        var durLabel=r.durum||'-';
        html+='<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--bg);align-items:center;font-size:12px">';
        html+='<div style="min-width:70px;font-family:monospace;font-size:11px;color:var(--ink4)">'+r.tarih+'</div>';
        html+='<div style="flex:1"><b>'+(r.hizmet||'-')+'</b>'+(r.plaka?' <span style="font-size:10px;color:var(--ink4)">\ud83d\ude97 '+r.plaka+'</span>':'')+'</div>';
        html+='<div style="font-weight:700;color:var(--r);white-space:nowrap">\u20ba'+(r.tutar||0).toLocaleString('tr-TR')+'</div>';
        html+='<div style="font-size:10px;color:'+durRenk+';font-weight:600;min-width:60px;text-align:right">'+durLabel+'</div>';
        html+='</div>';
      });
      if(sorted.length>8) html+='<div style="font-size:10px;color:var(--ink4);padding:4px 0">+ '+(sorted.length-8)+' daha...</div>';
      html+='</div>';
    }

    // Fatura gecmisi
    if(m.faturalar.length){
      html+='<div style="padding:0 16px 12px"><div style="font-size:10px;font-weight:700;color:var(--ink4);text-transform:uppercase;margin-bottom:8px">\ud83e\uddfe FATURALAR</div>';
      m.faturalar.slice(0,5).forEach(function(f){
        var durRenk=f.durum==='GONDERILDI'||f.durum==='ONAYLANDI'?'#16a34a':f.durum==='IPTAL'?'#991b1b':'#d97706';
        html+='<div style="display:flex;gap:10px;padding:4px 0;border-bottom:1px solid var(--bg);align-items:center;font-size:12px">';
        html+='<div style="font-family:monospace;font-size:11px;font-weight:700;min-width:80px">'+f.no+'</div>';
        html+='<div style="font-size:11px;color:var(--ink4)">'+f.tarih+'</div>';
        html+='<div style="flex:1"></div>';
        html+='<div style="font-weight:700;color:var(--r)">\u20ba'+(f.tutar||0).toLocaleString('tr-TR')+'</div>';
        html+='<div style="font-size:9px;color:'+durRenk+';font-weight:700">'+(f.durum||'-')+'</div>';
        html+='<button class="ab ab-n" style="font-size:9px;padding:2px 8px" onclick="faturaOnizlemeGoster('+f.idx+')">\ud83d\udc41</button>';
        html+='</div>';
      });
      html+='</div>';
    }

    // Aksiyon butonlari
    html+='<div style="padding:10px 16px;background:var(--bg);display:flex;gap:6px;flex-wrap:wrap">';
    var preData=JSON.stringify({musteri:m.isim,tel:m.tel,plaka:m.plakalar[0]||''}).replace(/'/g,"\\'");
    var rdvData=JSON.stringify({isim:m.isim,tel:m.tel,plaka:m.plakalar[0]||'',arac:m.araclar[0]||'',sonHizmet:m.randevular.length?m.randevular[0].hizmet:''}).replace(/'/g,"\\'");
    html+='<button class="ab ab-n" style="font-size:10px;border-color:#6366f1;color:#6366f1;background:rgba(99,102,241,.06)" onclick="m360YeniRandevu('+rdvData+')">+ Yeni Randevu</button>';
    html+='<button class="ab ab-n" style="font-size:10px;border-color:#1a6b3c;color:#1a6b3c" onclick="document.getElementById(\'m360-ovl\').remove();faturaYeniAc('+preData+')">+ Yeni Fatura</button>';
    if(m.tel) html+='<a href="https://wa.me/90'+m.tel.replace(/\D/g,'').slice(-10)+'" target="_blank" class="ab ab-n" style="font-size:10px;border-color:#25D366;color:#25D366;text-decoration:none">\ud83d\udcac WhatsApp</a>';
    if(m.tel) html+='<a href="tel:'+m.tel+'" class="ab ab-n" style="font-size:10px;text-decoration:none">\ud83d\udcde Ara</a>';
    html+='</div>';
    html+='</div>';
  });

  el.innerHTML=html;
}


/** 360'dan yeni randevu olustur - formu doldur ve randevu sayfasina yonlendir */
function m360YeniRandevu(musteriData){
  // 360 modalini kapat
  var ovl=document.getElementById('m360-ovl');
  if(ovl) ovl.remove();

  // Randevu sayfasina git
  if(typeof doPg==='function') doPg('randevular');

  // Biraz bekle - sayfa render olduktan sonra formu doldur
  setTimeout(function(){
    var d=musteriData||{};
    // Form alanlarini doldur
    var fMusteri=document.getElementById('rdv-musteri');
    var fTel=document.getElementById('rdv-tel');
    var fPlaka=document.getElementById('rdv-plaka');
    var fArac=document.getElementById('rdv-arac');
    var fTarih=document.getElementById('rdv-tarih');
    var fNot=document.getElementById('rdv-not');

    if(fMusteri&&d.isim) fMusteri.value=d.isim;
    if(fTel&&d.tel) fTel.value=d.tel;
    if(fPlaka&&d.plaka) fPlaka.value=d.plaka;
    if(fArac&&d.arac) fArac.value=d.arac;
    if(fNot&&d.not) fNot.value=d.not;

    // Bugunku tarih
    if(fTarih&&!fTarih.value){
      var bugun=new Date();
      fTarih.value=bugun.toISOString().split('T')[0];
    }

    // Son hizmet bilgisi varsa not'a yaz
    if(fNot&&d.sonHizmet&&!d.not){
      fNot.value='Onceki hizmet: '+d.sonHizmet;
    }

    // Form alanini vurgula
    if(fMusteri){
      fMusteri.style.transition='background .3s';
      fMusteri.style.background='rgba(99,102,241,.1)';
      setTimeout(function(){fMusteri.style.background='';},2000);
    }

    // Mobilde form gorunmuyorsa modal ac
    if(window.innerWidth<768&&typeof yeniRandevuModalMobil==='function'){
      var tarihStr=new Date().toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'});
      yeniRandevuModalMobil(new Date().toISOString().split('T')[0], tarihStr);
      // Modal actiktan sonra tekrar doldur
      setTimeout(function(){
        var fM2=document.getElementById('rdv-musteri');
        var fT2=document.getElementById('rdv-tel');
        var fP2=document.getElementById('rdv-plaka');
        var fA2=document.getElementById('rdv-arac');
        if(fM2&&d.isim) fM2.value=d.isim;
        if(fT2&&d.tel) fT2.value=d.tel;
        if(fP2&&d.plaka) fP2.value=d.plaka;
        if(fA2&&d.arac) fA2.value=d.arac;
      },300);
    }

    if(typeof toast==='function') toast('M\u00fc\u015fteri bilgileri dolduruldu - tarihi ve hizmeti se\u00e7in','blue');
  },300);
}

