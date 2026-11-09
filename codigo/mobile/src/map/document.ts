import assets from './leaflet-assets.json';
import { SANTOS_CENTER } from './geo';

// O mesmo documento e o mesmo motor geográfico são usados no Android e na web.
export function createMapDocument() {
  return `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https://tile.openstreetmap.org data:; base-uri 'none'; form-action 'none'; object-src 'none'">
<style>${assets.css}
html,body,#map{width:100%;height:100%;padding:0;margin:0}body{font-family:Arial,sans-serif}
.leaflet-control-attribution{font-size:11px!important;background:#fff!important;max-width:100%}
.leaflet-control-zoom a{width:36px!important;height:36px!important;line-height:36px!important}
.popup-title{font-weight:bold;margin-bottom:6px}.popup-detail{font-size:12px;color:#415567}
#status{position:absolute;top:10px;left:60px;right:10px;z-index:900;background:#fff;padding:8px;border-radius:8px;font-size:12px;color:#31445b;pointer-events:none}
</style></head><body><div id="map" aria-label="Mapa geográfico de Santos"></div><div id="status">Carregando o mapa de ruas…</div>
<script id="leaflet-library">${assets.js.replace(/<\/script/gi, '<\\/script')}</script>
<script id="hydropulse-map-app">
(function(){
  var map=L.map('map',{zoomControl:false,worldCopyJump:true}).setView([${SANTOS_CENTER.latitude},${SANTOS_CENTER.longitude}],13);
  L.control.zoom({position:'topleft',zoomInTitle:'Ampliar',zoomOutTitle:'Reduzir'}).addTo(map);
  L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
  var markers=L.featureGroup().addTo(map), selected=L.layerGroup().addTo(map), user=L.layerGroup().addTo(map);
  var status=document.getElementById('status'), loaded=0, failed=0, selectable=false, lastFocus=null, positioned=false;
  function send(message){message.channel='hydropulse-map';if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(message));else window.parent.postMessage(message,'*');}
  function notice(state){status.hidden=state==='ready';status.textContent=state==='error'?'Não foi possível carregar as ruas. Verifique a internet. Os relatos continuam salvos.':'Carregando o mapa de ruas…';send({type:'status',status:state});}
  var tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    minZoom:3,maxZoom:19,keepBuffer:0,updateWhenIdle:true,updateWhenZooming:false,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);
  tiles.on('loading',function(){loaded=0;failed=0;notice('loading');});
  tiles.on('tileload',function(){loaded++;notice('ready');});
  tiles.on('tileerror',function(){failed++;if(!loaded)notice('error');});
  tiles.on('load',function(){notice(loaded?'ready':failed?'error':'loading');});
  function valid(p){return p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;}
  function latlng(p){return [p.latitude,p.longitude];}
  function showSelection(p){selected.clearLayers();if(valid(p))L.circleMarker(latlng(p),{radius:11,color:'#fff',weight:3,fillColor:'#066FC4',fillOpacity:1,interactive:false}).addTo(selected);}
  function fit(){if(markers.getLayers().length)map.fitBounds(markers.getBounds(),{padding:[35,35],maxZoom:16});else map.setView([${SANTOS_CENTER.latitude},${SANTOS_CENTER.longitude}],13);}
  function update(data){
    if(!data||!Array.isArray(data.points))return;
    selectable=data.selectable===true;markers.clearLayers();user.clearLayers();
    data.points.forEach(function(point){if(!valid(point.coordinates))return;
      var marker=L.circleMarker(latlng(point.coordinates),{radius:9,color:'#fff',weight:2,fillColor:point.color,fillOpacity:0.95}).addTo(markers);
      var popup=document.createElement('div'),title=document.createElement('div'),detail=document.createElement('div'),button=document.createElement('button');
      title.className='popup-title';title.textContent=point.title;detail.className='popup-detail';detail.textContent=point.detail;
      button.textContent='Abrir detalhes';button.style.marginTop='10px';button.onclick=function(){send({type:'point',kind:point.kind,id:point.id});};
      popup.appendChild(title);popup.appendChild(detail);popup.appendChild(button);marker.bindPopup(popup);
    });
    showSelection(data.selection);
    if(valid(data.userLocation))L.circleMarker(latlng(data.userLocation),{radius:7,color:'#fff',weight:2,fillColor:'#0078DC',fillOpacity:1}).bindTooltip('Sua posição obtida pelo GPS').addTo(user);
    if(data.focus&&data.focus.id!==lastFocus){lastFocus=data.focus.id;positioned=true;if(data.focus.fit)fit();else if(valid(data.focus.coordinates))map.setView(latlng(data.focus.coordinates),data.focus.zoom||16);}
    else if(!positioned&&markers.getLayers().length){positioned=true;fit();}
    map.invalidateSize();
  }
  map.on('click',function(event){if(!selectable)return;var p=map.wrapLatLng(event.latlng);var coordinate={latitude:Number(p.lat.toFixed(6)),longitude:Number(p.lng.toFixed(6))};showSelection(coordinate);send({type:'select',coordinates:coordinate});});
  window.HydroPulseMap={update:update,retry:function(){tiles.redraw();},fit:fit};
  window.addEventListener('message',function(event){if(event.source!==window.parent)return;var m=event.data;if(m&&m.channel==='hydropulse-map'&&m.type==='update')update(m.payload);});
  if(window.ResizeObserver)new ResizeObserver(function(){map.invalidateSize();}).observe(document.getElementById('map'));
  send({type:'ready'});
})();
</script></body></html>`;
}
