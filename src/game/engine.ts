/** Protocol 1: canonical player intents; all digital outcomes are derived. */
export type Die = {id:number; value:number};
export type Action = {type:'begin';seed:number;protocol:1;source:'digital'} | {type:'roll'} | {type:'keep';dice:number[]} | {type:'bank'} | {type:'next'};
export type Event = {id:string;revision:number;actor:0|1;action:Action};
export type State = {seed:number;rollIndex:number;active:0|1;scores:[number,number];pot:number;dice:Die[];remaining:number;phase:'ready'|'choose'|'decide'|'bust'|'over';finalRemaining:number|null;notice:string;turn:number};
export function random(seed:number){let x=seed>>>0;return ()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
/** Exact cover: every selected die must belong to a scoring group. */
export function score(values:number[]):number|null{
 if(!values.length||values.length>7||values.some(v=>!Number.isInteger(v)||v<1||v>6))return null;
 const memo=new Map<string,number|null>();
 function solve(c:number[]):number|null{
  if(c.every(n=>n===0))return 0;
  const key=c.join();if(memo.has(key))return memo.get(key)!;
  let best:number|null=null;
  function take(group:number[],points:number){if(group.some((n,i)=>n>c[i]))return;const rest=solve(c.map((n,i)=>n-group[i]));if(rest!==null)best=Math.max(best??0,points+rest);}
  const i=c.findIndex(n=>n>0);
  if(i===0||i===4){const g=[0,0,0,0,0,0];g[i]=1;take(g,i===0?100:50);}
  for(let n=3;n<=c[i];n++){const g=[0,0,0,0,0,0];g[i]=n;take(g,(i===0?1000:(i+1)*100)*2**(n-3));}
  take([1,1,1,1,1,1],1500);
  for(let a=0;a<4;a++)for(let b=a+1;b<5;b++)for(let d=b+1;d<6;d++){const g=[0,0,0,0,0,0];g[a]=g[b]=g[d]=2;take(g,1500);}
  memo.set(key,best);return best;
 }
 return solve(Array.from({length:6},(_,i)=>values.filter(v=>v===i+1).length));
}
export function options(dice:Die[]){const result:{dice:number[];points:number}[]=[];for(let mask=1;mask<2**dice.length;mask++){const subset=dice.filter((_,i)=>mask&(1<<i));const points=score(subset.map(d=>d.value));if(points!==null)result.push({dice:subset.map(d=>d.id),points});}return result;}
export interface RollSource {readonly kind:'digital';roll(seed:number,index:number,count:number):Die[];}
export const digitalDice:RollSource={kind:'digital',roll(seed,index,count){const rng=random((seed+Math.imul(index,0x9e3779b9))>>>0);return Array.from({length:count},(_,id)=>({id,value:1+Math.floor(rng()*6)}));}};
export function begin(action:Extract<Action,{type:'begin'}>):State{
 if(action.protocol!==1||action.source!=='digital'||!Number.isInteger(action.seed)||action.seed<0||action.seed>0xffffffff)throw Error('Unsupported game protocol or seed');
 return {seed:action.seed,rollIndex:0,active:0,scores:[0,0],pot:0,dice:[],remaining:7,phase:'ready',finalRemaining:null,notice:'Your turn. Roll seven dice.',turn:1};
}
function finishTurn(s:State,bank:boolean):State{
 const scores:[number,number]=[...s.scores];if(bank)scores[s.active]+=s.pot;
 let finalRemaining=s.finalRemaining;
 if(finalRemaining!==null)finalRemaining--;else if(scores[s.active]>=10000)finalRemaining=1;
 const over=finalRemaining===0;
 return {...s,scores,pot:0,dice:[],remaining:7,active:over?s.active:(1-s.active) as 0|1,phase:over?'over':'ready',finalRemaining,turn:s.turn+1,notice:over?(scores[0]===scores[1]?'A tie!':`${scores[0]>scores[1]?'You win':'Companion wins'}!`):`${bank?`Banked ${s.pot}.`:'Farkle! Turn points lost.'}${finalRemaining===1?' Final reply turn.':''}`};
}
export function apply(s:State,action:Action,actor:number):State{
 if(actor!==s.active||s.phase==='over')throw Error('It is not your turn');
 if(action.type==='begin')throw Error('Game already started');
 if(action.type==='roll'){
  if(s.phase!=='ready'&&s.phase!=='decide')throw Error('Keep scoring dice before rolling');
  const count=s.remaining||7,dice=digitalDice.roll(s.seed,s.rollIndex,count),bust=options(dice).length===0;
  return {...s,dice,remaining:count,rollIndex:s.rollIndex+1,phase:bust?'bust':'choose',notice:bust?`Farkle! ${s.pot} points at risk are lost.`:'Tap a scoring subset, then keep it.'};
 }
 if(action.type==='keep'){
  if(s.phase!=='choose'&&s.phase!=='decide')throw Error('No dice to keep');
  if(!Array.isArray(action.dice)||new Set(action.dice).size!==action.dice.length||action.dice.some(id=>!s.dice.some(d=>d.id===id)))throw Error('Invalid dice selection');
  const points=score(s.dice.filter(d=>action.dice.includes(d.id)).map(d=>d.value));if(points===null)throw Error('Every selected die must score');
  const dice=s.dice.filter(d=>!action.dice.includes(d.id));return {...s,dice,remaining:dice.length,pot:s.pot+points,phase:'decide',notice:dice.length?`Kept ${points}. Bank or risk another roll.`:`Hot dice! Kept ${points}. All seven dice are available again.`};
 }
 if(action.type==='bank'){if(s.phase!=='decide')throw Error('Keep scoring dice before banking');return finishTurn(s,true);}
 if(action.type==='next'){if(s.phase!=='bust')throw Error('Only a farkle can be acknowledged');return finishTurn(s,false);}
 throw Error('Unknown action');
}
export function replay(events:Event[]):State{
 if(!events.length)throw Error('Empty game');let state:State|undefined;const ids=new Set<string>();
 for(const [i,e] of events.entries()){
  if(e.revision!==i||ids.has(e.id)||!e.id||!Number.isInteger(e.actor)||e.actor<0||e.actor>1)throw Error('Invalid event order, identity or attribution');ids.add(e.id);
  if(i===0){if(e.action.type!=='begin'||e.actor!==0)throw Error('Begin must be first');state=begin(e.action);}else state=apply(state!,e.action,e.actor);
 }
 return state!;
}
/** Takes the highest score, preferring more dice; banks at 750 or with <=2 dice. */
export function companion(s:State):Action{
 if(s.phase==='ready')return {type:'roll'};if(s.phase==='bust')return {type:'next'};
 if(s.phase==='choose'){const best=options(s.dice).sort((a,b)=>b.points-a.points||b.dice.length-a.dice.length)[0];return {type:'keep',dice:best.dice};}
 if(s.phase==='decide'){
  const wouldWin=s.scores[s.active]+s.pot>Math.max(9999,s.scores[1-s.active]);
  if(wouldWin||(s.finalRemaining===null&&(s.pot>=750||(s.remaining>0&&s.remaining<=2))))return {type:'bank'};
  return {type:'roll'};
 }
 throw Error('Game is over');
}
