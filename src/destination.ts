export type Destination = {city:string;kind:'beijing'|'newyork'|'other';season:'night'|'snow'|'christmas'|'halloween'};
export function destination(city:string,season:string='night'):Destination {
  city=city.trim();
  if(!city||Array.from(city).length>40)throw new Error('写一个城市名，40 字以内。');
  if(!['night','snow','christmas','halloween'].includes(season))throw new Error('请重新选择场景风格。');
  const key=city.toLowerCase().replace(/[\s·.-]/g,'');
  const kind=/^(北京|北京市|beijing|peking)$/.test(key)?'beijing':/^(纽约|纽约市|newyork|newyorkcity|nyc)$/.test(key)?'newyork':'other';
  return {city,kind,season:season as Destination['season']};
}
export function destinationCaption(place?:Destination):string {
  if(!place)return '林间夜路';
  return `${place.city} · ${{night:'城市夜色',snow:'瑞雪',christmas:'圣诞灯火',halloween:'南瓜之夜'}[place.season]}`;
}

// City scenery is an illustration selected by the player, not live weather.
export function drawCity(c:CanvasRenderingContext2D,place:Destination,time:number,game=false){
  const r=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
  c.save();
  if(game){c.beginPath();c.rect(0,0,384,35);c.rect(0,35,84,205);c.rect(300,35,84,205);c.rect(84,203,216,37);c.clip();}
  r(0,0,384,240,place.season==='halloween'?'#211c35':place.kind==='beijing'?'#172b42':'#16263e');
  for(let i=0;i<35;i++)r((i*73+11)%384,(i*29)%85,1,1,'#8fa8bf');
  r(320,22,21,21,place.season==='halloween'?'#e7ab68':'#e8dcc0');
  if(place.kind==='newyork'){
    for(let i=0;i<16;i++){
      const x=i*27-5,h=35+(i*31)%69,y=154-h;r(x,y,23,h,i%2?'#35435b':'#293950');
      if(i%4===1){r(x+8,y-11,7,11,'#4c5770');r(x+11,y-21,1,10,'#d6b780');}
      for(let row=0;row<Math.floor(h/10);row++)for(let col=0;col<3;col++)r(x+3+col*7,y+5+row*10,3,4,(row+col+i)%3?'#b69d74':'#536c83');
    }
    r(0,158,384,5,'#79849a');for(let i=0;i<10;i++)r(i*41,166,22,3,'#caa97a');
  }else if(place.kind==='beijing'){
    for(let i=0;i<7;i++){
      const x=i*61-15,y=100+i%2*18;r(x,y,56,43,'#354858');r(x+2,y-7,52,8,'#6e5f6a');r(x-3,y-1,62,3,'#a37d73');
      r(x-4,y-5,7,4,'#a37d73');r(x+53,y-5,7,4,'#a37d73');
      for(let j=0;j<4;j++)r(x+6+j*12,y+10,6,16,'#c8a576');
      if(place.season==='snow')r(x+2,y-8,52,2,'#e2e5d9');
    }
    for(const x of [32,352]){r(x,39,1,23,'#bd9c75');r(x-7,61,15,16,'#bd5d5a');r(x-9,65,19,8,'#d97760');r(x-5,62,2,14,'#efc28b');r(x-3,78,7,2,'#e5b777');r(x,80,1,10,'#cf7d62');}
  }else{
    for(let i=0;i<12;i++){const x=i*36-8,y=105+(i*19)%30;r(x,y,30,49,'#334a5d');r(x+5,y+8,7,12,'#d5b68b');r(x+18,y+8,6,12,'#8ba5b7');}
  }
  if(place.season==='christmas'){
    for(const x of [45,340]){for(let i=0;i<4;i++)r(x-7-i*3,92+i*9,14+i*6,12,'#3e766d');r(x-2,134,4,10,'#9c7765');r(x-2,88,4,4,'#f0d38c');for(let i=0;i<6;i++)r(x-8+(i*7)%19,104+i*5,2,2,i%2?'#e6c885':'#d67d76');}
  }
  if(place.season==='halloween')for(const x of [35,350]){r(x-8,150,17,13,'#d78948');r(x-5,147,11,18,'#bd6c3e');r(x-4,153,3,3,'#ffe6a0');r(x+3,153,3,3,'#ffe6a0');r(x-1,143,3,5,'#819268');}
  c.restore();
  if(place.season==='snow'||place.season==='christmas'){
    c.save();c.globalAlpha=.6;
    for(let i=0;i<32;i++)r((i*47+Math.sin(time*.5+i)*6+384)%384,(i*29+time*10)%238,1+i%2,1+i%2,'#e2e6df');
    c.restore();
  }
}

export function drawFireworks(c:CanvasRenderingContext2D,time:number,strength=1){
  c.save();
  const colors=['#efd095','#9ce1d8','#dd9da9','#c3b9ed'];
  for(let burst=0;burst<8;burst++){
    const phase=(time*.34+burst*.137)%1,x=28+burst*46,y=24+burst%3*24;
    c.fillStyle=colors[burst%4];
    if(phase<.2){c.globalAlpha=strength;const py=150-(150-y)*phase/.2;c.fillRect(x,py,1,7);continue;}
    const spread=(phase-.2)/.8,radius=4+spread*36;c.globalAlpha=(1-spread)*strength;
    for(let i=0;i<22;i++){
      const angle=i*Math.PI/11,px=x+Math.cos(angle)*radius,py=y+Math.sin(angle)*radius+spread*spread*12;
      c.fillRect(Math.round(px),Math.round(py),2,2);c.fillRect(Math.round(px-Math.cos(angle)*4),Math.round(py-Math.sin(angle)*4),1,1);
    }
  }
  c.restore();
}
