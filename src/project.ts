import { parseInput, suggestProp, take, type GitMilestone, type Identity } from './input.ts';

export type ProjectFile = { path: string; text: string; truncated: boolean };
export type Project = { label: string; origin: 'folder'|'github'|'text'; files: ProjectFile[]; notes: string[]; private?: boolean; repository?:string; milestones?:GitMilestone[] };
export const MAX_FILES = 12, MAX_TEXT = 30000, MAX_FILE_TEXT = 6000;
const ignored = /^(?:node_modules|vendor|dist|build|coverage|target|venv|__pycache__|\.git|\.next|\.cache|\.venv)$/i;
const sensitive = /(?:^|[._-])(?:env|secret|secrets|credentials|password|token|id_rsa|id_ed25519|private[_-]?key)(?:[._-]|$)|\.(?:pem|key|p12|pfx)$/i;
export function allowedPath(value: string): boolean {
  const parts=value.split('/');
  return value.length<=240 && !/[\\\u0000-\u001f:]/.test(value) && parts.every(part=>part && part!=='.' && part!=='..' && !part.startsWith('.') && !ignored.test(part) && !sensitive.test(part));
}
export function priority(value: string): number {
  if(!allowedPath(value))return 99;
  const name=value.split('/').at(-1)!;
  if(/^readme(?:\.[\w-]+)?\.(?:md|txt)$|^readme$/i.test(name))return value.includes('/')?2:0;
  if(/^(?:package.json|pyproject.toml|Cargo.toml|go.mod|composer.json|requirements.txt)$/i.test(value))return 1;
  if(/^(?:todo|plan|roadmap)\.(?:md|txt)$/i.test(name))return 3;
  if(/\.(?:ts|tsx|js|jsx|py|rs|go|php|vue|svelte|html|css)$/i.test(name) && !/\.min\.|\.d\.ts$|\.test\.|\.spec\./i.test(name))return 4;
  return 99;
}
export function cleanText(text: string): string {
  if(text.includes('\0') || /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(text))throw new Error('包含二进制或私钥内容，已跳过');
  return text.replace(/\b(?:sk-[a-zA-Z0-9_-]{12,}|gh[pousr]_[a-zA-Z0-9]{16,}|github_pat_[a-zA-Z0-9_]{16,})\b/g,'[已隐藏密钥]')
    .replace(/((?:api[_-]?key|access[_-]?token|secret|password|authorization)["']?\s*[:=]\s*)(["'])([^\r\n]*?)\2/gi,'$1$2[已隐藏]$2')
    .replace(/((?:api[_-]?key|access[_-]?token|secret|password)\s*=\s*)[^\s"']+/gi,'$1[已隐藏]');
}
export function normalizeMilestones(value:unknown,repository?:string):GitMilestone[]{
  if(!Array.isArray(value))return [];
  const seen=new Set<string>();
  return value.slice(0,40).flatMap(commit=>{
    const sha=String(commit?.sha||''),raw=String(commit?.subject||commit?.commit?.message||'').split(/\r?\n/,1)[0],date=String(commit?.committedAt||commit?.date||commit?.commit?.committer?.date||commit?.commit?.author?.date||'');
    if(!/^[a-f\d]{7,40}$/i.test(sha)||!raw.trim()||seen.has(sha))return [];
    const parsed=Date.parse(date),subject=take(cleanText(raw.trim()).replace(/[\u0000-\u001f\u007f]/g,' '),180).trim();
    if(!subject||!Number.isFinite(parsed))return [];
    seen.add(sha);
    const name=repository||commit.repository,repo=typeof name==='string'&&/^[\w.-]+\/[\w.-]+$/.test(name)&&!name.split('/').some(p=>p==='.'||p==='..')?name:undefined;
    const author=typeof commit.author==='string'?commit.author:commit.commit?.author?.name;
    const coauthors=Array.isArray(commit.coauthors)?commit.coauthors:String(commit.commit?.message||'').split(/\r?\n/).flatMap(line=>line.match(/^Co-authored-by:\s*(.+?)\s*<[^>]+>\s*$/i)?.[1]??[]);
    const item:GitMilestone={sha:sha.toLowerCase(),subject,date:new Date(parsed).toISOString().slice(0,10),committedAt:new Date(parsed).toISOString(),...(repo?{repository:repo}:{})};
    if(typeof author==='string'&&author.trim())item.author=take(cleanText(author).replace(/[<>\u0000-\u001f]/g,' ').trim(),80);
    if(coauthors.length)item.coauthors=[...new Set<string>(coauthors.filter((v:unknown)=>typeof v==='string').map((v:string)=>take(cleanText(v).replace(/<[^>]*>/g,'').trim(),80)))].filter(Boolean).slice(0,8);
    const changes=commit.changes??commit.files;
    if(Array.isArray(changes)){
      item.changes=changes.filter(file=>typeof (file?.path??file?.filename)==='string'&&allowedPath(file.path??file.filename)).slice(0,3).flatMap(file=>{
        try{const raw=typeof file.patch==='string'?cleanText(file.patch):'';return [{path:file.path??file.filename,status:['added','modified','removed','renamed','copied'].includes(file.status)?file.status:'changed',patch:take(raw,1000),truncated:Boolean(file.truncated)||Array.from(raw).length>1000}];}catch{return [];}
      });
      item.limited=Boolean(commit.limited)||changes.length!==item.changes.length||item.changes.some(file=>file.truncated||!file.patch);
    }
    return [item];
  });
}
export function suggestedMilestones(commits:GitMilestone[]):GitMilestone[]{
  const ordered=[...commits].sort((a,b)=>(a.committedAt||a.date).localeCompare(b.committedAt||b.date));
  return ordered.length<=5?ordered:Array.from({length:5},(_,i)=>ordered[Math.round(i*(ordered.length-1)/4)]);
}
export function commitUrl(commit:GitMilestone):string|null{
  const repo=commit.repository;
  return repo&&/^[\w.-]+\/[\w.-]+$/.test(repo)&&!repo.split('/').some(p=>p==='.'||p==='..')&&/^[a-f\d]{7,40}$/i.test(commit.sha)?`https://github.com/${repo}/commit/${commit.sha}`:null;
}
type Candidate = {path:string;getFile:()=>Promise<File>};
async function collect(label:string,candidates:Candidate[],notes:string[],signal:AbortSignal):Promise<Project>{
  const files:ProjectFile[]=[];let remaining=MAX_TEXT;
  candidates.sort((a,b)=>priority(a.path)-priority(b.path)||a.path.localeCompare(b.path));
  let skipped=0;
  for(const candidate of candidates){
    signal.throwIfAborted();
    if(priority(candidate.path)===99)continue;
    if(files.length>=MAX_FILES || remaining<=0){skipped++;continue;}
    try{
      const file=await candidate.getFile();signal.throwIfAborted();
      if(file.size>256*1024){skipped++;continue;}
      const raw=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());signal.throwIfAborted();
      const cleaned=cleanText(raw),text=take(cleaned,Math.min(MAX_FILE_TEXT,remaining));
      if(!text.trim())continue;
      files.push({path:candidate.path,text,truncated:text.length<cleaned.length});remaining-=Array.from(text).length;
    }catch(error){if(signal.aborted)throw error;skipped++;}
  }
  if(skipped)notes.push(`${skipped} 份候选文件因大小、数量、编码或安全限制未读取。`);
  if(files.some(f=>f.truncated))notes.push('较长文件只取开头片段；未读取部分不能据此判断。');
  if(!files.length)throw new Error('没有找到可用的说明或源码文本。请改选项目根文件夹，或粘贴介绍。');
  return {label:take(label,40),origin:'folder',files,notes};
}
interface DirectoryHandle {kind:'directory';name:string;values():AsyncIterable<DirectoryHandle|{kind:'file';name:string;getFile():Promise<File>}>}
export async function readDirectory(handle:DirectoryHandle,signal:AbortSignal):Promise<Project>{
  const candidates:Candidate[]=[],notes:string[]=[];let visited=0;
  async function walk(dir:DirectoryHandle,prefix='',depth=0):Promise<void>{
    const directories:{handle:DirectoryHandle;path:string}[]=[];
    for await(const entry of dir.values()){
      signal.throwIfAborted();if(++visited>1500)return;
      const name=prefix+entry.name;if(!allowedPath(name))continue;
      if(entry.kind==='file'&&priority(name)<99)candidates.push({path:name,getFile:()=>entry.getFile()});
      else if(entry.kind==='directory'&&depth<3)directories.push({handle:entry,path:name+'/'});
    }
    for(const child of directories){if(visited>=1500)break;await walk(child.handle,child.path,depth+1);}
  }
  await walk(handle);
  if(visited>1500)notes.push('目录较大，仅查看前 1,500 个条目。建议选择更具体的项目子目录。');
  notes.push('读取根目录及最多三层子目录中的少量资料，不执行代码，也不检查整个项目。');
  return collect(handle.name,candidates,notes,signal);
}
export function supportsDirectoryPicker():boolean{return 'showDirectoryPicker' in window;}
export async function chooseDirectory():Promise<DirectoryHandle>{
  return (window as unknown as {showDirectoryPicker(options:{mode:string}):Promise<DirectoryHandle>}).showDirectoryPicker({mode:'read'});
}
export async function readFolderFiles(files:File[],signal:AbortSignal):Promise<Project>{
  if(files.length>10000)throw new Error('这个文件夹过大，请选择具体的项目子目录。');
  const root=files[0]?.webkitRelativePath.split('/')[0]||'本地项目';
  return collect(root,files.map(file=>({path:file.webkitRelativePath.split('/').slice(1).join('/'),getFile:async()=>file})),['只读取所选文件夹中的少量文本，不执行代码。'],signal);
}
export function localIdentity(project:Project):Identity{
  const readme=project.files.find(f=>/^readme/i.test(f.path.split('/').at(-1)!));
  const result=parseInput('',readme?.text||'','readme');
  result.sourceFiles=project.files.map(file=>({...file}));
  if(!result.facts.name.value)result.facts.name={value:project.label,source:'project',evidence:'所选项目名称',confirmed:false};
  result.facts.name.value=take(result.facts.name.value,40);
  if(readme?.truncated){result.facts.completed={value:'',source:null,evidence:'',confirmed:false};result.facts.unfinished={value:'',source:null,evidence:'',confirmed:false};}
  result.prop=suggestProp(take(project.files.map(file=>`${file.path}\n${file.text}`).join('\n'),12000));
  const manifest=project.files.find(file=>file.path==='package.json');
  if(manifest&&!manifest.truncated){
    try{
      const config=JSON.parse(manifest.text),deps={...config.dependencies,...config.devDependencies};
      result.keywords=Object.keys(deps).filter(name=>/^(react|vue|svelte|next|vite|typescript|express|@angular\/core)$/.test(name)).slice(0,3).map(name=>({category:'tech' as const,text:name,evidence:'package.json · '+name}));
    }catch{/* A partial or invalid manifest is not evidence of a technology choice. */}
  }
  return result;
}

async function github(path:string,signal:AbortSignal):Promise<any>{
  try{
  const response=await fetch('https://api.github.com'+path,{signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),headers:{Accept:'application/vnd.github+json'}});
  if(!response.ok)throw new Error(response.status===404?'没有找到公开仓库或 README；私有仓库请改选本地文件夹。':response.status===403||response.status===429?'GitHub 请求受限，请稍后重试或改选本地文件夹。':'GitHub 暂时无法读取，请重试或粘贴 README。');
  const reader=response.body?.getReader();if(!reader)throw new Error('GitHub 返回了空响应。');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024){await reader.cancel();throw new Error('GitHub 返回内容过大，请改选本地项目。');}chunks.push(value);}
  return JSON.parse(await new Blob(chunks as BlobPart[]).text());
  }catch(error){
    if(signal.aborted)throw error;
    if((error as Error).name==='TimeoutError')throw new Error('GitHub 读取超过 20 秒，请重试或选择本地文件夹。');
    if(error instanceof TypeError)throw new Error('无法连接 GitHub，请检查网络，或选择本地文件夹。');
    throw error;
  }
}
export function repoName(value:string):string|null{
  const input=value.trim();
  if(/^https?:\/\//i.test(input)){
    const url=new URL(input);
    if(url.origin!=='https://github.com'||url.search||url.hash||url.username||url.password)throw new Error('请使用 https://github.com/用户名/仓库名 这样的公开仓库根链接。');
    const name=url.pathname.replace(/^\/|\/$/g,'').replace(/\.git$/,'');
    if(!/^[\w.-]+\/[\w.-]+$/.test(name)||name.split('/').some(p=>p==='.'||p==='..'))throw new Error('请使用仓库首页链接，不要使用文件、分支或议题链接。');
    return name;
  }
  return /^[\w.-]+\/[\w.-]+$/.test(input)&&!input.split('/').some(p=>p==='.'||p==='..')?input:null;
}
export function githubProject(valid:string,meta:any,readme:any,authenticated=false):Project{
  const label=take(String(meta.name||valid.split('/')[1]),40);
  const files:ProjectFile[]=[{path:'仓库信息.txt',text:cleanText(`名称：${label}\n公开介绍：${take(String(meta.description||'未说明'),1000)}\n主要语言：${take(String(meta.language||'未说明'),80)}`),truncated:false}];
  const notes=[authenticated?'已通过 GitHub 登录读取；发送前可逐项勾选资料。':'仅使用公开仓库介绍与 README；未检查源码或运行项目。'];
  if(readme&&readme.encoding==='base64'&&typeof readme.content==='string'){
    try{
      const raw=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(readme.content.replace(/\s/g,'')),c=>c.charCodeAt(0)));
      const cleaned=cleanText(raw),text=take(cleaned,MAX_FILE_TEXT);files.push({path:'README.md',text,truncated:text.length<cleaned.length});
      if(text.length<cleaned.length)notes.push('README 较长，只使用前 6,000 字。');
    }catch{notes.push('README 无法解码，只保留仓库元信息。');}
  }else notes.push('README 未读取成功，只保留仓库元信息。');
  return {label,origin:'github',files,notes,private:Boolean(meta.private),repository:valid};
}
export async function searchRepositories(query:string,signal:AbortSignal):Promise<{name:string;description:string}[]>{
  if(!query.trim()||query.length>200)throw new Error('输入仓库名、关键词，或 user:用户名 来查找公开仓库。');
  const data=await github('/search/repositories?per_page=6&q='+encodeURIComponent(query.trim()),signal);
  return (data.items||[]).filter((item:any)=>typeof item.full_name==='string'&&repoName(item.full_name)).slice(0,6).map((item:any)=>({name:item.full_name,description:take(String(item.description||'暂无介绍'),160)}));
}
export async function readCommitHistory(name:string,signal:AbortSignal):Promise<GitMilestone[]>{
  const valid=repoName(name);if(!valid)throw new Error('仓库名称格式无效。');
  const data=await github('/repos/'+valid.split('/').map(encodeURIComponent).join('/')+'/commits?per_page=40',signal);
  return normalizeMilestones(data,valid);
}
export async function readCommit(name:string,sha:string,signal:AbortSignal):Promise<GitMilestone>{
  const valid=repoName(name);if(!valid||!/^([a-f\d]{40})$/i.test(sha))throw new Error('提交地址无效。');
  const data=await github('/repos/'+valid.split('/').map(encodeURIComponent).join('/')+'/commits/'+sha,signal);
  const commit=normalizeMilestones([data],valid)[0];
  if(!commit||commit.sha!==sha.toLowerCase())throw new Error('提交记录不匹配，请重新读取。');
  return commit;
}
export async function readRepository(name:string,signal:AbortSignal):Promise<Project>{
  const valid=repoName(name);if(!valid)throw new Error('仓库名称格式无效。');
  const base='/repos/'+valid.split('/').map(encodeURIComponent).join('/');
  const meta=await github(base,signal);
  if(meta.private)throw new Error('请在本地服务登录后读取你有权限访问的仓库。');
  let readme;
  try{
    readme=await github(base+'/readme',signal);
  }catch(error){if(signal.aborted)throw error;}
  return githubProject(valid,meta,readme);
}
