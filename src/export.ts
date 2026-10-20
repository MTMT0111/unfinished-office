import { farewells, memorialDetail, safeFilename, type Identity } from './input.ts';
import { drawFarewell, drawKeepsake } from './scene.ts';
import { levels, type Journey } from './game.ts';
import { memoryBookHtml, rememberedPage, validateFarewellNote } from './memory.ts';
import { destinationCaption } from './destination.ts';

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
  drawFarewell(sc,frozen,2,0,record,1,undefined,[],2,true);
  const canvas=document.createElement('canvas');canvas.width=1152;
  const c=canvas.getContext('2d');if(!c)throw new Error('图片画布创建失败，请重试。');
  const font=(size:number)=>`${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  c.font=font(32);const title=wrap(c,frozen.facts.name.value,1008);
  const heroY=100+title.length*40;
  c.font=font(22);const letter=validateFarewellNote(record.farewellNote??''),letterLines=wrap(c,letter,1008);
  canvas.height=heroY+650+180+(letter?65+letterLines.length*32:0);
  c.fillStyle='#eee1c5';c.fillRect(0,0,1152,canvas.height);c.textBaseline='top';c.textAlign='left';
  c.fillStyle='#263c4e';c.fillRect(0,0,1152,9);c.fillStyle='#8a7965';c.font=font(14);c.fillText('烂尾事务所 / 同行纪念票'+(frozen.demo?' · 演示':''),48,28);c.textAlign='right';c.fillText(destinationCaption(frozen.destination),1104,28);c.textAlign='left';
  c.fillStyle='#302c3c';c.font=font(32);title.forEach((line,i)=>c.fillText(line,48,63+i*40));
  c.fillStyle='#786954';c.font=font(16);c.fillText(farewells[frozen.farewellIntent??'undecided'].label,48,heroY-25);
  c.textAlign='right';c.fillText(date?date.replace(/-/g,'.'):'留给这一程的你',1104,heroY-25);c.textAlign='left';
  c.imageSmoothingEnabled=false;c.drawImage(scene,48,heroY,1056,660);
  const y=heroY+710;
  c.strokeStyle='#b7a78c';c.setLineDash([3,7]);c.beginPath();c.moveTo(0,y-22);c.lineTo(1152,y-22);c.stroke();c.setLineDash([]);
  c.fillStyle='#152238';for(const x of [0,1152]){c.beginPath();c.arc(x,y-22,15,0,Math.PI*2);c.fill();}
  levels.forEach((_,i)=>{
    const x=48+i*72,visited=record.visited.includes(i);c.fillStyle=visited?'#6b8775':'#d5c7aa';c.fillRect(x-5,y-5,10,10);
    if(record.memories.includes(i))drawKeepsake(c,i,x,y,2);
  });
  const page=rememberedPage(frozen,record);
  c.fillStyle='#84735f';c.textAlign='right';
  if(page){
    c.font=font(13);c.fillText('想留下的这一页',1104,y-26);
    c.font=font(20);const lines=wrap(c,page.title,590);c.fillText(lines[0]+(lines.length>1?'…':''),1104,y-5);
  }else{c.font=font(20);c.fillText(frozen.farewellIntent&&frozen.farewellIntent!=='undecided'?farewells[frozen.farewellIntent].finale:record.skipped?'今天先到这里。谢谢你来过。':'谢谢你，陪它走完这一程。',1104,y-10);}
  c.textAlign='left';c.font=font(13);c.fillStyle='#8a7965';c.fillText(`${record.visited.length} / 7 站 · ${record.memories.length} 件回忆${record.citySecret?' · 城市灯语已点亮':''}`,48,y+45);c.textAlign='right';c.fillText('ONE MORE LITTLE JOURNEY',1104,y+45);
  if(letter){c.textAlign='left';c.font=font(14);c.fillText('你留给项目的短信',48,y+90);c.fillStyle='#51483f';c.font=font(22);letterLines.forEach((line,i)=>c.fillText(line,48,y+120+i*32));}
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('图片暂时没有生成，请重试。')),'image/png'));
  return {blob,filename:safeFilename(frozen.facts.name.value)};
}
export function createMemoryBook(identity:Identity,journey:Journey):{blob:Blob;filename:string}{
  memorialDetail(identity);
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=480;
  const c=canvas.getContext('2d');if(!c)throw new Error('回忆画面没有生成，请重试。');
  c.scale(2,2);c.imageSmoothingEnabled=false;drawFarewell(c,identity,2,0,journey,1,undefined,[],2,true);
  return {blob:new Blob([memoryBookHtml(identity,journey,canvas.toDataURL('image/png'))],{type:'text/html;charset=utf-8'}),filename:safeFilename(identity.facts.name.value).replace(/^纪念-/,'回忆册-').replace(/\.png$/,'.html')};
}
