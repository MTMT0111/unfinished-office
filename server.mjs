import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFile, spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {analysisPrompt, ANALYSIS_TIMEOUTS, DEFAULT_BASE, DEFAULT_MODEL, parseAnalysis, validateProject} from './src/analysis.ts';
import {githubProject, normalizeMilestones, repoName} from './src/project.ts';
import {readCompletion} from './src/stream.ts';

const root=path.dirname(fileURLToPath(import.meta.url));
const exec=promisify(execFile);
if(fs.existsSync(path.join(root,'.env.local')))process.loadEnvFile(path.join(root,'.env.local'));
async function runGitHub(args,options={}){
  try{return (await exec('gh',args,{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024,timeout:20000,windowsHide:true,...options})).stdout;}
  catch(error){if(error.code==='ENOENT')throw Object.assign(new Error('GitHub CLI 未安装。'),{status:503});throw error;}
}
const githubLoginArgs=['auth','status','--active','--hostname','github.com'];
function validLogin(runner){return runner(githubLoginArgs).then(()=>true,()=>false);}
function commandJson(text){try{return JSON.parse(text);}catch{throw new Error('GitHub 返回格式无效，请重试。');}}
function publicSearchArgs(query){return ['search','repos','--limit','6','--json','fullName,description,isPrivate','--visibility','public','--',query];}
function searchResult(items){return (Array.isArray(items)?items:[]).flatMap(item=>{
  if(typeof item?.fullName!=='string'||!repoName(item.fullName))return [];
  return [{name:item.fullName,description:String(item.description||'暂无介绍').slice(0,160),private:Boolean(item.isPrivate)}];
});}
export function endpoint(value){
  let url;try{url=new URL(value);}catch{throw new Error('API 地址无效，请填写完整的 HTTPS 地址。');}
  const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if((url.protocol!=='https:'&&!(local&&url.protocol==='http:'))||url.username||url.password||url.search||url.hash)throw new Error('API 地址需要 HTTPS；本机模型可使用 localhost 的 HTTP 地址。不要把密钥放进地址。');
  const pathname=url.pathname.replace(/\/+$/,'');
  url.pathname=pathname.endsWith('/chat/completions')?pathname:pathname+'/chat/completions';
  return url.toString();
}
export function createApp({fetchImpl=fetch,ghRun=runGitHub,analysisTimeouts=ANALYSIS_TIMEOUTS,config={base:process.env.PROJECT_API_BASE||DEFAULT_BASE,model:process.env.PROJECT_API_MODEL||DEFAULT_MODEL,key:process.env.DEEPSEEK_API_KEY||''}}={}){
  let active=0,analysisId=0;const recent=[];
  const app=http.createServer(async(req,res)=>{
    const host=req.headers.host||'',origin=req.headers.origin;
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    if(!/^(?:127\.0\.0\.1|localhost):\d+$/.test(host))return json(403,{error:'只允许本机访问。'});
    if(origin && origin!==`http://${host}` && !['http://127.0.0.1:5173','http://localhost:5173'].includes(origin))return json(403,{error:'请求来源不允许。'});
    const url=new URL(req.url,`http://${host}`);
    if(url.pathname==='/api/config'&&req.method==='GET')return json(200,{app:'unfinished-office',base:config.base,model:config.model,configured:Boolean(config.key)});
    if(url.pathname==='/api/analysis-status'&&req.method==='GET'){
      if(req.headers['x-project-review']!=='1')return json(405,{error:'请从项目页面读取状态。'});
      return json(200,{requests:recent.map(item=>({...item,elapsedMs:(item.endedAt||Date.now())-item.startedAt}))});
    }
    if(url.pathname.startsWith('/api/github/')){
      if(req.headers['x-project-review']!=='1')return json(405,{error:'请从项目页面发起请求。'});
      if(url.pathname==='/api/github/status'&&req.method==='GET'){
        try{await ghRun(githubLoginArgs);return json(200,{available:true,loggedIn:true});}
        catch(error){return json(error.code==='ENOENT'?503:200,{available:error.code!=='ENOENT',loggedIn:false});}
      }
      if(url.pathname==='/api/github/login'&&req.method==='POST'){
        if(!req.headers['content-type']?.startsWith('application/json'))return json(405,{error:'请从项目页面发起登录。'});
        if(await validLogin(ghRun))return json(200,{loggedIn:true});
        const terminal=spawn('cmd.exe',['/c','start','GitHub 登录','cmd.exe','/k','gh auth login --hostname github.com --web'],{cwd:root,stdio:'ignore',windowsHide:true});
        terminal.on('error',()=>{});terminal.unref();
        return json(202,{opened:true});
      }
      if(req.method!=='GET'||!['/api/github/search','/api/github/repo','/api/github/commits','/api/github/commit'].includes(url.pathname))return json(404,{error:'接口不存在。'});
      const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
      try{
        await ghRun(githubLoginArgs,{signal:controller.signal});
      }catch(error){
        if(controller.signal.aborted)return;
        return json(error.code==='ENOENT'||error.status===503?503:401,{error:error.code==='ENOENT'?'请安装 GitHub CLI 后重试。':'GitHub 未连接或登录已失效。'});
      }
      try{
        if(url.pathname==='/api/github/search'){
          const query=url.searchParams.get('q')?.trim()||'';
          if(!query||query.length>120||/[\u0000-\u001f]/.test(query))return json(400,{error:'请输入仓库名或关键词。'});
          const [accessibleText,publicText]=await Promise.all([
            ghRun(['api','--paginate','--slurp','/user/repos?per_page=100&sort=updated'],{signal:controller.signal}),
            ghRun(publicSearchArgs(query),{signal:controller.signal}),
          ]);
          const terms=query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
          const accessible=commandJson(accessibleText).flat().filter(repo=>{
            const text=`${repo.full_name||''} ${repo.description||''} ${repo.language||''}`.toLocaleLowerCase();
            return terms.every(term=>text.includes(term));
          }).slice(0,6).map(repo=>({name:repo.full_name,description:String(repo.description||'暂无介绍').slice(0,160),private:Boolean(repo.private)}));
          const results=[...accessible,...searchResult(commandJson(publicText))];
          const seen=new Set();
          return json(200,{repositories:results.filter(item=>{const key=item.name.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,12)});
        }
        const name=repoName(url.searchParams.get('name')||'');
        if(!name)return json(400,{error:'仓库名称格式无效。'});
        const route='repos/'+name.split('/').map(encodeURIComponent).join('/');
        if(url.pathname==='/api/github/commits'){
          const commits=commandJson(await ghRun(['api','-X','GET',route+'/commits','-f','per_page=40'],{signal:controller.signal}));
          return json(200,{commits:normalizeMilestones(commits,name)});
        }
        if(url.pathname==='/api/github/commit'){
          const sha=url.searchParams.get('sha')||'';
          if(!/^[a-f\d]{40}$/i.test(sha))return json(400,{error:'请选择完整的提交记录。'});
          const data=commandJson(await ghRun(['api',route+'/commits/'+sha],{signal:controller.signal}));
          const commit=normalizeMilestones([data],name)[0];
          if(!commit||commit.sha!==sha.toLowerCase())throw new Error('提交记录不匹配。');
          return json(200,{commit});
        }
        const meta=commandJson(await ghRun(['api',route],{signal:controller.signal}));
        let readme;
        try{readme=commandJson(await ghRun(['api',route+'/readme'],{signal:controller.signal}));}
        catch(error){if(controller.signal.aborted)throw error;}
        return json(200,{project:githubProject(name,meta,readme,true)});
      }catch(error){
        if(controller.signal.aborted)return;
        if(error.status===503)return json(503,{error:error.message});
        if(error.code==='ENOENT')return json(503,{error:'请安装 GitHub CLI 后重试。'});
        const missing=url.pathname==='/api/github/repo';
        return json(missing?404:502,{error:missing?'没有找到仓库，或当前账号无权访问。':url.pathname.startsWith('/api/github/commit')?'无法读取 GitHub 提交记录，请稍后重试。':'GitHub 搜索失败，请重试。'});
      }
    }
    if(url.pathname==='/api/analyze'){
      if(req.method!=='POST'||req.headers['x-project-review']!=='1'||!req.headers['content-type']?.startsWith('application/json'))return json(405,{error:'请从项目页面发起分析。'});
      if(active>=2)return json(429,{error:'已有分析在进行，请稍后再试。'});
      active++;const abort=new AbortController();let idleTimer,totalTimer,timeoutMessage='';
      const streaming=req.headers.accept==='application/x-ndjson';let trace,lastProgress=0;
      const send=data=>{if(!res.headersSent)res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.write(JSON.stringify(data)+'\n');};
      const progress=(stage,characters=trace?.characters||0)=>{
        const changed=trace.stage!==stage;trace.stage=stage;trace.characters=characters;
        if(streaming&&!res.destroyed&&(changed||Date.now()-lastProgress>=500)){send({stage,characters});lastProgress=Date.now();}
      };
      const timeout=message=>{timeoutMessage=message;abort.abort();};
      // DeepSeek 排队时也会发送空行；有数据到达就续期，另设总时限避免永久等待。
      const activity=()=>{if(trace)trace.lastActivityAt=Date.now();clearTimeout(idleTimer);idleTimer=setTimeout(()=>timeout('API 连续 '+Math.ceil(analysisTimeouts.idle/1000)+' 秒没有响应，请检查网络或稍后重试。材料已保留。'),analysisTimeouts.idle);};
      res.on('close',()=>{if(!res.writableEnded)abort.abort();});
      try{
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>180000)throw new Error('请求过大，请减少材料。');chunks.push(chunk);}
        const data=JSON.parse(Buffer.concat(chunks).toString('utf8')),project=validateProject(data.project);
        const base=typeof data.base==='string'&&data.base.trim()?data.base.trim():config.base;
        const target=endpoint(base),model=typeof data.model==='string'&&data.model.trim()?data.model.trim():config.model;
        if(!/^[\w./:-]{1,120}$/.test(model))throw new Error('请填写有效的模型名。');
        const key=typeof data.key==='string'&&data.key.trim()?data.key.trim():(target===endpoint(config.base)?config.key:'');
        if(!key)throw new Error('请先在 API 设置中填写密钥。');
        if(key.length>512||/[\r\n]/.test(key))throw new Error('密钥格式无效。');
        trace={id:++analysisId,host:new URL(target).hostname,model,startedAt:Date.now(),stage:'',characters:0};recent.push(trace);if(recent.length>5)recent.shift();progress('connecting');
        abort.signal.throwIfAborted();activity();
        totalTimer=setTimeout(()=>timeout(trace.characters?'API 等待已达 '+Math.ceil(analysisTimeouts.total/60000)+' 分钟，本次分析已停止。材料已保留，可稍后重试。':'API 在 '+Math.ceil(analysisTimeouts.total/60000)+' 分钟内没有返回档案正文，可能仍在排队。材料已保留，可稍后重试或手动整理。'),analysisTimeouts.total);
        const response=await fetchImpl(target,{method:'POST',redirect:'error',signal:abort.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:'system',content:analysisPrompt},{role:'user',content:JSON.stringify(project)}],response_format:{type:'json_object'},max_tokens:6200,stream:true,...(new URL(target).hostname==='api.deepseek.com'?{thinking:{type:'disabled'}}:{})})});
        activity();trace.httpStatus=response.status;
        if(!response.ok){await response.body?.cancel();throw new Error(response.status===401?'API 密钥无效，请重新填写。':response.status===402?'API 余额不足，请在服务商处检查余额。':response.status===429?'API 请求受限，请稍后再试。':`API 请求失败（${response.status}），请检查地址、模型或稍后重试。`);}
        progress('waiting');const content=await readCompletion(response,activity,progress);abort.signal.throwIfAborted();
        progress('validating');const identity=parseAnalysis(content,project);progress('complete');
        if(streaming){send({identity});res.end();return;}
        return json(200,{identity});
      }catch(error){
        const message=timeoutMessage||(abort.signal.aborted?'分析已取消，材料已保留。':error instanceof SyntaxError?'返回数据格式无效，材料已保留，请重试。':error instanceof TypeError?'无法连接 API，请检查接口地址和网络。':error.message);
        if(trace){trace.failedAt=trace.stage;trace.stage=timeoutMessage?'timeout':abort.signal.aborted?'cancelled':'failed';}
        if(!res.destroyed){if(res.headersSent){send({error:message});res.end();return;}return json(timeoutMessage?504:400,{error:message});}
      }finally{if(trace)trace.endedAt=Date.now();active--;clearTimeout(idleTimer);clearTimeout(totalTimer);abort.abort();}
      return;
    }
    if(url.pathname.startsWith('/api/'))return json(404,{error:'接口不存在。'});
    if(req.method!=='GET'&&req.method!=='HEAD')return json(405,{error:'不支持此操作。'});
    let file;
    try{const requested=decodeURIComponent(url.pathname);file=requested==='/'?path.join(root,'dist/index.html'):path.resolve(root,'dist','.'+requested);}
    catch{return json(400,{error:'路径无效。'});}
    const dist=path.join(root,'dist')+path.sep;
    if(!file.startsWith(dist))return json(404,{error:'文件不存在。'});
    try{
      const stat=fs.statSync(file);if(!stat.isFile())throw new Error();
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'}[path.extname(file)]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':mime,'Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      if(req.method==='HEAD')res.end();else fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
    }catch{json(404,{error:'页面未构建，请先运行 npm run build。'});}
  });
  app.requestTimeout=95000;
  return app;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=createApp(),port=Number(process.env.UNFINISHED_OFFICE_PORT)||4188;
  app.on('error',error=>{console.error(error.code==='EADDRINUSE'?`${port} 端口已被占用。请检查是否已启动事务所。`:'本地服务启动失败。');process.exitCode=1;});
  app.listen(port,'127.0.0.1',()=>console.log(`烂尾事务所：http://127.0.0.1:${port}/`));
}

