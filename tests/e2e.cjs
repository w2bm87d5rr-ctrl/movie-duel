const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('node:assert/strict');
const base=process.env.MOVIE_DUEL_TEST_URL||'http://127.0.0.1:3001';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
async function ready(page){await page.waitForFunction(()=>[...document.querySelectorAll('.choose')].length===2&&[...document.querySelectorAll('.choose')].every(x=>!x.disabled));}
async function safe(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 // Isolate behavior from remote image/CDN availability. Real URLs are independently HEAD-checked.
 await context.route(/https:\/\/(image|media)\.tmdb\.org\//,r=>r.fulfill({contentType:'image/png',body:png}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'PERSONALIZAR PARTIDA',exact:true}).click();
 assert.equal(await page.locator('details').evaluate(e=>e.open),false);
 await page.locator('#duels').fill('5');
 await page.locator('summary').click();
 const person=page.getByRole('combobox',{name:'Actor, actriz o director'});
 await person.fill('Woody Allen');await page.getByRole('option',{name:/Woody Allen/}).click();
 await person.fill('bunuel');await page.getByRole('option',{name:/Luis Buñuel/}).click();
 assert.equal(await page.locator('.chips>span').count(),2);
 await page.getByRole('combobox',{name:'País de origen o producción'}).fill('Francia');await page.getByRole('option',{name:'Francia',exact:true}).click();
 await page.getByRole('combobox',{name:'Idioma original'}).fill('francés');await page.getByRole('option',{name:'francés',exact:true}).click();
 await page.getByRole('button',{name:'Experto',exact:true}).click();await safe(page);
 await page.getByRole('button',{name:'EMPEZAR PARTIDA',exact:true}).click();await ready(page);
 assert.equal(await page.locator('.movie-label').count(),0);
 for(let i=0;i<2;i++){
  const actual=await page.locator('.movie').nth(i).boundingBox();assert.ok(actual.width>100&&actual.x>=0);
 }
 const opening=await page.locator('.movie h2').allTextContents();
 await page.locator('.choose').first().click();await ready(page);assert.deepEqual(await page.locator('.movie-label').allTextContents(),['SELECCIÓN ACTUAL','NUEVA PELÍCULA']);
 await page.locator('.choose').last().click();await ready(page);
 await page.getByRole('button',{name:'↶ DESHACER',exact:true}).click();await ready(page);await page.getByRole('button',{name:'↶ DESHACER',exact:true}).click();await ready(page);
 assert.deepEqual(await page.locator('.movie h2').allTextContents(),opening);
 await page.locator('.choose').first().click();await ready(page);
 await page.getByRole('button',{name:'← INICIO',exact:true}).click();await page.getByRole('button',{name:'CONTINUAR PARTIDA',exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'CONTINUAR PARTIDA',exact:true}).click();await ready(page);await page.getByText('DUELO 02 / 5',{exact:true}).waitFor();
 await page.getByRole('button',{name:'← INICIO',exact:true}).click();await page.getByRole('button',{name:/JUGAR AHORA/}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'CONTINUAR LA ACTUAL'}).click();await ready(page);await page.getByText('DUELO 02 / 5',{exact:true}).waitFor();
 for(let i=0;i<4;i++){await ready(page);await page.locator('.choose').nth(i%2).click();}
 await page.getByRole('heading',{name:'¡TENEMOS CAMPEONA!'}).waitFor();await page.getByText('5 duelos completados',{exact:false}).waitFor();await safe(page);
 await page.getByRole('button',{name:'↶ DESHACER',exact:true}).click();await ready(page);await page.getByText('DUELO 05 / 5',{exact:true}).waitFor();await page.locator('.choose').first().click();
 const old=await page.locator('.result h2').textContent();await page.getByRole('button',{name:'JUGAR OTRA VEZ',exact:true}).click();await ready(page);await page.getByText('DUELO 01 / 5',{exact:true}).waitFor();
 await page.getByRole('button',{name:'← INICIO',exact:true}).click();await page.getByRole('button',{name:'PERSONALIZAR PARTIDA',exact:true}).click();assert.equal(await page.locator('#duels').inputValue(),'5');assert.equal(await page.locator('.chips>span').count(),2);
 await page.getByRole('button',{name:'RESTABLECER CONFIGURACIÓN',exact:true}).click();assert.equal(await page.locator('#duels').inputValue(),'20');assert.equal(await page.locator('.chips>span').count(),0);
 for(const width of [320,375,390,430,768,1440]){await page.setViewportSize({width,height:900});await safe(page);}
 // No-result flow and preserving selections when returning to settings.
 await page.setViewportSize({width:320,height:700});await page.locator('summary').evaluate(e=>{e.parentElement.open=true});
 await page.getByRole('combobox',{name:'Actor, actriz o director'}).fill('Morgan Freeman');await page.getByRole('option',{name:/Morgan Freeman/}).click();
 await page.getByRole('combobox',{name:'Idioma original'}).fill('japonés');await page.getByRole('option',{name:'japonés',exact:true}).click();
 await page.getByRole('button',{name:'EMPEZAR PARTIDA',exact:true}).click();await page.getByRole('button',{name:'EMPEZAR OTRA',exact:true}).click();await page.getByText('Probemos otros filtros',{exact:true}).waitFor();await page.getByRole('button',{name:'MODIFICAR FILTROS',exact:true}).click();assert.equal(await page.locator('.chips>span').count(),1);
 // Existing game survived the failed replacement.
 await page.getByRole('button',{name:'← INICIO',exact:true}).click();await page.getByRole('button',{name:'CONTINUAR PARTIDA',exact:true}).click();await ready(page);
 assert.equal(errors.length,0,errors.join('\n'));
 await context.close();
 // Real image load failure -> reserve replacement, no round increment.
 const ctx=await browser.newContext({viewport:{width:375,height:812}});let first=null;
 await ctx.route(/https:\/\/(image|media)\.tmdb\.org\//,route=>{if(!first){first=route.request().url();return route.abort()}return route.fulfill({contentType:'image/png',body:png})});
 const p=await ctx.newPage();await p.goto(base);await p.getByRole('button',{name:/JUGAR AHORA/}).click();await ready(p);await p.getByText('DUELO 01 / 20',{exact:true}).waitFor();const stored=await p.evaluate(()=>JSON.parse(localStorage.getItem('movie-duel:v2')));assert.equal(stored.game.failedIds.length,1);assert.equal(stored.game.history.length,0);await safe(p);
 await ctx.close();
 const shorter=await browser.newContext({viewport:{width:375,height:812}});
 await shorter.route(/https:\/\/(image|media)\.tmdb\.org\//,r=>r.fulfill({contentType:'image/png',body:png}));
 const sp=await shorter.newPage();await sp.goto(base);await sp.getByRole('button',{name:'PERSONALIZAR PARTIDA',exact:true}).click();await sp.locator('#duels').fill('40');await sp.locator('summary').click();await sp.getByRole('combobox',{name:'Actor, actriz o director'}).fill('Woody Allen');await sp.getByRole('option',{name:/Woody Allen/}).click();await sp.getByRole('button',{name:'EMPEZAR PARTIDA',exact:true}).click();await sp.getByText('Una partida más corta',{exact:true}).waitFor();const shorterButton=sp.getByRole('button',{name:/JUGAR \d+ DUELOS/});await shorterButton.click();await ready(sp);assert.ok((await sp.locator('.eyebrow').textContent()).includes('34'));await shorter.close();
 await browser.close();console.log('PASS: mobile 320–430 and desktop 768/1440, two posters, person/country/language controls, expert mode, 5-round end-to-end, multi-undo, reload/continue, replacement confirmation/cancel, replay, settings reset, no-result preservation, failed-poster reserve replacement, no JS errors.');
})().catch(e=>{console.error(e);process.exit(1)});
