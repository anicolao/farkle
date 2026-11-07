import {collection,doc,onSnapshot,orderBy,query,runTransaction,type Firestore} from 'firebase/firestore';
import {connectFirebase,previewScope} from '../firebase';
import {apply,replay,type Action,type Event} from './engine';
export type SyncStatus={fromCache:boolean;pendingWrites:boolean};
export class GameRepository {
 constructor(readonly db:Firestore,readonly uid:string){}
 table(id:string){return doc(this.db,'spaces',previewScope,'games',id);}
 async create(seed=crypto.getRandomValues(new Uint32Array(1))[0]){
  const id=crypto.randomUUID(),table=this.table(id);const event:Event={id:crypto.randomUUID(),revision:0,actor:0,action:{type:'begin',protocol:1,source:'digital',seed}};
  replay([event]);await runTransaction(this.db,async tx=>{tx.set(table,{owner:this.uid,revision:0,lastEvent:event.id});tx.set(doc(collection(table,'events'),event.id),event);});return id;
 }
 watch(id:string,update:(events:Event[])=>void,error:(e:Error)=>void,status:(status:SyncStatus)=>void=()=>{}){
  let lastRevision=-1;
  return onSnapshot(query(collection(this.table(id),'events'),orderBy('revision')),{includeMetadataChanges:true},snapshot=>{
   status({fromCache:snapshot.metadata.fromCache,pendingWrites:snapshot.metadata.hasPendingWrites});
   if(snapshot.metadata.hasPendingWrites)return;
   if(!snapshot.empty){const events=snapshot.docs.map(d=>d.data() as Event);const revision=events.at(-1)!.revision;if(revision!==lastRevision){lastRevision=revision;update(events);}}
   else if(!snapshot.metadata.fromCache)error(Error('This game has no recorded actions. Check the table link or start a new game.'));
  },error);
 }
 async append(id:string,events:Event[],action:Action,eventId=crypto.randomUUID()){
  const state=replay(events);apply(state,action,state.active);const event:Event={id:eventId,revision:events.length,actor:state.active,action};const table=this.table(id),ref=doc(collection(table,'events'),event.id);
  await runTransaction(this.db,async tx=>{
   const [head,existing]=await Promise.all([tx.get(table),tx.get(ref)]);
   if(existing.exists()){
    const keys=['id','revision','actor','action','type','protocol','source','seed','dice'];
    if(JSON.stringify(existing.data(),keys)!==JSON.stringify(event,keys))throw Error('Retry ID reused');
    return;
   }
   if(!head.exists()||head.data().owner!==this.uid)throw Error('This game belongs to another browser identity');
   if(head.data().revision!==events.length-1)throw Error('Game changed in another tab. Try again.');
   tx.set(ref,event);tx.update(table,{revision:event.revision,lastEvent:event.id});
  });
 }
}
export async function repository(){const {db,uid}=await connectFirebase();return new GameRepository(db,uid);}
