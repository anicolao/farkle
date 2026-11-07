<script lang="ts">
 import {onMount} from 'svelte';
 import {T,useThrelte} from '@threlte/core';
 import {OrthographicCamera} from 'three';
 import {interactivity} from '@threlte/extras';
 import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
 import Die from './Die.svelte';
 import {loadSurfaces,materials,disposeLibrary,type Library} from './materials';
 import type {Die as DieValue} from '../game/engine';
 let {dice,selected,interactive,toggle,onerror}:{dice:DieValue[];selected:number[];interactive:boolean;toggle:(id:number)=>void;onerror:(message:string)=>void}=$props();
 interactivity();
 const {size,invalidate}=useThrelte();
 const camera=new OrthographicCamera(-10,10,5,-5,.1,100);
 $effect(()=>{const aspect=$size.width/Math.max(1,$size.height),span=Math.max(5.2,10/aspect);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.position.set(0,10,8.5);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();invalidate();});
 let lib:Library|undefined=$state();
 const base=new RoundedBoxGeometry(8.8,.35,5.5,4,.25),rim=new RoundedBoxGeometry(8.5,.15,5.2,4,.2),felt=new RoundedBoxGeometry(8.2,.12,4.9,4,.18);
 onMount(()=>{let stopped=false;let cleanup=()=>{};loadSurfaces().then(s=>{const m=materials(s);const dispose=()=>{disposeLibrary(m);Object.values(s).forEach(t=>t.dispose());};if(stopped)dispose();else{lib=m;cleanup=dispose;}}).catch(e=>onerror(`Table materials failed to load: ${e.message}`));return ()=>{stopped=true;cleanup();base.dispose();rim.dispose();felt.dispose();};});
</script>
<T is={camera} makeDefault manual/>
<T.AmbientLight intensity={1.8}/>
<T.DirectionalLight position={[2,8,4]} intensity={4}/>
<T.PointLight position={[-4,5,-2]} intensity={70} color="#ffddb2"/>
{#if lib}
 <T.Mesh geometry={base} material={lib.wood} position.y={-.3}/>
 <T.Mesh geometry={rim} material={lib.brass} position.y={-.09}/>
 <T.Mesh geometry={felt} material={lib.cloth}/>
 {#each dice as die,i (die.id)}
  {@const row=dice.length>4&&i>=4?1:0}
  {@const count=row?dice.length-4:Math.min(dice.length,4)}
  {@const col=row?i-4:i}
  <Die lib={lib} value={die.value} position={[(col-(count-1)/2)*1.65,.68,dice.length>4?(row?1:-.85):0]} rotation={[0,(i%2?.12:-.1),0]} selected={selected.includes(die.id)} onclick={()=>{if(interactive)toggle(die.id);}}/>
 {/each}
{/if}
