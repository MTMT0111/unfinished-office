import { sourceLabel, type Identity, type Field } from './input.ts';
import { commitEvidence, diaryLines } from './journal.ts';

export type Keyword = { text:string; evidence:string; category:'purpose'|'built'|'next'|'tech' };
export const categoryNames={purpose:'想做什么',built:'已经留下',next:'资料中的待办',tech:'使用技术'};
const fieldFor={purpose:'purpose',built:'completed',next:'unfinished'} as const;

export function dossier(identity:Identity):Keyword[]{
  const result:Keyword[]=[];
  for(const [category,field] of Object.entries(fieldFor) as [keyof typeof fieldFor,Field][]){
    const f=identity.facts[field];
    // Edited facts take precedence over an older model-generated keyword list.
    const tags=identity.keywords?.filter(k=>k.category===category&&f.source==='analysis')??[];
    if(tags.length){result.push(...tags);continue;}
    if(!f.value)continue;
    const phrases=f.value.replace(/[。.!！]+$/,'').split(/[，,、；;\n]|\s+and\s+/i).map(s=>s.trim()).filter(Boolean);
    for(const text of phrases.slice(0,3))result.push({category,text,evidence:sourceLabel(identity,f)+' · '+f.evidence});
  }
  result.push(...(identity.keywords?.filter(k=>k.category==='tech')??[]));
  return result;
}

export function renderDossier(container:HTMLElement,identity:Identity,discardDiary?:(sha:string)=>void){
  container.replaceChildren();const keywords=dossier(identity);
  if(identity.milestones?.length){
    const history=document.createElement('section');history.className='dossier-history';
    const heading=document.createElement('h3');heading.textContent='我们走过的几页';
    const note=document.createElement('p');note.className='note';note.textContent='所选更新按日期展开。旅途回看这些记录，终点和项目告别。';history.append(heading,note);
    for(const commit of identity.milestones){
      const page=document.createElement('details');page.className='dossier-entry';page.open=commit===identity.milestones[0];
      const summary=document.createElement('summary');
      const date=document.createElement('small');date.textContent=commit.date;
      const title=document.createElement('span');title.textContent=commit.subject;summary.append(date,title);page.append(summary);
      for(const line of diaryLines(commit)){const p=document.createElement('p');p.textContent=line;page.append(p);}
      page.append(commitEvidence(commit));
      if(discardDiary&&commit.diary?.length){const button=document.createElement('button');button.type='button';button.className='quiet';button.textContent='解读不准确，只保留原始记录';button.addEventListener('click',()=>discardDiary(commit.sha));page.append(button);}
      history.append(page);
    }
    container.append(history);
  }
  for(const category of Object.keys(categoryNames) as Keyword['category'][]){
    const section=document.createElement('div');section.className='keyword-group';
    const heading=document.createElement('h3');heading.textContent=categoryNames[category];section.append(heading);
    const tags=keywords.filter(k=>k.category===category);
    for(const tag of tags){const chip=document.createElement('span');chip.className='keyword';chip.textContent=tag.text;chip.title=tag.evidence;section.append(chip);}
    if(!tags.length){const unknown=document.createElement('span');unknown.className='unknown';unknown.textContent='资料未说明';section.append(unknown);}
    container.append(section);
  }
}
