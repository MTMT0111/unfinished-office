import { confirmIdentity, count, example, fields, farewells, parseFarewellIntent, parseInput, readProjectFile, sourceLabel, type Identity, type Field, type Prop, type Palette, type Accessory } from './input.ts';
import { choiceOf, corneredBoxes, directions, goals, levels, move, newBoard, newJourney, positions, same, solve, tile, won, type Actor, type Board, type Direction, type Point } from './game.ts';
import { CELL, HEIGHT, OX, OY, WIDTH, drawScene, drawOpening, drawFarewell, drawRecollection, drawKeepsake, ease, type Motion, type Pulse, type StationRipple } from './scene.ts';
import { renderDossier } from './dossier.ts';
import { commitEvidence } from './journal.ts';
import { chapterCargo, keepsakeStory, keepsakeTopic, memoryStory, parcelContents, validateNextStep, validateFarewellNote, keepsakes, resolutionText, rememberedPage, farewellLines } from './memory.ts';
import { createMemorial, createMemoryBook, localDate } from './export.ts';
import { Sound } from './sound.ts';
import { setupImport } from './import-ui.ts';
import { cleanText } from './project.ts';
import { destination, destinationCaption, drawCity } from './destination.ts';
import { readProjectPhoto, renderProjectMedia } from './project-media.ts';
import { handoverMarkdown, relicFiles, relicRows, renderRelicDesk } from './relics.ts';
import {drawRitual,ritualLights,ritualLines,sealRitual,unfinishedPage} from './ritual.ts';
import {reachedJourneyEnd,journeyStats,explorationLine} from './game.ts';

type State = 'input'|'reading'|'confirm'|'opening'|'playing'|'cleared'|'memory'|'paused'|'waiting'|'fading'|'done';
const el = <T extends HTMLElement=HTMLElement>(id:string) => document.getElementById(id) as T;
const stage=el<HTMLCanvasElement>('stage'),ctx=stage.getContext('2d');
const routeStops=[...document.querySelectorAll<HTMLElement>('.cover-route li')];
const inputName=el<HTMLInputElement>('project-name'),description=el<HTMLTextAreaElement>('description');
const prop=el<HTMLSelectElement>('prop'),palette=el<HTMLSelectElement>('palette'),accessory=el<HTMLSelectElement>('accessory');
const reduced=el<HTMLInputElement>('reduced'),includeDate=el<HTMLInputElement>('include-date'),date=el<HTMLInputElement>('memorial-date');
const settings=el<HTMLDialogElement>('game-settings'),guides=el<HTMLInputElement>('settings-guides'),settingsReduced=el<HTMLInputElement>('settings-reduced'),settingsSound=el<HTMLInputElement>('settings-sound');
const image=el<HTMLImageElement>('memorial-preview'),download=el<HTMLButtonElement>('download'),openImage=el<HTMLAnchorElement>('open-image');
const sound=new Sound();
const ritualDialog=el<HTMLDialogElement>('farewell-ritual');
let ritualStep=0,ritualRaf=0;
let state:State='input',identity=example('weather'),draft:Identity=identity;
let journey=newJourney(),levelIndex=0,board=newBoard(levels[0]),history:Board[]=[],future:Board[]=[],motion:Motion|undefined,playMode:'solo'|'together'='solo';
let legalSteps:Point[]=[],resumeAfterSettings=false;
let preflightPage='project',companionLight=false;
let memoryMode:'story'|'relic'='story';
let pulses:Pulse[]=[],selectedParcel:number|undefined,stationRipples:StationRipple[]=[],stationRaf=0;
let entered=0,queued:{actor:Actor;action:Direction|'switch'}[]=[],hintPoint:{x:number;y:number}|undefined;
let raf=0,coverRaf=0,elapsed=0,lastStamp=0,dark=0,readSequence=0,exportSequence=0;
let previewUrl='',filename='',inputSource:'user'|'readme'='user',fileTruncated=false;
let leaving=false,leaveFrom:State='input',pausedFrom:State='playing';
let memoryIndex=0,memoryAt=0,memoryReturn:'playing'|'cleared'|'waiting'|'done'|null=null,pickupAt:number|undefined,openingJourney=false,stationStoryIndex:number|undefined;
const edits=Object.fromEntries(fields.map(key=>[key,el<HTMLInputElement|HTMLTextAreaElement>('edit-'+key)])) as Record<Field,HTMLInputElement|HTMLTextAreaElement>;

function stopClock(){cancelAnimationFrame(raf);raf=0;}
function stopCover(){cancelAnimationFrame(coverRaf);coverRaf=0;}
function animateCover(){
  stopCover();if(!ctx||!['input','reading'].includes(state)||reduced.checked||document.hidden||settings.open)return;
  const frame=(now:number)=>{
    if(!['input','reading'].includes(state)||reduced.checked||document.hidden||settings.open){coverRaf=0;return;}
    drawScene(ctx,identity,board,levelIndex,now/1000,undefined,{journey});coverRaf=requestAnimationFrame(frame);
  };
  coverRaf=requestAnimationFrame(frame);
}
function releasePreview(){
  exportSequence++;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';filename='';
  image.hidden=true;image.removeAttribute('src');openImage.hidden=true;openImage.removeAttribute('href');download.disabled=true;
}
function error(id:string,value:unknown){el(id).textContent=value instanceof Error?value.message:String(value);}
function queueAction(actor:Actor,action:Direction|'switch'){
  queued=queued.filter(item=>item.actor!==actor);queued.push({actor,action});
}
function draw(){
  if(!ctx)return;
  if(state==='opening')drawOpening(ctx,identity,elapsed,openingJourney);
  else if(['waiting','fading','done'].includes(state))drawFarewell(ctx,identity,reduced.checked?0:elapsed+dark*9,dark,journey,state==='fading'?dark:state==='done'?1:0,stationStoryIndex,stationRipples,reduced.checked?(stationRipples.at(-1)?.at??0)+.16:performance.now()/1000,state==='done',state==='fading'&&!reduced.checked);
  else if(state==='memory'||state==='paused'&&pausedFrom==='memory'){
    const story=memoryStory(identity,memoryIndex,journey);
    drawRecollection(ctx,identity,memoryIndex,elapsed-memoryAt,reduced.checked,journey.memories.includes(memoryIndex),story.milestone,story.step,identity.milestones?.[memoryIndex],rememberedPage(identity,journey)?.index===memoryIndex);
  }
  else drawScene(ctx,identity,board,levelIndex,elapsed,motion,{journey,pickupAt,pulses,selectedParcel,guides:guides.checked&&state==='playing'?legalSteps:[],won:state==='cleared',reduced:reduced.checked,hint:hintPoint,dark:['playing','cleared'].includes(state)&&!reduced.checked?.55*(1-ease((elapsed-entered)/.45)):0});
}
function animateStationRipples(){
  if(stationRaf||state!=='done'||reduced.checked||document.hidden||settings.open)return;
  const frame=()=>{
    if(state!=='done'||reduced.checked||document.hidden||settings.open){stationRaf=0;return;}
    const now=performance.now()/1000;stationRipples=stationRipples.filter(ripple=>now-ripple.at<.95);draw();
    if(stationRipples.length)stationRaf=requestAnimationFrame(frame);else stationRaf=0;
  };
  stationRaf=requestAnimationFrame(frame);
}
function addStationRipple(x:number,y:number,kind:StationRipple['kind']='water'){
  const now=performance.now()/1000;
  stationRipples=[...stationRipples.filter(ripple=>now-ripple.at<.95),{x,y,at:now-(reduced.checked?.16:0),kind}].slice(-5);
  draw();animateStationRipples();
}
function refreshGame(){
  const waitingAtStation=['waiting','fading','done'].includes(state);
  routeStops.forEach((stop,index)=>{
    const complete=journey.visited.includes(index),current=!complete&&(waitingAtStation?index===levels.length-1:index===levelIndex||index===0&&['input','reading','confirm'].includes(state));
    stop.dataset.progress=complete?'complete':current?'current':'upcoming';
    stop.setAttribute('aria-current',current?'step':'false');
  });
  const level=levels[levelIndex];
  const coop=playMode==='together';
  el('solo-controls').hidden=coop;el('coop-controls').hidden=!coop;el<HTMLButtonElement>('hint').hidden=coop;
  el('control-help').textContent=coop?'两人同屏：玩家一用 WASD，玩家二用方向键，各自控制一个角色。Z 撤销，Y 重做。也可点角色后点相邻格，或在画面上滑动。你能推箱；幽灵能过水、走过灯芯点灯。金框放箱子，金色脚印给你，绿色脚印给幽灵。两人到齐、灯全亮才过关。书库的书架和行李格任选一个。':'方向键 / WASD 移动，X 换人，Z 撤销，Y 重做。也可点方向按钮、相邻格子，或在画面上滑动。你能推箱；幽灵能过水、走过灯芯点灯。金框放箱子，金色脚印给你，绿色脚印给幽灵。两人到齐、灯全亮才过关。书库的书架和行李格任选一个。';
  const memory=levelIndex<5?identity.milestones?.[levelIndex]:undefined;
  el('chapter-number').textContent=memory?`${memory.date} · 日记页 ${String(levelIndex+1).padStart(2,'0')}`:`${String(levelIndex+1).padStart(2,'0')} / 夜路上的回声`;el('chapter-title').textContent=memory?memory.subject:level.title;
  el('game-objective').textContent=explorationLine(levelIndex,board);
  el('objective-help').textContent=memory?'把这次更新的文件送进金框，再和伙伴一起到出口。':level.hint;
  el('active-character').textContent=board.active==='you'?'你':'项目幽灵';
  el('switch-character').setAttribute('aria-label',`切换为${board.active==='you'?'项目幽灵':'你'}，快捷键 X`);
  el('memory-indicator').textContent=board.found?(memory?memory.sha.slice(0,7):keepsakes[levelIndex].name)+' · 已收好':'◇ 尚未辨认的微光';
  el<HTMLButtonElement>('undo').disabled=state==='paused'||!history.length;
  el<HTMLButtonElement>('redo').disabled=state==='paused'||!future.length;
  const targets=goals(level),required=positions(level,'r').length?1:targets.length,packed=targets.filter(p=>board.boxes.some(box=>same(box,p))).length;
  el('goal-boxes').textContent=required?`行李 ${packed} / ${required}`:'轻装出发';el('goal-boxes').dataset.ready=String(packed===required);
  const lamps=positions(level,'a');el('goal-lamps').hidden=!lamps.length;el('goal-lamps').textContent=`点灯 ${board.lit.length} / ${lamps.length}`;el('goal-lamps').dataset.ready=String(board.lit.length===lamps.length);
  const parcels=parcelContents(identity,levelIndex,board.boxes.length,journey.resolution==='carry');
  const cargo=selectedParcel===undefined?chapterCargo(identity,levelIndex===6&&journey.resolution==='carry'?5:levelIndex):parcels[selectedParcel];
  el('cargo-label').textContent=cargo.label;el('cargo-text').textContent=parcels.length?(memory?'这次更新了什么':'项目原文'):cargo.text;el('cargo-detail').textContent=cargo.detail;el('cargo-source').textContent=cargo.source;
  const list=el('parcel-list');list.hidden=!parcels.length;
  if(list.children.length!==parcels.length){list.replaceChildren();parcels.forEach((_,i)=>{const button=document.createElement('button');button.type='button';button.addEventListener('click',()=>{selectedParcel=selectedParcel===i?undefined:i;if(identity.prop==='umbrella'&&levelIndex===0)el<HTMLDetailsElement>('city-workbench').open=true;refreshGame();draw();});list.append(button);});}
  parcels.forEach((item,i)=>{const button=list.children[i] as HTMLButtonElement,packed=['t','r'].includes(tile(level,board.boxes[i]));button.textContent=`${packed?'✓':String(i+1).padStart(2,'0')} ${item.text}`;button.title=item.text;button.setAttribute('aria-label',`行李 ${i+1}：${item.text}，${packed?'已收好':'点击找它'}`);button.setAttribute('aria-pressed',String(selectedParcel===i));button.dataset.ready=String(packed);button.disabled=state==='paused';});
  el('choice-legend').hidden=!positions(level,'r').length;
  const choice=choiceOf(level,board);for(const value of ['shelf','carry'])el('choice-'+value).dataset.ready=String(choice===value);
  for(const [id,ready,label] of [['goal-you',tile(level,board.you)==='e','你'],['goal-ghost',tile(level,board.ghost)==='o','伙伴']] as const){el(id).textContent=label+(ready?' ✓':' · 待到站');el(id).dataset.ready=String(ready);}
  legalSteps=(Object.keys(directions) as Direction[]).filter(d=>move(level,board,d)).map(d=>({x:board[board.active].x+directions[d].x,y:board[board.active].y+directions[d].y}));
  if(companionLight&&journey.citySecret){const other=board.active==='you'?'ghost':'you';legalSteps.push(...(Object.keys(directions) as Direction[]).filter(d=>move(level,{...board,active:other},d)).map(d=>({x:board[other].x+directions[d].x,y:board[other].y+directions[d].y})));}
  el('city-secret').hidden=state!=='playing'||!identity.destination||Boolean(journey.citySecret);
  el('companion-light').hidden=!journey.citySecret;
  el('companion-light').setAttribute('aria-pressed',String(companionLight));
  el('clear-panel').hidden=state!=='cleared';
  el('clear-title').textContent=memory?'这次更新，带回来了。':levelIndex===5?'这页已有去处。':levelIndex===levels.length-1?'一起到站了。':'这一段，走完了。';
  el('next-level').textContent='翻开回忆 →';
  el('clear-memory').textContent=board.found?`伙伴：我会记得「${keepsakeTopic(identity,levelIndex).text}」。`:memory?`伙伴：${memory.date}，我们完成了「${memory.subject}」。`:choice==='shelf'?'伙伴：这页先留在书架。':choice==='carry'?'伙伴：这页留给下一站。':levelIndex===6?'伙伴：最后一件行李收好了。去站台吧。':'留一格空白，也可以继续走';
  el('app').dataset.level=String(levelIndex);el('app').dataset.board=JSON.stringify(board);el('app').dataset.mode=playMode;
  el('app').dataset.active=board.active;
  el('app').dataset.itinerary=journey.itinerary??'full';
  el('app').dataset.memories=String(journey.memories.length+(board.found&&!journey.memories.includes(levelIndex)?1:0));
  for(const [i,button] of bagButtons.entries()){
    const commit=i<5?identity.milestones?.[i]:undefined,topic=keepsakeTopic(identity,i),label=button.querySelector('small')!,icon=button.querySelector('canvas')!;
    label.textContent=i<5&&['waiting','done'].includes(state)?topic.text:commit?commit.date.slice(5).replace('-','.'):i<5?`回看 ${i+1}`:i===5?'去处':'告别';
    if(icon.dataset.topic!==topic.text){const iconContext=icon.getContext('2d');if(iconContext){iconContext.clearRect(0,0,icon.width,icon.height);drawKeepsake(iconContext,i,12,12,1,topic.text);icon.dataset.topic=topic.text;}}
    button.disabled=leaving||!journey.visited.includes(i)||!['playing','cleared','waiting','done'].includes(state);
    button.dataset.collected=String(journey.memories.includes(i)||i===levelIndex&&board.found);
    button.dataset.visited=String(journey.visited.includes(i));
    button.dataset.current=String(i===levelIndex&&!['waiting'].includes(state));
    button.dataset.bookmarked=String(journey.bookmark===i);
    button.dataset.selected=String(stationStoryIndex===i);
    button.setAttribute('aria-current',i===levelIndex&&!['waiting'].includes(state)?'step':'false');
    button.setAttribute('aria-pressed',String(stationStoryIndex===i));
    button.setAttribute('aria-label',`${commit?`${commit.date} · ${commit.subject} · 项目线索：${topic.text}`:i===5?'纪念页的去处':i===6?'和项目告别':topic.text} · ${journey.visited.includes(i)?['waiting','done'].includes(state)?'点击在站台回看这个故事':'翻开回忆':'走完这一站后翻开'}${journey.bookmark===i?' · 已夹书签':''}`);
    button.title=button.getAttribute('aria-label')!;
  }
  const coords=(p:{x:number;y:number})=>`${p.x} 列 ${p.y} 行`;
  stage.setAttribute('aria-label',`${level.title}。你在 ${coords(board.you)}，幽灵在 ${coords(board.ghost)}。${level.hint}`);
  el('board-description').textContent=`箱子：${board.boxes.map(coords).join('、')||'无'}。目标：${targets.map(coords).join('、')||'无'}。${positions(level,'r').length?'本关两个目标任选一个：左侧书架先收藏，右侧行李格带走。':''}灯芯：${lamps.map(coords).join('、')||'无'}，已亮 ${board.lit.length} 盏。机关：${positions(level,'s').map(coords).join('、')||'无'}。你的出口：${positions(level,'e').map(coords)}；幽灵出口：${positions(level,'o').map(coords)}。`;
}
function setState(next:State){
  state=next;el('app').dataset.state=next;
  if(['input','reading'].includes(next))animateCover();else stopCover();
  el('input-panel').hidden=!['input','reading'].includes(next);
  el('sample-row').hidden=!['input','reading'].includes(next);
  el('confirm-panel').hidden=next!=='confirm';el('result-panel').hidden=next!=='done';
  el('opening-panel').hidden=next!=='opening';
  el('memory-panel').hidden=next!=='memory';
  el('ceremony-controls').hidden=next!=='fading';
  el('departure-panel').hidden=leaving||!['waiting','fading','done'].includes(next);
  el('journey-bag').hidden=leaving||!['playing','cleared','waiting','done'].includes(next);
  el('show-controls').hidden=leaving||!['playing','cleared','memory','paused','waiting'].includes(next);
  el('pause').hidden=next==='waiting';el('skip').hidden=next==='waiting'||next==='memory'||next==='paused'&&pausedFrom==='memory';
  el('pause').textContent=next==='paused'?'继续':'暂停';
  el('lamp-controls').hidden=next!=='waiting'||leaving;el('lamp-hotspot').hidden=next!=='waiting'||leaving;
  el('leave-prompt').hidden=!leaving;
  el<HTMLButtonElement>('arrange').disabled=next==='reading';
  el('arrange').textContent=next==='reading'?'正在读取…':'整理档案 →';
  el('cancel-read').hidden=next!=='reading';
  for(const id of ['sample-weather','sample-novel'])el<HTMLButtonElement>(id).disabled=next==='reading';
  if(['input','reading'].includes(next)){
    el('headline').textContent='再走一小段';
    el('project-label').textContent='夜班收件 · 和项目同行';
  }else if(next==='opening'){
    el('headline').textContent='';
    el('project-label').textContent='夜班开门 · 有人来赴约';
  }else{
    el('headline').textContent=next==='waiting'?'这一程，到站了':'';
    el('project-label').textContent=identity.facts.name.value+(identity.demo?' · 样例':'');
  }
  const game=['playing','paused','cleared'].includes(next)&&!(next==='paused'&&pausedFrom==='memory');
  el('app').dataset.game=String(game);
  el('game-hud').hidden=!game;el('game-controls').hidden=!game||leaving;
  el('paused-panel').hidden=next!=='paused'||leaving;
  for(const button of el('game-controls').querySelectorAll<HTMLButtonElement>('button'))button.disabled=next==='paused';
  el('bag-heading').textContent=['waiting','done'].includes(next)?'点一件行李，翻开对应的项目故事':'更新 · 去处 · 告别';
  refreshGame();
  const inMemory=next==='memory'||next==='paused'&&pausedFrom==='memory';
  stage.setAttribute('aria-describedby',game?'game-objective board-description':inMemory?'memory-text memory-keepsake':next==='opening'?'opening-line':'project-label');
  if(inMemory)memoryText();
  else if(next==='opening')stage.setAttribute('aria-label',`夜色里，你和${identity.facts.name.value||'项目'}重新会合，准备启程。`);
  else if(next==='done')stage.setAttribute('aria-label',`末班车载着项目幽灵离站。你留在站台，行李里有 ${journey.memories.length} 件旅途物件。点击空处泛起波纹，点击收好的物件重看项目故事。`);
  else if(next==='fading')stage.setAttribute('aria-label',`项目幽灵正走向末班车。你留在站台，行李里有 ${journey.memories.length} 件旅途物件。`);
  else if(next==='waiting')stage.setAttribute('aria-label',`夜间站台。你和项目幽灵坐在长椅上，行李里有 ${journey.memories.length} 件旅途物件。点击空处泛起波纹，点击收好的物件重看项目故事。`);
  if(next==='waiting'||next==='fading'){
    const words=farewellLines(identity,journey);
    el('departure-memory').textContent=words.memory;el('departure-choice').textContent=words.choice;
    el('departure-voice').textContent=next==='waiting'?'准备好了，就替我关灯吧。':rememberedPage(identity,journey)?'这一页，交给你。':'谢谢你陪我走到这里。';
  }else if(next==='done'){
    const words=farewellLines(identity,journey);
    el('departure-memory').textContent=words.memory;el('departure-choice').textContent=words.choice;
    el('departure-voice').textContent='列车已经出发。行李还在这里，可以再翻一页。';
  }
  const farewell=farewells[identity.farewellIntent??'undecided'];
  el('station-intent-panel').hidden=next!=='waiting';
  el<HTMLSelectElement>('station-intent').value=identity.farewellIntent??'undecided';
  el('station-intent-note').textContent=farewell.description;
  if(next==='waiting')el<HTMLButtonElement>('use-project-note').disabled=!identity.regret||Boolean(el<HTMLTextAreaElement>('farewell-note').value.trim());
  el('lamp').textContent=farewell.action;
  el('lamp-hotspot').setAttribute('aria-label',farewell.action);
  if(next==='done'){el('result-title').textContent=farewell.label;el('result-intent').textContent=farewell.finale;}
}
function showPreflight(page:string){
  preflightPage=page;
  for(const name of ['project','heart','scene'])el('preflight-'+name).hidden=name!==page;
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-preflight]')){if(button.dataset.preflight===page)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');}
  el('preflight-next').hidden=page==='scene';
}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-preflight]'))button.addEventListener('click',()=>showPreflight(button.dataset.preflight!));
el('preflight-next').addEventListener('click',()=>showPreflight(preflightPage==='project'?'heart':'scene'));
function showResultPage(page:string){
  for(const name of ['ticket','memories','project','ritual'])el('result-'+name).hidden=name!==page;
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-result-page]')){if(button.dataset.resultPage===page)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  if(page==='memories')el<HTMLDetailsElement>('album-section').open=true;
}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-result-page]'))button.addEventListener('click',()=>showResultPage(button.dataset.resultPage!));
function previewDestination(){
  const city=el<HTMLInputElement>('departure-city').value;
  draft.destination=city.trim()?destination(city,el<HTMLSelectElement>('departure-season').value):undefined;
  const canvas=el<HTMLCanvasElement>('destination-preview'),context=canvas.getContext('2d');
  if(context){context.clearRect(0,0,384,180);drawCity(context,draft.destination??destination('林间小城'),0);}
  el('destination-caption').textContent=destinationCaption(draft.destination);
  el('destination-error').textContent='';
}
const tryPreviewDestination=()=>{try{previewDestination();}catch(e){error('destination-error',e);}};
el('preview-city').addEventListener('click',tryPreviewDestination);
el('departure-season').addEventListener('change',tryPreviewDestination);
el('departure-city').addEventListener('change',tryPreviewDestination);
function applyCity(){
  if(!['playing','cleared'].includes(state))return;
  try{
    identity.destination=destination(el<HTMLInputElement>('city-input').value,el<HTMLSelectElement>('city-season').value);
    el('city-status').textContent=destinationCaption(identity.destination)+(identity.destination.kind==='other'?' · 这座城市先用通用夜景，风格由你选择。':' · 城市灯光已经接上这段旅程。');
    refreshGame();draw();
  }catch(e){error('city-status',e);}
}
el('city-form').addEventListener('submit',event=>{event.preventDefault();applyCity();});
el('city-season').addEventListener('change',applyCity);
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-city]'))button.addEventListener('click',()=>{el<HTMLInputElement>('city-input').value=button.dataset.city!;el<HTMLSelectElement>('city-season').value=button.dataset.season!;applyCity();});
el('city-secret').addEventListener('click',()=>{
  if(state!=='playing'||!identity.destination)return;
  journey.citySecret=true;companionLight=true;guides.checked=true;
  el('game-status').textContent='发现城市灯语！获得同行灯：同时照亮你和伙伴能走的下一格。';
  refreshGame();draw();el('companion-light').focus({preventScroll:true});
});
el('companion-light').addEventListener('click',()=>{if(state!=='playing'||!journey.citySecret)return;companionLight=!companionLight;if(companionLight)guides.checked=true;refreshGame();draw();});
el<HTMLInputElement>('project-photos').addEventListener('change',async event=>{
  const input=event.target as HTMLInputElement,files=[...(input.files??[])],target=draft;
  if(!files.length)return;
  if((draft.photos?.length??0)+files.length>4){error('photo-status','最多带上 4 张图片，先移除旧图片再试。');input.value='';return;}
  el<HTMLButtonElement>('start').disabled=true;input.disabled=true;el('photo-status').textContent='正在收好图片…';
  try{const photos=await Promise.all(files.map(readProjectPhoto));if(draft!==target||state!=='confirm')return;draft.photos=[...(draft.photos??[]),...photos];renderProjectMedia(el('project-media'),draft);el('clear-photos').hidden=false;el('photo-status').textContent=`已收好 ${draft.photos.length} 张图片。会随回忆册保存，仅留在本次页面。`;}
  catch(e){if(draft===target)error('photo-status',e);}
  finally{el<HTMLButtonElement>('start').disabled=false;input.disabled=false;input.value='';}
});
el('clear-photos').addEventListener('click',()=>{delete draft.photos;renderProjectMedia(el('project-media'),draft);el('clear-photos').hidden=true;el('photo-status').textContent='图片已移除。';});

function renderDraftDossier(current=draft){
  renderDossier(el('confirm-keywords'),current,sha=>{
    for(const id of [draft,current]){const commit=id.milestones?.find(item=>item.sha===sha);if(commit)delete commit.diary;}
    renderDraftDossier(current);
  });
}
function enterConfirm(next:Identity){
  cancelImport();readSequence++;
  if(!ctx){error('input-error','当前浏览器无法绘制像素舞台。请换个浏览器重试，输入仍会保留。');return;}
  draft=next;identity=structuredClone(next);
  el<HTMLInputElement>('route-full').checked=true;
  showPreflight('project');renderProjectMedia(el('project-media'),draft);
  el('clear-photos').hidden=!draft.photos?.length;el('photo-status').textContent='最多 4 张，仅用于本次旅程；下载回忆册会一并保存。';
  el<HTMLInputElement>('departure-city').value=draft.destination?.city??'';
  el<HTMLSelectElement>('departure-season').value=draft.destination?.season??'night';previewDestination();
  el<HTMLTextAreaElement>('project-regret').value=draft.regret??'';
  el<HTMLSelectElement>('farewell-intent').value=draft.farewellIntent??'undecided';
  updateIntentPreview();
  for(const key of fields){edits[key].value=draft.facts[key].value;el('source-'+key).textContent=sourceLabel(draft,draft.facts[key])+(draft.facts[key].source==='analysis'?' · '+draft.facts[key].evidence:'');}
  prop.value=draft.prop;palette.value=draft.palette;accessory.value=draft.accessory;
  el('confirm-error').textContent='';
  el('confirm-note').textContent=draft.demo?'演示资料 · 可以修改':draft.review?'根据所选材料整理 · 点开可核对':'根据你提供的资料整理';
  renderDraftDossier();
  el('confirm-title').textContent=draft.facts.name.value||'项目行李';
  el('review-panel').hidden=!draft.review;el('review-content').replaceChildren();
  if(draft.review){for(const item of draft.review.items){const p=document.createElement('p'),small=document.createElement('small');p.textContent=item.text;small.textContent=item.evidence;small.className='source';p.append(small);el('review-content').append(p);}for(const limit of draft.review.limits){const p=document.createElement('p');p.className='note';p.textContent=limit;el('review-content').append(p);}}
  setState('confirm');draw();el('confirm-panel').scrollIntoView({block:'start',behavior:'instant'});el('start').focus({preventScroll:true});
}
function updateIntentPreview(){
  const intent=parseFarewellIntent(el<HTMLSelectElement>('farewell-intent').value),copy=farewells[intent];
  el('farewell-intent-note').textContent=copy.description;
  el<HTMLTextAreaElement>('project-regret').placeholder=copy.placeholder;
}
for(const id of ['farewell-intent','station-intent']){
  const select=el<HTMLSelectElement>(id);
  for(const [value,copy] of Object.entries(farewells)){const option=document.createElement('option');option.value=value;option.textContent=copy.label;select.append(option);}
}
el('farewell-intent').addEventListener('change',updateIntentPreview);
el('station-intent').addEventListener('change',()=>{
  if(state!=='waiting')return;
  identity.farewellIntent=parseFarewellIntent(el<HTMLSelectElement>('station-intent').value);
  setState('waiting');if(stationStoryIndex!==undefined)showStationStory(stationStoryIndex,false);draw();
});
for(const key of fields)edits[key].addEventListener('input',()=>{
  el('source-'+key).textContent=edits[key].value.trim()===draft.facts[key].value?sourceLabel(draft,draft.facts[key]):edits[key].value.trim()?'你填写的信息':'未说明';
  try{const current=confirmIdentity(draft,Object.fromEntries(fields.map(k=>[k,edits[k].value])) as Record<Field,string>,prop.value,palette.value,accessory.value);renderDraftDossier(current);}catch{/* Full validation runs on submit. */}
});
for(const choice of [prop,palette,accessory])choice.addEventListener('change',()=>{
  identity={...identity,prop:prop.value as Prop,palette:palette.value as Palette,accessory:accessory.value as Accessory};draw();
});
el('sample-weather').addEventListener('click',()=>enterConfirm(example('weather')));
el('sample-novel').addEventListener('click',()=>enterConfirm(example('novel')));
el('input-form').addEventListener('submit',event=>{
  event.preventDefault();if(state!=='input')return;
  el('input-error').textContent='';
  try{
    const name=inputName.value.trim(),onlyName=el<HTMLInputElement>('name-only').checked;
    if(count(name)>40)throw new Error('项目名请控制在 40 字以内。');
    if(!description.value.trim()&&!onlyName)throw new Error('留一句它原本想做什么，或勾选“只留下名字”。也可以先看一个样例。');
    if(onlyName&&!name)throw new Error('只留下名字时，请先给它起个名字。');
    const next=parseInput(name,onlyName?'':description.value,inputSource);
    if(fileTruncated&&!onlyName){next.facts.completed={value:'',source:null,evidence:'',confirmed:false};next.facts.unfinished={value:'',source:null,evidence:'',confirmed:false};}
    if(!onlyName&&description.value.trim())next.sourceFiles=[{path:inputSource==='readme'?'README.md':'项目介绍.txt',text:cleanText(description.value),truncated:fileTruncated}];
    enterConfirm(next);
  }catch(e){error('input-error',e);}
});
description.addEventListener('input',()=>{inputSource='user';fileTruncated=false;el('file-note').textContent='';});
el<HTMLInputElement>('project-file').addEventListener('change',async event=>{
  const picker=event.target as HTMLInputElement,file=picker.files?.[0];if(!file)return;
  if(!['input','reading'].includes(state))return;
  const sequence=++readSequence;setState('reading');el('input-error').textContent='';el('file-note').textContent='正在读取你选择的说明文件…';
  try{
    const result=await readProjectFile(file);if(sequence!==readSequence)return;
    description.value=result.text;inputSource='readme';fileTruncated=result.truncated;
    el('file-note').textContent=result.truncated?`已读取 ${file.name} 的前 12,000 字，后续内容未使用。请核对介绍；完成情况由你填写。`:`已读取 ${file.name}。只在此页面使用，没有上传。`;
  }catch(e){if(sequence===readSequence){error('input-error',e);el('file-note').textContent='读取未完成，原有介绍已保留。';}}
  finally{if(sequence===readSequence){setState('input');picker.value='';}}
});
el('cancel-read').addEventListener('click',()=>{readSequence++;setState('input');el('file-note').textContent='已取消读取，原有介绍已保留。';el<HTMLInputElement>('project-file').value='';});

function returnToInput(){
  pulses=[];selectedParcel=undefined;stationRipples=[];cancelAnimationFrame(stationRaf);stationRaf=0;
  cancelImport();readSequence++;stopClock();sound.stop();releasePreview();leaving=false;elapsed=0;dark=0;journey=newJourney();levelIndex=0;board=newBoard(levels[0]);history=[];future=[];motion=undefined;queued=[];hintPoint=undefined;
  el('input-error').textContent='';el('sound-note').textContent='';setState('input');draw();el('input-panel').scrollIntoView({block:'start',behavior:'instant'});(el('input-form').hidden?el('source-folder'):inputName).focus({preventScroll:true});
}
el('back').addEventListener('click',returnToInput);

function waiting(){
  stopClock();sound.stop();queued=[];setState('waiting');draw();animateWaiting();el('begin-ritual').focus({preventScroll:true});
}
function animateWaiting(){
  stopClock();if(!reduced.checked&&!document.hidden&&!settings.open&&!ritualDialog.open&&!leaving){lastStamp=performance.now();raf=requestAnimationFrame(tick);}
}
function tick(now:number){
  if(!['opening','playing','cleared','memory','waiting'].includes(state))return;
  const previous=elapsed;elapsed+=Math.min(.05,Math.max(0,now-lastStamp)/1000);lastStamp=now;
  if(state==='opening'){
    const count=identity.milestones?.length??0;
    const lines=openingJourney?[
      {at:1.3,text:`夜班灯亮了。「${identity.facts.name.value||'这个项目'}」带着最近的更新，回到事务所。`},
      {at:3.2,text:count?`桌上有 ${count} 次已选中的提交；没有取到的经过，就留白。`:'这份资料没有 Git 提交记录，我们不替它补写过去。'},
      {at:5.5,text:journey.itinerary==='one'?'今晚只走一段小径。路的尽头，有一班为你们停留的车。':'夜路深处，还留着一些没有熄灭的光。'},
      {at:7.7,text:'伙伴提起行李，像是认出了某条很久以前的路。'},
      {at:10,text:'那些没有说完的话，等走近了再听。'},
      {at:11.8,text:'最后一起到站。关掉灯，让伙伴带着这段同行启程。'},
    ]:[
      {at:1.6,text:'夜雨落在事务所的窗上，桌面还亮着一盏灯。'},
      {at:3.8,text:'门外有个项目伙伴，带着做过的事，也带着一起走过的日子。'},
      {at:6,text:'桌上先留出七站的位置；等你带来项目，再把真实资料放进日记。'},
      {at:8.4,text:'窗外有一道微光，一会儿亮，一会儿隐进树影。'},
      {at:10.8,text:'先陪它走一段。怎样告别，可以慢慢想。'},
    ];
    el('opening-line').textContent=lines.filter(line=>elapsed>=line.at).at(-1)?.text??'夜班刚刚亮灯。';
    draw();if(elapsed>=(openingJourney?13.4:12.4)){completeOpening();return;}raf=requestAnimationFrame(tick);return;
  }
  if(state!=='waiting')sound.tick(elapsed,previous);
  pulses=pulses.filter(p=>elapsed-p.at<.7);
  if(queued.length&&(!motion||elapsed-motion.at>=.16)){const next=queued.shift()!;if(next.action==='switch')switchCharacter();else takeMove(next.action,next.actor);}
  draw();raf=requestAnimationFrame(tick);
}
async function enableSound(){
  const success=await sound.unlock();
  el('sound-note').textContent=success?'':'声音暂未启用，画面会照常进行。';
}
function enterPlaying(){
  elapsed=0;setState('playing');draw();el('game-status').textContent=identity.milestones?.[0]?`伙伴：从 ${identity.milestones[0].date} 这次更新开始吧。`:playMode==='together'?'WASD 和方向键，各走一个角色':'方向键移动 · X 换人';
  el('game-hud').scrollIntoView({block:'start',behavior:'instant'});stage.focus({preventScroll:true});
}
function finishOpening(){openingJourney=false;elapsed=0;setState('input');draw();}
function completeOpening(){
  if(!openingJourney){finishOpening();return;}
  openingJourney=false;enterPlaying();void enableSound();lastStamp=performance.now();raf=requestAnimationFrame(tick);
}
function start(){
  companionLight=false;
  el<HTMLInputElement>('city-input').value=identity.destination?.city??'';el<HTMLSelectElement>('city-season').value=identity.destination?.season??'night';
  el('city-workbench-title').textContent=identity.prop==='umbrella'?'项目体验 · 输入城市':'旅程目的地 · 城市场景';
  el<HTMLDetailsElement>('city-workbench').open=false;
  el('city-status').textContent=destinationCaption(identity.destination)+' · 场景天气由你选择。';
  pulses=[];selectedParcel=undefined;stationRipples=[];cancelAnimationFrame(stationRaf);stationRaf=0;
  const farewellNote=state==='done'?journey.farewellNote:undefined,relics=state==='done'?journey.relics:undefined;
  const notes=state==='done'?journey.notes:{},bookmark=state==='done'?journey.bookmark:undefined;pickupAt=undefined;stationStoryIndex=undefined;el('station-story').hidden=true;
  playMode=document.querySelector<HTMLInputElement>('input[name="play-mode"]:checked')?.value==='together'?'together':'solo';
  stopClock();sound.stop();releasePreview();elapsed=0;dark=0;leaving=false;journey={...newJourney(),notes,bookmark,farewellNote,relics};
  journey.itinerary=el<HTMLInputElement>('route-one').checked?'one':'full';
  el<HTMLTextAreaElement>('farewell-note').value=farewellNote??'';el('farewell-note-error').textContent='';el('farewell-note-status').textContent=`${count(farewellNote??'')} / 120 字 · 可留白`;levelIndex=0;board=newBoard(levels[0]);history=[];future=[];motion=undefined;entered=0;queued=[];hintPoint=undefined;
  el('export-error').textContent='';el('export-status').textContent='';el('book-status').textContent='';el('sound-note').textContent='';
  el('app').dataset.reduced=String(reduced.checked);
  if(reduced.checked){enterPlaying();void enableSound();lastStamp=performance.now();raf=requestAnimationFrame(tick);}
  else{openingJourney=true;elapsed=0;setState('opening');draw();el('skip-opening').focus({preventScroll:true});void enableSound();lastStamp=performance.now();raf=requestAnimationFrame(tick);}
}
el('confirm-form').addEventListener('submit',event=>{
  event.preventDefault();if(state!=='confirm')return;
  try{previewDestination();identity=confirmIdentity(draft,Object.fromEntries(fields.map(k=>[k,edits[k].value])) as Record<Field,string>,prop.value,palette.value,accessory.value,el<HTMLTextAreaElement>('project-regret').value,el<HTMLSelectElement>('farewell-intent').value);start();}
  catch(e){error('confirm-error',e);}
});
el('skip-opening').addEventListener('click',()=>{if(state!=='opening')return;stopClock();const journeyIntro=openingJourney;completeOpening();if(journeyIntro)stage.focus({preventScroll:true});else el('sample-weather').focus({preventScroll:true});});
function pause(){if(!['playing','cleared','memory'].includes(state))return;pausedFrom=state;queued=[];stopClock();sound.stop();setState('paused');draw();}
function resume(){if(state!=='paused')return;setState(pausedFrom);void enableSound();lastStamp=performance.now();raf=requestAnimationFrame(tick);}
el('pause').addEventListener('click',()=>state==='paused'?resume():pause());
el('resume-game').addEventListener('click',resume);
function recordLevel(){
  if(won(levels[levelIndex],board)&&!journey.visited.includes(levelIndex)){journey.visited.push(levelIndex);journey.steps+=board.steps;}
  if(won(levels[levelIndex],board)&&choiceOf(levels[levelIndex],board))journey.resolution=choiceOf(levels[levelIndex],board);
  if(board.found&&!journey.memories.includes(levelIndex))journey.memories.push(levelIndex);
}
el('skip').addEventListener('click',()=>{if(['playing','cleared','paused'].includes(state)){recordLevel();journey.skipped=!reachedJourneyEnd(journey,levelIndex);waiting();}});
el('next-level').addEventListener('click',()=>{
  if(state!=='cleared')return;recordLevel();openMemory(levelIndex,null);
});
function showMemoryMode(mode:'story'|'relic'){
  const available=relicFiles(identity,memoryIndex).length>0&&journey.visited.includes(memoryIndex);
  memoryMode=available?mode:'story';el('memory-pages').hidden=!available;
  el('story-card').hidden=memoryMode!=='story';el('relic-desk').hidden=memoryMode!=='relic';
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-memory-mode]')){if(button.dataset.memoryMode===memoryMode)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-memory-mode]'))button.addEventListener('click',()=>showMemoryMode(button.dataset.memoryMode as 'story'|'relic'));
function memoryText(){
  el('short-memory-guide').hidden=journey.itinerary!=='one'||memoryReturn!==null;
  const story=memoryStory(identity,memoryIndex,journey),lines=el('memory-text');
  el('memory-title').textContent=story.title;el('story-scene').textContent=story.scene;el('story-card').dataset.milestone=String(story.milestone);el('memory-source').textContent=story.source;
  lines.replaceChildren(...story.lines.map(line=>{const p=document.createElement('p');p.textContent=line;return p;}));
  const commit=story.milestone?identity.milestones?.[memoryIndex]:undefined;
  el('memory-evidence').replaceChildren(...(commit?[commitEvidence(commit)]:[]));
  renderRelicDesk(el('relic-desk'),identity,journey,memoryIndex,()=>{releasePreview();draw();sound.found();},()=>reduced.checked);
  showMemoryMode(memoryMode);
  const canKeep=rememberedPage(identity,journey,memoryIndex),marked=canKeep&&journey.bookmark===memoryIndex;
  el('bookmark-memory').hidden=!canKeep;el('bookmark-memory').setAttribute('aria-pressed',String(Boolean(marked)));
  el('bookmark-memory').textContent=marked?'书签已夹好 · 这一页留给我':'夹上书签，留下这一页';
  el('memory-chapter').textContent=story.milestone?`和 ${identity.facts.name.value} 一起翻日记`:`${String(memoryIndex+1).padStart(2,'0')} / ${levels[memoryIndex].title}`;
  lines.classList.toggle('unwritten',story.empty);
  el('memory-keepsake').textContent=memoryIndex===5&&journey.resolution?resolutionText[journey.resolution]:story.milestone?'一起回看，这次真实留下的变化。':journey.memories.includes(memoryIndex)?keepsakes[memoryIndex].caption:'这一格，先留白';
  el('future-note').hidden=memoryIndex!==6||journey.resolution!=='carry';
  el('future-context').textContent=chapterCargo(identity,5).source==='未说明'?'':chapterCargo(identity,5).text;
  el<HTMLTextAreaElement>('memory-note').placeholder=memoryIndex>=5?'这些年，想感谢谁？哪件做成的事，让你觉得值得？也可以先留白。最多 120 字。':'那天你在做什么？有什么是提交记录没写下的？最多 120 字。';
  stage.setAttribute('aria-label',memoryIndex===6?`最后一站：你和「${identity.facts.name.value}」的项目幽灵在站台好好告别。`:`${story.title}。夜间事务所里，你和项目幽灵一起看着它的随身物件。`);
}
function openMemory(index:number,returnTo:typeof memoryReturn){
  memoryMode='story';
  stopClock();queued=[];memoryIndex=index;memoryAt=elapsed;memoryReturn=returnTo;
  el<HTMLTextAreaElement>('memory-note').value=journey.notes[index]??'';
  el<HTMLInputElement>('next-step').value=journey.nextStep;el('next-step').removeAttribute('aria-invalid');el<HTMLDetailsElement>('future-note').open=false;el('next-step-error').textContent='';
  el<HTMLDetailsElement>('memory-write').open=false;el('memory-note-error').textContent='';
  el('memory-back').hidden=returnTo!==null;
  el('memory-continue').textContent=returnTo?'合上这一页':reachedJourneyEnd(journey,index)?'带上这一页，去站台 →':index===5?'收好回忆，去告别 →':'带上这一页，继续走 →';
  setState('memory');memoryText();draw();lastStamp=performance.now();raf=requestAnimationFrame(tick);
  el('project-label').scrollIntoView({block:'start',behavior:'instant'});el('memory-continue').focus({preventScroll:true});
}
el('memory-continue').addEventListener('click',()=>{
  if(state!=='memory'||!saveMemoryNote())return;
  if(memoryReturn){
    const backTo=memoryReturn;memoryReturn=null;
    if(backTo==='done'){showResultPage('memories');stopClock();sound.stop();setState('done');renderAlbum();if(stationStoryIndex!==undefined)showStationStory(stationStoryIndex,false);draw();if(!previewUrl||download.disabled)void generatePreview();el('result-panel').scrollIntoView({block:'start',behavior:'instant'});el('album-section').focus({preventScroll:true});}
    else if(backTo==='waiting'){waiting();if(stationStoryIndex!==undefined)showStationStory(stationStoryIndex,false);}
    else{setState(backTo);draw();stage.focus({preventScroll:true});}
    return;
  }
  if(reachedJourneyEnd(journey,levelIndex)){waiting();return;}
  levelIndex++;board=newBoard(levels[levelIndex]);history=[];future=[];motion=undefined;pickupAt=undefined;pulses=[];selectedParcel=undefined;queued=[];hintPoint=undefined;entered=elapsed;
  setState('playing');el('game-status').textContent=levelIndex<5&&identity.milestones?.[levelIndex]?`伙伴：这是 ${identity.milestones[levelIndex].date} 的更新。`:levelIndex===5?'伙伴：值得记住的，也可以留在这一页。':'伙伴：送我到站台吧。';draw();stage.focus({preventScroll:true});
});
el('memory-back').addEventListener('click',()=>{if(state==='memory'&&saveMemoryNote()){setState('cleared');draw();el('undo').focus({preventScroll:true});}});
el('bookmark-memory').addEventListener('click',()=>{
  if(state!=='memory'||!saveMemoryNote()||!rememberedPage(identity,journey,memoryIndex))return;
  if(journey.bookmark===memoryIndex)delete journey.bookmark;else journey.bookmark=memoryIndex;
  releasePreview();memoryText();draw();sound.found();
});
function saveMemoryNote(){
  if(state!=='memory')return false;
  const text=el<HTMLTextAreaElement>('memory-note').value.trim();
  if(count(text)>120){el('memory-note-error').textContent='留在 120 字以内就好。';el<HTMLDetailsElement>('memory-write').open=true;return false;}
  if(memoryIndex===6&&journey.resolution==='carry'){
    try{journey.nextStep=validateNextStep(el<HTMLInputElement>('next-step').value);el('next-step-error').textContent='';}
    catch(e){error('next-step-error',e);el('next-step').setAttribute('aria-invalid','true');el<HTMLDetailsElement>('future-note').open=true;el('next-step').focus();return false;}
  }
  const previousNote=journey.notes[memoryIndex]??'';
  if(text)journey.notes[memoryIndex]=text;else delete journey.notes[memoryIndex];
  if(journey.bookmark===memoryIndex&&previousNote!==text){if(!rememberedPage(identity,journey))delete journey.bookmark;releasePreview();}
  el('memory-note-error').textContent='';el<HTMLDetailsElement>('memory-write').open=false;memoryText();
  return true;
}
el('save-memory').addEventListener('click',saveMemoryNote);
el<HTMLInputElement>('next-step').addEventListener('input',()=>{if(count(el<HTMLInputElement>('next-step').value.trim())<=60){el('next-step-error').textContent='';el('next-step').removeAttribute('aria-invalid');}});
function renderAlbum(){
  const lines=ritualLines(journey);el('ritual-tab').hidden=!lines.length;
  el('ritual-receipt').replaceChildren(...lines.map(line=>{const p=document.createElement('p');p.textContent=line;return p;}));
  const relics=relicRows(identity,journey),shelf=el('relic-collection');shelf.replaceChildren();shelf.hidden=!relics.length;el('save-handover').hidden=!relics.length;
  if(relics.length){const heading=document.createElement('h3');heading.textContent='你亲手收好的项目遗物';shelf.append(heading);for(const row of relics){const button=document.createElement('button');button.type='button';button.textContent=`${row.label} · ${row.path}`;button.addEventListener('click',()=>openMemory(row.index,'done'));shelf.append(button);}}
  el('album-empty').hidden=journey.visited.length>0;
  const page=rememberedPage(identity,journey);el('remembered-page').hidden=!page;
  el('remembered-title').textContent=page?.title??'';el('remembered-source').textContent=page?`${page.date?page.date+' · ':''}${page.source}`:'';
  el('ending-step').hidden=journey.resolution!=='carry'||!journey.visited.includes(6)||!journey.nextStep;
  el('ending-step-text').textContent=journey.nextStep;
  const album=el('memory-album');album.replaceChildren();el('album-section').hidden=!journey.visited.length;
  for(const i of journey.visited){const button=document.createElement('button');button.type='button';button.textContent=`${journey.bookmark===i?'▰ ':''}${String(i+1).padStart(2,'0')}  ${memoryStory(identity,i,journey).title}${journey.notes[i]?' · 有你的留言':''}`;button.addEventListener('click',()=>openMemory(i,'done'));album.append(button);}
}
el('reopen-bookmark').addEventListener('click',()=>{const page=rememberedPage(identity,journey);if(state==='done'&&page)openMemory(page.index,'done');});
function showStationStory(index:number,ripple=true){
  const story=keepsakeStory(identity,index,journey);stationStoryIndex=index;
  el('station-story-topic').textContent=story.topic.keyword?`项目关键词 · ${story.topic.text}`:`旅途线索 · ${story.topic.text}`;
  el('station-story-title').textContent=story.title;
  el('station-story-lines').replaceChildren(...story.lines.map(line=>{const p=document.createElement('p');p.textContent=line;return p;}));
  el('station-story-source').textContent=story.source;el('station-story').hidden=false;
  refreshGame();if(ripple)addStationRipple(248+8+(index%4)*13.5,139+10+Math.floor(index/4)*16,'memory');
}
el('station-open-diary').addEventListener('click',()=>{
  if(stationStoryIndex!==undefined&&['waiting','done'].includes(state))openMemory(stationStoryIndex,state as 'waiting'|'done');
});
const bagButtons=keepsakes.map((_,i)=>{
  const button=document.createElement('button'),icon=document.createElement('canvas'),label=document.createElement('small');button.type='button';icon.width=24;icon.height=24;icon.setAttribute('aria-hidden','true');
  const topic=keepsakeTopic(identity,i),context=icon.getContext('2d');if(context)drawKeepsake(context,i,12,12,1,topic.text);
  button.append(icon,label);button.addEventListener('click',()=>{
    if(leaving||!journey.visited.includes(i))return;
    if(['waiting','done'].includes(state)){showStationStory(i);return;}
    if(['playing','cleared'].includes(state))openMemory(i,state as 'playing'|'cleared');
  });
  el('bag-items').append(button);return button;
});
function takeMove(direction:Direction,requestedActor:Actor=board.active){
  if(state!=='playing'||leaving)return;
  const actor=playMode==='together'?requestedActor:board.active;
  if(motion&&!reduced.checked&&elapsed-motion.at<.16){queueAction(actor,direction);return;}
  const from=board;if(board.active!==actor)board={...board,active:actor};
  const next=move(levels[levelIndex],board,direction);hintPoint=undefined;
  if(!next){motion={from:board,at:elapsed,bump:directions[direction]};sound.blocked();el('game-status').textContent=actor==='ghost'?'幽灵能过水，箱子交给你。':'这里走不通 · Z 撤销';refreshGame();draw();return;}
  history.push(from);future=[];motion={from:board,at:elapsed-(reduced.checked?.16:0)};
  const foundTopic=next.found&&!board.found?keepsakeTopic(identity,levelIndex).text:undefined;
  if(foundTopic!==undefined){pickupAt=elapsed;sound.found();}
  else{const pushed=!next.boxes.every((p,i)=>same(p,board.boxes[i]));sound.step(pushed);el('game-status').textContent=pushed&&corneredBoxes(levels[levelIndex],next).length?'箱子进了墙角 · 可以撤销这一步':'';}
  const lit=next.lit.filter(p=>!board.lit.some(l=>same(p,l)));
  if(lit.length){const lamps=positions(levels[levelIndex],'a'),item=parcelContents(identity,levelIndex,lamps.length,journey.resolution==='carry')[lamps.findIndex(p=>same(p,lit[0]))];sound.found();el('game-status').textContent=item.source==='未说明'?`伙伴：点亮了 ${next.lit.length} / ${lamps.length} 盏灯。`:`伙伴：${item.text}，亮起来了。`;}
  const packed=next.boxes.flatMap((p,i)=>!same(p,board.boxes[i])&&['t','r'].includes(tile(levels[levelIndex],p))?[{p,i}]:[]);
  if(packed.length){const item=parcelContents(identity,levelIndex,next.boxes.length,journey.resolution==='carry')[packed[0].i],target=tile(levels[levelIndex],packed[0].p);el('game-status').textContent=levelIndex===5?target==='r'?'伙伴：这一页，留给下一站。':'伙伴：这一页，就收在这里。':item.source==='未说明'?'伙伴：行李收好了。':`伙伴：${item.text}，收好了。`;sound.found();}
  if(foundTopic!==undefined)el('game-status').textContent=`伙伴：我记下了「${foundTopic}」。`;
  if(!reduced.checked)pulses.push(...lit.map(point=>({point,at:elapsed,kind:'light' as const})),...packed.map(({p})=>({point:p,at:elapsed+.16,kind:'packed' as const})));
  board=next;
  if(won(levels[levelIndex],board)){queued=[];sound.win();setState('cleared');el('next-level').focus({preventScroll:true});}
  refreshGame();draw();
}
function switchCharacter(){
  if(state!=='playing'||leaving||playMode==='together')return;
  if(motion&&!reduced.checked&&elapsed-motion.at<.16){queueAction(board.active,'switch');return;}
  queued=[];motion=undefined;future=[];board={...board,active:board.active==='you'?'ghost':'you'};
  sound.switch();hintPoint=undefined;el('game-status').textContent=board.active==='ghost'?'幽灵 · 可以过水，不能推箱':'你 · 可以推箱';refreshGame();draw();
}
function undo(){
  if(!['playing','cleared'].includes(state)||!history.length||leaving)return;
  const from=board;future.push(board);board=history.pop()!;pulses=[];if(positions(levels[levelIndex],'r').length)journey.resolution=null;if(!board.found)pickupAt=undefined;queued=[];motion={from,at:elapsed-(reduced.checked?.16:0)};hintPoint=undefined;setState('playing');el('game-status').textContent='退回一步';draw();
}
function redo(){
  if(state!=='playing'||!future.length||leaving)return;
  const from=board;history.push(board);board=future.pop()!;pulses=[];queued=[];hintPoint=undefined;
  if(board.found&&!from.found)pickupAt=elapsed;
  const complete=won(levels[levelIndex],board);motion={from,at:elapsed-(reduced.checked?.16:0)};setState(complete?'cleared':'playing');el('game-status').textContent='回到这一步';draw();
  if(complete)el('next-level').focus({preventScroll:true});
}
el('switch-character').addEventListener('click',switchCharacter);el('undo').addEventListener('click',undo);
el('redo').addEventListener('click',redo);
el('restart-level').addEventListener('click',()=>{
  if(!['playing','cleared'].includes(state)||leaving)return;
  if(positions(levels[levelIndex],'r').length)journey.resolution=null;
  board=newBoard(levels[levelIndex]);history=[];future=[];motion=undefined;pickupAt=undefined;pulses=[];queued=[];hintPoint=undefined;setState('playing');el('game-status').textContent='重新出发';draw();
});
el('hint').addEventListener('click',async()=>{
  if(state!=='playing'||leaving)return;
  const snapshot=board,button=el<HTMLButtonElement>('hint');button.disabled=true;el('game-status').textContent='想一小会儿…';
  const route=await solve(levels[levelIndex],snapshot),next=route?.[0];button.disabled=['paused'].includes(state);
  if(board!==snapshot||state!=='playing'||leaving)return;
  el('game-status').textContent=route===null?'这条路线暂时卡住了 · 撤销或重来':next==='switch'?'下一步：切换角色':next?'下一步：'+({up:'↑ 向上',down:'↓ 向下',left:'← 向左',right:'→ 向右'} as const)[next]:'已到达';
  if(next&&next!=='switch'){const delta=directions[next],p=board[board.active];hintPoint={x:p.x+delta.x,y:p.y+delta.y};}
  draw();
});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-move]'))button.addEventListener('click',()=>takeMove(button.dataset.move as Direction,playMode==='together'?button.dataset.player as Actor:board.active));
document.addEventListener('keydown',event=>{
  if(settings.open||!['playing','cleared'].includes(state)||leaving||event.ctrlKey||event.metaKey||event.altKey||/INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName))return;
  const key=event.key.toLowerCase(),dir=({arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'} as Record<string,Direction>)[key];
  if(dir){event.preventDefault();takeMove(dir,playMode==='together'?('wasd'.includes(key)?'you':'ghost'):board.active);}else if(key==='x'){event.preventDefault();if(!event.repeat)switchCharacter();}else if(key==='y'||key==='z'&&event.shiftKey){event.preventDefault();redo();}else if(key==='z'){event.preventDefault();undo();}else if(key==='escape'){event.preventDefault();pause();}
});
let pointer:{x:number;y:number}|null=null;
stage.addEventListener('pointerdown',event=>{if(state!=='playing')return;pointer={x:event.clientX,y:event.clientY};stage.setPointerCapture(event.pointerId);});
stage.addEventListener('pointercancel',()=>{pointer=null;});
stage.addEventListener('pointerup',event=>{
  if(!pointer)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;pointer=null;
  if(Math.max(Math.abs(dx),Math.abs(dy))>16){takeMove(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');return;}
  const bounds=stage.getBoundingClientRect(),p={x:Math.floor(((event.clientX-bounds.left)/bounds.width*WIDTH-OX)/CELL),y:Math.floor(((event.clientY-bounds.top)/bounds.height*HEIGHT-OY)/CELL)};
  const touched:Actor=same(p,board.you)?'you':same(p,board.ghost)?'ghost':board.active;
  if(same(p,board.you)||same(p,board.ghost)){
    if(playMode==='together'){board={...board,active:touched};refreshGame();draw();}else switchCharacter();
    return;
  }
  const current=board[board.active];for(const [dir,d] of Object.entries(directions))if(p.x-current.x===d.x&&p.y-current.y===d.y)takeMove(dir as Direction);
});
stage.addEventListener('click',event=>{
  if(!['waiting','done'].includes(state)||leaving)return;
  const bounds=stage.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
  const x=(event.clientX-bounds.left)/bounds.width*WIDTH,y=(event.clientY-bounds.top)/bounds.height*HEIGHT;
  const col=Math.round((x-256)/13.5),row=Math.round((y-149)/16),index=row*4+col;
  if(col>=0&&col<4&&row>=0&&row<2&&Math.abs(x-(256+col*13.5))<=6&&Math.abs(y-(149+row*16))<=7&&journey.memories.includes(index)&&journey.visited.includes(index)){
    showStationStory(index);return;
  }
  addStationRipple(x,y);
});
el('change-during').addEventListener('click',()=>{leaveFrom=state;pause();leaving=true;if(state==='waiting')stopClock();setState(state);el('keep-show').focus();});
el('keep-show').addEventListener('click',()=>{leaving=false;if(['playing','cleared','memory'].includes(leaveFrom))resume();else{setState(state);if(state==='waiting')animateWaiting();}el(state==='waiting'?'lamp':'pause').focus({preventScroll:true});});
el('leave-show').addEventListener('click',returnToInput);

async function generatePreview(){
  releasePreview();const sequence=exportSequence;
  el('export-error').textContent='';el('export-status').textContent='正在整理纪念画面…';el('retry-export').hidden=true;
  try{
    const selectedDate=includeDate.checked?date.value:null;
    if(includeDate.checked&&(!selectedDate||!date.validity.valid))throw new Error('请选择有效的保留日期，或取消勾选。');
    const result=await createMemorial(identity,selectedDate,journey);
    if(sequence!==exportSequence||state!=='done')return;
    previewUrl=URL.createObjectURL(result.blob);filename=result.filename;
    image.src=previewUrl;await image.decode();
    if(sequence!==exportSequence||state!=='done')return;
    image.hidden=false;image.alt=`${identity.facts.name.value}的告别纪念票：项目幽灵登上末班车，你留在站台和行李道别。`;
    openImage.href=previewUrl;openImage.hidden=false;download.disabled=false;el('export-status').textContent='';
  }catch(e){if(sequence===exportSequence&&state==='done'){error('export-error',e);el('export-status').textContent='';el('retry-export').hidden=false;}}
}
function finish(){el('result-letter').hidden=!journey.farewellNote;el('result-letter-text').textContent=journey.farewellNote??'';showResultPage('ticket');renderProjectMedia(el('result-media'),identity);stopClock();dark=1;sound.stop();setState('done');draw();renderDossier(el('result-keywords'),identity);renderAlbum();el('result-name').textContent=identity.facts.name.value;el('journey-stats').textContent=journeyStats(journey);el('ending-choice').hidden=!journey.resolution;el('ending-choice').textContent=journey.resolution?resolutionText[journey.resolution]:'';void generatePreview();el('result-panel').scrollIntoView({block:'start',behavior:'instant'});el('replay').focus({preventScroll:true});}
function paintRitual(animate=false){
  cancelAnimationFrame(ritualRaf);const c=el<HTMLCanvasElement>('ritual-canvas').getContext('2d');if(!c)return;
  const began=performance.now();
  const frame=(now:number)=>{if(!ritualDialog.open)return;const p=animate&&!reduced.checked&&!document.hidden?Math.min(1,(now-began)/550):1;drawRitual(c,identity,journey,ritualStep,p);if(p<1)ritualRaf=requestAnimationFrame(frame);};
  frame(began);
}
function showRitualStep(animate=false){
  el('ritual-error').textContent='';
  el('ritual-progress').textContent=`告别桌 · ${ritualStep+1} / 3`;
  el('ritual-title').textContent=['安放未竟之事','为留下的东西点灯','给这一程落款'][ritualStep];
  for(let i=0;i<3;i++)el('ritual-page-'+i).hidden=i!==ritualStep;
  el('ritual-back').hidden=ritualStep===0;
  el('ritual-next').textContent=['折好这一页','带着这盏灯，继续','封存告别记，送它启程'][ritualStep];
  el('ritual-unfinished').textContent=unfinishedPage(identity);
  el('ritual-intent').textContent=farewells[identity.farewellIntent??'undecided'].description;
  const lights=ritualLights(identity,journey);
  el('ritual-kept').textContent='灯下留下：'+(lights.find(light=>light.key===journey.ritual?.lightKey)?.title??'');
  el('ritual-lights').replaceChildren(...lights.map(light=>{
    const button=document.createElement('button');button.type='button';button.setAttribute('aria-pressed',String(journey.ritual?.lightKey===light.key));
    const title=document.createElement('span'),source=document.createElement('small');title.textContent=light.title;source.textContent=light.source;button.append(title,source);
    button.addEventListener('click',()=>{journey.ritual!.lightKey=light.key;sound.found();showRitualStep(true);el('ritual-next').focus({preventScroll:true});});return button;
  }));
  paintRitual(animate);
}
el('begin-ritual').addEventListener('click',()=>{
  if(state!=='waiting')return;
  if(!saveFarewellNote()){el('farewell-note').closest('details')!.open=true;el('farewell-note').focus();return;}
  journey.ritual??={laid:false,lightKey:'',signature:''};
  ritualStep=journey.ritual.lightKey?2:journey.ritual.laid?1:0;
  el<HTMLInputElement>('ritual-signature').value=journey.ritual.signature;
  stopClock();sound.stop();ritualDialog.showModal();showRitualStep();el('ritual-title').focus();
});
el('ritual-signature').addEventListener('input',()=>{journey.ritual!.signature=el<HTMLInputElement>('ritual-signature').value;el('ritual-error').textContent='';});
el('ritual-back').addEventListener('click',()=>{ritualStep=Math.max(0,ritualStep-1);showRitualStep();el('ritual-title').focus();});
el('ritual-next').addEventListener('click',()=>{
  if(ritualStep===0){journey.ritual!.laid=true;ritualStep=1;sound.found();showRitualStep(true);el('ritual-title').focus();}
  else if(ritualStep===1){if(!journey.ritual!.lightKey){error('ritual-error','先选一盏想留下的灯。');return;}ritualStep=2;showRitualStep();el('ritual-signature').focus();}
  else try{sealRitual(identity,journey);releasePreview();ritualDialog.close();lightsOut();}catch(e){error('ritual-error',e);el('ritual-signature').focus();}
});
el('ritual-close').addEventListener('click',()=>ritualDialog.close());
ritualDialog.addEventListener('close',()=>{cancelAnimationFrame(ritualRaf);if(state==='waiting')animateWaiting();});
document.addEventListener('visibilitychange',()=>{if(ritualDialog.open)paintRitual();});
function saveFarewellNote(){
  try{const note=validateFarewellNote(el<HTMLTextAreaElement>('farewell-note').value);journey.farewellNote=note;el('farewell-note-error').textContent='';el('farewell-note-status').textContent=`${count(note)} / 120 字 · ${note?'已放进这次旅程，纪念票和回忆册会一起收好':'可留白'}`;el<HTMLButtonElement>('use-project-note').disabled=!identity.regret||Boolean(note);return true;}
  catch(e){error('farewell-note-error',e);return false;}
}
el('farewell-note').addEventListener('input',saveFarewellNote);
el('use-project-note').addEventListener('click',()=>{if(state!=='waiting'||!identity.regret||el<HTMLTextAreaElement>('farewell-note').value.trim())return;el<HTMLTextAreaElement>('farewell-note').value=identity.regret;saveFarewellNote();});
function lightsOut(){
  if(!['waiting','done'].includes(state))return;
  if(state==='waiting'&&!saveFarewellNote()){el('farewell-note').closest('details')!.open=true;el('farewell-note').focus();return;}
  dark=0;stationRipples=[];el('station-story').hidden=true;el<HTMLProgressElement>('ceremony-progress').value=0;el('ceremony-chapter').textContent='01 / 收好这一程';
  stopClock();setState('fading');sound.stop();sound.lamp();const began=performance.now(),words=farewellLines(identity,journey);
  if(reduced.checked){finish();return;}
  el('stage-frame').scrollIntoView({block:'start',behavior:'instant'});el('skip-ceremony').focus({preventScroll:true});
  function fade(now:number){
    if(state!=='fading')return;dark=Math.min(1,(now-began)/9000);
    el<HTMLProgressElement>('ceremony-progress').value=dark;
    const chapter=dark<.22?'01 / 收好这一程':dark<.55?'02 / 把心意留下':'03 / 让这一程慢慢远去';if(el('ceremony-chapter').textContent!==chapter)el('ceremony-chapter').textContent=chapter;
    const line=dark<.18&&rememberedPage(identity,journey)?'这一页，交给你。':dark<.40?words.luggage:dark<.62?words.signal:dark<.82?'谢谢你陪我走到这里。':words.closing;
    if(el('departure-voice').textContent!==line)el('departure-voice').textContent=line;
    draw();if(dark>=1)finish();else raf=requestAnimationFrame(fade);
  }
  raf=requestAnimationFrame(fade);
}
el('replay-ceremony').addEventListener('click',()=>{if(state==='done')lightsOut();});
el('skip-ceremony').addEventListener('click',()=>{if(state==='fading')finish();});
el('lamp').addEventListener('click',lightsOut);el('lamp-hotspot').addEventListener('click',lightsOut);
el('replay').addEventListener('click',()=>{if(state==='done')start();});
el('new-project').addEventListener('click',returnToInput);
el('retry-export').addEventListener('click',()=>{if(state==='done')void generatePreview();});
includeDate.addEventListener('change',()=>{el('date-label').hidden=!includeDate.checked;if(state==='done')void generatePreview();});
date.addEventListener('change',()=>{if(state==='done')void generatePreview();});
download.addEventListener('click',()=>{
  if(!previewUrl||state!=='done')return;
  const link=document.createElement('a');link.href=previewUrl;link.download=filename;document.body.append(link);link.click();link.remove();
  el('export-status').textContent='已发起下载。如果设备没有响应，请用下方链接打开图片后手动保存。';
});
el('save-book').addEventListener('click',()=>{
  if(state!=='done')return;
  try{
    const result=createMemoryBook(identity,journey),url=URL.createObjectURL(result.blob),link=document.createElement('a');
    link.href=url;link.download=result.filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    el('book-status').textContent='已发起下载 · 双击回忆册文件，离线也能翻阅。';
  }catch(e){error('book-status',e);}
});
el('save-handover').addEventListener('click',()=>{
  if(state!=='done')return;
  const blob=new Blob([handoverMarkdown(identity,journey)],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='项目行李与交接.md';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  el('book-status').textContent='已下载交接单，包含你的去向选择、个人补记和原始提交链接。可核对后自行放回项目仓库。';
});
function syncMute(){el('mute').textContent=sound.muted?'声音：关':'声音：开';el('mute').setAttribute('aria-pressed',String(sound.muted));settingsSound.checked=!sound.muted;}
el('mute').addEventListener('click',()=>{sound.setMuted(!sound.muted);syncMute();if(!sound.muted)void enableSound();});
el('open-settings').addEventListener('click',()=>{
  if(settings.open)return;resumeAfterSettings=['playing','cleared','memory'].includes(state);if(resumeAfterSettings)pause();
  if(state==='waiting'||state==='opening')stopClock();
  settingsReduced.checked=reduced.checked;syncMute();settings.showModal();
});
settings.addEventListener('close',()=>{if(resumeAfterSettings&&!document.hidden)resume();if(state==='waiting')animateWaiting();else if(state==='done')animateStationRipples();else if(state==='opening'&&!document.hidden){if(reduced.checked)completeOpening();else{lastStamp=performance.now();raf=requestAnimationFrame(tick);}}else if(['input','reading'].includes(state))animateCover();resumeAfterSettings=false;});
settingsSound.addEventListener('change',()=>{sound.setMuted(!settingsSound.checked);syncMute();if(!sound.muted)void enableSound();});
function syncReduced(){if(reduced.checked&&state==='fading'){finish();}settingsReduced.checked=reduced.checked;el('app').dataset.reduced=String(reduced.checked);motion=undefined;queued=[];pickupAt=undefined;pulses=[];if(['input','reading'].includes(state))animateCover();else if(state==='waiting')animateWaiting();draw();}
settingsReduced.addEventListener('change',()=>{reduced.checked=settingsReduced.checked;syncReduced();});
reduced.addEventListener('change',syncReduced);guides.addEventListener('change',draw);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){if(['playing','cleared','memory'].includes(state))pause();if(state==='waiting'||state==='opening')stopClock();if(['input','reading'].includes(state))stopCover();if(state==='fading')finish();sound.suspend();}
  else if(state==='waiting')animateWaiting();else if(state==='opening'){lastStamp=performance.now();raf=requestAnimationFrame(tick);}else if(['input','reading'].includes(state))animateCover();
});
window.addEventListener('pagehide',()=>{stopClock();stopCover();sound.stop();});
window.addEventListener('pageshow',event=>{if(event.persisted){if(state==='playing')pause();if(state==='waiting')animateWaiting();else if(state==='opening'){lastStamp=performance.now();raf=requestAnimationFrame(tick);}else if(['input','reading'].includes(state))animateCover();}});
const cancelImport=setupImport(enterConfirm);
reduced.checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
el('app').dataset.reduced=String(reduced.checked);
stage.width=WIDTH;stage.height=HEIGHT;date.value=localDate();syncMute();
if(ctx&&!reduced.checked){setState('opening');draw();lastStamp=performance.now();raf=requestAnimationFrame(tick);}else{setState('input');draw();}
if(!ctx)error('input-error','当前浏览器不支持画布。请使用支持 Canvas 的浏览器，项目内容不会被改动。');
