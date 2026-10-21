import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/86137/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(import.meta.dirname,'../verification');fs.mkdirSync(out,{recursive:true});
const vite=await createServer({server:{host:'127.0.0.1',port:0,watch:{ignored:['**/verification/**']}}});await vite.listen();
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:960},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4188/');await page.locator('#sample-weather').click();await page.locator('#start').click();
  assert.equal(await page.locator('#settings-guides').isChecked(),false);assert(await page.locator('#objective-help').isHidden());assert((await page.locator('#memory-indicator').innerText()).includes('尚未辨认'));
  const initial=await page.locator('#app').getAttribute('data-board');await page.locator('.arrival-help summary').click();assert((await page.locator('#objective-help').innerText()).includes('金色方框'));assert.equal(await page.locator('#app').getAttribute('data-board'),initial);
  await page.locator('.arrival-help summary').click();await page.locator('#hint').click();await page.locator('#game-status').filter({hasText:'下一步'}).waitFor();assert.equal(await page.locator('#app').getAttribute('data-board'),initial);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:960});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.screenshot({path:path.join(out,'atmosphere-game.png'),fullPage:true});
  await page.locator('#open-settings').click();await page.locator('#settings-reduced').uncheck();await page.locator('#game-settings .primary').click();
  const positions=await page.locator('#stage').evaluate(async canvas=>{const frames=[];for(let i=0;i<35;i++){await new Promise(requestAnimationFrame);const r=canvas.getBoundingClientRect();frames.push([r.x,r.y,r.width,r.height,scrollY]);}return [...new Set(frames.map(JSON.stringify))];});assert.equal(positions.length,1);
  const gallery=await browser.newPage({viewport:{width:1224,height:1020},reducedMotion:'reduce'});await gallery.goto(`http://127.0.0.1:${vite.httpServer.address().port}/`);
  const checks=await gallery.evaluate(async()=>{
    const {drawScene,OX,OY,CELL}=await import('/src/scene.ts'),{levels,newBoard}=await import('/src/game.ts'),{example}=await import('/src/input.ts');
    document.body.replaceChildren();document.body.style.cssText='margin:0;padding:18px;background:#101c2b;color:#d6e0da;display:grid;grid-template-columns:repeat(3,384px);gap:18px;';
    const result=[];
    for(let i=0;i<levels.length;i++){
      const section=document.createElement('section'),label=document.createElement('p'),canvas=document.createElement('canvas');canvas.width=384;canvas.height=240;canvas.style.cssText='width:384px;height:240px;image-rendering:pixelated;border:1px solid #40545d';label.textContent=levels[i].title;label.style.cssText='margin:4px 0 8px;font:14px sans-serif';section.append(label,canvas);document.body.append(section);
      const c=canvas.getContext('2d'),calls=[],fill=c.fillRect.bind(c);c.fillRect=(x,y,w,h)=>{calls.push([x,y,w,h,c.fillStyle]);fill(x,y,w,h);};
      drawScene(c,example('weather'),newBoard(levels[i]),i,3,undefined,{reduced:true});const first=canvas.toDataURL();
      drawScene(c,example('weather'),newBoard(levels[i]),i,99,undefined,{reduced:true});
      result.push({stable:first===canvas.toDataURL(),rowSix:i!==4||calls.some(([x,y,w,h,color])=>x===OX+7*CELL+5&&y===OY+6*CELL+6&&w===4&&h===7&&color==='#8ec9b5')});
    }
    return result;
  });await gallery.screenshot({path:path.join(out,'atmosphere-seven-maps.png'),fullPage:true});assert(checks.every(x=>x.stable&&x.rowSix),JSON.stringify(checks));
  assert.deepEqual(errors,[]);console.log('Atmosphere: seven maps, workshop row-six exit, reduced-motion stability, optional help, unchanged puzzle state, responsive layout and fixed canvas position passed.');
}finally{await browser.close();await vite.close();}
