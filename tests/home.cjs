const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const base=process.env.MOVIE_DUEL_TEST_URL||'http://127.0.0.1:3063';
(async()=>{
 const useWebKit=process.env.MOVIE_DUEL_BROWSER==='webkit';
 const browser=await (useWebKit?webkit:chromium).launch(useWebKit?{executablePath:process.env.WEBKIT_EXECUTABLE_PATH}:{executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext();const cache=new Map();const widths=new Map();
 await context.route(/https:\/\/image\.tmdb\.org\//,async route=>{
  const url=route.request().url();if(!cache.has(url))cache.set(url,execFileSync('curl',['-fsSL','--max-time','20',url]));
  await route.fulfill({contentType:'image/jpeg',body:cache.get(url)});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[390,568],[768,900],[1440,900]]){
  await page.setViewportSize({width,height});await page.goto(base);
  await page.getByRole('heading',{name:'¿Cuál será tu favorita?',exact:true}).waitFor();
  const images=page.locator('.home-posters img');await page.waitForFunction(()=>document.querySelectorAll('.home-posters img').length===2);assert.equal(await images.count(),2);
  await page.waitForFunction(()=>[...document.querySelectorAll('.home-posters img')].every(i=>i.complete&&i.naturalWidth>0));
  const frames=await page.locator('.home-poster-frame').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}}));
  assert.equal(frames[0].width,frames[1].width);assert.equal(frames[0].height,frames[1].height);assert.ok(Math.abs(frames[0].width/frames[0].height-2/3)<0.01);
  assert.deepEqual(await images.evaluateAll(es=>es.map(e=>getComputedStyle(e).objectFit)),['contain','contain']);
  assert.equal(await page.locator('.home-duel').getAttribute('aria-hidden'),'true');assert.equal(await page.locator('.home-posters button,.home-posters a,[class="home-posters"] [tabindex]').count(),0);
  assert.equal(await page.locator('.home-vs').textContent(),'VS');
  const order=await page.evaluate(()=>['.description','.home-posters','.home-vs','.home-actions'].map(s=>document.querySelector(s).getBoundingClientRect().top));assert.ok(order.every((n,i)=>!i||n>order[i-1]));
  assert.equal(await page.locator('.quick-duels').count(),0);assert.equal(await page.locator('.description').textContent(),'Dos películas. Una sola campeona.');
  if(width>=375&&width<=430)assert.ok(frames[0].width>=150&&frames[0].width<=175,'mobile posters too small or too large');
  if(widths.has(width))assert.equal(frames[0].width,widths.get(width),'posters shrink on shorter screens');widths.set(width,frames[0].width);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width===390&&height===844&&process.env.MOVIE_DUEL_HOME_SCREENSHOT)await page.screenshot({path:process.env.MOVIE_DUEL_HOME_SCREENSHOT,fullPage:true});
 }
 // A failed decorative image leaves controls usable and layout stable.
 await page.unroute(/https:\/\/image\.tmdb\.org\//);await page.route(/https:\/\/image\.tmdb\.org\//,r=>r.abort());await page.reload();
 await page.waitForFunction(()=>document.querySelectorAll('.home-poster-placeholder').length===2);assert.equal(await page.getByRole('button',{name:'JUGAR AHORA',exact:true}).isEnabled(),true);
 // Match generation never receives decoration IDs or additional fields.
 let config;await page.route('**/api/match',async route=>{config=route.request().postDataJSON();await route.fulfill({contentType:'application/json',body:JSON.stringify({status:'error',message:'Test de disponibilidad'})})});
 await page.getByRole('button',{name:'JUGAR AHORA',exact:true}).click();await page.getByRole('dialog').waitFor();assert.deepEqual(Object.keys(config).sort(),['country','decade','difficulty','duels','genre','language','people']);assert.deepEqual(config.people,[]);
 assert.equal(errors.length,0,errors.join('\n'));
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 // Use a known-good PNG for gameplay; decoration was checked with real images above.
 await ctx.route(/https:\/\/(image|media)\.tmdb\.org\//,r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64')}));
 const p=await ctx.newPage();const ready=()=>p.waitForFunction(()=>document.querySelectorAll('.choose').length===2&&[...document.querySelectorAll('.choose')].every(b=>!b.disabled));
 const saved=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('movie-duel:v2')));
 await p.goto(base);await p.getByRole('button',{name:'PERSONALIZAR PARTIDA',exact:true}).click();
 assert.equal(await p.locator('#duels').getAttribute('min'),'5');assert.equal(await p.locator('#duels').getAttribute('max'),'40');
 await p.locator('#genre').selectOption('18');await p.locator('#decade').selectOption('1980');
 await p.locator('#duels').fill('40');await p.getByRole('button',{name:'Experto',exact:true}).click();
 await p.getByRole('button',{name:'← INICIO',exact:true}).click();await p.reload();
 await p.getByRole('button',{name:'JUGAR AHORA',exact:true}).click();await ready();
 let state=await saved();assert.equal(state.game.config.duels,20);assert.equal(state.game.config.difficulty,'normal');assert.equal(state.game.deck.length,21);assert.equal(state.config.genre,'18');assert.equal(state.config.decade,'1980');
 await p.locator('.choose').first().click();await ready();
 await p.getByRole('button',{name:'← INICIO',exact:true}).click();
 assert.equal(await p.getByRole('button',{name:'CONTINUAR PARTIDA',exact:true}).getAttribute('class'),'primary');
 await p.reload();await p.getByRole('button',{name:'CONTINUAR PARTIDA',exact:true}).click();await ready();assert.equal((await saved()).game.history.length,1);
 await p.getByRole('button',{name:'← INICIO',exact:true}).click();await p.getByRole('button',{name:'PERSONALIZAR PARTIDA',exact:true}).click();await p.locator('#duels').fill('5');await p.getByRole('button',{name:'Experto',exact:true}).click();
 await p.getByRole('button',{name:'EMPEZAR PARTIDA',exact:true}).click();await p.getByRole('button',{name:'NUEVA PARTIDA',exact:true}).click();await ready();
 state=await saved();assert.equal(state.game.config.duels,5);assert.equal(state.game.config.difficulty,'expert');
 await p.getByRole('button',{name:'← INICIO',exact:true}).click();await p.getByRole('button',{name:'JUGAR AHORA',exact:true}).click();
 await p.getByRole('button',{name:'SEGUIR JUGANDO',exact:true}).click();await ready();assert.equal((await saved()).game.config.duels,5);
 await p.getByRole('button',{name:'← INICIO',exact:true}).click();await p.getByRole('button',{name:'JUGAR AHORA',exact:true}).click();await p.getByRole('button',{name:'NUEVA PARTIDA',exact:true}).click();await ready();
 state=await saved();assert.equal(state.game.config.duels,20);assert.equal(state.game.config.difficulty,'normal');
 await browser.close();
 console.log('PASS Home: real fixed posters, 2:3 contain, decorative accessibility, title/subtitle/order, large posters at seven sizes without height-based shrinking, VS below posters, image failure; quick play overrides saved 40/expert to 20/normal, preserves other filters, custom 5/expert, continue/reload and replacement confirmation.');
})().catch(e=>{console.error(e);process.exit(1)});
