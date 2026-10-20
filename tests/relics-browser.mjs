import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {createApp} from '../server.mjs';
import {levels,newBoard,solve} from '../src/game.ts';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/86137/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(import.meta.dirname,'../verification');fs.mkdirSync(out,{recursive:true});
const commits=[['a','2025-05-01','保留城市输入'],['b','2014-06-01','第一张天气卡片'],['c','2018-03-02','让城市名出现在卡片上']].map(([letter,date,title])=>({sha:letter.repeat(40),commit:{message:title,author:{name:'项目伙伴'},committer:{date:date+'T08:00:00Z'}},files:[{filename:'src/'+letter+'.ts',status:'modified',patch:'@@ -1,2 +1,2 @@\n const city = "北京";\n-renderOld(city);\n+renderNew(city);'},{filename:'README.md',status:'modified',patch:'@@ -1 +1 @@\n-旧说明\n+<script>项目原文不会执行</script>'}]}));
const calls=[];let failHistory=false;
const app=createApp({config:{base:'https://api.deepseek.com',model:'fixture',key:''},ghRun:async args=>{
  calls.push(args);if(args[0]==='auth')return 'logged in';
  if(args.includes('per_page=40')){if(failHistory)throw Error('fixture: offline');return JSON.stringify(args.includes('until=2010-01-01T23:59:59Z')?[]:args.some(arg=>arg.startsWith('until='))?commits.slice(1).map(({files,...commit})=>commit):[{...commits[0],files:undefined}]);}
  const commit=commits.find(commit=>args[1]?.endsWith('/commits/'+commit.sha));if(commit)return JSON.stringify(commit);
  if(args[1]?.endsWith('/readme'))return JSON.stringify({encoding:'base64',content:Buffer.from('# 天气项目回忆\n用途：输入城市查看天气。\n已完成：城市输入与静态卡片。').toString('base64')});
  return JSON.stringify({name:'天气项目回忆',description:'仓库测试样例',private:true,language:'TypeScript'});
}});
app.listen(0,'127.0.0.1');await once(app,'listening');
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const settled=()=>page.waitForFunction(()=>document.getElementById('materials').getAttribute('aria-busy')==='false');
const shot=name=>page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
try{
  await page.goto(`http://127.0.0.1:${app.address().port}`);await page.locator('#source-github').click();await page.locator('#github-query').fill('owner/weather');await page.locator('#find-repository').click();await page.locator('#materials').waitFor();await settled();
  await page.locator('#milestone-summary').click();assert.equal(await page.locator('#milestone-list input:checked').count(),1);
  await page.locator('#history-before').fill('2018-12-31');await page.locator('#load-history').click();await settled();assert.equal(await page.locator('#milestone-list input').count(),3);assert.equal(await page.locator('#milestone-list input:checked').count(),1);
  await page.locator('#milestone-1').check();await settled();await page.locator('#milestone-2').check();await settled();
  await page.locator('#history-before').fill('2010-01-01');await page.locator('#load-history').click();await settled();assert.equal(await page.locator('#milestone-list input:checked').count(),3);assert((await page.locator('#history-status').innerText()).includes('原来的记录和选择已保留'));
  failHistory=true;await page.locator('#load-history').click();await settled();assert.equal(await page.locator('#milestone-list input:checked').count(),3);assert((await page.locator('#import-error').innerText()).length>0);failHistory=false;
  await shot('relic-history');await page.locator('#local-review').click();await page.locator('#confirm-panel').waitFor();await page.locator('#start').click();
  for(let i=0;i<3;i++){
    const route=await solve(levels[i],newBoard(levels[i]));assert(route);for(const action of route)await page.keyboard.press({up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',switch:'x'}[action]);
    await page.locator('#next-level').click();await page.locator('[data-memory-mode=relic]').click();await page.locator('#relic-desk').waitFor();assert(await page.locator('#story-card').isHidden());
    if(i===0){assert((await page.locator('#memory-title').innerText()).includes('第一张'));await page.locator('[data-side=before]').click();assert((await page.locator('#relic-desk pre').innerText()).includes('renderOld'));assert(!(await page.locator('#relic-desk pre').innerText()).includes('renderNew'));await page.locator('[data-side=after]').click();assert((await page.locator('#relic-desk pre').innerText()).includes('renderNew'));
      await page.locator('#relic-file').selectOption('README.md');assert((await page.locator('#relic-desk pre').innerText()).includes('<script>'));await page.locator('[data-relic-place=rest]').click();await page.locator('#relic-desk').getByRole('button',{name:'暂不选择',exact:true}).click();assert.equal(await page.locator('[data-relic-place][aria-pressed=true]').count(),0);await page.locator('#relic-file').selectOption('src/b.ts');
    }
    await page.locator('[data-relic-place='+['pass','keep','rest'][i]+']').click();
    await page.locator('#memory-write summary').click();await page.locator('#memory-note').fill('这一页陪我走过很多年。');await page.locator('#save-memory').click();assert.equal(await page.locator('[data-relic-place][aria-pressed=true]').count(),1);
    if(i===0){await page.locator('#relic-desk').screenshot({path:path.join(out,'relic-desk.png')});for(const width of [320,390]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}await page.locator('#relic-desk').screenshot({path:path.join(out,'relic-desk-mobile.png')});await page.setViewportSize({width:1280,height:900});}
    await page.locator('#memory-continue').click();
  }
  await page.locator('#skip').click();await page.locator('#stage').screenshot({path:path.join(out,'relic-station.png')});await page.locator('#lamp').click();await page.waitForFunction(()=>!document.getElementById('download').disabled);
  await page.locator('[data-result-page=memories]').click();assert.equal(await page.locator('#relic-collection button').count(),3);await shot('relic-collection');
  await page.locator('#relic-collection button').first().click();await page.locator('[data-memory-mode=relic]').click();assert.equal(await page.locator('[data-relic-place=pass]').getAttribute('aria-pressed'),'true');await page.locator('[data-relic-place=keep]').click();await page.locator('#memory-continue').click();assert((await page.locator('#relic-collection button').first().innerText()).startsWith('珍藏'));
  const mdEvent=page.waitForEvent('download');await page.locator('#save-handover').click();const md=await mdEvent;await md.saveAs(path.join(out,'relic-handover.md'));const text=fs.readFileSync(path.join(out,'relic-handover.md'),'utf8');assert(text.includes('珍藏 · src/b.ts'));assert(text.includes('暂存 · src/a.ts'));assert(text.includes('这一页陪我走过很多年。'));assert(text.includes('https://github.com/owner/weather/commit/'+commits[1].sha));
  const bookEvent=page.waitForEvent('download');await page.locator('#save-book').click();await(await bookEvent).saveAs(path.join(out,'relic-book.html'));assert(fs.readFileSync(path.join(out,'relic-book.html'),'utf8').includes('亲手收好的项目遗物'));
  await page.locator('#replay-ceremony').click();await page.locator('[data-result-page=memories]').click();assert.equal(await page.locator('#relic-collection button').count(),3);
  await page.locator('#new-project').click();await page.locator('#sample-weather').click();await page.locator('#start').click();await page.locator('#skip').click();await page.locator('#lamp').click();assert(await page.locator('#save-handover').isHidden());
  assert.deepEqual(errors,[]);assert(calls.some(args=>args.includes('until=2018-12-31T23:59:59Z')));console.log('通过：跨年保留选择、空记录/断网恢复、真实文件前后片段、三种去处、移动布局、回看改选、实际交接单与回忆册导出、换项目清空。');
}catch(error){await shot('relic-failure');throw error;}finally{await browser.close();app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
