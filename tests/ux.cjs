const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.MOVIE_DUEL_TEST_URL||'http://127.0.0.1:3001';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
const ready=p=>p.waitForFunction(()=>document.querySelectorAll('.choose').length===2&&[...document.querySelectorAll('.choose')].every(b=>!b.disabled));
async function visibleModal(p,title){
 const dialog=p.getByRole('dialog',{name:title,exact:true});await dialog.waitFor();
 const rect=await dialog.boundingBox();const viewport=p.viewportSize();
 assert.ok(rect.y>=0&&rect.y+rect.height<=viewport.height,'dialog outside viewport');
 assert.ok(Math.abs(rect.y+rect.height/2-viewport.height/2)<2,'dialog not centered');
 assert.equal(await dialog.getAttribute('aria-modal'),'true');
 assert.ok(await p.evaluate(()=>Boolean(document.activeElement.closest('.match-problem'))),'focus outside dialog');
 assert.equal(await p.locator('.match-problem').evaluate(el=>el.matches(':modal')),true);
 return dialog;
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});
 await context.route(/https:\/\/(image|media)\.tmdb\.org\//,r=>r.fulfill({contentType:'image/png',body:png}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'PERSONALIZAR PARTIDA',exact:true}).click();await page.locator('summary').click();
 await page.getByRole('combobox',{name:'Actor, actriz o director'}).fill('Morgan Freeman');await page.getByRole('option',{name:/Morgan Freeman/}).click();
 await page.getByRole('combobox',{name:'Idioma original'}).fill('japonés');await page.getByRole('option',{name:'japonés',exact:true}).click();
 await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));assert.ok(await page.evaluate(()=>scrollY>200));
 const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('movie-duel:v2')).config);
 await page.getByRole('button',{name:'EMPEZAR PARTIDA',exact:true}).click();
 let modal=await visibleModal(page,'No hay suficientes películas');
 assert.equal(await modal.locator('p').textContent(),'No encontramos suficientes películas para comenzar con los filtros seleccionados.');assert.deepEqual(await modal.locator('button').allTextContents(),['MODIFICAR FILTROS']);
 for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>Boolean(document.activeElement.closest('.match-problem'))));}
 // A tap outside the native modal must not activate the header behind it.
 await page.mouse.click(30,20);assert.equal(await modal.isVisible(),true);
 await page.keyboard.press('Escape');await modal.waitFor({state:'detached'});
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('movie-duel:v2')).config),original);
 await page.waitForFunction(()=>document.querySelector('.sticky-start button')===document.activeElement);
 assert.equal(await page.locator('body').evaluate(el=>el.style.overflow),'');
 // Enough for a shorter match: real catalogue result, with exact dynamic copy.
 await page.getByRole('button',{name:'RESTABLECER CONFIGURACIÓN',exact:true}).click();await page.locator('#duels').fill('40');
 await page.getByRole('combobox',{name:'Actor, actriz o director'}).fill('Woody Allen');await page.getByRole('option',{name:/Woody Allen/}).click();await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
 await page.getByRole('button',{name:'EMPEZAR PARTIDA',exact:true}).click();modal=await visibleModal(page,'Podés jugar menos duelos');
 assert.equal(await modal.locator('p').textContent(),'Encontramos películas suficientes para 34 duelos con tu selección.');
 await modal.getByRole('button',{name:'MODIFICAR FILTROS',exact:true}).click();assert.equal(await page.locator('#duels').inputValue(),'40');assert.equal(await page.locator('.chips').textContent(),'Woody Allen×');
 await page.getByRole('button',{name:'EMPEZAR PARTIDA',exact:true}).click();modal=await visibleModal(page,'Podés jugar menos duelos');await modal.getByRole('button',{name:'JUGAR 34 DUELOS',exact:true}).click();await ready(page);assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuemax'),'34');
 await context.close();
 // Delayed network, duplicate prevention, technical error modal, retry and normal game.
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await ctx.route(/https:\/\/(image|media)\.tmdb\.org\//,r=>r.fulfill({contentType:'image/png',body:png}));
 const p=await ctx.newPage();await p.goto(base);await p.getByRole('button',{name:'PERSONALIZAR PARTIDA',exact:true}).click();await p.locator('#duels').fill('5');await p.locator('#genre').selectOption('18');
 let release;const gate=new Promise(resolve=>release=resolve);let calls=0;
 await p.route('**/api/match',async route=>{calls++;await gate;await route.fulfill({status:503,contentType:'application/json',body:'{}'})});
 await p.getByRole('button',{name:'EMPEZAR PARTIDA',exact:true}).click();
 const loading=p.locator('.sticky-start button');await p.getByRole('button',{name:'PREPARANDO PARTIDA…',exact:true}).waitFor();assert.equal(await loading.isDisabled(),true);assert.equal(await loading.getAttribute('aria-busy'),'true');
 await loading.evaluate(el=>{el.click();el.click()});assert.equal(calls,1);release();
 const error=await visibleModal(p,'No pudimos preparar la partida');assert.ok(await error.getByRole('button',{name:'REINTENTAR',exact:true}).isVisible());
 await p.unroute('**/api/match');await error.getByRole('button',{name:'REINTENTAR',exact:true}).click();await ready(p);
 let prevWidth=0;
 for(let round=1;round<=5;round++){
  const progress=p.getByRole('progressbar');assert.equal(await progress.getAttribute('aria-valuenow'),String(round));
  const width=await p.locator('.progress > div').evaluate(el=>parseFloat(el.style.width));assert.ok(width>prevWidth);prevWidth=width;
  await p.locator('.choose').first().click();if(round<5)await ready(p);
 }
 await p.getByRole('heading',{name:'¡TENEMOS CAMPEONA!',exact:true}).waitFor();
 const colors=await p.locator('.result .actions button').evaluateAll(es=>es.map(e=>({background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderColor,color:getComputedStyle(e).color})));
 assert.equal(colors[0].background,'rgb(46, 50, 54)');assert.equal(colors[1].background,'rgb(28, 32, 31)');assert.equal(colors[1].border,'rgb(69, 74, 77)');assert.ok(colors.every(c=>c.color==='rgb(255, 255, 255)'));
 await p.getByRole('button',{name:'NUEVA PARTIDA',exact:true}).click();assert.equal(await p.locator('#genre').inputValue(),'18');assert.equal(await p.locator('#duels').inputValue(),'5');assert.equal(errors.length,0,errors.join('\n'));
 await browser.close();console.log('PASS: real empty/shorter results at bottom scroll, centered accessible modals, inert backdrop, focus trap/restore, Escape and filter retention, 34-duel alternative, delayed loading/one request, visible technical error/retry, progress rounds 1–5, champion button hierarchy.');
})().catch(e=>{console.error(e);process.exit(1)});
