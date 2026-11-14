/** Only draw a saved road-network route for its exact requested endpoints. */
export function walkingRoute(snapshot,property,destination){
  if(!property || !snapshot || !Array.isArray(snapshot.destination) || snapshot.destination.some((n,i)=>n!==destination[i]))return null;
  const route=snapshot.routes?.[[property.lng,property.lat].join(',')];
  const points=route?.geometry?.coordinates;
  if(route?.start?.[0]!==property.lng || route?.start?.[1]!==property.lat || route.geometry?.type!=='LineString' || !Array.isArray(points) || points.length<2)return null;
  if(points.some(p=>!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90))return null;
  return {type:'Feature',properties:{mode:'walking',provider:snapshot.provider,retrievedAt:snapshot.retrievedAt,distance:route.distance},geometry:route.geometry};
}
