import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {levels,solve} from '../src/game.ts';
import {echoPoint,projectEcho} from '../src/echo.ts';
import {example,confirmIdentity,fields} from '../src/input.ts';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/86137/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(import.meta.dirname,'../verification');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1100,height:900},reducedMotion:'reduce',acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const board=async()=>JSON.parse(await page.locator('#app').getAttribute('data-board'));
  const press=async key=>{await page.locator('#stage').focus();await page.keyboard.press(key);};
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4188/');await page.locator('#sample-weather').click();await page.locator('#route-one').check();await page.locator('#start').click();
  assert(await page.locator('#listen-echo').isHidden());await press('e');assert(!await page.locator('#echo-dialog').isVisible());
  for(const key of ['ArrowUp','ArrowRight','ArrowRight','ArrowRight'])await press(key);
  assert(await page.locator('#listen-echo').isVisible());const before=await board();await press('e');
  assert(await page.locator('#echo-dialog').isVisible());const original=await page.locator('#echo-text').innerText();assert(original.includes('城市'));
  await page.keyboard.press('ArrowDown');await page.keyboard.press('z');assert.deepEqual(await board(),before);
  await page.keyboard.press('Escape');assert(await page.locator('#echo-dialog').isHidden());assert.deepEqual(await board(),before);
  await page.locator('#listen-echo').click();await page.locator('#echo-keep').click();assert(await page.locator('#echo-keep').isHidden());
  const pixels=await page.locator('#echo-canvas').evaluate(canvas=>canvas.toDataURL());await page.screenshot({path:path.join(out,'echo-collected.png'),fullPage:true});
  for(const width of [320,390,1100]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('#echo-dialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth));}
  assert.equal(await page.locator('#echo-canvas').evaluate(canvas=>canvas.toDataURL()),pixels);
  await page.locator('#echo-close').click();await press('z');await press('e');assert(await page.locator('#echo-keep').isHidden());assert.equal(await page.locator('#echo-text').innerText(),original);await page.locator('#echo-close').click();
  const route=await solve(levels[0],await board());assert(route);for(const action of route)await press(action==='switch'?'x':{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[action]);
  assert.equal(await page.locator('#app').getAttribute('data-state'),'cleared');await page.locator('#next-level').click();await page.locator('#memory-continue').click();
  assert.equal(await page.locator('#app').getAttribute('data-state'),'waiting');assert(await page.locator('#echo-atlas').isVisible());
  await page.locator('#echo-atlas summary').click();assert.equal(await page.locator('#echo-stars button').count(),1);await page.locator('#echo-stars button').click();assert.equal(await page.locator('#echo-text').innerText(),original);await page.locator('#echo-close').click();
  await page.locator('#lamp').click();assert.equal(await page.locator('#app').getAttribute('data-state'),'done');
  const sample=example('weather'),id=confirmIdentity(sample,Object.fromEntries(fields.map(k=>[k,sample.facts[k].value])),sample.prop,sample.palette,sample.accessory,'','undecided');
  await page.locator('#echo-tab').click();
  const p=echoPoint(projectEcho(id,0,{notes:{}})),bounds=await page.locator('#echo-atlas-canvas').boundingBox();
  await page.locator('#echo-atlas-canvas').click({position:{x:p.x*bounds.width/384,y:p.y*bounds.height/120}});assert(await page.locator('#echo-dialog').isVisible());await page.locator('#echo-close').click();
  const book=page.waitForEvent('download');await page.locator('#save-book').click();await(await book).saveAs(path.join(out,'echo-book.html'));const html=fs.readFileSync(path.join(out,'echo-book.html'),'utf8');assert(html.includes('回声星图'));assert(html.includes(original));
  await page.screenshot({path:path.join(out,'echo-farewell.png'),fullPage:true});
  await page.locator('#replay').click();assert(await page.locator('#echo-atlas').isHidden());for(const key of ['ArrowUp','ArrowRight','ArrowRight','ArrowRight'])await press(key);
  await page.locator('#open-settings').click();await page.locator('#settings-reduced').uncheck();await page.locator('#game-settings .primary').click();await page.locator('#listen-echo').click();assert(await page.locator('#echo-keep').isVisible());
  const paper=await page.locator('#echo-canvas').evaluate(c=>c.toDataURL());await page.locator('#echo-keep').click();
  await page.waitForTimeout(1700);const star=await page.locator('#echo-canvas').evaluate(c=>c.toDataURL());assert.notEqual(star,paper);
  await page.locator('#echo-close').click();await press('ArrowDown');await page.waitForTimeout(180);assert.notDeepEqual(await board(),before);
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4188/');await page.locator('#sample-weather').click();await page.locator('#start').click();
  for(let i=0;i<7;i++){
    let collected=false;const route=await solve(levels[i],await board());assert(route);
    for(const action of [...route,'listen']){
      if(!collected&&await page.locator('#listen-echo').isVisible()){
        await page.locator('#listen-echo').click();await page.locator('#echo-keep').click();await page.locator('#echo-close').click();collected=true;
      }
      if(action!=='listen')await press(action==='switch'?'x':{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[action]);
    }
    assert(collected,`Echo ${i} reachable during the actual puzzle`);await page.locator('#next-level').click();await page.locator('#memory-continue').click();
  }
  assert.equal(await page.locator('#app').getAttribute('data-state'),'waiting');await page.locator('#lamp').click();await page.locator('#echo-tab').click();assert.equal(await page.locator('#result-echo-stars button').count(),7);
  await page.screenshot({path:path.join(out,'echo-seven-stars.png'),fullPage:true});
  for(let i=0;i<7;i++){await page.locator('#result-echo-stars button').nth(i).click();assert(await page.locator('#echo-keep').isHidden());await page.locator('#echo-close').click();}
  assert.deepEqual(errors,[]);console.log('Echo: discovery, modal input isolation, cancel, snapshot, undo, one-stop and seven-stop collection, clickable sky, export, replay reset, animation and 320/390 px passed.');
}finally{await browser.close();}
