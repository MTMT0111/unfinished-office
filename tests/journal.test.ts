import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMilestones,suggestedMilestones,commitUrl} from '../src/project.ts';
import {parseAnalysis,validateProject} from '../src/analysis.ts';
import {confirmIdentity,example,farewells,fiction,fields,parseFarewellIntent,type Field} from '../src/input.ts';
import {chapterCargo,keepsakeStory,keepsakeTopic,memoryStory,memoryBookHtml,parcelContents,rememberedPage,farewellLines} from '../src/memory.ts';
import {newJourney} from '../src/game.ts';
import {recalledKeepsake} from '../src/scene.ts';

const sha='a'.repeat(40),other='b'.repeat(40);
const commit={sha,commit:{message:'增加城市输入检查\n\nCo-authored-by: Lin <private@example.com>',author:{name:'Wen'},committer:{date:'2026-02-03T08:00:00Z'}},files:[{filename:'src/city.ts',status:'modified',patch:'-return search(city);\n+if (!city.trim()) return showHint("请输入城市");\n+return search(city);'},{filename:'.env',patch:'SECRET'},{filename:'src/key.ts',patch:'api_key="sk-synthetic1234567890"'}]};
test('告别心意只由本人选择；收尾、休息、交接收好成果，不把旧待办当新任务',()=>{
  const draft=example('weather'),values=Object.fromEntries(fields.map(k=>[k,draft.facts[k].value])) as Record<Field,string>;
  const original=structuredClone(draft),journey={...newJourney(),visited:[5,6],memories:[5],bookmark:5,resolution:'carry' as const};
  for(const intent of ['completed','pause','handover'] as const){
    const id=confirmIdentity(draft,values,draft.prop,draft.palette,draft.accessory,'',intent);
    assert.equal(id.facts.unfinished.value,draft.facts.unfinished.value);
    assert.equal(chapterCargo(id,5).detail,values.completed);
    assert.equal(parcelContents(id,6,1,true)[0].text,chapterCargo(id,5).text);
    assert.equal(rememberedPage(id,journey)?.title,values.completed);
    assert(!memoryStory(id,5,journey).lines.join('').includes(values.unfinished));
    assert(farewellLines(id,journey).signal.includes(farewells[intent].finale));
    const html=memoryBookHtml(id,journey,'data:image/png;base64,AAAA');
    assert(html.includes(farewells[intent].label));assert(html.includes(values.unfinished),'原始资料仍可回看');
    assert(html.includes('不必带走新的任务'));
  }
  assert.deepEqual(draft,original);
  assert.throws(()=>confirmIdentity(draft,values,draft.prop,draft.palette,draft.accessory,'','constructor'),/重新选择/);
  assert.throws(()=>parseFarewellIntent('__proto__'),/重新选择/);
  assert.equal(confirmIdentity(draft,values,draft.prop,draft.palette,draft.accessory).farewellIntent,'undecided');
});
test('改换告别心意保留个人留言、书签与便签；缺少成果时留白，不虚构多年成就',()=>{
  const draft=example('weather'),values=Object.fromEntries(fields.map(k=>[k,draft.facts[k].value])) as Record<Field,string>;
  const id=confirmIdentity(draft,values,draft.prop,draft.palette,draft.accessory,'<b>八年的陪伴，谢谢</b>','completed');
  const journey={...newJourney(),visited:[5,6],bookmark:5,notes:{5:'给一起做过的人'},resolution:'carry' as const,nextStep:'记得休息'},before=structuredClone(journey);
  for(const intent of ['completed','pause','handover','undecided'] as const){
    id.farewellIntent=intent;
    assert.equal(chapterCargo(id,5).text,id.regret);assert.equal(rememberedPage(id,journey)?.title,journey.notes[5]);
    const html=memoryBookHtml(id,journey,'data:image/png;base64,AAAA');
    assert(html.includes('&lt;b&gt;八年的陪伴，谢谢&lt;/b&gt;'));assert(!html.includes('<b>八年的'));assert(html.includes('记得休息'));
  }
  assert.deepEqual(journey,before);
  const blank=confirmIdentity(draft,{...values,completed:''},draft.prop,draft.palette,draft.accessory,'','completed');
  assert.equal(chapterCargo(blank,5).source,'未说明');assert(memoryStory(blank,5,newJourney()).empty);
  assert.equal(rememberedPage(blank,{...newJourney(),visited:[5],bookmark:5}),null);
});
test('书签只保留已走过且有内容的回忆，不能自动替玩家选择',()=>{
  const identity=example('weather');identity.milestones=normalizeMilestones([commit]);
  const journey={...newJourney(),visited:[0]};
  assert.equal(rememberedPage(identity,journey),null);
  const selected={...journey,bookmark:0};assert.equal(rememberedPage(identity,selected)?.title,'增加城市输入检查');assert.equal(rememberedPage(identity,selected)?.date,'2026-02-03');
  for(const bookmark of [-1,0.5,5,NaN,100])assert.equal(rememberedPage(identity,{...selected,bookmark}),null);
  assert.equal(rememberedPage(identity,{...selected,visited:[]}),null);
  assert.equal(rememberedPage(example('weather'),{...selected,bookmark:2,visited:[2]}),null);
  const html=memoryBookHtml(identity,selected,'data:image/png;base64,AAAA');assert(html.includes('你想留下的这一页'));assert(html.includes('href="#memory-0"'));assert(html.includes('id="memory-0" open'));assert(html.includes('Wen'));
  const personal={...newJourney(),visited:[2],bookmark:2,notes:{2:'<script>我的补记</script>'}};
  const noteBook=memoryBookHtml(example('weather'),personal,'data:image/png;base64,AAAA');assert(noteBook.includes('&lt;script&gt;我的补记'));assert(!noteBook.includes('<script>'));
});
test('告别回应书签和未完成事项，不把未翻过的提交说成经历或提前宣称已经关灯',()=>{
  const identity=example('weather');identity.regret='还没试用';identity.milestones=normalizeMilestones([commit,{...commit,sha:other,commit:{...commit.commit,message:'还未翻到的更新'}}]);
  const journey={...newJourney(),visited:[0],memories:[0,3],bookmark:0,resolution:'carry' as const,skipped:true};
  const words=farewellLines(identity,journey);assert(words.memory.includes('增加城市输入检查'));assert(words.choice.includes('还没试用'));assert(words.luggage.includes('2 件旅途物件'));assert(words.luggage.includes('增加城市输入检查'));assert(words.signal.includes(identity.facts.name.value));assert(words.signal.includes(fiction(identity).finale));assert(words.closing.includes('今天先到这里'));
  assert.equal(recalledKeepsake(journey.memories,.079),undefined);assert.equal(recalledKeepsake(journey.memories,.08),0);assert.equal(recalledKeepsake(journey.memories,.13),3);assert.equal(recalledKeepsake(journey.memories,.18),undefined);
  const story=memoryStory(identity,6,journey);assert(!story.lines.join('').includes('还未翻到的更新'));assert(!story.lines.join('').includes('关上事务所的灯'));assert(story.lines.at(-1)?.includes('等你亲手关灯'));
});
test('告别字幕截短过长的项目线索且保留完整行李故事',()=>{
  const subject='项目线索'.repeat(12),identity=example('weather');identity.keywords=[];identity.milestones=normalizeMilestones([{...commit,commit:{...commit.commit,message:subject}}]);
  const journey={...newJourney(),memories:[0]},words=farewellLines(identity,journey);
  assert(words.luggage.includes(`${subject.slice(0,28)}…`));assert(keepsakeStory(identity,0,journey).topic.text===subject);
});
test('提交保留真实日期、作者和共同署名，限制改动片段并剔除凭据',()=>{
  const actual=normalizeMilestones([commit],'owner/project')[0];
  assert.equal(actual.author,'Wen');assert.deepEqual(actual.coauthors,['Lin']);assert.equal(actual.date,'2026-02-03');assert.equal(actual.committedAt,'2026-02-03T08:00:00.000Z');
  assert(!JSON.stringify(actual).includes('private@example'));assert(!JSON.stringify(actual).includes('SECRET'));assert(!JSON.stringify(actual).includes('sk-synthetic'));assert(actual.limited);
  assert.equal(commitUrl(actual),`https://github.com/owner/project/commit/${sha}`);assert.equal(commitUrl({...actual,repository:'../evil'}),null);
  const again=normalizeMilestones([actual])[0];assert.deepEqual(again,actual);
  const large=normalizeMilestones([{...commit,files:Array.from({length:10},(_,i)=>({filename:`src/file${i}.ts`,status:'added',patch:'文'.repeat(2000)}))}])[0];
  assert.equal(large.changes?.length,3);assert.equal(large.changes?.[0].patch.length,1000);assert(large.limited);
});
test('同一天按真实提交时间排序，预选覆盖所读记录而非宣称重要性',()=>{
  const commits=normalizeMilestones(Array.from({length:8},(_,i)=>({...commit,sha:String(i+1).repeat(40),commit:{...commit.commit,committer:{date:`2026-02-03T0${7-i}:00:00Z`}}})));
  const chosen=suggestedMilestones(commits);assert.equal(chosen.length,5);assert.equal(chosen[0].sha,'8'.repeat(40));assert.equal(chosen.at(-1)?.sha,'1'.repeat(40));
  assert.equal(suggestedMilestones([]).length,0);assert.equal(suggestedMilestones(commits.slice(0,1)).length,1);
});
test('真实提交不会覆盖书库的个人遗憾，带向下一站的仍是未完成事项',()=>{
  const identity=example('weather');identity.regret='还没让朋友试用';identity.milestones=Array.from({length:5},()=>normalizeMilestones([commit])[0]);
  assert.equal(chapterCargo(identity,5).text,identity.regret);assert.equal(parcelContents(identity,5,1)[0].text,identity.regret);assert.equal(parcelContents(identity,6,1,true)[0].text,identity.regret);
  assert(memoryStory(identity,5,newJourney()).lines[0].includes(identity.regret));assert.equal(memoryStory(identity,5,newJourney()).milestone,false);assert.equal(rememberedPage(identity,{...newJourney(),visited:[5],bookmark:5})?.title,identity.regret);
});
test('日记只能引用对应 SHA 的差异，不能拿今天 README 或另一条提交拼造经历',()=>{
  const milestones=normalizeMilestones([commit,{...commit,sha:other,files:[{filename:'src/city.ts',status:'modified',patch:'+const version = 2;'}]}],'owner/project');
  const project=validateProject({label:'天气',origin:'github',files:[{path:'README.md',text:'用途：查看天气。',truncated:false}],notes:[],milestones});
  const identity=parseAnalysis(JSON.stringify({facts:{purpose:{value:'查看天气',path:'README.md',quote:'查看天气。'}},diary:[{sha,entries:[{text:'这次，我的输入框有了空值检查。',path:'src/city.ts',quote:'+if (!city.trim()) return showHint("请输入城市");'},{text:'版本变成 2',path:'src/city.ts',quote:'+const version = 2;'}]},{sha:other,entries:[{text:'开始查询天气',path:'README.md',quote:'查看天气。'},{text:'假的引用',path:'src/city.ts',quote:'   '}]}]}),project);
  assert.equal(identity.milestones?.[0].diary?.length,1);assert.equal(identity.milestones?.[1].diary,undefined);assert(identity.review?.limits.some(line=>line.includes('3 条')));
  const contextOnly=parseAnalysis(JSON.stringify({facts:{purpose:{value:'查看天气',path:'README.md',quote:'查看天气。'}},diary:[{sha,entries:[{text:'空值检查',path:'src/city.ts',quote:'if (!city.trim())'}]}]}),project);
  assert.equal(contextOnly.milestones?.[0].diary,undefined);
  const story=memoryStory(identity,0,newJourney());assert(story.lines.join('').includes('Wen'));assert(story.lines.join('').includes('空值检查'));assert(story.source.includes('请核对'));assert(!story.lines.join('').includes('版本变成'));
  assert.equal(chapterCargo(identity,0).text,'增加城市输入检查');assert.equal(parcelContents(identity,0,1)[0].text,'src/city.ts');
  const malicious={...identity,milestones:[{...milestones[0],subject:'<img src=x>',changes:[{path:'src/city.ts',status:'modified',patch:'<script>alert(1)</script>',truncated:false}]}]};
  const html=memoryBookHtml(malicious,{...newJourney(),visited:[0]},'data:image/png;base64,AAAA');assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(html.includes(`/commit/${sha}`));
  const noHistory=memoryStory(example('weather'),1,newJourney());assert(noHistory.scene.includes('没有 Git 时间线'));assert(!noHistory.lines.join('').includes('2026'));
});
test('站台物件只用对应提交文件的项目关键词，并保留原回忆来源',()=>{
  const second={...commit,sha:other,commit:{...commit.commit,message:'调整地图显示'},files:[{filename:'src/map.ts',status:'modified',patch:'+renderMap();'}]};
  const identity=example('weather');identity.milestones=normalizeMilestones([commit,second]);
  identity.keywords=[{text:'城市输入校验',evidence:'src/city.ts：if (!city.trim()) return showHint("请输入城市");',category:'built'},{text:'地图缩放',evidence:'README.md：支持地图缩放。',category:'tech'}];
  const journey={...newJourney(),visited:[0]};
  const topic=keepsakeTopic(identity,0),story=keepsakeStory(identity,0,journey);
  assert.equal(topic.text,'城市输入校验');assert(topic.source.includes('src/city.ts'));assert(story.lines[0].includes('城市输入校验'));assert(story.lines.join('').includes('Wen'));assert(story.source.includes('GitHub'));
  assert.equal(keepsakeTopic(identity,1).text,'调整地图显示');
  const withoutCommit=example('weather');withoutCommit.keywords=[{text:'静态天气卡片',evidence:'README.md：静态天气卡片。',category:'built'}];
  assert.equal(keepsakeTopic(withoutCommit,0).text,'静态天气卡片');
});
