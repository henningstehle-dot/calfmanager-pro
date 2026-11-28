import {test} from 'node:test';
import assert from 'node:assert/strict';
import {healthPercentages} from '../src/dashboard-model.ts';
test('Gesundheitsanteile ergeben zusammen 100 Prozent',()=>{const p=healthPercentages([...Array(620).fill('green'),...Array(380).fill('yellow'),...Array(200).fill('red')]);assert.equal(Object.values(p).reduce((a,b)=>a+b,0),100);});
test('Leerer Bestand hat keine Gesundheitsanteile',()=>assert.deepEqual(healthPercentages([]),{green:0,yellow:0,red:0}));
