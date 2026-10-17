import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const address='http://127.0.0.1:4188';
async function running(){
  try{const r=await fetch(address+'/api/config',{signal:AbortSignal.timeout(1500)});return (await r.json()).app==='unfinished-office';}catch{return false;}
}
try{
  if(!fs.existsSync(path.join(root,'dist/index.html')))throw new Error('没有找到构建页面。请先在项目目录运行 npm run build。');
  if(!await running()){
    const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,detached:true,stdio:'ignore',windowsHide:true});child.unref();
    for(let i=0;i<20&&!await running();i++)await new Promise(r=>setTimeout(r,250));
  }
  if(!await running())throw new Error('服务未能启动。4188 端口可能被其他程序占用，请检查后重新双击。');
  console.log('已启动：'+address);
  if(!process.argv.includes('--no-open'))spawn('cmd.exe',['/c','start','',address],{stdio:'ignore',windowsHide:true}).unref();
}catch(error){console.error(error.message);process.exitCode=1;}
