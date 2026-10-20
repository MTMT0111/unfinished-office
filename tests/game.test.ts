import {test} from 'node:test';
import assert from 'node:assert/strict';
import {choiceOf,corneredBoxes,gateOpen,levels,move,newBoard,newJourney,positions,solve,won,type Board} from '../src/game.ts';
import {chapterCargo,parcelContents,validateNextStep,recollection,memoryStory,memoryBookHtml,keepsakes} from '../src/memory.ts';
import {parseAnalysis} from '../src/analysis.ts';
import {confirmIdentity,example,fields,type Field} from '../src/input.ts';
import {dossier} from '../src/dossier.ts';

test('七站均可解，原始状态不受移动影响，出口锁住桥后同伴能跟上',async()=>{
  for(const level of levels){
    const initial=newBoard(level),copy=structuredClone(initial),route=await solve(level,initial);assert(route?.length,level.title);
    let board=initial;
    for(const action of route!){const next=action==='switch'?{...board,active:board.active==='you'?'ghost' as const:'you' as const}:move(level,board,action);assert(next);board=next;}
    assert(won(level,board));assert(board.latched);assert(gateOpen(level,board));assert.deepEqual(initial,copy);
    assert.equal(board.lit.length,positions(level,'a').length);if(board.lit.length)assert(!won(level,{...board,lit:[]}));
  }
});
test('只有幽灵走过才点灯，离开后常亮，再次经过不会重复记录，旧快照不变',()=>{
  const level=levels[2],initial={...newBoard(level),you:{x:2,y:2}};
  const human=move(level,initial,'left')!;assert(human);assert.deepEqual(human.lit,[]);
  const before={...initial,you:{x:2,y:4},ghost:{x:2,y:2},active:'ghost' as const};
  const lit=move(level,before,'left')!;assert.deepEqual(lit.lit,[{x:1,y:2}]);assert.deepEqual(before.lit,[]);
  const away=move(level,lit,'right')!,again=move(level,away,'left')!;assert.equal(again.lit.length,1);assert.deepEqual(lit.ghost,{x:1,y:2});
});
test('连续只采用下一步提示也能走完七站，不在角色切换或灯芯之间循环',async()=>{
  for(const level of levels){
    let board=newBoard(level);const seen=new Set<string>();
    for(let step=0;!won(level,board)&&step<160;step++){
      const key=JSON.stringify({...board,steps:0});assert(!seen.has(key),level.title+' 提示循环');seen.add(key);
      const action=(await solve(level,board))?.[0];assert(action,level.title);
      const next=action==='switch'?{...board,active:board.active==='you'?'ghost' as const:'you' as const}:move(level,board,action);assert(next);board=next;
    }
    assert(won(level,board),level.title);
  }
});
test('箱子标签只分装确认的片段，材料不足时留白；终点带走的是本人遗憾',()=>{
  const draft=example('weather'),values=Object.fromEntries(fields.map(k=>[k,draft.facts[k].value])) as Record<Field,string>;
  values.completed='登录界面、离线笔记';const id=confirmIdentity(draft,values,draft.prop,draft.palette,draft.accessory,'还没给朋友试用');
  assert.deepEqual(parcelContents(id,2,3).map(p=>p.text),['登录界面','离线笔记','尚未命名的片段']);
  assert.equal(parcelContents(id,5,1,true)[0].text,'还没给朋友试用');assert.equal(parcelContents(id,5,1,false)[0].text,'还没给朋友试用');
  id.facts.completed.confirmed=false;assert(parcelContents(id,2,2).every(p=>p.source==='未说明'));
});
test('未来便签可留白、按字符限长，只随带走分支和已走的终点导出，HTML安全转义',()=>{
  assert.equal(validateNextStep('  '),'');assert.equal(validateNextStep(' 🌱 '),'🌱');assert.equal(validateNextStep('🌱'.repeat(60)).length,120);assert.throws(()=>validateNextStep('🌱'.repeat(61)),/60/);
  const draft=example('weather'),id=confirmIdentity(draft,Object.fromEntries(fields.map(k=>[k,draft.facts[k].value])) as Record<Field,string>,draft.prop,draft.palette,draft.accessory);
  const journey={...newJourney(),visited:[5,6],resolution:'carry' as const,nextStep:'<img onerror=alert(1)> & 写一行'},cover='data:image/png;base64,AAAA';
  const html=memoryBookHtml(id,journey,cover);assert(html.includes('&lt;img onerror=alert(1)&gt; &amp; 写一行'));assert(!html.includes('<img onerror'));
  assert(!memoryBookHtml(id,{...journey,resolution:'shelf'},cover).includes('写一行'));
  assert(!memoryBookHtml(id,{...journey,visited:[5]},cover).includes('写一行'));
});
test('留白页的收藏和带走均可通过实际搬运完成，两个目标不必同时填满',async()=>{
  const level=levels[5];
  for(const ending of ['shelf','carry'] as const){
    const desired={...level,map:level.map.map(row=>row.replace(ending==='carry'?'t':'r','.'))},route=await solve(desired,newBoard(level));assert(route,ending);
    let board=newBoard(level);for(const action of route!){const next=action==='switch'?{...board,active:board.active==='you'?'ghost' as const:'you' as const}:move(level,board,action);assert(next);board=next;}
    assert(won(level,board));assert.equal(choiceOf(level,board),ending);
  }
});
test('关卡行李来自确认资料，遗憾只来自本人；书库选择不会改写项目完成情况',()=>{
  const draft=example('weather'),values=Object.fromEntries(fields.map(k=>[k,draft.facts[k].value])) as Record<Field,string>;
  assert.equal(chapterCargo(draft,3).source,'未说明');
  const id=confirmIdentity(draft,values,draft.prop,draft.palette,draft.accessory,'还没让第一个人用上它。');
  assert(chapterCargo(id,2).text.includes('静态天气卡片'));assert(chapterCargo(id,3).text.includes('静态天气卡片'));
  assert.equal(chapterCargo(id,5).text,id.regret);assert.equal(chapterCargo(id,5).source,'你写下的心意');
  const journey={...newJourney(),visited:[5],resolution:'carry' as const},html=memoryBookHtml(id,journey,'data:image/png;base64,AAAA');
  assert(html.includes('把这一页放进行李。可以带走收获，不必带走新的任务。'));assert(html.includes('还没让第一个人用上它。'));assert.equal(id.facts.unfinished.value,values.unfinished);
  assert(memoryBookHtml(id,newJourney(),'data:image/png;base64,AAAA').includes('还没让第一个人用上它。'));
  assert.throws(()=>confirmIdentity(draft,values,draft.prop,draft.palette,draft.accessory,'字'.repeat(121)),/120/);
});
test('墙角提示只识别无法推离的固定角落，不把目标格或机关当死角',()=>{
  const level=levels[0],board={...newBoard(level),boxes:[{x:1,y:1}]};assert.equal(corneredBoxes(level,board).length,1);
  assert.equal(corneredBoxes({...level,map:level.map.map((row,i)=>i===1?'#t......#':row)},board).length,0);
  assert.equal(corneredBoxes({...level,map:level.map.map((row,i)=>i===1?'#r......#':row)},board).length,0);
  assert.equal(corneredBoxes({...level,map:level.map.map((row,i)=>i===0?'#d#######':row)},board).length,0);
});
test('回忆只采用已确认的资料或用户留言，缺失内容不编造，七站都有回忆',()=>{
  const draft=example('weather'),journey=newJourney();assert(recollection(draft,1,journey).empty);
  draft.keywords=[{category:'tech',text:'TypeScript',evidence:'示例配置'}];assert(recollection(draft,2,journey).empty);draft.keywords=[];
  const id=confirmIdentity(draft,Object.fromEntries(fields.map(k=>[k,draft.facts[k].value])) as Record<Field,string>,draft.prop,draft.palette,draft.accessory);
  assert.equal(recollection(id,1,journey).text,id.facts.completed.value);assert(recollection(id,2,journey).empty);
  journey.notes[1]='那个下雨的晚上。';assert.equal(recollection(id,1,journey).text,'那个下雨的晚上。');assert.equal(recollection(id,1,journey).source,'你写下的回忆');
  for(let i=0;i<levels.length;i++){assert(recollection(id,i,journey).title);assert(recollection(id,i,journey).text);}
});

test('GitHub 提交按时间接成故事路标，并把用户续写留在对应一幕',()=>{
  const id=example('weather');
  id.milestones=[
    {sha:'a'.repeat(40),subject:'搭起最初的地图',date:'2025-01-02'},
    {sha:'b'.repeat(40),subject:'让机器人走出房间',date:'2025-02-03'},
  ];
  const journey={...newJourney(),notes:{1:'那晚，我们终于看见它动起来。'}};
  const first=memoryStory(id,0,journey),second=memoryStory(id,1,journey);
  assert.equal(first.title,'搭起最初的地图');assert(first.lines[0].includes('2025 年 1 月 2 日'));
  assert.equal(second.title,'让机器人走出房间');assert(second.lines[0].includes('2025 年 2 月 3 日'));
  assert(second.lines[0].includes('让机器人走出房间'));assert(second.lines[1].includes('只读到了提交说明'));
  assert(second.lines[2].includes('你的补记：那晚，我们终于看见它动起来。'));assert.equal(second.step,2);
});

test('回忆册保留确认资料与个人留言，转义外来文字，不导出未走关卡的旧留言',()=>{
  const draft=example('weather'),edits=Object.fromEntries(fields.map(k=>[k,draft.facts[k].value])) as Record<Field,string>;
  edits.name='<img src=x onerror=alert(1)>';const id=confirmIdentity(draft,edits,draft.prop,draft.palette,draft.accessory);
  const journey={...newJourney(),visited:[0,1,2],memories:[0],notes:{0:'<script>alert(1)</script> & 那一晚',4:'未走到的旧回忆'}};
  const html=memoryBookHtml(id,journey,'data:image/png;base64,AAAA');
  assert.equal(keepsakes.length,levels.length);assert(html.includes('城市输入界面和静态天气卡片'));
  assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; 那一晚'));assert(!html.includes('<script>'));
  assert(html.includes('&lt;img src=x'));assert(!html.includes('未走到的旧回忆'));assert(html.includes('留一格空白'));
  assert(!html.includes('抽屉弹开'));assert.throws(()=>memoryBookHtml(id,journey,'https://external.test/image.png'));
  const unconfirmed=memoryBookHtml(draft,newJourney(),'data:image/png;base64,AAAA');assert(!unconfirmed.includes('城市输入界面和静态天气卡片'));
});
test('人不能过水，幽灵不能推箱，角色和箱子不能重叠；收星和机关随撤销状态恢复',()=>{
  let b=newBoard(levels[1]);b.you={x:3,y:2};assert.equal(move(levels[1],b,'right'),null);
  b.active='ghost';b.ghost={x:3,y:2};const across=move(levels[1],b,'right');assert.equal(across?.ghost.x,4);
  b=newBoard(levels[0]);b.active='ghost';b.ghost={x:2,y:2};assert.equal(move(levels[0],b,'right'),null);
  b=newBoard(levels[0]);assert.equal(move(levels[0],b,'down'),null);
  b.you={x:4,y:1};const star=move(levels[0],b,'right');assert(star?.found);assert(!b.found);
  b=newBoard(levels[1]);b.ghost={x:5,y:5};assert(gateOpen(levels[1],b));b.active='ghost';const off=move(levels[1],b,'right')!;assert(!gateOpen(levels[1],off));
});
test('死角提示不会给出虚假解法；所有初始地图格式有效',async()=>{
  const b:Board={...newBoard(levels[0]),boxes:[{x:1,y:1}]};assert.equal(await solve(levels[0],b),null);
  for(const l of levels){assert.equal(l.map.length,7);assert(l.map.every(row=>row.length===9));}
});
test('档案关键词必须引用原文，编辑事实后不再显示旧关键词，未知类别不编造',()=>{
  const project={label:'测试',origin:'folder' as const,notes:[],files:[{path:'README.md',text:'用途：城市天气。\n已完成：输入界面。\n使用 TypeScript。',truncated:false}]};
  const id=parseAnalysis(JSON.stringify({facts:{purpose:{value:'城市天气',path:'README.md',quote:'城市天气。'}},keywords:[{text:'天气查询',category:'purpose',path:'README.md',quote:'城市天气。'},{text:'TypeScript',category:'tech',path:'README.md',quote:'TypeScript'},{text:'全部完成',category:'built',path:'README.md',quote:'没有这句话'}]}),project);
  assert.equal(id.keywords?.length,2);assert(dossier(id).some(k=>k.text==='天气查询'));
  const edits=Object.fromEntries(fields.map(k=>[k,id.facts[k].value])) as Record<Field,string>;edits.purpose='记录日记';
  const edited=confirmIdentity(id,edits,id.prop,id.palette,id.accessory);assert(!dossier(edited).some(k=>k.text==='天气查询'));assert(dossier(edited).some(k=>k.text==='记录日记'));
  assert(!dossier(example('novel')).some(k=>k.category==='tech'));
});
test('项目回忆逐幕使用确认过的内容与审阅线索，不再退回通用纸条文案',()=>{
  const draft=example('weather'),values=Object.fromEntries(fields.map(k=>[k,draft.facts[k].value])) as Record<Field,string>;
  const id=confirmIdentity(draft,values,draft.prop,draft.palette,draft.accessory,'还没让朋友试用。');
  id.review={summary:'',limits:[],items:[{text:'城市输入连接到天气卡片展示。',evidence:'src/weather.ts：renderCard(city)'}]};
  const journey=newJourney(),purpose=memoryStory(id,0,journey),progress=memoryStory(id,1,journey),structure=memoryStory(id,2,journey),unfinished=memoryStory(id,5,journey),note=memoryStory(id,4,journey);
  assert(purpose.lines.some(line=>line.includes(id.facts.purpose.value)));
  assert(progress.lines.some(line=>line.includes(id.facts.completed.value)));
  assert(structure.lines.some(line=>line.includes(id.review!.items[0].text)));assert.equal(recollection(id,2,journey).source,'项目结构线索 · 引用可核对');
  assert(unfinished.lines.some(line=>line.includes(id.facts.unfinished.value)));
  assert(note.lines.some(line=>line.includes(id.review!.items[0].text)));assert(unfinished.lines.some(line=>line.includes(id.regret!)));
  assert(purpose.scene.includes('没有 Git 时间线'));assert(!purpose.lines.some(line=>/小伞|午夜|抽屉|纸条上写着/.test(line)));
  assert(memoryStory(draft,5,newJourney()).empty);
});
test('最后一幕明确告别项目；书架、下一站和 GitHub 终点都保留这条主线',()=>{
  const draft=example('weather'),values=Object.fromEntries(fields.map(k=>[k,draft.facts[k].value])) as Record<Field,string>;
  const id=confirmIdentity(draft,values,draft.prop,draft.palette,draft.accessory);
  for(const resolution of ['shelf','carry'] as const){
    const story=memoryStory(id,6,{...newJourney(),resolution});
    assert.equal(story.title,'和它说再见');assert.equal(story.scene,'夜间送别站 · 最后一幕');assert(story.lines.at(-1)!.includes('这次同行'));assert(story.lines.at(-1)!.includes(id.facts.name.value));
  }
  id.milestones=Array.from({length:6},(_,i)=>({sha:String(i+1).repeat(40),subject:`推进 ${i+1}`,date:'2026-01-01'}));
  const final=memoryStory(id,6,{...newJourney(),visited:[0,1,2,3,4,5,6],resolution:'carry'});assert(!final.milestone);assert.equal(final.title,'和它说再见');assert(final.lines.at(-1)!.includes('这次同行'));assert(final.lines.at(-1)!.includes(id.facts.name.value));assert(final.lines[0].includes('推进 5'));assert(!final.lines.join('').includes('推进 6'));
});
