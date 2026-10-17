import type { GitMilestone } from './input.ts';
import { commitUrl } from './project.ts';

const actions:Record<string,string>={added:'新增',modified:'修改',removed:'移除',renamed:'重命名',copied:'复制',changed:'变更'};
export function diaryLines(commit:GitMilestone):string[]{
  const [year,month,day]=commit.date.split('-');
  const who=commit.author?`${commit.author}${commit.coauthors?.length?`（共同署名：${commit.coauthors.join('、')}）`:''}`:'记录中的作者（姓名未提供）';
  const opening=`${year} 年 ${Number(month)} 月 ${Number(day)} 日，${who} 为我留下了一次更新。提交说明写着：「${commit.subject}」。`;
  const changes=commit.changes??[];
  const progress=commit.diary?.length?commit.diary.map(item=>item.text):changes.length?[`这次的改动记录里，有${changes.map(file=>`${actions[file.status]??'变更'}「${file.path}」`).join('、')}。${commit.limited?'这里仅摘录了一部分。':''}`]:['这次只读到了提交说明，具体实现还没有足够的材料可以回看。'];
  return [opening,...progress];
}

export function commitEvidence(commit:GitMilestone):HTMLDetailsElement{
  const details=document.createElement('details');details.className='commit-evidence';
  const summary=document.createElement('summary');summary.textContent=`核对这次更新 · ${commit.sha.slice(0,7)}`;
  const meta=document.createElement('p');meta.className='note';
  meta.textContent=`${commit.date}（Git 提交日期 · UTC） · ${commit.author||'作者未提供'}${commit.coauthors?.length?' · 共同署名：'+commit.coauthors.join('、'):''}`;
  details.append(summary,meta);
  const url=commitUrl(commit);
  if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='在 GitHub 查看原始提交 ↗';details.append(link);}
  if(commit.diary?.length){const hint=document.createElement('p');hint.className='note';hint.textContent='下列日记解读由 API 依据片段整理；引用已匹配，语义仍请核对。未运行或验证功能。';details.append(hint);}
  for(const file of commit.changes??[]){
    const heading=document.createElement('p');heading.className='commit-file';heading.textContent=`${actions[file.status]??'变更'} · ${file.path}`;
    const pre=document.createElement('pre');pre.textContent=file.patch||'GitHub 未提供可展示的文本差异。';details.append(heading,pre);
    for(const entry of commit.diary?.filter(item=>item.path===file.path)??[]){const quote=document.createElement('blockquote');quote.textContent='日记引用：'+entry.quote;details.append(quote);}
  }
  const limit=document.createElement('small');limit.className='source';limit.textContent=commit.changes===undefined?'改动详情未读取；这页只依据提交说明。':'最多摘录 3 个安全路径的文件，每份 1,000 字；不能代表整个项目或运行结果。';details.append(limit);
  return details;
}
