/** Map view with cached OSM walking routes and sourced POI snapshots. */
import {walkingRoute} from './routes.js';
import {loadPOIs,getPOIs} from './pois.js';
export let mapReady = false;
let map = null;
let host = null;
let onSelect = () => {};
let visible = [];
let selected = null;
let poiCategory = null;
let in3D = true;
let markers = [];
let poiMarkers = [];
let popup = null;
let fallback = false;
let loadGuard = null;
let routeSnapshot = null;
let routeLoadFailed = false;
let fitPending=false;

const PENN = [-75.199, 39.955];
let DESTINATION = [-75.191997, 39.9518634];
let destinationName = 'Weitzman Hall';
const COLORS = {paper:'#eee7d7',ink:'#173d31',brick:'#a94f35',ochre:'#d3a13e',road:'#faf5e9'};
let POIS=[];
const SYMBOLS = {grocery:'G',pharmacy:'+',park:'P',gym:'F',transit:'T'};
const valid = p => typeof p?.lng === 'number' && typeof p?.lat === 'number' && Number.isFinite(p.lng) && Number.isFinite(p.lat) && Math.abs(p.lng)<=180 && Math.abs(p.lat)<=90;
const price = n => Number.isFinite(n)?'$'+Math.round(n).toLocaleString('en-US'):'Price unverified';
const groupPrice=group=>{const amounts=group.map(p=>p.baseRent).filter(Number.isFinite);return amounts.length?price(Math.min(...amounts)):'View homes';};
const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function groups() {
  const grouped = new Map();
  visible.filter(valid).forEach(p=>{
    const key=`${Number(p.lng).toFixed(4)},${Number(p.lat).toFixed(4)}`;
    if(!grouped.has(key)) grouped.set(key,[]);
    grouped.get(key).push(p);
  });
  return [...grouped.values()];
}

function routeGeometry() {
  const p=visible.find(p=>p.id===selected);
  const live=p?.liveRoute;
  const snapshot=live||p?.sourceKind==='live-web-search'?(live?{destination:live.destination,provider:live.provider,retrievedAt:live.retrievedAt,routes:{[[p.lng,p.lat].join(',')]:live}}:null):routeSnapshot;
  const feature=valid(p)?walkingRoute(snapshot,p,DESTINATION):null;
  return {type:'FeatureCollection',features:feature?[feature]:[]};
}

function updateRouteStatus() {
  const status=document.getElementById('map-route-status');
  if(!status)return;
  const feature=routeGeometry().features[0];
  const isLive=visible.find(p=>p.id===selected)?.sourceKind==='live-web-search';
  status.textContent=fallback?'Route unavailable in diagram view':!selected?'Select a home to see its walking route':feature?`Walking route · ${(feature.properties.distance/1000).toFixed(2)} km · ${isLive?'geocoded endpoints':'sample endpoints'}`:!routeSnapshot&&!routeLoadFailed?'Loading walking route…':'Walking route unavailable for this location';
}

async function loadWalkingRoutes() {
  try{
    const response=await fetch(new URL('./assets/walking-routes.json',import.meta.url));
    if(!response.ok)throw new Error('Route snapshot unavailable');
    routeSnapshot=await response.json();
  }catch{routeLoadFailed=true;}
  if(mapReady&&map)map.getSource('fmh-route')?.setData(routeGeometry());
  updateRouteStatus();
}

function tuneStyle() {
  const layers=map.getStyle()?.layers||[];
  for(const layer of layers) {
    const id=layer.id.toLowerCase();
    try {
      if(layer.type==='background') map.setPaintProperty(layer.id,'background-color',COLORS.paper);
      if(layer.type==='fill') {
        if(/water/.test(id)) map.setPaintProperty(layer.id,'fill-color','#a7bfb4');
        else if(/park|wood|forest|grass|landcover|landuse_green/.test(id)) map.setPaintProperty(layer.id,'fill-color','#a8b59a');
        else if(/building/.test(id)) map.setPaintProperty(layer.id,'fill-color','#c8b8a1');
      }
      if(layer.type==='line' && /road|transportation/.test(id) && !/rail/.test(id)) {
        map.setPaintProperty(layer.id,'line-color',/casing/.test(id)?'#d1c3ad':COLORS.road);
      }
      if(layer.type==='symbol') {
        map.setPaintProperty(layer.id,'text-color','#3b4c3d');
        map.setPaintProperty(layer.id,'text-halo-color','#f2eddf');
      }
    } catch { /* Some style layers contain icons without text paint. */ }
  }
  const style=map.getStyle();
  const buildingLayer=style.layers.find(l=>l['source-layer']==='building' && l.source);
  const source=buildingLayer?.source || (style.sources.openmaptiles?'openmaptiles':null);
  if(source && !map.getLayer('fmh-buildings')) {
    const firstLabel=style.layers.find(l=>l.type==='symbol')?.id;
    try {
      map.addLayer({id:'fmh-buildings',source,'source-layer':'building',type:'fill-extrusion',minzoom:13,
        paint:{'fill-extrusion-color':'#b69b7d','fill-extrusion-height':['interpolate',['linear'],['zoom'],13,0,15,['coalesce',['to-number',['get','render_height']],['to-number',['get','height']],7]],'fill-extrusion-base':['coalesce',['to-number',['get','render_min_height']],0],'fill-extrusion-opacity':0.76},
        layout:{visibility:in3D?'visible':'none'}},firstLabel);
    } catch { /* Base map remains usable if a provider lacks building polygons. */ }
  }
  if(!map.getSource('fmh-route')) {
    map.addSource('fmh-route',{type:'geojson',data:routeGeometry()});
    map.addLayer({id:'fmh-route-casing',type:'line',source:'fmh-route',paint:{'line-color':'#fff8e7','line-width':7,'line-opacity':0.85}});
    map.addLayer({id:'fmh-route',type:'line',source:'fmh-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':COLORS.brick,'line-width':3}});
  }
}

function clearMarkers() {markers.forEach(m=>m.remove());markers=[];poiMarkers.forEach(m=>m.remove());poiMarkers=[];}

function updateMarkerLabels() {
  if(!map || !mapReady) return;
  const width=host.clientWidth;
  markers.forEach(marker=>{
    const el=marker.getElement();
    if(!el.classList.contains('fmh-home-marker'))return;
    const point=map.project(marker.getLngLat());
    el.classList.toggle('compact',map.getZoom()<14.7 || point.x<65 || point.x>width-65 || point.y<50);
  });
}

function showGroup(group, marker) {
  if(popup) popup.remove();
  const box=document.createElement('div');
  box.style.cssText='font-family:inherit;color:#173d31;min-width:190px;padding:4px';
  const heading=document.createElement('strong');heading.textContent=group[0].name;box.append(heading);
  const note=document.createElement('p');note.textContent=(group[0].sourceKind==='live-web-search'?'Web research':'Saved sample')+' · all-in cost unverified';note.style.cssText='font-size:11px;margin:6px 0 10px';box.append(note);
  group.forEach(p=>{const button=document.createElement('button');button.type='button';button.textContent=`${p.unit||p.type} · ${price(p.baseRent)}`;button.style.cssText='display:block;width:100%;padding:9px 4px;text-align:left;border:0;border-top:1px solid #d4c9b4;background:transparent;color:#173d31;cursor:pointer;font:inherit;font-size:12px';button.onclick=()=>{onSelect(p.id);focusProperty(p);popup?.remove();};box.append(button);});
  popup=new globalThis.maplibregl.Popup({offset:20,closeButton:true,maxWidth:'280px'}).setLngLat(marker.getLngLat()).setDOMContent(box).addTo(map);
}

function renderMarkers() {
  if(!mapReady||fallback||!map) return;
  clearMarkers();
  groups().forEach(group=>{
    const isSelected=group.some(p=>p.id===selected);
    const el=document.createElement('button');el.type='button';
    el.className='fmh-home-marker'+(isSelected?' selected':'');
    const dot=document.createElement('span');dot.className='home-marker-dot';dot.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.className='home-marker-price';
    label.textContent=groupPrice(group)+(group.length>1?` · ${group.length}`:'');
    el.append(dot,label);
    el.title=`${group[0].name}: ${group.length} saved option${group.length===1?'':'s'}. Starting amounts, additional costs unverified.`;
    el.setAttribute('aria-label',el.title);
    const marker=new globalThis.maplibregl.Marker({element:el,anchor:'center',pitchAlignment:'viewport',rotationAlignment:'viewport'}).setLngLat([group[0].lng,group[0].lat]).addTo(map);
    el.addEventListener('click',e=>{e.stopPropagation();const p=group.find(p=>p.id===selected)||group[0];onSelect(p.id);showGroup(group,marker);});
    markers.push(marker);
  });
  const destination=document.createElement('div');destination.className='destination-marker';destination.textContent=destinationName==='Weitzman Hall'?'W':'D';destination.title=destinationName+' · destination';destination.setAttribute('aria-label',destinationName+' destination');destination.style.cssText='width:29px;height:29px;display:grid;place-items:center;border:2px solid #fff7e5;background:#d3a13e;color:#173d31;font:bold 15px Georgia,serif;box-shadow:0 0 0 1px #173d31;';
  markers.push(new globalThis.maplibregl.Marker({element:destination}).setLngLat(DESTINATION).addTo(map));
  const category=poiCategory==='all'?'all':poiCategory;
  POIS.filter(p=>category==='all'||p.category===category).forEach(p=>{
    const el=document.createElement('button');el.type='button';el.className='poi-marker';el.textContent=SYMBOLS[p.category];el.title=p.name;el.setAttribute('aria-label',p.name);el.style.cssText='width:23px;height:23px;border-radius:50%;border:1px solid #173d31;padding:0;background:#efe5ca;color:#173d31;display:grid;place-items:center;font:700 11px Arial,sans-serif;box-shadow:0 1px 3px #173d3122;';
    poiMarkers.push(new globalThis.maplibregl.Marker({element:el}).setLngLat(p.coordinates).addTo(map));
    el.onclick=e=>{e.stopPropagation();popup?.remove();const box=document.createElement('div');box.style.cssText='font:12px/1.6 Arial,sans-serif;color:#173d31';const name=document.createElement('strong');name.textContent=p.name;box.append(name);const info=document.createElement('p');info.textContent=`${p.subtype||p.category} · OSM snapshot. ${p.coordinateType==='bounding_box_center'?'Area center, not a verified entrance. ':''}${p.access?'Access: '+p.access+'. ':''}Opening and public access require checking.`;box.append(info);const source=document.createElement('a');source.href=p.sources[0].url;source.target='_blank';source.rel='noopener noreferrer';source.textContent='View OSM source';box.append(source);popup=new globalThis.maplibregl.Popup({offset:14}).setLngLat(p.coordinates).setDOMContent(box).addTo(map);};
  });
  map.getSource('fmh-route')?.setData(routeGeometry());
  updateRouteStatus();
  updateMarkerLabels();
}

function renderFallback(reason='Interactive map unavailable') {
  if(!host)return;
  fallback=true;mapReady=false;clearTimeout(loadGuard);
  try{map?.remove();}catch{} map=null;
  if(DESTINATION[0]!==-75.191997 || DESTINATION[1]!==39.9518634){
    host.textContent='Interactive map unavailable. See the report for walking times.';
    updateRouteStatus();
    return;
  }
  const minLng=-75.213,maxLng=-75.185,minLat=39.947,maxLat=39.965;
  const xy=coords=>[(coords[0]-minLng)/(maxLng-minLng)*900,(maxLat-coords[1])/(maxLat-minLat)*600];
  const streets=[];
  for(let i=0;i<10;i++){const x=55+i*88;streets.push(`<path d="M${x} 0V600"/>`);}
  for(let i=0;i<8;i++){const y=45+i*75;streets.push(`<path d="M0 ${y}H900"/>`);}
  const pins=groups().map(group=>{const [x,y]=xy([group[0].lng,group[0].lat]);const active=group.some(p=>p.id===selected);return `<g data-map-property="${escape(group[0].id)}" tabindex="0" role="button" aria-label="${escape(group[0].name)}" style="cursor:pointer"><title>${escape(group[0].name)} · ${groupPrice(group)}</title><circle cx="${x}" cy="${y}" r="15" fill="transparent"/><circle cx="${x}" cy="${y}" r="7" fill="${active?COLORS.brick:COLORS.ink}" stroke="#fff6df" stroke-width="2"/></g>`;}).join('');
  const [dx,dy]=xy(DESTINATION);
  // The schematic streets do not represent the real network, so omit routes here.
  const coords=[];
  const path=coords.map((c,i)=>{const [x,y]=xy(c);return `${i?'L':'M'}${x} ${y}`;}).join(' ');
  const pois=POIS.filter(p=>poiCategory==='all'||p.category===poiCategory).map(p=>{const [x,y]=xy(p.coordinates);return `<g><circle cx="${x}" cy="${y}" r="12" fill="#d3a13e" stroke="#173d31"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="12" fill="#173d31">${SYMBOLS[p.category]}</text></g>`;}).join('');
  host.innerHTML=`<div style="height:100%;min-height:300px;position:relative;background:#eee7d7;overflow:hidden"><svg viewBox="0 0 900 600" style="width:100%;height:100%;position:absolute;inset:0" aria-label="Illustrative property location diagram"><rect width="900" height="600" fill="#eee7d7"/><path d="M670 0L690 600H790L760 0Z" fill="#b2c5b9"/><g fill="none" stroke="#fcf8ec" stroke-width="17">${streets.join('')}</g><g fill="none" stroke="#cbbda5" stroke-width="1">${streets.join('')}</g><rect x="580" y="345" width="95" height="100" fill="#a7b497"/><text x="610" y="485" fill="#8c826d" font-family="Georgia,serif" font-size="22">UNIVERSITY CITY</text>${path?`<path d="${path}" stroke="#a94f35" stroke-width="4" fill="none" stroke-dasharray="9 5"/>`:''}${pois}${pins}<g><rect x="${dx-15}" y="${dy-15}" width="30" height="30" fill="#d3a13e" stroke="#173d31"/><text x="${dx}" y="${dy+5}" text-anchor="middle" fill="#173d31" font-size="15">W</text></g></svg><div style="position:absolute;bottom:16px;left:16px;right:16px;padding:10px 12px;background:#f7f1e5e8;border:1px solid #c7baa1;color:#173d31;font:12px/1.4 Arial,sans-serif">${escape(reason)}. Showing a clickable illustrative diagram, not a navigable basemap. Schematic view only; source POI coordinates are not a navigable basemap.</div></div>`;
  host.querySelectorAll('[data-map-property]').forEach(el=>{const activate=()=>onSelect(el.dataset.mapProperty);el.addEventListener('click',activate);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});});
  updateRouteStatus();
}

export function initMap(containerId, selectCallback) {
  host=typeof containerId==='string'?document.getElementById(containerId):containerId;
  onSelect=typeof selectCallback==='function'?selectCallback:()=>{};
  if(!host)throw new Error('Map container was not found.');
  loadWalkingRoutes();
  loadPOIs().then(()=>{POIS=getPOIs('all');if(fallback)renderFallback();else renderMarkers();}).catch(()=>{POIS=[];});
  const lib=globalThis.maplibregl;
  if(!lib?.Map || (typeof lib.supported==='function'&&!lib.supported())){renderFallback('WebGL map is unavailable');return null;}
  try{
    map=new lib.Map({container:host,style:'https://tiles.openfreemap.org/styles/liberty',center:PENN,zoom:14.4,pitch:in3D?42:0,bearing:in3D?-12:0,attributionControl:true,maxPitch:65});
    if(lib.NavigationControl)map.addControl(new lib.NavigationControl({showCompass:true}),'bottom-right');
    map.on('load',()=>{clearTimeout(loadGuard);fallback=false;mapReady=true;tuneStyle();renderMarkers();if(fitPending)fitHousingMap();});
    map.on('move',updateMarkerLabels);
    map.on('error',()=>{ /* Network error becomes a meaningful fallback if style cannot finish. */ });
    loadGuard=setTimeout(()=>{if(!mapReady)renderFallback('Map tiles could not be loaded');},16000);
    return map;
  }catch{renderFallback('WebGL map could not start');return null;}
}

export function updateMap(properties=[], selectedId=null, category=null, destination=null) {
  if(destination){DESTINATION=destination.coordinates;destinationName=destination.name;}
  visible=Array.isArray(properties)?properties:[];selected=selectedId;poiCategory=category;
  if(fallback)renderFallback();else renderMarkers();
}

export function focusProperty(property) {
  if(!property)return;
  selected=property.id;
  if(fallback){renderFallback();return;}
  if(mapReady&&map&&valid(property)){renderMarkers();map.flyTo({center:[property.lng,property.lat],zoom:15.1,pitch:in3D?45:0,duration:650,essential:false});}
}

export function setMapMode(is3D) {
  in3D=Boolean(is3D);
  if(mapReady&&map){if(map.getLayer('fmh-buildings'))map.setLayoutProperty('fmh-buildings','visibility',in3D?'visible':'none');map.easeTo({pitch:in3D?45:0,bearing:in3D?-12:0,duration:550,essential:false});}
}

export function resetMap() {
  popup?.remove();
  if(destinationName!=='Weitzman Hall'||visible.some(p=>p.sourceKind==='live-web-search')){fitHousingMap();return;}
  if(mapReady&&map)map.flyTo({center:PENN,zoom:14.4,pitch:in3D?42:0,bearing:in3D?-12:0,duration:650,essential:false});
  else if(fallback)renderFallback();
}

export function fitHousingMap(){
  if(!mapReady||!map){fitPending=true;return;}
  fitPending=false;
  const points=visible.filter(p=>valid(p)&&Math.abs(p.lng-DESTINATION[0])<0.25&&Math.abs(p.lat-DESTINATION[1])<0.25);
  const bounds=new globalThis.maplibregl.LngLatBounds();bounds.extend(DESTINATION);
  points.forEach(p=>bounds.extend([p.lng,p.lat]));
  map.fitBounds(bounds,{padding:{top:75,bottom:95,left:65,right:65},maxZoom:14.8,duration:650,essential:false});
}
