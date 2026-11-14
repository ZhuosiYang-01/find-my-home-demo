/**
 * Find My Home demo engine. No live search or LLM calls.
 * Published prices and walking times are a research snapshot from 2026-11-02,
 * NOT current offers. Coordinates and POI times are illustrative map data.
 * monthlyKnown is the disclosed recurring amount, NOT a verified all-in total.
 */
export const snapshotDate = '2026-11-02';
export const dataDisclaimer = 'Demonstration data. Housing facts are a November 2, 2026 research snapshot; map coordinates and POI times are illustrative. Availability and all-in costs require verification.';
export const defaultDestination = {
  name: 'Weitzman Hall',
  address: '205 S 34th Street, Philadelphia, PA 19104',
  coordinates: [-75.191997, 39.9518634]
};
export function validCoordinates(point) {
  return Array.isArray(point) && point.length === 2 &&
    point.every((value, index) => Number.isFinite(value) && Math.abs(value) <= (index ? 90 : 180));
}
export function normalizeDestination(value) {
  if (!validCoordinates(value?.coordinates) || typeof value.address !== 'string' || !value.address.trim()) return defaultDestination;
  return {
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 80) : 'Commute destination',
    address: value.address.trim().slice(0, 240),
    coordinates: value.coordinates
  };
}

export const defaultProfile = {
  budget: 2000, type: 'any', furnished: true, laundry: true, maxWalk: 25,
  occupancy:'any',moveIn:'',leaseMonths:null,minArea:null,pets:false,parking:false,includeUnverified:true,
  weights: { price: 35, commute: 40, amenities: 25 },
};

export const openSearchProfile = {
  ...defaultProfile,
  budget:null, furnished:false, laundry:false, maxWalk:null,
  weights:{price:0,commute:0,amenities:0}
};

const sources = {
  solo: 'https://live.solochestnut.com/floorplans',
  suites: 'https://www.4211suites.com/long-term-residents',
  accolade: 'https://www.theaccoladeonchestnut.com/philadelphia/the-accolade-on-chestnut/student',
  carriage: 'https://www.apartments.com/carriage-house-philadelphia-pa/bmjte18/',
  uno: 'https://unochestnut.com/solo-4125/',
  lvl: 'https://www.apartments.com/lvl-west-philadelphia-pa/4r4kkeh/',
  chestnut: 'https://www.3939chestnut.com/faq/',
};

function property(values) {
  return {
    ...values,
    monthlyKnown: values.baseRent,
    allInVerified: false,
    estimatedExtras: null,
    occupancy:'unknown',pets:'unknown',parking:'unknown',
    rateLeaseMonths:values.sourceKey==='suites'?12:null,
    displayPrice: `$${values.baseRent.toLocaleString('en-US')}`,
    priceLabel: 'Published monthly starting amount',
    snapshotDate,
    sources: values.sources || [sources[values.sourceKey]],
    dataNotes: [
      'Housing information is a dated research snapshot, not a live listing.',
      'Coordinates and POI walking times are illustrative demo values.',
      ...(values.dataNotes || []),
    ],
    poiDataStatus: 'illustrative',
  };
}

export const properties = [
  property({ id:'solo-studio-415', name:'SOLO on Chestnut', unit:'415', address:'4233 Chestnut Street, Philadelphia, PA', lat:39.95658,lng:-75.20836,type:'studio',baseRent:1535,furnished:true,inUnitLaundry:true,walkMinutes:24,areaSqft:363,status:'future',availableDate:'2027-01-08',sourceKey:'solo',amenities:{grocery:4,pharmacy:5,park:10,gym:2,transit:3},dataNotes:['Official furnished studio page listed this unit at $1,535 starting rent.','Utilities and mandatory extras are not fully verified.']}),
  property({ id:'solo-1b-722', name:'SOLO on Chestnut',unit:'722',address:'4233 Chestnut Street, Philadelphia, PA',lat:39.95658,lng:-75.20836,type:'1b1b',baseRent:1725,furnished:true,inUnitLaundry:true,walkMinutes:24,areaSqft:526,status:'future',availableDate:'2026-12-08',sourceKey:'solo',amenities:{grocery:4,pharmacy:5,park:10,gym:2,transit:3},dataNotes:['Furnished 1-bedroom floor plan is listed as 508 to 526 square feet; 526 is the displayed upper bound.','Utilities and mandatory extras are not fully verified.']}),
  property({ id:'solo-1b-506',name:'SOLO on Chestnut',unit:'506',address:'4233 Chestnut Street, Philadelphia, PA',lat:39.95658,lng:-75.20836,type:'1b1b',baseRent:1725,furnished:true,inUnitLaundry:true,walkMinutes:24,areaSqft:508,status:'future',availableDate:'2027-02-22',sourceKey:'solo',amenities:{grocery:4,pharmacy:5,park:10,gym:2,transit:3},dataNotes:['Furnished 1-bedroom floor plan is listed as 508 to 526 square feet; 508 is the displayed lower bound.']}),
  property({ id:'4211-1b',name:'4211 Suites',unit:'Standard 1-bedroom',address:'4211 Chestnut Street, Philadelphia, PA',lat:39.95643,lng:-75.20695,type:'1b1b',baseRent:1850,furnished:true,inUnitLaundry:true,walkMinutes:22,areaSqft:null,status:'needs-verification',availableDate:null,sourceKey:'suites',amenities:{grocery:3,pharmacy:5,park:9,gym:6,transit:4},dataNotes:['$1,850 starting rate requires a 12-month term. Shorter terms cost more.','Water, electricity, mandatory extras, and actual unit availability require confirmation.']}),
  property({ id:'accolade-s1',name:'The Accolade on Chestnut',unit:'S1',address:'3600 Chestnut Street, Philadelphia, PA',lat:39.95420,lng:-75.19469,type:'studio',baseRent:1837,furnished:'unknown',inUnitLaundry:true,walkMinutes:8,areaSqft:278,status:'needs-verification',availableDate:null,sourceKey:'accolade',amenities:{grocery:6,pharmacy:3,park:8,gym:1,transit:4},dataNotes:['Published amount is per installment. Compare the full lease cost and duration before treating it as a calendar-month cost.','Displayed lease term had already started. Current availability and included fees are uncertain.','Furnished options are advertised at the community level; this specific plan needs confirmation.']}),
  property({ id:'accolade-s2',name:'The Accolade on Chestnut',unit:'S2',address:'3600 Chestnut Street, Philadelphia, PA',lat:39.95420,lng:-75.19469,type:'studio',baseRent:1866,furnished:'unknown',inUnitLaundry:true,walkMinutes:8,areaSqft:309,status:'needs-verification',availableDate:null,sourceKey:'accolade',amenities:{grocery:6,pharmacy:3,park:8,gym:1,transit:4},dataNotes:['Published amount is per installment. The lease duration and total obligation need verification.','Current availability and unit-specific furniture are unconfirmed.']}),
  property({ id:'carriage-studio-c313',name:'Carriage House',unit:'C-313',address:'3500 Powelton Avenue, Philadelphia, PA',lat:39.96139,lng:-75.19305,type:'studio',baseRent:1413,furnished:'unknown',inUnitLaundry:'unknown',walkMinutes:13,areaSqft:481,status:'needs-verification',availableDate:null,sourceKey:'carriage',amenities:{grocery:8,pharmacy:9,park:3,gym:2,transit:4},dataNotes:['Platform labeled $1,413 as total monthly price, but usage-based costs and furniture may be additional.','Community advertises furnished units and in-unit laundry; this specific unit is not verified.']}),
  property({ id:'carriage-1b-c215',name:'Carriage House',unit:'C-215',address:'3500 Powelton Avenue, Philadelphia, PA',lat:39.96139,lng:-75.19305,type:'1b1b',baseRent:1528,furnished:'unknown',inUnitLaundry:'unknown',walkMinutes:13,areaSqft:564,status:'needs-verification',availableDate:null,sourceKey:'carriage',amenities:{grocery:8,pharmacy:9,park:3,gym:2,transit:4},dataNotes:['Platform labeled $1,528 as total monthly price, but usage-based costs and furniture may be additional.','Community amenities do not establish unit-specific furniture or laundry.']}),
  property({ id:'uno-1b',name:'UNO on Chestnut',unit:'1x1',address:'4125 Chestnut Street, Philadelphia, PA',lat:39.95604,lng:-75.20504,type:'1b1b',baseRent:1640,furnished:'unknown',inUnitLaundry:true,walkMinutes:21,areaSqft:429,status:'waitlist',availableDate:null,sourceKey:'uno',amenities:{grocery:3,pharmacy:4,park:8,gym:1,transit:3},dataNotes:['Official floor-plan page showed sold out / join waitlist, conflicting with third-party availability.','Community offers furnished and unfurnished options. This starting rate does not establish which is included.','Official rates are described as per person / per bed installments. Verify occupancy and total lease cost.']}),
  property({ id:'lvl-1b-440',name:'LVL West',unit:'440',address:'4301 Chestnut Street, Philadelphia, PA',lat:39.95675,lng:-75.20898,type:'1b1b',baseRent:1530,furnished:'unknown',inUnitLaundry:'unknown',walkMinutes:25,areaSqft:465,status:'future',availableDate:'2026-12-26',sourceKey:'lvl',amenities:{grocery:5,pharmacy:6,park:10,gym:1,transit:4},dataNotes:['Furniture was not verified. Utilities are separately payable.','In-unit laundry is advertised by the community, not independently checked for unit 440.']}),
  property({ id:'3939-1b',name:'3939 Chestnut',unit:'1-bedroom starting plan',address:'3939 Chestnut Street, Philadelphia, PA',lat:39.95573,lng:-75.20181,type:'1b1b',baseRent:1750,furnished:'unknown',inUnitLaundry:true,walkMinutes:16,areaSqft:null,status:'needs-verification',availableDate:null,sourceKey:'chestnut',amenities:{grocery:2,pharmacy:3,park:7,gym:5,transit:3},dataNotes:['Official community homepage advertised one-bedroom starting at $1,750; precise unit price is unconfirmed.','Furniture rental is available by inquiry. Water, electricity, internet, and required insurance are additional.']}),
];

const isNumber = value => typeof value === 'number' && Number.isFinite(value);
const unknown = value => value !== true && value !== false;
const money = value => `$${Math.round(value).toLocaleString('en-US')}`;

export function evaluate(profile = {}, accessByOrigin = null, catalog = properties) {
  const p = { ...defaultProfile, ...profile, weights:{...defaultProfile.weights,...profile.weights} };
  const all = catalog.map(item => {
    const reasons = [], pending = [], violations = [];
    if (p.type && p.type !== 'any') {
      if(!item.type||item.type==='unknown')pending.push('Housing layout needs verification.');
      else if(item.type!==p.type)violations.push('Housing type does not match.');
    }
    if(p.occupancy && p.occupancy!=='any'){
      if(item.occupancy==='unknown')pending.push('Whole-home or shared occupancy needs verification for this rate.');
      else if(item.occupancy!==p.occupancy)violations.push('Occupancy arrangement does not match.');
    }
    if(p.moveIn){
      if(item.availableDate && item.availableDate>p.moveIn)violations.push(`Advertised availability is after ${p.moveIn}.`);
      else pending.push(`Availability on ${p.moveIn} needs confirmation.`);
    }
    if(isNumber(p.leaseMonths))pending.push(item.rateLeaseMonths && item.rateLeaseMonths!==p.leaseMonths?`This published rate requires ${item.rateLeaseMonths} months; the ${p.leaseMonths}-month price needs verification.`:`A ${p.leaseMonths}-month lease and its price need confirmation.`);
    if(isNumber(p.minArea)){
      if(isNumber(item.areaSqft)&&item.areaSqft<p.minArea)violations.push(`Advertised area is below ${p.minArea} sq ft.`);
      else pending.push(`Exact unit area of at least ${p.minArea} sq ft needs verification.`);
    }
    for(const key of ['pets','parking'])if(p[key]===true){
      if(item[key]===false)violations.push(key==='pets'?'Pets are not allowed.':'Parking is not available.');
      else if(item[key]!==true)pending.push(key==='pets'?'Pet eligibility, restrictions and fees need verification.':'Parking availability and monthly fees need verification.');
    }
    if (isNumber(p.budget)) {
      if(!isNumber(item.monthlyKnown))pending.push('Monthly rent and total recurring cost need verification.');
      else if (item.monthlyKnown >= p.budget) violations.push(`Known monthly amount is not below ${money(p.budget)}.`);
      else if (!item.allInVerified) pending.push(`All-in cost unverified; ${money(p.budget - item.monthlyKnown)} remains for undisclosed monthly costs.`);
      else reasons.push(`Verified monthly cost is below ${money(p.budget)}.`);
    }
    if (p.furnished === true) {
      if (item.furnished === false) violations.push('Furniture is not included.');
      else if (unknown(item.furnished)) pending.push('Unit-specific furniture and its cost need confirmation.');
      else reasons.push('Furnished floor plan is explicitly identified.');
    }
    if (p.laundry === true) {
      if (item.inUnitLaundry === false) violations.push('No in-unit washer and dryer.');
      else if (unknown(item.inUnitLaundry)) pending.push('Unit-specific washer and dryer need confirmation.');
      else reasons.push('In-unit washer and dryer are documented.');
    }
    if (isNumber(p.maxWalk)) {
      if (!isNumber(item.walkMinutes)) pending.push('Walking route needs calculation.');
      else if (item.walkMinutes > p.maxWalk) violations.push(`Walking time exceeds ${p.maxWalk} minutes.`);
      else reasons.push(`${item.walkMinutes}-minute walk to the commute destination.`);
    }
    if (item.status === 'waitlist') pending.push('Official source shows a waitlist; availability is unconfirmed.');
    if (item.status === 'needs-verification') pending.push('Current availability needs confirmation.');
    const costs = isNumber(item.monthlyKnown)?Math.max(0,Math.min(100,(2500-item.monthlyKnown)/15)):null;
    const commute = isNumber(item.walkMinutes)?Math.max(0,100-item.walkMinutes*3):null;
    const access=accessByOrigin?.[[item.lng,item.lat].join(',')];
    const mins = accessByOrigin?Object.values(access||{}).map(x=>x.durationSeconds/60).filter(isNumber):Object.values(item.amenities||{}).filter(isNumber);
    const amenities = mins.length?Math.max(0,100-(mins.reduce((a,b)=>a+b,0)/mins.length)*5):null;
    const weights = ['price','commute','amenities'].map(k=>Math.max(0,Number(p.weights[k])||0));
    const dimensions=[costs,commute,amenities];
    const totalWeight=dimensions.reduce((sum,value,i)=>sum+(value===null?0:weights[i]),0);
    const score=totalWeight?Math.round(dimensions.reduce((sum,value,i)=>sum+(value===null?0:value*weights[i]),0)/totalWeight):null;
    const category = violations.length ? 'excluded' : pending.length ? 'needsVerification' : 'matches';
    return {...item,score,reasons,pending,violations,category,
      scoreNote:accessByOrigin?'Preference score uses published amounts, sampled campus walking times and saved walking access to nearest straight-line POI candidates. Missing POI routes are omitted, not treated as zero. It does not verify eligibility or all-in budget.':'Preference score uses published amounts and illustrative POI times. It does not verify eligibility or all-in budget.'};
  }).sort((a,b)=>(b.score??-1)-(a.score??-1) || (a.baseRent??Infinity)-(b.baseRent??Infinity));
  return {matches:all.filter(x=>x.category==='matches'),needsVerification:all.filter(x=>x.category==='needsVerification'),excluded:all.filter(x=>x.category==='excluded'),all};
}

/** Bounded demo parser. It understands selected phrases, not arbitrary requests. */
export function parseMessage(text, profile = {}) {
  const next = {...defaultProfile,...profile,weights:{...defaultProfile.weights,...profile.weights}};
  const changes=[];
  const unsupported=[];
  const set = (key,value,label) => {next[key]=value;changes.push(label);};
  const raw=String(text||'').trim(), q=raw.toLowerCase();
  if (/(?:\b[2-9]\s*(?:bed(?:room)?s?|br|b\d+b)\b|\b(?:two|three|four|five)[- ]bed|两居|两室|两卧|三居|三室|三卧|合租|\bshared\b|\broommates?\b)/.test(q)) {
    unsupported.push('This saved demo contains only studios and one-bedroom apartments. The requested layout or shared-housing requirement has not been applied.');
  }
  const budget = q.match(/(?:budget|rent|预算|租金)[^\d]{0,16}\$?\s*(\d[\d,]*(?:\.\d+)?)/) || q.match(/\$\s*(\d[\d,]*(?:\.\d+)?)/) || q.match(/(\d[\d,]*)\s*(?:dollars|刀|美元)/);
  if (budget) {const value=Number(budget[1].replace(/,/g,''));if(value>0)set('budget',value,`Budget below ${money(value)} / month`);}
  if (/(?:no budget|unlimited budget|不限预算|预算不限)/.test(q)) set('budget',null,'No budget limit');
  if (/(?:any (?:type|layout)|all (?:types|layouts)|户型不限|不限户型|studio.*(?:or|and|也).*1|1.*(?:or|and|也).*studio)/.test(q)) set('type','any','Any housing type');
  else if (/(?:one[- ]bed|1\s*(?:bed|b1b|br)|一居|一室|一卧)/.test(q)) set('type','1b1b','One bedroom, one bathroom');
  else if (/studio/.test(q)) set('type','studio','Studio');
  if (/(?:unfurnished|no furniture requirement|furniture optional|家具不限|不需要家具|无需家具)/.test(q)) set('furnished',false,'Furniture optional');
  else if (/(?:furnished|with furniture|带家具|需要家具)/.test(q)) set('furnished',true,'Furniture required');
  if (/(?:laundry optional|no laundry requirement|洗烘不限|不需要洗烘)/.test(q)) set('laundry',false,'In-unit laundry optional');
  else if (/(?:in[- ]unit laundry|washer|dryer|套内洗烘|洗衣机)/.test(q)) set('laundry',true,'In-unit washer and dryer required');
  const walking=q.match(/(?:walk|walking|步行)[^\d]{0,20}(\d{1,3})\s*(?:min|分钟)?/) || q.match(/(\d{1,3})\s*(?:min(?:ute)?s?|分钟)[^.!。]{0,12}(?:walk|步行)/);
  if(walking){const value=Number(walking[1]);if(value>0)set('maxWalk',value,`Maximum walk ${value} minutes`);}
  if(/(?:commute first|prioriti[sz]e (?:commute|walking)|shorter commute|通勤优先|更近|更短.*通勤)/.test(q)){next.weights={price:20,commute:60,amenities:20};changes.push('Prioritize a shorter commute');}
  if(/(?:cheaper|price first|budget first|lower (?:price|rent)|便宜|价格优先|预算优先)/.test(q)){next.weights={price:60,commute:25,amenities:15};changes.push('Prioritize lower published cost');}
  if(/(?:amenities first|prioriti[sz]e amenities|groceries|grocery|超市|买菜|生活便利)/.test(q)){next.weights={price:25,commute:25,amenities:50};changes.push('Prioritize nearby amenities');}
  const recognized=changes.length>0;
  const summary=evaluate(next);
  const count=summary.matches.length+summary.needsVerification.length;
  let response=recognized
    ? `Updated: ${changes.join('; ')}. ${count} sample options pass the known-condition checks, but ${summary.needsVerification.length} still need verification. Unknown fees are not treated as zero. This demo uses a saved Philadelphia snapshot; it does not search live listings.`
    : 'This MVP uses a limited rule-based chat parser, not a live LLM. Try “budget $1800”, “studio”, “walk 20 minutes”, “furnished”, “cheaper”, or “commute first”. It currently analyzes the saved Penn-area sample only.';
  if(unsupported.length) response=unsupported.join(' ')+' '+response;
  return {profile:next,changes,response,recognized,unsupported};
}
