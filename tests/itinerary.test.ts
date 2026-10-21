import {test} from 'node:test';
import assert from 'node:assert/strict';
import {journeyStats,newJourney,reachedJourneyEnd} from '../src/game.ts';
import {example} from '../src/input.ts';
import {memoryBookHtml} from '../src/memory.ts';

test('一站同行必须真正完成第一关；路线不会把未访问章节算成通关',()=>{
  const j=newJourney();j.itinerary='one';assert.equal(reachedJourneyEnd(j,0),false);
  j.visited=[0];assert.equal(reachedJourneyEnd(j,0),true);assert.equal(reachedJourneyEnd(j,1),false);
  assert(journeyStats(j).includes('1 / 7 站'));assert(journeyStats(j).includes('一站同行'));assert(!journeyStats(j).includes('提前到站'));
  const html=memoryBookHtml(example('weather'),j,'data:image/png;base64,AAAA');assert(html.includes(journeyStats(j)));assert(!html.includes('id="memory-1"'));
  j.skipped=true;assert(journeyStats(j).includes('提前到站'));
});
test('默认与旧旅程保持七站终点，回看早期章节不改变终点',()=>{
  const j=newJourney();j.visited=[0];assert.equal(reachedJourneyEnd(j,0),false);
  j.visited=[0,1,2,3,4,5,6];assert.equal(reachedJourneyEnd(j,6),true);assert.equal(reachedJourneyEnd(j,0),false);
  assert(!journeyStats(j).includes('一站同行'));
});
