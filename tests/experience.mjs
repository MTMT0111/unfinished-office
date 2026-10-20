import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/86137/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(import.meta.dirname,'../verification');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const state=()=>page.locator('#app').getAttribute('data-state'),board=()=>page.locator('#app').getAttribute('data-board');
const shot=name=>page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
try{
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4188/');await page.locator('#sample-weather').click();
  assert(await page.locator('#preflight-project').isVisible());assert(await page.locator('#preflight-heart').isHidden());assert((await page.locator('#project-media pre').innerText()).includes('# 天气 App'));
  const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=360;const x=c.getContext('2d');x.fillStyle='#18394e';x.fillRect(0,0,640,360);x.fillStyle='#eed4a0';x.font='28px sans-serif';x.fillText('WEATHER / PROJECT SNAPSHOT',40,70);x.font='70px sans-serif';x.fillText('BEIJING',40,175);x.font='22px sans-serif';x.fillStyle='#add9d3';x.fillText('A memory from our project · test fixture',40,270);return c.toDataURL('image/png').split(',')[1];});
  await page.locator('#project-photos').setInputFiles({name:'天气卡片-测试截图.png',mimeType:'image/png',buffer:Buffer.from(fixture,'base64')});
  await page.waitForFunction(()=>document.querySelectorAll('#project-media img').length===1);await shot('experience-project-originals');
  await page.locator('#project-photos').setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('invalid')});
  await page.waitForFunction(()=>!document.getElementById('project-photos').disabled);assert.equal(await page.locator('#project-media img').count(),1);assert((await page.locator('#photo-status').innerText()).length>0);
  await page.locator('[data-preflight=heart]').click();await page.locator('#farewell-intent').selectOption('completed');
  await page.locator('[data-preflight=scene]').click();await page.locator('#departure-city').fill('北京');await page.locator('#departure-season').selectOption('snow');await page.locator('#preview-city').click();assert((await page.locator('#destination-caption').innerText()).includes('北京'));await shot('experience-destination');
  await page.locator('#start').click();assert.equal(await state(),'playing');const initial=await board();
  const beijing=await page.locator('#stage').evaluate(c=>c.toDataURL());await page.locator('#parcel-list button').first().click();assert(await page.locator('#city-input').isVisible());await page.locator('#parcel-list button').first().click();await shot('experience-beijing');
  await page.locator('[data-city="纽约"]').click();const christmas=await page.locator('#stage').evaluate(c=>c.toDataURL());assert.notEqual(christmas,beijing);assert.equal(await board(),initial);
  await page.locator('#city-season').selectOption('halloween');const halloween=await page.locator('#stage').evaluate(c=>c.toDataURL());assert.notEqual(halloween,christmas);await shot('experience-newyork-halloween');
  await page.locator('#city-input').fill('天津');await page.locator('#city-form button[type=submit]').click();assert((await page.locator('#city-status').innerText()).includes('通用夜景'));
  await page.locator('[data-city="北京"]').click();await page.locator('#city-secret').click();assert(await page.locator('#city-secret').isHidden());assert.equal(await page.locator('#companion-light').getAttribute('aria-pressed'),'true');assert.equal(await board(),initial);
  const withLight=await page.locator('#stage').evaluate(c=>c.toDataURL());await page.locator('#companion-light').click();assert.notEqual(await page.locator('#stage').evaluate(c=>c.toDataURL()),withLight);await page.locator('#companion-light').click();await shot('experience-companion-light');
  for(const width of [320,390,980,1280]){
    await page.setViewportSize({width,height:900});await page.waitForTimeout(150);
    const positions=await page.evaluate(async()=>{const frames=[];for(let i=0;i<45;i++){await new Promise(requestAnimationFrame);const r=document.getElementById('stage').getBoundingClientRect();frames.push([r.x,r.y,r.width,r.height,scrollY]);}return [...new Set(frames.map(JSON.stringify))];});
    assert.equal(positions.length,1,`画布应保持稳定：${width}px ${positions}`);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(width===390)await shot('experience-game-mobile');
  }
  await page.locator('#skip').click();await shot('experience-station');
  await page.locator('#open-settings').click();await page.locator('#settings-reduced').uncheck();await page.locator('#game-settings .primary').click();
  await page.locator('#lamp').click();await page.waitForTimeout(1900);assert.equal(await state(),'fading');await shot('experience-farewell-close');
  await page.waitForTimeout(5200);assert.equal(await state(),'fading');await shot('experience-farewell-wide');
  await page.waitForFunction(()=>document.getElementById('app').dataset.state==='done'&&!document.getElementById('download').disabled);
  assert(await page.locator('.theatre').isHidden());await shot('experience-ticket');
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.locator('[data-result-page=project]').click();assert(await page.locator('#result-ticket').isHidden());assert.equal(await page.locator('#result-media img').count(),1);assert((await page.locator('#result-media pre').innerText()).includes('# 天气 App'));
  await page.locator('[data-result-page=memories]').click();assert(await page.locator('#album-empty').isVisible());
  const event=page.waitForEvent('download');await page.locator('#save-book').click();const download=await event;await download.saveAs(path.join(out,'experience-book.html'));
  const html=fs.readFileSync(path.join(out,'experience-book.html'),'utf8');assert(html.includes('天气卡片-测试截图.png'));assert(html.includes('北京 · 瑞雪'));assert(html.includes('城市灯语已点亮'));assert(html.includes('# 天气 App'));
  await page.locator('[data-result-page=ticket]').click();const pngEvent=page.waitForEvent('download');await page.locator('#download').click();await(await pngEvent).saveAs(path.join(out,'experience-ticket.png'));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:['README 原文和截图可浏览，坏图片不丢已有图片','分步骤确认与三个纪念页面','北京、纽约圣诞/万圣节、未知城市降级；换城保持棋盘','城市彩蛋解锁同行灯，灯光切换不移动人物','320/390/980/1280 px 连续帧画布与滚动位置稳定','9 秒近景、拉远、烟花完整告别；减动仍可游玩','图片、原文、城市、彩蛋随回忆册与纪念票导出'],errors},null,2));
}catch(error){await shot('experience-failure');throw error;}finally{await browser.close();}
