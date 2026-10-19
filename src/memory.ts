import { count, fields, fiction, sourceLabel, take, type Identity, type Field } from './input.ts';
import type { Journey } from './game.ts';
import { dossier } from './dossier.ts';
import { diaryLines } from './journal.ts';
import { commitUrl } from './project.ts';

export const keepsakes=[
  {name:'火花',caption:'带上最初的念头'},
  {name:'叶片',caption:'已经做出的，也一起带走'},
  {name:'小钥匙',caption:'那些摸索，也算数'},
  {name:'齿轮',caption:'把这次更新的两处改动接在一起'},
  {name:'信封',caption:'有些话，留给它'},
  {name:'留白页',caption:'没写完的，先留在这一页'},
  {name:'车票',caption:'这一程，有你陪它'},
];
export const memoryTitles=['最初的念头','留下的东西','一起折腾过','屋顶那次更新','回声工坊的更新','还没写完的那页','和它说再见'];
export const resolutionText={shelf:'先把这一页收在书架，作为这次同行留下的记录。',carry:'把这一页放进行李，留给下一程继续接手。'};
export function keepsakeTopic(identity:Identity,index:number):{text:string;source:string;keyword:boolean}{
  const commit=index<5?identity.milestones?.[index]:undefined;
  if(commit){
    const changes=commit.changes??[],content=[commit.subject,...(commit.diary??[]).map(entry=>entry.text),...changes.map(file=>file.patch??'')].join('\n').toLocaleLowerCase();
    const match=(identity.keywords??[]).map(keyword=>({keyword,file:changes.find(file=>keyword.evidence.startsWith(`${file.path}：`)||keyword.evidence.startsWith(`${file.path}:`))})).filter(item=>item.file||content.includes(item.keyword.text.toLocaleLowerCase())).sort((a,b)=>Number(Boolean(b.file))-Number(Boolean(a.file)))[0];
    if(match)return {text:match.keyword.text,source:`项目关键词 · ${match.file?.path??'与本次提交内容相符'}`,keyword:true};
    return {text:commit.subject,source:`GitHub 提交 · ${commit.sha.slice(0,7)}`,keyword:false};
  }
  const keyword=identity.keywords?.[index];
  if(keyword)return {text:keyword.text,source:`项目关键词 · ${keyword.evidence.split(/[：:]/,1)[0]||'已选资料'}`,keyword:true};
  const field:Field|undefined=({0:'purpose',1:'completed',2:'completed',3:'completed',4:'unfinished'} as Record<number,Field>)[index],fact=field&&identity.facts[field];
  if(fact?.value&&fact.confirmed&&fact.source)return {text:fact.value,source:sourceLabel(identity,fact),keyword:false};
  return {text:keepsakes[index]?.name??'旅途物件',source:'旅途物件的象征',keyword:false};
}
export function keepsakeStory(identity:Identity,index:number,journey:Journey){
  const topic=keepsakeTopic(identity,index),story=memoryStory(identity,index,journey);
  return {...story,topic,lines:[topic.keyword?`这件物品收着项目关键词「${topic.text}」。`:`这件物品对应这一页的主题：「${topic.text}」。`,...story.lines],source:`${topic.source} · ${story.source}`};
}
export function chapterCargo(identity:Identity,index:number):{label:string;text:string;detail:string;source:string}{
  const commit=index<5?identity.milestones?.[index]:undefined;
  if(commit)return {label:`回看 ${commit.date} 的更新`,text:commit.subject,detail:diaryLines(commit).join('\n\n'),source:`GitHub · ${commit.sha.slice(0,7)}${commit.diary?.length?' · 解读请核对':''}`};
  if(index===5&&identity.regret){
    const fact=identity.facts.unfinished,detail=fact.value&&fact.confirmed&&fact.source?`${identity.regret}\n\n项目资料也记下：${fact.value}`:identity.regret;
    return {label:'你还惦记的',text:identity.regret,detail,source:'你写下的遗憾'};
  }
  const field:Field=index===0?'purpose':index===5?'unfinished':'completed',fact=identity.facts[field];
  const label=field==='purpose'?'带上这个念头':field==='completed'?'把它收好':'这张留白页';
  if(!fact.value||!fact.source||!fact.confirmed)return {label,text:'留一格，给你的项目',detail:'项目资料没有说明，先留白。',source:'未说明'};
  const category=field==='purpose'?'purpose':field==='completed'?'built':'next';
  return {label,text:dossier(identity).filter(k=>k.category===category).slice(0,2).map(k=>k.text).join(' · ')||fact.value,detail:fact.value,source:sourceLabel(identity,fact)};
}
export function parcelContents(identity:Identity,index:number,total:number,carry=false):ReturnType<typeof chapterCargo>[] {
  const chapter=index===6&&carry?5:index,base=chapterCargo(identity,chapter);
  const commit=index<5?identity.milestones?.[index]:undefined;
  if(commit)return Array.from({length:total},(_,i)=>{
    const file=commit.changes?.[i];
    return file?{...base,text:file.path,detail:commit.diary?.find(entry=>entry.path===file.path)?.text||`这次更新涉及 ${file.path}。实际差异会保存在这一页日记中。`}:i===0?base:{label:'留白',text:'未摘录的片段',detail:'这次只带上已读取的改动，不补写未知内容。',source:'未说明'};
  });
  const category=chapter===0?'purpose':chapter===5?'next':'built';
  const tags=base.source==='未说明'?[]:chapter===5&&identity.regret?[identity.regret]:dossier(identity).filter(k=>k.category===category).map(k=>k.text);
  return Array.from({length:total},(_,i)=>tags[i]?{...base,text:tags[i]}:{label:'留一格',text:'尚未命名的片段',detail:'资料没有说明这一件，先留白。',source:'未说明'});
}
export function validateNextStep(value:string):string {
  const text=value.trim();if(count(text)>60)throw new Error('写一件小事，60 字以内就好。');return text;
}
export function recollection(identity:Identity,index:number,journey:Journey):{title:string;text:string;source:string;empty:boolean}{
  const title=memoryTitles[index],note=journey.notes[index]?.trim();
  if(note)return {title,text:note,source:'你写下的回忆',empty:false};
  if(index===5&&identity.regret)return {title,text:identity.regret,source:'你写下的遗憾',empty:false};
  const field:Field|undefined=({0:'purpose',1:'completed',5:'unfinished'} as Record<number,Field>)[index];
  if(field){const fact=identity.facts[field];if(fact.value&&fact.confirmed&&fact.source)return {title,text:fact.value,source:sourceLabel(identity,fact),empty:false};}
  if(index===5&&journey.resolution){const fact=identity.facts.unfinished;if(fact.value&&fact.confirmed&&fact.source)return {title,text:fact.value,source:sourceLabel(identity,fact),empty:false};}
  if(index===2&&identity.facts.name.confirmed){
    const review=identity.review?.items[0];
    if(review)return {title,text:review.text,source:'项目结构线索 · 引用可核对',empty:false};
    const tags=identity.keywords?.filter(k=>k.category==='tech')??[];
    if(tags.length)return {title,text:tags.map(k=>k.text).join(' · '),source:'项目资料中的工具',empty:false};
  }
  if(index===4){const item=identity.review?.items[1]??identity.review?.items[0];if(item)return {title,text:item.text,source:'项目结构线索 · 引用可核对',empty:false};}
  return {title,text:['那个最初的念头，你还记得吗？','哪一点进展，曾让你开心过？','有没有一个一起折腾的小瞬间？','那次改动之后，项目又往前走了什么？','这次更新，怎样接上了前面的工作？','这一页，想把它留在哪里？','一起走到这里。'][index],source:'留给你来写',empty:true};
}
export function rememberedPage(identity:Identity,journey:Journey,index=journey.bookmark):{index:number;title:string;source:string;date?:string}|null{
  if(index===undefined||!Number.isInteger(index)||index<0||index>5||!journey.visited.includes(index))return null;
  const commit=index<5?identity.milestones?.[index]:undefined;
  if(commit)return {index,title:commit.subject,source:`${commit.author||'作者未提供'} · GitHub ${commit.sha.slice(0,7)}`,date:commit.date};
  const item=recollection(identity,index,journey);
  return item.empty?null:{index,title:item.text,source:item.source};
}
export function farewellLines(identity:Identity,journey:Journey):{memory:string;choice:string;luggage:string;signal:string;closing:string}{
  const page=rememberedPage(identity,journey),unfinished=chapterCargo(identity,5),topic=[...journey.memories].reverse().map(index=>keepsakeTopic(identity,index)).find(item=>item.source!=='旅途物件的象征');
  const topicText=topic?`${take(topic.text,28)}${count(topic.text)>28?'…':''}`:undefined;
  const luggage=journey.memories.length?`这一路收好的 ${journey.memories.length} 件旅途物件${topicText?`，也留着「${topicText}」这条线索`:'，也都在这里'}。`:'今天没有收起行李，也不用勉强。';
  return {
    memory:page?`你想留下的这一页：「${page.title}」`:'这段路，我们先走到这里。',
    choice:journey.resolution==='carry'?(unfinished.source==='未说明'?'留白页，留给下一站。':`留给下一站：「${unfinished.text}」`):journey.resolution==='shelf'?(unfinished.source==='未说明'?'还没写完的，先留在书架。':`先收在书架：「${unfinished.text}」`):'还没决定的，可以慢慢想。',
    luggage,
    signal:`替「${identity.facts.name.value||'这个项目'}」留下最后一句：${fiction(identity).finale}`,
    closing:journey.skipped?'今天先到这里。谢谢你来陪我，再见。':'谢谢你陪我走到这里。再见。',
  };
}
export function memoryStory(identity:Identity,index:number,journey:Journey):{title:string;scene:string;lines:string[];source:string;milestone:boolean;step:number;empty:boolean}{
  const item=recollection(identity,index,journey),milestones=identity.milestones??[],milestone=index<5?milestones[index]:undefined;
  const project=identity.facts.name.value||'这个项目';
  if(milestone){
    const note=journey.notes[index]?.trim();
    return {title:milestone.subject,scene:`${milestone.date.replaceAll('-',' / ')} · 第 ${index+1} 页`,lines:[
      ...diaryLines(milestone),...(note?[`你的补记：${note}`]:[]),
    ],source:`GitHub · ${milestone.sha.slice(0,7)}${milestone.diary?.length?' · 依据改动整理，请核对':' · 提交记录原文'}`,milestone:true,step:index+1,empty:false};
  }
  if(index===6){
    const words=farewellLines(identity,journey),page=rememberedPage(identity,journey);
    const last=milestones.slice(0,5).filter((_,i)=>journey.visited.includes(i)).at(-1),completed=identity.facts.completed;
    const kept=page?words.memory:last?`我们回看过 ${last.date} 的「${last.subject}」。`:completed.confirmed&&completed.value?`你确认留下的部分是：${completed.value}`:'这段路，我们先走到这里。';
    return {title:memoryTitles[6],scene:'夜间送别站 · 最后一幕',lines:[kept,words.choice,...(journey.notes[6]?[`你的补记：${journey.notes[6]}`]:[]),`和「${project}」说再见，等你亲手关灯。`],source:'你确认的资料与选择 · 此刻的告别',milestone:false,step:0,empty:false};
  }
  if(index===5){
    const note=journey.notes[5]?.trim(),fact=identity.facts.unfinished,confirmed=fact.value&&fact.confirmed&&fact.source;
    const lines=[...(confirmed?[`项目资料里记着：${fact.value}`]:[]),...(identity.regret?[`你还惦记：「${identity.regret}」`]:[]),...(note?[`你的补记：${note}`]:[])];
    return {title:memoryTitles[5],scene:'留白书库 · 由你决定去处',lines:lines.length?lines:[item.text],source:confirmed?'项目资料回看 · 你写下的遗憾':item.source,milestone:false,step:0,empty:item.empty&&!confirmed&&!identity.regret&&!note};
  }
  const lines=item.empty?[item.text]:[item.source==='你写下的回忆'||item.source==='你写下的遗憾'?`你写下：${item.text}`:`${['我的资料里，最初的用途是','资料记下了已经留下的部分','这份材料还保留了一个具体线索','资料里的未完成部分是','这次更新留下的结构线索是','你还惦记的部分是'][index]}：${item.text}`];
  return {title:item.title,scene:identity.demo?'样例资料 · 没有 Git 时间线':'资料回看 · 日期未记录',lines,source:item.source,milestone:false,step:0,empty:item.empty};
}

export function memoryBookHtml(identity:Identity,journey:Journey,cover:string):string{
  const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  // Only the locally rendered PNG is allowed in the offline booklet.
  if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(cover))throw new Error('回忆画面没有生成，请重试。');
  const title=escape(identity.facts.name.value),facts=fields.filter(k=>{const f=identity.facts[k];return f.value&&f.confirmed&&f.source;});
  const remembered=rememberedPage(identity,journey);
  const bookmark=remembered?`<aside class="bookmark"><small>你想留下的这一页</small><p><a href="#memory-${remembered.index}">${escape(remembered.title)}</a></p><small>${escape((remembered.date?remembered.date+' · ':'')+remembered.source)}</small></aside>`:'';
  const labels={name:'名字',purpose:'最初的念头',completed:'已经留下',unfinished:'暂时留白',reason:'你留的话'};
  const nextStep=journey.resolution==='carry'&&journey.visited.includes(6)?validateNextStep(journey.nextStep):'';
  const pages=journey.visited.map(i=>{
    const story=memoryStory(identity,i,journey),commit=i<5?identity.milestones?.[i]:undefined,url=commit?commitUrl(commit):null;
    const proof=commit?`<details><summary>这页的提交证据</summary><div class="inside">${url?`<p><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">GitHub 原始提交 ↗</a></p>`:''}<small>Git 提交日期 · UTC；最多摘录三个文件，不代表运行结果。${commit.diary?.length?'日记解读由 API 整理，请核对语义。':''}</small>${(commit.changes??[]).map(file=>`<p>${escape(file.path)} · ${escape(file.status)}</p><pre>${escape(file.patch||'没有可展示的差异片段')}</pre>`).join('')}</div></details>`:'';
    return `<details class="memory" id="memory-${i}"${i===(remembered?.index??journey.visited[0])?' open':''}><summary><span class="number">${String(i+1).padStart(2,'0')}</span><span>${escape(story.title)}</span><small>${i===remembered?.index?'夹着书签':journey.memories.includes(i)?escape(keepsakes[i].name):'留一格空白'}</small></summary><div class="inside">${i===5&&journey.resolution?`<p>${resolutionText[journey.resolution]}</p><small>你在书库里作出的选择</small>`:''}<div class="story">${story.lines.map(line=>`<p>${escape(line)}</p>`).join('')}</div><small>${escape(story.source)}</small>${proof}${i===6&&nextStep?`<blockquote>${escape(nextStep)}</blockquote><small>下次，只做这一件 · 你留给自己的便签</small>`:''}${story.milestone?'':story.lines.length&&recollection(identity,i,journey).empty&&!journey.notes[i]?.trim()?'<p class="blank">这页还可以添一句你自己的故事。</p>':''}</div></details>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${title} · 同行回忆册</title><style>
pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;padding:10px;background:#182230}a{color:#9fd4ea}summary>span{min-width:0;overflow-wrap:anywhere}
.bookmark{border-left:3px solid #efc785;background:#203246;padding:14px 18px;margin:20px 0}.bookmark p{font-size:16px}.bookmark a{text-decoration:none}.bookmark small{font-size:11px}
*{box-sizing:border-box}body{margin:0;background:#171d2d;color:#eee1c5;font:16px/1.8 "Microsoft YaHei",sans-serif}main{max-width:768px;margin:auto;padding:32px 18px 64px}header{text-align:center;padding:8px 0 28px}h1{font-size:24px;font-weight:500;overflow-wrap:anywhere;margin:8px 0}small{font-size:11px;color:#a9b8bc}img{display:block;width:100%;image-rendering:pixelated;border-radius:6px}details{border:1px solid #48545c;border-radius:6px;margin:12px 0;background:#222c39}summary{cursor:pointer;min-height:64px;display:flex;align-items:center;gap:16px;padding:12px 18px;font-size:15px}summary small{margin-left:auto;white-space:nowrap}.number{color:#efc785;font-size:12px}.inside{padding:0 22px 20px}p,blockquote,dd{white-space:pre-wrap;overflow-wrap:anywhere}p{margin:4px 0}blockquote{margin:20px 0 4px;border-left:2px solid #efc785;padding-left:14px}.blank{color:#a9b8bc}footer{text-align:center;color:#a9b8bc;margin:28px 0;font-size:12px}dl{padding:0 22px 20px}dt{color:#8ec9b5;font-size:12px;margin-top:18px}dd{margin:3px 0 0}@media(max-width:400px){summary{gap:9px;padding:12px}summary small{font-size:10px}h1{font-size:20px}}@media print{body{background:white;color:#273340}details{break-inside:avoid;background:white}details::details-content{content-visibility:visible}summary{list-style:none}small,footer{color:#555}}
</style><main><header><small>烂尾事务所 · 同行回忆册${identity.demo?' · 演示':''}</small><h1>${title}</h1><small>${journey.visited.length} / ${keepsakes.length} 站 · ${journey.memories.length} 件旅途物件${journey.skipped?' · 提前到站':''}</small></header><img src="${cover}" alt="项目幽灵登上末班车，你留在站台和行李道别">${bookmark}${pages||'<p class="blank">今天先到这里，也很好。</p>'}<details><summary>它留下的资料</summary><dl>${facts.map(k=>`<dt>${labels[k]}</dt><dd>${escape(identity.facts[k].value)}</dd><small>${escape(sourceLabel(identity,identity.facts[k]))}</small>`).join('')}${identity.regret?`<dt>你写下的遗憾</dt><dd>${escape(identity.regret)}</dd>`:''}</dl></details><footer>回忆已保存在这份文件里。离线打开，也能再翻一翻。<br>旅途物件是故事里的象征；项目经历来自你确认的资料与留言。</footer></main></html>`;
}
