import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/86137/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(import.meta.dirname,'../verification');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.locator('#app').getAttribute('data-state');
try{
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4188/');await page.locator('#sample-weather').click();
  await page.locator('[data-preflight=heart]').click();await page.locator('#farewell-intent').selectOption('release');await page.locator('#start').click();await page.locator('#skip').click();
  await page.locator('#begin-ritual').click();assert((await page.locator('#ritual-unfinished').innerText()).includes('实时天气'));
  await page.locator('#ritual-next').click();await page.locator('#ritual-next').click();assert((await page.locator('#ritual-error').innerText()).includes('先选'));
  await page.keyboard.press('Escape');assert.equal(await state(),'waiting');assert(await page.locator('#farewell-ritual').isHidden());
  await page.locator('#begin-ritual').click();assert(await page.locator('#ritual-page-1').isVisible());
  await page.locator('#ritual-lights button').first().click();await page.locator('#ritual-next').click();
  await page.locator('#ritual-signature').fill('🌙'.repeat(25));await page.locator('#ritual-next').click();assert((await page.locator('#ritual-error').innerText()).includes('24'));
  await page.locator('#ritual-signature').fill('<十年的我>');await page.locator('#ritual-close').click();await page.locator('#begin-ritual').click();assert.equal(await page.locator('#ritual-signature').inputValue(),'<十年的我>');
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('#farewell-ritual').evaluate(d=>d.scrollWidth<=d.clientWidth));}
  await page.screenshot({path:path.join(out,'ritual-signature.png'),fullPage:true});
  await page.locator('#ritual-close').click();await page.locator('#open-settings').click();await page.locator('#settings-reduced').uncheck();await page.locator('#game-settings .primary').click();
  await page.locator('#begin-ritual').click();await page.locator('#ritual-next').click();assert.equal(await state(),'fading');
  await page.waitForTimeout(6500);await page.screenshot({path:path.join(out,'ritual-lanterns.png'),fullPage:true});
  await page.waitForFunction(()=>document.getElementById('app').dataset.state==='done'&&!document.getElementById('download').disabled);
  await page.locator('[data-result-page=ritual]').click();assert((await page.locator('#ritual-receipt').innerText()).includes('<十年的我>'));assert((await page.locator('#ritual-receipt').innerText()).includes('未完成的，就停在这里'));assert((await page.locator('#journey-stats').innerText()).includes('0 / 7'));
  await page.screenshot({path:path.join(out,'ritual-receipt.png'),fullPage:true});
  const bookEvent=page.waitForEvent('download');await page.locator('#save-book').click();await(await bookEvent).saveAs(path.join(out,'ritual-book.html'));const html=fs.readFileSync(path.join(out,'ritual-book.html'),'utf8');assert(html.includes('&lt;十年的我&gt;'));assert(html.includes('不是项目完工证明'));
  const pngEvent=page.waitForEvent('download');await page.locator('#download').click();await(await pngEvent).saveAs(path.join(out,'ritual-ticket.png'));assert(fs.statSync(path.join(out,'ritual-ticket.png')).size>10000);
  await page.locator('#replay-ceremony').click();await page.locator('#skip-ceremony').click();await page.locator('[data-result-page=ritual]').click();assert((await page.locator('#ritual-receipt').innerText()).includes('<十年的我>'));
  await page.locator('#replay').click();await page.waitForFunction(()=>document.getElementById('app').dataset.state==='playing');await page.locator('#skip').click();await page.locator('#lamp').click();await page.locator('#skip-ceremony').click();assert(await page.locator('#ritual-tab').isHidden());
  await page.locator('#open-settings').click();await page.locator('#settings-reduced').check();await page.locator('#game-settings .primary').click();await page.locator('#replay').click();await page.locator('#skip').click();await page.locator('#begin-ritual').click();await page.locator('#ritual-next').click();await page.locator('#ritual-lights button').last().click();await page.locator('#ritual-next').click();await page.locator('#ritual-next').click();assert.equal(await state(),'done');await page.locator('[data-result-page=ritual]').click();assert((await page.locator('#ritual-receipt').innerText()).includes('不署名'));
  assert.deepEqual(errors,[]);console.log('Ritual: cancellation, resume, Unicode validation, 320/390px, animation, safe HTML/PNG, replay, reduced motion and optional direct exit passed.');
}finally{await browser.close();}
