import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedPath, cleanText, readDirectory, readFolderFiles, readRepository, repoName, type Project} from '../src/project.ts';
import {parseAnalysis, validateProject} from '../src/analysis.ts';
import {confirmIdentity, fields, sourceLabel, type Field} from '../src/input.ts';

const project:Project={label:'雨天',origin:'folder',files:[{path:'README.md',text:'# 雨天\n一个天气工具。\n已经留下城市输入界面。\nTODO：实时预报。',truncated:false}],notes:[]};
const facts={name:{value:'雨天',path:'README.md',quote:'雨天'},purpose:{value:'天气工具',path:'README.md',quote:'一个天气工具。'},completed:{value:'README 自述已有输入界面',path:'README.md',quote:'已经留下城市输入界面。'}};

test('目录选择只读取允许的材料，跳过依赖、凭据、大文件；截断有标记',async()=>{
  const files=[['README.md','# 项目\n'+ '字'.repeat(7000)],['src/main.ts','export const done = true'],['.env','PRIVATE'],['node_modules/a/index.js','PRIVATE'],['credentials.json','PRIVATE'],['large.ts','x'.repeat(256*1024+1)]];
  const actual=await readFolderFiles(files.map(([name,text])=>{const file=new File([text],name.split('/').at(-1)!);Object.defineProperty(file,'webkitRelativePath',{value:'demo/'+name});if(name.includes('PRIVATE')||name.startsWith('.')||name.startsWith('node_modules')||name==='credentials.json')file.arrayBuffer=()=>{throw new Error('不应该读取');};return file;}),new AbortController().signal);
  assert.deepEqual(actual.files.map(f=>f.path),['README.md','src/main.ts']);assert(actual.files[0].truncated);assert(actual.notes.some(n=>n.includes('限制')));
  assert(!allowedPath('../README.md'));assert(!allowedPath('src/../README.md'));assert(!allowedPath('keys/private-key.txt'));
});
test('原生目录遍历不会进入依赖或隐藏目录，取消可中止读取',async()=>{
  const handle:any={kind:'directory',name:'demo',async *values(){yield {kind:'directory',name:'node_modules',async *values(){throw new Error('不能遍历依赖');}};yield {kind:'file',name:'README.md',getFile:async()=>new File(['# demo'],'README.md')};}};
  const actual=await readDirectory(handle,new AbortController().signal);assert.equal(actual.files.length,1);
  const abort=new AbortController();abort.abort();await assert.rejects(readDirectory(handle,abort.signal));
});
test('常见密钥被隐藏，私钥文件不进入 API；请求边界不接受超量或重复材料',()=>{
  const secret='sk-abcdefghijklmnop';const cleaned=cleanText(`API_KEY="${secret}"\npassword=abc123\nhello`);assert(!cleaned.includes(secret));assert(!cleaned.includes('abc123'));assert(cleaned.includes('hello'));
  assert.throws(()=>cleanText('-----BEGIN PRIVATE KEY-----'));assert.throws(()=>validateProject({...project,files:[...project.files,...project.files]}));
  assert.throws(()=>validateProject({...project,files:[{path:'.env',text:'x',truncated:false}]}));
  assert.throws(()=>validateProject({...project,files:[{path:'README.md',text:'字'.repeat(6001),truncated:false}]}));
});
test('API 结论必须有匹配原文的引用，不接受伪造路径；主观原因不能由 API 填写',()=>{
  const actual=parseAnalysis(JSON.stringify({facts:{...facts,unfinished:{value:'已经上线',path:'fake.ts',quote:'已上线'},reason:{value:'作者懒惰',path:'README.md',quote:'雨天'}},review:[{text:'需要核对计划状态',path:'README.md',quote:'TODO：实时预报。'},{text:'完成所有功能',path:'README.md',quote:'完全实现'}],prop:'screen'}),project);
  assert.equal(actual.facts.reason.value,'');assert.equal(actual.facts.unfinished.value,'');assert.equal(actual.review!.items.length,1);assert(actual.review!.limits.some(n=>n.includes('2 条')));assert.equal(actual.facts.purpose.source,'analysis');
  const confirmed=confirmIdentity(actual,Object.fromEntries(fields.map(k=>[k,actual.facts[k].value])) as Record<Field,string>,actual.prop,actual.palette,actual.accessory);assert(sourceLabel(confirmed,confirmed.facts.purpose).includes('已核对'));
  assert.throws(()=>parseAnalysis('not json',project));assert.throws(()=>parseAnalysis(JSON.stringify({facts:{purpose:{value:'瞎编',path:'README.md',quote:'不存在'}}}),project));
});
test('GitHub 只接受明确仓库根地址，拒绝恶意域名、文件路径和带凭据地址',()=>{
  assert.equal(repoName('https://github.com/octocat/Hello-World.git'),'octocat/Hello-World');assert.equal(repoName('octocat/Hello-World'),'octocat/Hello-World');assert.equal(repoName('天气 app'),null);
  for(const url of ['https://github.com.evil/a/b','https://github.com/a/b/tree/main','http://github.com/a/b','https://secret@github.com/a/b','https://github.com/a/b?key=secret'])assert.throws(()=>repoName(url));
});
test('GitHub 没有 README 时明确降级；网络断开给出可恢复提示',async t=>{
  const stub=t.mock.method(globalThis,'fetch',async(input)=>String(input).endsWith('/readme')?new Response('{}',{status:404}):new Response(JSON.stringify({name:'demo',description:'说明',private:false})));
  const project=await readRepository('owner/demo',new AbortController().signal);assert.equal(project.files.length,1);assert(project.notes.some(n=>n.includes('README 未读取成功')));
  stub.mock.mockImplementation(async()=>{throw new TypeError('fetch failed');});await assert.rejects(readRepository('owner/demo',new AbortController().signal),/无法连接 GitHub/);
});
