import {test} from 'node:test';
import assert from 'node:assert/strict';
import {destination,destinationCaption} from '../src/destination.ts';
import {confirmIdentity,example,fields,type Field} from '../src/input.ts';
import {memoryBookHtml} from '../src/memory.ts';
import {newJourney} from '../src/game.ts';

test('城市别名匹配固定风格，未知城市诚实降级，空名称和未知季节拒绝',()=>{
  for(const name of ['北京','北京市','Beijing',' Peking '])assert.equal(destination(name,'snow').kind,'beijing');
  for(const name of ['纽约','New York','NYC','new york city'])assert.equal(destination(name,'christmas').kind,'newyork');
  assert.equal(destination('北京路').kind,'other');assert.equal(destination('天津').kind,'other');
  assert.equal(destinationCaption(destination('纽约','halloween')),'纽约 · 南瓜之夜');
  assert.throws(()=>destination(''),/城市名/);assert.throws(()=>destination('字'.repeat(41)),/40/);assert.throws(()=>destination('北京','__proto__'),/场景风格/);
});
test('原件、城市和城市灯语可随回忆册离线保存；源码和图片名转义且不加载远程图片',()=>{
  const draft=example('weather'),identity=confirmIdentity(draft,Object.fromEntries(fields.map(key=>[key,draft.facts[key].value])) as Record<Field,string>,draft.prop,draft.palette,draft.accessory);
  identity.destination=destination('<img src=x>','snow');identity.sourceFiles=[{path:'<README>.md',text:'<script>alert(1)</script>',truncated:true}];
  identity.photos=[{name:'<截图>',src:'data:image/png;base64,AAAA'},{name:'remote',src:'https://example.com/track.png'}];
  const html=memoryBookHtml(identity,{...newJourney(),citySecret:true},'data:image/png;base64,AAAA');
  assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert(html.includes('&lt;README&gt;'));assert(html.includes('&lt;截图&gt;'));assert(html.includes('城市灯语已点亮'));assert(html.includes('&lt;img src=x&gt;'));
  assert(!html.includes('<script>'));assert(!html.includes('https://example.com/track.png'));
  assert(identity.facts.unfinished.value===draft.facts.unfinished.value);
});
