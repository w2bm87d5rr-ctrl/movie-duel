const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.MOVIE_DUEL_TEST_URL||'http://127.0.0.1:3091';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
(async()=>{
 const wk=process.env.MOVIE_DUEL_BROWSER==='webkit';
 const browser=await(wk?webkit:chromium).launch(wk?{executablePath:process.env.WEBKIT_EXECUTABLE_PATH}:{executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await ctx.route(/https:\/\/(image|media)\.tmdb\.org\//,r=>r.request().url().includes('broken-local')?r.abort():r.fulfill({contentType:'image/png',body:png}));
 let pending=[];await ctx.route('**/api/presentation',route=>{pending.push(route)});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>document.querySelectorAll('.choose').length===2&&[...document.querySelectorAll('.choose')].every(b=>!b.disabled));
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('movie-duel:v2')));
 await page.goto(base);await page.getByRole('button',{name:'PERSONALIZAR PARTIDA',exact:true}).click();await page.locator('#duels').fill('5');await page.getByRole('button',{name:'EMPEZAR PARTIDA',exact:true}).click();await ready();
 const before=(await saved()).game;assert.equal(before.config.duels,5);
 // Gameplay started while every localization request is still unanswered.
 await page.locator('.choose').first().click();await ready();
 const afterChoice=(await saved()).game;assert.equal(afterChoice.history.length,1);
 await page.unroute('**/api/presentation');
 const localized={};for(const m of [...afterChoice.deck,...afterChoice.reserves])localized[m.id]={title:`Título regional muy extenso ${m.id}`,originalTitle:m.title,version:1,expiresAt:Date.now()+60000,poster:'https://image.tmdb.org/t/p/w500/broken-local.jpg'};
 for(const route of pending){try{await route.fulfill({json:{presentation:localized}})}catch{}}
 await page.waitForFunction(()=>document.querySelector('.movie h2')?.textContent.startsWith('Título regional'));
 await ready();assert.deepEqual((await saved()).game,afterChoice);
 assert.ok((await page.locator('.poster-button').first().getAttribute('aria-label')).includes('Título regional'));
 for(const width of [320,375,390,430,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
 await page.getByRole('button',{name:'↶ DESHACER',exact:true}).click();await ready();assert.deepEqual((await saved()).game.pair,before.pair);
 // Persisted metadata survives continuation without changing saved movie objects.
 await page.reload();await page.getByRole('button',{name:'CONTINUAR PARTIDA',exact:true}).click();await ready();assert.deepEqual((await saved()).game.deck,before.deck);
 for(let i=0;i<5;i++){await ready();await page.locator('.choose').first().click()}
 await page.getByRole('heading',{name:'¡TENEMOS CAMPEONA!'}).waitFor();assert.ok((await page.locator('.result h2').textContent()).startsWith('Título regional'));
 assert.equal((await saved()).game.history.length,5);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(`${wk?'WebKit':'Chromium'} localization: nonblocking start, progressive titles, failed localized posters, unchanged IDs/order, persistence, undo, champion and responsive PASS`);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
