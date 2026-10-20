export type Point = { x:number; y:number };
export type Actor = 'you'|'ghost';
export type Direction = 'up'|'down'|'left'|'right';
export type Board = { you:Point; ghost:Point; boxes:Point[]; lit:Point[]; active:Actor; found:boolean; latched:boolean; steps:number };
export type Level = { title:string; subtitle:string; hint:string; map:string[]; theme:'forest'|'river'|'garden'|'rooftop'|'workshop'|'library'|'station' };
export const levels:Level[] = [
  {title:'雨后小径',subtitle:'01 / 搬走一点沉重',hint:'把箱子推到金色方框，再一起走到脚印。',theme:'forest',map:[
    '#########', '#....m..#', '#..b.t..#', '#p....e.#', '#g....o.#', '#.......#', '#########',
  ]},
  {title:'萤火渡口',subtitle:'02 / 这次换它帮你',hint:'幽灵可以过水。让它踩住圆形机关，你再过桥。',theme:'river',map:[
    '#########', '#..m~...#', '#...~...#', '#p..d.e.#', '#g..~...#', '#...~s.o#', '#########',
  ]},
  {title:'旧日温室',subtitle:'03 / 让留下的东西发光',hint:'你把行李推入金框，幽灵走过灯芯，点亮温室。',theme:'garden',map:[
    '#########', '###m#####', '#a.b.t..#', '#p.###.a#', '#g.b.t.e#', '###...o.#', '#########',
  ]},
  {title:'屋顶微光',subtitle:'04 / 绕一点路也没关系',hint:'把箱子绕过水渠，送到对面的金框。幽灵帮你守住桥。',theme:'rooftop',map:[
    '#########', '#..m~...#', '#p..d.e.#', '#..b~t..#', '#g..~.o.#', '#...~s..#', '#########',
  ]},
  {title:'回声工坊',subtitle:'05 / 把这次更新送到灯下',hint:'伙伴穿过水道踩住机关；你趁闸门打开，送好两件行李，再一起点亮两盏灯。',theme:'workshop',map:[
    '#########', '###m.a###', '#p.....e#', '#...b.t##', '#g.~s.###', '#..bdat##', '#..~...o#',
  ]},
  {title:'留白书库',subtitle:'06 / 给留白一个去处',hint:'把纪念页推到书架，或带到右侧行李格。然后一起离开。',theme:'library',map:[
    '#########', '#..m....#', '#..t#.r.#', '#p.b#e..#', '#g..d.o.#', '#..s#...#', '#########',
  ]},
  {title:'末班站台',subtitle:'07 / 一起把它送到',hint:'收好最后一件行李，点亮站灯，再一起到站。',theme:'station',map:[
    '#########', '#a.m#...#', '#.b.#.t.#', '#p..d.e.#', '#g..#.o.#', '#..s#..a#', '#########',
  ]},
];
export const directions:Record<Direction,Point>={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
export const same=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y;
export const tile=(level:Level,p:Point)=>level.map[p.y]?.[p.x]??'#';
export function positions(level:Level,char:string):Point[]{
  return level.map.flatMap((row,y)=>Array.from(row).flatMap((c,x)=>c===char?[{x,y}]:[]));
}
export function newBoard(level:Level):Board {
  return {you:positions(level,'p')[0],ghost:positions(level,'g')[0],boxes:positions(level,'b'),lit:[],active:'you',found:false,latched:false,steps:0};
}
export const gateOpen=(level:Level,b:Board)=>b.latched||[b.you,b.ghost,...b.boxes].some(p=>tile(level,p)==='s');
export const goals=(level:Level)=>[...positions(level,'t'),...positions(level,'r')];
export function choiceOf(level:Level,b:Board):'shelf'|'carry'|null{
  if(!positions(level,'r').length)return null;
  if(b.boxes.some(p=>tile(level,p)==='r'))return 'carry';
  return b.boxes.some(p=>tile(level,p)==='t')?'shelf':null;
}
export function won(level:Level,b:Board):boolean{
  return tile(level,b.you)==='e'&&tile(level,b.ghost)==='o'&&positions(level,'a').every(p=>b.lit.some(lamp=>same(p,lamp)))&&(positions(level,'r').length?choiceOf(level,b)!==null:goals(level).every(p=>b.boxes.some(box=>same(p,box))));
}
export function corneredBoxes(level:Level,b:Board):Point[]{
  const fixed=(x:number,y:number)=>['#','~'].includes(tile(level,{x,y}));
  return b.boxes.filter(p=>!['t','r'].includes(tile(level,p))&&(fixed(p.x-1,p.y)||fixed(p.x+1,p.y))&&(fixed(p.x,p.y-1)||fixed(p.x,p.y+1)));
}
export function move(level:Level,b:Board,direction:Direction):Board|null{
  const delta=directions[direction],from=b[b.active],to={x:from.x+delta.x,y:from.y+delta.y};
  const blocked=(p:Point)=>tile(level,p)==='#'||(tile(level,p)==='~'&&b.active==='you')||(tile(level,p)==='d'&&!gateOpen(level,b));
  if(blocked(to)||same(to,b[b.active==='you'?'ghost':'you']))return null;
  const i=b.boxes.findIndex(box=>same(to,box)),next={...b,boxes:b.boxes.slice()};
  if(i>=0){
    const beyond={x:to.x+delta.x,y:to.y+delta.y};
    if(b.active==='ghost'||blocked(beyond)||same(beyond,b.ghost)||b.boxes.some(box=>same(box,beyond)))return null;
    next.boxes[i]=beyond;
  }
  next[b.active]=to;next.steps++;
  next.found ||= tile(level,to)==='m';
  if(b.active==='ghost'&&tile(level,to)==='a'&&!b.lit.some(p=>same(p,to)))next.lit=[...b.lit,to];
  // The exit latches the gate so the companion can leave its switch and follow.
  next.latched ||= tile(level,next.you)==='e';
  return next;
}
export type Journey = { visited:number[]; memories:number[]; steps:number; skipped:boolean; notes:Record<number,string>; resolution:'shelf'|'carry'|null; nextStep:string; bookmark?:number };
export const newJourney=():Journey=>({visited:[],memories:[],steps:0,skipped:false,notes:{},resolution:null,nextStep:''});

/** A short, bounded search powers one-step hints, including recovery after a bad push. */
export async function solve(level:Level,start:Board):Promise<('switch'|Direction)[]|null>{
  // Work backwards from goals to discard box positions that no push can recover.
  const reachable=goals(level),safe=new Set(reachable.map(p=>`${p.x},${p.y}`));
  const floor=(p:Point)=>!['#','~'].includes(tile(level,p));
  for(let i=0;i<reachable.length;i++)for(const d of Object.values(directions)){
    const p={x:reachable[i].x-d.x,y:reachable[i].y-d.y},behind={x:p.x-d.x,y:p.y-d.y},key=`${p.x},${p.y}`;
    if(floor(p)&&floor(behind)&&!safe.has(key)){safe.add(key);reachable.push(p);}
  }
  const key=(b:Board)=>[b.you.x,b.you.y,b.ghost.x,b.ghost.y,b.active,b.latched,b.lit.map(p=>p.y*9+p.x).sort((a,b)=>a-b).join('.'),...b.boxes.map(p=>p.y*9+p.x).sort((a,b)=>a-b)].join(',');
  const distance=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y),targets=goals(level),lamps=positions(level,'a');
  const exit=positions(level,'e')[0],ghostExit=positions(level,'o')[0];
  const estimate=(b:Board)=>distance(b.you,exit)+b.boxes.reduce((sum,p)=>sum+Math.min(...targets.map(t=>distance(p,t))),0)+Math.max(distance(b.ghost,ghostExit),...lamps.filter(p=>!b.lit.some(l=>same(p,l))).map(p=>distance(b.ghost,p)+distance(p,ghostExit)));
  const nodes:{b:Board; parent:number; action:'switch'|Direction|null; depth:number}[]=[{b:start,parent:-1,action:null,depth:0}],seen=new Set([key(start)]);
  const frontier:{index:number;score:number}[]=[];
  const enqueue=(index:number)=>{
    const item={index,score:nodes[index].depth+2*estimate(nodes[index].b)};let i=frontier.length;frontier.push(item);
    while(i>0){const parent=(i-1)>>1;if(frontier[parent].score<=item.score)break;frontier[i]=frontier[parent];i=parent;}frontier[i]=item;
  };
  const dequeue=()=>{
    const first=frontier[0],last=frontier.pop()!;if(!frontier.length)return first.index;
    let i=0;while(i*2+1<frontier.length){let child=i*2+1;if(child+1<frontier.length&&frontier[child+1].score<frontier[child].score)child++;if(last.score<=frontier[child].score)break;frontier[i]=frontier[child];i=child;}frontier[i]=last;return first.index;
  };
  enqueue(0);
  for(let expanded=0;frontier.length&&expanded<50000;expanded++){
    if(expanded>0&&expanded%800===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
    const i=dequeue();
    const {b}=nodes[i];
    if(won(level,b)){
      const route:('switch'|Direction)[]=[];let j=i;
      while(nodes[j].parent>=0){route.push(nodes[j].action!);j=nodes[j].parent;}
      return route.reverse();
    }
    for(const action of ['up','down','left','right','switch'] as const){
      const next=action==='switch'?{...b,active:b.active==='you'?'ghost' as const:'you' as const}:move(level,b,action);
      if(!next||next.boxes.some(p=>!safe.has(`${p.x},${p.y}`)))continue;const k=key(next);if(seen.has(k))continue;
      seen.add(k);nodes.push({b:next,parent:i,action,depth:nodes[i].depth+1});enqueue(nodes.length-1);
    }
  }
  return null;
}
