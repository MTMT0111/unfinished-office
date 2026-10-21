import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {levels,newBoard,solve} from '../src/game.ts';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/86137/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(import.meta.dirname,'../verification');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.locator('#app').getAttribute('data-state');
try{
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4188/');await page.locator('#sample-weather').click();assert(await page.locator('#route-full').isChecked());await page.locator('#route-one').check();
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.screenshot({path:path.join(out,'itinerary-choice.png'),fullPage:true});
  await page.locator('[data-preflight=heart]').click();await page.locator('#farewell-intent').selectOption('release');await page.locator('#start').click();assert.equal(await state(),'playing');assert.equal(await page.locator('#app').getAttribute('data-itinerary'),'one');
  const route=await solve(levels[0],newBoard(levels[0]));assert(route);const keys={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',switch:'x'};
  await page.locator('#stage').focus();for(const action of route)await page.keyboard.press(keys[action]);assert.equal(await state(),'cleared');await page.locator('#next-level').click();assert.equal(await state(),'memory');assert(await page.locator('#short-memory-guide').isVisible());
  await page.locator('#memory-back').click();await page.locator('#undo').click();assert.equal(await state(),'playing');await page.locator('#redo').click();await page.locator('#next-level').click();
  await page.locator('[data-memory-mode=relic]').click();await page.locator('[data-relic-place=keep]').click();await page.locator('#memory-continue').click();assert.equal(await state(),'waiting');assert.equal(await page.locator('#app').getAttribute('data-level'),'0');
  const routeStatus=await page.locator('.cover-route li').evaluateAll(stops=>stops.map(s=>s.dataset.progress));assert.equal(routeStatus.filter(s=>s==='complete').length,1);assert.equal(routeStatus.at(-1),'current');
  await page.locator('#begin-ritual').click();await page.locator('#ritual-next').click();await page.locator('#ritual-lights button').filter({hasText:'README.md'}).click();await page.locator('#ritual-next').click();await page.locator('#ritual-signature').fill('这几年，谢谢了');await page.locator('#ritual-next').click();assert.equal(await state(),'done');
  await page.waitForFunction(()=>!document.getElementById('download').disabled);const stats=await page.locator('#journey-stats').innerText();assert(stats.includes('1 / 7'));assert(stats.includes('一站同行'));assert(!stats.includes('提前到站'));
  await page.screenshot({path:path.join(out,'itinerary-result.png'),fullPage:true});
  await page.locator('[data-result-page=memories]').click();await page.locator('#relic-collection button').click();assert.equal(await state(),'memory');await page.locator('#memory-continue').click();assert.equal(await state(),'done');assert.equal(await page.locator('#journey-stats').innerText(),stats);
  const book=page.waitForEvent('download');await page.locator('#save-book').click();await(await book).saveAs(path.join(out,'itinerary-book.html'));const html=fs.readFileSync(path.join(out,'itinerary-book.html'),'utf8');assert(html.includes(stats));assert(html.includes('README.md'));assert(html.includes('这几年，谢谢了'));assert(!html.includes('id="memory-1"'));
  await page.locator('#replay').click();assert.equal(await page.locator('#app').getAttribute('data-itinerary'),'one');await page.locator('#skip').click();await page.locator('#lamp').click();assert((await page.locator('#journey-stats').innerText()).includes('0 / 7'));assert((await page.locator('#journey-stats').innerText()).includes('提前到站'));
  assert.deepEqual(errors,[]);console.log('One-stop journey passed: actual puzzle, undo/redo, relic, ceremony, honest export, result revisit, replay, early arrival, responsive layout.');
}finally{await browser.close();}
