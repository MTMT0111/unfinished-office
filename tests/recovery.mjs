import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/86137/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(import.meta.dirname,'../verification');
fs.mkdirSync(path.join(out,'browser-temp'),{recursive:true});process.env.TEMP=path.join(out,'browser-temp');process.env.TMP=process.env.TEMP;
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce',acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
  window.AudioContext=class{constructor(){throw new Error('模拟设备拒绝声音');}};
  const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);window.__pendingFrames=new Set();
  window.requestAnimationFrame=callback=>{const id=request(now=>{window.__pendingFrames.delete(id);callback(now);});window.__pendingFrames.add(id);return id;};
  window.cancelAnimationFrame=id=>{window.__pendingFrames.delete(id);cancel(id);};
});
const state=()=>page.locator('#app').getAttribute('data-state');
const ready=()=>page.waitForFunction(()=>!document.getElementById('download').disabled&&!document.getElementById('memorial-preview').hidden);
try{
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4188/');
  await page.screenshot({path:path.join(out,'01-home-desktop.png'),fullPage:true});
  const sample=await page.locator('#sample-weather').boundingBox();assert(sample.y+sample.height<768,'首屏必须可以开始体验');
  await page.locator('#sample-weather').click();assert.equal(await page.locator('#reduced').isChecked(),true);await page.locator('#reduced').uncheck();
  await page.evaluate(()=>{const form=document.getElementById('confirm-form');form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  await page.waitForTimeout(200);assert.equal(await state(),'playing');
  assert.equal(await page.evaluate(()=>window.__pendingFrames.size),1);assert((await page.locator('#sound-note').innerText()).includes('照常进行'));
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await state(),'paused');assert.equal(await page.evaluate(()=>window.__pendingFrames.size),0);
  const frozen=await page.locator('#stage').evaluate(c=>c.toDataURL());await page.waitForTimeout(150);assert.equal(await page.locator('#stage').evaluate(c=>c.toDataURL()),frozen);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await state(),'paused');await page.locator('#pause').click();assert.equal(await state(),'playing');
  await page.locator('#skip').click();assert.equal(await state(),'waiting');assert.equal(await page.evaluate(()=>window.__pendingFrames.size),1);
  const waitingFrame=await page.locator('#stage').evaluate(c=>c.toDataURL());await page.waitForTimeout(350);assert.notEqual(await page.locator('#stage').evaluate(c=>c.toDataURL()),waitingFrame);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.evaluate(()=>window.__pendingFrames.size),0);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.evaluate(()=>window.__pendingFrames.size),1);
  await page.locator('#open-settings').click();assert.equal(await page.evaluate(()=>window.__pendingFrames.size),0);await page.locator('#settings-reduced').check();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__pendingFrames.size),0);
  const still=await page.locator('#stage').evaluate(c=>c.toDataURL());await page.waitForTimeout(200);assert.equal(await page.locator('#stage').evaluate(c=>c.toDataURL()),still);
  await page.locator('#open-settings').click();await page.locator('#settings-reduced').uncheck();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__pendingFrames.size),1);
  await page.locator('#lamp').click();assert.equal(await page.evaluate(()=>window.__pendingFrames.size),1);await ready();assert.equal(await page.evaluate(()=>window.__pendingFrames.size),0);
  await page.locator('#replay').click();
  await page.locator('#change-during').click();await page.locator('#leave-show').click();assert.equal(await page.evaluate(()=>window.__pendingFrames.size),0);

  await page.evaluate(()=>{const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=async function(){if(this.name==='slow.md')await new Promise(r=>setTimeout(r,600));return original.call(this);};});
  await page.locator('#source-manual').click();await page.locator('#description').fill('原来的内容');
  await page.locator('#project-file').setInputFiles({name:'slow.md',mimeType:'text/markdown',buffer:Buffer.from('# 旧资料')});
  await page.locator('#cancel-read').click();
  await page.locator('#project-file').setInputFiles({name:'new.md',mimeType:'text/markdown',buffer:Buffer.from('# 新资料\n用途：记录想法。')});
  await page.waitForTimeout(800);assert.equal(await state(),'input');assert((await page.locator('#description').inputValue()).includes('新资料'));

  await page.locator('#sample-weather').click();await page.locator('#reduced').check();await page.locator('#start').click();
  await page.locator('#skip').click();
  await page.evaluate(()=>{const original=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb,...args){HTMLCanvasElement.prototype.toBlob=original;setTimeout(()=>original.call(this,cb,...args),600);};});
  await page.locator('#lamp').click();await page.locator('#new-project').click();
  await page.locator('#sample-novel').click();await page.locator('#edit-facts summary').click();await page.locator('#edit-name').fill('新的小说');await page.locator('#start').click();await page.locator('#skip').click();await page.locator('#lamp').click();await ready();await page.waitForTimeout(800);
  assert((await page.locator('#memorial-preview').getAttribute('alt')).startsWith('新的小说'));assert.equal(await state(),'done');

  await page.locator('#new-project').click();await page.locator('#sample-weather').click();
  await page.locator('#edit-name').fill('长名字'.repeat(13)+'终');await page.locator('#edit-completed').fill('已经留下了一段明确写出的文字。'.repeat(15).slice(0,240));
  await page.evaluate(()=>{const original=CanvasRenderingContext2D.prototype.fillText;window.__ticketText=[];CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.__ticketText.push(text);return original.call(this,text,...args);};});
  await page.locator('#start').click();await page.locator('#skip').click();await page.locator('#lamp').click();await ready();
  assert(await page.locator('#memorial-preview').evaluate(img=>img.naturalHeight<1100));
  const text=await page.evaluate(()=>window.__ticketText.join(''));assert(text.includes('长名字'.repeat(13)+'终'));assert(!text.includes('已经留下了一段明确写出的文字'));
  const downloaded=page.waitForEvent('download');await page.locator('#download').click();await (await downloaded).saveAs(path.join(out,'long-text-export.png'));
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});await page.waitForTimeout(80);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.locator('#new-project').click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(80);await page.screenshot({path:path.join(out,'mobile-390-home.png'),fullPage:true});
  await page.locator('#sample-weather').click();await page.screenshot({path:path.join(out,'mobile-390-confirm.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  const report={target:'production build',browser:await browser.version(),checks:['1366×768 首屏可开始样例；减动系统偏好默认启用','连发两次开始只创建一个 RAF；离开时清理','声音设备拒绝时演出仍推进','模拟 visibilitychange 隐藏事件后暂停，恢复可见仍等待用户继续','取消慢文件后读取新文件，旧读取结果不覆盖','旧 PNG 异步回调不覆盖新项目','纪念票保留完整长名称，移除项目长段文字，画面尺寸紧凑','320/390/768/1440px 布局复查无横向溢出'],errors};
  fs.writeFileSync(path.join(out,'recovery-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){await page.screenshot({path:path.join(out,'recovery-failure.png'),fullPage:true});throw e;}
finally{await browser.close();}
