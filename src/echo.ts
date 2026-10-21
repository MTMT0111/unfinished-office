import {positions, type Board, type Journey, type Level} from './game.ts';
import {sourceLabel, take, type Identity, type Field} from './input.ts';
import {commitUrl} from './project.ts';

export type Echo = {index:number;title:string;text:string;source:string;url?:string};
export function nearEcho(level:Level,board:Board):boolean{
  return board.found||positions(level,'m').some(p=>[board.you,board.ghost].some(actor=>Math.abs(p.x-actor.x)+Math.abs(p.y-actor.y)<=2));
}
export function projectEcho(id:Identity,index:number,journey:Journey):Echo{
  const excerpt=(text:string)=>take(text,420)+(Array.from(text).length>420?'\n…（节选）':'');
  const commit=index<5?id.milestones?.[index]:undefined;
  if(commit){
    const file=commit.changes?.find(file=>file.patch.trim());
    return {index,title:commit.subject,text:excerpt(file?.patch||commit.subject),source:`GitHub · ${commit.date} · ${commit.sha.slice(0,7)}${file?' · '+file.path+' · 差异节选':''}`,url:commitUrl(commit)??undefined};
  }
  const note=journey.notes[index]||(index===5?id.regret:index===6?journey.farewellNote:undefined);
  if(note)return {index,title:'你曾留下的话',text:excerpt(note),source:'你亲手写下的文字'};
  const file=index<5?id.sourceFiles?.[index]:undefined;
  if(file?.text.trim())return {index,title:file.path,text:excerpt(file.text),source:`项目原件 · ${file.path}${file.truncated?' · 已截取':''}`};
  const field:Field=(['purpose','completed','reason','purpose','unfinished','unfinished','reason'] as Field[])[index];
  const fact=id.facts[field];
  if(fact?.confirmed&&fact.source&&fact.value.trim())return {index,title:({purpose:'最初想做的事',completed:'已经留下的部分',reason:'停下来时的话',unfinished:'还没写完的那一页'} as Record<string,string>)[field],text:excerpt(fact.value),source:sourceLabel(id,fact)};
  return {index,title:'一段留白',text:'这一页没有带来原文。\n也可以为那些未被记录的时间，留一颗星。',source:'旅途象征 · 没有项目事实可摘录'};
}
export const echoRows=(journey:Pick<Journey,'echoes'>):Echo[]=>Object.values(journey.echoes??{}).sort((a,b)=>a.index-b.index);
export function echoPoint(echo:Echo):{x:number;y:number}{
  let seed=0;for(const char of echo.title+'\n'+echo.text)seed=(Math.imul(seed,31)+char.codePointAt(0)!)>>>0;
  return {x:35+echo.index*37,y:19+seed%36};
}
export function echoAt(journey:Journey,x:number,y:number):Echo|undefined{
  return echoRows(journey).find(echo=>{const p=echoPoint(echo);return Math.hypot(x-p.x,y-p.y)<=10;});
}
export function drawConstellation(c:CanvasRenderingContext2D,journey:Pick<Journey,'echoes'>,progress=1){
  const rows=echoRows(journey);if(!rows.length)return;
  c.save();c.lineWidth=.7;
  for(let i=0;i<rows.length;i++){
    const p=echoPoint(rows[i]),appear=Math.max(0,Math.min(1,progress*1.8-i*.1));
    c.globalAlpha=appear;
    if(i){const prev=echoPoint(rows[i-1]);c.strokeStyle='#72999e';c.beginPath();c.moveTo(prev.x,prev.y);c.lineTo(prev.x+(p.x-prev.x)*appear,prev.y+(p.y-prev.y)*appear);c.stroke();}
    c.fillStyle='#8ab8bc';c.globalAlpha=appear*.13;c.fillRect(p.x-7,p.y-7,15,15);c.globalAlpha=appear;
    c.fillStyle='#efc785';c.fillRect(p.x-3,p.y,7,1);c.fillRect(p.x,p.y-3,1,7);c.fillStyle='#fff4d8';c.fillRect(p.x-1,p.y-1,3,3);
  }
  c.restore();
}
export function drawEchoAtlas(c:CanvasRenderingContext2D,journey:Journey){
  const sky=c.createLinearGradient(0,0,0,120);sky.addColorStop(0,'#111a30');sky.addColorStop(1,'#304b5b');c.fillStyle=sky;c.fillRect(0,0,384,120);
  for(let i=0;i<60;i++){c.fillStyle=i%3?'#587187':'#a1b4b7';c.fillRect((i*61+17)%384,(i*19+7)%86,1,1);}
  c.fillStyle='#d2d5bb';c.fillRect(318,16,16,16);c.fillStyle='#182c3f';c.fillRect(312,13,16,14);
  for(let i=0;i<24;i++){c.fillStyle=i%2?'#243b4c':'#203246';c.fillRect(i*17,83+i%4*4,17,40);}
  c.fillStyle='#6e8786';c.fillRect(287,88,52,3);c.fillStyle='#324858';c.fillRect(294,72,37,16);c.fillRect(299,66,27,6);c.fillRect(306,62,13,4);
  c.fillStyle='#efc785';c.fillRect(310,76,5,12);c.fillStyle='#8faaa5';c.fillRect(280,101,63,1);c.fillRect(274,112,76,1);
  drawConstellation(c,journey);
}
export function drawEcho(c:CanvasRenderingContext2D,echo:Echo,progress:number){
  const p=Math.max(0,Math.min(1,progress)),rise=p*p*(3-2*p);
  c.clearRect(0,0,384,180);c.fillStyle='#101b2f';c.fillRect(0,0,384,180);
  for(let i=0;i<48;i++){c.fillStyle=i%3?'#495e78':'#92a9b4';c.fillRect((i*71+13)%384,(i*29+11)%155,1,1);}
  c.fillStyle='#243c4e';c.fillRect(0,154,384,26);c.fillStyle='#71858b';c.fillRect(0,154,384,1);
  c.save();c.globalAlpha=1-rise;c.fillStyle='#b8c9c4';c.fillRect(113,87,158,59);c.fillStyle='#e0e3d4';c.fillRect(116,84,152,59);
  c.fillStyle='#344b59';c.font='8px monospace';
  const chars=Array.from(echo.text.replace(/\s+/g,' ')).slice(0,54);
  for(let i=0;i<chars.length;i++)c.fillText(chars[i],125+i%18*7,101+Math.floor(i/18)*12);
  c.restore();
  const star=echoPoint(echo);
  for(let i=0;i<32;i++){
    const x=125+i%18*7,y=101+Math.floor(i/18)*12;
    const t=Math.max(0,Math.min(1,(p-i*.009)/.7)),q=t*t*(3-2*t);
    c.globalAlpha=p>0?Math.sin(t*Math.PI)*.8:0;c.fillStyle=i%2?'#efc785':'#8ec9b5';
    const px=x+(star.x-x)*q+Math.sin(q*Math.PI)*22,py=y+(star.y-y)*q-Math.sin(q*Math.PI)*30;
    if(t<.65&&chars[i]){c.font='7px monospace';c.fillText(chars[i],px,py);}else c.fillRect(px,py,2,2);
  }
  c.globalAlpha=1;
  if(p>.3)drawConstellation(c,{echoes:{[echo.index]:echo}},(p-.3)/.7);
  c.fillStyle='#a6bebc';c.font='9px "Microsoft YaHei", sans-serif';c.textAlign='center';c.fillText(p===1?'走过的，留下了一点光。':'纸页里，像有很轻的回声。',192,170);c.textAlign='left';
}
