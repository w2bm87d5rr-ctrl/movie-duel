const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
const origin=process.env.MOVIE_DUEL_TEST_URL||'http://127.0.0.1:3101',baseline=process.env.MOVIE_DUEL_BASELINE==='1',rushed=process.env.MOVIE_DUEL_RUSHED==='1';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const wk=process.env.MOVIE_DUEL_BROWSER==='webkit';const browser=await(wk?webkit:chromium).launch(wk?{executablePath:process.env.WEBKIT_EXECUTABLE_PATH}:{executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const ids=Array.from({length:6},(_,i)=>910001+i),deck=ids.map(id=>({id,title:`Original ${id}`,originalTitle:`Original ${id}`,year:1985,poster:`https://image.tmdb.org/t/p/w500/base-${id}.jpg`,genres:[18],countries:['US'],language:'en',score:8,votes:1000}));
 const localized=id=>({title:`Regional ${id}`,originalTitle:`Original ${id}`,poster:`https://image.tmdb.org/t/p/w500/regional-${id}.jpg`,version:1,expiresAt:Date.now()+60000});
 const requests=[],downloads=[],cache=new Map(),metadata=[];
 await ctx.route(/https:\/\/(image|media)\.tmdb\.org\//,async r=>{const url=r.request().url();requests.push(url);if(!cache.has(url)){downloads.push(url);cache.set(url,delay(300))}await cache.get(url);try{await r.fulfill({contentType:'image/png',body:png})}catch{}});
 await ctx.route('**/api/presentation',async r=>{const {ids:batch}=r.request().postDataJSON();metadata.push(...batch);await delay(rushed&&batch.includes(ids[2])?3000:180);try{await r.fulfill({json:{presentation:Object.fromEntries(batch.map(id=>[id,localized(id)]))}})}catch{}});
 await ctx.route('**/api/match',r=>r.fulfill({json:{status:'ready',config:{duels:5,difficulty:'normal',genre:'',decade:'',country:'',language:'',people:[]},deck,reserves:[]}}));
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const ready=()=>p.waitForFunction(()=>document.querySelectorAll('.choose').length===2&&[...document.querySelectorAll('.choose')].every(b=>!b.disabled));
 const futureIds=()=>[...new Set(downloads.map(u=>Number(u.match(/-(91000\d)\.jpg/)?.[1])).filter(Boolean))];
 await p.goto(origin);await p.getByRole('button',{name:'PERSONALIZAR PARTIDA',exact:true}).click();await p.locator('#duels').fill('5');await p.getByRole('button',{name:'EMPEZAR PARTIDA',exact:true}).click();await ready();
 if(!rushed)await delay(700);const before=futureIds();
 if(!baseline){assert.deepEqual(before.sort(),ids.slice(0,rushed?2:3));assert.deepEqual([...new Set(metadata.filter(id=>ids.includes(id)))].sort(),ids.slice(0,3));assert.ok(!downloads.some(u=>u.includes(`base-${ids[2]}`)),'future opponent must not download speculative base artwork')}
 await p.locator('.poster-frame img').last().evaluate(e=>window.winnerImage=e);
 const title=await p.locator('.movie h2').last().textContent(),downloadCount=downloads.length,start=performance.now();await p.locator('.choose').last().click();if(rushed){assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('movie-duel:v2')).game.history.length),1);assert.ok(await p.getByRole('button',{name:'← INICIO',exact:true}).isEnabled());assert.ok(performance.now()-start<600,'choice itself must not wait for preloading')}await ready();const transitionMs=Math.round(performance.now()-start);
 if(!baseline)assert.equal(metadata.filter(id=>id===ids[2]).length,1,'in-flight next-opponent localization must be shared when it becomes visible');
 const sameWinner=await p.locator('.poster-frame img').first().evaluate(e=>e===window.winnerImage);assert.equal(await p.locator('.movie h2').first().textContent(),title);
 if(!baseline){assert.ok(sameWinner,'winning image DOM node must remain mounted');assert.ok(downloads.slice(downloadCount).every(u=>!u.includes(String(ids[1]))),'winner must not download again');assert.ok(futureIds().every(id=>ids.slice(0,4).includes(id)))}
 await delay(700);if(!baseline)assert.deepEqual(futureIds().sort(),ids.slice(0,4));
 // Undo and resume preserve deck and history, and never start requests beyond the new window.
 await p.getByRole('button',{name:'↶ DESHACER',exact:true}).click();await ready();await p.locator('.choose').last().click();await ready();
 await p.getByRole('button',{name:'← INICIO',exact:true}).click();await p.reload();await p.getByRole('button',{name:'CONTINUAR PARTIDA',exact:true}).click();await ready();
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('movie-duel:v2')));assert.deepEqual(saved.game.deck,deck);assert.equal(saved.game.history.length,1);
 for(let i=0;i<4;i++){
  await ready();const state=await p.evaluate(()=>JSON.parse(localStorage.getItem('movie-duel:v2')).game),round=state.history.length;
  if(!baseline)assert.ok(futureIds().every(id=>ids.slice(0,Math.min(6,round+3)).includes(id)));
  await p.locator('.choose').first().click();
 }
 await p.getByRole('heading',{name:'¡TENEMOS CAMPEONA!'}).waitFor();const end=downloads.length;await delay(700);assert.equal(downloads.length,end,'no future downloads after champion');assert.equal(errors.length,0);
 console.log(JSON.stringify({browser:wk?'WebKit':'Chromium',baseline,rushed,controlledLatency:{metadata:180,nextMetadata:rushed?3000:180,image:300,decision:rushed?0:700},transitionMs,sameWinnerNode:sameWinner,downloadedWhileAB:before,checks:baseline?'baseline transition measurement, deck, undo, resume and champion':'one future only, final image only, metadata window, unchanged deck, undo, resume, champion and no JS errors'}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
