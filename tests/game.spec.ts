import {test,expect,type Page} from '@playwright/test';
import {type Event} from '../src/game/engine';
async function seeded(page:Page,seed=42){await page.goto('/');await expect(page.getByRole('button',{name:'Play a companion'})).toBeEnabled();await page.evaluate(async(seed)=>{const {repository}=await import('/src/game/repository.ts' as string);const repo=await repository();const id=await repo.create(seed);localStorage.setItem('farkle:e2e',id);},seed);await page.goto('/');await expect(page.getByRole('button',{name:'Roll 7 dice'})).toBeVisible();}
test('digital dice select, bank, companion, reload and log export',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await seeded(page);
 await page.getByRole('button',{name:'Roll 7 dice',exact:true}).click();await expect(page.getByRole('button',{name:/Die 1:/})).toBeVisible();
 const scoring=page.getByRole('button',{name:/Die \d+: (1|5)$/}).first();await scoring.click();await expect(scoring).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:/Keep \d+ points/}).click();await page.getByRole('button',{name:/Bank \d+/}).click();
 await expect(page.getByText('COMPANION’S TURN',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Roll 7 dice',exact:true})).toBeVisible({timeout:20000});
 await page.getByRole('button',{name:'History & rules'}).click();const rows=await page.locator('.log li').count();expect(rows).toBeGreaterThan(5);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download action log'}).click();const file=await download;expect(file.suggestedFilename()).toMatch(/farkle-.*\.json/);await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.reload();await expect(page.getByRole('button',{name:'Roll 7 dice',exact:true})).toBeVisible();await page.getByRole('button',{name:'History & rules'}).click();expect(await page.locator('.log li').count()).toBe(rows);expect(errors).toEqual([]);
});
test('native 3D dice pointer and phone touch select the same subsets',async({page})=>{
 await seeded(page);await page.getByRole('button',{name:'Roll 7 dice',exact:true}).click();await expect(page.getByRole('button',{name:/Die 1:/})).toBeVisible();await page.waitForTimeout(1000);
 // Raycast the actual scene: first row left die at x=-2.475,z=-.85.
 const canvas=page.locator('canvas');const box=(await canvas.boundingBox())!;
 const coords=await page.evaluate(async()=>{const {OrthographicCamera,Vector3}=await import('/node_modules/.vite/deps/three.js' as string);const el=document.querySelector('canvas')!,aspect=el.clientWidth/el.clientHeight,span=Math.max(5.2,10/aspect);const c=new OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.1,100);c.position.set(0,10,8.5);c.lookAt(0,0,0);c.updateMatrixWorld();const p=new Vector3(-2.475,.68,-.85).project(c);return {x:(p.x+1)/2,y:(1-p.y)/2};});
 await page.mouse.click(box.x+coords.x*box.width,box.y+coords.y*box.height);await expect(page.getByRole('button',{name:/Die 1:/})).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:'artifacts/desktop.png'});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);await page.getByRole('button',{name:/Die 1:/}).tap();await expect(page.getByRole('button',{name:/Die 1:/})).toHaveAttribute('aria-pressed','false');await page.screenshot({path:'artifacts/phone.png'});
});
test('transaction retries are idempotent and concurrent stale actions conflict',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'Play a companion'})).toBeEnabled();const result=await page.evaluate(async()=>{
  const {repository}=await import('/src/game/repository.ts' as string);const r=await repository(),id=await r.create(42);
  const read=(count:number,table=id)=>new Promise<Event[]>((resolve,reject)=>{let stop=()=>{};stop=r.watch(table,(events:Event[])=>{if(events.length>=count){stop();resolve(events);}},reject);});
  const events=await read(1);await r.append(id,events,{type:'roll'},'retry-id');await r.append(id,events,{type:'roll'},'retry-id');const rolled=await read(2);
  await r.append(id,rolled,{type:'keep',dice:[3]},'keep-retry');await r.append(id,rolled,{type:'keep',dice:[3]},'keep-retry');
  const afterRetry=await read(3);let conflicts=0;try{await r.append(id,events,{type:'roll'},'stale-id');}catch{conflicts++;}
  try{await r.append(id,rolled,{type:'keep',dice:[3]},'retry-id');}catch{conflicts++;}const other=await r.create(99),opening=await read(1,other);const competing=await Promise.allSettled([r.append(other,opening,{type:'roll'},'tab-a'),r.append(other,opening,{type:'roll'},'tab-b')]);return {count:afterRetry.length,conflicts,concurrent:competing.map(r=>r.status).sort()};
 });expect(result).toEqual({count:3,conflicts:2,concurrent:['fulfilled','rejected']});
});

test('downloaded intent format opens as a read-only replay and rejects corruption',async({page})=>{
 await page.goto('/');const input=page.locator('input[type=file]');
 const events:Event[]=[{id:'begin',revision:0,actor:0,action:{type:'begin',protocol:1,source:'digital',seed:42}},{id:'roll',revision:1,actor:0,action:{type:'roll'}}];
 await input.setInputFiles({name:'game.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'farkle-intents',events}))});
 await expect(page.getByText('Read-only action log',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Die 1:/})).toBeDisabled();
 await page.getByRole('button',{name:'History & rules'}).click();await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'farkle-intents',events:[events[1]]}))});await expect(page.getByRole('alert')).toContainText('Invalid event order');await expect(page.getByText('Read-only action log',{exact:true})).toBeVisible();
});

test('three-pair opening without 1s or 5s offers a scoring selection and saves it',async({page})=>{
 await seeded(page,78);await expect(page.getByRole('status')).toContainText('Saved to Firebase · 1 actions');
 await expect(page).toHaveURL(/\?table=[0-9a-f-]+$/);const tableLink=page.url();
 await page.getByRole('button',{name:'Roll 7 dice',exact:true}).click();
 await page.getByRole('button',{name:'Select three pairs · 1,500',exact:true}).click();
 await expect(page.locator('.dice-keys button[aria-pressed=true]')).toHaveCount(6);
 await page.getByRole('button',{name:'Keep 1500 points',exact:true}).click();
 await expect(page.getByRole('button',{name:'Bank 1500',exact:true})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Saved to Firebase · 3 actions');
 await page.screenshot({path:'artifacts/scoring-and-save.png'});
 // URL takes precedence over the old device preference, and reload resumes the log.
 await page.evaluate(()=>localStorage.setItem('farkle:e2e','00000000-0000-0000-0000-000000000000'));
 await page.goto(tableLink);await expect(page.getByRole('button',{name:'Bank 1500',exact:true})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Saved to Firebase · 3 actions');
 await page.setViewportSize({width:390,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
});

test('a real farkle has an enabled pass action and the companion hands back the turn',async({page})=>{
 await seeded(page,96);await page.getByRole('button',{name:'Roll 7 dice',exact:true}).click();await page.getByRole('button',{name:/Die 1:/}).click();await page.getByRole('button',{name:/Keep \d+ points/}).click();await page.getByRole('button',{name:'Roll 6 again',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Farkle!',exact:true})).toBeVisible();await expect(page.getByText('No scoring dice. Pass the dice to continue.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Pass the dice',exact:true}).click();
 await expect(page.getByText('COMPANION’S TURN',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Roll 7 dice',exact:true})).toBeVisible({timeout:20000});await expect(page.getByRole('status')).toContainText('Saved to Firebase');
});

test('save status waits for Firestore acknowledgment before reporting success',async({page})=>{
 await seeded(page);await expect(page.getByRole('status')).toContainText('Saved to Firebase · 1 actions');
 let acknowledge=()=>{};const gate=new Promise<void>(resolve=>acknowledge=resolve);
 await page.route('**/documents:commit*',async route=>{await gate;await route.continue();});
 const commit=page.waitForRequest('**/documents:commit*');
 await page.getByRole('button',{name:'Roll 7 dice',exact:true}).click();
 await commit;
 await expect(page.getByRole('status')).toHaveText('Saving to Firebase…');
 await expect(page.getByRole('button',{name:'Roll 7 dice',exact:true})).toBeDisabled();
 acknowledge();await expect(page.getByRole('status')).toContainText('Saved to Firebase · 2 actions');
 await page.unroute('**/documents:commit*');
});
