import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readCompletion,responseLines} from '../src/stream.ts';

function streamed(text:string,fragment=7){
  const bytes=new TextEncoder().encode(text);let cursor=0;
  return new Response(new ReadableStream({pull(controller){
    if(cursor>=bytes.length){controller.close();return;}
    controller.enqueue(bytes.slice(cursor,cursor+fragment));cursor+=fragment;
  }}),{headers:{'Content-Type':'text/event-stream'}});
}
const event=(content:string,finish:string|null=null)=>'data: '+JSON.stringify({choices:[{delta:{content},finish_reason:finish}]})+'\r\n\r\n';
test('SSE 分片、中文边界、保活和结束标记正确处理，正文逐步到达',async()=>{
  const phases:string[]=[];let activity=0;
  const source=': keep-alive\r\n\r\n'+event('{"用途":"')+event('天气🌧️"}')+event('','stop')+'data: [DONE]\r\n\r\n';
  const content=await readCompletion(streamed(source,1),()=>activity++,(phase)=>phases.push(phase));
  assert.equal(content,'{"用途":"天气🌧️"}');assert(activity>100);assert(phases.includes('generating'));
});
test('非流式兼容响应与多行 SSE data 仍可读取',async()=>{
  const normal=new Response('\n\n'+JSON.stringify({choices:[{message:{content:'{"ok":true}'},finish_reason:'stop'}]}));
  assert.equal(await readCompletion(normal,()=>{},()=>{}),'{"ok":true}');
  const multi='data: {"choices":[\ndata: {"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n';
  assert.equal(await readCompletion(streamed(multi),()=>{},()=>{}),'ok');
});
test('不把空白、截断、断流和上游错误当成成功',async()=>{
  for(const [body,message] of [[event('','stop'),/没有返回分析正文/],[event('{','length'),/被截断/],[event('partial'),/提前结束/],['data: {"error":{"message":"private"}}\n\n',/生成中断/]] as const){
    await assert.rejects(readCompletion(streamed(body),()=>{},()=>{}),message);
  }
});
test('读完结束标记就释放连接；响应大小仍有限制',async()=>{
  let cancelled=false;
  const response=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(event('done','stop')));},cancel(){cancelled=true;}}),{headers:{'Content-Type':'text/event-stream'}});
  assert.equal(await readCompletion(response,()=>{},()=>{}),'done');assert(cancelled);
  await assert.rejects(async()=>{for await(const _ of responseLines(new Response('0123456789'),()=>{},4)){}},/响应过大/);
});
