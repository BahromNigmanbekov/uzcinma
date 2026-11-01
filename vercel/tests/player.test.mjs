import test from 'node:test';
import assert from 'node:assert/strict';
import {doubleTap,clampTime,formatTime,fileSources,levelChoices} from '../src/player-utils.js';
test('double tap recognizes left and right, rejects drags and slow taps',()=>{
 const p={time:100,x:280,y:60};
 assert.equal(doubleTap(p,{time:290,x:285,y:63},390),10);
 assert.equal(doubleTap({time:100,x:50,y:60},{time:290,x:52,y:63},390),-10);
 assert.equal(doubleTap(p,{time:450,x:285,y:63},390),0);
 assert.equal(doubleTap(p,{time:290,x:190,y:63},390),0);
 assert.equal(doubleTap(p,{time:290,x:280,y:200},390),0);
});
test('seeking clamps at movie boundaries and handles unknown duration',()=>{
 assert.equal(clampTime(-7,100),0);assert.equal(clampTime(105,100),100);assert.equal(clampTime(10,NaN),0);
 assert.equal(formatTime(3671),'1:01:11');assert.equal(formatTime(Infinity),'00:00');
});
test('quality labels come only from manifest levels or supplied files',()=>{
 const options=levelChoices([{height:480,bitrate:1000},{height:720,bitrate:2000},{height:480,bitrate:1500},{height:0,bitrate:100}]);
 assert.deepEqual(options,[{value:'1',label:'720p'},{value:'2',label:'480p'}]);
 assert.equal(options.some(o=>o.label==='1080p'),false);
 assert.deepEqual(fileSources([{quality:'480',url:'a'},{quality:'hls',url:'b'},{quality:'1080',url:'c'}]).map(s=>s.quality),['1080','480']);
});
