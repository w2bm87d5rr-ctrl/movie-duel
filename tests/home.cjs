const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const base=process.env.MOVIE_DUEL_TEST_URL||'http://127.0.0.1:3063';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext();const cache=new Map();
 await context.route(/https:\/\/image\.tmdb\.org\//,async route=>{
  const url=route.request().url();if(!cache.has(url))cache.set(url,execFileSync('curl',['-fsSL','--max-time','20',url]));
  await route.fulfill({contentType:'image/jpeg',body:cache.get(url)});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[768,900],[1440,900]]){
  await page.setViewportSize({width,height});await page.goto(base);
  await page.getByRole('heading',{name:'¿Cuál será tu favorita?',exact:true}).waitFor();
  const images=page.locator('.home-posters img');assert.equal(await images.count(),2);
  await page.waitForFunction(()=>[...document.querySelectorAll('.home-posters img')].every(i=>i.complete&&i.naturalWidth>0));
  const frames=await page.locator('.home-poster-frame').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}}));
  assert.equal(frames[0].width,frames[1].width);assert.equal(frames[0].height,frames[1].height);assert.ok(Math.abs(frames[0].width/frames[0].height-2/3)<0.01);
  assert.deepEqual(await images.evaluateAll(es=>es.map(e=>getComputedStyle(e).objectFit)),['contain','contain']);
  assert.equal(await page.locator('.home-posters').getAttribute('aria-hidden'),'true');assert.equal(await page.locator('.home-posters button,.home-posters a,[class="home-posters"] [tabindex]').count(),0);
  assert.equal(await page.locator('.home-vs').textContent(),'VS');
  const order=await page.evaluate(()=>['.description','.home-posters','.quick-duels','.home-actions'].map(s=>document.querySelector(s).getBoundingClientRect().top));assert.ok(order.every((n,i)=>!i||n>order[i-1]));
  const action=await page.getByRole('button',{name:'JUGAR AHORA',exact:true}).boundingBox();assert.ok(action.y+action.height<=height,'primary action below fold at '+width+'x'+height);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width===390&&process.env.MOVIE_DUEL_HOME_SCREENSHOT)await page.screenshot({path:process.env.MOVIE_DUEL_HOME_SCREENSHOT,fullPage:true});
 }
 // A failed decorative image leaves controls usable and layout stable.
 await page.unroute(/https:\/\/image\.tmdb\.org\//);await page.route(/https:\/\/image\.tmdb\.org\//,r=>r.abort());await page.reload();
 await page.waitForFunction(()=>[...document.querySelectorAll('.home-posters img')].every(i=>i.hidden));assert.equal(await page.getByRole('button',{name:'JUGAR AHORA',exact:true}).isEnabled(),true);
 // Match generation never receives decoration IDs or additional fields.
 let config;await page.route('**/api/match',async route=>{config=route.request().postDataJSON();await route.fulfill({contentType:'application/json',body:JSON.stringify({status:'error',message:'Test de disponibilidad'})})});
 await page.getByRole('button',{name:'JUGAR AHORA',exact:true}).click();await page.getByRole('dialog').waitFor();assert.deepEqual(Object.keys(config).sort(),['country','decade','difficulty','duels','genre','language','people']);assert.deepEqual(config.people,[]);
 assert.equal(errors.length,0,errors.join('\n'));await browser.close();
 console.log('PASS Home: real fixed posters, 2:3 contain, decorative accessibility, title/subtitle/order, primary action above fold at six sizes, image failure and unchanged match payload.');
})().catch(e=>{console.error(e);process.exit(1)});
