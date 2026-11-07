import {describe,test,expect} from 'bun:test';
import {score,begin,apply,replay,companion,options,type State,type Event} from '../src/game/engine';
const initial=()=>begin({type:'begin',seed:42,protocol:1,source:'digital'});
describe('exact scoring',()=>{
 test('singles, triples, extended groups and mixed seven dice',()=>{
  expect(score([1,5])).toBe(150);expect(score([2,2,2])).toBe(200);expect(score([1,1,1])).toBe(1000);
  expect(score([3,3,3,3])).toBe(600);expect(score([1,1,1,1,1,1,1])).toBe(16000);
  expect(score([1,2,3,4,5,6,1])).toBe(1600);expect(score([2,2,3,3,4,4,5])).toBe(1550);
  expect(score([2,2,2,5,5,5,1])).toBe(800);
 });
 test('rejects non-scoring leftovers and malformed faces',()=>{for(const v of [[],[2],[2,2],[1,2],[1,2,3,4,5,6,2],[0],[7],[1.5]])expect(score(v)).toBeNull();});
});
test('selection legality, attribution and immutable input',()=>{
 const s:State={...initial(),phase:'choose',dice:[{id:0,value:1},{id:1,value:2},{id:2,value:5}]};const before=structuredClone(s);
 expect(()=>apply(s,{type:'keep',dice:[0,0]},0)).toThrow();expect(()=>apply(s,{type:'keep',dice:[9]},0)).toThrow();expect(()=>apply(s,{type:'keep',dice:[0,1]},0)).toThrow();expect(()=>apply(s,{type:'roll'},0)).toThrow();expect(()=>apply(s,{type:'keep',dice:[0]},1)).toThrow();
 const kept=apply(s,{type:'keep',dice:[0,2]},0);expect(kept.pot).toBe(150);expect(kept.remaining).toBe(1);expect(s).toEqual(before);
});
test('hot dice, bank and farkle clear only the turn',()=>{
 let s:State={...initial(),phase:'choose',dice:[{id:0,value:1}],remaining:1,pot:300};s=apply(s,{type:'keep',dice:[0]},0);expect(s.remaining).toBe(0);expect(apply(s,{type:'roll'},0).dice).toHaveLength(7);
 expect(apply(s,{type:'bank'},0).scores).toEqual([400,0]);const bust=apply({...s,phase:'bust',scores:[500,0]},{type:'next'},0);expect(bust.scores).toEqual([500,0]);expect(bust.pot).toBe(0);expect(bust.active).toBe(1);
});
test('10,000 grants exactly one final reply, including a bust and tie',()=>{
 const s:State={...initial(),phase:'decide',scores:[9900,9800],pot:100};const reply=apply(s,{type:'bank'},0);expect(reply.finalRemaining).toBe(1);expect(reply.phase).toBe('ready');expect(reply.active).toBe(1);
 expect(apply({...reply,phase:'bust'},{type:'next'},1).notice).toBe('You win!');expect(apply({...reply,phase:'decide',pot:200},{type:'bank'},1).notice).toBe('A tie!');expect(apply({...reply,phase:'decide',pot:250},{type:'bank'},1).notice).toBe('Companion wins!');
});
test('seeded logs replay completely and heuristic games terminate',()=>{
 for(let seed=0;seed<40;seed++){
  const events:Event[]=[{id:'0',revision:0,actor:0,action:{type:'begin',seed,protocol:1,source:'digital'}}];let s=replay(events),moves=0;
  while(s.phase!=='over'&&moves<2000){const action=companion(s);events.push({id:String(events.length),revision:events.length,actor:s.active,action});s=apply(s,action,s.active);moves++;}
  expect(s.phase).toBe('over');expect(replay(events)).toEqual(s);expect(replay(structuredClone(events))).toEqual(s);
 }
});
test('replay rejects gaps, duplicate IDs, wrong actors and unknown protocol',()=>{
 const e:Event={id:'a',revision:0,actor:0,action:{type:'begin',seed:1,protocol:1,source:'digital'}};
 expect(()=>replay([e,{id:'b',revision:2,actor:0,action:{type:'roll'}}])).toThrow();expect(()=>replay([e,{id:'a',revision:1,actor:0,action:{type:'roll'}}])).toThrow();expect(()=>replay([e,{id:'b',revision:1,actor:1,action:{type:'roll'}}])).toThrow();expect(()=>replay([{...e,action:{...e.action,protocol:2} as never}])).toThrow();
});
test('option enumeration never allows a non-scoring subset',()=>{const dice=[1,2,2,2,5,6,6].map((value,id)=>({id,value}));for(const option of options(dice))expect(score(dice.filter(d=>option.dice.includes(d.id)).map(d=>d.value))).toBe(option.points);});
