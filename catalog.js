/** Bound data received from search or local report storage. Unknown facts remain unknown. */
export function normalizeLiveCatalog(input){
  if(!Array.isArray(input))return [];
  const seen=new Set();
  return input.filter(p=>p&&typeof p.id==='string'&&/^live-[a-z0-9-]+$/i.test(p.id)&&typeof p.name==='string'&&Array.isArray(p.sources)&&p.sources.length).map(p=>{
    const links=p.sources.filter(s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/i.test(u.hostname);}catch{return false;}}).slice(0,8);
    if(!links.length||seen.has(p.id))return null;seen.add(p.id);
    const clean={...p,id:p.id.slice(0,90),name:p.name.slice(0,180),unit:String(p.unit||'Unit details unverified').slice(0,120),address:String(p.address||'Address unverified').slice(0,300),sources:links,allInVerified:false,sourceKind:'live-web-search',status:'needs-verification',amenities:{}};
    for(const key of ['baseRent','monthlyKnown','areaSqft','walkMinutes'])clean[key]=Number.isFinite(p[key])&&p[key]>=0?p[key]:null;
    for(const key of ['lat','lng'])clean[key]=Number.isFinite(p[key])&&Math.abs(p[key])<=(key==='lat'?90:180)?p[key]:null;
    for(const key of ['furnished','inUnitLaundry','pets','parking'])clean[key]=typeof p[key]==='boolean'?p[key]:'unknown';
    clean.type=['studio','1b1b','2b','3b','4b'].includes(p.type)?p.type:'unknown';
    clean.dataNotes=Array.isArray(p.dataNotes)?p.dataNotes.filter(n=>typeof n==='string').slice(0,15).map(n=>n.slice(0,700)):[];
    return clean;
  }).filter(Boolean);
}
