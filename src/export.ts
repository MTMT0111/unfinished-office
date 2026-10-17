import { memorialDetail, safeFilename, type Identity } from './input.ts';
import { drawFarewell, drawKeepsake } from './scene.ts';
import { levels, type Journey } from './game.ts';
import { memoryBookHtml, rememberedPage } from './memory.ts';

export function localDate(now=new Date()):string{
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function wrap(c:CanvasRenderingContext2D,text:string,width:number):string[]{
  const result:string[]=[];let line='';
  for(const char of Array.from(text)){
    if(char==='\n'){result.push(line);line='';continue;}
    if(line&&c.measureText(line+char).width>width){result.push(line);line=char;}else line+=char;
  }
  if(line)result.push(line);return result;
}
export async function createMemorial(identity:Identity,date:string|null,journey:Journey):Promise<{blob:Blob;filename:string}>{
  const frozen=structuredClone(identity),record=structuredClone(journey);memorialDetail(frozen);
  if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('请选择有效的保留日期。');
  await document.fonts.ready;
  const scene=document.createElement('canvas');scene.width=384;scene.height=240;
  const sc=scene.getContext('2d');if(!sc)throw new Error('浏览器暂时无法绘制图片，请重试。');
  drawFarewell(sc,frozen,2,0,record,1);
  const canvas=document.createElement('canvas');canvas.width=1152;
  const c=canvas.getContext('2d');if(!c)throw new Error('图片画布创建失败，请重试。');
  const font=(size:number)=>`${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  c.font=font(32);const title=wrap(c,frozen.facts.name.value,1008);
  const heroY=70+title.length*40;
  canvas.height=heroY+720+110;
  c.fillStyle='#eee1c5';c.fillRect(0,0,1152,canvas.height);c.textBaseline='top';c.textAlign='left';
  c.fillStyle='#8a7965';c.font=font(14);c.fillText('烂尾事务所'+(frozen.demo?' · 演示':''),48,20);c.textAlign='right';if(date)c.fillText(date.replace(/-/g,'.'),1104,20);c.textAlign='left';
  c.fillStyle='#302c3c';c.font=font(32);title.forEach((line,i)=>c.fillText(line,48,49+i*40));
  c.imageSmoothingEnabled=false;c.drawImage(scene,0,heroY,1152,720);
  const y=heroY+766;
  c.strokeStyle='#b7a78c';c.setLineDash([2,7]);c.beginPath();c.moveTo(48,y);c.lineTo(410,y);c.stroke();c.setLineDash([]);
  levels.forEach((_,i)=>{
    const x=48+i*72,visited=record.visited.includes(i);c.fillStyle=visited?'#6b8775':'#d5c7aa';c.fillRect(x-5,y-5,10,10);
    if(record.memories.includes(i))drawKeepsake(c,i,x,y,2);
  });
  const page=rememberedPage(frozen,record);
  c.fillStyle='#84735f';c.textAlign='right';
  if(page){
    c.font=font(13);c.fillText('想留下的这一页',1104,y-26);
    c.font=font(20);const lines=wrap(c,page.title,590);c.fillText(lines[0]+(lines.length>1?'…':''),1104,y-5);
  }else{c.font=font(20);c.fillText(record.skipped?'今天先到这里。谢谢你来过。':'谢谢你，陪它走完这一程。',1104,y-10);}
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('图片暂时没有生成，请重试。')),'image/png'));
  return {blob,filename:safeFilename(frozen.facts.name.value)};
}
export function createMemoryBook(identity:Identity,journey:Journey):{blob:Blob;filename:string}{
  memorialDetail(identity);
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=480;
  const c=canvas.getContext('2d');if(!c)throw new Error('回忆画面没有生成，请重试。');
  c.scale(2,2);c.imageSmoothingEnabled=false;drawFarewell(c,identity,2,0,journey,1);
  return {blob:new Blob([memoryBookHtml(identity,journey,canvas.toDataURL('image/png'))],{type:'text/html;charset=utf-8'}),filename:safeFilename(identity.facts.name.value).replace(/^纪念-/,'回忆册-').replace(/\.png$/,'.html')};
}
