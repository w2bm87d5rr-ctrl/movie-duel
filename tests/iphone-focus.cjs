const {chromium,webkit,devices}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const base=process.env.MOVIE_DUEL_TEST_URL||'http://127.0.0.1:3001';
const useWebKit=process.env.MOVIE_DUEL_BROWSER==='webkit';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
(async()=>{
 const browser=await (useWebKit?webkit:chromium).launch(useWebKit?{executablePath:process.env.WEBKIT_EXECUTABLE_PATH}:{executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 for(const width of [320,375,390,430]){
  const context=await browser.newContext({...devices['iPhone 13'],viewport:{width,height:844}});
  await context.route(/https:\/\/(image|media)\.tmdb\.org\//,r=>r.fulfill({contentType:'image/png',body:png}));
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.getByRole('button',{name:'PERSONALIZAR PARTIDA',exact:true}).click();await page.locator('summary').click();
  assert.equal(await page.locator('meta[name="viewport"]').count(),1);
  const viewport=await page.locator('meta[name="viewport"]').getAttribute('content');
  assert.match(viewport,/width=device-width/);assert.match(viewport,/initial-scale=1/);assert.doesNotMatch(viewport,/maximum-scale|minimum-scale|user-scalable\s*=\s*(no|0)/i);
  async function stable(){const state=await page.evaluate(()=>({scale:window.visualViewport?.scale||1,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}));assert.equal(state.scale,1);assert.equal(state.width,width);assert.equal(state.overflow,false)}
  async function field(label,query,result){
   const input=page.getByRole('combobox',{name:label,exact:true});assert.ok(await input.evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16),`${label}: small font`);
   await input.tap();await stable();await input.fill(query);const option=page.getByRole('option',{name:result,exact:true});await option.waitFor();
   const list=page.getByRole('listbox',{name:label,exact:true});const rect=await list.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1,'autocomplete outside viewport');await stable();
   await option.tap();assert.equal(await input.getAttribute('aria-expanded'),'false');await input.evaluate(e=>e.blur());await stable();
  }
  await field('Actor, actriz o director','Al Pacino',/Al Pacino/);
  await field('Actor, actriz o director','Robert De Niro',/Robert De Niro/);
  assert.equal(await page.locator('.chips>span').count(),2);
  await page.getByRole('button',{name:'Quitar Robert De Niro',exact:true}).tap();
  await field('País de origen o producción','Francia','Francia');
  await field('Idioma original','francés','francés');
  await page.getByRole('button',{name:'Quitar filtro de País de origen o producción',exact:true}).tap();
  await field('Actor, actriz o director','Robert De Niro',/Robert De Niro/);
  // Stress an unbroken suggestion label independently of TMDB availability.
  await page.route('**/api/people?q=super',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({people:[{id:999001,name:'NombreSinEspacios'.repeat(20)}]})}));
  const actor=page.getByRole('combobox',{name:'Actor, actriz o director',exact:true});await actor.tap();await actor.fill('super');await page.getByRole('option',{name:/NombreSinEspacios/}).waitFor();await stable();
  assert.equal(await page.locator('.suggestions').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'long label overflows');
  await page.locator('h1').tap();await actor.evaluate(e=>e.blur());await stable();
  await page.reload();await page.getByRole('button',{name:'PERSONALIZAR PARTIDA',exact:true}).click();assert.equal(await page.locator('.chips>span').count(),2);
  assert.equal(errors.length,0,errors.join('\n'));await context.close();
 }
 await browser.close();console.log(`PASS ${useWebKit?'WebKit on Linux (not real iPhone Safari)':'Chromium mobile emulation'}: 16px search inputs, zoom-permitting viewport, focus/type/select/blur scale and width, long autocomplete labels and persistent multi-person selection at 320/375/390/430px.`);
})().catch(e=>{console.error(e.message);process.exit(1)});
