import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/86137/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'verification'),folder=path.join(out,'browser-temp','import-fixture');
fs.mkdirSync(path.join(folder,'src'),{recursive:true});fs.mkdirSync(path.join(folder,'node_modules','fixture'),{recursive:true});
fs.writeFileSync(path.join(folder,'README.md'),'# 雨天工具\n原本用途：输入城市查看天气。\n已完成：城市输入界面。\nTODO：实时天气接口。');
fs.writeFileSync(path.join(folder,'package.json'),' {"name":"rain-app"}');
fs.writeFileSync(path.join(folder,'src','main.ts'),'export const title = "城市输入界面";\nconst api_key = "sk-syntheticnotarealsecret";');
fs.writeFileSync(path.join(folder,'.env'),'PRIVATE_FIXTURE_SHOULD_NOT_BE_READ');fs.writeFileSync(path.join(folder,'node_modules','fixture','index.js'),'DEPENDENCY_SHOULD_NOT_BE_READ');
process.env.TEMP=path.join(out,'browser-temp');process.env.TMP=process.env.TEMP;
let mode='ok',cancelledRequests=0;const requests=[],analysisDelay=Number(process.env.ANALYSIS_DELAY_MS||1600);
const provider=http.createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks));requests.push(body);
  if(mode==='fail'){res.writeHead(401);res.end('{}');return;}
  const value={facts:{name:{value:'雨天工具',path:'README.md',quote:'雨天工具'},purpose:{value:'输入城市查看天气',path:'README.md',quote:'输入城市查看天气。'},completed:{value:'README 自述已完成城市输入界面',path:'README.md',quote:'已完成：城市输入界面。'},unfinished:{value:'TODO 记载实时天气接口待处理，需核对',path:'README.md',quote:'TODO：实时天气接口。'}},review:[{text:'实时接口仍列为待办，需核对最新进展。',path:'README.md',quote:'TODO：实时天气接口。'}],prop:'umbrella'};
  value.keywords=[{text:'城市天气',category:'purpose',path:'README.md',quote:'输入城市查看天气。'},{text:'自述：城市输入界面',category:'built',path:'README.md',quote:'已完成：城市输入界面。'},{text:'资料待办：实时天气接口',category:'next',path:'README.md',quote:'TODO：实时天气接口。'}];
  assert.equal(body.stream,true);res.writeHead(200,{'Content-Type':'text/event-stream'});res.write(': keep-alive\n\n');
  const heartbeat=setInterval(()=>res.write(': keep-alive\n\n'),200);let finish;
  const begin=setTimeout(()=>{
    clearInterval(heartbeat);const content=JSON.stringify(value),half=Math.floor(content.length/2);
    res.write('data: '+JSON.stringify({choices:[{delta:{content:content.slice(0,half)},finish_reason:null}]})+'\n\n');
    finish=setTimeout(()=>res.end('data: '+JSON.stringify({choices:[{delta:{content:content.slice(half)},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'),700);
  },mode==='hold'?600000:mode==='slow'?1000:analysisDelay);
  res.on('close',()=>{clearInterval(heartbeat);clearTimeout(begin);clearTimeout(finish);if(!res.writableEnded)cancelledRequests++;});
});
provider.listen(0,'127.0.0.1');await once(provider,'listening');
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce',acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4188/');
  await page.locator('#input-panel').screenshot({path:path.join(out,'import-entry.png')});
  await page.locator('#folder-files').setInputFiles(folder);
  await page.locator('#materials').waitFor();assert.equal(await page.locator('.material-row').count(),3);
  assert.equal(await page.locator('#material-details').evaluate(e=>e.open),false);await page.locator('#materials-summary').click();
  const materials=await page.locator('#material-list').innerText();assert(!materials.includes('PRIVATE_FIXTURE'));assert(!materials.includes('DEPENDENCY_'));assert(!materials.includes('sk-syntheticnotarealsecret'));
  await page.locator('.material-row').filter({hasText:'package.json'}).locator('input').uncheck();
  await page.locator('#analyze-project').click();await page.locator('#import-error').filter({hasText:'密钥'}).waitFor();
  await page.locator('#api-base').fill(`http://127.0.0.1:${provider.address().port}/v1`);await page.locator('#api-model').fill('fixture-model');await page.locator('#api-key').fill('fixture-session-key');
  mode='fail';await page.locator('#analyze-project').click();await page.locator('#import-error').filter({hasText:'密钥无效'}).waitFor();assert(await page.locator('#materials').isVisible());
  mode='ok';const analysisStarted=Date.now();await page.locator('#analyze-project').click();
  await page.locator('#import-status').filter({hasText:'1 秒'}).waitFor();assert(await page.locator('#cancel-import').isVisible());
  assert((await page.locator('#import-status').innerText()).includes('等待档案正文'));
  if(analysisDelay>90000){
    await page.locator('#import-status').filter({hasText:'最长 10 分钟'}).waitFor({timeout:analysisDelay+10000});
    assert.equal(await page.locator('#import-error').innerText(),'');assert(await page.locator('#analyze-project').isDisabled());
    await page.locator('#import-status').screenshot({path:path.join(out,'analysis-past-90s-status.png')});
  }
  await page.locator('#import-status').filter({hasText:'正在生成项目档案'}).waitFor({timeout:analysisDelay+10000});assert((await page.locator('#import-status').innerText()).includes('已收到'));assert(await page.locator('#api-service-status').isHidden());
  await page.locator('#confirm-panel').waitFor({timeout:analysisDelay+10000});const analysisElapsedMs=Date.now()-analysisStarted;
  assert((await page.locator('#confirm-keywords').innerText()).includes('自述：城市输入界面'));await page.locator('#edit-facts summary').click();
  assert.equal(await page.locator('#edit-name').inputValue(),'雨天工具');assert((await page.locator('#source-completed').innerText()).includes('README.md'));assert.equal(await page.locator('#edit-reason').inputValue(),'');
  assert.equal(JSON.parse(requests.at(-1).messages[1].content).files.length,2);
  await page.locator('#edit-reason').fill('先去过个夏天，回来再写。');await page.locator('#review-panel summary').click();
  await page.locator('#confirm-panel').screenshot({path:path.join(out,'api-confirm.png')});
  await page.locator('#start').click();await page.locator('#skip').click();await page.locator('#lamp').click();
  await page.waitForFunction(()=>!document.getElementById('download').disabled);
  const download=page.waitForEvent('download');await page.locator('#download').click();await (await download).saveAs(path.join(out,'api-personal-export.png'));
  await page.locator('#new-project').click();mode='slow';await page.locator('#analyze-project').click();await page.waitForTimeout(250);await page.locator('#cancel-import').click();await page.locator('#sample-novel').click();await page.waitForTimeout(1300);assert.equal(await page.locator('#edit-name').inputValue(),'写到第三章的小说');assert.equal(cancelledRequests,1);assert.equal(await page.locator('#import-status').innerText(),'');
  await page.locator('#back').click();
  await page.route('**/api/github/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/github/status')return route.fulfill({json:{available:true,loggedIn:true}});
    if(url.pathname==='/api/github/search')return route.fulfill({json:{repositories:[{name:'fixture/rain',description:'测试天气仓库',private:true}]}});
    if(url.pathname==='/api/github/repo'&&url.searchParams.get('name')==='fixture/rain')return route.fulfill({json:{project:{label:'rain',origin:'github',private:true,files:[{path:'仓库信息.txt',text:'名称：rain\n天气工具',truncated:false},{path:'README.md',text:'# 雨天工具\n用途：查看天气。',truncated:false}],notes:['已通过 GitHub 登录读取。']}}});
    return route.fulfill({status:404,json:{error:'没有找到仓库，或当前账号无权访问。'}});
  });
  await page.locator('#source-github').click();await page.locator('#github-query').fill('天气');await page.locator('#find-repository').click();await page.locator('#repository-results button').click();await page.locator('#materials-title').filter({hasText:'rain'}).waitFor();
  assert.equal(await page.locator('.material-row').count(),2);assert((await page.locator('#materials-title').innerText()).includes('私有'));await page.locator('#input-panel').screenshot({path:path.join(out,'github-selection.png')});
  await page.locator('#github-query').fill('https://github.com/no/such');await page.locator('#find-repository').click();await page.locator('#import-error').filter({hasText:'没有找到'}).waitFor();assert((await page.locator('#materials-title').innerText()).includes('rain'));
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);}
  await page.setViewportSize({width:390,height:844});await page.locator('#input-panel').screenshot({path:path.join(out,'import-mobile.png')});
  assert.deepEqual(errors,[]);assert(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes('fixture-session-key'));
  await page.reload();assert.equal(await page.locator('#api-key').inputValue(),'');
  await page.clock.install();mode='hold';
  await page.route('**/api/analyze',route=>{const body=route.request().postDataJSON();return route.continue({postData:JSON.stringify({...body,base:`http://127.0.0.1:${provider.address().port}/v1`})});});
  await page.locator('#folder-files').setInputFiles(folder);await page.locator('#analyze-project').click();await page.locator('#import-error').filter({hasText:'密钥'}).waitFor();
  await page.locator('#api-key').fill('fixture-session-key');await page.locator('#analyze-project').click();
  await page.locator('#import-status').filter({hasText:'等待档案正文'}).waitFor();await page.clock.fastForward(46000);
  assert((await page.locator('#import-status').innerText()).includes('可能排队或服务异常'));assert(await page.locator('#api-service-status').isVisible());
  await page.locator('#import-status').screenshot({path:path.join(out,'api-waiting-status.png')});
  await page.locator('#cancel-import').click();assert(await page.locator('#api-service-status').isHidden());assert(await page.locator('#materials').isVisible());
  const result={browser:await browser.version(),api:'本地模拟 OpenAI 兼容服务，经过真实后端 HTTP 请求；未使用 DeepSeek 实际密钥',analysisDelayMs:analysisDelay,analysisElapsedMs,github:'登录态、私有仓库搜索、选择及无权访问为可复现模拟响应；真实连接另行验证',checks:['真实目录文件输入、凭据/依赖过滤、材料取消勾选','缺少密钥和 401 失败后材料保留，可重试','等待计时、空行保活后生成档案及引用，主观内容留空','主观留言可填写；简洁纪念票实际下载','取消慢请求中断上游，计时清理且样例不被旧结果覆盖','GitHub 状态、私有仓库搜索与读取、失败时保留材料','320/390/768/1440px 无横向溢出','密钥不进入 localStorage，刷新清空'],errors};
  fs.writeFileSync(path.join(out,'import-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){await page.screenshot({path:path.join(out,'import-failure.png'),fullPage:true});throw error;}
finally{await browser.close();provider.closeAllConnections();provider.close();}
