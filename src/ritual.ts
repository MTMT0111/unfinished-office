import {count,farewells,sourceLabel,type FarewellIntent,type Identity} from './input.ts';
import type {Journey} from './game.ts';
import {relicRows} from './relics.ts';

type Light={key:string;title:string;source:string;url?:string|null};
export type Ritual={laid:boolean;lightKey:string;signature:string;sealed?:{intent:FarewellIntent;unfinished:string;light:Light;signature:string}};
export function unfinishedPage(identity:Identity):string {
  const fact=identity.facts.unfinished;
  return fact.value&&fact.confirmed&&fact.source?fact.value:'这份资料没有说明未竟之处。这一页，先留白。';
}
export function ritualLights(identity:Identity,journey:Journey):Light[]{
  const items:Light[]=relicRows(identity,journey).map(row=>({key:'relic:'+row.index,title:row.path,source:row.source,url:row.url}));
  const completed=identity.facts.completed;
  if(completed.value&&completed.confirmed&&completed.source)items.push({key:'completed',title:completed.value,source:sourceLabel(identity,completed)});
  if(identity.regret)items.push({key:'personal',title:identity.regret,source:'你在出发前写下的心意'});
  items.push({key:'quiet',title:'为这段投入，留一盏灯',source:'仪式中的象征 · 不代表完成了任何功能'});
  return items;
}
export function sealRitual(identity:Identity,journey:Journey):void {
  const ritual=journey.ritual;
  if(!ritual?.laid)throw new Error('先把未竟之事安放好。');
  const light=ritualLights(identity,journey).find(item=>item.key===ritual.lightKey);
  if(!light)throw new Error('选择一件值得留下的东西，或为这段投入留一盏灯。');
  const signature=ritual.signature.trim();if(count(signature)>24)throw new Error('落款请写在 24 字以内，也可以不署名。');
  // Preserve what was acknowledged at the ceremony, even if memories are edited later.
  ritual.sealed={intent:identity.farewellIntent??'undecided',unfinished:unfinishedPage(identity),light:{...light},signature};
}
export function ritualLines(journey:Journey):string[]{
  const record=journey.ritual?.sealed;if(!record)return [];
  return [farewells[record.intent].finale,`未竟之事：${record.unfinished}`,`灯下留下：${record.light.title}`,`依据：${record.light.source}`,`落款：${record.signature||'不署名，心意已经留下'}`];
}

export function drawRitual(c:CanvasRenderingContext2D,identity:Identity,journey:Journey,step:number,progress=1){
  const q=Math.max(0,Math.min(1,progress)),r=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
  c.imageSmoothingEnabled=false;r(0,0,384,180,'#162333');
  r(28,19,328,98,'#20394a');r(32,23,320,90,'#172b3b');
  for(let i=0;i<25;i++)r(40+(i*53)%300,30+(i*17)%67,1,1,'#789195');
  r(38,110,308,5,'#8b7767');r(0,137,384,43,'#655456');r(0,139,384,2,'#ae8e72');
  const fold=journey.ritual?.laid?step===1&&!journey.ritual.lightKey?q:1:0;
  const paperY=72+fold*43,paperHeight=55-fold*31;
  r(48,paperY,104,paperHeight,'#e9dcc0');r(51,paperY+2,98,2,'#f9edcc');
  if(fold<.7){c.fillStyle='#6c625b';c.font='8px "Microsoft YaHei",sans-serif';c.fillText('未竟之事',60,paperY+15);for(let i=0;i<3;i++)r(60,paperY+23+i*7,65-i*9,1,'#b1a18b');}
  else{r(95,paperY+7,10,8,'#b58b7f');r(99,paperY+8,2,6,'#ead5ad');}
  r(205,103,17,34,'#d6c9ae');r(204,135,20,3,'#9a8672');
  if(journey.ritual?.lightKey){
    const glow=step===1?q:1;c.save();c.globalAlpha=.13*glow;c.fillStyle='#f2c879';c.beginPath();c.arc(213,94,32,0,Math.PI*2);c.fill();c.restore();
    r(210,89,7,13,'#d99c60');r(212,85,3,15,'#ffe3a3');
  }else r(213,97,1,6,'#8c7771');
  r(263,120,64,17,'#304857');r(266,122,58,12,'#d5c5a9');
  c.fillStyle='#5c6061';c.font='6px "Microsoft YaHei",sans-serif';c.fillText(Array.from(identity.facts.name.value).slice(0,9).join(''),270,130);
  if(step===2){r(274,57,42,49,'#eee1c5');for(let i=0;i<4;i++)r(280,66+i*6,29-i*3,1,'#b0a08b');r(298,87,10,10,'#a96b66');r(300,89,6,6,'#ead6b5');}
  r(0,172,384,8,'#142230');
}
