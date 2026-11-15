import {properties,defaultProfile,openSearchProfile,defaultDestination,normalizeDestination,validCoordinates,evaluate,dataDisclaimer,snapshotDate} from './engine.js';
import {initMap,updateMap,focusProperty,setMapMode,resetMap,fitHousingMap} from './map.js';
import {loadPOIs,nearestPOIs} from './pois.js';
import {normalizeLiveCatalog} from './catalog.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number.isFinite(n)?'$'+Math.round(n).toLocaleString('en-US'):'Unverified';
const walkingLabel=p=>Number.isFinite(p.walkMinutes)?p.walkMinutes+' min':'Unverified';
const icons={
report:'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',compare:'M4 5h6v14H4zM14 5h6v14h-6z',bookmark:'M6 3h12v18l-6-4-6 4z',info:'M12 8h.01M11 12h1v5M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',pin:'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0zM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',chevron:'m7 10 5 5 5-5',arrow:'M5 12h14m-5-5 5 5-5 5',wallet:'M3 6h16v15H3zM3 6V3h14v3M15 12h6v5h-6z',bed:'M3 20V7m18 13V7M3 17h18M3 11h18v6M6 11V6h12v5M12 6v5',laundry:'M4 3h16v19H4zM7 6h1m3 0h1m5 9a5 5 0 1 1-10 0 5 5 0 0 1 10 0',walk:'M14 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0M10 9l3-2 3 4 4 1M4 13l4-1 2-4m3-1-2 8-4 7m4-7 5 3 1 4',sliders:'M3 6h18M3 12h18M3 18h18M8 3v6M16 9v6M10 15v6',layers:'m12 3 10 5-10 5L2 8zm-9 9 9 5 9-5M3 17l9 5 9-5',expand:'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6',basket:'M3 9h18l-2 12H5zM7 9l5-7 5 7M9 13v4m6-4v4',tree:'m12 2-6 7h3l-5 7h7v6h2v-6h7l-5-7h3z',train:'M5 3h14v14H5zM5 11h14M8 3v8m8-8v8M8 15h.01M16 15h.01M8 17l-3 5m11-5 3 5M7 20h10',plus:'M12 4v16M4 12h16',gym:'M3 9v6m3-9v12M6 12h12m0-6v12m3-9v6',building:'M4 22V8l8-5 8 5v14M1 22h22M8 10h2m4 0h2M8 14h2m4 0h2M10 22v-5h4v5',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',print:'M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v8H6zM17 11h.01',send:'m3 3 19 9-19 9 4-9zm4 9h15',close:'m5 5 14 14M5 19 19 5',chat:'M3 3h18v14H9l-6 5z',check:'m5 12 4 4 10-10'};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]||icons.info}"/></svg>`;}
function mountIcons(scope=document){scope.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
mountIcons();

const pagesDemo=location.hostname.endsWith('.github.io');
const liveSite='https://blockwise-rental-lab.knowinglorikeet.chatgpt.site/';
const state={profile:structuredClone(openSearchProfile),selectedId:null,compared:new Set(),sort:'fit',poi:null,view:'report',messages:[],showExcluded:false,map3d:true,catalog:[],searchInfo:null,mapOnly:true};
const storage={get(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback;}catch{return fallback;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}}};
state.destination=normalizeDestination(storage.get('find-my-home-commute',null));
let commuteRoutes={}, commuteBusy=false;
let result=evaluate(state.profile), toastTimer;

function commuteCatalog(){
  return (state.catalog??properties).map(home=>{
    if(state.destination===defaultDestination&&home.sourceKind!=='live-web-search')return home;
    const key=[home.lng,home.lat].join(',');
    const route=commuteRoutes[key]??home.liveRoute;
    const matched=route?.destination?.join(',')===state.destination.coordinates.join(',');
    return {...home,liveRoute:matched?route:null,walkMinutes:matched?Math.ceil(route.duration/60):null};
  });
}

async function lookupCommute(name,address){
  const starts=(state.mapOnly?[]:state.catalog??properties).map(p=>[p.lng,p.lat]).filter(validCoordinates);
  const response=await fetch('/api/commute',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name,address,starts}),signal:AbortSignal.timeout(40000)
  });
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'The destination could not be saved.');
  return data;
}

function applyCommute(destination,routes={}){
  state.destination=destination;
  commuteRoutes=routes;
  storage.set('find-my-home-commute',destination===defaultDestination?null:destination);
  render();
  fitHousingMap();
}

async function refreshCommute(){
  if(pagesDemo)return;
  const current=state.destination, catalog=state.catalog;
  if(state.mapOnly)return;
  if(current===defaultDestination&&!(state.catalog||[]).some(p=>p.liveRoute?.destination?.join(',')!==current.coordinates.join(',')))return;
  try{
    const {routes,destination}=await lookupCommute(current.name,current.address);
    if(state.destination===current&&state.catalog===catalog){
      if(current!==defaultDestination)applyCommute(normalizeDestination(destination),routes);
      else {commuteRoutes=routes;render();}
    }
  }catch{if(state.destination===current)toast('Walking route lookup is unavailable.');}
}

function showCommuteSettings(){
  if(aiBusy||commuteBusy){toast('Wait for the current request to finish.');return;}
  showDialog(`
    <h2 id="detail-title">Commute settings</h2>
    <p class="detail-subtitle">Set the school or workplace you want to walk to.</p>
    <form id="commute-form" class="commute-form">
      <label>Place name <input name="name" maxlength="80" value="${escape(state.destination.name)}" placeholder="School or workplace"></label>
      <label>US street address <input name="address" required maxlength="240" value="${escape(state.destination.address)}" placeholder="Street, city, state, ZIP"></label>
      <p class="field-note">Saving recalculates walking routes for the current report. Use Search live listings to find homes near this destination.</p>
      <p class="field-note" role="status" id="commute-status"></p>
      <div class="dialog-actions">
        <button class="primary" type="submit">Save destination</button>
        <button class="text-button" type="button" id="commute-default">Reset to Weitzman Hall</button>
      </div>
    </form>`);
  const form=$('#commute-form');
  $('#commute-default').onclick=()=>{
    applyCommute(defaultDestination);
    closeDialog();
    if(state.mapOnly)discoverApartments();else refreshCommute();
  };
  form.onsubmit=async event=>{
    event.preventDefault();
    const data=new FormData(form);
    const status=$('#commute-status');
    const controls=[...form.querySelectorAll('input,button')];
    commuteBusy=true;
    controls.forEach(el=>el.disabled=true);
    status.textContent='Checking the address and walking routes…';
    try{
      const name=data.get('name'), address=data.get('address');
      if(address===defaultDestination.address&&name===defaultDestination.name){
        applyCommute(defaultDestination);
        refreshCommute();
      }else{
        const response=await lookupCommute(name,address);
        applyCommute(normalizeDestination(response.destination),response.routes);
      }
      if($('#commute-form')===form)closeDialog();
      if(state.mapOnly)discoverApartments();
      toast('Commute destination updated.');
    }catch(error){
      status.textContent=error.message;
    }finally{
      commuteBusy=false;
      controls.forEach(el=>el.disabled=false);
    }
  };
}
let aiBusy=false,accessSnapshot=null;
let queuedSearch=null;
fetch('./assets/poi-access.json').then(r=>r.ok?r.json():null).then(data=>{accessSnapshot=data;render();}).catch(()=>{});

loadPOIs().catch(()=>{});
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}
function typeLabel(p){return ({studio:'Studio','1b1b':p.sourceKind==='live-web-search'?'1 bedroom':'1 bed · 1 bath','2b':'2 bedrooms','3b':'3 bedrooms','4b':'4+ bedrooms'})[p.type]||'Layout unverified';}
function dateLabel(date){return date?new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Availability unverified';}
function floorplan(p){return `<div class="floorplan-thumb" aria-label="Illustrative floor plan"><svg viewBox="0 0 64 62" aria-hidden="true"><path d="M4 4h56v50H4zM4 39h23V4M27 23h33M43 23v31M27 39h16M9 9h13v20H9zM32 8h21v9H32zM47 31h8v16h-8zM8 44h12v6H8z"/><path d="M27 31v7m9-15h7M43 44v6" stroke="#e5dfcc" stroke-width="3"/></svg><small>DIAGRAM</small></div>`;}
function visible(){let rows=[...result.matches,...(state.profile.includeUnverified===false?[]:result.needsVerification)];if(state.sort==='price')rows.sort((a,b)=>(a.baseRent??Infinity)-(b.baseRent??Infinity));else if(state.sort==='walk')rows.sort((a,b)=>(a.walkMinutes??Infinity)-(b.walkMinutes??Infinity));else rows.sort((a,b)=>(b.score??-1)-(a.score??-1));return rows;}
function row(p){const costNote=p.pending.find(x=>x.startsWith('All-in'))||p.pending[0]||'Review the source';return `<article class="property-row ${p.id===state.selectedId?'selected':''}" data-property="${p.id}">
<label class="property-check"><input type="checkbox" data-compare="${p.id}" ${state.compared.has(p.id)?'checked':''} aria-label="Compare ${escape(p.name+' '+p.unit)}"></label>${floorplan(p)}
<div><button class="property-name" data-select="${p.id}">${escape(p.name)}</button><p class="unit-line">${typeLabel(p)} · ${p.furnished===true?'Furnished':p.furnished===false?'Unfurnished':'Furniture unverified'} · ${escape(p.unit)}</p><p class="property-address">${escape(p.address.split(',')[0])}${p.areaSqft?' · '+p.areaSqft+' sq ft*':''}</p></div>
<div class="property-price"><small>Published amount</small><strong>${money(p.baseRent)}${Number.isFinite(p.baseRent)?'<span> /mo*</span>':''}</strong><span class="amount-note">${p.advertisedAmount&&p.baseRent===null?money(p.advertisedAmount)+' '+escape((p.priceBasis||'rate basis unknown').replaceAll('_',' ')):'Extras unverified'}</span></div>
<div class="property-walk"><small>Walk to destination*</small><strong>${walkingLabel(p)}</strong></div>
<div class="property-evidence"><span class="pending-label">${icon('info')}Needs verification</span><button class="text-button" data-detail="${p.id}" title="${escape(costNote)}">Facts & sources ${icon('arrow')}</button></div></article>`;}

function syncControls(){const p=state.profile;$('#brief-destination').textContent='To '+state.destination.name;$('#map-area').textContent=state.destination===defaultDestination?'University City':state.destination.name;$('#brief-budget').textContent=p.budget?'under '+money(p.budget):'no limit';$('#brief-furnished').textContent=p.furnished?'required':'optional';$('#brief-laundry').textContent=p.laundry?'required':'optional';$('#brief-walk').textContent=p.maxWalk?'within '+p.maxWalk+' min':'no limit';if($('#filters').hidden){$('#budget').value=p.budget||'';$('#housing-type').value=p.type;$('#max-walk').value=p.maxWalk??'';$('#furnished').value=String(p.furnished);$('#laundry').value=String(p.laundry);for(const [id,key] of [['occupancy','occupancy'],['move-in','moveIn'],['lease-months','leaseMonths'],['min-area','minArea'],['pets','pets'],['parking','parking'],['include-unverified','includeUnverified']])$('#'+id).value=String(p[key]??'');}$('#compare-count').textContent=state.compared.size;$('#compare-nav-count').textContent=state.compared.size;$('#compare-nav-count').hidden=!state.compared.size;}
function render(){document.body.classList.toggle('map-only',state.mapOnly);result=evaluate(state.profile,accessSnapshot?.byOrigin||null,commuteCatalog());const rows=visible();if(!rows.some(p=>p.id===state.selectedId))state.selectedId=rows[0]?.id||null;syncControls();$('#results-summary').textContent=`${rows.length} ${state.searchInfo?'web candidates':'sample options'} have no known-condition conflict · sorted by ${state.sort==='fit'?(Object.values(state.profile.weights).some(Boolean)?'your priorities':'available results'):state.sort==='price'?'published cost':'walking time'}`;$('#verification-summary').textContent=`${result.matches.length} fully confirmed · ${result.needsVerification.length} need verification. Unknown fees are not zero.`;$('#property-list').innerHTML=rows.length?rows.map(row).join(''):`<div class="empty-state"><h3>No candidates pass the current checks.</h3><p>${state.profile.includeUnverified===false?'No saved option is fully confirmed. Include unverified options to review the outstanding checks.':state.searchInfo?'The search did not produce candidates that pass the known checks. Some source pages may be blocked or incomplete. Try a broader search or review excluded candidates.':'Try a higher budget, a longer walk, or another housing type. This saved case study is not a complete market inventory.'}</p><button class="primary" id="reset-brief">Reset brief</button></div>`;$('#excluded-toggle').textContent=`${state.showExcluded?'Hide':'Show'} homes outside your requirements (${result.excluded.length})`;$('#excluded-toggle').hidden=!result.excluded.length;$('#excluded-list').hidden=!state.showExcluded;$('#excluded-list').innerHTML=result.excluded.map(p=>`<div class="excluded-row"><button class="text-button" data-detail="${p.id}">${escape(p.name+' · '+p.unit)} · ${money(p.baseRent)}</button><span>${p.violations.map(escape).join(' ')}</span></div>`).join('');updateMap(rows,state.selectedId,state.poi,state.destination);renderSearchInfo();if(state.view==='compare')renderComparison();}
function toggleFilters(open){const target=open??$('#filters').hidden;if(target&&$('#filters').hidden)syncControls();$('#filters').hidden=!target;$('#filter-toggle').setAttribute('aria-expanded',String(target));if(target)$('#budget').focus();}
let renderedSearchInfo;
function renderSearchInfo(){
  const info=state.searchInfo;
  const status=$('#live-research-status');
  status.hidden=!info||state.mapOnly;
  $('.report-heading h1').textContent=state.mapOnly?'Explore nearby apartments':'Your next chapter, mapped.';
  if(state.mapOnly){
    $('.report-heading p').textContent='Apply filters or describe your search in chat to build a report.';
    $('.map-disclaimer').textContent='Apartment locations are based on published addresses. Map © OpenStreetMap contributors.';
    return;
  }
  if(info){
    const checked=new Date(info.searchedAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
    const unmapped=(state.catalog||[]).filter(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lng)).length;
    status.textContent=`Web research checked ${checked}. This search covers a limited set of sources. Availability and all-in costs are unconfirmed.${unmapped?' '+unmapped+' candidates need an address check before mapping.':''}`;
    $('#report-data-date').textContent='Web research · '+checked;
    $('.report-heading p').textContent='Current web-sourced rental candidates, with evidence and uncertainty.';
    $('#data-button').innerHTML='View research sources'+icon('arrow');
    $('.map-disclaimer').innerHTML='Map and POIs: OpenStreetMap snapshot. Routes: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer">FOSSGIS OSRM</a>. Address-geocoded locations; entrances unverified. <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Fix the map</a>';
  }else{
    $('#report-data-date').textContent='Saved case study · November 2, 2026';
    $('.report-heading p').textContent='Housing research around the University of Pennsylvania.';
    $('#data-button').innerHTML='A dated snapshot, openly sourced'+icon('arrow');
    $('.map-disclaimer').innerHTML='Map and POIs: OpenStreetMap snapshot. Routes: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer">FOSSGIS OSRM</a>. Sample housing coordinates; entrances unverified. <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Fix the map</a>';
  }
  if(renderedSearchInfo===info)return;
  renderedSearchInfo=info;
  const evidence=$('#live-search-evidence');evidence.replaceChildren();evidence.hidden=!info;
  if(!info)return;
  const title=document.createElement('h3');title.textContent='Live search sources';evidence.append(title);
  const note=document.createElement('p');note.textContent='Source-page access is recorded below. Readable pages can still contain outdated rates or community-level claims.';evidence.append(note);
  for(const source of info.sources||[]){
    try{const url=new URL(source.url);if(url.protocol!=='https:')continue;
      const line=document.createElement('p'),link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=source.title||url.hostname;line.append(link,document.createTextNode(source.pageChecked?' · page retrieved':' · search source, page not verified'));evidence.append(line);
    }catch{}
  }
  const widgets=Array.isArray(info.searchEntryPoints)&&info.searchEntryPoints.length?info.searchEntryPoints:[info.searchEntryPoint];
  for(const html of widgets.slice(0,2))if(typeof html==='string'&&html.length<100000){
    const widget=document.createElement('iframe');widget.title='Google Search suggestions';widget.setAttribute('sandbox','allow-popups allow-popups-to-escape-sandbox');widget.referrerPolicy='no-referrer';widget.srcdoc=html;widget.className='search-suggestions-widget';evidence.append(widget);
  }
}
function setView(view){state.view=view;$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#research-view').hidden=view!=='report';$('#compare-view').hidden=view!=='compare';$('#saved-view').hidden=view!=='saved';$('.report-heading').hidden=view!=='report';$('.brief-bar').hidden=view==='saved';if(view!=='report')toggleFilters(false);if(view==='compare')renderComparison();if(view==='saved')renderSaved();if(view==='report')setTimeout(()=>window.dispatchEvent(new Event('resize')),0);if(window.innerWidth<=720)setPanel('report');}
function setPanel(panel){document.body.classList.toggle('mobile-chat',panel==='chat');$$('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===panel));if(panel==='report')setTimeout(()=>window.dispatchEvent(new Event('resize')),0);}
function addMessage(role,text,changes=[]){state.messages.push({role,text,changes});const node=document.createElement('div');node.className='message '+role;node.innerHTML=`<div class="message-header"><span class="avatar">${role==='user'?'Y':icon('building')}</span>${role==='user'?'You':'Find My Home'}</div><div class="message-body">${escape(text)}</div>${changes.length?`<div class="message-changes">${icon('check')} ${changes.map(escape).join(' · ')}</div>`:''}`;$('#messages').appendChild(node);$('#messages').scrollTop=$('#messages').scrollHeight;}
function showDialog(html){$('#detail-content').innerHTML=html;$('#detail-dialog').showModal();}
function closeDialog(){if($('#detail-dialog').open)$('#detail-dialog').close();}
function showDetails(id){const p=result.all.find(x=>x.id===id);if(!p)return;state.selectedId=id;render();focusProperty(p);showDialog(`<h2 id="detail-title">${escape(p.name)}</h2><p class="detail-subtitle">${escape(p.unit)} · ${typeLabel(p)}<br>${escape(p.address)}</p><dl class="detail-facts"><div><dt>Published starting amount</dt><dd>${money(p.baseRent)}*</dd></div><div><dt>All-in monthly cost</dt><dd>Unverified</dd></div><div><dt>Walk to ${escape(state.destination.name)}</dt><dd>${walkingLabel(p)}*</dd></div><div><dt>Furniture</dt><dd>${p.furnished===true?'Documented':'Unverified'}</dd></div><div><dt>In-unit washer / dryer</dt><dd>${p.inUnitLaundry===true?'Documented':'Unverified'}</dd></div><div><dt>Advertised availability</dt><dd>${escape(dateLabel(p.availableDate))}</dd></div></dl><p class="detail-notice">${p.violations.length?'Outside current requirements: '+p.violations.map(escape).join(' '):'Needs verification. '+escape(p.pending[0]||'Current price and availability require checking.')}</p><h3>What the sources tell us</h3><ul>${p.dataNotes.map(n=>`<li>${escape(n)}</li>`).join('')}</ul><h3>Nearby places</h3><div class="detail-pois">${['grocery','pharmacy','park','gym','transit'].flatMap(k=>nearestPOIs(p,k,1).map(q=>`<span>${escape(q.name)} · ${q.distanceMeters} m straight line</span>`)).join('')||'POI data is loading. Reopen these details shortly.'}</div><p class="field-note">Straight-line distance is not walking distance. Ask chat for available walking-access calculations and sources.</p><h3>Evidence & uncertainty</h3><ul>${p.pending.map(n=>`<li>${escape(n)}</li>`).join('')}</ul><div class="detail-sources">${p.sources.map((s,i)=>`<a href="${escape(s)}" target="_blank" rel="noopener noreferrer">Source ${i+1}: ${escape(new URL(s).hostname)} ↗</a>`).join('')}</div><p class="field-note">Research checked: ${escape(p.checkedAt||snapshotDate)}. ${p.sourceKind==='live-web-search'?'A fetched page is not confirmation of an available unit.':''} Area values may describe a floor-plan range, not the exact unit. Starting amounts can vary by lease term; some are installments.</p><div class="dialog-actions"><button class="primary" data-detail-compare="${p.id}">${state.compared.has(p.id)?'Remove from comparison':'Add to comparison'}</button><a href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(p.address)}&destination=${encodeURIComponent(state.destination.coordinates.join(','))}&travelmode=walking" target="_blank" rel="noopener noreferrer">Check walking route ↗</a></div>`);}
function renderComparison(){const rows=[...state.compared].map(id=>result.all.find(p=>p.id===id)).filter(Boolean);$('#comparison').innerHTML=rows.length?`<div class="comparison-wrap"><table class="comparison-table"><thead><tr><th scope="col">Your comparison</th>${rows.map(p=>`<th scope="col">${escape(p.name)}<p class="unit-line" style="color:#dfdfc9">${escape(p.unit)}</p></th>`).join('')}</tr></thead><tbody>${[
['Housing type',p=>typeLabel(p)],['Published amount',p=>money(p.baseRent)+' /mo*'],['All-in cost',p=>'<span class="pending-text">Not verified</span>'],['Walk to destination',p=>walkingLabel(p)+'*'],['Furniture',p=>p.furnished===true?'Documented':'Needs checking'],['In-unit laundry',p=>p.inUnitLaundry===true?'Documented':'Needs checking'],['Advertised area',p=>p.areaSqft?p.areaSqft+' sq ft*':'Not confirmed'],['Grocery access',p=>{const a=accessSnapshot?.byOrigin?.[[p.lng,p.lat].join(',')]?.grocery;return a?escape(a.poiName)+' · '+Math.ceil(a.durationSeconds/60)+' min walk*':'Walking access unverified';}],['Preference score',p=>p.score===null?'Insufficient data':p.score+'/100'],['Requirements',p=>p.category==='excluded'?'<span class="pending-text">'+p.violations.map(escape).join(' ')+'</span>':'<span class="pending-text">Needs verification</span>'],['Evidence',p=>`<button class="text-button" data-detail="${p.id}">Read sources</button>`],['Selection',p=>`<button class="text-button" data-remove="${p.id}">Remove</button>`]
].map(([label,fn])=>`<tr><th scope="row">${label}</th>${rows.map(p=>`<td>${fn(p)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="field-note">* Research time and source checks are shown in the report. Published starting amounts exclude unknown extras. POI walking access uses the nearest straight-line candidate, not necessarily the fastest walking destination. Preference scores omit missing POI routes and do not establish eligibility or all-in budget.</p>`:`<div class="empty-state"><h3>Choose a few places to compare.</h3><p>Select up to three homes in the report, then read their costs, walking times, and uncertainties side by side.</p><button class="primary" id="choose-homes">Browse homes</button></div>`;}
function toggleCompare(id){if(state.compared.has(id))state.compared.delete(id);else if(state.compared.size<3)state.compared.add(id);else return toast('Compare up to three homes. Remove one to add another.');render();}
function getSaved(){return storage.get('find-my-home-reports',[]);}
function saveReport(){const saved=getSaved(),record={id:Date.now().toString(),savedAt:new Date().toISOString(),profile:structuredClone(state.profile),compared:[...state.compared],selectedId:state.selectedId,sort:state.sort,snapshotDate,catalog:state.catalog,searchInfo:state.searchInfo};saved.unshift(record);if(storage.set('find-my-home-reports',saved.slice(0,15)))toast('Report saved in this browser.');else toast('Storage is unavailable. Use Export data to keep a copy.');if(state.view==='saved')renderSaved();}
function renderSaved(){const list=getSaved();$('#saved-list').innerHTML=list.length?list.map(r=>`<article class="saved-item"><div><h3>${escape(r.searchInfo?.location||'Penn housing report')}</h3><p>${new Date(r.savedAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})}<br>${r.profile.budget?money(r.profile.budget)+' budget':'No budget limit'} · ${r.profile.maxWalk||'Any'} min walk · ${r.profile.type==='any'?'Any layout':escape(r.profile.type)}</p></div><div class="saved-item-actions"><button class="text-button" data-restore="${r.id}">Open report ${icon('arrow')}</button><button class="text-button" data-delete="${r.id}">Delete</button></div></article>`).join(''):`<div class="empty-state"><h3>Keep a brief worth returning to.</h3><p>Save the current report to revisit your requirements and comparison in this browser.</p><button class="primary" id="save-current">Save current report</button></div>`;}
function exportReport(){const payload={product:'Find My Home',generatedAt:new Date().toISOString(),snapshotDate:state.searchInfo?.searchedAt||snapshotDate,disclaimer:state.searchInfo?'Web-sourced candidates. Availability, unit details and all-in costs require confirmation.':dataDisclaimer,searchInfo:state.searchInfo,destination:state.destination,profile:state.profile,comparison:[...state.compared],results:visible(),excluded:result.excluded,conversation:state.messages};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='find-my-home-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Report data exported.');}

function showSearchProgress(mode){
  const discovery=mode==='discover';
  aiBusy=true;
  $('#send-button').disabled=false;
  $('#apply-filters').disabled=false;
  $('#live-search-button').disabled=true;
  $('#retry-discovery').hidden=true;
  $('#discovery-status').hidden=true;
  const label=discovery?'Searching for apartments near '+state.destination.name+'…':'Searching the web and matching apartments…';
  $('#search-progress').textContent=label;
  $('#search-progress').hidden=false;
  if(mode==='chat'){
    const node=document.createElement('p');
    node.id='chat-search-progress';
    node.className='search-progress';
    node.setAttribute('role','status');
    node.textContent=label;
    $('#messages').append(node);
    $('#messages').scrollTop=$('#messages').scrollHeight;
  }
}

function finishSearchProgress(){
  aiBusy=false;
  $('#send-button').disabled=false;
  $('#apply-filters').disabled=false;
  $('#live-search-button').disabled=false;
  $('#search-progress').hidden=true;
  $('#chat-search-progress')?.remove();
  const next=queuedSearch;
  queuedSearch=null;
  $('#queued-search-status').hidden=true;
  if(next)queueMicrotask(()=>submitChat(next.text,next.profile));
}

function handleSearchProgress(event,mode){
  const labels={
    discovering:'Searching for apartment listings…',
    checking_sources:'Checking listing pages…',
    checking_addresses:'Looking up missing street addresses…',
    locating:'Locating apartments on the map…',
    routing:'Checking walking routes…',
    matching:'Matching listings to your requirements…'
  };
  const label=labels[event.stage];
  if(label){
    $('#search-progress').textContent=label;
    const chatStatus=$('#chat-search-progress');
    if(chatStatus)chatStatus.textContent=label;
  }
  if(mode==='discover'&&event.home){
    const [home]=normalizeLiveCatalog([event.home]);
    if(!home||!validCoordinates([home.lng,home.lat]))return;
    const found=state.catalog.some(item=>item.id===home.id);
    if(!found)state.catalog.push(home);
    updateMap(state.catalog,state.selectedId,state.poi,state.destination);
    if(state.catalog.length===1&&!found)fitHousingMap();
  }
}

async function readSearchReply(response,mode){
  if(!response.ok){
    const reply=await response.json();
    throw new Error(reply.error||'The search could not finish.');
  }
  if(!response.headers.get('content-type')?.includes('application/x-ndjson'))return response.json();
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let buffer='', runId, sequence=0;
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done)throw new Error('The search connection closed before the report was ready. Try again.');
      buffer+=decoder.decode(value,{stream:true});
      const lines=buffer.split('\n');
      buffer=lines.pop();
      for(const line of lines){
        if(!line)continue;
        const event=JSON.parse(line);
        runId??=event.runId;
        if(event.runId!==runId||event.sequence<=sequence)continue;
        sequence=event.sequence;
        if(event.type==='progress')handleSearchProgress(event,mode);
        if(event.type==='result'){
          if(event.status>=400)throw new Error(event.reply.error||'The search could not finish.');
          return event.reply;
        }
      }
    }
  }finally{
    await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
}

async function requestSearch(mode,message,profile=state.profile){
  const response=await fetch('/api/chat',{
    method:'POST',headers:{'Content-Type':'application/json',Accept:'application/x-ndjson'},
    body:JSON.stringify({
      mode,message,profile,nearDestination:mode!=='chat',
      destination:state.destination===defaultDestination?undefined:state.destination,
      selectedId:state.selectedId,
      history:mode==='chat'?state.messages.slice(-9,-1).map(({role,text})=>({role,text})):[],
      catalog:mode==='chat'?commuteCatalog().filter(home=>!state.mapOnly||home.id===state.selectedId).map(({liveRoute,...home})=>home):undefined
    }),
    signal:AbortSignal.timeout(280000)
  });
  const reply=await readSearchReply(response,mode);
  if(!Array.isArray(reply.catalog))throw new Error('The search did not return a new report. Try again.');
  return reply;
}

function applySearchReply(reply){
  state.catalog=normalizeLiveCatalog(reply.catalog);
  commuteRoutes={};
  state.searchInfo=reply.searchInfo;
  state.selectedId=null;
  state.compared=new Set(reply.compareIds||[]);
  state.profile={...openSearchProfile,...reply.profile};
  if(reply.poiCategory){
    state.poi=reply.poiCategory;
    $$('[data-poi]').forEach(b=>b.classList.toggle('active',b.dataset.poi===state.poi));
  }
}

async function discoverApartments(){
  if(aiBusy)return;
  showSearchProgress('discover');
  state.catalog=[];
  state.selectedId=null;
  $('#discovery-sources').replaceChildren();
  render();
  try{
    const reply=await requestSearch('discover','Find nearby apartment buildings with mappable street addresses.',openSearchProfile);
    applySearchReply(reply);
    state.catalog=state.catalog.filter(p=>validCoordinates([p.lng,p.lat]));
    render();
    fitHousingMap();
    for(const html of reply.searchInfo?.searchEntryPoints||[reply.searchInfo?.searchEntryPoint]){
      if(typeof html!=='string'||html.length>=100000)continue;
      const widget=document.createElement('iframe');
      widget.title='Google Search suggestions';
      widget.className='search-suggestions-widget';
      widget.setAttribute('sandbox','allow-popups allow-popups-to-escape-sandbox');
      widget.referrerPolicy='no-referrer';
      widget.srcdoc=html;
      $('#discovery-sources').append(widget);
    }
    if(state.catalog.length)return;
    $('#discovery-message').textContent='No apartments with mappable addresses were found.';
  }catch(error){
    $('#discovery-message').textContent=error.message;
  }finally{finishSearchProgress();}
  $('#discovery-status').hidden=false;
  $('#retry-discovery').hidden=false;
}

async function submitChat(text, applyProfile=null){
  if(pagesDemo){
    if(!applyProfile){location.assign(liveSite);return;}
    state.profile=applyProfile;
    state.mapOnly=false;
    setView('report');
    render();
    toggleFilters(false);
    return;
  }
  if(commuteBusy||!text.trim())return;
  if(aiBusy){
    queuedSearch={text,profile:applyProfile};
    if(!applyProfile)$('#chat-input').value='';
    $('#queued-search-status').textContent='Your latest request will start after the current search.';
    $('#queued-search-status').hidden=false;
    if(!applyProfile)toast('Your request is queued.');
    return;
  }
  const mode=applyProfile?'apply':'chat';
  if(mode==='chat'){addMessage('user',text);$('#chat-input').value='';}
  showSearchProgress(mode);
  try{
    const reply=await requestSearch(mode,text,applyProfile||state.profile);
    applySearchReply(reply);
    state.mapOnly=false;
    $('#discovery-sources').replaceChildren();
    const mobileChat=document.body.classList.contains('mobile-chat');
    setView(reply.compareIds?.length?'compare':'report');
    if(mobileChat)setPanel('chat');
    render();
    fitHousingMap();
    toggleFilters(false);
    addMessage('agent',reply.reply,reply.changes||[]);
  }catch(error){
    const message=error.name==='TimeoutError'?'The search timed out. Please try again.':error.message;
    addMessage('agent',message);
    $('#discovery-message').textContent=message;
    $('#discovery-status').hidden=false;
  }finally{finishSearchProgress();}
}

$('#retry-discovery').onclick=discoverApartments;
$('#filter-toggle').onclick=()=>toggleFilters();$('#budget-brief').onclick=()=>{toggleFilters(true);$('#budget').focus();};
$('#walk-brief').onclick=()=>{toggleFilters(true);$('#max-walk').focus();};
$$('.brief-toggle').forEach(b=>b.onclick=()=>{toggleFilters(true);$('#'+b.dataset.key).focus();});
$('#filters').onsubmit=event=>{
  event.preventDefault();
  const number=id=>$('#'+id).value?Number($('#'+id).value):null;
  const profile={...state.profile,budget:number('budget'),type:$('#housing-type').value,
    maxWalk:number('max-walk'),furnished:$('#furnished').value==='true',laundry:$('#laundry').value==='true',
    occupancy:$('#occupancy').value,moveIn:$('#move-in').value,leaseMonths:number('lease-months'),
    minArea:number('min-area'),pets:$('#pets').value==='true',parking:$('#parking').value==='true',
    includeUnverified:$('#include-unverified').value==='true'};
  submitChat('Search live rental listings using the applied filters.',profile);
};

$('#sort').onchange=e=>{state.sort=e.target.value;render();};$('#excluded-toggle').onclick=()=>{state.showExcluded=!state.showExcluded;$('#excluded-toggle').setAttribute('aria-expanded',String(state.showExcluded));render();};
$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$$('[data-panel]').forEach(b=>b.onclick=()=>setPanel(b.dataset.panel));$('#compare-button').onclick=()=>setView('compare');$('#back-report').onclick=()=>setView('report');
$('#map-3d').onclick=()=>{state.map3d=!state.map3d;$('#map-3d').setAttribute('aria-pressed',String(state.map3d));setMapMode(state.map3d);};$('#map-reset').onclick=()=>resetMap();$$('[data-poi]').forEach(b=>b.onclick=()=>{state.poi=b.dataset.poi==='none'?null:b.dataset.poi;$$('[data-poi]').forEach(x=>x.classList.toggle('active',x===b));updateMap(visible(),state.selectedId,state.poi);});
$('#chat-form').onsubmit=e=>{e.preventDefault();submitChat($('#chat-input').value);};$('#chat-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submitChat(e.target.value);}};$$('[data-prompt]').forEach(b=>b.onclick=()=>submitChat(b.dataset.prompt));
$('#live-search-button').onclick=()=>submitChat('Refresh current rental listings using the applied filters.',state.profile);
$('#save-button').onclick=saveReport;$('#export-button').onclick=exportReport;$('#print-button').onclick=()=>window.print();$('#detail-close').onclick=closeDialog;$('#detail-dialog').onclick=e=>{if(e.target===$('#detail-dialog'))closeDialog();};
function about(){showDialog(`<h2 id="detail-title">A closer look at the prototype</h2><p class="detail-subtitle">Find My Home · Interaction MVP</p><h3>What works today</h3><p>Adjust requirements in the brief or conversation, explore the map, compare properties, change preference weights, save reports in this browser, and export the research data.</p><h3>Where the data comes from</h3><p>${escape(state.searchInfo?'Current candidates come from a fresh web search and bounded source-page checks. Source links and check times are retained. Page retrieval does not confirm a currently available unit or an all-in price.':dataDisclaimer)}</p><h3>What the assistant can understand</h3><p>When configured, chat uses Gemini with tools for requirements, housing evidence, POIs and comparison. Otherwise a limited local intent parser is used. Try a budget, a walking limit, studio or one bedroom, furniture optional, cheaper, commute first, or compare top 3.</p><h3>What comes next</h3><p>Live source discovery and page checks are available through chat or Search live listings. Current availability, complete fee verification and exact building entrances still require checking. This prototype does not contact property managers.</p><div class="detail-notice">The map uses a real external basemap. Housing coordinates are sample data. POIs come from a named OpenStreetMap snapshot; public access and opening hours require checking. The solid route follows a saved OpenStreetMap walking-network calculation between those sample endpoints. It is not verified entrance-to-entrance navigation. Walking times elsewhere in the report remain from the original research snapshot.</div>`);}
$('#about-button').onclick=about;$('#data-button').onclick=()=>state.searchInfo?$('#live-search-evidence').scrollIntoView({behavior:'smooth',block:'start'}):about();$('#evidence-help').onclick=about;$('#location-button').onclick=showCommuteSettings;
document.addEventListener('click',e=>{const target=e.target.closest('button,input');if(!target)return;if(target.dataset.select){state.selectedId=target.dataset.select;render();focusProperty(result.all.find(p=>p.id===state.selectedId));}if(target.dataset.detail)showDetails(target.dataset.detail);if(target.dataset.compare)toggleCompare(target.dataset.compare);if(target.dataset.detailCompare){toggleCompare(target.dataset.detailCompare);target.textContent=state.compared.has(target.dataset.detailCompare)?'Remove from comparison':'Add to comparison';}if(target.dataset.remove)toggleCompare(target.dataset.remove);if(target.id==='reset-brief'){submitChat('Search without rental filters.',structuredClone(openSearchProfile));}if(target.id==='choose-homes')setView('report');if(target.id==='save-current')saveReport();if(target.dataset.restore){const r=getSaved().find(x=>x.id===target.dataset.restore);if(r&&!aiBusy&&!commuteBusy){state.mapOnly=false;$('#discovery-sources').replaceChildren();$('#discovery-status').hidden=true;state.catalog=Array.isArray(r.catalog)?normalizeLiveCatalog(r.catalog):null;state.searchInfo=r.searchInfo||null;state.profile={...defaultProfile,...structuredClone(r.profile)};state.compared=new Set(r.compared);state.selectedId=r.selectedId;state.sort=r.sort;$('#sort').value=state.sort;setView('report');render();refreshCommute();addMessage('agent','Saved report restored, including your requirements and comparison. Saved evidence and search time are restored; availability may have changed.');toast('Saved report opened.');}}if(target.dataset.delete){storage.set('find-my-home-reports',getSaved().filter(r=>r.id!==target.dataset.delete));renderSaved();toast('Saved report deleted from this browser.');}});

initMap('map',id=>{state.selectedId=id;render();const el=document.querySelector(`[data-property="${id}"]`);el?.scrollIntoView({behavior:'smooth',block:'nearest'});});render();
fitHousingMap();
if(pagesDemo){
  state.catalog=properties;
  state.destination=defaultDestination;
  state.mapOnly=false;
  $('#location-button').onclick=()=>location.assign(liveSite);
  render();
}else{
  discoverApartments();
}

window.findMyHome={getState:()=>({profile:structuredClone(state.profile),view:state.view,compared:[...state.compared],count:visible().length}),submitChat};
