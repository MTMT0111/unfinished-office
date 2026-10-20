import type { Identity } from './input.ts';
import type { Journey } from './game.ts';
import { commitUrl } from './project.ts';

export const relicPlaces={keep:{label:'珍藏',detail:'留给自己，记住做成这一步的你。',symbol:'✦'},pass:{label:'交接',detail:'留给后来的人，让经验接着走。',symbol:'↗'},rest:{label:'暂存',detail:'先收在书架，今天不用决定它的以后。',symbol:'▰'}};
type Place=keyof typeof relicPlaces;
export function relicFiles(identity:Identity,index:number){
  if(index<0||index>4)return [];
  const commit=identity.milestones?.[index];
  if(commit)return (commit.changes??[]).map(file=>({path:file.path,text:file.patch,patch:true,truncated:file.truncated}));
  return index===0&&!identity.milestones?.length?(identity.sourceFiles??[]).slice(0,3).map(file=>({...file,patch:false})):[];
}
export function patchExcerpt(patch:string,side:'before'|'after'):string {
  return patch.split(/\r?\n/).flatMap(line=>{
    if(line.startsWith('@@'))return ['⋯ 改动区块 ⋯'];
    if(line.startsWith('+++')||line.startsWith('---')||line.startsWith('\\'))return [];
    if(line.startsWith(side==='before'?'+':'-'))return [];
    return /^[ +\-]/.test(line)?[line.slice(1)]:[];
  }).join('\n').trim()||'这份差异片段没有提供这一侧的文本。';
}
export function relicRows(identity:Identity,journey:Journey){
  return [...new Set(journey.visited)].flatMap(index=>{
    const choice=journey.relics?.[index];
    if(!choice||!Object.hasOwn(relicPlaces,choice.place)||!relicFiles(identity,index).some(file=>file.path===choice.path))return [];
    const commit=identity.milestones?.[index];
    return [{index,...choice,label:relicPlaces[choice.place].label,note:journey.notes[index]??'',subject:commit?.subject??'带来的项目原件',source:commit?`${commit.date} · ${commit.sha}`:'本次带来的原文',url:commit?commitUrl(commit):null}];
  });
}
export function handoverMarkdown(identity:Identity,journey:Journey):string {
  const text=(value:string)=>value.replace(/[\\`*_{}\[\]<>#!|]/g,'\\$&');
  const rows=relicRows(identity,journey);
  return `# ${text(identity.facts.name.value)} · 项目行李清单\n\n这是本次旅程中亲手选择的片段，不是完整仓库归档，也不代表功能已验证。\n\n`+
    (rows.length?rows.map(row=>`## ${row.label} · ${text(row.path)}\n\n${text(row.subject)}\n\n来源：${text(row.source)}${row.url?`\n\n原始提交：${row.url}`:''}\n\n${row.note?`我的补记：${text(row.note)}\n\n`:''}${row.place==='pass'?'交接提醒：请在原仓库核对完整代码、依赖与运行方式；这份清单没有修改或关闭任何仓库事项。\n\n':''}`).join(''):'这次没有选择项目遗物，先留白。\n\n')+
    (journey.farewellNote?`## 留给项目的短信\n\n${text(journey.farewellNote)}\n`:``);
}

export function renderRelicDesk(root:HTMLElement,identity:Identity,journey:Journey,index:number,onChange:()=>void,reduced:()=>boolean){
  const files=relicFiles(identity,index);root.replaceChildren();root.hidden=!files.length||!journey.visited.includes(index);if(root.hidden)return;
  const heading=document.createElement('h3');heading.textContent='亲手收好这一件';
  const hint=document.createElement('p');hint.className='note';hint.textContent='每站选一件真实文件，决定它在这段旅程中的去处。可以改选，也可以留白；不会更改 GitHub 文件。';
  const label=document.createElement('label');label.htmlFor='relic-file';label.textContent='这次更新，哪一件最让你在意？';
  const select=document.createElement('select');select.id='relic-file';
  for(const file of files){const option=document.createElement('option');option.value=file.path;option.textContent=file.path;select.append(option);}
  select.value=journey.relics?.[index]?.path??files[0].path;
  if(select.selectedIndex<0)select.selectedIndex=0;
  const card=document.createElement('div');card.className='relic-card';
  const seal=document.createElement('span');seal.className='relic-seal';seal.setAttribute('aria-hidden','true');
  const tabs=document.createElement('div');tabs.className='relic-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','查看改动片段');
  const pre=document.createElement('pre');pre.className='source-preview';pre.tabIndex=0;pre.setAttribute('aria-label','所选文件的内容片段');
  const limit=document.createElement('small');limit.className='source';
  const actions=document.createElement('div');actions.className='relic-shelves';
  const status=document.createElement('p');status.className='note';status.setAttribute('role','status');
  const clear=document.createElement('button');clear.type='button';clear.className='quiet';clear.textContent='暂不选择';
  let side:'before'|'after'='after';
  function refresh(){
    const file=files.find(file=>file.path===select.value)!;
    const saved=journey.relics?.[index],current=saved?.path===file.path?saved:undefined;
    pre.textContent=file.patch?patchExcerpt(file.text,side):file.text;tabs.hidden=!file.patch;
    limit.textContent=file.patch?`提交中提供的改动片段，不是完整文件${file.truncated?' · 已截短':''}。`:`本次带来的项目原文${file.truncated?' · 片段':''}。`;
    for(const button of tabs.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.side===side));
    for(const button of actions.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.relicPlace===current?.place));
    card.dataset.place=current?.place??'';seal.textContent=current?relicPlaces[current.place].symbol:'◇';
    status.textContent=current?`已${relicPlaces[current.place].label}「${file.path}」。${relicPlaces[current.place].detail} 可以在下方“补记那一天”留下原因。`:saved?`本页已${relicPlaces[saved.place].label}「${saved.path}」；选择新去处会替换。`:'还没有决定去处，也可以先继续旅程。';
    clear.hidden=!saved;
  }
  for(const [value,title] of [['before','改动前片段'],['after','改动后片段']] as const){const button=document.createElement('button');button.type='button';button.textContent=title;button.dataset.side=value;button.addEventListener('click',()=>{side=value;refresh();});tabs.append(button);}
  for(const place of Object.keys(relicPlaces) as Place[]){
    const button=document.createElement('button');button.type='button';button.dataset.relicPlace=place;button.textContent=relicPlaces[place].symbol+' '+relicPlaces[place].label;
    button.addEventListener('click',()=>{
      (journey.relics??={})[index]={path:select.value,place};refresh();onChange();
      if(!reduced())seal.animate([{transform:'translateY(-10px) scale(1.3)',opacity:.2},{transform:'translateY(0) scale(1)',opacity:1}],{duration:450,easing:'ease-out'});
    });actions.append(button);
  }
  select.addEventListener('change',refresh);clear.addEventListener('click',()=>{delete journey.relics?.[index];refresh();onChange();});
  card.append(seal,tabs,pre,limit);root.append(heading,hint,label,select,card,actions,status,clear);refresh();
}
