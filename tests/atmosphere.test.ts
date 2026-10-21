import {test} from 'node:test';
import assert from 'node:assert/strict';
import {explorationLine,levels,newBoard,positions} from '../src/game.ts';

test('环境线索回应发现、机关与点灯，而非一开始给出路线答案',()=>{
  const forest=newBoard(levels[0]);assert(!explorationLine(0,forest).includes('金色方框'));
  assert.notEqual(explorationLine(0,forest),explorationLine(0,{...forest,found:true}));
  const river=newBoard(levels[1]),opened={...river,ghost:positions(levels[1],'s')[0]};
  assert.notEqual(explorationLine(1,river),explorationLine(1,opened));
  const garden=newBoard(levels[2]);assert.notEqual(explorationLine(2,garden),explorationLine(2,{...garden,lit:positions(levels[2],'a')}));
  for(let i=0;i<levels.length;i++)assert(explorationLine(i,newBoard(levels[i])).length>10);
});
