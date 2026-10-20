import {test} from 'node:test';
import assert from 'node:assert/strict';
import {example,parseFarewellIntent} from '../src/input.ts';
import {newJourney} from '../src/game.ts';
import {ritualLights,ritualLines,sealRitual,unfinishedPage} from '../src/ritual.ts';
import {memoryBookHtml} from '../src/memory.ts';

test('正式告别保留未完成事实；缺失的依据留白，不补造成果',()=>{
  const id=example('weather'),j=newJourney();id.farewellIntent=parseFarewellIntent('release');
  id.facts.unfinished.confirmed=true;
  assert.equal(id.farewellIntent,'release');assert(unfinishedPage(id).includes('实时天气'));
  id.facts.unfinished.confirmed=false;id.facts.completed.source=null;id.regret='';
  assert(unfinishedPage(id).includes('留白'));assert.deepEqual(ritualLights(id,j).map(light=>light.key),['quiet']);
  assert.deepEqual(ritualLines(j),[]);
  id.milestones=[{sha:'a'.repeat(40),date:'2016-01-02',subject:'第一张天气卡片',repository:'owner/weather',changes:[{path:'src/card.ts',status:'added',patch:'+city',truncated:false}]}];
  j.relics={0:{path:'src/card.ts',place:'keep'}};assert.equal(ritualLights(id,j).length,1);
  j.visited=[0];assert.equal(ritualLights(id,j)[0].title,'src/card.ts');assert(ritualLights(id,j)[0].url?.endsWith('a'.repeat(40)));
});
test('封存需要安放和有效灯；署名按 Unicode 字数校验且允许匿名',()=>{
  const id=example('weather'),j=newJourney();assert.throws(()=>sealRitual(id,j),/安放/);
  j.ritual={laid:true,lightKey:'missing',signature:''};assert.throws(()=>sealRitual(id,j),/选择/);
  j.ritual.lightKey='quiet';j.ritual.signature='🌙'.repeat(25);assert.throws(()=>sealRitual(id,j),/24/);assert.equal(j.ritual.sealed,undefined);
  j.ritual.signature='🌙'.repeat(24);sealRitual(id,j);assert.equal(j.ritual.sealed?.signature,j.ritual.signature);
  j.ritual.signature=' ';sealRitual(id,j);assert(ritualLines(j).at(-1)?.includes('不署名'));
});
test('落款保存当时的事实快照，回忆册将用户输入作为文本',()=>{
  const id=example('weather'),j=newJourney();id.farewellIntent='release';
  id.facts.completed.confirmed=true;id.facts.unfinished.confirmed=true;
  j.ritual={laid:true,lightKey:'completed',signature:'<script>我</script>'};sealRitual(id,j);
  const original=ritualLines(j);id.facts.unfinished.value='changed';id.facts.completed.value='changed';id.farewellIntent='completed';j.ritual.signature='another';
  assert.deepEqual(ritualLines(j),original);
  const html=memoryBookHtml(id,j,'data:image/png;base64,AAAA');assert(html.includes('告别记 · 亲手封存'));assert(html.includes('&lt;script&gt;我&lt;/script&gt;'));assert(!html.includes('<script>'));
  assert(html.includes('不是项目完工证明'));
});
