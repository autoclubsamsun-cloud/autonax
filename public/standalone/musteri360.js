// ====== MUSTERI 360 GORUNUMU ======
function musteri360Ac(){
  if(typeof musteriListesiOlustur!=='function'){alert('Musteri verileri henuz yuklenmedi.');return;}
  var all=musteriListesiOlustur();
  if(!all||!all.length){alert('Henuz musteri kaydi bulunamadi.');return;}
  var eski=document.getElementById('m360-ovl');
  if(eski)eski.remove();
  var ovl=document.createElement('div');
  ovl.id='m360-ovl';
  ovl.style.cssText='position:fixed;inset:0;z-index:990;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
  ovl.onclick=function(e){if(e.target===ovl)ovl.remove();};
  var renkler=['#B01C2E','#1e40af','#065f46','#92400e','#4c1d95','#831843','#0e7490','#be185d'];
  var topMst=all.length;
  var topOdenen=all.reduce(function(s,m){return s+m.toplamOdenen;},0);
  var topKalan=all.reduce(function(s,m){return s+m.toplamKalan;},0);
  var tekrarMst=all.filter(function(m){return m.rdvSayisi>1;}).length;
  ovl.innerHTML=''
    +'<div style="background:#fff;border-radius:20px;width:100%;max-width:1100px;max-height:92vh;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,.3);display:flex;flex-direction:column">'
      +'<div style="background:linear-gradient(135deg,#312e81,#4338ca);padding:20px 24px;flex-shrink:0">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'
          +'<div>'
            +'<div style="font-family:Bebas Neue,sans-serif;font-size:24px;letter-spacing:3px;color:#fff">MUSTERI 360\u00b0</div>'
            +'<div style="font-size:11px;color:#a5b4fc">Tum musteri verileri tek ekranda</div>'
          +'</div>'
          +'<div onclick="document.getElementById(\'m360-ovl\').remove()" style="cursor:pointer;color:#a5b4fc;font-size:28px;line-height:1">&times;</div>'
        +'</div>'
        +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">'
          +'<div style="background:rgba(255,255,255,.1);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px;text-align:center"><div style="font-family:Bebas Neue,sans-serif;font-size:26px;color:#fff">'+topMst+'</div><div style="font-size:9px;color:#a5b4fc;text-transform:uppercase;letter-spacing:1px">Musteri</div></div>'
          +'<div style="background:rgba(255,255,255,.1);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px;text-align:center"><div style="font-family:Bebas Neue,sans-serif;font-size:26px;color:#34d399">\u20ba'+topOdenen.toLocaleString('tr-TR').replace(/\.\d+/,'')+'</div><div style="font-size:9px;color:#a5b4fc;text-transform:uppercase;letter-spacing:1px">Odenen</div></div>'
          +'<div style="background:rgba(255,255,255,.1);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px;text-align:center"><div style="font-family:Bebas Neue,sans-serif;font-size:26px;color:'+(topKalan>0?'#fca5a5':'#34d399')+'">\u20ba'+topKalan.toLocaleString('tr-TR').replace(/\.\d+/,'')+'</div><div style="font-size:9px;color:#a5b4fc;text-transform:uppercase;letter-spacing:1px">Kalan</div></div>'
          +'<div style="background:rgba(255,255,255,.1);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px;text-align:center"><div style="font-family:Bebas Neue,sans-serif;font-size:26px;color:#fbbf24">'+tekrarMst+'</div><div style="font-size:9px;color:#a5b4fc;text-transform:uppercase;letter-spacing:1px">Tekrar Eden</div></div>'
        +'</div>'
      +'</div>'
      +'<div style="padding:14px 20px;border-bottom:1px solid #e2e8f0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;flex-shrink:0">'
        +'<div style="position:relative;flex:1;min-width:200px">'
          +'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#94a3b8" stroke-width="2" style="position:absolute;left:10px;top:50%;transform:translateY(-50%)"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
          +'<input type="text" id="m360-arama" placeholder="Isim, telefon, plaka ile ara..." oninput="m360Filtrele()" style="width:100%;padding:9px 10px 9px 32px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:12px;font-family:Outfit,sans-serif;outline:none;transition:border .2s" onfocus="this.style.borderColor=\'#6366f1\'" onblur="this.style.borderColor=\'#e2e8f0\'">'
        +'</div>'
        +'<div style="display:flex;gap:4px;background:#f1f5f9;border-radius:8px;padding:3px">'
          +'<button onclick="m360SiralaVeGoster(\'rdv\')" class="m360-tab" style="padding:6px 12px;border:none;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;background:#fff;color:#1e293b;box-shadow:0 1px 2px rgba(0,0,0,.08)">En Cok Randevu</button>'
          +'<button onclick="m360SiralaVeGoster(\'tutar\')" class="m360-tab" style="padding:6px 12px;border:none;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;background:transparent;color:#94a3b8">En Yuksek Tutar</button>'
          +'<button onclick="m360SiralaVeGoster(\'borclu\')" class="m360-tab" style="padding:6px 12px;border:none;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;font-family:Outfit,sans-serif;background:transparent;color:#94a3b8">Borclular</button>'
        +'</div>'
      +'</div>'
      +'<div id="m360-kartlar" style="overflow-y:auto;flex:1">'
        +m360KartlarHTML(all.sort(function(a,b){return b.rdvSayisi-a.rdvSayisi;}))
      +'</div>'
    +'</div>';
  document.body.appendChild(ovl);
  window._m360Liste=all;
  window._m360Sort='rdv';
  setTimeout(function(){var inp=document.getElementById('m360-arama');if(inp)inp.focus();},200);
}

function m360Filtrele(){
  var q=(document.getElementById('m360-arama')||{}).value||'';
  q=q.toLowerCase().trim();
  var all=window._m360Liste||[];
  var filtered=q?all.filter(function(m){
    return m.isim.toLowerCase().indexOf(q)>-1||m.tel.indexOf(q)>-1||m.plakalar.join(' ').toLowerCase().indexOf(q)>-1;
  }):all.slice();
  if(window._m360Sort==='tutar')filtered.sort(function(a,b){return b.toplamTutar-a.toplamTutar;});
  else if(window._m360Sort==='borclu'){filtered=filtered.filter(function(m){return m.toplamKalan>0;});filtered.sort(function(a,b){return b.toplamKalan-a.toplamKalan;});}
  else filtered.sort(function(a,b){return b.rdvSayisi-a.rdvSayisi;});
  var el=document.getElementById('m360-kartlar');
  if(el)el.innerHTML=m360KartlarHTML(filtered);
}

function m360SiralaVeGoster(tip){
  window._m360Sort=tip;
  var tabs=document.querySelectorAll('.m360-tab');
  tabs.forEach(function(t){t.style.background='transparent';t.style.color='#94a3b8';t.style.boxShadow='none';});
  event.target.style.background='#fff';event.target.style.color='#1e293b';event.target.style.boxShadow='0 1px 2px rgba(0,0,0,.08)';
  m360Filtrele();
}

function m360KartlarHTML(liste){
  if(!liste.length)return '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:13px">Sonuc bulunamadi</div>';
  var renkler=['#B01C2E','#1e40af','#065f46','#92400e','#4c1d95','#831843','#0e7490','#be185d'];
  return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;padding:20px">'
    +liste.map(function(m){
      var harf=m.isim.split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
      var renk=renkler[m.isim.charCodeAt(0)%renkler.length];
      var plkHTML=m.plakalar.slice(0,3).map(function(p){
        return '<span style="padding:2px 6px;background:rgba(99,102,241,.1);border-radius:4px;font-size:9px;font-weight:600;color:#6366f1">'+p+'</span>';
      }).join(' ');
      var borcDurum=m.toplamKalan>0
        ?'<span style="color:#dc2626;font-weight:700">\u20ba'+m.toplamKalan.toLocaleString('tr-TR').replace(/\.\d+/,'')+'</span>'
        :'<span style="color:#16a34a;font-weight:700">\u2713 Odendi</span>';
      var telSafe=(m.tel||'').replace(/'/g,"\\'");
      return '<div style="background:#fff;border-radius:14px;overflow:hidden;border:1.5px solid #e2e8f0;cursor:pointer;transition:all .2s" onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 8px 25px rgba(0,0,0,.12)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'none\'" onclick="document.getElementById(\'m360-ovl\').remove();_mstSonListe=musteriListesiOlustur();var _i=-1;for(var j=0;j<_mstSonListe.length;j++){if(_mstSonListe[j].tel===\''+telSafe+'\'){_i=j;break;}}if(_i>=0)mstDetayAc(_i);">'
        +'<div style="padding:14px 16px">'
          +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
            +'<div style="width:40px;height:40px;border-radius:10px;background:'+renk+';display:flex;align-items:center;justify-content:center;color:#fff;font-family:Bebas Neue,sans-serif;font-size:16px;flex-shrink:0">'+harf+'</div>'
            +'<div style="flex:1;min-width:0">'
              +'<div style="font-family:Bebas Neue,sans-serif;font-size:15px;letter-spacing:.5px;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+m.isim.toUpperCase()+'</div>'
              +'<div style="font-size:10px;color:#94a3b8">\ud83d\udcf1 '+(m.tel||'-')+'</div>'
            +'</div>'
          +'</div>'
          +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">'
            +'<div style="text-align:center;padding:8px 4px;background:#f8fafc;border-radius:8px"><div style="font-family:Bebas Neue,sans-serif;font-size:18px;color:#1e293b">'+m.rdvSayisi+'</div><div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Randevu</div></div>'
            +'<div style="text-align:center;padding:8px 4px;background:#f0fdf4;border-radius:8px"><div style="font-family:Bebas Neue,sans-serif;font-size:18px;color:#16a34a">\u20ba'+(m.toplamOdenen||0).toLocaleString('tr-TR').replace(/\.\d+/,'')+'</div><div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Odenen</div></div>'
            +'<div style="text-align:center;padding:8px 4px;background:'+(m.toplamKalan>0?'#fef2f2':'#f0fdf4')+';border-radius:8px"><div style="font-family:Bebas Neue,sans-serif;font-size:18px;color:'+(m.toplamKalan>0?'#dc2626':'#16a34a')+'">\u20ba'+(m.toplamKalan||0).toLocaleString('tr-TR').replace(/\.\d+/,'')+'</div><div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Kalan</div></div>'
          +'</div>'
          +(plkHTML?'<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">'+plkHTML+'</div>':'')
          +'<div style="font-size:10px;text-align:right">'+borcDurum+'</div>'
        +'</div>'
      +'</div>';
    }).join('')
  +'</div>';
}
