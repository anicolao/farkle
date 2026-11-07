<script lang="ts">
 import {onMount} from 'svelte';
 import {Canvas} from '@threlte/core';
 import Table from './scene/Table.svelte';
 import {scoringHint} from './game/scoring-hint';
 import {repository,type GameRepository} from './game/repository';
 import {replay,score,companion,type Event,type Action,type State} from './game/engine';
 let repo:GameRepository|undefined=$state(),events:Event[]=$state([]),gameId=$state(''),pending=$state(false),error=$state(''),selected:number[]=$state([]),readOnly=$state(false),history=$state(false);
 let unsubscribe=()=>{};
 let saveStatus=$state<'loading'|'saving'|'saved'|'cached'|'error'>('loading');
 const saveLabel=$derived(readOnly?'Read-only replay':saveStatus==='error'?'Firebase save unavailable':pending||saveStatus==='saving'?'Saving to Firebase…':saveStatus==='saved'?`Saved to Firebase · ${events.length} actions`:saveStatus==='cached'?'Offline · showing cached game':'Connecting to Firebase…');
 const game:State|undefined=$derived(events.length?replay(events):undefined);
 const hint=$derived(game?scoringHint(game.dice):undefined);
 const human=$derived(game?.active===0&&game.phase!=='over'&&!readOnly);
 const selectable=$derived(!!human&&!pending&&(game?.phase==='choose'||game?.phase==='decide'));
 const selectionScore=$derived(score(game?.dice.filter(d=>selected.includes(d.id)).map(d=>d.value)??[]));
 const prefix=`farkle:${import.meta.env.VITE_PREVIEW_ID??'main'}`;
 function receive(next:Event[]){try{replay(next);events=next;selected=[];}catch(e){error=`Cannot replay game: ${(e as Error).message}`;}}
 function watch(id:string){
  unsubscribe();gameId=id;saveStatus='loading';localStorage.setItem(prefix,id);
  const url=new URL(window.location.href);url.searchParams.set('table',id);window.history.replaceState(null,'',url);
  unsubscribe=repo!.watch(id,receive,e=>{error=e.message;saveStatus='error';},status=>{saveStatus=status.fromCache?'cached':status.pendingWrites?'saving':'saved';});
 }
 onMount(()=>{let alive=true;repository().then(r=>{if(!alive)return;repo=r;const requested=new URL(window.location.href).searchParams.get('table');const saved=requested??localStorage.getItem(prefix);if(saved){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saved))throw Error('Invalid table ID in the game link.');watch(saved);}}).catch(e=>{error=e.message;saveStatus='error';});return ()=>{alive=false;unsubscribe();};});
 async function start(){if(!repo)return;pending=true;error='';try{const id=await repo.create();events=[];readOnly=false;watch(id);}catch(e){error=(e as Error).message;saveStatus='error';}finally{pending=false;}}
 async function act(action:Action){if(!repo||pending||readOnly)return;pending=true;error='';const prior=events,id=crypto.randomUUID();try{await repo.append(gameId,prior,action,id);if(events.length===prior.length)receive([...prior,{id,revision:prior.length,actor:replay(prior).active,action}]);}catch(e){error=(e as Error).message;saveStatus='error';}finally{pending=false;}}
 function toggle(id:number){if(selectable)selected=selected.includes(id)?selected.filter(v=>v!==id):[...selected,id];}
 $effect(()=>{if(game?.active===1&&game.phase!=='over'&&!pending&&!readOnly&&!error){const revision=events.length;const timer=setTimeout(()=>{if(events.length===revision&&game)void act(companion(game));},650);return ()=>clearTimeout(timer);}});
 function download(){const blob=new Blob([JSON.stringify({format:'farkle-intents',events},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`farkle-${gameId||'replay'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function openLog(e:globalThis.Event){const input=e.target as HTMLInputElement,file=input.files?.[0];if(!file||pending)return;try{if(file.size>5_000_000)throw Error('Log is too large');const data=JSON.parse(await file.text());if(data.format!=='farkle-intents')throw Error('Unrecognized log');replay(data.events);unsubscribe();readOnly=true;receive(data.events);error='';}catch(e){error=(e as Error).message;}input.value='';}
</script>
<svelte:head><title>{gameId&&!readOnly?`Farkle · ${gameId}`:'Farkle · Seven dice, one more roll'}</title><meta name="description" content="A seven-dice Farkle table. Choose what to keep, push your luck, and play a companion."/></svelte:head>
<div class="app">
 <header><a class="brand" href={import.meta.env.BASE_URL}>F<span>arkle</span><i>7</i></a><div class="tagline">SEVEN DICE. ONE MORE ROLL.</div><button class="quiet" onclick={()=>history=!history}>History & rules</button></header>
 {#if error}<div class="error" role="alert">{error} <button onclick={()=>error=''}>Dismiss</button></div>{/if}
 {#if !game}
  <main class="welcome"><div class="eyebrow">THE TABLE IS YOURS</div><h1>A little nerve.<br/>A lot of possibility.</h1><p>Keep the dice that score. Roll the rest.<br/>Know when to walk away.</p><div class="intro-dice" aria-hidden="true">⚀ ⚄ ⚂</div><button class="primary" onclick={start} disabled={!repo||pending}>{pending?'Setting the table…':repo?'Play a companion':'Connecting to the table…'}</button><p class="small">A seven-dice game to 10,000 · Saved as you play</p><label class="file">Open a saved game log<input type="file" accept="application/json" disabled={pending} onchange={openLog}/></label></main>
 {:else}
  <main>
   <div class="game-status"><span role="status" aria-live="polite">{saveLabel}</span>{#if !readOnly}<a class="table-id" href={`?table=${gameId}`} title={gameId}>Table {gameId}</a>{/if}</div>
   <section class="scoreboard" aria-label="Scores">
    {#each ['You','Companion'] as name,i}<div class:active={game.active===i&&game.phase!=='over'} class="player"><div class="medallion" class:ochre={i===1}>{i===0?'Y':'C'}</div><div><span>{name} {game.active===i&&game.phase!=='over'?'· playing':''}</span><strong>{game.scores[i].toLocaleString()}</strong></div></div>{/each}
    <div class="target">RACE TO <strong>10,000</strong>{#if game.finalRemaining!==null}<span>Final reply</span>{/if}</div>
   </section>
   <section class="game-table">
    <div class="table-heading"><div><div class="eyebrow">{readOnly?'SAVED REPLAY':game.phase==='over'?'THE LAST DIE IS CAST':game.active===0?'YOUR TURN':'COMPANION’S TURN'}</div><h1>{game.phase==='over'?game.notice:game.phase==='bust'?'Farkle!':game.phase==='ready'?'Fortune favours the bold.':game.remaining===0?'Hot dice. A fresh chance.':'What will you keep?'}</h1></div><div class="pot"><span>THIS TURN</span><strong>{game.pot.toLocaleString()}</strong><small>at risk</small></div></div>
    <div class="canvas" class:can-select={selectable}><Canvas><Table dice={game.dice} {selected} interactive={selectable} {toggle} onerror={message=>error=message}/></Canvas>{#if game.dice.length===0}<div class="empty-tray">{game.phase==='over'?'Well played.':'Seven dice. Endless possibilities.'}</div>{/if}</div>
    <div class="dice-keys" aria-label="Dice selection">{#each game.dice as die,i}<button aria-label={`Die ${i+1}: ${die.value}`} aria-pressed={selected.includes(die.id)} disabled={!selectable} onclick={()=>toggle(die.id)}>{die.value}</button>{/each}</div>
    {#if hint&&selectable}<div class="scoring-help"><span>{hint.label} can score {hint.points.toLocaleString()} points.</span><button class="quiet" onclick={()=>selected=[...hint.dice]}>Select {hint.label.toLowerCase()} · {hint.points.toLocaleString()}</button></div>{/if}
    <p class="notice" aria-live="polite">{game.notice}</p>
    <div class="actions">
     {#if game.phase==='over'}<button class="primary" onclick={start} disabled={pending}>Play again</button>
     {:else if readOnly}<span>Read-only action log</span><button onclick={start} disabled={!repo||pending}>Start a new game</button>
     {:else if game.active===1}<span class="thinking">Companion is considering the odds…</span>
     {:else if game.phase==='ready'}<button class="primary" onclick={()=>act({type:'roll'})} disabled={pending}>Roll 7 dice</button>
     {:else if game.phase==='bust'}<span class="farkle-help">No scoring dice. Pass the dice to continue.</span><button class="primary" onclick={()=>act({type:'next'})} disabled={pending}>Pass the dice</button>
     {:else}<button class="primary" onclick={()=>act({type:'keep',dice:selected})} disabled={pending||selectionScore===null}>Keep {selectionScore!==null?`${selectionScore} points`:'scoring dice'}</button>{#if game.phase==='decide'}<button onclick={()=>act({type:'roll'})} disabled={pending}>Roll {game.remaining||7} again</button><button onclick={()=>act({type:'bank'})} disabled={pending}>Bank {game.pot}</button>{/if}{/if}
    </div>
    {#if selected.length&&selectionScore===null}<p class="hint">Every selected die must score. Try 1s, 5s, or three of a kind.</p>{/if}
   </section>
  </main>
 {/if}
 {#if history}<aside><div class="aside-head"><h2>The table book</h2><button class="quiet" onclick={()=>history=false}>Close</button></div><h3>Seven-dice house rules</h3><p>Single 1: 100 · Single 5: 50.<br/>Three 1s: 1,000. Other triples: face × 100.<br/>Each extra matching die doubles that group.<br/>Straight 1–6: 1,500 · Three distinct pairs: 1,500.<br/>A seventh die can score alongside either combination.</p><p>Keep at least one scoring subset before rolling or banking. Score all dice for hot dice and roll all seven again. A roll with no scoring dice loses the whole turn. No opening minimum. Bank 10,000 to give the opponent one final turn; highest total wins, equal scores tie.</p><p>The companion keeps the highest scoring subset, then banks at 750 or with two dice or fewer. In the final reply it chases the lead.</p>{#if events.length}<button onclick={download}>Download action log</button><ol class="log">{#each events as event}<li><span>{event.actor===0?'You':'Companion'}</span> · {event.action.type}{event.action.type==='keep'?` dice ${event.action.dice.map(i=>i+1).join(', ')}`:''}</li>{/each}</ol>{/if}<label class="file">Open a saved game log<input type="file" accept="application/json" disabled={pending} onchange={openLog}/></label></aside>{/if}
 <footer><span>Made of chances, kept by choices.</span><a href="https://github.com/anicolao/farkle">Source · GPLv3</a></footer>
</div>
