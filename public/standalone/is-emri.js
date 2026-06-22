// Sidebar menü + sayfa div'i dinamik ekle
(function(){
  // Sidebar
  if(!document.querySelector('[onclick*="is-emri"]')){
    var ref=document.querySelector('[onclick*="referanslar"]');
    if(ref){
      var item=document.createElement('div');
      item.className='sn';
      item.setAttribute('data-yetki','randevu');
      item.setAttribute('onclick',"doPg('is-emri')");
      item.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/></svg> \u0130\u015f Emri';
      ref.parentNode.insertBefore(item,ref);
    }
  }
  // Page div
  if(!document.getElementById('pg-is-emri')){
    var pgRef=document.getElementById('pg-referanslar');
    if(pgRef){
      var pg=document.createElement('div');
      pg.id='pg-is-emri';pg.className='pg';
      pg.innerHTML='<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 40%,#1e40af 100%);border-radius:20px;padding:28px 24px;margin-bottom:20px;position:relative;overflow:hidden"><div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(59,130,246,.25),transparent 70%);pointer-events:none"></div><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;position:relative;z-index:1"><div><div style="font-family:Bebas Neue,sans-serif;font-size:28px;letter-spacing:3px;color:#fff;text-shadow:0 2px 10px rgba(59,130,246,.4)">\u0130\u015E EMR\u0130 TAK\u0130P</div><div style="font-size:11px;color:#94a3b8;margin-top:2px">A\u015fama takibi \u2022 S\u00fcre \u00f6l\u00e7me \u2022 Canl\u0131 durum</div></div><button onclick="isEmriYeniModal()" style="padding:10px 20px;border:none;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-family:Bebas Neue,sans-serif;font-size:14px;letter-spacing:1px;cursor:pointer;box-shadow:0 4px 15px rgba(59,130,246,.4)">+ Yeni \u0130\u015f Emri</button></div><div id="ie-statlar" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:20px"></div></div><div style="display:flex;gap:4px;background:var(--bg2);border-radius:10px;padding:3px;margin-bottom:16px"><button onclick="isEmriFiltre(\'tumu\')" class="ie-tab ie-tab-aktif" style="padding:7px 14px;border:none;border-radius:8px;font-size:10px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif">T\u00fcm\u00fc</button><button onclick="isEmriFiltre(\'aktif\')" class="ie-tab" style="padding:7px 14px;border:none;border-radius:8px;font-size:10px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;background:transparent;color:var(--ink3)">Aktif</button><button onclick="isEmriFiltre(\'tamamlandi\')" class="ie-tab" style="padding:7px 14px;border:none;border-radius:8px;font-size:10px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;background:transparent;color:var(--ink3)">Tamamland\u0131</button></div><div id="ie-kartlar" style="display:grid;gap:14px"></div>';
      pgRef.parentNode.insertBefore(pg,pgRef);
    }
  }
})();

// ====== IS EMRI & IS TAKIP SISTEMI ======
var IE_ASAMALAR=[
{kod:'kabul',ad:'Kabul',ikon:'\u{1F4CB}',renk:'#3b82f6'},
{kod:'yikama',ad:'Y\u0131kama',ikon:'\u{1F9FD}',renk:'#06b6d4'},
{kod:'hazirlik',ad:'Haz\u0131rl\u0131k',ikon:'\u{1F527}',renk:'#f59e0b'},
{kod:'uygulama',ad:'Uygulama',ikon:'\u{1F3AF}',renk:'#ef4444'},
{kod:'kalite',ad:'Kalite Kontrol',ikon:'\u2705',renk:'#8b5cf6'},
{kod:'teslim',ad:'Teslim',ikon:'\u{1F697}',renk:'#10b981'}
];
var IE_DATA=[],IE_FILTRE='tumu';
(function(){if(document.getElementById('ie-pulse-css'))return;var s=document.createElement('style');s.id='ie-pulse-css';s.textContent='@keyframes iePulse{0%,100%{opacity:1}50%{opacity:.4}}';document.head.appendChild(s)})();

// Global click delegation
document.addEventListener('click',function(e){
var t=e.target.closest('[data-ie-aksiyon]');if(!t)return;
var ak=t.dataset.ieAksiyon,id=t.dataset.ieId,kod=t.dataset.ieKod,tel=t.dataset.ieTel;
if(ak==='detay')isEmriDetayModal(id);
else if(ak==='tamamla'){e.stopPropagation();isEmriAsamaTamamla(id,kod);}
else if(ak==='baslat'){e.stopPropagation();isEmriAsamaIlerle(id,kod);}
else if(ak==='not'){e.stopPropagation();isEmriNotEklePrompt(id,kod);}
else if(ak==='takip'){e.stopPropagation();isEmriTakipGonder(id,tel);}
else if(ak==='kapat'){var o=document.getElementById('ie-detay-ovl');if(o)o.remove();}
else if(ak==='yeni-modal')isEmriYeniModal();
else if(ak==='rdv-sec'){e.stopPropagation();isEmriOlusturFromModal(parseInt(t.dataset.ieIdx));}
});

async function isEmriSayfasiYukle(){
try{var r=await fetch('/api/is-emri',{credentials:'same-origin'});var d=await r.json();
if(!d.success){toast('Is emirleri yuklenemedi','red');return;}
IE_DATA=d.data||[];isEmriStatlariGuncelle(IE_DATA);isEmriKartlariCiz(IE_DATA);
}catch(e){console.error('IE:',e);}
}

function isEmriStatlariGuncelle(data){
var el=document.getElementById('ie-statlar');if(!el)return;
var bugun=new Date().toISOString().split('T')[0];
var aktif=data.filter(function(x){return x.durum==='aktif'}).length;
var bugunTam=data.filter(function(x){return x.durum==='tamamlandi'&&x.tamamlanma&&x.tamamlanma.startsWith(bugun)}).length;
var tamlar=data.filter(function(x){return x.durum==='tamamlandi'&&x.toplam_sure>0});
var ortSure=0;if(tamlar.length){ortSure=Math.round(tamlar.reduce(function(t,x){return t+x.toplam_sure},0)/tamlar.length)}
var kuyruk=data.filter(function(x){return x.durum==='aktif'&&x.mevcut_asama==='kabul'}).length;
var st=[
{l:'Aktif Is',v:aktif,r:'#3b82f6',i:'\u{1F527}'},
{l:'Bugun Tamamlanan',v:bugunTam,r:'#10b981',i:'\u2705'},
{l:'Ort. Sure',v:ortSure<60?ortSure+'dk':Math.floor(ortSure/60)+'s',r:'#f59e0b',i:'\u23F1'},
{l:'Kuyrukta',v:kuyruk,r:'#8b5cf6',i:'\u{1F4CB}'}
];
el.innerHTML=st.map(function(s){return '<div style="background:rgba(255,255,255,.06);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px 16px"><div style="font-size:20px;margin-bottom:4px">'+s.i+'</div><div style="font-family:Bebas Neue,sans-serif;font-size:24px;color:'+s.r+'">'+s.v+'</div><div style="font-size:9px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase">'+s.l+'</div></div>'}).join('');
}

function isEmriKartlariCiz(data){
var el=document.getElementById('ie-kartlar');if(!el)return;
var f=data;
if(IE_FILTRE==='aktif')f=data.filter(function(x){return x.durum==='aktif'});
else if(IE_FILTRE==='tamamlandi')f=data.filter(function(x){return x.durum==='tamamlandi'});
if(!f.length){el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink4)"><div style="font-size:36px;margin-bottom:8px">\u{1F4CB}</div><div style="font-size:13px">Henuz is emri bulunmuyor</div></div>';return;}
el.innerHTML='';
f.forEach(function(ie){
var asamalar=ie.asamalar||[];var mi=0;
IE_ASAMALAR.forEach(function(a,i){if(a.kod===ie.mevcut_asama)mi=i});
var ar=IE_ASAMALAR[mi].renk;
var dots='';
asamalar.forEach(function(a,i){var dn=a.durum==='tamamlandi',ac=a.durum==='devam';
dots+='<div style="flex:1;height:6px;border-radius:3px;background:'+(dn?'#22c55e':ac?ar:'var(--bd)')+';box-shadow:'+(ac?'0 0 6px '+ar+'66':'none')+(ac?';animation:iePulse 1.5s infinite':'')+'" title="'+IE_ASAMALAR[i].ad+'"></div>';
});
var st='';
if(ie.durum==='tamamlandi'&&ie.toplam_sure){var dk=ie.toplam_sure;st=dk<60?dk+'dk':Math.floor(dk/60)+'s '+dk%60+'dk';}
else if(ie.durum==='aktif'){var ilk=null;asamalar.forEach(function(a){if(a.baslama&&!ilk)ilk=a.baslama});if(ilk){var dk2=Math.round((Date.now()-new Date(ilk).getTime())/60000);st=dk2<60?dk2+'dk':Math.floor(dk2/60)+'s '+dk2%60+'dk';}}
var c=document.createElement('div');
c.dataset.ieAksiyon='detay';c.dataset.ieId=ie.id;
c.style.cssText='background:var(--w);border-radius:14px;overflow:hidden;cursor:pointer;transition:all .25s;box-shadow:0 2px 8px rgba(0,0,0,.06);border:1px solid var(--bd)';
c.onmouseover=function(){this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 25px rgba(0,0,0,.12)'};
c.onmouseout=function(){this.style.transform='none';this.style.boxShadow='0 2px 8px rgba(0,0,0,.06)'};
c.innerHTML='<div style="height:4px;background:linear-gradient(90deg,'+ar+','+ar+'88)"></div><div style="padding:16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div style="flex:0 0 auto"><div style="background:linear-gradient(135deg,'+ar+'22,'+ar+'11);border:1.5px solid '+ar+'44;border-radius:10px;padding:6px 12px;font-family:Bebas Neue,sans-serif;font-size:16px;letter-spacing:2px;color:'+ar+'">'+(ie.plaka||'\u2014')+'</div><div style="font-size:12px;font-weight:600;color:var(--ink);margin-top:6px">'+(ie.musteri||'\u2014')+'</div><div style="font-size:10px;color:var(--ink4);margin-top:2px">'+(ie.hizmet||'\u2014')+'</div></div><div style="flex:1;min-width:180px;display:flex;align-items:center;gap:4px;padding:0 8px">'+dots+'</div><div style="flex:0 0 auto;text-align:right"><div style="font-family:Bebas Neue,sans-serif;font-size:13px;letter-spacing:1px;color:'+ar+'">'+IE_ASAMALAR[mi].ikon+' '+IE_ASAMALAR[mi].ad+'</div>'+(st?'<div style="font-size:11px;color:var(--ink4);margin-top:2px">\u23F1 '+st+'</div>':'')+'<div style="margin-top:6px;padding:5px 14px;border:1.5px solid '+ar+'44;background:transparent;border-radius:8px;font-size:10px;font-weight:600;color:'+ar+';font-family:Outfit,sans-serif">Detay \u2192</div></div></div>';
el.appendChild(c);
});
}

function isEmriFiltre(tip){
IE_FILTRE=tip;
document.querySelectorAll('.ie-tab').forEach(function(b){b.classList.remove('ie-tab-aktif');b.style.background='transparent';b.style.color='var(--ink3)'});
if(event&&event.target){event.target.classList.add('ie-tab-aktif');event.target.style.background='var(--w)';event.target.style.color='var(--ink)'}
isEmriKartlariCiz(IE_DATA);
}

async function isEmriDetayModal(id){
try{var r=await fetch('/api/is-emri?id='+encodeURIComponent(id),{credentials:'same-origin'});var d=await r.json();
if(!d.success||!d.data){toast('Detay yuklenemedi','red');return;}isEmriDetayModalGoster(d.data);
}catch(e){var ie=IE_DATA.find(function(x){return x.id===id});if(ie)isEmriDetayModalGoster(ie);}
}

function isEmriDetayModalGoster(ie){
var eski=document.getElementById('ie-detay-ovl');if(eski)eski.remove();
var asamalar=ie.asamalar||[];var mi=0;
IE_ASAMALAR.forEach(function(a,i){if(a.kod===ie.mevcut_asama)mi=i});
var ar=IE_ASAMALAR[mi].renk;
var tl='';
asamalar.forEach(function(as,idx){
var a=IE_ASAMALAR[idx]||{ikon:'',ad:as.kod,renk:'#666'};
var dn=as.durum==='tamamlandi',ac=as.durum==='devam';
var ds,nc,lc;
if(dn){ds='background:rgba(34,197,94,.15);border:2px solid #22c55e;color:#22c55e';nc='#22c55e';lc='#22c55e';}
else if(ac){ds='background:rgba(59,130,246,.15);border:2px solid #3b82f6;color:#3b82f6;animation:iePulse 2s infinite';nc='#3b82f6';lc='#3b82f6';}
else{ds='background:var(--bg2);border:2px solid var(--bd);color:var(--ink4)';nc='var(--ink4)';lc='var(--bd)';}
var zm='';
if(dn){var bs=as.baslama?new Date(as.baslama).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}):'';var bt=as.bitis?new Date(as.bitis).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}):'';var sr=as.sure_dk?as.sure_dk+' dk':'';zm='<div style="font-size:10px;color:#10b981">'+bs+(bt?' \u2192 '+bt:'')+(sr?' ('+sr+')':'')+'</div>';}
else if(ac&&as.baslama){zm='<div style="font-size:10px;color:#3b82f6">'+new Date(as.baslama).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})+' \u2014 devam ediyor</div>';}
var btn='';
if(ac){btn='<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button data-ie-aksiyon="tamamla" data-ie-id="'+ie.id+'" data-ie-kod="'+a.kod+'" style="padding:5px 12px;border:none;border-radius:6px;background:#22c55e;color:#fff;font-size:10px;font-weight:600;cursor:pointer">\u2705 Tamamla</button><button data-ie-aksiyon="not" data-ie-id="'+ie.id+'" data-ie-kod="'+a.kod+'" style="padding:5px 12px;border:none;border-radius:6px;background:#3b82f6;color:#fff;font-size:10px;font-weight:600;cursor:pointer">\u{1F4DD} Not</button></div>';}
else if(!dn&&((idx>0&&asamalar[idx-1]&&asamalar[idx-1].durum==='tamamlandi')||idx===0)){btn='<div style="margin-top:8px"><button data-ie-aksiyon="baslat" data-ie-id="'+ie.id+'" data-ie-kod="'+a.kod+'" style="padding:5px 12px;border:1px solid '+a.renk+';border-radius:6px;background:transparent;color:'+a.renk+';font-size:10px;font-weight:600;cursor:pointer">\u25B6 Baslat</button></div>';}
var nt='';if(as.not){nt='<div style="margin-top:6px;padding:6px 10px;background:var(--bg2);border-radius:6px;font-size:10px;color:var(--ink3)">\u{1F4DD} '+as.not+'</div>';}
var ls=idx<asamalar.length-1?'position:absolute;left:17px;top:42px;bottom:-14px;width:2px;background:'+lc:'';
tl+='<div style="display:flex;gap:14px;padding:14px 0;position:relative">'+(ls?'<div style="'+ls+'"></div>':'')+'<div style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;z-index:1;'+ds+'">'+(dn?'\u2713':a.ikon)+'</div><div style="flex:1"><div style="font-family:Bebas Neue,sans-serif;font-size:15px;letter-spacing:1px;color:'+nc+'">'+a.ad+'</div>'+zm+btn+nt+'</div></div>';
});
var ts='';if(ie.toplam_sure){var dk=ie.toplam_sure;ts=dk<60?dk+'dk':Math.floor(dk/60)+'s '+dk%60+'dk';}
var hc=ie.durum==='tamamlandi'?'#059669':ar;
var ovl=document.createElement('div');ovl.id='ie-detay-ovl';
ovl.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
ovl.onclick=function(e){if(e.target===ovl)ovl.remove()};
var m=document.createElement('div');
m.style.cssText='width:100%;max-width:480px;max-height:90vh;background:var(--w);border-radius:20px;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,.25)';
m.innerHTML='<div style="background:linear-gradient(135deg,'+hc+','+hc+'cc);padding:20px;text-align:center"><div style="font-family:Bebas Neue,sans-serif;font-size:28px;letter-spacing:3px;color:#fff">'+(ie.plaka||'\u2014')+'</div><div style="font-size:12px;color:rgba(255,255,255,.8);margin-top:2px">'+(ie.musteri||'\u2014')+'</div><div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:2px">'+(ie.hizmet||'\u2014')+'</div>'+(ie.durum==='tamamlandi'?'<div style="display:inline-block;margin-top:8px;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,.2);font-size:10px;font-weight:700;color:#fff">\u2705 TAMAMLANDI</div>':'')+'<div style="font-size:9px;color:rgba(255,255,255,.5);margin-top:6px">Takip: '+ie.takip_kodu+'</div></div><div style="padding:20px">'+tl+'<div style="border-top:1px solid var(--bd);padding-top:14px;margin-top:10px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'+(ts?'<div style="font-size:12px;color:var(--ink4)">\u23F1 Toplam: <strong>'+ts+'</strong></div>':'')+'<div style="display:flex;gap:6px;flex-wrap:wrap">'+(ie.tel?'<button data-ie-aksiyon="takip" data-ie-id="'+ie.id+'" data-ie-tel="'+ie.tel+'" style="padding:6px 14px;border:1.5px solid #25D366;border-radius:8px;background:transparent;color:#128C7E;font-size:10px;font-weight:600;cursor:pointer">\u{1F4F1} Takip Link Gonder</button>':'')+'<button data-ie-aksiyon="kapat" style="padding:6px 14px;border:1.5px solid var(--bd);border-radius:8px;background:transparent;color:var(--ink);font-size:10px;font-weight:600;cursor:pointer">Kapat</button></div></div></div>';
ovl.appendChild(m);document.body.appendChild(ovl);
}

async function isEmriAsamaIlerle(id,kod){
try{var r=await fetch('/api/is-emri',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,aksiyon:'asama_baslat',asama_kod:kod})});
var d=await r.json();if(d.success){toast(kod+' baslatildi','green');var o=document.getElementById('ie-detay-ovl');if(o)o.remove();isEmriDetayModal(id);}else toast(d.error||'Hata','red');
}catch(e){toast('Baglanti hatasi','red');}
}

async function isEmriAsamaTamamla(id,kod){
try{var r=await fetch('/api/is-emri',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,aksiyon:'asama_tamamla',asama_kod:kod})});
var d=await r.json();if(d.success){toast(kod+' tamamlandi!','green');var o=document.getElementById('ie-detay-ovl');if(o)o.remove();isEmriDetayModal(id);isEmriSayfasiYukle();}else toast(d.error||'Hata','red');
}catch(e){toast('Baglanti hatasi','red');}
}

async function isEmriYeniModal(){
try{var r=await fetch('/api/randevular',{credentials:'same-origin'});var d=await r.json();
if(!d.success){toast('Randevular yuklenemedi','red');return;}var rl=d.data||[];if(!rl.length){toast('Randevu bulunmuyor','orange');return;}
// Gelecek randevulari filtrele ve en yakin tarihe gore sirala
var bugun=new Date();bugun.setHours(0,0,0,0);
rl=rl.filter(function(rv){
  if(!rv.tarih)return true;
  var parts=rv.tarih.split('.');
  var rvDate=parts.length===3?new Date(parts[2],parseInt(parts[1])-1,parts[0]):new Date(rv.tarih);
  return rvDate>=bugun;
});
rl.sort(function(a,b){
  var parseDate=function(rv){
    if(!rv.tarih)return new Date(9999,0);
    var p=rv.tarih.split('.');
    if(p.length===3)return new Date(p[2],parseInt(p[1])-1,p[0]);
    return new Date(rv.tarih);
  };
  return parseDate(a)-parseDate(b);
});
if(!rl.length){toast('Gelecek randevu bulunmuyor','orange');return;}
var eski=document.getElementById('ie-yeni-ovl');if(eski)eski.remove();
window._ieRdvListe=rl;
var ovl=document.createElement('div');ovl.id='ie-yeni-ovl';
ovl.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
ovl.onclick=function(e){if(e.target===ovl)ovl.remove()};
var m=document.createElement('div');m.style.cssText='width:100%;max-width:520px;max-height:85vh;background:var(--w);border-radius:20px;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,.25)';
// Header
var header=document.createElement('div');
header.style.cssText='background:linear-gradient(135deg,#0f172a,#1e40af);padding:20px 24px;border-radius:20px 20px 0 0';
header.innerHTML='<div style="font-family:Bebas Neue,sans-serif;font-size:20px;letter-spacing:3px;color:#fff">\u{1F4CB} RANDEVUDAN \u0130\u015E EMR\u0130</div><div style="font-size:11px;color:#94a3b8;margin-top:4px">Gelecek randevular \u2022 En yak\u0131n tarihten s\u0131ral\u0131</div>';
m.appendChild(header);
// Grup: Tarihe gore
var sonTarih='';
rl.forEach(function(rv,idx){
  var tarih=rv.tarih||'Tarihsiz';
  if(tarih!==sonTarih){
    var sep=document.createElement('div');
    sep.style.cssText='padding:10px 20px 4px;background:var(--bg2);font-size:10px;font-weight:700;color:var(--ink3);letter-spacing:1px;text-transform:uppercase;display:flex;align-items:center;gap:8px';
    // Tarih formatlama
    var parts=tarih.split('.');
    var gunAd='';
    if(parts.length===3){
      var dt=new Date(parts[2],parseInt(parts[1])-1,parts[0]);
      var gunler=['Pazar','Pazartesi','Sal\u0131','\u00c7ar\u015famba','Per\u015fembe','Cuma','Cumartesi'];
      gunAd=gunler[dt.getDay()];
      var now=new Date();now.setHours(0,0,0,0);
      var diff=Math.round((dt-now)/(1000*60*60*24));
      if(diff===0)gunAd='BUG\u00dcN';
      else if(diff===1)gunAd='YARIN';
    }
    sep.innerHTML='\u{1F4C5} '+tarih+(gunAd?' \u2014 '+gunAd:'');
    m.appendChild(sep);
    sonTarih=tarih;
  }
  var item=document.createElement('div');
  item.dataset.ieAksiyon='rdv-sec';item.dataset.ieIdx=idx;
  item.style.cssText='padding:14px 20px;border-bottom:1px solid var(--bd);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:14px';
  item.onmouseover=function(){this.style.background='var(--bg2)';this.style.paddingLeft='24px'};
  item.onmouseout=function(){this.style.background='transparent';this.style.paddingLeft='20px'};
  var hizmetText=Array.isArray(rv.hizmetler)?rv.hizmetler.join(', '):(rv.hizmet||'');
  var saatBadge=rv.saat?'<div style="padding:3px 8px;border-radius:6px;background:linear-gradient(135deg,#3b82f622,#2563eb11);border:1px solid #3b82f633;font-family:Bebas Neue,sans-serif;font-size:13px;letter-spacing:1px;color:#3b82f6">'+rv.saat+'</div>':'';
  var plakaBadge=rv.plaka?'<div style="display:inline-block;padding:2px 8px;border-radius:4px;background:#f1f5f9;border:1px solid #e2e8f0;font-family:Bebas Neue,sans-serif;font-size:11px;letter-spacing:1px;color:#475569;margin-top:4px">'+rv.plaka+'</div>':'';
  item.innerHTML='<div style="flex:0 0 auto">'+saatBadge+'</div><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(rv.musteri||'\u2014')+'</div>'+(hizmetText?'<div style="font-size:10px;color:var(--ink4);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+hizmetText+'</div>':'')+(plakaBadge?plakaBadge:'')+'</div><div style="flex:0 0 auto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink4)" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></div>';
  m.appendChild(item);
});
// Footer - randevu sayisi
var foot=document.createElement('div');
foot.style.cssText='padding:12px 20px;text-align:center;font-size:10px;color:var(--ink4);border-top:1px solid var(--bd)';
foot.textContent=rl.length+' gelecek randevu';
m.appendChild(foot);
ovl.appendChild(m);document.body.appendChild(ovl);
}catch(e){toast('Hata: '+e.message,'red');}
}
async function isEmriOlusturFromModal(idx){
var rdv=window._ieRdvListe[idx];if(!rdv)return;
try{var r=await fetch('/api/is-emri',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({musteri:rdv.musteri,tel:rdv.tel||'',plaka:rdv.plaka||'',arac:rdv.arac||'',hizmet:Array.isArray(rdv.hizmetler)?rdv.hizmetler.join(', '):(rdv.hizmet||''),tutar:rdv.tutar||0,randevu_id:rdv.id})});
var d=await r.json();if(d.success){toast('Is emri olusturuldu! Takip: '+d.takip_kodu,'green');var o=document.getElementById('ie-yeni-ovl');if(o)o.remove();isEmriSayfasiYukle();}else toast(d.error||'Hata','red');
}catch(e){toast('Baglanti hatasi','red');}
}

function isEmriOlustur(rdvIdx){
var r=typeof RANDEVULAR!=='undefined'?RANDEVULAR[rdvIdx]:null;if(!r)return;
fetch('/api/is-emri',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({musteri:r.musteri,tel:r.tel||'',plaka:r.plaka||'',arac:r.arac||'',hizmet:r.hizmet||'',tutar:r.tutar||0,randevu_id:r.id})})
.then(function(res){return res.json()}).then(function(d){if(d.success){toast('Is emri olusturuldu! Takip: '+d.takip_kodu,'green');isEmriDetayModal(d.id);}else toast(d.error||'Hata','red')});
}

function isEmriTakipGonder(id,tel){
var ie=IE_DATA.find(function(x){return x.id===id});
var t=(tel||'').replace(/\D/g,'');
if(t.startsWith('0'))t='90'+t.substring(1);
else if(t.startsWith('5')&&t.length===10)t='90'+t;
var link='https://autonax.com.tr/is-takip?kod='+(ie?ie.takip_kodu:'');
var asama=ie?ie.mevcut_asama:'';
var asamaAd='';var asamaIkon='';
if(ie){IE_ASAMALAR.forEach(function(a){if(a.kod===asama){asamaAd=a.ad;asamaIkon=a.ikon;}});}
var msg='*\u{1F3C1} AUTOCLUB SAMSUN*%0A'
+'\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500%0A%0A'
+'Merhaba '+(ie?ie.musteri:'')+' \u{1F44B}%0A%0A'
+'Arac\u0131n\u0131z\u0131n is emri olusturuldu ve sureci canli takip edebilirsiniz.%0A%0A'
+'\u{1F697} *Plaka:* '+(ie?ie.plaka:'')+'%0A'
+'\u{1F4CB} *Hizmet:* '+(ie?ie.hizmet:'')+'%0A'
+(asamaAd?asamaIkon+' *Durum:* '+asamaAd+'%0A':'')
+'%0A\u{1F517} *Canli Takip Linki:*%0A'+link+'%0A%0A'
+'\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500%0A'
+'\u{1F4CD} _AutoClub Samsun PPF & Detailing_';
window.open('https://wa.me/'+t+'?text='+msg,'_blank');
}

function isEmriNotEklePrompt(id,kod){
var n=prompt('Not giriniz:');if(!n)return;
fetch('/api/is-emri',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,aksiyon:'not_ekle',asama_kod:kod,not:n})})
.then(function(r){return r.json()}).then(function(d){if(d.success){toast('Not eklendi','green');var o=document.getElementById('ie-detay-ovl');if(o)o.remove();isEmriDetayModal(id);}else toast(d.error||'Hata','red')});
}

function isEmriOlusturVeyaGor(rdvIdx){
var r=typeof RANDEVULAR!=='undefined'?RANDEVULAR[rdvIdx]:null;if(!r)return;
fetch('/api/is-emri',{credentials:'same-origin'}).then(function(res){return res.json()}).then(function(d){
if(!d.success||!d.data)return;var m=d.data.find(function(ie){return ie.randevu_id===r.id});
if(m){var o=document.getElementById('rdv-duzenle-ovl');if(o)o.remove();isEmriDetayModal(m.id);}
else{if(!confirm('Bu randevu icin Is Emri olusturulsun mu?\n\n'+r.musteri+' \u2014 '+r.plaka+'\n'+r.hizmet))return;isEmriOlustur(rdvIdx);}
});
}
