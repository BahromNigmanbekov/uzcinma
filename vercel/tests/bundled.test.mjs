import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {mkdtemp,copyFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
delete process.env.TURSO_DATABASE_URL;delete process.env.CATALOG_MODE;process.env.DEMO_MODE='1';
const {default:catalog}=await import('../api/catalog.js');
const {default:playback}=await import('../api/playback.js');
const snapshot=JSON.parse(readFileSync(new URL('../server/bot-catalog.json',import.meta.url),'utf8'));
async function api(handler,query={}){
 let body;const res={setHeader(){},end:s=>{body=JSON.parse(s);}};
 await handler({method:'GET',query,headers:{}},res);return {status:res.statusCode,body};
}
test('uploaded bot catalog takes priority over legacy demo setting without a database',async()=>{
 const result=await api(catalog);
 assert.equal(result.status,200);assert.equal(result.body.mode,'live');assert.equal(result.body.provider,'bot-export');
 assert.equal(result.body.total,snapshot.movies.length);
 assert.ok(result.body.movies.every(m=>!m.is_demo));
 assert.ok(!('sources' in result.body.movies[0]));
 for(const field of ['file_id','file_unique_id','source_chat_id','source_message_id','cache_key','media_type'])assert.equal(JSON.stringify(result.body).includes('"'+field+'"'),false);
});
test('exported media is playable and references existing static files or cached streams',async()=>{
 const references=[];
 for(const movie of snapshot.movies){
  const result=await api(playback,{id:movie.id});
  if(!movie.available){assert.equal(result.status,409);continue;}
  assert.equal(result.status,200);
  assert.equal(result.body.kind,'files');assert.equal(result.body.variants[0].quality,'original');
  const path=result.body.variants[0].url;
  if(path.startsWith('/media/')){
   assert.ok(/^\/media\/video-[a-f0-9]{64}\.(mp4|webm|m4v|mov)$/.test(path));
   assert.ok(existsSync(new URL('../public'+path,import.meta.url)));
  }else{
   assert.equal(path,'/api/local-media?id='+movie.id);
   assert.match(movie.cache_key,/^[a-f0-9]{64}$/);
   assert.ok(existsSync(new URL('../../.site-cache/'+movie.cache_key,import.meta.url)));
  }
  references.push(path);
 }
 const playable=snapshot.movies.filter(m=>m.available).length;
 assert.ok(new Set(references).size<=playable);
 assert.equal((await api(playback,{id:'999999999'})).status,404);
 assert.equal((await api(playback,{id:'../secret'})).status,400);
});
test('search, saved IDs and pagination filter the uploaded catalog',async()=>{
 const first=snapshot.movies[0];
 assert.equal((await api(catalog,{ids:first.id})).body.movies.length,1);
 assert.equal((await api(catalog,{ids:''})).body.total,0);
 assert.equal((await api(catalog,{q:first.title})).body.movies.some(m=>m.id===first.id),true);
 assert.equal((await api(catalog,{limit:'1'})).body.movies.length,1);
 assert.equal((await api(catalog,{q:'not-present-xyz-12345'})).body.total,0);
});


test('Vercel catalog includes playable hosted films and omits notebook-only streams',async()=>{
 const previous=process.env.VERCEL;process.env.VERCEL='1';
 try{
  const result=await api(catalog,{limit:'60'});assert.equal(result.status,200);
  const expected=snapshot.movies.filter(movie=>movie.sources?.some(source=>source.url.startsWith('/media/')||source.url.startsWith('https://')));
  assert.equal(result.body.total,expected.length);assert.ok(expected.length>0);
  for(const movie of result.body.movies){
   const film=await api(playback,{id:movie.id});assert.equal(film.status,200);
   assert.ok(film.body.variants.every(source=>!source.url.startsWith('/api/local-media')));
  }
  for(const movie of snapshot.movies.filter(movie=>!expected.some(online=>online.id===movie.id))){
   assert.equal((await api(playback,{id:movie.id})).status,404);
  }
 }finally{if(previous===undefined)delete process.env.VERCEL;else process.env.VERCEL=previous;}
});


test('relocated serverless catalog works without a runtime JSON file',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'uzcinma-catalog-'));
 const modulePath=join(directory,'bundled.mjs'),jsonPath=join(directory,'bot-catalog.json');
 const previous=process.env.VERCEL;delete process.env.VERCEL;
 try{
  await copyFile(new URL('../server/bundled.js',import.meta.url),modulePath);
  await copyFile(new URL('../server/bot-catalog.json',import.meta.url),jsonPath);
  const module=await import(pathToFileURL(modulePath).href);
  await unlink(jsonPath);
  const movies=module.bundledCatalog();
  assert.ok(movies.length>0);
  assert.ok(movies.every(movie=>movie.sources.every(source=>!source.url.startsWith('/api/local-media'))));
  assert.doesNotThrow(()=>module.bundledHome(movies));
 }finally{
  if(previous===undefined)delete process.env.VERCEL;else process.env.VERCEL=previous;
  await unlink(modulePath).catch(()=>{});await unlink(jsonPath).catch(()=>{});await rmdir(directory);
 }
});
