import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmIdentity,count,example,fiction,fields,memorialDetail,parseInput,readProjectFile,safeFilename,suggestProp,type Identity,type Field } from '../src/input.ts';
import { localDate } from '../src/export.ts';

const values=(id:Identity)=>Object.fromEntries(fields.map(k=>[k,id.facts[k].value])) as Record<Field,string>;
const confirm=(id:Identity)=>confirmIdentity(id,values(id),id.prop,id.palette,id.accessory);

test('规划清单、TODO 和代码围栏不能变成已经完成的事实',()=>{
  const project=parseInput('测试','# 工具\n## 功能规划\n- 登录\n- TODO 支付\n```md\n已完成：所有功能\n```\n未完成：支付接口。','readme');
  assert.equal(project.facts.completed.value,'');
  assert.equal(project.facts.purpose.value,'');
  assert.equal(project.facts.unfinished.value,'支付接口。');
  assert.equal(project.facts.unfinished.source,'readme');
});
test('项目主题自动挑选对应的谢幕道具',()=>{
  assert.equal(suggestProp('花园种子记录'),'sprout');assert.equal(suggestProp('podcast 音频播放器'),'record');
  assert.equal(suggestProp('摄影相册'),'camera');assert.equal(suggestProp('城市天气预报'),'umbrella');
});

test('明确字段有来源；用户编辑只改变被改字段的来源',()=>{
  const project=example('weather'),edits=values(project);edits.completed='只有一页草图。';
  const actual=confirmIdentity(project,edits,'screen','mint','hat');
  assert.equal(actual.facts.completed.source,'user');
  assert.equal(actual.facts.completed.evidence,edits.completed);
  assert.equal(actual.facts.purpose.source,'readme');
  assert.equal(project.facts.completed.value,'城市输入界面和静态天气卡片。');
  assert.equal(memorialDetail(actual).text,edits.completed);
});

test('未知资料不会补造完成情况；未确认内容不能用于纪念图',()=>{
  const project=parseInput('只有名字','');
  assert.throws(()=>memorialDetail(project));
  const actual=confirm(project);
  assert.equal(actual.facts.completed.value,'');
  assert.equal(actual.prop,'draft');
  assert.deepEqual(memorialDetail(actual),{text:'只有名字',source:'你填写的信息'});
});

test('名称以 Unicode 字符计数，长度、必填和枚举在边界处被拒绝',()=>{
  const project=parseInput('👻'.repeat(40),'一个构想');
  assert.equal(count(project.facts.name.value),40);assert.equal(confirm(project).facts.name.value,project.facts.name.value);
  assert.throws(()=>confirm(parseInput('👻'.repeat(41),'')),/40/);
  assert.throws(()=>confirm(parseInput('','')),/名字/);
  assert.throws(()=>parseInput('名字','字'.repeat(12001)),/12,000/);
  assert.throws(()=>confirmIdentity(project,values(project),'https://bad','cream','none'),/重新选择/);
  assert.equal(parseInput('名字','字'.repeat(300)).facts.purpose.value,'');
});

test('说明文件验证扩展名、凭据、大小、UTF-8、二进制与空文件',async()=>{
  for(const file of [new File(['x'],'.env.txt'),new File(['x'],'id_rsa.md'),new File(['x'],'photo.png'),new File(['x'.repeat(256*1024+1)],'large.md'),new File([new Uint8Array([0xff,0xfe])],'bad.txt'),new File(['hello\0world'],'binary.txt'),new File(['-----BEGIN RSA PRIVATE KEY-----'],'README.md'),new File([' '],'empty.txt')])await assert.rejects(readProjectFile(file));
  const read=await readProjectFile(new File(['\uFEFF# 小项目\n原本用途：记笔记。'],'README'));
  assert.equal(read.text,'# 小项目\n原本用途：记笔记。');assert.equal(read.truncated,false);
  const long=await readProjectFile(new File(['字'.repeat(12001)],'notes.md'));assert.equal(count(long.text),12000);assert.equal(long.truncated,true);
});

test('修改样例或改道具后，不能继续编造第三章与第四章',()=>{
  const weather=confirm(example('weather'));weather.prop='manuscript';
  assert(!fiction(weather).protest.includes('第四章'));
  const novel=confirm(example('novel'));assert(fiction(novel).protest.includes('第四章'));
  novel.facts.completed.value='只写了标题。';assert(!fiction(novel).finale.includes('前三章'));
});

test('危险名称保持为文本，下载名移除路径和控制字符',()=>{
  const name='<script>故事/第一章:?</script>';
  const project=confirm(parseInput(name,''));assert.equal(project.facts.name.value,name);
  assert(!/[\\/:*?"<>|\u0000-\u001f]/.test(safeFilename(name)));
  assert(safeFilename('').endsWith('project.png'));
});

test('导出日期使用本地日历',()=>{
  const now=new Date(2026,9,14,0,5);assert.equal(localDate(now),'2026-10-14');
});
