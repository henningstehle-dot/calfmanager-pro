/** Offline storage is scoped to the authenticated user and farm. Browser storage may be cleared by the OS/user. */
export type PendingWeight={id:string;userId:string;farmId:string;calfId:string;eventDate:string;weightKg:number;details:string;createdAt:number};
const DB='calfmanager-offline-v1';
// Open a fresh transaction for each operation; do not await between starting a transaction and issuing its request.
function operation<T>(name:string,mode:IDBTransactionMode, action:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('snapshots'))d.createObjectStore('snapshots');if(!d.objectStoreNames.contains('weights'))d.createObjectStore('weights',{keyPath:'id'})};r.onerror=()=>reject(r.error);r.onsuccess=()=>{const d=r.result,tx=d.transaction(name,mode),q=action(tx.objectStore(name));q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);tx.oncomplete=()=>d.close();tx.onabort=()=>{d.close();reject(tx.error)}}})}
const scope=(u:string,f:string)=>`${u}:${f}`;
export async function saveSnapshot(u:string,f:string,calves:unknown[],events:unknown[]){return operation('snapshots','readwrite',s=>s.put({calves,events,savedAt:Date.now()},scope(u,f)))}
export async function readSnapshot(u:string,f:string):Promise<{calves:any[];events:any[];savedAt:number}|undefined>{return operation('snapshots','readonly',s=>s.get(scope(u,f)))}
export async function addWeight(w:PendingWeight){return operation('weights','readwrite',s=>s.put(w))}
export async function removeWeight(id:string){return operation('weights','readwrite',s=>s.delete(id))}
export async function pendingWeights(u:string,f:string):Promise<PendingWeight[]>{const all=await operation<PendingWeight[]>('weights','readonly',s=>s.getAll());return all.filter(w=>w.userId===u&&w.farmId===f).sort((a,b)=>a.createdAt-b.createdAt)}
