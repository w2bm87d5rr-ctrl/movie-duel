const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
const origin=process.env.MOVIE_DUEL_TEST_URL||'http://127.0.0.1:3093';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
(async()=>{
 const wk=process.env.MOVIE_DUEL_BROWSER==='webkit';const browser=await(wk?webkit:chromium).launch(wk?{executablePath:process.env.WEBKIT_EXECUTABLE_PATH}:{executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await ctx.route(/https:\/\/(image|media)\.tmdb\.org\//,r=>r.fulfill({contentType:'image/png',body:png}));
 const deck=Array.from({length:6},(_,i)=>({id:900001+i,title:`Original ${i}`,originalTitle:`Original ${i}`,year:1985,poster:`https://image.tmdb.org/t/p/w500/base-${i}.jpg`,genres:[18],countries:['US'],language:'en',score:8,votes:1000}));
 await ctx.route('**/api/match',r=>r.fulfill({json:{status:'ready',config:{duels:5,difficulty:'normal',genre:'',decade:'',country:'',language:'',people:[]},deck,reserves:[]}}));
 let held=[];await ctx.route('**/api/presentation',r=>held.push(r));
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.posterChanges=[];new MutationObserver(records=>{for(const r of records){if(r.type==='attributes'&&r.target.matches('.poster-frame img,.home-poster-frame img'))window.posterChanges.push(r.target.src);for(const n of r.addedNodes||[]){if(n.nodeType===1)for(const img of [n,...n.querySelectorAll('img')])if(img.matches('.poster-frame img,.home-poster-frame img'))window.posterChanges.push(img.src)}}}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['src']})});
 const ready=()=>p.waitForFunction(()=>document.querySelectorAll('.choose').length===2&&[...document.querySelectorAll('.choose')].every(b=>!b.disabled));
 const start=async()=>{await p.goto(origin);await p.getByRole('button',{name:'PERSONALIZAR PARTIDA',exact:true}).click();await p.locator('#duels').fill('5');await p.getByRole('button',{name:'EMPEZAR PARTIDA',exact:true}).click();await p.locator('.arena').waitFor()};
 const metadata=Object.fromEntries(deck.map((m,i)=>[m.id,{title:`Regional ${i}`,originalTitle:m.title,poster:`https://image.tmdb.org/t/p/w500/regional-${i}.jpg`,version:1,expiresAt:Date.now()+60000}]));
 const release=async()=>{const pending=held;held=[];for(const r of pending)try{await r.fulfill({json:{presentation:metadata}})}catch{}};
 await start();assert.equal(await p.locator('.poster-frame img').count(),0);const sizes=await p.locator('.poster-frame').evaluateAll(es=>es.map(e=>({w:e.clientWidth,h:e.clientHeight})));assert.ok(sizes.every(s=>Math.abs(s.w/s.h-2/3)<0.01));
 await release();await ready();const sources=await p.locator('.poster-frame img').evaluateAll(es=>es.map(e=>e.src));assert.ok(sources.every(s=>s.includes('regional-')));assert.ok(!(await p.evaluate(()=>window.posterChanges)).some(s=>s.includes('base-')));
 // A recovered presentation cache must skip the default image on reload.
 await p.reload();await p.getByRole('button',{name:'CONTINUAR PARTIDA',exact:true}).click();await ready();assert.deepEqual(await p.locator('.poster-frame img').evaluateAll(es=>es.map(e=>e.src)),sources);
 // Fast navigation: old unmounted work cannot replace the current slot.
 await p.locator('.choose').first().click();await p.getByRole('button',{name:'← INICIO',exact:true}).click();await p.getByRole('button',{name:'CONTINUAR PARTIDA',exact:true}).click();await ready();await p.getByRole('button',{name:'↶ DESHACER',exact:true}).click();await ready();assert.deepEqual(await p.locator('.poster-frame img').evaluateAll(es=>es.map(e=>e.src)),sources);
 // Cold metadata timeout: fallback is shown once and late results cannot swap it.
 await p.close();const q=await ctx.newPage();await q.addInitScript(()=>localStorage.clear());await q.goto(origin);await q.getByRole('button',{name:'PERSONALIZAR PARTIDA',exact:true}).click();await q.locator('#duels').fill('5');await q.getByRole('button',{name:'EMPEZAR PARTIDA',exact:true}).click();await q.waitForFunction(()=>document.querySelectorAll('.choose').length===2&&[...document.querySelectorAll('.choose')].every(b=>!b.disabled));
 const fallback=await q.locator('.poster-frame img').evaluateAll(es=>es.map(e=>e.src));assert.ok(fallback.every(s=>s.includes('base-')));await release();await q.waitForFunction(()=>document.querySelector('.movie h2').textContent.startsWith('Regional'));assert.deepEqual(await q.locator('.poster-frame img').evaluateAll(es=>es.map(e=>e.src)),fallback);
 assert.equal(errors.length,0);console.log(`${wk?'WebKit':'Chromium'} stable posters PASS: placeholder 2:3, final-only initial image, saved cache, fast navigation, undo, timeout and late-result freeze`);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
