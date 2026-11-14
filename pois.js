/** Local OSM POI snapshot. Coordinates and categories are data, not access guarantees. */
export let poiSnapshot=null;
export let pois=[];
let loading=null;

export function normalizePOIs(snapshot){
  const categories=new Set(['grocery','pharmacy','park','gym','transit']);
  const seen=new Set();
  return (Array.isArray(snapshot?.pois)?snapshot.pois:[]).filter(p=>{
    if(!p?.id||seen.has(p.id)||!p.name||!categories.has(p.category)||!Number.isFinite(p.lng)||!Number.isFinite(p.lat)||Math.abs(p.lng)>180||Math.abs(p.lat)>90||!Array.isArray(p.sources)||!p.sources.length)return false;
    seen.add(p.id);return true;
  });
}

export async function loadPOIs(){
  if(!loading)loading=(async()=>{
    const response=await fetch(new URL('./assets/pois.json',import.meta.url));
    if(!response.ok)throw new Error('POI snapshot unavailable');
    const snapshot=await response.json();
    const normalized=normalizePOIs(snapshot);
    if(!normalized.length)throw new Error('No usable POIs in snapshot');
    pois=normalized;
    poiSnapshot={...snapshot,pois};
    return poiSnapshot;
  })();
  return loading;
}

export function getPOIs(category){return category&&category!=='all'?pois.filter(p=>p.category===category):pois;}

export function distanceMeters(a,b){
  const r=Math.PI/180;
  const phi1=a.lat*r,phi2=b.lat*r,dPhi=(b.lat-a.lat)*r,dLambda=(b.lng-a.lng)*r;
  const h=Math.sin(dPhi/2)**2+Math.cos(phi1)*Math.cos(phi2)*Math.sin(dLambda/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}

/** Straight-line distance only. Never label this as a walk or routing result. */
export function nearestPOIs(origin,category,limit=3){
  if(!Number.isFinite(origin?.lat)||!Number.isFinite(origin?.lng))return [];
  return getPOIs(category).map(p=>({...p,distanceMeters:Math.round(distanceMeters(origin,p)),distanceType:'straight_line'})).sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,Math.max(0,Math.min(50,limit)));
}
