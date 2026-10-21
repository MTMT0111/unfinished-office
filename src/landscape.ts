import type {Level,Board} from './game.ts';

const r=(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
export function drawLandmarks(c:CanvasRenderingContext2D,theme:Level['theme']){
  const fill=(x:number,y:number,w:number,h:number,color:string)=>r(c,x,y,w,h,color);
  if(theme==='forest'){
    // A broken doorway frames the route without looking like a second playable exit.
    fill(15,67,11,95,'#273f46');fill(59,67,10,93,'#273f46');fill(18,64,48,10,'#43595a');fill(25,57,35,8,'#53665f');
    fill(18,80,5,69,'#4f6460');fill(59,80,4,36,'#556a60');fill(25,70,32,6,'#172e39');
    for(let i=0;i<7;i++){fill(17+i*7,60+i%3*4,8,3,'#52795f');fill(20,76+i*9,3,5,'#698464');}
    fill(36,139,18,3,'#64796c');fill(33,146,24,3,'#485f59');fill(29,153,31,3,'#3c5350');
    for(let i=0;i<4;i++){const x=323+i*13,y=132+i%2*12;fill(x,y,8,23,'#435659');fill(x+1,y-3,6,4,'#6e7b6b');fill(x+2,y+5,3,1,'#819888');}
  }else if(theme==='river'){
    for(let i=0;i<5;i++){fill(15+i*12,147,10,26,'#786e62');fill(17+i*12,149,1,21,'#a0967c');}fill(12,143,65,4,'#9c8b72');
    fill(23,109,3,41,'#6e6c65');fill(22,107,5,3,'#b0a28b');fill(25,120,34,1,'#a4a388');
    fill(33,181,31,4,'#5e716e');fill(29,176,39,5,'#8c8170');fill(35,171,27,5,'#243e4d');
    fill(326,87,11,64,'#334d57');fill(360,87,10,64,'#334d57');fill(333,78,32,9,'#50676a');fill(337,85,23,4,'#183544');
  }else if(theme==='garden'){
    for(let i=0;i<5;i++){fill(8+i*7,51-i*5,7,2,'#658c88');fill(43+i*7,31+i*5,7,2,'#658c88');}
    fill(42,29,2,52,'#8caba0');fill(12,57,2,20,'#456a68');fill(17,61,2,7,'#517a71');
    fill(324,53,44,2,'#536d69');fill(329,55,1,31,'#829b79');fill(358,55,1,23,'#829b79');
    for(const [x,y] of [[329,87],[358,79]]){fill(x-7,y,15,8,'#a07c69');fill(x-3,y-8,7,9,'#608e72');fill(x-7,y-5,6,4,'#79a584');}
  }else if(theme==='rooftop'){
    fill(322,53,41,25,'#1c2b40');fill(327,46,31,7,'#42516a');fill(333,41,19,5,'#5f6a7c');fill(341,35,2,7,'#a2a8a4');
    fill(331,58,24,14,'#314057');fill(341,56,3,20,'#8c9290');fill(330,62,25,2,'#6a7884');
    fill(18,185,51,3,'#8e8582');for(let i=0;i<4;i++)fill(20+i*14,171,2,16,'#6c737d');
    for(let i=0;i<9;i++)fill(10+i*8,83+Math.sin(i/8*Math.PI)*6,8,1,'#7b858a');
    fill(40,90,10,13,'#778391');fill(41,92,8,4,'#a9ae9d');
  }else if(theme==='workshop'){
    fill(18,129,46,31,'#203540');fill(21,132,40,24,'#39525a');fill(27,137,12,10,'#172a38');fill(44,138,11,2,'#8d9d87');
    fill(38,160,2,11,'#91866e');fill(39,169,36,2,'#91866e');fill(74,169,2,20,'#91866e');
    fill(321,138,38,26,'#283d47');fill(326,143,28,16,'#162a36');for(let i=0;i<3;i++){fill(330+i*8,147,4,4,'#456763');fill(331+i*8,154,2,2,'#9e9979');}
    fill(334,167,2,16,'#756e63');fill(319,183,17,2,'#756e63');
  }else if(theme==='library'){
    fill(143,5,98,3,'#5b6773');fill(158,9,68,2,'#444d62');fill(178,13,28,2,'#6b7180');
    fill(21,199,33,8,'#82766b');fill(24,195,26,4,'#a0937a');fill(26,189,22,6,'#d3c2a0');fill(36,189,1,7,'#a39581');
    fill(335,27,19,23,'#3b3c53');fill(338,30,13,17,'#adab95');fill(344,33,1,8,'#5f6171');fill(344,40,5,1,'#5f6171');
  }else{
    fill(20,48,35,25,'#35424e');fill(24,51,27,19,'#9aa18f');fill(37,54,1,10,'#404c56');fill(37,63,7,1,'#404c56');
    fill(321,68,43,22,'#283a48');fill(326,73,33,2,'#b7aa86');fill(326,79,23,2,'#74897e');
    for(let i=0;i<5;i++)fill(13+i*17,202,8,2,'#b29a76');
  }
}

export function drawAtmosphere(c:CanvasRenderingContext2D,level:Level,board:Board,time:number){
  c.save();
  // Atmosphere stays outside the tiles: silhouettes and goals remain readable.
  c.beginPath();c.rect(0,0,384,35);c.rect(0,35,106,205);c.rect(277,35,107,205);c.rect(106,203,171,37);c.clip();
  const indoor=['library','workshop'].includes(level.theme);
  for(let i=0;i<5;i++){
    const x=(i*93+Math.sin(time*.13+i)*19+420)%430-35,y=indoor?32+i*36:107+i*27;
    c.globalAlpha=indoor?.035:.055;c.fillStyle=indoor?'#c9b8a1':'#b8d1d0';c.fillRect(x,y,63+i%2*25,3);c.fillRect(x+9,y+3,48,2);
  }
  const beam=c.createLinearGradient(0,20,0,200);beam.addColorStop(0,'#b7c9cf');beam.addColorStop(1,'#b7c9cf00');
  c.globalAlpha=.09;c.fillStyle=beam;c.beginPath();c.moveTo(308,12);c.lineTo(343,12);c.lineTo(231,226);c.lineTo(168,226);c.fill();
  if(board.found){c.globalAlpha=.8;r(c,45,95,3,5,'#efc785');r(c,46,93,1,8,'#f9e8ba');c.globalAlpha=.1;r(c,36,85,21,23,'#efc785');}
  if(level.theme==='workshop'&&board.lit.length){c.globalAlpha=.85;for(let i=0;i<3;i++)r(c,330+i*8,147,4,4,'#8ec9b5');}
  c.restore();
}
