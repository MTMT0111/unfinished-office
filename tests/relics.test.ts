import {test} from 'node:test';
import assert from 'node:assert/strict';
import {example} from '../src/input.ts';
import {newJourney} from '../src/game.ts';
import {historyUntil} from '../src/project.ts';
import {handoverMarkdown,patchExcerpt,relicFiles,relicRows} from '../src/relics.ts';
import {memoryBookHtml} from '../src/memory.ts';

test('历史日期按 UTC 日末读取，拒绝溢出日期、越界与注入',()=>{
  assert.equal(historyUntil(),'');assert.equal(historyUntil('2016-02-29'),'2016-02-29T23:59:59Z');
  for(const date of ['2017-02-29','2020-13-01','1969-12-31','2100-01-01','2020-01-01&sha=other'])assert.throws(()=>historyUntil(date));
});
test('前后视图只展示各自的差异片段，不把文件头或新侧行混成旧代码',()=>{
  const patch='--- a/file.ts\n+++ b/file.ts\n@@ -1,2 +1,2 @@\n same\n-old\n+new\n\\ No newline at end of file';
  assert.equal(patchExcerpt(patch,'before'),'⋯ 改动区块 ⋯\nsame\nold');assert.equal(patchExcerpt(patch,'after'),'⋯ 改动区块 ⋯\nsame\nnew');assert(patchExcerpt('','after').includes('没有提供'));
});
test('只导出本次已访问、路径仍有依据的遗物；旧旅程选择和错误路径不冒充成果',()=>{
  const id=example('weather');id.milestones=[{sha:'a'.repeat(40),date:'2016-01-02',subject:'第一张天气卡片',repository:'owner/weather',changes:[{path:'src/card.ts',status:'added',patch:'+city',truncated:false}]}];
  const j={...newJourney(),relics:{0:{path:'src/card.ts',place:'pass' as const}},notes:{0:'谢谢 <script>伙伴</script>'}};
  assert.equal(relicRows(id,j).length,0);j.visited=[0];assert.equal(relicRows(id,j).length,1);
  assert(handoverMarkdown(id,j).includes('https://github.com/owner/weather/commit/'+id.milestones[0].sha));
  const html=memoryBookHtml(id,j,'data:image/png;base64,AAAA');assert(html.includes('交接 · src/card.ts'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));
  j.relics[0].path='not-selected.ts';assert.equal(relicRows(id,j).length,0);
  assert.equal(relicFiles(id,1).length,0);assert.equal(relicFiles(id,5).length,0);
});
test('手动与样例原件可整理但不编造 Git 提交链接',()=>{
  const id=example('weather'),file=relicFiles(id,0)[0];assert(file);assert.equal(file.patch,false);
  const j={...newJourney(),visited:[0],relics:{0:{path:file.path,place:'keep' as const}}};
  assert.equal(relicRows(id,j)[0].url,null);assert(!handoverMarkdown(id,j).includes('/commit/'));
});
