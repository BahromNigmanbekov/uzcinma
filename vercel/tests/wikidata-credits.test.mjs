import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {ensureSchema} from '../server/schema.js';
import {createWikidataService} from '../server/wikidata-credits.js';
import {saveManualCredits,getCredits} from '../server/credits.js';
import {titleDetails} from '../server/series.js';
import {wikidataFixtureFetch} from './helpers/wikidata-fixture.mjs';
async function fixture(){const db=createClient({url:'file::memory:'});await ensureSchema(db);await db.execute("INSERT INTO movies(id,title,created_at,updated_at) VALUES(1,'Owner Film',1,1)");const remote=wikidataFixtureFetch({count:3});return {db,...remote,service:createWikidataService({db,fetchImpl:remote.fetchImpl}),close:()=>db.close()};}
test('free search/import requires no key and preserves actual roles and licensed image attribution',async()=>{
 const f=await fixture();try{
  const found=await f.service.search('Adventure');assert.equal(found.results.length,1);assert.equal(found.results[0].year,'2024');
  const data=await f.service.importTitle(1,{wikidata_id:'Q10',revision:0});assert.equal(data.cast.length,3);assert.equal(data.directors[0].name,'Fixture Director');assert.equal(data.cast[0].role,'Main Character');
  assert.equal(data.cast[0].photo_credit.author,'Fixture Photographer');assert.equal(data.cast[0].photo_credit.license,'CC BY-SA 4.0');assert.equal(data.cast[1].photo,null);assert.equal(data.wikidata.id,'Q10');assert.equal(data.tmdb,null);
  assert.ok(f.calls.every(url=>!url.includes('api_key')));const count=f.calls.length;await titleDetails(f.db,1);await titleDetails(f.db,1);assert.equal(f.calls.length,count);
  const same=await f.service.importTitle(1,{wikidata_id:'Q10',revision:data.revision});assert.equal(same.cast.length,3);assert.equal(f.calls.length,count);
 }finally{f.close();}
});
test('manual corrections survive free reimport, replaced photo credit is cleared and unlink preserves manual actors',async()=>{
 const f=await fixture();try{
  let data=await f.service.importTitle(1,{wikidata_id:'Q10',revision:0});data.cast[0].name='Owner correction';data.cast[0].photo='https://example.com/replacement.jpg';data.cast.push({name:'Manual Person',role:'Voice'});
  data=await saveManualCredits(f.db,1,data);assert.equal(data.cast[0].photo_credit,null);
  data=await f.service.importTitle(1,{wikidata_id:'Q10',revision:data.revision});assert.equal(data.cast[0].name,'Owner correction');assert.equal(data.cast[0].photo_credit,null);
  data=await f.service.disconnect(1,data.revision);assert.equal(data.cast.length,1);assert.equal(data.cast[0].name,'Manual Person');assert.equal(data.wikidata,null);
 }finally{f.close();}
});
test('bad IDs, non-film selections and stale imports cannot replace stored cast',async()=>{
 const f=await fixture();try{
  const saved=await saveManualCredits(f.db,1,{cast:[{name:'Keep me'}],directors:[],revision:0});
  await assert.rejects(()=>f.service.importTitle(1,{wikidata_id:'Q10?evil=1',revision:saved.revision}));
  await assert.rejects(()=>f.service.importTitle(1,{wikidata_id:'Q999',revision:saved.revision}),e=>e.status===404);
  await assert.rejects(()=>f.service.importTitle(1,{wikidata_id:'Q10',revision:0}),e=>e.status===409);
  assert.equal((await getCredits(f.db,1)).cast[0].name,'Keep me');
 }finally{f.close();}
});
