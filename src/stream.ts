export async function* responseLines(response:Response,onActivity=()=>{},maxBytes=1024*1024):AsyncGenerator<string>{
  const reader=response.body?.getReader();if(!reader)throw new Error('API 返回空响应。');
  const decoder=new TextDecoder();let pending='',bytes=0;
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done){pending+=decoder.decode();break;}
      bytes+=value.length;if(bytes>maxBytes)throw new Error('API 响应过大，请减少材料后重试。');
      if(value.length)onActivity();pending+=decoder.decode(value,{stream:true});
      let end;
      while((end=pending.indexOf('\n'))>=0){yield pending.slice(0,end).replace(/\r$/,'');pending=pending.slice(end+1);}
    }
    if(pending)yield pending.replace(/\r$/,'');
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

export async function readCompletion(response:Response,onActivity:()=>void,onProgress:(stage:string,characters:number)=>void):Promise<string>{
  let content='',finish:string|null=null;
  function accept(choice:any,streaming:boolean){
    const message=streaming?choice?.delta:choice?.message;
    if(typeof message?.content==='string'){
      content+=message.content;
      if(content.trim())onProgress('generating',content.length);
    }
    if(message?.reasoning_content)onProgress('thinking',content.length);
    if(choice?.finish_reason)finish=choice.finish_reason;
  }
  function completed(){
    if(finish==='length')throw new Error('API 输出被截断，请减少所选材料后重试。');
    if(finish==='content_filter')throw new Error('API 未能输出这份材料的档案，请调整材料后重试。');
    if(!content.trim())throw new Error('API 没有返回分析正文，请重试。');
    return content;
  }
  if(!response.headers.get('content-type')?.includes('text/event-stream')){
    const lines=[];for await(const line of responseLines(response,onActivity,128*1024))lines.push(line);
    const result=JSON.parse(lines.join('\n'));if(result.error)throw new Error('API 返回错误，未生成档案。请检查模型设置或稍后重试。');
    accept(result.choices?.[0],false);return completed();
  }
  let data:string[]=[];
  function event(){
    const text=data.join('\n');data=[];
    if(!text)return false;if(text==='[DONE]')return true;
    const result=JSON.parse(text);
    if(result.error)throw new Error('API 生成中断，材料已保留，请稍后重试。');
    accept(result.choices?.[0],true);return finish!==null;
  }
  for await(const line of responseLines(response,onActivity)){
    if(line.startsWith('data:'))data.push(line.slice(5).replace(/^ /,''));
    else if(line===''&&event())return completed();
  }
  if(data.length&&event())return completed();
  throw new Error('API 连接提前结束，未收到完整档案。材料已保留，请重试。');
}
