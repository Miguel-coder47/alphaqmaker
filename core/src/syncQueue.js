// Offline-first helpers. Attempts get a client-made id, so syncing the same attempt twice is harmless.
export function mergeAttempts(local,remote){
  const m=new Map();
  for(const a of [...remote,...local]){
    const e=m.get(a.id);
    if(!e||(a.updatedAt||0)>(e.updatedAt||0)) m.set(a.id,a);
  }
  return [...m.values()].sort((a,b)=>(a.startedAt||0)-(b.startedAt||0));
}
export const pendingUploads=(local,syncedIds)=>local.filter(a=>a.finished&&!syncedIds.has(a.id));
