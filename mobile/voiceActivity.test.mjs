import {test} from 'node:test';
import assert from 'node:assert/strict';
import {voiceActivity} from './voiceActivity.ts';
const state=(monitor=false)=>({monitor,started:1000,utteranceAt:1000,lastSound:1000,heard:false,bargeSamples:0,trimStart:0});
test('silence ends a question only after speech has been heard',()=>{
 const s=state();assert.equal(voiceActivity(s,-160,2500),'none');
 assert.equal(voiceActivity(s,-25,2600),'none');
 assert.equal(voiceActivity(s,-160,3500),'none');
 assert.equal(voiceActivity(s,-160,3650),'submit');
});
test('short noise and startup audio do not interrupt a spoken reply',()=>{
 const s=state(true);assert.equal(voiceActivity(s,-10,1500),'none');
 assert.equal(voiceActivity(s,-25,2000),'none');
 assert.equal(voiceActivity(s,-25,2150),'none');
 assert.equal(voiceActivity(s,-60,2300),'none');assert.equal(s.monitor,true);
});
test('sustained speech interrupts, preserves the new question and trims the old reply',()=>{
 const s=state(true);voiceActivity(s,-25,5000);voiceActivity(s,-25,5150);
 assert.equal(voiceActivity(s,-25,5300),'interrupt');
 assert.equal(s.monitor,false);assert.ok(Math.abs(s.trimStart-3.6)<0.001);
 assert.equal(voiceActivity(s,-25,5600),'none');
 assert.equal(voiceActivity(s,-160,6700),'submit');
});
test('empty listening times out and a long question is bounded',()=>{
 assert.equal(voiceActivity(state(),-160,11001),'timeout');
 assert.equal(voiceActivity({...state(),heard:true},-20,31001),'submit');
});
