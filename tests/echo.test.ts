import {test} from 'node:test';
import assert from 'node:assert/strict';
import {example} from '../src/input.ts';
import {levels,newBoard,newJourney} from '../src/game.ts';
import {nearEcho,projectEcho,echoRows,echoPoint,echoAt} from '../src/echo.ts';
import {memoryBookHtml} from '../src/memory.ts';

test('回声只在靠近微光或拾取之后出现；听见不会改变棋盘',()=>{
  const board=newBoard(levels[0]),before=structuredClone(board);
  assert.equal(nearEcho(levels[0],board),false);assert.deepEqual(board,before);
  assert.equal(nearEcho(levels[0],{...board,ghost:{x:4,y:2}}),true);
  assert.equal(nearEcho(levels[0],{...board,found:true}),true);
});
test('回声摘录原始差异、文件或确认事实，缺失内容明确留白',()=>{
  const id=example('weather'),j=newJourney();
  id.milestones=[{sha:'a'.repeat(40),subject:'first card',date:'2020-01-01',repository:'owner/weather',changes:[{path:'card.ts',patch:'-old\n+new',status:'modified',truncated:false}],diary:[{text:'不该摘录的推断',path:'card.ts',quote:'new'}]}];
  const echo=projectEcho(id,0,j);assert.equal(echo.text,'-old\n+new');assert(echo.source.includes('card.ts'));assert(echo.url?.endsWith('a'.repeat(40)));
  id.milestones=[];id.sourceFiles=[{path:'README.md',text:'🌙'.repeat(500),truncated:false}];
  assert.equal(Array.from(projectEcho(id,0,j).text.split('\n')[0]).length,420);
  id.sourceFiles=[];id.facts.purpose.confirmed=true;assert.equal(projectEcho(id,0,j).text,id.facts.purpose.value);
  id.facts.purpose.confirmed=false;assert(projectEcho(id,0,j).source.includes('旅途象征'));
  j.notes[2]='用户写下的回忆';assert.equal(projectEcho(id,2,j).text,j.notes[2]);
});
test('星图只记录收下的回声，确定布局，导出保留快照并转义原文',()=>{
  const id=example('weather'),j=newJourney();id.facts.purpose.confirmed=true;id.facts.purpose.value='<script>原文</script>';
  id.sourceFiles=[];const echo=projectEcho(id,0,j);j.echoes={0:echo};id.facts.purpose.value='新内容';
  assert.equal(echoRows(j).length,1);assert.equal(echoRows(newJourney()).length,0);
  assert.deepEqual(echoPoint(echo),echoPoint(structuredClone(echo)));
  const p=echoPoint(echo);assert.equal(echoAt(j,p.x,p.y)?.index,0);assert.equal(echoAt(j,380,200),undefined);
  for(let i=0;i<7;i++){const point=echoPoint({...echo,index:i});assert(point.x>=30&&point.x<275&&point.y<55);}
  const html=memoryBookHtml(id,j,'data:image/png;base64,AAAA');assert(html.includes('回声星图'));assert(html.includes('&lt;script&gt;原文&lt;/script&gt;'));assert(!html.includes('<script>'));
  assert(!memoryBookHtml(id,newJourney(),'data:image/png;base64,AAAA').includes('回声星图'));
});
