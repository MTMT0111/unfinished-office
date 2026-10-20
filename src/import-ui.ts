import { chooseDirectory, cleanText, localIdentity, readCommit, readCommitHistory, readDirectory, readFolderFiles, readRepository, repoName, searchRepositories, suggestedMilestones, supportsDirectoryPicker, type Project } from './project.ts';
import { take, type GitMilestone, type Identity } from './input.ts';
import { commitEvidence } from './journal.ts';
import { ANALYSIS_TIMEOUTS } from './analysis.ts';
import { responseLines } from './stream.ts';

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
export function setupImport(onConfirm:(identity:Identity)=>void):()=>void{
  let project:Project|null=null,controller:AbortController|null=null,configured=false;
  const key=el<HTMLInputElement>('api-key'),base=el<HTMLInputElement>('api-base'),model=el<HTMLInputElement>('api-model');
  function busy(active:boolean){
    el('materials').setAttribute('aria-busy',String(active));
    for(const id of ['choose-folder','find-repository','github-login','analyze-project','local-review','analyze-text'])el<HTMLButtonElement>(id).disabled=active;
    el('cancel-import').hidden=!active;
    for(const check of document.querySelectorAll<HTMLInputElement>('#materials input[type=checkbox]'))check.disabled=active;
  }
  function cancel(){controller?.abort();controller=null;busy(false);el('import-status').textContent='';el('api-service-status').hidden=true;}
  function selected():Project{
    if(!project)throw new Error('请先选择一个项目。');
    const files=project.files.filter((_,i)=>el<HTMLInputElement>('material-'+i).checked);
    if(!files.length)throw new Error('至少保留一份材料，或返回手动填写。');
    return {label:project.label,origin:project.origin,files,notes:project.notes,milestones:selectedMilestones(),...(project.private?{private:true}:{})};
  }
  function selectedMilestones(){
    return (project?.milestones||[]).filter((_,i)=>el<HTMLInputElement>('milestone-'+i).checked).sort((a,b)=>(a.committedAt||a.date).localeCompare(b.committedAt||b.date));
  }
  async function enrich(commits:GitMilestone[],name:string,signal:AbortSignal){
    el('import-status').textContent='正在读取所选提交的实际改动…';
    const results=await Promise.allSettled(commits.filter(commit=>commit.changes===undefined).map(async commit=>{
      const detail=location.protocol==='file:'?await readCommit(name,commit.sha,signal):(await githubRequest('/api/github/commit?name='+encodeURIComponent(name)+'&sha='+commit.sha,signal)).commit;
      signal.throwIfAborted();Object.assign(commit,detail);
    }));
    signal.throwIfAborted();
    if(results.some(result=>result.status==='rejected'))el('import-error').textContent='部分改动详情没有读到；对应日记仅使用提交说明，你可以重试读取。';
  }
  function previews(){
    const preview=el('milestone-preview');preview.replaceChildren(...selectedMilestones().map(commit=>commitEvidence(commit)));
  }
  function renderMilestones(next:Project){
    const details=el<HTMLDetailsElement>('milestone-details'),list=el('milestone-list');details.hidden=next.origin!=='github';list.replaceChildren();
    const commits=next.milestones||[];
    const suggested=new Set(suggestedMilestones(commits).map(commit=>commit.sha));
    el('milestone-summary').textContent=`回忆从这里开始 · 已选 ${suggested.size} 次更新`;
    el('milestone-note').textContent=commits.length?'从默认分支最近 40 条记录中按时间预选，未判断重要性。可改选最多 5 次；生成档案会把勾选提交、作者和下方改动片段一并发给所配置 API。日期是提交日期，不是推送时间。':'没有读到提交记录。只整理现有资料，不编造过去的事件。';
    for(const [i,commit] of commits.entries()){
      const row=document.createElement('label'),check=document.createElement('input'),body=document.createElement('span'),subject=document.createElement('span'),meta=document.createElement('small');
      row.className='milestone-option';check.type='checkbox';check.id='milestone-'+i;check.checked=suggested.has(commit.sha);
      subject.textContent=commit.subject;meta.textContent=`${commit.date} · ${commit.author||'作者未提供'} · ${commit.sha.slice(0,7)}`;body.append(subject,meta);row.append(check,body);list.append(row);
      check.addEventListener('change',()=>{
        const count=list.querySelectorAll<HTMLInputElement>('input:checked').length;
        if(count>5){check.checked=false;el('import-error').textContent='最多选五次更新，请先取消一条。';}
        el('milestone-summary').textContent=`回忆从这里开始 · 已选 ${Math.min(count,5)} 次更新`;
        previews();
        if(check.checked&&commit.changes===undefined&&next.repository)void run(async signal=>{await enrich([commit],next.repository!,signal);previews();});
      });
    }
    previews();
  }
  function render(next:Project){
    project=next;el('materials').hidden=false;el('materials-title').textContent=next.label+(next.private?' · 私有':'')+' · 项目材料';
    el('materials-count').textContent=next.files.length+' 份文本';el('materials-note').textContent=next.notes.join(' ')+(next.milestones?.length?' 所选 Git 提交和改动片段也会发送给 API；可展开下方回忆记录核对。':'');
    renderMilestones(next);
    el<HTMLDetailsElement>('material-details').open=false;el('materials-summary').textContent=`查看与调整 ${next.files.length} 份材料`;
    const list=el('material-list');list.replaceChildren();
    next.files.forEach((file,i)=>{
      const row=document.createElement('div');row.className='material-row';
      const check=document.createElement('input');check.type='checkbox';check.checked=true;check.id='material-'+i;
      const label=document.createElement('label');label.htmlFor=check.id;label.className='check';label.append(check,document.createTextNode(file.path+(file.truncated?' · 片段':'')));
      const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='查看将提交的内容';pre.textContent=file.text;details.append(summary,pre);row.append(label,details);list.append(row);
    });
    el('materials').scrollIntoView({block:'nearest',behavior:'instant'});
  }
  async function run(work:(signal:AbortSignal)=>Promise<void>){
    cancel();const current=new AbortController();controller=current;busy(true);el('import-error').textContent='';
    el('import-status').textContent='正在整理项目材料…';
    try{await work(current.signal);}catch(error){if(!current.signal.aborted)el('import-error').textContent=error instanceof Error?error.message:'读取失败，请重试。';}
    finally{if(controller===current){controller=null;busy(false);el('import-status').textContent='';el('api-service-status').hidden=true;}}
  }
  async function githubRequest(path:string,signal?:AbortSignal,method='GET'){
    const response=await fetch(path,{method,signal,headers:{'X-Project-Review':'1',...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:'{}'}:{})});
    let data;try{data=await response.json();}catch{throw new Error('本地服务没有响应，请重新启动事务所。');}
    if(!response.ok){if(response.status===401)void refreshGithubStatus();throw new Error(data.error||'GitHub 请求失败，请重试。');}
    return data;
  }
  async function refreshGithubStatus(){
    const state=el('github-account-state'),login=el<HTMLButtonElement>('github-login');
    if(location.protocol==='file:'){state.textContent='离线版仅支持公开仓库';login.hidden=true;return;}
    try{
      const data=await githubRequest('/api/github/status');
      state.textContent=!data.available?'需要 GitHub CLI':data.loggedIn?'GitHub 已连接':'尚未连接 GitHub';
      login.hidden=!data.available||data.loggedIn;
    }catch{state.textContent='本地服务未启动';login.hidden=true;}
  }
  for(const mode of ['folder','github','manual'])el('source-'+mode).addEventListener('click',()=>{
    cancel();el('import-error').textContent='';
    for(const tab of ['folder','github','manual'])el('source-'+tab).setAttribute('aria-pressed',String(mode===tab));
    el('folder-source').hidden=mode!=='folder';el('github-source').hidden=mode!=='github';el('input-form').hidden=mode!=='manual';
    if(mode==='github')void refreshGithubStatus();
  });
  el('cancel-import').addEventListener('click',()=>{cancel();el('import-status').textContent='已取消，之前的材料仍然保留。';});
  el('choose-folder').addEventListener('click',()=>{
    if(!supportsDirectoryPicker()){el<HTMLInputElement>('folder-files').click();return;}
    const picked=chooseDirectory();
    void run(async signal=>{try{const handle=await picked;signal.throwIfAborted();const next=await readDirectory(handle,signal);signal.throwIfAborted();render(next);}catch(error){if((error as Error).name!=='AbortError')throw error;}});
  });
  el<HTMLInputElement>('folder-files').addEventListener('change',event=>{
    const picker=event.target as HTMLInputElement,files=Array.from(picker.files||[]);if(!files.length)return;
    void run(async signal=>{const next=await readFolderFiles(files,signal);signal.throwIfAborted();render(next);picker.value='';});
  });
  async function loadRepo(name:string,signal:AbortSignal){
    el('import-status').textContent='正在读取仓库…';
    const next:Project=location.protocol==='file:'?await readRepository(name,signal):(await githubRequest('/api/github/repo?name='+encodeURIComponent(name),signal)).project;
    try{
      next.milestones=location.protocol==='file:'?await readCommitHistory(name,signal):(await githubRequest('/api/github/commits?name='+encodeURIComponent(name),signal)).commits;
    }catch(error){if(signal.aborted)throw error;next.notes.push('提交记录未读取成功；项目资料仍可照常使用。');}
    next.repository=name;
    await enrich(suggestedMilestones(next.milestones??[]),name,signal);
    signal.throwIfAborted();render(next);
  }
  el('github-source').addEventListener('submit',event=>{
    event.preventDefault();void run(async signal=>{
      const value=el<HTMLInputElement>('github-query').value.trim().replace(/^github\.com\//i,'https://github.com/'),name=repoName(value);
      const results=el('repository-results');results.replaceChildren();
      if(name){await loadRepo(name,signal);return;}
      const repos:{name:string;description:string;private?:boolean}[]=location.protocol==='file:'?await searchRepositories(value,signal):((await githubRequest('/api/github/search?q='+encodeURIComponent(value),signal)).repositories as {name:string;description:string;private:boolean}[]);signal.throwIfAborted();
      if(!repos.length){results.textContent='没有找到匹配的仓库。';return;}
      for(const repo of repos){const button=document.createElement('button'),title=document.createElement('strong'),description=document.createElement('span');button.type='button';title.textContent=repo.name+(repo.private?' · 私有':'');description.textContent=repo.description;button.append(title,description);button.addEventListener('click',()=>void run(s=>loadRepo(repo.name,s)));results.append(button);}
    });
  });
  el('github-login').addEventListener('click',()=>void run(async()=>{
    el('github-account-state').textContent='正在打开 GitHub 登录…';
    const data=await githubRequest('/api/github/login',undefined,'POST');
    el('github-account-state').textContent=data.loggedIn?'GitHub 已连接':'请在新窗口完成登录';
    if(data.loggedIn)await refreshGithubStatus();
  }));
  window.addEventListener('focus',()=>{if(!el('github-source').hidden)void refreshGithubStatus();});
  el('local-review').addEventListener('click',()=>void run(async signal=>{const snapshot=selected();if(project?.repository)await enrich(snapshot.milestones??[],project.repository,signal);signal.throwIfAborted();onConfirm({...localIdentity(snapshot),milestones:snapshot.milestones});}));
  el('analyze-text').addEventListener('click',()=>{
    try{
      const text=cleanText(el<HTMLTextAreaElement>('description').value.trim());
      if(!text)throw new Error('先粘贴一段项目说明，再交给 API 分析。');
      render({label:take(el<HTMLInputElement>('project-name').value.trim()||'我的项目',40),origin:'text',files:[{path:'项目说明.txt',text:take(text,6000),truncated:Array.from(text).length>6000}],notes:['以下是将发送的文字片段，请核对后点击分析。']});
    }catch(error){el('import-error').textContent=(error as Error).message;}
  });
  el('analyze-project').addEventListener('click',()=>void run(async signal=>{
    const snapshot=selected();
    if(location.protocol==='file:')throw new Error('API 分析需要本地服务：请双击同目录的“启动事务所.cmd”，然后在打开的页面选项目。当前离线页仍可手动整理。');
    if(!key.value.trim()&&!configured){el<HTMLDetailsElement>('api-settings').open=true;key.focus();throw new Error('先填写 DeepSeek API 密钥，再点“分析项目”。材料已保留。');}
    if(project?.repository)await enrich(snapshot.milestones??[],project.repository,signal);
    previews();
    const started=performance.now();
    let phase='connecting',characters=0;const deepseek=(()=>{try{return new URL(base.value).hostname==='api.deepseek.com';}catch{return false;}})();
    const status=document.createTextNode('正在等待 API 整理'),elapsed=document.createElement('span');
    elapsed.setAttribute('aria-hidden','true');el('import-status').replaceChildren(status,elapsed);
    const update=()=>{
      if(signal.aborted)return;
      const seconds=Math.floor((performance.now()-started)/1000);
      const labels:Record<string,string>={connecting:'正在连接 API',waiting:'API 已连接，等待档案正文',thinking:'模型正在思考',generating:'正在生成项目档案',validating:'正在核对原文引用',complete:'档案已整理'};
      const waiting=seconds>=45&&phase==='waiting';
      const message=waiting?`接口已连接，仍无正文；可能排队或服务异常，可取消稍后重试（最长 ${ANALYSIS_TIMEOUTS.total/60000} 分钟）`:labels[phase]||'正在等待 API';
      el('api-service-status').hidden=!(waiting&&deepseek);
      if(status.data!==message)status.data=message;
      elapsed.textContent=(seconds<90?` · ${seconds} 秒`:` · ${Math.floor(seconds/60)} 分 ${seconds%60} 秒`)+(characters?` · 已收到 ${characters} 字符`:'');
    };
    update();const ticker=window.setInterval(update,1000),stop=()=>window.clearInterval(ticker);
    signal.addEventListener('abort',stop,{once:true});
    try{
      const response=await fetch('/api/analyze',{method:'POST',signal,headers:{'Content-Type':'application/json','X-Project-Review':'1','Accept':'application/x-ndjson'},body:JSON.stringify({project:snapshot,base:base.value.trim(),model:model.value.trim(),key:key.value.trim()})});
      let data;
      if(response.headers.get('content-type')?.includes('application/x-ndjson')){
        for await(const line of responseLines(response)){
          signal.throwIfAborted();if(!line.trim())continue;const event=JSON.parse(line);
          if(event.error)throw new Error(event.error);
          if(event.stage){phase=event.stage;characters=event.characters||0;update();}
          if(event.identity)data=event;
        }
      }else try{data=await response.json();}catch{throw new Error('本地 API 服务连接中断或返回格式无效。材料已保留，请重试；持续失败请重新启动事务所。');}
      signal.throwIfAborted();
      if(!response.ok)throw new Error(data?.error||'分析失败，请重试。');
      if(!data?.identity?.facts)throw new Error('API 连接结束，但没有完整档案。材料已保留，请重试。');
      onConfirm({...data.identity,sourceFiles:snapshot.files.map(file=>({...file}))});
    }finally{stop();signal.removeEventListener('abort',stop);}
  }));
  key.addEventListener('input',()=>{el('api-status').textContent=key.value.trim()?'密钥已填 · 仅本次会话':configured?'本机已配置密钥':'待填写密钥';});
  base.addEventListener('input',()=>{configured=false;el('api-status').textContent=key.value.trim()?'密钥已填 · 仅本次会话':'接口已修改，请填写对应密钥';});
  if(location.protocol==='file:')el('api-help').textContent='当前是离线单文件版。使用 API 时，请双击同目录的“启动事务所.cmd”。文件夹读取和手动告别可直接使用。';
  else{
    const originalBase=base.value,originalModel=model.value;
    void fetch('/api/config').then(r=>r.json()).then(data=>{
      if(data.app!=='unfinished-office')return;
      if(base.value===originalBase&&model.value===originalModel){base.value=data.base;model.value=data.model;configured=Boolean(data.configured);}
      if(configured&&!key.value)el('api-status').textContent='本机已配置密钥';
    }).catch(()=>{el('api-help').textContent='如调用失败，请使用“启动事务所.cmd”开启完整服务。';});
  }
  return cancel;
}
