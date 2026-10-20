import { gateOpen, levels, positions, same, tile, type Board, type Point, type Journey } from './game.ts';
import type { GitMilestone, Identity } from './input.ts';
import { keepsakeTopic } from './memory.ts';
import { drawCity, drawFireworks } from './destination.ts';

export const WIDTH=384,HEIGHT=240,CELL=24,OX=84,OY=35;
export const ease=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
export function recalledKeepsake(items:number[],departure:number):number|undefined{
  const step=Math.floor((departure-.08)/.045);
  return step>=0&&step<items.length?items[step]:undefined;
}
export type Motion={from:Board; at:number; bump?:Point};
export type Pulse={point:Point;at:number;kind:'light'|'packed'};
export type StationRipple={x:number;y:number;at:number;kind:'water'|'memory'};
const colors={night:'#14182c',ink:'#1d2436',cream:'#f5eada',gold:'#efc785',mint:'#8ec9b5',rose:'#ce8c95'};
const backgrounds=new Map<number,HTMLCanvasElement>();
function rect(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}
function tree(c:CanvasRenderingContext2D,x:number,y:number,size:number,tint:string){
  rect(c,x-2,y,4,size*.8,'#343447');
  for(let i=0;i<4;i++){const w=size*(.45+i*.17);rect(c,x-w/2,y-size*.62+i*size*.17,w,size*.28,tint);}
  rect(c,x-3,y-size*.6,2,size*.4,'#49605c');
}
function background(c:CanvasRenderingContext2D,index:number){
  const theme=levels[index].theme;
  rect(c,0,0,WIDTH,HEIGHT,theme==='forest'?'#1c2838':theme==='river'?'#17283b':theme==='workshop'?'#182737':'#24243a');
  for(let i=0;i<38;i++){const x=(i*97+23)%384,y=(i*31+7)%65;rect(c,x,y,1,i%3===0?2:1,i%4===0?'#b4bec6':'#4d596e');}
  rect(c,318,17,19,20,'#b1c5c2');rect(c,315,21,24,12,'#b1c5c2');rect(c,315,17,15,16,theme==='station'?'#24243a':'#1c2c3f');
  for(let i=0;i<16;i++)tree(c,i*27-10,75+((i*13)%24),35+(i%3)*10,'#263f46');
  rect(c,0,98,384,142,theme==='station'?'#343447':theme==='workshop'?'#263b45':'#263d40');
  if(theme==='river'){
    rect(c,0,150,384,90,'#203d53');
    for(let i=0;i<40;i++)rect(c,(i*41)%384,157+(i*13)%80,5+(i%5),1,'#30566c');
  }
  if(theme==='station'){
    for(const y of [211,224]){rect(c,0,y,384,2,'#7c7884');rect(c,0,y+2,384,2,'#191f30');}
    for(let x=0;x<384;x+=14)rect(c,x,207,6,24,'#5b4d55');
    for(const y of [211,224])rect(c,0,y,384,2,'#97909a');
    rect(c,15,72,49,9,'#624c5b');rect(c,19,82,3,66,'#96706a');rect(c,56,82,3,66,'#96706a');
    rect(c,24,87,28,21,'#292d43');rect(c,29,91,18,2,'#c5a98c');rect(c,29,97,12,2,'#8b7880');
    rect(c,322,96,43,4,'#8d6a68');rect(c,326,100,3,42,'#534a5a');rect(c,357,100,3,42,'#534a5a');
    rect(c,321,112,42,5,'#b28672');
  }else{
    for(let i=0;i<12;i++){
      const left=i<6,x=left?12+(i*19)%57:319+(i*17)%55,y=88+(i*29)%119;
      tree(c,x,y,28+(i%3)*8,i%2?'#35544d':'#304746');
    }
  }
  if(theme==='garden'){
    rect(c,6,51,74,135,'#243d46');rect(c,7,51,72,3,'#759e90');
    for(const x of [8,32,56,78])rect(c,x,53,2,132,'#6a8f85');
    for(const y of [89,127,165]){rect(c,8,y,70,2,'#5b827d');for(const x of [17,41,65]){rect(c,x,y+26,10,9,'#b08370');rect(c,x+4,y+10,2,16,'#8cbaa0');rect(c,x,y+14,6,4,'#76ac93');rect(c,x+6,y+9,6,4,'#a8c596');}}
    for(let i=0;i<5;i++){const x=322+(i%2)*29,y=99+i*19;rect(c,x,y,18,12,'#a57a70');tree(c,x+9,y-5,16,'#6c997d');}
  }
  if(theme==='rooftop'){
    rect(c,0,101,80,82,'#303a52');rect(c,310,83,74,112,'#303a52');
    for(let i=0;i<18;i++){const x=i<9?11+(i%3)*23:321+(i%3)*23,y=110+(i%3)*26+Math.floor(i/3)%3*4;rect(c,x,y,7,9,i%4?'#5c6678':'#cfb68b');}
    rect(c,0,193,384,4,'#79737d');for(let x=0;x<384;x+=18)rect(c,x,196,3,18,'#4c4f63');
    rect(c,17,48,2,45,'#9f9190');rect(c,9,55,18,2,'#9f9190');rect(c,22,50,1,15,'#9f9190');
  }
  if(theme==='library'){
    rect(c,0,0,384,64,'#2b293c');rect(c,0,64,384,2,'#8e6b64');
    for(const x of [9,321]){rect(c,x,72,53,124,'#463c4d');for(let j=0;j<4;j++){const y=81+j*27;for(let i=0;i<6;i++)rect(c,x+5+i*7,y+(i%3)*2,5,18-(i%3)*2,['#a27872','#879f9d','#c2ae85'][i%3]);rect(c,x+3,y+20,47,3,'#a08170');}}
    rect(c,130,14,124,26,'#263b4a');rect(c,139,21,106,12,'#364e5c');
  }
  if(theme==='workshop'){
    rect(c,8,52,73,55,'#334352');rect(c,11,55,67,47,'#132638');rect(c,16,61,57,2,'#52788b');
    for(let i=0;i<5;i++){rect(c,17,68+i*6,5,3,i===4?'#d2b77f':'#81b5ca');rect(c,26,68+i*6,42-i%2*9,2,'#547285');}
    rect(c,13,111,62,4,'#82706b');rect(c,316,50,60,56,'#3a4248');rect(c,320,54,52,48,'#202f3b');
    for(let i=0;i<4;i++){rect(c,325,60+i*9,37,2,'#657c79');rect(c,325,64+i*9,9+(i%2)*7,3,i%2?'#d0b87f':'#83ad9e');}
    rect(c,309,108,69,5,'#8c7470');rect(c,328,114,4,23,'#685a61');rect(c,357,114,4,23,'#685a61');
  }
  // Raised island edge anchors the puzzle to the illustrated environment.
  rect(c,OX+19,OY+29,178,130,'#182c33');rect(c,OX+22,OY+25,172,130,'#5b5b5b');
  for(let y=1;y<6;y++)for(let x=1;x<8;x++){
    const t=levels[index].map[y][x],px=OX+x*CELL,py=OY+y*CELL;
    if(t==='#'){
      rect(c,px,py,CELL,CELL,'#344248');rect(c,px+2,py-5,20,24,'#505b5a');rect(c,px+4,py-5,17,3,'#738078');
      rect(c,px+8,py+4,10,2,'#65706a');continue;
    }
    const floor=theme==='station'?'#665962':theme==='river'?'#536764':'#52685b';
    if(t==='~'){rect(c,px,py,CELL,CELL,'#264e64');continue;}
    rect(c,px,py,24,24,'#384c49');rect(c,px+1,py+1,22,21,floor);
    rect(c,px+3,py+3,5,1,theme==='station'?'#85717a':'#71806b');
    if((x+y)%3===0)rect(c,px+14,py+18,5,1,'#3b514e');
  }
  for(const [x,y] of [[73,177],[306,179]]){
    rect(c,x,y-32,3,33,'#7c7373');rect(c,x-4,y-38,11,9,'#d8b67e');rect(c,x-2,y-36,7,5,'#fae4a9');rect(c,x-5,y-40,13,2,'#4e4b5a');
    rect(c,x-5,y,12,3,'#29383f');
  }
  for(let i=0;i<40;i++){
    const x=(i*73+11)%384,y=186+(i*19)%54;
    if(theme==='station'&&y>207)continue;
    rect(c,x,y,2,4,'#507369');if(i%3===0)rect(c,x-1,y-1,4,2,'#9d9d7c');
  }
}
function star(c:CanvasRenderingContext2D,x:number,y:number,color:string,size=1){
  rect(c,x-3*size,y,7*size,size,color);rect(c,x,y-3*size,size,7*size,color);rect(c,x-size,y-size,3*size,3*size,color);
}
export function drawKeepsake(c:CanvasRenderingContext2D,index:number,x:number,y:number,scale=1,topic=''){
  c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale,scale);
  const r=(x:number,y:number,w:number,h:number,color:string)=>rect(c,x,y,w,h,color);
  const palette=['#efc785','#8ec9b5','#98bfd6','#ce8c95','#d8c7a3'],tone=topic?palette[[...topic].reduce((sum,letter)=>sum+(letter.codePointAt(0)??0),0)%palette.length]:colors.gold;
  if(index===0){star(c,0,0,tone);r(-1,-1,3,3,colors.cream);}
  if(index===1){r(-4,-6,7,10,tone);r(-6,-3,3,5,tone);r(2,-5,3,6,tone);r(0,-3,1,10,'#547e72');r(-3,0,3,1,'#547e72');}
  if(index===2){r(-6,-5,7,7,tone);r(-4,-3,3,3,colors.ink);r(0,-1,7,3,tone);r(4,1,2,3,tone);}
  if(index===3){r(-5,-7,11,14,tone);r(3,-7,3,3,'#b7a68c');r(-3,-3,5,1,'#b7a68c');r(-3,0,3,1,'#b7a68c');}
  if(index===4){for(let i=0;i<8;i++){const a=i*Math.PI/4;r(Math.cos(a)*6-1,Math.sin(a)*6-1,3,3,tone);}r(-3,-3,7,7,'#657f83');r(-1,-1,3,3,colors.gold);}
  if(index===5){r(-7,-5,14,10,'#dbb48b');r(-6,-4,3,2,colors.cream);r(3,-4,3,2,colors.cream);r(-3,-2,6,2,colors.cream);r(-1,0,3,3,colors.rose);}
  if(index===6){r(-7,-5,14,10,colors.gold);r(-7,-1,2,2,colors.ink);r(5,-1,2,2,colors.ink);r(1,-4,1,8,'#b58c75');r(-4,-2,3,1,'#8b7164');r(-4,1,3,1,'#8b7164');}
  c.restore();
}
function travelCase(c:CanvasRenderingContext2D,items:number[],x:number,y:number,id:Identity,selected?:number,recalled?:number){
  rect(c,x+21,y-7,16,3,'#d3aa83');rect(c,x+20,y-4,3,4,'#d3aa83');rect(c,x+34,y-4,3,4,'#d3aa83');
  rect(c,x-2,y,61,41,'#483e4a');rect(c,x,y,57,38,'#ae816b');rect(c,x+2,y+2,53,34,'#594b54');
  for(let i=0;i<7;i++){
    const px=x+8+(i%4)*13.5,py=y+10+Math.floor(i/4)*16;
    rect(c,px-5.5,py-7,12,14,'#66545b');
    if(items.includes(i))drawKeepsake(c,i,px,py,.72,keepsakeTopic(id,i).text);else rect(c,px-2,py,4,1,'#998075');
    if(selected===i){c.strokeStyle=colors.gold;c.lineWidth=1;c.strokeRect(Math.round(px-6),Math.round(py-7),12,14);}
    if(recalled===i){c.strokeStyle=colors.cream;c.lineWidth=1;c.strokeRect(Math.round(px-6),Math.round(py-7),12,14);star(c,px+5,py-7,colors.mint,.55);}
  }
}
function prop(c:CanvasRenderingContext2D,id:Identity,x:number,y:number){
  const r=(a:number,b:number,w:number,h:number,color:string)=>rect(c,x+a,y+b,w,h,color);
  switch(id.prop){
    case 'umbrella':r(-7,-6,14,3,colors.gold);r(-4,-9,8,3,colors.gold);r(0,-3,1,10,colors.cream);r(-3,7,4,1,colors.cream);break;
    case 'manuscript':case 'draft':r(-6,-7,12,15,colors.cream);r(-4,-4,7,1,'#8d8390');r(-4,-1,6,1,'#8d8390');r(-4,2,id.prop==='draft'?3:7,1,'#8d8390');break;
    case 'screen':r(-7,-6,14,11,'#222b3d');r(-5,-4,10,6,colors.mint);r(-2,5,4,3,'#9a929e');break;
    case 'camera':r(-7,-4,14,10,'#a394a3');r(-3,-7,7,3,'#a394a3');r(-2,-2,5,5,'#273448');r(-1,-1,2,2,colors.mint);break;
    case 'sprout':r(-5,1,10,7,'#b88370');r(0,-7,1,8,colors.mint);r(-5,-8,5,3,colors.mint);r(1,-5,5,3,colors.mint);break;
    case 'record':r(-5,-7,10,14,'#242d42');r(-7,-5,14,10,'#242d42');r(-2,-2,5,5,colors.rose);r(0,0,1,1,colors.gold);break;
  }
}
function person(c:CanvasRenderingContext2D,id:Identity,kind:'you'|'ghost',x:number,y:number,time:number,walking:number,active:boolean,cheer=false,carryProp=true){
  c.save();c.translate(Math.round(x),Math.round(y));
  rect(c,-8,5,17,4,'#283c3f');
  const bob=kind==='ghost'?Math.sin(time*2.8)*1.3:-Math.sin(walking*Math.PI)*2;
  c.translate(0,Math.round(bob));
  if(kind==='ghost'){
    const cream=id.palette==='lavender'?'#e1d2ed':id.palette==='mint'?'#d4e9dc':colors.cream;
    rect(c,-5,-15,11,3,cream);rect(c,-8,-12,17,14,cream);rect(c,-6,2,4,3,cream);rect(c,1,2,4,3,cream);rect(c,6,1,3,2,cream);
    rect(c,6,-10,3,10,'#b9acbf');rect(c,-5,-5,2,1,colors.rose);rect(c,4,-5,2,1,colors.rose);
    const blink=time%4.3>4.08;rect(c,-4,-9,2,blink?1:3,colors.ink);rect(c,3,-9,2,blink?1:3,colors.ink);
    if(cheer){rect(c,-12,-11,5,3,cream);rect(c,9,-14,4,3,cream);}else rect(c,-11,-3,4,3,cream);
    if(id.accessory==='hat'){rect(c,-6,-19,12,4,'#685b78');rect(c,-9,-15,18,2,colors.gold);}
    if(id.accessory==='bow'){rect(c,-3,-1,3,3,colors.rose);rect(c,1,-1,3,3,colors.rose);}
    if(!cheer&&carryProp)prop(c,id,12,-1);
  }else{
    rect(c,-6,-10,12,12,'#c38b75');rect(c,-5,-18,10,9,'#edc6a3');rect(c,-7,-20,13,5,'#4c4252');rect(c,-8,-16,17,2,'#4c4252');
    rect(c,2,-14,2,2,colors.ink);rect(c,-7,-9,13,3,colors.gold);rect(c,-8,-6,3,6,colors.gold);
    rect(c,-5,2,4,5+(walking>.5?1:0),'#282e42');rect(c,2,2,4,5+(walking<.5?1:0),'#282e42');
    if(cheer)rect(c,7,-14,3,6,'#edc6a3');else rect(c,6,-7,3,6,'#edc6a3');
  }
  if(active){rect(c,-2,-28,5,2,kind==='you'?colors.gold:colors.mint);rect(c,-1,-26,3,2,kind==='you'?colors.gold:colors.mint);rect(c,0,-24,1,1,kind==='you'?colors.gold:colors.mint);}
  c.restore();
}
export function drawScene(c:CanvasRenderingContext2D,id:Identity,board:Board,index:number,time:number,motion?:Motion,options:{won?:boolean;reduced?:boolean;hint?:Point;dark?:number;journey?:Journey;pickupAt?:number;guides?:Point[];pulses?:Pulse[];selectedParcel?:number}={}){
  const level=levels[index];c.imageSmoothingEnabled=false;
  let bg=backgrounds.get(index);if(!bg){bg=document.createElement('canvas');bg.width=WIDTH;bg.height=HEIGHT;background(bg.getContext('2d')!,index);backgrounds.set(index,bg);}
  c.drawImage(bg,0,0);const clock=options.reduced?0:time;
  if(id.destination)drawCity(c,id.destination,clock,true);
  const r=(x:number,y:number,w:number,h:number,color:string)=>rect(c,x,y,w,h,color);
  for(let y=1;y<6;y++)for(let x=1;x<8;x++){
    const t=tile(level,{x,y}),px=OX+x*CELL,py=OY+y*CELL;
    if(t==='~'){for(let k=0;k<3;k++)r(px+3+(k*7+Math.floor(clock*4))%15,py+5+k*6,5,1,k%2?'#47768a':'#365f77');}
    if(t==='t'||t==='r'){
      c.strokeStyle=t==='r'?colors.mint:colors.gold;c.lineWidth=1;c.strokeRect(px+3.5,py+3.5,17,16);
      if(level.theme==='library'){
        if(t==='t'){for(let k=0;k<3;k++)r(px+6+k*4,py+7,3,8,['#dbb48b','#a8c1b3','#d4aaa2'][k]);r(px+5,py+16,14,2,colors.gold);}
        else{r(px+7,py+8,11,8,colors.mint);r(px+10,py+5,5,3,colors.mint);r(px+12,py+10,2,5,'#517768');}
      }else r(px+9,py+9,6,5,'#927d63');
    }
    if(t==='s'){
      const on=gateOpen(level,board);r(px+5,py+7,14,10,on?colors.mint:'#83928a');r(px+8,py+5,8,14,on?colors.mint:'#83928a');r(px+9,py+9,6,6,on?'#e8e6b6':'#354b4e');
    }
    if(t==='a'){
      const lit=board.lit.some(p=>same(p,{x,y}));
      if(lit){c.save();c.globalAlpha=.10+Math.sin(clock*2+x)*.025;r(px-4,py-4,32,28,colors.gold);r(px+1,py,22,20,colors.gold);c.restore();}
      r(px+5,py+17,14,3,lit?'#b4b998':'#596b71');r(px+11,py+10,3,7,'#81918b');
      r(px+7,py+2,11,11,lit?'#c79f6e':'#627477');r(px+9,py+4,7,7,lit?'#ffe4a3':'#253b48');r(px+8,py,9,2,lit?colors.gold:'#788a89');
      if(lit){r(px+11,py+5,3,4,'#fff4d4');r(px+9,py+14,7,1,colors.gold);}
      else if(board.active==='ghost'){r(px+11,py-5+Math.sin(clock*3),3,2,colors.mint);}
    }
    if(t==='d'){
      if(gateOpen(level,board)){r(px+1,py+1,22,22,'#a38f74');for(let a=3;a<24;a+=6)r(px+a,py+2,1,20,'#6b625c');r(px+2,py+1,2,3,colors.mint);}
      else{r(px+2,py+4,20,18,'#253e51');r(px+2,py-3,3,25,'#b88677');r(px+19,py-3,3,25,'#b88677');r(px+2,py+4,20,3,'#d3a38c');r(px+3,py+15,18,3,'#9c776d');}
    }
    if(t==='e'||t==='o'){
      const col=t==='e'?colors.gold:colors.mint;r(px+5,py+6,4,7,col);r(px+14,py+9,4,7,col);
      if(t==='o'){r(px+6,py+5,2,1,col);r(px+15,py+8,2,1,col);}
    }
    if(t==='m'&&!board.found)drawKeepsake(c,index,px+12,py+10+Math.sin(clock*3)*2,1,keepsakeTopic(id,index).text);
  }
  for(const p of options.guides??[])r(OX+p.x*CELL+10,OY+p.y*CELL+21,4,2,board.active==='you'?colors.gold:colors.mint);
  if(options.hint){const p=options.hint;c.strokeStyle=colors.cream;c.lineWidth=2;c.strokeRect(OX+p.x*CELL+2,OY+p.y*CELL+2,20,20);}
  const progress=options.reduced?1:motion?ease((time-motion.at)/.16):1;
  const point=(to:Point,from:Point)=>({x:OX+(from.x+(to.x-from.x)*progress)*CELL+12,y:OY+(from.y+(to.y-from.y)*progress)*CELL+14});
  board.boxes.forEach((box,i)=>{
    const p=point(box,motion?.from.boxes[i]??box),on=['t','r'].includes(tile(level,box));
    r(p.x-10,p.y-7,20,17,'#483e4a');r(p.x-10,p.y-10,20,14,on?'#b9a574':'#a77c68');r(p.x-8,p.y-8,16,2,on?colors.gold:'#d5a786');r(p.x-2,p.y-8,3,13,'#69545b');r(p.x-5,p.y-4,10,5,on?colors.mint:colors.cream);
    drawKeepsake(c,index,p.x,p.y-2,1,keepsakeTopic(id,index).text);
    if(board.boxes.length>1||options.selectedParcel===i){r(p.x+4,p.y-14,8,8,colors.cream);c.fillStyle=colors.ink;c.font='7px monospace';c.fillText(String(i+1),Math.round(p.x+6),Math.round(p.y-7));}
    if(options.selectedParcel===i){c.strokeStyle=colors.cream;c.lineWidth=1;c.strokeRect(Math.round(p.x)-12.5,Math.round(p.y)-16.5,25,28);}
  });
  const actors=(['you','ghost'] as const).map(kind=>{const to=board[kind],from=motion?.from[kind]??to,p=point(to,from);return {kind,p,walking:same(to,from)?0:progress};}).sort((a,b)=>a.p.y-b.p.y);
  for(const {kind,p,walking} of actors){
    if(!options.reduced&&walking>0&&walking<1){c.save();c.globalAlpha=(1-walking)*.4;r(p.x-7,p.y+7,3,1,kind==='ghost'?colors.mint:colors.gold);r(p.x+6,p.y+8,2,1,kind==='ghost'?colors.mint:colors.gold);c.restore();}
    const bump=!options.reduced&&kind===board.active&&motion?.bump?Math.sin(Math.min(1,(time-motion.at)/.18)*Math.PI)*3:0;
    person(c,id,kind,p.x+bump*(motion?.bump?.x??0),p.y+bump*(motion?.bump?.y??0),clock,walking,board.active===kind,options.won);
  }
  if(level.theme==='garden'&&board.lit.length){
    for(let i=0;i<board.lit.length*3;i++){const x=i<3?43+i*9:318+(i-3)*9,y=147-(i%3)*7;r(x,y,2,11,'#709b84');r(x-3,y+4,4,2,colors.mint);r(x+1,y+1,4,2,colors.mint);r(x-1,y-2,4,3,i%2?colors.rose:colors.gold);}
  }
  if(!options.reduced)for(const pulse of options.pulses??[]){
    const q=(time-pulse.at)/.7;if(q<0||q>=1)continue;
    const x=OX+pulse.point.x*CELL+12,y=OY+pulse.point.y*CELL+8,radius=7+ease(q)*15;
    c.save();c.globalAlpha=1-q;
    for(let i=0;i<8;i++){const angle=i*Math.PI/4;r(x+Math.cos(angle)*radius,y+Math.sin(angle)*radius-q*8,2,2,pulse.kind==='light'?colors.gold:colors.mint);}
    c.restore();
  }
  for(let i=0;i<9;i++){
    const x=16+(i*43)%354+Math.sin(clock*.5+i)*5,y=70+(i*37)%135+Math.cos(clock+i)*3;
    r(x,y,1+(i%2),1+(i%2),i%3===0?'#c5c795':'#709986');
  }
  const pickup=options.reduced||options.pickupAt===undefined?1:ease((time-options.pickupAt)/.8);
  const packed=options.journey?.memories??[];
  travelCase(c,board.found&&pickup===1?[...packed,index]:packed,322,190,id);
  if(index===6&&options.journey?.resolution==='carry')drawKeepsake(c,5,351,181,1,keepsakeTopic(id,5).text);
  if(board.found&&pickup<1){
    const p=positions(level,'m')[0],from={x:OX+p.x*CELL+12,y:OY+p.y*CELL+10},to={x:332+(index%3)*18,y:200+Math.floor(index/3)*18};
    drawKeepsake(c,index,from.x+(to.x-from.x)*pickup,from.y+(to.y-from.y)*pickup-Math.sin(pickup*Math.PI)*30,1,keepsakeTopic(id,index).text);
  }
  if(options.won){
    const flight=options.reduced?1:ease((time-(motion?.at??time)-.16)/.82),from={x:OX+board.ghost.x*CELL+29,y:OY+board.ghost.y*CELL+13},to={x:368,y:184};
    c.save();c.translate(from.x+(to.x-from.x)*flight,from.y+(to.y-from.y)*flight-Math.sin(flight*Math.PI)*24);c.scale(.8,.8);prop(c,id,0,0);c.restore();
    if(!options.reduced)for(let i=0;i<14;i++)r(105+(i*37)%165,50+(i*13+clock*17)%135,2,2,i%2?colors.gold:colors.mint);
  }
  if(options.dark){c.fillStyle=`rgba(15,18,34,${options.dark})`;c.fillRect(0,0,WIDTH,HEIGHT);}
}

export function drawOpening(c:CanvasRenderingContext2D,id:Identity,time:number,journey=false){
  const r=(x:number,y:number,w:number,h:number,color:string)=>rect(c,x,y,w,h,color);
  const door=ease((time-1.2)/.9),suitcase=ease((time-2)/1.4),ghost=ease((time-3.3)/1),arrival=ease((time-5.1)/1.4),light=ease((time-7.2)/1.2),pages=ease((time-8.7)/1.4);
  c.imageSmoothingEnabled=false;r(0,0,WIDTH,HEIGHT,'#10182b');
  for(let i=0;i<45;i++)r((i*67+19)%384,(i*29+9)%105,1,i%5===0?3:1,i%4===0?'#8da8c1':'#405573');
  r(278,22,27,27,'#b9cbd3');r(273,27,37,17,'#b9cbd3');r(273,22,17,16,'#10182b');
  for(let i=0;i<9;i++){const x=i*49-12;r(x,91,35,75,'#17243a');r(x+6,104,4,6,i%3===0?'#d9b878':'#344c68');r(x+19,119,4,6,'#344c68');}
  r(32,43,106,62,'#405166');r(36,47,98,54,'#162b40');r(42,54,84,3,'#86a9bc');r(43,62,34,23,'#31485f');
  r(47,68,25,3,'#78adbd');r(47,75,21,2,'#bc8d8e');r(47,82,27,2,'#87b9a8');
  for(let i=0;i<5;i++){const reached=pages>i/5&&(!journey||i<(id.milestones?.length??0));r(82+i*9,67,5,5,reached?colors.gold:'#46586c');if(reached)r(83+i*9,68,2,2,colors.cream);}
  r(79,91,48,2,'#536d80');r(91,94,35,2,'#536d80');r(111,105,6,42,'#687287');
  r(241,88,47,77,'#26364b');r(246,92,37,69,'#53677a');r(250+door*26,96,31-door*27,61,'#17263d');r(251+door*25,124,2,3,'#efc785');
  r(0,164,384,76,'#26334a');r(0,168,384,3,'#51627a');r(0,207,384,3,'#8a7780');r(0,221,384,2,'#8a7780');
  for(let x=0;x<384;x+=18)r(x,210,8,27,'#172136');
  r(317,92,3,69,'#667389');r(309,91,19,4,'#d7b26f');r(313,95,11,5,'#f3d69b');
  if(light){c.save();c.globalAlpha=.16*light;c.fillStyle='#f1c879';c.beginPath();c.moveTo(311,100);c.lineTo(269,169);c.lineTo(365,169);c.lineTo(324,100);c.fill();c.restore();r(310,88,16,4,'#ffe3a3');}
  const caseX=410+(282-410)*suitcase;travelCase(c,[],caseX,174,id);
  c.save();c.globalAlpha=ghost;person(c,id,'ghost',caseX+28,162,time,0,false,ghost>.92);c.restore();
  const youX=-18+(137+18)*arrival;person(c,id,'you',youX,170,time,arrival<1?time%1:0,false,arrival>.92&&ghost>.92);
  if(arrival>.82&&ghost>.8){prop(c,id,211,162);for(let i=0;i<6;i++)star(c,185+i*11,142+(i%2)*7,i%2?colors.gold:colors.mint,.65);}
  for(let i=0;i<12;i++){const y=(i*23+time*34)%155;r(20+(i*47)%350,y,1,5,'#47617f');}
  if(pages>.2)for(let i=0;i<4;i++){const fly=ease((time-8.7-i*.12)/.7);r(146+i*13,105-fly*30,8,10,'#e8ddc7');r(148+i*13,107-fly*30,4,1,'#9da9a7');}
  r(0,0,384,9,'#080e1b');r(0,231,384,9,'#080e1b');
  if(time<.35){c.fillStyle=`rgba(8,14,27,${1-ease(time/.35)})`;c.fillRect(0,0,384,240);}
}

export function drawFarewell(c:CanvasRenderingContext2D,id:Identity,time:number,dark=0,journey?:Journey,departure=0,selected?:number,ripples:StationRipple[]=[],rippleTime=time,settled=false,cinematic=false){
  const film=departure,intent=id.farewellIntent??'undecided';
  if(cinematic){departure=Math.min(1,film/.68);dark=0;}
  c.save();
  if(cinematic){const zoom=1+.48*ease(film/.12)*(1-ease((film-.42)/.45));c.translate(208,128);c.scale(zoom,zoom);c.translate(-208,-128);}
  rect(c,0,0,WIDTH,HEIGHT,'#1b233a');
  for(let i=0;i<50;i++)rect(c,(i*61+11)%384,(i*31+4)%130,1,1,'#8095a1');
  rect(c,296,25,26,26,'#d7d8bb');rect(c,291,30,36,16,'#d7d8bb');
  for(let i=0;i<14;i++)tree(c,i*32-12,136,45+i%3*11,'#2a4149');
  if(id.destination)drawCity(c,id.destination,time);
  for(let i=0;i<6;i++)rect(c,22+i*63+Math.sin(time*.6+i)*6,125+Math.cos(time+i)*9,1,2,i%2?'#829b8b':'#c4c690');
  const trainLeave=100*ease((departure-.76)/.24);
  c.save();c.translate(trainLeave,0);
  rect(c,296,94,96,73,'#27394d');rect(c,299,89,92,6,'#65727f');rect(c,301,101,85,56,'#3c4c5e');
  for(const x of [305,318,373]){rect(c,x,105,9,22,'#1c2a3d');rect(c,x+2,107,5,16,'#718b94');rect(c,x+2,108,2,4,'#dbbd89');}
  rect(c,335,99,34,67,'#172438');rect(c,338,103,28,62,'#8b705e');rect(c,341,106,22,58,'#f0d096');rect(c,344,109,16,55,'#fff0bd');rect(c,336,99,3,67,'#9e8c7b');rect(c,366,99,3,67,'#9e8c7b');
  c.save();c.globalAlpha=.09+departure*.09;c.fillStyle='#f0d096';c.beginPath();c.moveTo(344,160);c.lineTo(317,168);c.lineTo(376,168);c.closePath();c.fill();c.restore();
  c.restore();
  rect(c,0,166,384,74,'#37394a');rect(c,0,169,384,2,'#8f7974');
  for(let x=0;x<384;x+=19){rect(c,x,184,10,4,'#b59a7d');rect(c,x,214,7,23,'#5b4d55');}
  rect(c,0,217,384,2,'#9e9195');rect(c,0,230,384,2,'#9e9195');
  rect(c,56,62,255,9,'#6b5260');rect(c,51,67,265,4,'#94706c');rect(c,65,71,5,98,'#9c7974');rect(c,299,71,5,98,'#9c7974');
  rect(c,77,91,60,32,'#2d3348');rect(c,82,96,50,22,'#4f5666');
  c.fillStyle=colors.cream;c.font='8px "Microsoft YaHei",sans-serif';c.fillText('夜 间 站 台',84,110);
  rect(c,159,148,80,6,'#ac7f70');rect(c,161,133,76,4,'#9b746e');rect(c,164,154,4,14,'#68545f');rect(c,229,154,4,14,'#68545f');
  const approach=ease((departure-.22)/.36),boarding=ease((departure-.54)/.24),ghostX=215+48*approach+88*boarding,ghostY=140-12*approach+12*boarding-12*Math.sin(boarding*Math.PI),ghostAlpha=1-ease((departure-.72)/.08);
  const signoff=ease((departure-.38)/.08)*(1-ease((departure-.60)/.08));
  person(c,id,'you',182,142,time,0,false,departure>.54);
  if(signoff){
    c.save();c.globalAlpha=signoff;
    for(let i=0;i<6;i++){const angle=i*Math.PI/3+time*2,radius=9+Math.sin(time*5+i)*2;rect(c,ghostX+12+Math.cos(angle)*radius,ghostY-1+Math.sin(angle)*radius,2,2,i%2?colors.gold:colors.mint);}
    c.restore();
  }
  c.save();c.globalAlpha=ghostAlpha;person(c,id,'ghost',ghostX,ghostY,time+departure*8,boarding,false,false,departure<.68);c.restore();
  if(departure>=.68){
    const handoff=ease((departure-.68)/.18),startX=ghostX+12,startY=ghostY-1+Math.round(Math.sin((time+departure*8)*2.8)*1.3),x=startX+(290-startX)*handoff,y=startY+(128-startY)*handoff;
    prop(c,id,x,y);
    if(!settled)star(c,x+7,y-9,colors.gold,.5+Math.sin(time*7)*.15);
  }
  if(journey?.bookmark!==undefined&&journey.visited.includes(journey.bookmark)){
    const handover=ease(departure/.22),bookX=209-18*handover,bookY=139-5*Math.sin(handover*Math.PI);
    rect(c,bookX-7,bookY-5,13,10,'#6f98ad');rect(c,bookX-5,bookY-4,9,7,'#e1e7df');rect(c,bookX-6,bookY-5,2,10,'#476279');rect(c,bookX+1,bookY-5,2,8,'#edc68b');
  }
  const memories=journey?.memories??[];
  travelCase(c,memories,248,139,id,selected,recalledKeepsake(memories,departure));
  if(journey?.resolution==='carry'){rect(c,250,127,16,12,'#927c68');drawKeepsake(c,5,258,130,1,keepsakeTopic(id,5).text);}
  if(journey?.farewellNote){
    const seal=ease((departure-.08)/.24),x=191+63*seal,y=132-26*Math.sin(seal*Math.PI)+8*seal;
    rect(c,x,y,14,10,'#eee1c5');rect(c,x+1,y+1,12,2,'#bd9e80');
    rect(c,x+5,y+4,4,3,seal>.65?'#bd8580':'#8b9a96');
  }
  if(departure>.2&&departure<.76){for(let i=1;i<=3;i++)rect(c,ghostX-i*7,ghostY-12+(i%2)*5,2,2,i%2?colors.gold:colors.mint);}
  const lamplight=1-ease((departure-.12)/.32);
  rect(c,277,85,2,34,'#bf9d7a');rect(c,272,114,12,4,lamplight>.3?'#f2d59a':'#716b69');rect(c,275,118,6,3,lamplight>.3?'#ffeac0':'#857565');
  c.save();c.globalAlpha=(.07+Math.sin(time*1.8)*.01)*lamplight;c.fillStyle=colors.gold;c.beginPath();c.moveTo(273,120);c.lineTo(242,165);c.lineTo(314,165);c.lineTo(281,120);c.fill();c.restore();
  if(intent==='pause'&&departure>.4){
    // A window stays warm for a possible return; no return date is imposed.
    c.save();c.globalAlpha=ease((departure-.4)/.25);rect(c,85,98,10,16,'#e7bc79');rect(c,98,98,10,16,'#e7bc79');rect(c,96,97,1,19,'#596273');c.restore();
  }
  const fade=ease((dark-.88)/.12);if(fade){c.fillStyle=`rgba(12,16,31,${fade*.84})`;c.fillRect(0,0,WIDTH,HEIGHT);}
  const celebration=settled||cinematic||intent!=='completed'?0:ease((departure-.62)/.38);
  if(celebration){
    const palette=[colors.gold,colors.mint,colors.cream,colors.rose];
    for(let burst=0;burst<4;burst++){
      const phase=(time*.8+burst*.23)%1,radius=3+phase*28,x=42+burst*98,y=38+burst%2*27;c.save();c.globalAlpha=(1-phase)*celebration;
      for(let i=0;i<16;i++){const angle=i*Math.PI/8+burst*.4,px=x+Math.cos(angle)*radius,py=y+Math.sin(angle)*radius;rect(c,px,py,2,2,palette[(i+burst)%palette.length]);if(phase<.45)rect(c,px-Math.cos(angle)*3,py-Math.sin(angle)*3,1,1,palette[(i+burst)%palette.length]);}
      c.restore();
    }
    for(let i=0;i<28;i++){const fall=(time*23+i*17)%112,x=(i*73+384+Math.sin(time+i)*13)%384;rect(c,x,fall,2,i%3===0?4:2,palette[i%palette.length]);}
  }
  c.restore();
  const sky=settled?1:cinematic?ease((film-.55)/.22):0;
  if(sky){
    if(intent==='completed')drawFireworks(c,settled?2.6:time,sky*.85);
    else if(intent==='handover'){
      // Passing the light echoes handing the project to its next keeper.
      for(let i=0;i<7;i++){const lit=settled?1:ease((film-.55-i*.035)/.12);c.save();c.globalAlpha=lit*.85;const x=36+i*48,y=46-Math.sin(i/6*Math.PI)*22;rect(c,x,y,5,7,colors.gold);rect(c,x+1,y+2,3,3,colors.cream);rect(c,x+2,y+7,1,4,'#b08773');c.restore();}
    }else{
      c.save();c.globalAlpha=sky*.7;
      for(let i=0;i<12;i++)star(c,24+i*30,16+(i*17)%40,intent==='pause'?colors.gold:colors.mint,settled?.4:.35+Math.sin(time*.7+i)*.1);
      c.restore();
    }
    if(journey?.citySecret){
      c.save();c.globalAlpha=sky*.7;
      for(let i=0;i<6;i++){const x=207+i*28,y=162-i*4;rect(c,x,y,2,2,colors.mint);rect(c,x-2,y+2,6,1,'#4f807b');}
      c.restore();
    }
  }
  for(const ripple of ripples){
    const age=rippleTime-ripple.at;if(age<0||age>.95)continue;
    c.save();
    for(let ring=0;ring<3;ring++){
      const progress=ease(age/.82),radius=3+progress*27+ring*7,vertical=1+progress*6;
      c.globalAlpha=(1-progress*.72)*(.9-ring*.12);
      for(let point=0;point<32;point+=2){
        const angle=point*Math.PI/16,x=Math.round(ripple.x+Math.cos(angle)*radius),y=Math.round(ripple.y+Math.sin(angle)*vertical);
        rect(c,x,y,2,1,ripple.kind==='memory'?(ring===0?colors.gold:colors.mint):(ring===0?'#9bcbd8':'#d9dfc7'));
      }
    }
    if(age<.2){c.globalAlpha=1-age/.2;rect(c,ripple.x-1,ripple.y-1,3,1,ripple.kind==='memory'?colors.cream:'#d9dfc7');}
    c.restore();
  }
}

export function drawRecollection(c:CanvasRenderingContext2D,id:Identity,index:number,time:number,reduced=false,collected=false,milestone=false,step=0,marker?:GitMilestone,bookmarked=false){
  const t=reduced?2:time,q=ease(t/1.2),bob=reduced?0:Math.sin(t*2.2)*1.2,r=(x:number,y:number,w:number,h:number,color:string)=>rect(c,x,y,w,h,color);
  c.imageSmoothingEnabled=false;r(0,0,384,240,'#22283c');r(0,170,384,70,'#353448');
  r(24,27,106,92,'#566075');r(28,31,98,84,'#19283b');r(76,31,3,84,'#606778');r(28,71,98,3,'#606778');
  for(let i=0;i<15;i++)r(34+(i*31)%86,36+(i*17)%68,1,1,'#9bafb7');
  r(93,43,16,16,'#c6d0b6');r(90,47,22,8,'#c6d0b6');
  r(265,37,88,4,'#9e7d72');for(let i=0;i<9;i++)r(272+i*8,15+(i%3)*4,6,22-(i%3)*4,['#b18d84','#82a09e','#b5ad8d'][i%3]);
  r(275,77,49,34,'#493f52');r(280,82,39,24,'#d9c7a7');r(286,89,26,2,'#a18b83');r(286,95,19,2,'#a18b83');
  if(collected){r(280,82,39,24,'#655361');drawKeepsake(c,index,299,94,1,keepsakeTopic(id,index).text);}
  r(40,174,305,9,'#b98c77');r(44,183,297,12,'#775b62');r(53,195,7,45,'#685261');r(324,195,7,45,'#685261');
  r(290,150,5,24,'#c5a17a');r(278,145,29,4,'#efc785');r(283,139,19,6,'#d8b480');
  c.fillStyle='#efc78512';c.beginPath();c.moveTo(280,149);c.lineTo(251,174);c.lineTo(326,174);c.lineTo(305,149);c.fill();
  const paper=(x:number,y:number,blank=false)=>{r(x,y,24,32,'#efe2c7');if(!blank)for(let i=0;i<3;i++)r(x+4,y+7+i*6,16-i*3,2,'#bba89c');};
  if(index===0){
    r(66,118,57,42,'#494e65');r(70,122,49,32,q>.3?'#8dc2b3':'#304957');r(88,160,12,10,'#737184');r(79,169,30,4,'#92909a');
    if(q>.3)star(c,94,137,'#f4e5b1',1.5);
    prop(c,id,126,151+bob);
  }else if(index===1){
    for(let i=0;i<3;i++)paper(75+i*11,139-i*5);prop(c,id,125,163+bob);
  }else if(index===2){
    r(68,150,67,20,'#6d6b7b');for(let i=0;i<10;i++)r(74+(i%5)*11,155+Math.floor(i/5)*7,7,4,'#d0c2b7');r(80,130,28,15,'#818697');prop(c,id,119,135+bob);
  }else if(index===3){
    paper(82,140);paper(108,140,true);r(105,140,2,32,'#8f7e7e');r(132,145,2,24,'#efc785');prop(c,id,146,162+bob);
  }else if(index===4){
    r(72,142,61,32,'#40545c');r(77,147,51,21,'#d4d7ca');r(83,152,18,2,'#6d8790');r(83,158,30,2,'#6d8790');prop(c,id,147,162+bob);
  }else if(index===5){
    r(74,145,56,28,'#d9bd9d');r(79,150,46,2,'#a58b80');r(89,153,28,2,'#a58b80');r(99,157,8,5,'#b98689');prop(c,id,143,162+bob);
    paper(87+q*5,114+q*30);
  }else{
    r(78,147,55,27,'#b58c75');r(81,141,49,6,'#dbb48b');r(100,134,14,3,'#c4a78d');r(101,151,7,10,'#6f6167');
    prop(c,id,107,136+bob);
  }
  if(milestone){
    const arrival=reduced?1:ease(time/1.1);
    r(143,31,108,65,'#263e54');r(147,35,100,57,'#172b3e');r(151,40,92,2,'#496f8b');
    for(let i=0;i<5;i++){
      const x=153+i*18,lit=i<step-1||i===step-1&&arrival>.82;
      if(i<4)r(x+6,52,12,2,i<step-1?'#7cacc9':'#40566d');
      r(x,47,8,9,lit?'#a6d5ec':'#40566d');r(x+2,50,4,2,lit?'#eff6ef':'#263c50');
    }
    c.fillStyle='#b6d7e9';c.font='6px "Microsoft YaHei", sans-serif';c.fillText('一起翻到这一页',168,76);
    r(76,171,174,5,'#182233');r(78,107,169,65,'#486a83');r(81,104,80,66,'#e3e6dc');r(164,104,80,66,'#f0efe3');r(160,105,4,65,'#b6c5c8');
    if(marker){
      c.fillStyle='#416075';c.font='6px monospace';c.fillText(marker.date,87,116);c.font='5px "Microsoft YaHei", sans-serif';
      for(let line=0;line<3;line++)c.fillText(Array.from(marker.subject).slice(line*13,line*13+13).join(''),87,128+line*8);
      c.fillStyle='#758891';c.fillText(Array.from(marker.author||'作者未提供').slice(0,13).join(''),87,161);
      for(const [i,file] of (marker.changes??[]).entries()){
        const show=reduced?1:ease((time-.4-i*.15)/.5);c.globalAlpha=show;
        r(170,115+i*14,5,6,file.status==='removed'?'#b68783':'#83a7a5');c.fillStyle='#496477';
        c.fillText(Array.from(file.path.split('/').at(-1)!).slice(0,12).join(''),179,121+i*14);
      }
      c.globalAlpha=1;c.fillStyle='#758891';c.font='5px monospace';c.fillText(marker.sha.slice(0,7),170,162);
    }
    c.save();c.beginPath();c.moveTo(164,104);c.lineTo(164+80*(1-arrival),104-12*Math.sin(arrival*Math.PI));c.lineTo(164+80*(1-arrival),170-8*Math.sin(arrival*Math.PI));c.lineTo(164,170);c.closePath();c.fillStyle='#ccd8d9';c.fill();
    c.restore();
  }
  if(bookmarked){const x=milestone?236:310,y=milestone?103:82;r(x,y,4,16,'#edc68b');r(x+1,y+14,2,3,'#546579');}
  // The project steps out of its old screen; later memories give it the desk to itself.
  c.save();c.translate(milestone?268:(index===0?115+q*71:186),164);c.scale(2,2);person(c,id,'ghost',0,0,t,0,false,index===1||index===6);c.restore();
  c.save();c.translate(milestone?309:246-(index===6?q*12:0),164);c.scale(1.6,1.6);person(c,id,'you',0,0,t,0,false,index===6);c.restore();
  for(let i=0;i<6;i++){const x=145+(i*23)%110,y=55+(i*19)%52-Math.sin(t+i)*2;r(x,y,1,1,'#c8ae87');}
  r(0,0,384,9,'#141b2b');r(0,231,384,9,'#141b2b');
  if(!reduced&&t<.6){c.fillStyle=`rgba(20,27,43,${1-ease(t/.6)})`;c.fillRect(0,0,384,240);}
}
