import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {levels,solve,move,won} from '../src/game.ts';
import {confirmIdentity,example} from '../src/input.ts';
import {keepsakeTopic} from '../src/memory.ts';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/86137/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(import.meta.dirname,'../verification');fs.mkdirSync(path.join(out,'browser-temp'),{recursive:true});process.env.TEMP=path.join(out,'browser-temp');process.env.TMP=process.env.TEMP;
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:960},acceptDownloads:true});
const weather=example('weather'),confirmedWeather=confirmIdentity(weather,Object.fromEntries(Object.entries(weather.facts).map(([key,value])=>[key,value.value])),weather.prop,weather.palette,weather.accessory);
const errors=[],external=[],checks=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:4188'))external.push(r.url());});
await page.addInitScript(()=>{
  const Native=window.AudioContext;window.__audio={contexts:0,live:new Set()};
  window.AudioContext=class extends Native{constructor(...args){super(...args);window.__audio.contexts++;}createOscillator(){const n=super.createOscillator(),start=n.start.bind(n);n.start=(...args)=>{window.__audio.live.add(n);start(...args);};n.addEventListener('ended',()=>window.__audio.live.delete(n));return n;}};
});
const state=()=>page.locator('#app').getAttribute('data-state');
const board=async()=>JSON.parse(await page.locator('#app').getAttribute('data-board'));
const waitState=value=>page.waitForFunction(s=>document.getElementById('app').dataset.state===s,value);
const ready=()=>page.waitForFunction(()=>!document.getElementById('download').disabled&&!document.getElementById('memorial-preview').hidden);
const shot=name=>page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
const keys={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',switch:'x'};
async function act(action){await page.keyboard.press(keys[action]);await page.waitForTimeout(190);}
async function route(actions){for(const action of actions)await act(action);}
async function download(name){const event=page.waitForEvent('download');await page.locator('#download').click();const file=await event;await file.saveAs(path.join(out,name+'.png'));return file;}
try{
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4188/');assert.equal(await state(),'opening');assert.equal(await page.locator('.cover-route li').first().getAttribute('data-progress'),'current');assert.equal(await page.evaluate(()=>window.__audio.contexts),0);await page.waitForTimeout(650);await shot('journey-opening');await page.locator('#skip-opening').click();assert.equal(await state(),'input');await shot('journey-home');
  await page.locator('#sample-weather').click();assert.equal(await state(),'confirm');assert.equal(await page.locator('#edit-facts').evaluate(e=>e.open),false);assert((await page.locator('#confirm-keywords').innerText()).includes('静态天气卡片'));await shot('journey-dossier');
  await page.locator('#start').click();assert.equal(await state(),'opening');await page.waitForFunction(()=>document.getElementById('opening-line').textContent?.includes('没有 Git 提交记录'));await page.locator('#skip-opening').click();assert.equal(await state(),'playing');assert.equal(await page.locator('.cover-route li').first().getAttribute('data-progress'),'current');await shot('journey-forest');
  await act('up');const moved=await board();assert.equal(moved.you.y,2);await page.keyboard.press('z');assert.equal((await board()).you.y,3);
  await page.locator('#pause').click();const frozen=await page.locator('#stage').evaluate(c=>c.toDataURL());await page.waitForTimeout(260);assert.equal(await page.locator('#stage').evaluate(c=>c.toDataURL()),frozen);assert.equal(await page.evaluate(()=>window.__audio.live.size),0);await page.locator('#resume-game').click();
  const detours=[['up','up','right','right','right','right'],['switch','right','right','up','up','up'],['up','right','right','up'],['up','right','right'],['down','right','right','up','up'],['up','up','right','right'],['up','up','right','right']];
  for(let i=0;i<levels.length;i++){
    assert.equal(await page.locator('#app').getAttribute('data-level'),String(i));
    if(i===1){await page.locator('#hint').click();await page.locator('#game-status').filter({hasText:'下一步'}).waitFor();await shot('journey-river');}
    if(i>=2)await shot('journey-'+levels[i].theme);
    for(const action of detours[i]){
      const found=(await board()).found;await act(action);const current=await board();
      if(current.found&&!found){
        const message=await page.locator('#clear-panel').isVisible()?page.locator('#clear-memory'):page.locator('#game-status');
        assert((await message.innerText()).includes(keepsakeTopic(confirmedWeather,i).text),'拾取回应必须引用本关物件的项目线索');
        if(i===0)await page.screenshot({path:path.join(out,'journey-item-response.png')});
      }
    }
    assert((await board()).found,'旅途物件可实际到达');
    const start=await board(),solution=await solve(levels[i],start);assert(solution);let expected=start;
    for(const action of solution){
      expected=action==='switch'?{...expected,active:expected.active==='you'?'ghost':'you'}:move(levels[i],expected,action);
      await act(action);assert.deepEqual(await board(),expected,`关卡 ${i} 动作 ${action}`);
    }
    assert(won(levels[i],await board()));await waitState('cleared');await page.waitForTimeout(750);await shot('journey-clear-'+i);await page.locator('#next-level').click();await waitState('memory');await page.waitForTimeout(1300);
    assert(await page.locator('#memory-title').innerText());assert.equal(await page.locator('.cover-route li').nth(i).getAttribute('data-progress'),'complete');
    if(i===0){
      assert((await page.locator('#memory-text').innerText()).includes('输入城市'));
      await page.locator('#memory-write summary').click();await page.locator('#memory-note').fill('记得那晚，第一张天气卡片终于显示出来。');await page.locator('#save-memory').click();
      assert((await page.locator('#memory-source').innerText()).includes('你写下'));await shot('journey-personal-memory');
      await page.locator('#pause').click();const still=await page.locator('#stage').evaluate(c=>c.toDataURL());await page.waitForTimeout(200);assert.equal(await page.locator('#stage').evaluate(c=>c.toDataURL()),still);await page.locator('#resume-game').click();
    }
    if(i===1)assert((await page.locator('#memory-text').innerText()).includes('静态天气卡片'));
    if(i===2)assert.equal(await page.locator('#memory-source').innerText(),'留给你来写');
    await shot('journey-memory-'+i);await page.locator('#memory-continue').click();await page.waitForTimeout(400);
  }
  await waitState('waiting');assert.deepEqual(await page.locator('.cover-route li').evaluateAll(stops=>stops.map(stop=>stop.dataset.progress)),Array(7).fill('complete'));const desktopBag=await page.locator('#bag-items button').evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect().y));assert.equal(desktopBag.length,7);assert(desktopBag.every(y=>y===desktopBag[0]),'七件行李应在同一行');await shot('journey-farewell');const stageBounds=await page.locator('#stage').boundingBox();await page.mouse.click(stageBounds.x+stageBounds.width*256/384,stageBounds.y+stageBounds.height*149/240);assert(await page.locator('#station-story').isVisible());assert((await page.locator('#station-story-topic').innerText()).includes(keepsakeTopic(confirmedWeather,0).text));await page.locator('#station-open-diary').click();await waitState('memory');assert((await page.locator('#memory-text').innerText()).includes('记得那晚'));await page.locator('#memory-continue').click();await waitState('waiting');await page.locator('#lamp').click();await page.waitForTimeout(800);assert.equal(await state(),'fading');assert((await page.locator('#departure-voice').innerText()).includes('7 件旅途物件'));await shot('journey-keepsake-recall');await page.waitForTimeout(1100);assert((await page.locator('#departure-voice').innerText()).includes(confirmedWeather.facts.name.value));await shot('journey-project-signoff');await waitState('done');await ready();
  assert((await page.locator('#journey-stats').innerText()).includes('7 / 7 站 · 7 件旅途物件'));await shot('journey-result');
  const file=await download('journey-ticket');assert(file.suggestedFilename().includes('天气 App'));const png=fs.readFileSync(path.join(out,'journey-ticket.png'));assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),1152);
  checks.push('键盘实际走完七站、双箱与机关、收齐七件物件、逐关回忆、关灯与真实 PNG 下载');
  await page.locator('#album-section summary').click();assert.equal(await page.locator('#memory-album button').count(),7);await page.locator('#memory-album button').first().click();await waitState('memory');assert((await page.locator('#memory-text').innerText()).includes('记得那晚'));
  await page.locator('#memory-continue').click();await waitState('done');await ready();
  checks.push('回忆使用确认事实；未知内容不编造；个人留言存入回忆册，结尾可重看');
  await page.locator('#mute').click();await page.locator('#replay').click();assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'true');assert.equal((await board()).steps,0);await page.locator('#skip-opening').click();await page.locator('#skip').click();await waitState('waiting');await page.locator('#lamp-hotspot').click();await ready();assert((await page.locator('#journey-stats').innerText()).includes('0 / 7 站 · 0 件旅途物件 · 提前到站'));assert.equal(await page.evaluate(()=>window.__audio.contexts),1);
  checks.push('暂停冻结画面和声音；重玩清空进度、保留静音；提前到站不冒充通关');
  await page.locator('#new-project').click();await page.locator('#sample-novel').click();await page.locator('#reduced').check();await page.locator('#start').click();assert.equal(await state(),'playing');
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.setViewportSize({width:390,height:844});await page.locator('[data-move=up]:visible').click();assert.equal((await board()).you.y,2);await page.locator('#switch-character').click();assert.equal((await board()).active,'ghost');await shot('journey-mobile');
  await page.locator('#skip').click();assert.equal(await page.locator('.cover-route li').last().getAttribute('data-progress'),'current');const mobileBag=await page.locator('#bag-items button').evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect().y));assert.equal(mobileBag.length,7);assert(mobileBag.every(y=>y===mobileBag[0]),'手机上七件行李应在同一行');await page.locator('#lamp').click();await ready();await download('journey-novel-ticket');
  checks.push('减少动态仍可完整游玩；手机方向按钮、换人可用；320/390/768/1440 无横向溢出');
  await page.locator('#new-project').click();await page.locator('#source-manual').click();await page.locator('#project-name').fill('<img src=x onerror=alert(1)>');await page.locator('#name-only').check();await page.locator('#arrange').click();await page.locator('#start').click();await page.locator('#skip').click();
  await page.evaluate(()=>{window.__originalBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb){cb(null);};});await page.locator('#lamp').click();await page.locator('#retry-export').waitFor();assert(await page.locator('#download').isDisabled());await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=window.__originalBlob;});await page.locator('#retry-export').click();await ready();assert((await page.locator('#result-name').innerText()).includes('<img'));assert.equal(await page.locator('#result-name img').count(),0);
  checks.push('外来文字不执行；导出失败可重试');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const report={browser:await browser.version(),checks,errors,external};fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){await shot('journey-failure');throw error;}finally{await browser.close();}
