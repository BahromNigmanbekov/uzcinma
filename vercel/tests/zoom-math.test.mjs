import test from 'node:test';import assert from 'node:assert/strict';import {zoomBounds} from '../src/zoom-math.js';
test('contained video cannot pan at its original size',()=>{assert.deepEqual(zoomBounds(390,844,1920,1080,1),{x:0,y:0});});
test('pinch pan bounds follow actual picture, including letterboxing',()=>{assert.deepEqual(zoomBounds(400,400,1920,1080,2),{x:200,y:25});assert.deepEqual(zoomBounds(400,225,1920,1080,3),{x:400,y:225});});
test('no dimensions does not introduce invalid transforms',()=>{assert.deepEqual(zoomBounds(0,0,1920,1080,2),{x:0,y:0});assert.deepEqual(zoomBounds(400,225,0,0,2),{x:200,y:112.5});});
