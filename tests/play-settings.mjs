import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {levels,newBoard,solve} from '../src/game.ts';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/86137/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(import.meta.dirname,'../verification');process.env.TEMP=path.join(out,'browser-temp');process.env.TMP=process.env.TEMP;
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.locator('#app').getAttribute('data-state'),board=()=>page.locator('#app').getAttribute('data-board');
const waitState=value=>page.waitForFunction(s=>document.getElementById('app').dataset.state===s,value);
const keys={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',switch:'x'};
const shot=name=>page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
try{
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4188/');await page.locator('#sample-weather').click();await page.locator('[data-preflight=heart]').click();
  assert.equal(await page.locator('#farewell-intent').inputValue(),'undecided');
  await page.locator('#farewell-intent').selectOption('completed');assert((await page.locator('#farewell-intent-note').innerText()).includes('庆祝'));
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await page.locator('#farewell-intent').boundingBox();assert(box.height>=44);if(width===390)await shot('journey-intent-mobile');}
  await page.locator('#regret-details summary').click();await page.locator('#project-regret').fill('字'.repeat(121));await page.locator('#start').click();assert.equal(await state(),'confirm');assert((await page.locator('#confirm-error').innerText()).includes('120'));
  const regret='<b>八年的陪伴，谢谢一起做过的人</b>';await page.locator('#project-regret').fill(regret);await page.locator('#start').click();
  assert((await page.locator('#parcel-list').innerText()).includes('输入城市'));const initial=await board();
  const beforeSelect=await page.locator('#stage').evaluate(c=>c.toDataURL());await page.locator('#parcel-list button').click();assert.equal(await page.locator('#parcel-list button').getAttribute('aria-pressed'),'true');assert.notEqual(await page.locator('#stage').evaluate(c=>c.toDataURL()),beforeSelect);await page.locator('#parcel-list button').click();assert.equal(await page.locator('#stage').evaluate(c=>c.toDataURL()),beforeSelect);
  const scene=await page.locator('#stage').boundingBox(),panel=await page.locator('#game-controls').boundingBox();assert(panel.x>=scene.x+scene.width);assert(scene.width>600);await shot('journey-workspace');
  await page.locator('#open-settings').click();assert.equal(await state(),'paused');await page.keyboard.press('ArrowUp');assert.equal(await board(),initial);
  await page.locator('#settings-guides').uncheck();await page.locator('#settings-sound').uncheck();await page.keyboard.press('Escape');await waitState('playing');assert.equal(await board(),initial);assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'true');
  const noGuides=await page.locator('#stage').evaluate(c=>c.toDataURL());await page.locator('#open-settings').click();await page.locator('#settings-guides').check();await page.locator('#game-settings .primary').click();await waitState('playing');assert.notEqual(await page.locator('#stage').evaluate(c=>c.toDataURL()),noGuides);
  await page.keyboard.press('ArrowUp');const moved=await board();await page.keyboard.press('z');assert.equal(await board(),initial);await page.keyboard.press('y');assert.equal(await board(),moved);
  await page.keyboard.press('z');await page.keyboard.press('ArrowRight');assert(await page.locator('#redo').isDisabled());await page.locator('#restart-level').click();assert.equal(await board(),initial);
  await page.locator('#pause').click();await page.locator('#open-settings').click();await page.locator('#game-settings .primary').click();assert.equal(await state(),'paused');await page.locator('#resume-game').click();
  for(let i=0;i<levels.length;i++){
    const level=i===5?{...levels[i],map:levels[i].map.map(row=>row.replace('t','.'))}:levels[i];
    if(i===2){assert((await page.locator('#parcel-list').innerText()).includes('静态天气卡片'));assert.equal(await page.locator('#parcel-list button').count(),2);await shot('journey-greenhouse-lamps');}
    if(i===3)assert((await page.locator('#parcel-list').innerText()).includes('静态天气卡片'));
    if(i===5||i===6){assert((await page.locator('#parcel-list').innerText()).includes(regret));assert.equal(await page.locator('#parcel-list b').count(),0);if(i===5)await shot('journey-library-choice');}
    const route=await solve(level,newBoard(levels[i]));assert(route);let checkedLight=false;
    for(const action of route){
      const before=JSON.parse(await board());await page.keyboard.press(keys[action]);const after=JSON.parse(await board());
      if(!checkedLight&&after.lit.length>before.lit.length){checkedLight=true;await page.keyboard.press('z');assert.deepEqual(JSON.parse(await board()).lit,before.lit);await page.keyboard.press('y');assert.deepEqual(JSON.parse(await board()),after);assert((await page.locator('#goal-lamps').innerText()).includes(String(after.lit.length)));if(i===2)await shot('journey-greenhouse-lit');}
    }
    assert.equal(await state(),'cleared');if(i===2||i===4||i===6){assert(checkedLight);assert.equal(await page.locator('#goal-lamps').getAttribute('data-ready'),'true');}
    assert.equal(await page.locator('#goal-you').getAttribute('data-ready'),'true');assert.equal(await page.locator('#goal-ghost').getAttribute('data-ready'),'true');assert.equal(await page.locator('#goal-boxes').getAttribute('data-ready'),'true');
    const winning=await board();await page.locator('#undo').click();assert.equal(await state(),'playing');await page.locator('#redo').click();assert.equal(await state(),'cleared');assert.equal(await board(),winning);
    if(i===5)assert((await page.locator('#clear-memory').innerText()).includes('下一站'));
    await page.locator('#next-level').click();
    if(i===0){await page.locator('#open-settings').click();await page.keyboard.press('Escape');await waitState('memory');assert(await page.locator('#game-controls').isHidden());}
    if(i===5){assert.equal(await page.locator('#memory-title').innerText(),'值得珍藏的这一页');assert((await page.locator('#memory-text').innerText()).includes(regret));assert((await page.locator('#memory-keepsake').innerText()).includes('不必带走新的任务'));await page.locator('#bookmark-memory').click();await page.locator('#memory-back').click();await page.locator('#undo').click();await page.locator('#redo').click();await page.locator('#next-level').click();assert((await page.locator('#memory-keepsake').innerText()).includes('放进行李'));}
    if(i===6){await page.locator('#future-note summary').click();assert.equal(await page.locator('#future-context').innerText(),regret);await page.locator('#next-step').fill('字'.repeat(61));await page.locator('#memory-continue').click();assert.equal(await state(),'memory');assert((await page.locator('#next-step-error').innerText()).includes('60'));assert.equal(await page.locator('#next-step').getAttribute('aria-invalid'),'true');await page.locator('#next-step').fill('把第一张天气卡片发给朋友试用');assert.equal(await page.locator('#next-step-error').textContent(),'');assert.equal(await page.locator('#next-step').getAttribute('aria-invalid'),null);await shot('journey-future-note');}
    else assert(await page.locator('#future-note').isHidden());
    await page.locator('#memory-continue').click();
  }
  assert.equal(await state(),'waiting');
  const progress=await page.locator('.cover-route li').evaluateAll(stops=>stops.map(stop=>stop.dataset.progress)),beforeIntent=await board();
  for(const [intent,action] of [['pause','先歇一会儿'],['handover','交出去'],['undecided','今天先到这里'],['completed','画句号']]){
    await page.locator('#station-intent').selectOption(intent);assert((await page.locator('#lamp').innerText()).includes(action));assert((await page.locator('#departure-memory').innerText()).includes(regret));assert.equal(await board(),beforeIntent);assert.deepEqual(await page.locator('.cover-route li').evaluateAll(stops=>stops.map(stop=>stop.dataset.progress)),progress);
  }
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(width===390)await shot('journey-intent-station-mobile');}
  await page.locator('#lamp').click();await page.waitForFunction(()=>!document.getElementById('download').disabled);assert.equal(await page.locator('#result-title').innerText(),'圆满收尾');assert(await page.locator('#station-intent-panel').isHidden());assert((await page.locator('#ending-choice').innerText()).includes('放进行李'));await shot('journey-carry-result');
  assert.equal(await page.locator('#ending-step-text').innerText(),'把第一张天气卡片发给朋友试用');
  const completedStats=await page.locator('#journey-stats').innerText(),bookmark=await page.locator('#remembered-title').innerText();
  await page.locator('#replay-ceremony').click();assert.equal(await state(),'done');assert.equal(await page.locator('#journey-stats').innerText(),completedStats);assert.equal(await page.locator('#remembered-title').innerText(),bookmark);assert.equal(await page.locator('#ending-step-text').innerText(),'把第一张天气卡片发给朋友试用');assert.equal(await board(),beforeIntent);
  const bookEvent=page.waitForEvent('download');await page.locator('#save-book').click();const book=await bookEvent;await book.saveAs(path.join(out,'journey-carry-book.html'));const html=fs.readFileSync(path.join(out,'journey-carry-book.html'),'utf8');assert(html.includes('把这一页放进行李。可以带走收获，不必带走新的任务。'));assert(html.includes('&lt;b&gt;八年的陪伴，谢谢一起做过的人&lt;/b&gt;'));assert(html.includes('把第一张天气卡片发给朋友试用'));assert(html.includes('圆满收尾'));
  const imageEvent=page.waitForEvent('download');await page.locator('#download').click();await (await imageEvent).saveAs(path.join(out,'journey-carry-ticket.png'));
  await page.locator('#replay').click();assert(await page.locator('#redo').isDisabled());
  for(const width of [320,390,768,980,1000,1280]){await page.setViewportSize({width,height:900});await page.waitForTimeout(80);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));for(const button of await page.locator('[data-move]:visible').all()){const box=await button.boundingBox();assert(box.width>=44&&box.height>=44);}}
  await page.setViewportSize({width:390,height:844});await shot('journey-workspace-mobile');await page.locator('#open-settings').click();await shot('journey-settings-mobile');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#settings-reduced').uncheck();await page.locator('#game-settings .primary').click();assert.equal(await page.locator('#app').getAttribute('data-reduced'),'false');await page.locator('#open-settings').click();await page.locator('#settings-reduced').check();await page.locator('#game-settings .primary').click();assert.equal(await page.locator('#app').getAttribute('data-reduced'),'true');
  assert.deepEqual(errors,[]);const report={checks:['行李标签对应确认资料，点击高亮箱子，缺少片段留白','温室、工坊和站台幽灵点灯通关，撤销熄灯、重做恢复','多年收获成为书库纪念页、书签和站台行李；四种心意切换保留七站进度','终点便签可选、60字符校验、实际下载回忆册保留','七站实际操作；每关撤销终步再重做，恢复通关状态','设置暂停恢复；引导、减动、声音开关','320/390/768/980/1000/1280 无横向溢出；方向键至少 44×44'],errors};fs.writeFileSync(path.join(out,'play-settings-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){await shot('play-settings-failure');throw e;}finally{await browser.close();}
