import {options,type Die} from './engine';
export type ScoringHint={dice:number[];points:number;label:string};
/** Explain a legal keep without changing the protocol's scoring or dice ordering. */
export function scoringHint(dice:Die[]):ScoringHint|undefined{
 const best=options(dice).sort((a,b)=>b.points-a.points||b.dice.length-a.dice.length)[0];
 if(!best)return;
 const values=dice.filter(d=>best.dice.includes(d.id)).map(d=>d.value);
 const counts=Array.from({length:6},(_,i)=>values.filter(v=>v===i+1).length);
 let label='Scoring dice';
 if(values.length===6&&counts.every(n=>n===1))label='Straight';
 else if(values.length===6&&counts.filter(n=>n===2).length===3)label='Three pairs';
 else if(counts.some(n=>n>=3))label='Matching dice';
 else if(values.every(v=>v===1||v===5))label='1s and 5s';
 return {...best,label};
}
