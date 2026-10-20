import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp,endpoint} from '../server.mjs';

const project={label:'天气工具',origin:'folder',files:[{path:'README.md',text:'# 天气工具\n用途：查看天气。',truncated:false}],notes:[]};
const response=()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({facts:{purpose:{value:'查看天气',path:'README.md',quote:'用途：查看天气。'}},review:[],prop:'umbrella'})}}]}),{status:200});
async function serve(t,fetchImpl=fetch,config={base:'https://api.deepseek.com',model:'deepseek-flash',key:'test-only-secret'},ghRun,analysisTimeouts){
  const server=createApp({fetchImpl,config,ghRun,analysisTimeouts});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});return `http://127.0.0.1:${server.address().port}`;
}
const options=data=>({method:'POST',headers:{'Content-Type':'application/json','X-Project-Review':'1'},body:JSON.stringify({project,...data})});

test('历史提交查询传递明确的 UTC 截止日，非法日期不发出 GitHub 请求',async t=>{
  const calls=[],url=await serve(t,fetch,undefined,async args=>{calls.push(args);return args[0]==='auth'?'logged in':'[]';}),headers={'X-Project-Review':'1'};
  assert.equal((await fetch(url+'/api/github/commits?name=owner/project&before=2016-02-29',{headers})).status,200);
  assert(calls.some(args=>args.includes('until=2016-02-29T23:59:59Z')));
  const before=calls.filter(args=>args[0]==='api').length;
  assert.equal((await fetch(url+'/api/github/commits?name=owner/project&before=2017-02-29',{headers})).status,400);
  assert.equal(calls.filter(args=>args[0]==='api').length,before);
});

test('GitHub 单次提交只接受完整 SHA，返回有作者的有界差异并隐藏敏感文件',async t=>{
  const sha='a'.repeat(40),calls=[];
  const raw={sha,commit:{message:'城市输入检查',author:{name:'Wen',email:'private@example.com'},committer:{date:'2026-02-03T08:00:00Z'}},files:[{filename:'src/city.ts',status:'modified',patch:'+if (!city) return;'}, {filename:'.env',patch:'secret'}]};
  const url=await serve(t,fetch,undefined,async args=>{calls.push(args);return args[0]==='auth'?'logged in':JSON.stringify(args.includes('per_page=40')?[raw]:raw);});
  const headers={'X-Project-Review':'1'};
  const list=await (await fetch(url+'/api/github/commits?name=owner/project',{headers})).json();assert.equal(list.commits[0].author,'Wen');assert.equal(list.commits[0].repository,'owner/project');
  const result=await (await fetch(url+`/api/github/commit?name=owner/project&sha=${sha}`,{headers})).json();assert.equal(result.commit.changes.length,1);assert(!JSON.stringify(result).includes('private@example.com'));assert(!JSON.stringify(result).includes('secret'));
  assert(calls.some(args=>args[1]===`repos/owner/project/commits/${sha}`));
  const before=calls.filter(args=>args[0]==='api').length;
  assert.equal((await fetch(url+'/api/github/commit?name=owner/project&sha=main%2F..',{headers})).status,400);
  assert.equal(calls.filter(args=>args[0]==='api').length,before);
});
test('服务传递 DeepSeek JSON 请求，验证引用后返回档案，不返回密钥',async t=>{
  let called=0;const url=await serve(t,async(target,request)=>{
    called++;assert.equal(target,'https://api.deepseek.com/chat/completions');assert.equal(request.headers.Authorization,'Bearer test-only-secret');const payload=JSON.parse(request.body);assert.equal(payload.model,'deepseek-flash');assert.equal(payload.stream,true);assert.equal(payload.response_format.type,'json_object');assert.equal(payload.thinking.type,'disabled');assert(payload.messages[1].content.includes('天气工具'));return response();
  });
  const config=await (await fetch(url+'/api/config')).text();assert(!config.includes('test-only-secret'));
  const result=await fetch(url+'/api/analyze',options({}));assert.equal(result.status,200);const body=await result.json();assert.equal(body.identity.facts.purpose.value,'查看天气');assert.equal(called,1);
});
test('外站请求与无标记请求被拒绝；切换端点不泄露服务端密钥',async t=>{
  let calls=0;const url=await serve(t,async()=>{calls++;return response();});
  const external=options({});external.headers.Origin='https://evil.example';assert.equal((await fetch(url+'/api/analyze',external)).status,403);
  assert.equal((await fetch(url+'/api/analyze',{method:'POST',body:'{}'})).status,405);
  const switched=await fetch(url+'/api/analyze',options({base:'https://another.example/v1'}));assert.equal(switched.status,400);assert.equal(calls,0);
  assert.equal((await fetch(url+'/%2e%2e%5cpackage.json')).status,404);
});
test('API 认证失败、空结果、无效 JSON 均可重试且不泄露上游内容',async t=>{
  let mode=0;const url=await serve(t,async()=>mode===0?new Response('private upstream diagnostic',{status:401}):mode===1?new Response('{}'):mode===2?new Response('bad json'):response());
  for(mode=0;mode<3;mode++){const r=await fetch(url+'/api/analyze',options({}));assert.equal(r.status,400);assert(!(await r.text()).includes('private upstream'));}
  assert.equal((await fetch(url+'/api/analyze',options({}))).status,200);
});
test('取消客户端请求会中止上游 API',async t=>{
  let entered,stopped;const began=new Promise(r=>entered=r),ended=new Promise(r=>stopped=r);
  const url=await serve(t,async(_,request)=>{entered();return new Promise((_,reject)=>request.signal.addEventListener('abort',()=>{stopped();reject(new Error('cancelled'));}));});
  const controller=new AbortController();const pending=fetch(url+'/api/analyze',{...options({}),signal:controller.signal});await began;controller.abort();await assert.rejects(pending);await Promise.race([ended,new Promise((_,reject)=>setTimeout(()=>reject(new Error('上游没有取消')),1500))]);
});
function delayedResponse(signal,content,delay,heartbeat){
  return new Response(new ReadableStream({start(controller){
    const pulse=heartbeat?setInterval(()=>controller.enqueue(Buffer.from('\n')),heartbeat):undefined;
    const finish=content===null?undefined:setTimeout(()=>{clearInterval(pulse);controller.enqueue(Buffer.from(content));controller.close();},delay);
    signal.addEventListener('abort',()=>{clearInterval(pulse);clearTimeout(finish);controller.error(new Error('cancelled'));},{once:true});
  }}),{headers:{'Content-Type':'application/json'}});
}
test('排队空行持续续期，超过空闲时限仍能完成并校验引用',async t=>{
  const content=await response().text();
  const url=await serve(t,async(_,request)=>delayedResponse(request.signal,content,450,20),undefined,undefined,{idle:150,total:1600});
  const result=await fetch(url+'/api/analyze',options({}));
  assert.equal(result.status,200);assert.equal((await result.json()).identity.facts.purpose.value,'查看天气');
});
test('连接前或响应中长时间无数据会停止；可重试且不占用分析名额',async t=>{
  let mode='connect',aborted=0;
  const url=await serve(t,async(_,request)=>{
    request.signal.addEventListener('abort',()=>aborted++,{once:true});
    if(mode==='ok')return response();
    if(mode==='body')return delayedResponse(request.signal,null,0,0);
    return new Promise((_,reject)=>request.signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true}));
  },undefined,undefined,{idle:150,total:1600});
  for(mode of ['connect','body','connect']){
    const result=await fetch(url+'/api/analyze',options({}));assert.equal(result.status,504);assert.match((await result.json()).error,/没有响应.*材料已保留/);
  }
  assert.equal(aborted,3);mode='ok';assert.equal((await fetch(url+'/api/analyze',options({}))).status,200);
});
test('持续保活但没有结果也受总时限约束，不会无限等待',async t=>{
  const url=await serve(t,async(_,request)=>delayedResponse(request.signal,null,0,20),undefined,undefined,{idle:150,total:350});
  const result=await fetch(url+'/api/analyze',options({}));assert.equal(result.status,504);assert.match((await result.json()).error,/没有返回档案正文.*材料已保留/);
});
test('流式分析返回实际阶段；诊断只含状态，不含密钥或项目正文',async t=>{
  const content=(await response().json()).choices[0].message.content;
  const url=await serve(t,async()=>new Response('data: '+JSON.stringify({choices:[{delta:{content},finish_reason:'stop'}]})+'\n\n',{headers:{'Content-Type':'text/event-stream'}}));
  const request=options({});request.headers.Accept='application/x-ndjson';
  const result=await fetch(url+'/api/analyze',request),events=(await result.text()).trim().split('\n').map(JSON.parse);
  assert.deepEqual(events.filter(e=>e.stage).map(e=>e.stage),['connecting','waiting','generating','validating','complete']);
  assert.equal(events.at(-1).identity.facts.purpose.value,'查看天气');
  assert.equal((await fetch(url+'/api/analysis-status')).status,405);
  const diagnostic=await (await fetch(url+'/api/analysis-status',{headers:{'X-Project-Review':'1'}})).json();
  assert.equal(diagnostic.requests[0].stage,'complete');assert.equal(diagnostic.requests[0].httpStatus,200);assert(diagnostic.requests[0].characters>0);
  assert(!JSON.stringify(diagnostic).includes('test-only-secret'));assert(!JSON.stringify(diagnostic).includes('天气工具'));
});
test('流中报错通过事件传回，保留材料且不输出半成品档案',async t=>{
  const url=await serve(t,async()=>new Response('data: {"error":{"message":"private diagnostic"}}\n\n',{headers:{'Content-Type':'text/event-stream'}}));
  const request=options({});request.headers.Accept='application/x-ndjson';
  const events=(await (await fetch(url+'/api/analyze',request)).text()).trim().split('\n').map(JSON.parse);
  assert.match(events.at(-1).error,/生成中断.*材料已保留/);assert(!events.some(e=>e.identity));assert(!JSON.stringify(events).includes('private diagnostic'));
});
test('API 地址拒绝明文外部服务、嵌入密钥和 URL 参数',()=>{
  assert.equal(endpoint('https://api.deepseek.com/'),'https://api.deepseek.com/chat/completions');assert.equal(endpoint('http://127.0.0.1:11434/v1'),'http://127.0.0.1:11434/v1/chat/completions');
  for(const url of ['http://example.com/v1','https://secret@example.com','https://example.com?key=secret','file:///secret'])assert.throws(()=>endpoint(url));
});
test('GitHub 登录态只在本地服务使用，可搜索私有仓库并读取 README',async t=>{
  const calls=[];const ghRun=async args=>{
    calls.push(args);
    if(args[0]==='auth')return '';
    if(args[0]==='api'&&args[1]==='--paginate')return JSON.stringify([[{full_name:'org/shelf',name:'shelf',description:'garden notes',language:'TypeScript',private:true}]]);
    if(args[0]==='search')return JSON.stringify([{fullName:'org/site',description:'公开站点',isPrivate:false}]);
    if(args[0]==='api'&&args[1]==='repos/org/shelf')return JSON.stringify({name:'shelf',description:'项目资料',language:'TypeScript',private:true});
    if(args[0]==='api'&&args[1]==='repos/org/shelf/readme')return JSON.stringify({encoding:'base64',content:Buffer.from('# Shelf\n园艺记录').toString('base64')});
    throw new Error('unexpected GitHub CLI call');
  };
  const url=await serve(t,fetch,undefined,ghRun),headers={'X-Project-Review':'1'};
  const status=await (await fetch(url+'/api/github/status',{headers})).json();assert.deepEqual(status,{available:true,loggedIn:true});
  const results=await (await fetch(url+'/api/github/search?q=garden',{headers})).json();
  assert.deepEqual(results.repositories.map(item=>[item.name,item.private]),[['org/shelf',true],['org/site',false]]);
  const loaded=await (await fetch(url+'/api/github/repo?name=org%2Fshelf',{headers})).json();
  assert.equal(loaded.project.private,true);assert(loaded.project.files.some(file=>file.text.includes('园艺记录')));
  const before=calls.length;assert.equal((await fetch(url+'/api/github/search?q=garden')).status,405);assert.equal(calls.length,before);
  assert(!JSON.stringify({status,results,loaded}).includes('token'));
});
