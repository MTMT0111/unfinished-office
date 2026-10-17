import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createApp} from '../server.mjs';
import {levels,newBoard,solve} from '../src/game.ts';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/86137/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(process.env.OUTPUT_DIR||path.resolve(import.meta.dirname,'../verification'));
const commits=[
  {sha:'b'.repeat(40),commit:{message:'给天气卡片加上城市名',author:{name:'Lin'},committer:{date:'2026-02-03T10:00:00Z'}},files:[{filename:'src/card.ts',status:'modified',patch:'+title.textContent = city;'}]},
  {sha:'a'.repeat(40),commit:{message:'增加城市输入检查\n\nCo-authored-by: Lin <fixture@example.com>',author:{name:'Wen'},committer:{date:'2026-02-03T08:00:00Z'}},files:[{filename:'src/city.ts',status:'modified',patch:'+if (!city.trim()) return showHint("请输入城市");'},{filename:'.env',patch:'DO_NOT_SEND'}]},
];
let upstream=0,failDetails=false;
const app=createApp({config:{base:'https://api.deepseek.com',model:'fixture-only',key:''},ghRun:async args=>{
  if(args[0]==='auth')return 'logged in';
  if(args.includes('per_page=40'))return JSON.stringify(commits.map(({files,...commit})=>commit));
  const match=commits.find(commit=>args[1]?.endsWith('/commits/'+commit.sha));
  if(match){if(failDetails)throw new Error('fixture: GitHub unavailable');return JSON.stringify(match);}
  if(args[1]?.endsWith('/readme'))return JSON.stringify({encoding:'base64',content:Buffer.from('# 天气日记\n用途：输入城市查看天气。\n已完成：静态天气卡片。').toString('base64')});
  return JSON.stringify({name:'天气日记',description:'城市天气工具',private:false,language:'TypeScript'});
},fetchImpl:async(_,request)=>{
  upstream++;const project=JSON.parse(JSON.parse(request.body).messages[1].content);
  assert.equal(project.milestones.length,2);assert.equal(project.milestones[0].sha,commits[1].sha);assert(!JSON.stringify(project).includes('DO_NOT_SEND'));assert(!JSON.stringify(project).includes('fixture@example.com'));
  const content={facts:{purpose:{value:'输入城市查看天气',path:'README.md',quote:'输入城市查看天气。'},completed:{value:'README 自述已有静态天气卡片',path:'README.md',quote:'已完成：静态天气卡片。'}},diary:project.milestones.map((commit,i)=>({sha:commit.sha,entries:[{text:i===0?'这次，我的城市输入框增加了空值检查。没有填写城市时，会先提示输入，再等下一次查询。':'这次，我的天气卡片有了城市名，标题使用了 city 的内容。',path:commit.changes[0].path,quote:commit.changes[0].patch}]}))};
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]}));
}});
app.listen(0,'127.0.0.1');await once(app,'listening');const base=`http://127.0.0.1:${app.address().port}`;
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:980},reducedMotion:'reduce',acceptDownloads:true}),errors=[];page.on('pageerror',error=>errors.push(error.message));
async function load(target){
  await target.goto(base);if(await target.locator('#skip-opening').isVisible())await target.locator('#skip-opening').click();
  await target.locator('#source-github').click();await target.locator('#github-query').fill('owner/weather');await target.locator('#find-repository').click();
  await target.waitForFunction(()=>document.getElementById('materials').getAttribute('aria-busy')==='false'&&!document.getElementById('materials').hidden);
}
try{
  await load(page);assert.equal(await page.locator('#milestone-list input:checked').count(),2);
  await page.locator('#milestone-summary').click();assert((await page.locator('#materials-note').innerText()).includes('发送给 API'));
  assert.equal(await page.locator('#milestone-preview a').first().getAttribute('href'),'https://github.com/owner/weather/commit/'+commits[1].sha);
  await page.locator('#api-settings summary').click();await page.locator('#api-key').fill('fixture-key');await page.locator('#analyze-project').click();await page.locator('#confirm-panel').waitFor();
  assert.equal(upstream,1);assert((await page.locator('#confirm-keywords').innerText()).includes('空值检查'));
  const second=page.locator('.dossier-entry').nth(1);await second.locator('summary').first().click();await second.getByRole('button',{name:'解读不准确，只保留原始记录'}).click();
  await page.locator('#confirm-panel').screenshot({path:path.join(out,'diary-fixture-dossier.png')});
  await page.locator('#start').click();
  assert.equal(await page.locator('#chapter-number').innerText(),'2026-02-03 · 日记页 01');
  for(let i=0;i<levels.length;i++){
    if(i===0)assert((await page.locator('#chapter-title').innerText()).includes('增加城市输入检查'));
    const route=await solve(levels[i],newBoard(levels[i]));
    for(const action of route)await page.keyboard.press({up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',switch:'x'}[action]);
    await page.waitForFunction(()=>document.getElementById('app').dataset.state==='cleared');await page.locator('#next-level').click();
    const text=await page.locator('#memory-text').innerText();
    if(i===0){
      assert(text.includes('2026 年 2 月 3 日'));assert(text.includes('Wen'));assert(text.includes('空值检查'));
      await page.locator('#memory-evidence summary').click();assert((await page.locator('#memory-evidence').innerText()).includes('+if (!city.trim())'));
      await page.locator('#memory-evidence summary').click();
      await page.locator('#stage-wrap').screenshot({path:path.join(out,'diary-fixture-scene.png')});
      await page.locator('#memory-panel').screenshot({path:path.join(out,'diary-fixture-desktop.png')});
      for(const width of [320,390,768]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
      await page.setViewportSize({width:390,height:900});await page.locator('#memory-panel').screenshot({path:path.join(out,'diary-fixture-mobile.png')});
      await page.setViewportSize({width:1280,height:980});await page.locator('#memory-write summary').click();await page.locator('#memory-note').fill('那天修好了输入提示。<b>只作为文字</b>');await page.locator('#bookmark-memory').click();assert.equal(await page.locator('#bookmark-memory').getAttribute('aria-pressed'),'true');
    }
    if(i===1){assert(text.includes('给天气卡片加上城市名'));assert(text.includes('src/card.ts'));assert(!text.includes('标题使用了 city'));}
    if(i===6)assert(text.includes('再见'));
    await page.locator('#memory-continue').click();
    if(i===0)assert.equal(await page.locator('#chapter-number').innerText(),'2026-02-03 · 日记页 02');
  }
  assert((await page.locator('#departure-memory').innerText()).includes('增加城市输入检查'));
  await page.locator('#open-settings').click();await page.locator('#settings-reduced').check();await page.getByRole('button',{name:'收好设置'}).click();
  const station=page.locator('#stage'),still=await station.screenshot();await page.locator('#bag-items button').first().click();
  assert.equal(await page.locator('#station-story').isVisible(),true);assert((await page.locator('#station-story-topic').innerText()).includes('增加城市输入检查'));
  const keepsakeWave=await station.screenshot();assert.notDeepEqual(keepsakeWave,still);await station.screenshot({path:path.join(out,'farewell-keepsake-ripple.png')});
  await station.evaluate(canvas=>{const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+r.width*.2,clientY:r.top+r.height*.8}));});
  const waterWave=await station.screenshot();assert.notDeepEqual(waterWave,keepsakeWave);await station.screenshot({path:path.join(out,'farewell-water-ripple.png')});
  await page.locator('#departure-panel').screenshot({path:path.join(out,'bookmark-farewell-waiting.png')});
  await page.locator('#lamp').click();await page.waitForTimeout(400);await page.locator('#stage-wrap').screenshot({path:path.join(out,'bookmark-handover.png')});
  await page.waitForFunction(()=>document.getElementById('app').dataset.state==='done');await page.waitForFunction(()=>!document.getElementById('download').disabled);
  const finalBefore=await station.screenshot();await station.evaluate(canvas=>{const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+r.width*.7,clientY:r.top+r.height*.75}));});
  const finalRipple=await station.screenshot();assert.notDeepEqual(finalRipple,finalBefore);await station.screenshot({path:path.join(out,'farewell-after-departure-ripple.png')});
  assert.equal(await page.locator('#remembered-title').innerText(),'增加城市输入检查');assert((await page.locator('#remembered-source').innerText()).includes('2026-02-03'));
  await page.locator('#memorial-preview').screenshot({path:path.join(out,'bookmark-ticket.png')});
  const oldPreview=await page.locator('#memorial-preview').getAttribute('src');await page.locator('#reopen-bookmark').click();await page.locator('#bookmark-memory').click();await page.locator('#memory-continue').click();
  await page.waitForFunction(previous=>!document.getElementById('download').disabled&&document.getElementById('memorial-preview').getAttribute('src')!==previous,oldPreview);assert(await page.locator('#remembered-page').isHidden());
  await page.locator('#album-section summary').click();await page.locator('#memory-album button').first().click();await page.locator('#bookmark-memory').click();await page.locator('#memory-continue').click();await page.waitForFunction(()=>!document.getElementById('download').disabled);
  for(const width of [320,390,768]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.setViewportSize({width:390,height:900});await page.locator('#remembered-page').screenshot({path:path.join(out,'bookmark-result-mobile.png')});
  const download=page.waitForEvent('download');await page.locator('#save-book').click();const bookPath=path.join(out,'diary-fixture-book.html');await (await download).saveAs(bookPath);
  const book=await browser.newPage({viewport:{width:390,height:900}});await book.context().setOffline(true);await book.goto(pathToFileURL(bookPath).href);assert((await book.locator('main').innerText()).includes('只作为文字'));assert.equal(await book.locator('b').count(),0);
  await book.locator('details.memory').first().locator('details summary').click();assert((await book.locator('pre').first().innerText()).includes('+if (!city.trim())'));assert((await book.locator('.bookmark').innerText()).includes('增加城市输入检查'));assert(await book.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await book.close();
  failDetails=true;const fallback=await browser.newPage({reducedMotion:'reduce'});await load(fallback);assert((await fallback.locator('#import-error').innerText()).includes('部分改动详情'));
  await fallback.locator('#local-review').click();await fallback.locator('#confirm-panel').waitFor();assert((await fallback.locator('#confirm-keywords').innerText()).includes('只读到了提交说明'));await fallback.close();
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'diary-browser-results.json'),JSON.stringify({fixture:true,checks:['GitHub routes → bounded diffs → API → validated diary → seven stages → goodbye → offline book','same-day ordering, actual author/coauthor, selected sources sent','discard AI interpretation retains raw evidence','320/390/768 layout; readable patches; literal personal notes','bookmark → farewell handover → PNG → offline book; removing/reselecting from result regenerates preview','detail failures preserve original records and allow local review'],errors},null,2));
  console.log('Diary browser checks passed: project evidence, seven-stage prototype, station stories and ripples, farewell, mobile, offline export.');
}catch(error){await page.screenshot({path:path.join(out,'diary-browser-failure.png'),fullPage:true});throw error;}
finally{await browser.close();app.closeAllConnections();app.close();}
